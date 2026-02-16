package com.pipeline.calculation.controller;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.SensitivityAnalysisParams;
import com.pipeline.calculation.domain.SensitivityAnalysisResult;
import com.pipeline.calculation.service.ISensitivityAnalysisService;
import com.pipeline.common.core.domain.Result;
import com.pipeline.common.core.enums.SensitivityVariableEnum;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;

/**
 * 敏感性分析控制器
 * <p>
 * 提供敏感性分析的RESTful API接口，支持单因素分析和多因素交叉分析。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "敏感性分析", description = "管道参数敏感性分析接口")
@Validated
@RestController
@RequestMapping("/calculation/sensitivity")
@RequiredArgsConstructor
public class SensitivityAnalysisController {

    private final ISensitivityAnalysisService sensitivityAnalysisService;

    /**
     * 执行敏感性分析
     * <p>
     * 支持单因素分析和多因素交叉分析
     * </p>
     *
     * @param params 分析参数
     * @return 分析结果
     */
    @PostMapping("/analyze")
    public Result<SensitivityAnalysisResult> analyze(
            @RequestBody @Valid SensitivityAnalysisParams params) {
        return sensitivityAnalysisService.analyze(params);
    }

    /**
     * 执行敏感性分析并保存历史
     *
     * @param params 分析参数
     * @return 分析结果
     */
    @PostMapping("/analyze-save")
    public Result<SensitivityAnalysisResult> analyzeAndSave(
            @RequestBody @Valid SensitivityAnalysisParams params,
            @RequestParam(value = "userId", required = false, defaultValue = "1") Long userId,
            @RequestParam(value = "userName", required = false, defaultValue = "admin") String userName) {
        return sensitivityAnalysisService.analyzeAndSave(params, userId, userName);
    }

    /**
     * 快速单因素分析
     * <p>
     * 使用默认参数范围（-20%到+20%，步长5%）进行快速分析
     * </p>
     *
     * @param params       基准水力参数
     * @param variableType 变量类型
     * @return 分析结果
     */
    @PostMapping("/quick-single")
    public Result<SensitivityAnalysisResult> quickSingleAnalysis(
            @RequestBody @Valid HydraulicAnalysisParams params,
            @RequestParam("variableType") @NotBlank(message = "变量类型不能为空") String variableType) {
        return sensitivityAnalysisService.quickSingleAnalysis(params, variableType);
    }

    /**
     * 获取支持的敏感性变量列表
     *
     * @return 变量列表
     */
    @GetMapping("/variables")
    public Result<List<VariableInfo>> getSupportedVariables() {
        List<SensitivityVariableEnum> variables = sensitivityAnalysisService.getSupportedVariables();

        List<VariableInfo> infos = variables.stream()
                .map(v -> new VariableInfo(
                        v.getCode(),
                        v.getName(),
                        v.getUnit(),
                        v.getMinChangePercent(),
                        v.getMaxChangePercent()))
                .collect(Collectors.toList());

        return Result.ok(infos);
    }

    /**
     * 变量信息VO
     */
    public record VariableInfo(
            String code,
            String name,
            String unit,
            Double minChangePercent,
            Double maxChangePercent
    ) {}
}
