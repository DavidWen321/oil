package com.pipeline.calculation.domain.diagnosis;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

/**
 * 故障诊断请求参数
 * <p>
 * 包含管道运行的实时数据，用于智能诊断分析。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
public class DiagnosisRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 管道ID
     */
    @NotNull(message = "管道ID不能为空")
    private Long pipelineId;

    /**
     * 项目ID
     */
    private Long projectId;

    /**
     * 首站压力 (MPa)
     */
    @NotNull(message = "首站压力不能为空")
    private BigDecimal inletPressure;

    /**
     * 末站压力 (MPa)
     */
    @NotNull(message = "末站压力不能为空")
    private BigDecimal outletPressure;

    /**
     * 设计压力上限 (MPa)
     */
    private BigDecimal maxDesignPressure;

    /**
     * 设计压力下限 (MPa)
     */
    private BigDecimal minDesignPressure;

    /**
     * 首站流量 (m³/h)
     */
    @NotNull(message = "首站流量不能为空")
    @Positive(message = "首站流量必须为正数")
    private BigDecimal inletFlowRate;

    /**
     * 末站流量 (m³/h)
     */
    @NotNull(message = "末站流量不能为空")
    @Positive(message = "末站流量必须为正数")
    private BigDecimal outletFlowRate;

    /**
     * 设计流量 (m³/h)
     */
    private BigDecimal designFlowRate;

    /**
     * 油品温度 (°C)
     */
    private BigDecimal temperature;

    /**
     * 设计温度范围下限 (°C)
     */
    private BigDecimal minTemperature;

    /**
     * 设计温度范围上限 (°C)
     */
    private BigDecimal maxTemperature;

    /**
     * 实际摩阻损失 (MPa)
     */
    private BigDecimal actualFrictionLoss;

    /**
     * 理论摩阻损失 (MPa)
     */
    private BigDecimal theoreticalFrictionLoss;

    /**
     * 泵站运行数据列表
     */
    @Valid
    private List<PumpOperationData> pumpDataList;

    /**
     * 实际单位能耗 (kWh/t·km)
     */
    private BigDecimal actualUnitEnergy;

    /**
     * 标准单位能耗 (kWh/t·km)
     */
    private BigDecimal standardUnitEnergy;

    /**
     * 历史压力数据（用于波动分析）
     */
    private List<BigDecimal> pressureHistory;

    /**
     * 泵站运行数据
     */
    @Data
    public static class PumpOperationData implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 泵站ID
         */
        private Long pumpStationId;

        /**
         * 泵站名称
         */
        private String pumpName;

        /**
         * 运行泵数量
         */
        private Integer runningPumpCount;

        /**
         * 实际效率 (%)
         */
        private BigDecimal actualEfficiency;

        /**
         * 额定效率 (%)
         */
        private BigDecimal ratedEfficiency;

        /**
         * 振动值 (mm/s)
         */
        private BigDecimal vibrationValue;

        /**
         * 振动阈值 (mm/s)
         */
        private BigDecimal vibrationThreshold;

        /**
         * 电机电流 (A)
         */
        private BigDecimal motorCurrent;

        /**
         * 额定电流 (A)
         */
        private BigDecimal ratedCurrent;
    }
}
