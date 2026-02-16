package com.pipeline.calculation.domain.diagnosis;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 故障诊断结果
 * <p>
 * 包含诊断出的故障列表、健康评分、处理建议等。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiagnosisResult implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 诊断ID
     */
    private String diagnosisId;

    /**
     * 管道ID
     */
    private Long pipelineId;

    /**
     * 诊断时间
     */
    private LocalDateTime diagnosisTime;

    /**
     * 健康评分 (0-100)
     */
    private Integer healthScore;

    /**
     * 健康等级：EXCELLENT-优秀, GOOD-良好, WARNING-警告, CRITICAL-危险
     */
    private String healthLevel;

    /**
     * 检测到的故障列表
     */
    private List<FaultInfo> faults;

    /**
     * 综合诊断结论
     */
    private String conclusion;

    /**
     * 优先处理建议
     */
    private List<String> priorityActions;

    /**
     * 预测风险
     */
    private List<RiskPrediction> riskPredictions;

    /**
     * 诊断详情指标
     */
    private DiagnosisMetrics metrics;

    /**
     * 故障信息
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FaultInfo implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 故障类型
         */
        private FaultType faultType;

        /**
         * 故障代码
         */
        private String faultCode;

        /**
         * 故障名称
         */
        private String faultName;

        /**
         * 严重级别
         */
        private String severity;

        /**
         * 置信度 (0-100)
         */
        private Integer confidence;

        /**
         * 故障描述
         */
        private String description;

        /**
         * 检测值
         */
        private String detectedValue;

        /**
         * 正常范围
         */
        private String normalRange;

        /**
         * 偏离程度 (%)
         */
        private BigDecimal deviationPercent;

        /**
         * 可能原因列表
         */
        private List<String> possibleCauses;

        /**
         * 处理建议列表
         */
        private List<String> recommendations;

        /**
         * 关联故障（可能引起此故障的其他故障）
         */
        private List<String> relatedFaults;
    }

    /**
     * 风险预测
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RiskPrediction implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 风险类型
         */
        private String riskType;

        /**
         * 风险描述
         */
        private String riskDescription;

        /**
         * 发生概率 (0-100)
         */
        private Integer probability;

        /**
         * 预计影响程度
         */
        private String impactLevel;

        /**
         * 预防措施
         */
        private List<String> preventiveMeasures;
    }

    /**
     * 诊断指标详情
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DiagnosisMetrics implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 压力健康分
         */
        private Integer pressureScore;

        /**
         * 流量健康分
         */
        private Integer flowScore;

        /**
         * 泵站健康分
         */
        private Integer pumpScore;

        /**
         * 能效健康分
         */
        private Integer energyScore;

        /**
         * 压力状态描述
         */
        private String pressureStatus;

        /**
         * 流量状态描述
         */
        private String flowStatus;

        /**
         * 泵站状态描述
         */
        private String pumpStatus;

        /**
         * 能效状态描述
         */
        private String energyStatus;

        /**
         * 流量差异率 (%)
         */
        private BigDecimal flowDifferenceRate;

        /**
         * 摩阻偏差率 (%)
         */
        private BigDecimal frictionDeviationRate;

        /**
         * 能耗偏差率 (%)
         */
        private BigDecimal energyDeviationRate;
    }
}
