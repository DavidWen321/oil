package com.pipeline.calculation.domain.monitor;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 实时监控数据点
 * <p>
 * 表示管道系统某一时刻的运行状态数据。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MonitorDataPoint implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 数据点ID
     */
    private String dataId;

    /**
     * 管道ID
     */
    private Long pipelineId;

    /**
     * 管道名称
     */
    private String pipelineName;

    /**
     * 采集时间
     */
    private LocalDateTime timestamp;

    // ========== 压力数据 ==========

    /**
     * 首站压力 (MPa)
     */
    private BigDecimal inletPressure;

    /**
     * 末站压力 (MPa)
     */
    private BigDecimal outletPressure;

    /**
     * 压力差 (MPa)
     */
    private BigDecimal pressureDrop;

    // ========== 流量数据 ==========

    /**
     * 首站流量 (m³/h)
     */
    private BigDecimal inletFlowRate;

    /**
     * 末站流量 (m³/h)
     */
    private BigDecimal outletFlowRate;

    /**
     * 流量差 (m³/h)
     */
    private BigDecimal flowDifference;

    /**
     * 流量差率 (%)
     */
    private BigDecimal flowDifferenceRate;

    // ========== 温度数据 ==========

    /**
     * 油品温度 (°C)
     */
    private BigDecimal temperature;

    // ========== 泵站数据 ==========

    /**
     * 运行泵数量
     */
    private Integer runningPumpCount;

    /**
     * 总功率 (kW)
     */
    private BigDecimal totalPower;

    /**
     * 平均泵效率 (%)
     */
    private BigDecimal avgPumpEfficiency;

    // ========== 能耗数据 ==========

    /**
     * 实时功率 (kW)
     */
    private BigDecimal realTimePower;

    /**
     * 累计电耗 (kWh)
     */
    private BigDecimal cumulativeEnergy;

    /**
     * 单位能耗 (kWh/t·km)
     */
    private BigDecimal unitEnergy;

    // ========== 状态指标 ==========

    /**
     * 系统健康分数 (0-100)
     */
    private Integer healthScore;

    /**
     * 系统状态：NORMAL-正常, WARNING-警告, CRITICAL-危险
     */
    private String systemStatus;

    /**
     * 预警数量
     */
    private Integer activeAlarmCount;
}
