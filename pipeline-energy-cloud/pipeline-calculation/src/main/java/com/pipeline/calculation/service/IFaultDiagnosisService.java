package com.pipeline.calculation.service;

import com.pipeline.calculation.domain.diagnosis.DiagnosisRequest;
import com.pipeline.calculation.domain.diagnosis.DiagnosisResult;

/**
 * 智能故障诊断服务接口
 * <p>
 * 基于管道运行数据进行智能分析，识别潜在故障和风险。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
public interface IFaultDiagnosisService {

    /**
     * 执行故障诊断
     * <p>
     * 综合分析压力、流量、泵站效率、能耗等多维度数据，
     * 识别故障类型并给出处理建议。
     * </p>
     *
     * @param request 诊断请求数据
     * @return 诊断结果
     */
    DiagnosisResult diagnose(DiagnosisRequest request);

    /**
     * 快速健康检查
     * <p>
     * 仅计算健康评分，不进行详细故障分析。
     * </p>
     *
     * @param request 诊断请求数据
     * @return 健康评分 (0-100)
     */
    Integer quickHealthCheck(DiagnosisRequest request);

    /**
     * 根据管道ID获取最近一次诊断结果
     *
     * @param pipelineId 管道ID
     * @return 诊断结果，如果没有则返回null
     */
    DiagnosisResult getLatestDiagnosis(Long pipelineId);
}
