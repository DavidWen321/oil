package com.pipeline.calculation.controller;

import java.util.List;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.HydraulicAnalysisResult;
import com.pipeline.calculation.domain.entity.AnalysisReport;
import com.pipeline.calculation.service.ICalculationService;
import com.pipeline.calculation.service.IReportService;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 报告控制器
 * <p>
 * 提供分析报告的生成、查询、下载等RESTful API接口。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Tag(name = "报告管理", description = "分析报告生成、下载和管理接口")
@Validated
@RestController
@RequestMapping("/calculation/report")
@RequiredArgsConstructor
public class ReportController {

    private final IReportService reportService;
    private final ICalculationService calculationService;

    /**
     * 生成水力分析报告
     * <p>
     * 先执行水力分析计算，然后生成报告
     * </p>
     *
     * @param params 水力分析参数
     * @return 报告ID
     */
    @PostMapping("/generate/hydraulic")
    public Result<Long> generateHydraulicReport(
            @RequestBody @Valid HydraulicAnalysisParams params,
            @RequestParam(value = "userId", required = false, defaultValue = "1") Long userId,
            @RequestParam(value = "userName", required = false, defaultValue = "admin") String userName) {

        // 先执行计算
        Result<HydraulicAnalysisResult> calcResult = calculationService.analyzeHydraulic(params);
        if (!calcResult.isSuccess()) {
            return Result.fail("计算失败: " + calcResult.getMsg());
        }

        // 生成报告
        return reportService.generateHydraulicReport(
                params, calcResult.getData(), userId, userName);
    }

    /**
     * 根据计算历史生成报告
     *
     * @param historyId 计算历史ID
     * @return 报告ID
     */
    @PostMapping("/generate/from-history/{historyId}")
    public Result<Long> generateFromHistory(
            @PathVariable("historyId") @NotNull(message = "历史ID不能为空") Long historyId,
            @RequestParam(value = "userId", required = false, defaultValue = "1") Long userId,
            @RequestParam(value = "userName", required = false, defaultValue = "admin") String userName) {

        return reportService.generateReportFromHistory(historyId, userId, userName);
    }

    /**
     * 获取报告详情
     *
     * @param id 报告ID
     * @return 报告信息
     */
    @GetMapping("/{id}")
    public Result<AnalysisReport> getDetail(
            @PathVariable("id") @NotNull(message = "报告ID不能为空") Long id) {
        AnalysisReport report = reportService.getReportDetail(id);
        return Result.ok(report);
    }

    /**
     * 下载报告
     *
     * @param id 报告ID
     * @return 报告文件
     */
    @GetMapping("/download/{id}")
    public ResponseEntity<byte[]> downloadReport(
            @PathVariable("id") @NotNull(message = "报告ID不能为空") Long id) {

        Result<byte[]> result = reportService.getReportContent(id);
        if (!result.isSuccess()) {
            return ResponseEntity.badRequest().build();
        }

        AnalysisReport report = reportService.getReportDetail(id);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDisposition(
                ContentDisposition.attachment()
                        .filename(report.getFileName())
                        .build());

        return ResponseEntity.ok()
                .headers(headers)
                .body(result.getData());
    }

    /**
     * 获取报告下载链接
     *
     * @param id 报告ID
     * @return 下载链接
     */
    @GetMapping("/download-url/{id}")
    public Result<String> getDownloadUrl(
            @PathVariable("id") @NotNull(message = "报告ID不能为空") Long id) {
        return reportService.getDownloadUrl(id);
    }

    /**
     * 分页查询报告列表
     *
     * @param reportType 报告类型（可选）
     * @param projectId  项目ID（可选）
     * @param userId     用户ID（可选）
     * @param pageNum    页码
     * @param pageSize   每页大小
     * @return 分页结果
     */
    @GetMapping("/page")
    public Result<PageResult<AnalysisReport>> queryPage(
            @RequestParam(value = "reportType", required = false) String reportType,
            @RequestParam(value = "projectId", required = false) Long projectId,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "pageNum", defaultValue = "1") Integer pageNum,
            @RequestParam(value = "pageSize", defaultValue = "10") Integer pageSize) {

        PageResult<AnalysisReport> result = reportService.queryReportPage(
                reportType, projectId, userId, pageNum, pageSize);
        return Result.ok(result);
    }

    /**
     * 获取用户最近的报告
     *
     * @param userId 用户ID
     * @param limit  数量限制
     * @return 报告列表
     */
    @GetMapping("/recent")
    public Result<List<AnalysisReport>> getRecentReports(
            @RequestParam(value = "userId", required = false, defaultValue = "1") Long userId,
            @RequestParam(value = "limit", defaultValue = "10") Integer limit) {

        List<AnalysisReport> reports = reportService.getRecentReports(userId, limit);
        return Result.ok(reports);
    }

    /**
     * 删除报告
     *
     * @param id 报告ID
     * @return 操作结果
     */
    @DeleteMapping("/{id}")
    public Result<Void> deleteReport(
            @PathVariable("id") @NotNull(message = "报告ID不能为空") Long id) {

        boolean success = reportService.deleteReport(id);
        if (success) {
            return Result.ok();
        }
        return Result.fail("删除失败");
    }

    /**
     * 获取支持的报告类型
     *
     * @return 报告类型列表
     */
    @GetMapping("/types")
    public Result<List<ReportTypeInfo>> getReportTypes() {
        List<ReportTypeInfo> types = List.of(
                new ReportTypeInfo("HYDRAULIC", "水力分析报告"),
                new ReportTypeInfo("OPTIMIZATION", "优化方案报告"),
                new ReportTypeInfo("COMPARISON", "对比分析报告"),
                new ReportTypeInfo("SENSITIVITY", "敏感性分析报告")
        );
        return Result.ok(types);
    }

    /**
     * 报告类型信息
     */
    public record ReportTypeInfo(String code, String name) {}
}
