package com.pipeline.calculation.service.impl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

import org.apache.poi.xwpf.usermodel.ParagraphAlignment;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.HydraulicAnalysisResult;
import com.pipeline.calculation.domain.entity.AnalysisReport;
import com.pipeline.calculation.domain.report.HydraulicReportData;
import com.pipeline.calculation.mapper.AnalysisReportMapper;
import com.pipeline.calculation.service.IReportService;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;
import com.pipeline.common.core.enums.ReportTypeEnum;
import com.pipeline.common.core.exception.BusinessException;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 报告服务实现类
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportServiceImpl
        extends ServiceImpl<AnalysisReportMapper, AnalysisReport>
        implements IReportService {

    private static final DateTimeFormatter FILE_DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    @Value("${report.storage.path:./reports}")
    private String storagePath;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Result<Long> generateHydraulicReport(
            HydraulicAnalysisParams params,
            HydraulicAnalysisResult result,
            Long userId,
            String userName) {

        long startTime = System.currentTimeMillis();

        // 创建报告记录
        AnalysisReport report = new AnalysisReport();
        report.setReportTitle("水力分析报告_" + LocalDateTime.now().format(FILE_DATE_FORMATTER));
        report.setReportType(ReportTypeEnum.HYDRAULIC.getCode());
        report.setCreateBy(String.valueOf(userId));
        report.setFileFormat(AnalysisReport.FORMAT_DOCX);
        report.setStatus(AnalysisReport.STATUS_GENERATING);
        report.setReportNo("RPT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());

        this.save(report);

        try {
            // 构建报告数据
            HydraulicReportData reportData = buildReportData(params, result);

            // 生成Word文档
            byte[] docContent = generateWordDocument(reportData);

            // 保存文件
            String fileName = "hydraulic_report_" + report.getId() + "_" +
                    LocalDateTime.now().format(FILE_DATE_FORMATTER) + ".docx";
            String filePath = saveReportFile(docContent, fileName);

            // 更新报告记录
            report.setFileName(fileName);
            report.setFilePath(filePath);
            report.setFileSize((long) docContent.length);
            report.setReportSummary(generateSummary(result));
            report.setStatus(AnalysisReport.STATUS_COMPLETED);
            report.setUpdateTime(LocalDateTime.now());

            this.updateById(report);

            long duration = System.currentTimeMillis() - startTime;
            log.info("报告生成成功: id={}, fileName={}, size={}bytes, duration={}ms",
                    report.getId(), fileName, docContent.length, duration);

            return Result.ok(report.getId());

        } catch (Exception e) {
            log.error("报告生成失败", e);
            report.setStatus(AnalysisReport.STATUS_FAILED);
            report.setErrorMsg(e.getMessage());
            report.setUpdateTime(LocalDateTime.now());
            this.updateById(report);

            return Result.fail("报告生成失败: " + e.getMessage());
        }
    }

    @Override
    public Result<Long> generateReportFromHistory(Long historyId, Long userId, String userName) {
        throw new BusinessException("功能开发中");
    }

    @Override
    public AnalysisReport getReportDetail(Long id) {
        if (id == null) {
            throw new BusinessException("报告ID不能为空");
        }
        AnalysisReport report = this.getById(id);
        if (report == null) {
            throw new BusinessException("报告不存在");
        }
        return report;
    }

    @Override
    public Result<String> getDownloadUrl(Long id) {
        AnalysisReport report = getReportDetail(id);
        if (report.getStatus() != AnalysisReport.STATUS_COMPLETED) {
            return Result.fail("报告尚未生成完成");
        }
        return Result.ok(report.getFilePath());
    }

    @Override
    public Result<byte[]> getReportContent(Long id) {
        AnalysisReport report = getReportDetail(id);
        if (report.getStatus() != AnalysisReport.STATUS_COMPLETED) {
            return Result.fail("报告尚未生成完成");
        }

        try {
            Path path = Paths.get(report.getFilePath());
            if (!Files.exists(path)) {
                return Result.fail("报告文件不存在");
            }
            byte[] content = Files.readAllBytes(path);

            return Result.ok(content);
        } catch (IOException e) {
            log.error("读取报告文件失败", e);
            return Result.fail("读取报告文件失败");
        }
    }

    @Override
    public PageResult<AnalysisReport> queryReportPage(
            String reportType, Long projectId, Long userId,
            int pageNum, int pageSize) {

        LambdaQueryWrapper<AnalysisReport> wrapper = new LambdaQueryWrapper<>();

        if (StringUtils.isNotBlank(reportType)) {
            wrapper.eq(AnalysisReport::getReportType, reportType);
        }
        if (projectId != null) {
            wrapper.eq(AnalysisReport::getProId, projectId);
        }
        if (userId != null) {
            wrapper.eq(AnalysisReport::getCreateBy, String.valueOf(userId));
        }
        wrapper.orderByDesc(AnalysisReport::getCreateTime);

        Page<AnalysisReport> page = new Page<>(pageNum, pageSize);
        IPage<AnalysisReport> result = this.page(page, wrapper);

        return PageResult.build(
                result.getRecords(), result.getTotal(),
                result.getCurrent(), result.getSize());
    }

    @Override
    public List<AnalysisReport> getRecentReports(Long userId, int limit) {
        return baseMapper.selectRecentByCreateBy(String.valueOf(userId), limit);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteReport(Long id) {
        AnalysisReport report = this.getById(id);
        if (report != null && report.getFilePath() != null) {
            try {
                Files.deleteIfExists(Paths.get(report.getFilePath()));
            } catch (IOException e) {
                log.warn("删除报告文件失败: {}", report.getFilePath());
            }
        }
        return this.removeById(id);
    }

    @Override
    public HydraulicReportData buildReportData(
            HydraulicAnalysisParams params, HydraulicAnalysisResult result) {

        BigDecimal innerDiameter = params.getDiameter()
                .subtract(params.getThickness().multiply(new BigDecimal("2")));
        BigDecimal elevationDiff = params.getEndAltitude().subtract(params.getStartAltitude());

        return HydraulicReportData.builder()
                .title("水力分析报告")
                .reportNo("RPT-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .generateDate(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日")))
                // 管道参数
                .pipelineLength(formatDecimal(params.getLength()) + " km")
                .outerDiameter(formatDecimal(params.getDiameter()) + " mm")
                .wallThickness(formatDecimal(params.getThickness()) + " mm")
                .innerDiameter(formatDecimal(innerDiameter) + " mm")
                .startElevation(formatDecimal(params.getStartAltitude()) + " m")
                .endElevation(formatDecimal(params.getEndAltitude()) + " m")
                .elevationDiff(formatDecimal(elevationDiff) + " m")
                .roughness(formatDecimal(params.getRoughness()) + " mm")
                // 油品参数
                .oilDensity(formatDecimal(params.getDensity()) + " kg/m³")
                .oilViscosity(formatDecimal(params.getViscosity()) + " mm²/s")
                // 运行参数
                .designFlowRate(formatDecimal(params.getFlowRate()) + " m³/h")
                .inletPressure(formatDecimal(params.getInletPressure()) + " m")
                .pump480Count(params.getPump480Num())
                .pump375Count(params.getPump375Num())
                .pumpConfiguration(String.format("ZMI480×%d + ZMI375×%d",
                        params.getPump480Num(), params.getPump375Num()))
                // 计算结果
                .reynoldsNumber(formatDecimal(result.getReynoldsNumber()))
                .flowRegime(result.getFlowRegime())
                .frictionHeadLoss(formatDecimal(result.getFrictionHeadLoss()) + " m")
                .hydraulicSlope(formatDecimal(result.getHydraulicSlope()) + " m/km")
                .totalHead(formatDecimal(result.getTotalHead()) + " m")
                .firstStationPressure(formatDecimal(result.getFirstStationOutPressure()) + " MPa")
                .endStationPressure(formatDecimal(result.getEndStationInPressure()) + " MPa")
                // 结论
                .conclusion(HydraulicReportData.generateConclusion(result.getEndStationInPressure()))
                .hasSensitivityAnalysis(false)
                .build();
    }

    /**
     * 生成Word文档
     */
    private byte[] generateWordDocument(HydraulicReportData data) throws IOException {
        try (XWPFDocument document = new XWPFDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            // 标题
            XWPFParagraph titlePara = document.createParagraph();
            titlePara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun titleRun = titlePara.createRun();
            titleRun.setText(data.getTitle());
            titleRun.setBold(true);
            titleRun.setFontSize(18);

            // 报告编号和日期
            addParagraph(document, "报告编号：" + data.getReportNo());
            addParagraph(document, "生成日期：" + data.getGenerateDate());
            addEmptyLine(document);

            // 一、管道基本参数
            addSectionTitle(document, "一、管道基本参数");
            XWPFTable pipeTable = document.createTable(5, 2);
            addTableRow(pipeTable, 0, "管道长度", data.getPipelineLength());
            addTableRow(pipeTable, 1, "管道外径", data.getOuterDiameter());
            addTableRow(pipeTable, 2, "管道壁厚", data.getWallThickness());
            addTableRow(pipeTable, 3, "管道内径", data.getInnerDiameter());
            addTableRow(pipeTable, 4, "管道粗糙度", data.getRoughness());
            addEmptyLine(document);

            // 二、油品参数
            addSectionTitle(document, "二、油品参数");
            XWPFTable oilTable = document.createTable(2, 2);
            addTableRow(oilTable, 0, "油品密度", data.getOilDensity());
            addTableRow(oilTable, 1, "运动粘度", data.getOilViscosity());
            addEmptyLine(document);

            // 三、运行参数
            addSectionTitle(document, "三、运行参数");
            XWPFTable runTable = document.createTable(3, 2);
            addTableRow(runTable, 0, "设计流量", data.getDesignFlowRate());
            addTableRow(runTable, 1, "首站进站压头", data.getInletPressure());
            addTableRow(runTable, 2, "泵配置", data.getPumpConfiguration());
            addEmptyLine(document);

            // 四、计算结果
            addSectionTitle(document, "四、计算结果");
            XWPFTable resultTable = document.createTable(7, 2);
            addTableRow(resultTable, 0, "雷诺数", data.getReynoldsNumber());
            addTableRow(resultTable, 1, "流态", data.getFlowRegime());
            addTableRow(resultTable, 2, "沿程摩阻", data.getFrictionHeadLoss());
            addTableRow(resultTable, 3, "水力坡降", data.getHydraulicSlope());
            addTableRow(resultTable, 4, "总扬程", data.getTotalHead());
            addTableRow(resultTable, 5, "首站出站压力", data.getFirstStationPressure());
            addTableRow(resultTable, 6, "末站进站压力", data.getEndStationPressure());
            addEmptyLine(document);

            // 五、结论
            addSectionTitle(document, "五、分析结论");
            addParagraph(document, data.getConclusion());

            document.write(out);
            return out.toByteArray();
        }
    }

    private void addParagraph(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        XWPFRun run = para.createRun();
        run.setText(text);
    }

    private void addSectionTitle(XWPFDocument doc, String text) {
        XWPFParagraph para = doc.createParagraph();
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setBold(true);
        run.setFontSize(14);
    }

    private void addEmptyLine(XWPFDocument doc) {
        doc.createParagraph();
    }

    private void addTableRow(XWPFTable table, int rowIndex, String label, String value) {
        XWPFTableRow row = table.getRow(rowIndex);
        row.getCell(0).setText(label);
        row.getCell(1).setText(value != null ? value : "-");
    }

    /**
     * 保存报告文件
     */
    private String saveReportFile(byte[] content, String fileName) throws IOException {
        Path dirPath = Paths.get(storagePath);
        if (!Files.exists(dirPath)) {
            Files.createDirectories(dirPath);
        }

        Path filePath = dirPath.resolve(fileName);
        Files.write(filePath, content);

        return filePath.toAbsolutePath().toString();
    }

    /**
     * 生成摘要
     */
    private String generateSummary(HydraulicAnalysisResult result) {
        return String.format("流态: %s, 沿程摩阻: %.2f m, 末站压力: %.2f MPa",
                result.getFlowRegime(),
                result.getFrictionHeadLoss().doubleValue(),
                result.getEndStationInPressure().doubleValue());
    }

    /**
     * 格式化小数
     */
    private String formatDecimal(BigDecimal value) {
        if (value == null) {
            return "-";
        }
        return value.setScale(4, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }
}
