package com.pipeline.calculation.domain.carbon;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 碳排放核算请求
 * <p>
 * 支持单次核算和周期性核算，涵盖电力消耗、
 * 燃气消耗、油品挥发等多类排放源。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
public class CarbonCalculationRequest implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 项目ID
     */
    @NotNull(message = "项目ID不能为空")
    private Long projectId;

    /**
     * 管道ID
     */
    private Long pipelineId;

    /**
     * 核算开始日期
     */
    @NotNull(message = "开始日期不能为空")
    private LocalDate startDate;

    /**
     * 核算结束日期
     */
    @NotNull(message = "结束日期不能为空")
    private LocalDate endDate;

    /**
     * 核算周期类型：DAY-日, MONTH-月, YEAR-年
     */
    private String periodType;

    // ========== 电力消耗数据 ==========

    /**
     * 电力消耗量 (kWh)
     */
    @NotNull(message = "电力消耗量不能为空")
    private BigDecimal electricityConsumption;

    /**
     * 电网类型：NORTH-华北, EAST-华东, SOUTH-华南, CENTRAL-华中, NORTHWEST-西北, NORTHEAST-东北
     */
    private String gridType;

    /**
     * 是否使用绿电
     */
    private Boolean useGreenPower;

    /**
     * 绿电比例 (%)
     */
    private BigDecimal greenPowerRatio;

    // ========== 天然气消耗数据（加热炉等） ==========

    /**
     * 天然气消耗量 (m³)
     */
    private BigDecimal naturalGasConsumption;

    // ========== 柴油消耗数据（应急发电机等） ==========

    /**
     * 柴油消耗量 (L)
     */
    private BigDecimal dieselConsumption;

    // ========== 油品挥发损耗 ==========

    /**
     * 原油输送量 (吨)
     */
    private BigDecimal oilThroughput;

    /**
     * 油品挥发率 (%)
     */
    private BigDecimal volatileRate;

    /**
     * 油气回收率 (%)
     */
    private BigDecimal vaporRecoveryRate;

    // ========== 碳汇数据 ==========

    /**
     * 站区绿化面积 (m²)
     */
    private BigDecimal greenAreaSize;

    /**
     * 光伏发电量 (kWh)
     */
    private BigDecimal solarGeneration;

    // ========== 输送参数 ==========

    /**
     * 管道长度 (km)
     */
    private BigDecimal pipelineLength;

    /**
     * 泵站数量
     */
    private Integer pumpStationCount;

    /**
     * 各泵站电耗明细
     */
    private List<StationEnergy> stationEnergyList;

    /**
     * 泵站能耗
     */
    @Data
    public static class StationEnergy implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 泵站名称
         */
        private String stationName;

        /**
         * 电力消耗 (kWh)
         */
        private BigDecimal electricity;

        /**
         * 天然气消耗 (m³)
         */
        private BigDecimal naturalGas;
    }
}
