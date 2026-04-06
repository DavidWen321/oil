package com.pipeline.calculation.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pipeline.calculation.domain.dto.CalculationHistoryQuery;
import com.pipeline.calculation.domain.dto.ReportHistoryCreateRequest;
import com.pipeline.calculation.domain.entity.CalculationHistory;
import com.pipeline.calculation.domain.vo.CalculationHistoryVO;
import com.pipeline.calculation.service.ICalculationHistoryService;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;
import com.pipeline.common.core.enums.CalcTypeEnum;
import com.pipeline.common.core.exception.BusinessException;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;

/**
 * 计算历史控制器
 * <p>
 * 提供计算历史记录的查询、删除等RESTful API接口。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "计算历史", description = "计算历史记录的查询和管理接口")
@Validated
@RestController
@RequestMapping("/calculation/history")
@RequiredArgsConstructor
public class CalculationHistoryController {

    private final ICalculationHistoryService calculationHistoryService;
    private final ObjectMapper objectMapper;

    /**
     * 分页查询计算历史
     *
     * @param query 查询参数
     * @return 分页结果
     */
    @Operation(summary = "分页查询计算历史", description = "支持按计算类型、项目、用户、状态、时间等条件筛选")
    @GetMapping("/page")
    public Result<PageResult<CalculationHistoryVO>> queryPage(CalculationHistoryQuery query) {
        PageResult<CalculationHistoryVO> result = calculationHistoryService.queryPage(query);
        return Result.ok(result);
    }

    /**
     * 查询计算历史详情
     *
     * @param id 记录ID
     * @return 历史详情
     */
    @Operation(summary = "查询计算历史详情", description = "根据记录ID获取详细的计算历史信息")
    @GetMapping("/{id}")
    public Result<CalculationHistoryVO> getDetail(
            @PathVariable("id") @NotNull(message = "记录ID不能为空") Long id) {
        CalculationHistoryVO detail = calculationHistoryService.getDetail(id);
        return Result.ok(detail);
    }

    /**
     * 获取当前用户最近的计算记录
     *
     * @param userId 用户ID（可选，不传则使用当前登录用户）
     * @param limit  数量限制（默认10条）
     * @return 计算历史列表
     */
    @Operation(summary = "获取最近计算记录", description = "获取当前用户最近的计算历史记录")
    @GetMapping("/recent")
    public Result<List<CalculationHistoryVO>> getRecentHistory(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "limit", required = false, defaultValue = "10") Integer limit) {
        // TODO: 如果userId为空，从安全上下文获取当前用户ID
        if (userId == null) {
            userId = 1L; // 临时默认值，待集成Sa-Token后修改
        }
        List<CalculationHistoryVO> histories = calculationHistoryService.getRecentByUser(userId, limit);
        return Result.ok(histories);
    }

    /**
     * 查询指定项目的计算历史
     *
     * @param projectId 项目ID
     * @param query     分页参数
     * @return 分页结果
     */
    @Operation(summary = "查询项目计算历史", description = "分页查询指定项目的计算历史")
    @GetMapping("/project/{projectId}")
    public Result<PageResult<CalculationHistoryVO>> getByProject(
            @PathVariable("projectId") @NotNull(message = "项目ID不能为空") Long projectId,
            CalculationHistoryQuery query) {
        PageResult<CalculationHistoryVO> result = calculationHistoryService.getByProject(projectId, query);
        return Result.ok(result);
    }

    /**
     * 删除计算历史记录
     *
     * @param id 记录ID
     * @return 操作结果
     */
    @Operation(summary = "删除计算历史", description = "根据ID删除单条计算历史记录")
    @DeleteMapping("/{id}")
    public Result<Void> deleteHistory(
            @PathVariable("id") @NotNull(message = "记录ID不能为空") Long id) {
        boolean success = calculationHistoryService.deleteHistory(id);
        if (success) {
            return Result.ok();
        }
        return Result.fail("删除失败");
    }

    /**
     * 批量删除计算历史记录
     *
     * @param ids 记录ID列表
     * @return 删除数量
     */
    @Operation(summary = "批量删除计算历史", description = "根据ID列表批量删除计算历史记录")
    @PostMapping("/batch-delete")
    public Result<Integer> batchDelete(
            @RequestBody @NotEmpty(message = "ID列表不能为空") List<Long> ids) {
        int count = calculationHistoryService.batchDelete(ids);
        return Result.ok(count);
    }

    /**
     * 统计项目的计算次数
     *
     * @param projectId 项目ID
     * @return 计算次数
     */
    @Operation(summary = "统计项目计算次数", description = "统计指定项目的计算总次数")
    @GetMapping("/count/project/{projectId}")
    public Result<Long> countByProject(
            @PathVariable("projectId") @NotNull(message = "项目ID不能为空") Long projectId) {
        long count = calculationHistoryService.countByProject(projectId);
        return Result.ok(count);
    }

    /**
     * 统计用户的计算次数
     *
     * @param userId 用户ID
     * @return 计算次数
     */
    @Operation(summary = "统计用户计算次数", description = "统计指定用户的计算总次数")
    @GetMapping("/count/user/{userId}")
    public Result<Long> countByUser(
            @PathVariable("userId") @NotNull(message = "用户ID不能为空") Long userId) {
        long count = calculationHistoryService.countByUser(userId);
        return Result.ok(count);
    }

    /**
     * 归档智能报告到计算历史表
     *
     * @param request  报告归档请求
     * @param userId   用户ID
     * @param userName 用户名
     * @return 归档后的历史记录
     */
    @Operation(summary = "归档智能报告", description = "将智能报告元数据和结构化结果保存到数据库计算历史表")
    @PostMapping("/report")
    public Result<CalculationHistoryVO> saveReport(
            @RequestBody @Validated ReportHistoryCreateRequest request,
            @RequestParam(value = "userId", required = false, defaultValue = "1") Long userId,
            @RequestParam(value = "userName", required = false, defaultValue = "admin") String userName) {
        try {
            Long primaryProjectId = getPrimaryProjectId(request.getSelectedProjectIds());
            String inputJson = objectMapper.writeValueAsString(buildReportInputPayload(request));
            String outputJson = objectMapper.writeValueAsString(request.getResult());

            Long historyId = calculationHistoryService.createHistory(
                    CalcTypeEnum.AI_REPORT.getCode(),
                    primaryProjectId,
                    request.getTitle(),
                    userId,
                    userName,
                    inputJson);

            if (historyId == null) {
                throw new BusinessException("智能报告归档失败");
            }

            CalculationHistory history = new CalculationHistory();
            history.setId(historyId);
            history.setOutputResult(outputJson);
            history.setRemark(buildReportRemark(request));
            calculationHistoryService.updateById(history);

            return Result.ok(calculationHistoryService.getDetail(historyId));
        } catch (JsonProcessingException e) {
            throw new BusinessException("智能报告序列化失败: " + e.getOriginalMessage());
        }
    }

    private Long getPrimaryProjectId(List<Long> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return null;
        }
        return projectIds.get(0);
    }

    private Map<String, Object> buildReportInputPayload(ReportHistoryCreateRequest request) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", request.getTitle());
        payload.put("reportType", request.getReportType());
        payload.put("reportTypeLabel", request.getReportTypeLabel());
        payload.put("selectedProjectIds", request.getSelectedProjectIds() == null ? List.of() : request.getSelectedProjectIds());
        payload.put("projectNames", request.getProjectNames() == null ? List.of() : request.getProjectNames());
        payload.put("rangeLabel", request.getRangeLabel());
        payload.put("intelligenceLabel", request.getIntelligenceLabel());
        payload.put("outputStyle", request.getOutputStyle());
        payload.put("outputStyleLabel", request.getOutputStyleLabel());
        payload.put("outputFormat", request.getOutputFormat());
        payload.put("sourceLabel", request.getSourceLabel());
        return payload;
    }

    private String buildReportRemark(ReportHistoryCreateRequest request) {
        if (request.getResult() == null) {
            return "智能报告已归档";
        }

        String outputStyle = request.getOutputStyle();
        Object conclusion = request.getResult().get("conclusion");
        if (!"simple".equals(outputStyle) && !"professional".equals(outputStyle)
                && conclusion instanceof String conclusionText && !conclusionText.isBlank()) {
            return limitRemark(conclusionText);
        }

        Object summary = request.getResult().get("summary");
        if (summary instanceof List<?> summaryList) {
            List<String> lines = new ArrayList<>();
            for (Object item : summaryList) {
                if (item instanceof String text && !text.isBlank()) {
                    lines.add(text.trim());
                }
                if (lines.size() >= 2) {
                    break;
                }
            }
            if (!lines.isEmpty()) {
                return limitRemark(String.join("；", lines));
            }
        }

        return "智能报告已归档";
    }

    private String limitRemark(String value) {
        if (value.length() <= 500) {
            return value;
        }
        return value.substring(0, 497) + "...";
    }
}
