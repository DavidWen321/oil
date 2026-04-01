package com.pipeline.data.service.impl;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pipeline.common.core.exception.BusinessException;
import com.pipeline.data.config.KnowledgeDocumentProperties;
import com.pipeline.data.domain.KnowledgeDocument;
import com.pipeline.data.domain.KnowledgeIngestTask;
import com.pipeline.data.mapper.KnowledgeDocumentMapper;
import com.pipeline.data.mapper.KnowledgeIngestTaskMapper;
import com.pipeline.data.service.IKnowledgeDocumentService;
import com.pipeline.data.service.KnowledgeFileStorageService;
import com.pipeline.data.service.KnowledgeIngestAsyncService;

import cn.hutool.core.util.StrUtil;
import cn.hutool.crypto.digest.DigestUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class KnowledgeDocumentServiceImpl extends ServiceImpl<KnowledgeDocumentMapper, KnowledgeDocument>
        implements IKnowledgeDocumentService {

    private static final String STATUS_UPLOADED = "UPLOADED";
    private static final String STATUS_PROCESSING = "PROCESSING";
    private static final String STATUS_FAILED = "FAILED";
    private static final String TASK_STATUS_PENDING = "PENDING";
    private static final String TASK_STATUS_PROCESSING = "PROCESSING";
    private static final List<String> SUPPORTED_EXTENSIONS = List.of(".pdf", ".docx", ".md", ".txt");

    private final KnowledgeDocumentProperties properties;
    private final KnowledgeIngestTaskMapper taskMapper;
    private final KnowledgeFileStorageService storageService;
    private final KnowledgeIngestAsyncService asyncService;

    @Override
    public List<KnowledgeDocument> listDocuments() {
        return list(new LambdaQueryWrapper<KnowledgeDocument>()
                .orderByDesc(KnowledgeDocument::getUpdateTime, KnowledgeDocument::getId));
    }

    @Override
    public List<KnowledgeIngestTask> listTasks(Long documentId) {
        return taskMapper.selectList(new LambdaQueryWrapper<KnowledgeIngestTask>()
                .eq(KnowledgeIngestTask::getDocumentId, documentId)
                .orderByDesc(KnowledgeIngestTask::getCreateTime, KnowledgeIngestTask::getId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeDocument uploadDocument(MultipartFile file, String title, String category,
                                            String sourceType, String tags, String remark) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("请先选择要上传的知识文档");
        }

        String originalFilename = StrUtil.blankToDefault(file.getOriginalFilename(), "knowledge.bin");
        String extension = getFileExtension(originalFilename);
        if (!SUPPORTED_EXTENSIONS.contains(extension)) {
            throw new BusinessException("仅支持 PDF、DOCX、MD、TXT 文档");
        }

        String normalizedCategory = normalizeCategory(category);
        byte[] content = readContent(file);
        String fileHash = DigestUtil.sha256Hex(content);
        ensureNotDuplicated(fileHash);

        KnowledgeFileStorageService.StoredObject storedObject =
                storageService.store(content, originalFilename, normalizedCategory, fileHash);

        KnowledgeDocument document = buildDocument(file, title, normalizedCategory, sourceType, tags, remark, extension);
        document.setFileHash(fileHash);
        document.setStorageType(storedObject.storageType());
        document.setStorageBucket(storedObject.bucket());
        document.setStorageObjectKey(storedObject.objectKey());
        document.setStatus(STATUS_UPLOADED);
        try {
            save(document);
        } catch (DuplicateKeyException ex) {
            throw new BusinessException("相同文件已经录入，请直接查看或重试现有记录");
        }

        KnowledgeIngestTask task = createTask(document, "UPLOAD", 1);
        dispatchAsyncAfterCommit(document.getId(), task.getId(), snapshot(document));
        return getById(document.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public KnowledgeDocument retryDocument(Long id) {
        KnowledgeDocument document = getRequiredDocument(id);
        if (hasActiveTask(document.getId())
                || STATUS_PROCESSING.equalsIgnoreCase(StrUtil.blankToDefault(document.getStatus(), ""))) {
            throw new BusinessException("当前文档已有入库任务在执行，请稍后再试");
        }
        if (StrUtil.isBlank(document.getStorageObjectKey())) {
            throw new BusinessException("当前文档没有可用的原文件路径，无法发起重试");
        }

        ExistingIndexState previous = snapshot(document);
        int nextRetryCount = defaultInt(document.getRetryCount()) + 1;
        document.setRetryCount(nextRetryCount);
        document.setStatus(STATUS_UPLOADED);
        document.setFailureReason(null);
        updateById(document);

        KnowledgeIngestTask task = createTask(document, "RETRY", nextRetryCount + 1);
        dispatchAsyncAfterCommit(document.getId(), task.getId(), previous);
        return getById(id);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteDocument(Long id) {
        KnowledgeDocument document = getRequiredDocument(id);

        if (hasActiveTask(document.getId())
                || STATUS_PROCESSING.equalsIgnoreCase(StrUtil.blankToDefault(document.getStatus(), ""))) {
            throw new BusinessException("文档正在处理中，请稍后再删除");
        }

        if (StrUtil.isNotBlank(document.getAgentDocId())) {
            boolean success = asyncService.deleteAgentDocument(document.getAgentDocId());
            if (!success) {
                throw new BusinessException("向量库文档删除失败，请稍后重试");
            }
        }

        storageService.delete(document.getStorageType(), document.getStorageBucket(), document.getStorageObjectKey());
        taskMapper.delete(new LambdaQueryWrapper<KnowledgeIngestTask>()
                .eq(KnowledgeIngestTask::getDocumentId, id));
        return baseMapper.hardDeleteById(id) > 0;
    }

    private void dispatchAsyncAfterCommit(Long documentId, Long taskId, ExistingIndexState previous) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    asyncService.processTask(
                            documentId,
                            taskId,
                            previous.agentDocId(),
                            previous.chunkCount(),
                            previous.status(),
                            previous.lastIngestTime());
                } catch (RuntimeException ex) {
                    log.error("Failed to dispatch async knowledge ingest task", ex);
                    markDispatchFailed(documentId, taskId, ex.getMessage());
                }
            }
        });
    }

    private void markDispatchFailed(Long documentId, Long taskId, String message) {
        String detail = "任务投递失败: " + StrUtil.blankToDefault(message, "请稍后重试");

        KnowledgeDocument latestDocument = getById(documentId);
        if (latestDocument != null) {
            latestDocument.setStatus(STATUS_FAILED);
            latestDocument.setFailureReason(detail);
            updateById(latestDocument);
        }

        KnowledgeIngestTask latestTask = taskMapper.selectById(taskId);
        if (latestTask != null) {
            latestTask.setStatus(STATUS_FAILED);
            latestTask.setFailureReason(detail);
            taskMapper.updateById(latestTask);
        }
    }

    private KnowledgeDocument buildDocument(MultipartFile file, String title, String category,
                                            String sourceType, String tags, String remark, String extension) {
        KnowledgeDocument document = new KnowledgeDocument();
        document.setTitle(StrUtil.blankToDefault(title, stripExtension(file.getOriginalFilename())));
        document.setCategory(category);
        document.setSourceType(StrUtil.blankToDefault(sourceType, "manual"));
        document.setTags(StrUtil.nullToEmpty(tags));
        document.setRemark(StrUtil.nullToEmpty(remark));
        document.setFileName(StrUtil.blankToDefault(file.getOriginalFilename(), "unknown"));
        document.setFileExtension(extension);
        document.setFileSize(file.getSize());
        document.setChunkCount(0);
        document.setRetryCount(0);
        document.setStatus(STATUS_UPLOADED);
        document.setCreateBy("system");
        return document;
    }

    private KnowledgeIngestTask createTask(KnowledgeDocument document, String taskType, int attemptNo) {
        KnowledgeIngestTask task = new KnowledgeIngestTask();
        task.setDocumentId(document.getId());
        task.setTaskType(taskType);
        task.setAttemptNo(attemptNo);
        task.setStatus(TASK_STATUS_PENDING);
        task.setChunkCount(0);
        task.setCreateBy(document.getCreateBy());
        taskMapper.insert(task);
        return task;
    }

    private boolean hasActiveTask(Long documentId) {
        return taskMapper.selectCount(new LambdaQueryWrapper<KnowledgeIngestTask>()
                .eq(KnowledgeIngestTask::getDocumentId, documentId)
                .in(KnowledgeIngestTask::getStatus, TASK_STATUS_PENDING, TASK_STATUS_PROCESSING)) > 0;
    }

    private KnowledgeDocument getRequiredDocument(Long id) {
        KnowledgeDocument document = getById(id);
        if (document == null) {
            throw new BusinessException("知识文档不存在");
        }
        return document;
    }

    private void ensureNotDuplicated(String fileHash) {
        KnowledgeDocument existing = baseMapper.selectAnyByFileHash(fileHash);
        if (existing == null) {
            return;
        }
        if (Integer.valueOf(1).equals(existing.getIsDeleted())) {
            baseMapper.hardDeleteById(existing.getId());
            return;
        }
        throw new BusinessException("相同文件已经录入，请直接查看或重试现有记录");
    }

    private String normalizeCategory(String category) {
        String normalized = StrUtil.blankToDefault(category, "faq").trim().toLowerCase();
        if (!properties.getAllowedCategories().contains(normalized)) {
            throw new BusinessException("不支持的知识分类: " + normalized);
        }
        return normalized;
    }

    private byte[] readContent(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new BusinessException("文件读取失败: " + ex.getMessage());
        }
    }

    private String getFileExtension(String fileName) {
        if (StrUtil.isBlank(fileName) || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    }

    private String stripExtension(String fileName) {
        if (StrUtil.isBlank(fileName) || !fileName.contains(".")) {
            return StrUtil.blankToDefault(fileName, "未命名文档");
        }
        return fileName.substring(0, fileName.lastIndexOf('.'));
    }

    private int defaultInt(Integer value) {
        return value == null ? 0 : value;
    }

    private ExistingIndexState snapshot(KnowledgeDocument document) {
        return new ExistingIndexState(
                document.getAgentDocId(),
                defaultInt(document.getChunkCount()),
                StrUtil.blankToDefault(document.getStatus(), STATUS_UPLOADED),
                document.getLastIngestTime());
    }

    private record ExistingIndexState(String agentDocId, int chunkCount, String status, LocalDateTime lastIngestTime) {
    }
}
