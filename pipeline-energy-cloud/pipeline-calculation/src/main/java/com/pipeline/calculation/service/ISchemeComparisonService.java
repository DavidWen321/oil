package com.pipeline.calculation.service;

import com.pipeline.calculation.domain.comparison.ComparisonRequest;
import com.pipeline.calculation.domain.comparison.ComparisonResult;

/**
 * 多方案对比分析服务接口
 * <p>
 * 提供多个运行方案的综合对比分析功能。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
public interface ISchemeComparisonService {

    /**
     * 执行多方案对比分析
     *
     * @param request 对比请求，包含2-5个方案数据
     * @return 对比结果，包含各维度分析、可视化数据和推荐方案
     */
    ComparisonResult compare(ComparisonRequest request);

    /**
     * 获取对比维度列表
     *
     * @return 支持的对比维度
     */
    String[] getComparisonDimensions();
}
