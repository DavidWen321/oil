package com.pipeline.calculation.controller;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.pipeline.calculation.domain.diagnosis.DiagnosisRequest;
import com.pipeline.calculation.domain.diagnosis.DiagnosisResult;
import com.pipeline.calculation.service.IFaultDiagnosisService;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

/**
 * 智能故障诊断控制器
 * <p>
 * 提供管道系统智能故障诊断功能，包括：
 * - 综合故障诊断（压力、流量、泵站、能耗多维分析）
 * - 快速健康检查
 * - 历史诊断记录查询
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "智能故障诊断", description = "基于AI的管道系统故障智能诊断接口")
@RestController
@RequestMapping("/calculation/diagnosis")
@RequiredArgsConstructor
@Validated
public class FaultDiagnosisController {

    private final IFaultDiagnosisService faultDiagnosisService;

    /**
     * 执行综合故障诊断
     * <p>
     * 基于输入的运行数据，综合分析压力、流量、泵站效率、能耗等多维度指标，
     * 识别潜在故障并给出处理建议。
     * </p>
     *
     * @param request 诊断请求，包含管道运行数据
     * @return 诊断结果，包含故障列表、健康评分、处理建议等
     */
    @Operation(summary = "综合故障诊断", description = "对管道系统进行全面的智能故障诊断分析")
    @PostMapping("/analyze")
    public Result<DiagnosisResult> analyze(@Valid @RequestBody DiagnosisRequest request) {
        DiagnosisResult result = faultDiagnosisService.diagnose(request);
        return Result.ok(result);
    }

    /**
     * 快速健康检查
     * <p>
     * 仅返回系统健康评分，不进行详细的故障分析。
     * 适用于需要快速了解系统状态的场景。
     * </p>
     *
     * @param request 诊断请求
     * @return 健康评分（0-100）
     */
    @Operation(summary = "快速健康检查", description = "快速获取系统健康评分，不进行详细故障分析")
    @PostMapping("/quick-check")
    public Result<Integer> quickCheck(@Valid @RequestBody DiagnosisRequest request) {
        Integer healthScore = faultDiagnosisService.quickHealthCheck(request);
        return Result.ok(healthScore);
    }

    /**
     * 获取最近诊断结果
     * <p>
     * 查询指定管道的最近一次诊断结果。
     * </p>
     *
     * @param pipelineId 管道ID
     * @return 最近的诊断结果，如果没有则返回null
     */
    @Operation(summary = "获取最近诊断结果", description = "获取指定管道的最近一次诊断结果")
    @GetMapping("/latest/{pipelineId}")
    public Result<DiagnosisResult> getLatestDiagnosis(
            @Parameter(description = "管道ID") @PathVariable Long pipelineId) {
        DiagnosisResult result = faultDiagnosisService.getLatestDiagnosis(pipelineId);
        if (result == null) {
            return Result.fail("未找到该管道的诊断记录");
        }
        return Result.ok(result);
    }
}
