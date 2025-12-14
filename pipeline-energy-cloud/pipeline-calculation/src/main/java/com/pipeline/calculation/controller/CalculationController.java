package com.pipeline.calculation.controller;

import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.HydraulicAnalysisResult;
import com.pipeline.calculation.domain.OptimizationParams;
import com.pipeline.calculation.domain.OptimizationResult;
import com.pipeline.calculation.service.ICalculationService;
import com.pipeline.common.core.domain.Result;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 计算引擎控制器
 */
@RestController
@RequestMapping("/calculation")
public class CalculationController {

    @Autowired
    private ICalculationService calculationService;

    /**
     * 水力特性分析接口
     */
    @PostMapping("/hydraulic-analysis")
    public Result<HydraulicAnalysisResult> hydraulicAnalysis(@RequestBody HydraulicAnalysisParams params) {
        return calculationService.analyzeHydraulic(params);
    }

    /**
     * 运行方案优化接口
     */
    @PostMapping("/optimization")
    public Result<OptimizationResult> optimization(@RequestBody OptimizationParams params) {
        return calculationService.optimizeOperation(params);
    }
}
