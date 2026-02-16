package com.pipeline.calculation.controller;

import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.pipeline.calculation.domain.carbon.CarbonCalculationRequest;
import com.pipeline.calculation.domain.carbon.CarbonCalculationResult;
import com.pipeline.calculation.service.ICarbonCalculationService;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 碳排放核算控制器
 * <p>
 * 提供管道输送系统碳排放核算功能，响应国家"双碳"战略，
 * 支持碳足迹计算、减排分析、碳配额管理等功能。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "碳排放核算", description = "管道系统碳排放核算与分析接口")
@RestController
@RequestMapping("/calculation/carbon")
@RequiredArgsConstructor
@Validated
public class CarbonCalculationController {

    private final ICarbonCalculationService carbonCalculationService;

    /**
     * 执行碳排放核算
     * <p>
     * 基于电力消耗、燃料消耗、油品挥发等数据，
     * 计算范围一、二、三的温室气体排放量。
     * </p>
     *
     * @param request 核算请求
     * @return 核算结果，包含排放量、排放强度、减排建议等
     */
    @Operation(summary = "碳排放核算", description = "计算管道系统温室气体排放量")
    @PostMapping("/calculate")
    public Result<CarbonCalculationResult> calculate(@Valid @RequestBody CarbonCalculationRequest request) {
        CarbonCalculationResult result = carbonCalculationService.calculate(request);
        return Result.ok(result);
    }

    /**
     * 获取电网排放因子
     * <p>
     * 返回各地区电网的碳排放因子，用于前端选择。
     * </p>
     *
     * @return 地区-排放因子映射
     */
    @Operation(summary = "获取电网排放因子", description = "获取各地区电网碳排放因子")
    @GetMapping("/emission-factors")
    public Result<Map<String, Double>> getEmissionFactors() {
        return Result.ok(carbonCalculationService.getGridEmissionFactors());
    }

    /**
     * 获取行业平均排放强度
     *
     * @return 行业平均排放强度 (kgCO2e/吨·公里)
     */
    @Operation(summary = "获取行业平均排放强度", description = "获取管道输送行业平均碳排放强度")
    @GetMapping("/industry-average")
    public Result<Double> getIndustryAverage() {
        return Result.ok(carbonCalculationService.getIndustryAverageIntensity());
    }
}
