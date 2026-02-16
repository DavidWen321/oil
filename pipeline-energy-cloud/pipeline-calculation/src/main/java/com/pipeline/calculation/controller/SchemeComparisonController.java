package com.pipeline.calculation.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.pipeline.calculation.domain.comparison.ComparisonRequest;
import com.pipeline.calculation.domain.comparison.ComparisonResult;
import com.pipeline.calculation.service.ISchemeComparisonService;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 多方案对比分析控制器
 * <p>
 * 支持2-5个运行方案的综合对比分析，提供：
 * - 能耗、成本、效率、安全性、碳排放多维度对比
 * - 雷达图、柱状图可视化数据
 * - 综合排名和推荐方案
 * - 节能潜力分析
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "多方案对比分析", description = "多个运行方案的综合对比分析接口")
@RestController
@RequestMapping("/calculation/comparison")
@RequiredArgsConstructor
@Validated
public class SchemeComparisonController {

    private final ISchemeComparisonService schemeComparisonService;

    /**
     * 执行多方案对比分析
     * <p>
     * 对2-5个运行方案进行综合对比分析，输出各维度的对比结果、
     * 可视化图表数据、综合排名和推荐方案。
     * </p>
     *
     * @param request 对比请求，包含多个方案的运行参数
     * @return 对比结果
     */
    @Operation(summary = "多方案对比分析", description = "对多个运行方案进行综合对比分析")
    @PostMapping("/analyze")
    public Result<ComparisonResult> compare(@Valid @RequestBody ComparisonRequest request) {
        ComparisonResult result = schemeComparisonService.compare(request);
        return Result.ok(result);
    }

    /**
     * 获取支持的对比维度
     *
     * @return 对比维度列表
     */
    @Operation(summary = "获取对比维度", description = "获取系统支持的对比分析维度列表")
    @GetMapping("/dimensions")
    public Result<String[]> getDimensions() {
        return Result.ok(schemeComparisonService.getComparisonDimensions());
    }
}
