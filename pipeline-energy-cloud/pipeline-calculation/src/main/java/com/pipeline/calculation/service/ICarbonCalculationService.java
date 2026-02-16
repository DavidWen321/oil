package com.pipeline.calculation.service;

import java.util.Map;

import com.pipeline.calculation.domain.carbon.CarbonCalculationRequest;
import com.pipeline.calculation.domain.carbon.CarbonCalculationResult;

/**
 * 碳排放核算服务接口
 * <p>
 * 提供管道输送系统碳排放核算功能，符合国家温室气体核算标准。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
public interface ICarbonCalculationService {

    /**
     * 执行碳排放核算
     *
     * @param request 核算请求
     * @return 核算结果
     */
    CarbonCalculationResult calculate(CarbonCalculationRequest request);

    /**
     * 获取各地区电网排放因子
     *
     * @return 地区-排放因子映射
     */
    Map<String, Double> getGridEmissionFactors();

    /**
     * 获取行业平均排放强度
     *
     * @return 排放强度 (kgCO2e/吨·公里)
     */
    Double getIndustryAverageIntensity();
}
