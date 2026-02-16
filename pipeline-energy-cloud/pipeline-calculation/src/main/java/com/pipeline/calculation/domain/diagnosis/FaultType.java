package com.pipeline.calculation.domain.diagnosis;

import lombok.Getter;

/**
 * 故障类型枚举
 * <p>
 * 定义管道系统可能出现的各类故障，包括压力异常、
 * 流量异常、泵站故障、泄漏等。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Getter
public enum FaultType {

    /**
     * 压力过高
     */
    PRESSURE_HIGH("PRESSURE_HIGH", "压力过高", "critical",
            "管道压力超过安全阈值，可能导致管道破裂"),

    /**
     * 压力过低
     */
    PRESSURE_LOW("PRESSURE_LOW", "压力过低", "warning",
            "管道压力低于正常范围，可能存在泄漏或泵站故障"),

    /**
     * 压力波动异常
     */
    PRESSURE_FLUCTUATION("PRESSURE_FLUCTUATION", "压力波动异常", "warning",
            "压力波动幅度超过正常范围，可能存在阀门问题或水击现象"),

    /**
     * 流量异常偏低
     */
    FLOW_LOW("FLOW_LOW", "流量偏低", "warning",
            "实际流量低于设计流量，可能存在堵塞或泄漏"),

    /**
     * 流量异常偏高
     */
    FLOW_HIGH("FLOW_HIGH", "流量偏高", "warning",
            "实际流量高于设计流量，可能存在测量误差或违规操作"),

    /**
     * 泵效率下降
     */
    PUMP_EFFICIENCY_LOW("PUMP_EFFICIENCY_LOW", "泵效率下降", "warning",
            "泵运行效率低于额定效率，可能存在磨损或气蚀"),

    /**
     * 泵振动异常
     */
    PUMP_VIBRATION("PUMP_VIBRATION", "泵振动异常", "critical",
            "泵振动超标，可能存在轴承损坏或不平衡"),

    /**
     * 疑似泄漏
     */
    LEAKAGE_SUSPECTED("LEAKAGE_SUSPECTED", "疑似泄漏", "critical",
            "进出口流量差异超过阈值，疑似存在泄漏点"),

    /**
     * 摩阻异常增大
     */
    FRICTION_HIGH("FRICTION_HIGH", "摩阻异常增大", "warning",
            "沿程摩阻损失超过理论值，可能存在结垢或管道老化"),

    /**
     * 温度异常
     */
    TEMPERATURE_ABNORMAL("TEMPERATURE_ABNORMAL", "温度异常", "warning",
            "油品温度超出正常范围，影响粘度和流动性"),

    /**
     * 能耗异常偏高
     */
    ENERGY_HIGH("ENERGY_HIGH", "能耗异常偏高", "info",
            "单位输量能耗高于行业标准，存在优化空间");

    /**
     * 故障代码
     */
    private final String code;

    /**
     * 故障名称
     */
    private final String name;

    /**
     * 严重级别：critical-严重, warning-警告, info-提示
     */
    private final String severity;

    /**
     * 故障描述
     */
    private final String description;

    FaultType(String code, String name, String severity, String description) {
        this.code = code;
        this.name = name;
        this.severity = severity;
        this.description = description;
    }

    /**
     * 根据代码获取故障类型
     *
     * @param code 故障代码
     * @return 故障类型枚举
     */
    public static FaultType fromCode(String code) {
        for (FaultType type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }
}
