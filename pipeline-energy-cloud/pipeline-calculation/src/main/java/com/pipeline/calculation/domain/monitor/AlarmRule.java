package com.pipeline.calculation.domain.monitor;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 预警规则配置
 * <p>
 * 定义触发告警的规则和阈值。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlarmRule implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    /**
     * 规则ID
     */
    private Long ruleId;

    /**
     * 规则名称
     */
    private String ruleName;

    /**
     * 告警类型
     */
    private AlarmMessage.AlarmType alarmType;

    /**
     * 监控指标
     */
    private String metricName;

    /**
     * 比较操作符：GT-大于, LT-小于, GE-大于等于, LE-小于等于, EQ-等于, NE-不等于
     */
    private String operator;

    /**
     * 警告阈值
     */
    private BigDecimal warningThreshold;

    /**
     * 严重阈值
     */
    private BigDecimal criticalThreshold;

    /**
     * 紧急阈值
     */
    private BigDecimal emergencyThreshold;

    /**
     * 持续时间要求（秒）- 连续超过阈值多少秒才触发
     */
    private Integer durationSeconds;

    /**
     * 告警间隔（秒）- 重复告警的最小间隔
     */
    private Integer intervalSeconds;

    /**
     * 是否启用
     */
    private Boolean enabled;

    /**
     * 描述
     */
    private String description;

    /**
     * 处理建议模板
     */
    private String suggestionTemplate;
}
