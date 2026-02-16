package com.pipeline.calculation.domain.carbon;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 碳排放核算结果
 * <p>
 * 包含详细的碳排放核算结果、排放源分析、减排建议等。
 * 符合国家温室气体排放核算标准。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarbonCalculationResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 核算ID
     */
    private String calculationId;

    /**
     * 核算时间
     */
    private LocalDateTime calculationTime;

    /**
     * 项目ID
     */
    private Long projectId;

    /**
     * 核算周期
     */
    private String period;

    /**
     * 核算开始日期
     */
    private LocalDate startDate;

    /**
     * 核算结束日期
     */
    private LocalDate endDate;

    // ========== 碳排放总量 ==========

    /**
     * 总碳排放量 (tCO2e)
     */
    private BigDecimal totalEmission;

    /**
     * 直接排放（范围一）(tCO2e)
     */
    private BigDecimal scope1Emission;

    /**
     * 间接排放（范围二）(tCO2e)
     */
    private BigDecimal scope2Emission;

    /**
     * 其他间接排放（范围三）(tCO2e)
     */
    private BigDecimal scope3Emission;

    /**
     * 碳汇抵消量 (tCO2e)
     */
    private BigDecimal carbonSink;

    /**
     * 净碳排放量 (tCO2e)
     */
    private BigDecimal netEmission;

    // ========== 排放强度指标 ==========

    /**
     * 单位输量碳排放 (kgCO2e/吨)
     */
    private BigDecimal emissionPerTon;

    /**
     * 单位输量公里碳排放 (kgCO2e/吨·公里)
     */
    private BigDecimal emissionPerTonKm;

    /**
     * 单位能耗碳排放 (kgCO2e/kWh)
     */
    private BigDecimal emissionPerKwh;

    // ========== 分类排放明细 ==========

    /**
     * 分类排放详情
     */
    private List<EmissionDetail> emissionDetails;

    /**
     * 排放源占比（饼图数据）
     */
    private List<EmissionShare> emissionShares;

    // ========== 趋势分析 ==========

    /**
     * 月度排放趋势
     */
    private List<MonthlyEmission> monthlyTrend;

    /**
     * 同比变化率 (%)
     */
    private BigDecimal yearOverYearChange;

    /**
     * 环比变化率 (%)
     */
    private BigDecimal monthOverMonthChange;

    // ========== 对标分析 ==========

    /**
     * 行业平均排放强度
     */
    private BigDecimal industryAvgIntensity;

    /**
     * 与行业平均对比 (%)
     */
    private BigDecimal compareToIndustry;

    /**
     * 排放等级：A-优秀, B-良好, C-一般, D-较差
     */
    private String emissionLevel;

    /**
     * 碳绩效评分 (0-100)
     */
    private Integer carbonScore;

    // ========== 减排分析 ==========

    /**
     * 减排潜力分析
     */
    private ReductionPotential reductionPotential;

    /**
     * 减排建议
     */
    private List<ReductionSuggestion> reductionSuggestions;

    // ========== 碳配额分析 ==========

    /**
     * 碳配额信息（如果适用）
     */
    private CarbonQuota carbonQuota;

    // ========== 核算参数 ==========

    /**
     * 使用的排放因子
     */
    private Map<String, BigDecimal> emissionFactors;

    /**
     * 核算方法说明
     */
    private String methodologyNote;

    /**
     * 数据质量评估
     */
    private String dataQualityAssessment;

    /**
     * 排放明细
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmissionDetail implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 排放源名称
         */
        private String source;

        /**
         * 排放类别（范围一/二/三）
         */
        private String scope;

        /**
         * 活动数据
         */
        private BigDecimal activityData;

        /**
         * 活动数据单位
         */
        private String activityUnit;

        /**
         * 排放因子
         */
        private BigDecimal emissionFactor;

        /**
         * 排放因子单位
         */
        private String factorUnit;

        /**
         * 排放量 (tCO2e)
         */
        private BigDecimal emission;

        /**
         * 占比 (%)
         */
        private BigDecimal sharePercent;

        /**
         * 数据来源
         */
        private String dataSource;
    }

    /**
     * 排放占比
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmissionShare implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String name;
        private BigDecimal value;
        private BigDecimal percent;
    }

    /**
     * 月度排放
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyEmission implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String month;
        private BigDecimal emission;
        private BigDecimal intensity;
    }

    /**
     * 减排潜力
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReductionPotential implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 总减排潜力 (tCO2e)
         */
        private BigDecimal totalPotential;

        /**
         * 节能减排潜力
         */
        private BigDecimal energySavingPotential;

        /**
         * 绿电替代潜力
         */
        private BigDecimal greenPowerPotential;

        /**
         * 工艺优化潜力
         */
        private BigDecimal processOptimizationPotential;

        /**
         * 碳汇增加潜力
         */
        private BigDecimal carbonSinkPotential;

        /**
         * 潜在碳减排成本 (元/tCO2e)
         */
        private BigDecimal reductionCost;
    }

    /**
     * 减排建议
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReductionSuggestion implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 建议编号
         */
        private Integer seq;

        /**
         * 建议类别
         */
        private String category;

        /**
         * 建议内容
         */
        private String suggestion;

        /**
         * 预计减排量 (tCO2e/年)
         */
        private BigDecimal expectedReduction;

        /**
         * 投资成本 (万元)
         */
        private BigDecimal investmentCost;

        /**
         * 回收期 (年)
         */
        private BigDecimal paybackPeriod;

        /**
         * 实施难度：LOW-低, MEDIUM-中, HIGH-高
         */
        private String difficulty;

        /**
         * 优先级：1-5
         */
        private Integer priority;
    }

    /**
     * 碳配额
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CarbonQuota implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 年度配额 (tCO2e)
         */
        private BigDecimal annualQuota;

        /**
         * 已使用配额 (tCO2e)
         */
        private BigDecimal usedQuota;

        /**
         * 剩余配额 (tCO2e)
         */
        private BigDecimal remainingQuota;

        /**
         * 配额使用率 (%)
         */
        private BigDecimal usageRate;

        /**
         * 预计年末缺口/盈余 (tCO2e)
         */
        private BigDecimal projectedGap;

        /**
         * 碳市场参考价格 (元/tCO2e)
         */
        private BigDecimal carbonPrice;

        /**
         * 预计交易金额 (万元)
         */
        private BigDecimal projectedTradingAmount;
    }
}
