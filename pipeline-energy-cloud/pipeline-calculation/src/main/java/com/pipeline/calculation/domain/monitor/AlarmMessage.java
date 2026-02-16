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
 * 预警消息
 * <p>
 * 当监控数据触发预警规则时生成的告警信息。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmMessage implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 告警ID
     */
    private String alarmId;

    /**
     * 管道ID
     */
    private Long pipelineId;

    /**
     * 管道名称
     */
    private String pipelineName;

    /**
     * 告警时间
     */
    private LocalDateTime alarmTime;

    /**
     * 告警类型
     */
    private AlarmType alarmType;

    /**
     * 告警级别：INFO-提示, WARNING-警告, CRITICAL-严重, EMERGENCY-紧急
     */
    private String alarmLevel;

    /**
     * 告警标题
     */
    private String title;

    /**
     * 告警描述
     */
    private String description;

    /**
     * 触发指标名称
     */
    private String metricName;

    /**
     * 当前值
     */
    private BigDecimal currentValue;

    /**
     * 阈值
     */
    private BigDecimal threshold;

    /**
     * 偏离程度 (%)
     */
    private BigDecimal deviationPercent;

    /**
     * 告警来源：AUTO-自动监测, MANUAL-人工上报
     */
    private String source;

    /**
     * 告警状态：ACTIVE-活动, ACKNOWLEDGED-已确认, RESOLVED-已解决
     */
    private String status;

    /**
     * 处理建议
     */
    private String suggestion;

    /**
     * 关联的诊断ID（如果有）
     */
    private String relatedDiagnosisId;

    /**
     * 确认人
     */
    private String acknowledgedBy;

    /**
     * 确认时间
     */
    private LocalDateTime acknowledgedTime;

    /**
     * 解决时间
     */
    private LocalDateTime resolvedTime;

    /**
     * 告警类型枚举
     */
    public enum AlarmType {
        /**
         * 压力过高
         */
        PRESSURE_HIGH("PRESSURE_HIGH", "压力过高告警"),

        /**
         * 压力过低
         */
        PRESSURE_LOW("PRESSURE_LOW", "压力过低告警"),

        /**
         * 压力波动
         */
        PRESSURE_FLUCTUATION("PRESSURE_FLUCTUATION", "压力波动告警"),

        /**
         * 流量异常
         */
        FLOW_ABNORMAL("FLOW_ABNORMAL", "流量异常告警"),

        /**
         * 疑似泄漏
         */
        LEAKAGE_SUSPECTED("LEAKAGE_SUSPECTED", "疑似泄漏告警"),

        /**
         * 泵效率低
         */
        PUMP_EFFICIENCY_LOW("PUMP_EFFICIENCY_LOW", "泵效率低告警"),

        /**
         * 泵振动异常
         */
        PUMP_VIBRATION("PUMP_VIBRATION", "泵振动异常告警"),

        /**
         * 温度异常
         */
        TEMPERATURE_ABNORMAL("TEMPERATURE_ABNORMAL", "温度异常告警"),

        /**
         * 能耗超标
         */
        ENERGY_HIGH("ENERGY_HIGH", "能耗超标告警"),

        /**
         * 设备故障
         */
        EQUIPMENT_FAULT("EQUIPMENT_FAULT", "设备故障告警"),

        /**
         * 通信中断
         */
        COMMUNICATION_LOST("COMMUNICATION_LOST", "通信中断告警");

        private final String code;
        private final String description;

        AlarmType(String code, String description) {
            this.code = code;
            this.description = description;
        }

        public String getCode() {
            return code;
        }

        public String getDescription() {
            return description;
        }
    }
}
