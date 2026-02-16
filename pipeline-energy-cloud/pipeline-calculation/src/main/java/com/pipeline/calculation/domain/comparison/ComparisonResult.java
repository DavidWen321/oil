package com.pipeline.calculation.domain.comparison;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 多方案对比结果
 * <p>
 * 包含各方案的详细指标对比、雷达图数据、综合排名及推荐方案。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComparisonResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 对比ID
     */
    private String comparisonId;

    /**
     * 对比时间
     */
    private LocalDateTime comparisonTime;

    /**
     * 项目ID
     */
    private Long projectId;

    /**
     * 管道ID
     */
    private Long pipelineId;

    /**
     * 方案数量
     */
    private Integer schemeCount;

    /**
     * 各方案详细分析结果
     */
    private List<SchemeAnalysis> schemeAnalyses;

    /**
     * 指标对比表（横向对比）
     * key: 指标名称, value: 各方案对应值列表
     */
    private Map<String, List<MetricValue>> metricsComparison;

    /**
     * 雷达图数据（用于前端可视化）
     */
    private RadarChartData radarChart;

    /**
     * 柱状图对比数据
     */
    private List<BarChartData> barCharts;

    /**
     * 综合排名
     */
    private List<RankingItem> overallRanking;

    /**
     * 推荐方案
     */
    private RecommendedScheme recommendation;

    /**
     * 对比结论
     */
    private String conclusion;

    /**
     * 节能潜力分析
     */
    private EnergySavingPotential savingPotential;

    /**
     * 单个方案分析结果
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SchemeAnalysis implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 方案名称
         */
        private String schemeName;

        /**
         * 方案描述
         */
        private String description;

        // ========== 能耗指标 ==========

        /**
         * 总功率 (kW)
         */
        private BigDecimal totalPower;

        /**
         * 日耗电量 (kWh)
         */
        private BigDecimal dailyEnergyConsumption;

        /**
         * 月耗电量 (kWh)
         */
        private BigDecimal monthlyEnergyConsumption;

        /**
         * 年耗电量 (kWh)
         */
        private BigDecimal yearlyEnergyConsumption;

        /**
         * 单位输量能耗 (kWh/t·km)
         */
        private BigDecimal unitEnergyConsumption;

        // ========== 成本指标 ==========

        /**
         * 日运行成本 (元)
         */
        private BigDecimal dailyCost;

        /**
         * 月运行成本 (元)
         */
        private BigDecimal monthlyCost;

        /**
         * 年运行成本 (元)
         */
        private BigDecimal yearlyCost;

        /**
         * 单位输送成本 (元/吨)
         */
        private BigDecimal unitTransportCost;

        // ========== 效率指标 ==========

        /**
         * 系统综合效率 (%)
         */
        private BigDecimal systemEfficiency;

        /**
         * 泵站平均效率 (%)
         */
        private BigDecimal avgPumpEfficiency;

        /**
         * 管道输送效率 (%)
         */
        private BigDecimal pipelineEfficiency;

        // ========== 水力指标 ==========

        /**
         * 沿程摩阻损失 (MPa)
         */
        private BigDecimal frictionLoss;

        /**
         * 水力坡降 (m/km)
         */
        private BigDecimal hydraulicGradient;

        /**
         * 雷诺数
         */
        private BigDecimal reynoldsNumber;

        /**
         * 流态
         */
        private String flowRegime;

        // ========== 安全指标 ==========

        /**
         * 末站剩余压力 (MPa)
         */
        private BigDecimal residualPressure;

        /**
         * 安全裕度 (%)
         */
        private BigDecimal safetyMargin;

        /**
         * 压力风险评级
         */
        private String pressureRiskLevel;

        // ========== 碳排放指标 ==========

        /**
         * 年碳排放量 (tCO2)
         */
        private BigDecimal yearlyCarbonEmission;

        /**
         * 单位输量碳排放 (kgCO2/t·km)
         */
        private BigDecimal unitCarbonEmission;

        /**
         * 碳排放等级
         */
        private String carbonLevel;

        // ========== 综合评分 ==========

        /**
         * 能耗评分 (0-100)
         */
        private Integer energyScore;

        /**
         * 成本评分 (0-100)
         */
        private Integer costScore;

        /**
         * 效率评分 (0-100)
         */
        private Integer efficiencyScore;

        /**
         * 安全评分 (0-100)
         */
        private Integer safetyScore;

        /**
         * 环保评分 (0-100)
         */
        private Integer environmentScore;

        /**
         * 综合评分 (加权平均)
         */
        private Integer overallScore;

        /**
         * 方案优势
         */
        private List<String> advantages;

        /**
         * 方案劣势
         */
        private List<String> disadvantages;
    }

    /**
     * 指标值
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MetricValue implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 方案名称
         */
        private String schemeName;

        /**
         * 数值
         */
        private BigDecimal value;

        /**
         * 单位
         */
        private String unit;

        /**
         * 是否最优
         */
        private Boolean isBest;

        /**
         * 相对最优方案的差异百分比
         */
        private BigDecimal diffPercent;
    }

    /**
     * 雷达图数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RadarChartData implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 维度列表
         */
        private List<String> dimensions;

        /**
         * 各方案数据系列
         */
        private List<RadarSeries> series;
    }

    /**
     * 雷达图数据系列
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RadarSeries implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 方案名称
         */
        private String name;

        /**
         * 各维度得分
         */
        private List<Integer> values;
    }

    /**
     * 柱状图数据
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BarChartData implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 指标名称
         */
        private String metricName;

        /**
         * 指标单位
         */
        private String unit;

        /**
         * 各方案数据
         */
        private List<BarItem> items;
    }

    /**
     * 柱状图数据项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BarItem implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        private String schemeName;
        private BigDecimal value;
        private Boolean isBest;
    }

    /**
     * 排名项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RankingItem implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 排名
         */
        private Integer rank;

        /**
         * 方案名称
         */
        private String schemeName;

        /**
         * 综合得分
         */
        private Integer score;

        /**
         * 各维度得分
         */
        private Map<String, Integer> dimensionScores;

        /**
         * 简要评价
         */
        private String comment;
    }

    /**
     * 推荐方案
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedScheme implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 推荐方案名称
         */
        private String schemeName;

        /**
         * 推荐理由
         */
        private List<String> reasons;

        /**
         * 推荐指数 (1-5星)
         */
        private Integer recommendationLevel;

        /**
         * 实施建议
         */
        private List<String> implementationSuggestions;

        /**
         * 预期收益
         */
        private ExpectedBenefit expectedBenefit;
    }

    /**
     * 预期收益
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExpectedBenefit implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 年节电量 (kWh)
         */
        private BigDecimal yearlySavingEnergy;

        /**
         * 年节约成本 (元)
         */
        private BigDecimal yearlySavingCost;

        /**
         * 年减排量 (tCO2)
         */
        private BigDecimal yearlyCarbonReduction;
    }

    /**
     * 节能潜力分析
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EnergySavingPotential implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 当前方案与最优方案的能耗差距
         */
        private BigDecimal energyGap;

        /**
         * 节能比例 (%)
         */
        private BigDecimal savingRatio;

        /**
         * 年节能潜力 (kWh)
         */
        private BigDecimal yearlyPotential;

        /**
         * 年经济潜力 (元)
         */
        private BigDecimal yearlyEconomicPotential;

        /**
         * 节能措施建议
         */
        private List<String> savingMeasures;
    }
}
