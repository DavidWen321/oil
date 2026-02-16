package com.pipeline.calculation.domain.comparison;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 多方案对比请求
 * <p>
 * 支持2-5个运行方案的综合对比分析。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
public class ComparisonRequest implements Serializable {

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
    @NotNull(message = "管道ID不能为空")
    private Long pipelineId;

    /**
     * 待对比的方案列表（2-5个）
     */
    @Valid
    @NotEmpty(message = "方案列表不能为空")
    @Size(min = 2, max = 5, message = "方案数量必须在2-5个之间")
    private List<SchemeData> schemes;

    /**
     * 对比维度（可选，默认全部）
     * - ENERGY: 能耗对比
     * - COST: 成本对比
     * - EFFICIENCY: 效率对比
     * - SAFETY: 安全性对比
     * - CARBON: 碳排放对比
     */
    private List<String> comparisonDimensions;

    /**
     * 单个运行方案数据
     */
    @Data
    public static class SchemeData implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 方案名称
         */
        @NotNull(message = "方案名称不能为空")
        private String schemeName;

        /**
         * 方案描述
         */
        private String description;

        /**
         * 输送流量 (m³/h)
         */
        @NotNull(message = "输送流量不能为空")
        private BigDecimal flowRate;

        /**
         * 首站出站压力 (MPa)
         */
        @NotNull(message = "首站压力不能为空")
        private BigDecimal inletPressure;

        /**
         * 末站进站压力 (MPa)
         */
        private BigDecimal outletPressure;

        /**
         * 泵站配置列表
         */
        @Valid
        private List<PumpConfig> pumpConfigs;

        /**
         * 油品温度 (°C)
         */
        private BigDecimal oilTemperature;

        /**
         * 油品密度 (kg/m³)
         */
        private BigDecimal oilDensity;

        /**
         * 油品粘度 (mm²/s)
         */
        private BigDecimal oilViscosity;

        /**
         * 运行时长 (小时/天)
         */
        private BigDecimal dailyOperatingHours;

        /**
         * 电价 (元/kWh)
         */
        private BigDecimal electricityPrice;
    }

    /**
     * 泵站配置
     */
    @Data
    public static class PumpConfig implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 泵站名称
         */
        private String stationName;

        /**
         * 运行泵数量
         */
        private Integer runningPumpCount;

        /**
         * 单泵功率 (kW)
         */
        private BigDecimal pumpPower;

        /**
         * 泵效率 (%)
         */
        private BigDecimal pumpEfficiency;

        /**
         * 是否变频
         */
        private Boolean variableFrequency;

        /**
         * 变频频率 (Hz)，变频时有效
         */
        private BigDecimal frequency;
    }
}
