package com.pipeline.calculation.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.pipeline.calculation.domain.monitor.*;
import com.pipeline.calculation.domain.monitor.AlarmMessage.AlarmType;
import com.pipeline.calculation.service.IMonitorService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 实时监控服务实现
 * <p>
 * 提供实时数据接收、预警检测、WebSocket推送等功能。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MonitorServiceImpl implements IMonitorService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * 当前监控数据缓存
     */
    private final Map<Long, MonitorDataPoint> currentDataCache = new ConcurrentHashMap<>();

    /**
     * 活动告警缓存
     */
    private final Map<String, AlarmMessage> activeAlarms = new ConcurrentHashMap<>();

    /**
     * 告警规则缓存
     */
    private final List<AlarmRule> alarmRules = new CopyOnWriteArrayList<>();

    /**
     * 模拟任务调度器
     */
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    /**
     * 模拟任务映射
     */
    private final Map<Long, ScheduledFuture<?>> simulationTasks = new ConcurrentHashMap<>();

    /**
     * 随机数生成器
     */
    private final Random random = new Random();

    /**
     * 初始化默认告警规则
     */
    {
        initDefaultRules();
    }

    @Override
    public void processMonitorData(MonitorDataPoint dataPoint) {
        log.debug("接收监控数据，管道ID: {}, 时间: {}", dataPoint.getPipelineId(), dataPoint.getTimestamp());

        // 1. 更新缓存
        currentDataCache.put(dataPoint.getPipelineId(), dataPoint);

        // 2. 执行告警规则检测
        List<AlarmMessage> newAlarms = checkAlarmRules(dataPoint);

        // 3. 推送监控数据到WebSocket
        messagingTemplate.convertAndSend("/topic/monitor/" + dataPoint.getPipelineId(), dataPoint);
        messagingTemplate.convertAndSend("/topic/monitor/all", dataPoint);

        // 4. 推送告警消息
        for (AlarmMessage alarm : newAlarms) {
            activeAlarms.put(alarm.getAlarmId(), alarm);
            messagingTemplate.convertAndSend("/topic/alarm/" + dataPoint.getPipelineId(), alarm);
            messagingTemplate.convertAndSend("/topic/alarm/all", alarm);
            log.warn("触发告警: {} - {}", alarm.getTitle(), alarm.getDescription());
        }

        // 5. 更新数据点的告警数量
        dataPoint.setActiveAlarmCount(countActiveAlarms(dataPoint.getPipelineId()));
    }

    @Override
    public MonitorDataPoint getCurrentData(Long pipelineId) {
        return currentDataCache.get(pipelineId);
    }

    @Override
    public List<MonitorDataPoint> getAllCurrentData() {
        return new ArrayList<>(currentDataCache.values());
    }

    @Override
    public List<AlarmMessage> getActiveAlarms(Long pipelineId) {
        if (pipelineId == null) {
            return activeAlarms.values().stream()
                    .filter(a -> "ACTIVE".equals(a.getStatus()))
                    .sorted(Comparator.comparing(AlarmMessage::getAlarmTime).reversed())
                    .toList();
        }
        return activeAlarms.values().stream()
                .filter(a -> pipelineId.equals(a.getPipelineId()) && "ACTIVE".equals(a.getStatus()))
                .sorted(Comparator.comparing(AlarmMessage::getAlarmTime).reversed())
                .toList();
    }

    @Override
    public boolean acknowledgeAlarm(String alarmId, String userId) {
        AlarmMessage alarm = activeAlarms.get(alarmId);
        if (alarm == null) {
            return false;
        }
        alarm.setStatus("ACKNOWLEDGED");
        alarm.setAcknowledgedBy(userId);
        alarm.setAcknowledgedTime(LocalDateTime.now());

        // 通知前端告警状态变更
        messagingTemplate.convertAndSend("/topic/alarm/update", alarm);
        return true;
    }

    @Override
    public boolean resolveAlarm(String alarmId) {
        AlarmMessage alarm = activeAlarms.get(alarmId);
        if (alarm == null) {
            return false;
        }
        alarm.setStatus("RESOLVED");
        alarm.setResolvedTime(LocalDateTime.now());

        // 通知前端告警状态变更
        messagingTemplate.convertAndSend("/topic/alarm/update", alarm);
        return true;
    }

    @Override
    public List<AlarmRule> getAlarmRules() {
        return new ArrayList<>(alarmRules);
    }

    @Override
    public boolean updateAlarmRule(AlarmRule rule) {
        for (int i = 0; i < alarmRules.size(); i++) {
            if (alarmRules.get(i).getRuleId().equals(rule.getRuleId())) {
                alarmRules.set(i, rule);
                return true;
            }
        }
        alarmRules.add(rule);
        return true;
    }

    @Override
    public MonitorDataPoint simulateData(Long pipelineId, String scenario) {
        LocalDateTime now = LocalDateTime.now();
        String dataId = UUID.randomUUID().toString().replace("-", "");

        // 基础值
        BigDecimal baseInletPressure = new BigDecimal("6.5");
        BigDecimal baseOutletPressure = new BigDecimal("0.8");
        BigDecimal baseInletFlow = new BigDecimal("850");
        BigDecimal baseOutletFlow = new BigDecimal("850");
        BigDecimal baseTemperature = new BigDecimal("45");
        int healthScore = 95;
        String systemStatus = "NORMAL";

        // 根据场景调整数据
        switch (scenario) {
            case "PRESSURE_HIGH" -> {
                baseInletPressure = new BigDecimal("8.5");
                healthScore = 70;
                systemStatus = "WARNING";
            }
            case "LEAKAGE" -> {
                baseOutletFlow = new BigDecimal("800"); // 流量差50 m³/h
                healthScore = 50;
                systemStatus = "CRITICAL";
            }
            case "PUMP_FAULT" -> {
                healthScore = 60;
                systemStatus = "WARNING";
            }
            default -> {
                // 正常场景添加小幅随机波动
                baseInletPressure = baseInletPressure.add(randomFluctuation(0.1));
                baseOutletPressure = baseOutletPressure.add(randomFluctuation(0.05));
                baseInletFlow = baseInletFlow.add(randomFluctuation(10));
                baseOutletFlow = baseOutletFlow.add(randomFluctuation(10));
                baseTemperature = baseTemperature.add(randomFluctuation(1));
            }
        }

        // 计算派生值
        BigDecimal pressureDrop = baseInletPressure.subtract(baseOutletPressure);
        BigDecimal flowDiff = baseInletFlow.subtract(baseOutletFlow).abs();
        BigDecimal flowDiffRate = flowDiff.divide(baseInletFlow, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        MonitorDataPoint dataPoint = MonitorDataPoint.builder()
                .dataId(dataId)
                .pipelineId(pipelineId)
                .pipelineName("主输油管道-" + pipelineId)
                .timestamp(now)
                .inletPressure(baseInletPressure.setScale(2, RoundingMode.HALF_UP))
                .outletPressure(baseOutletPressure.setScale(2, RoundingMode.HALF_UP))
                .pressureDrop(pressureDrop.setScale(2, RoundingMode.HALF_UP))
                .inletFlowRate(baseInletFlow.setScale(1, RoundingMode.HALF_UP))
                .outletFlowRate(baseOutletFlow.setScale(1, RoundingMode.HALF_UP))
                .flowDifference(flowDiff.setScale(1, RoundingMode.HALF_UP))
                .flowDifferenceRate(flowDiffRate.setScale(2, RoundingMode.HALF_UP))
                .temperature(baseTemperature.setScale(1, RoundingMode.HALF_UP))
                .runningPumpCount(3)
                .totalPower(new BigDecimal("2400"))
                .avgPumpEfficiency(new BigDecimal("78.5"))
                .realTimePower(new BigDecimal("2350").add(randomFluctuation(50)))
                .cumulativeEnergy(new BigDecimal("57600"))
                .unitEnergy(new BigDecimal("0.18"))
                .healthScore(healthScore)
                .systemStatus(systemStatus)
                .activeAlarmCount(0)
                .build();

        return dataPoint;
    }

    @Override
    public void startSimulation(Long pipelineId, long intervalMs) {
        stopSimulation(pipelineId); // 先停止可能存在的任务

        log.info("启动模拟数据推送，管道ID: {}, 间隔: {}ms", pipelineId, intervalMs);

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(() -> {
            try {
                // 随机选择场景，大部分时间正常，偶尔出现异常
                String scenario;
                int rand = random.nextInt(100);
                if (rand < 85) {
                    scenario = "NORMAL";
                } else if (rand < 93) {
                    scenario = "PRESSURE_HIGH";
                } else if (rand < 98) {
                    scenario = "PUMP_FAULT";
                } else {
                    scenario = "LEAKAGE";
                }

                MonitorDataPoint dataPoint = simulateData(pipelineId, scenario);
                processMonitorData(dataPoint);
            } catch (Exception e) {
                log.error("模拟数据推送失败", e);
            }
        }, 0, intervalMs, TimeUnit.MILLISECONDS);

        simulationTasks.put(pipelineId, future);
    }

    @Override
    public void stopSimulation(Long pipelineId) {
        ScheduledFuture<?> future = simulationTasks.remove(pipelineId);
        if (future != null) {
            future.cancel(false);
            log.info("停止模拟数据推送，管道ID: {}", pipelineId);
        }
    }

    // ========== 告警规则检测 ==========

    private List<AlarmMessage> checkAlarmRules(MonitorDataPoint data) {
        List<AlarmMessage> alarms = new ArrayList<>();

        for (AlarmRule rule : alarmRules) {
            if (!Boolean.TRUE.equals(rule.getEnabled())) {
                continue;
            }

            BigDecimal currentValue = getMetricValue(data, rule.getMetricName());
            if (currentValue == null) {
                continue;
            }

            AlarmMessage alarm = evaluateRule(rule, data, currentValue);
            if (alarm != null) {
                alarms.add(alarm);
            }
        }

        return alarms;
    }

    private BigDecimal getMetricValue(MonitorDataPoint data, String metricName) {
        return switch (metricName) {
            case "inletPressure" -> data.getInletPressure();
            case "outletPressure" -> data.getOutletPressure();
            case "flowDifferenceRate" -> data.getFlowDifferenceRate();
            case "temperature" -> data.getTemperature();
            case "avgPumpEfficiency" -> data.getAvgPumpEfficiency();
            case "healthScore" -> new BigDecimal(data.getHealthScore());
            default -> null;
        };
    }

    private AlarmMessage evaluateRule(AlarmRule rule, MonitorDataPoint data, BigDecimal value) {
        String alarmLevel = null;
        BigDecimal threshold = null;

        // 检查是否超过阈值
        if (rule.getEmergencyThreshold() != null && compareValue(value, rule.getEmergencyThreshold(), rule.getOperator())) {
            alarmLevel = "EMERGENCY";
            threshold = rule.getEmergencyThreshold();
        } else if (rule.getCriticalThreshold() != null && compareValue(value, rule.getCriticalThreshold(), rule.getOperator())) {
            alarmLevel = "CRITICAL";
            threshold = rule.getCriticalThreshold();
        } else if (rule.getWarningThreshold() != null && compareValue(value, rule.getWarningThreshold(), rule.getOperator())) {
            alarmLevel = "WARNING";
            threshold = rule.getWarningThreshold();
        }

        if (alarmLevel == null) {
            return null;
        }

        // 检查是否已有相同类型的活动告警（避免重复告警）
        boolean hasActiveAlarm = activeAlarms.values().stream()
                .anyMatch(a -> a.getPipelineId().equals(data.getPipelineId())
                        && a.getAlarmType().equals(rule.getAlarmType())
                        && "ACTIVE".equals(a.getStatus()));
        if (hasActiveAlarm) {
            return null;
        }

        BigDecimal deviation = value.subtract(threshold).divide(threshold, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100")).abs();

        return AlarmMessage.builder()
                .alarmId(UUID.randomUUID().toString().replace("-", ""))
                .pipelineId(data.getPipelineId())
                .pipelineName(data.getPipelineName())
                .alarmTime(LocalDateTime.now())
                .alarmType(rule.getAlarmType())
                .alarmLevel(alarmLevel)
                .title(rule.getRuleName())
                .description(String.format("%s: 当前值 %.2f, 阈值 %.2f",
                        rule.getDescription(), value, threshold))
                .metricName(rule.getMetricName())
                .currentValue(value)
                .threshold(threshold)
                .deviationPercent(deviation)
                .source("AUTO")
                .status("ACTIVE")
                .suggestion(rule.getSuggestionTemplate())
                .build();
    }

    private boolean compareValue(BigDecimal value, BigDecimal threshold, String operator) {
        int cmp = value.compareTo(threshold);
        return switch (operator) {
            case "GT" -> cmp > 0;
            case "GE" -> cmp >= 0;
            case "LT" -> cmp < 0;
            case "LE" -> cmp <= 0;
            case "EQ" -> cmp == 0;
            case "NE" -> cmp != 0;
            default -> false;
        };
    }

    private int countActiveAlarms(Long pipelineId) {
        return (int) activeAlarms.values().stream()
                .filter(a -> pipelineId.equals(a.getPipelineId()) && "ACTIVE".equals(a.getStatus()))
                .count();
    }

    private BigDecimal randomFluctuation(double amplitude) {
        return new BigDecimal((random.nextDouble() - 0.5) * 2 * amplitude);
    }

    // ========== 初始化默认规则 ==========

    private void initDefaultRules() {
        alarmRules.add(AlarmRule.builder()
                .ruleId(1L)
                .ruleName("首站压力过高告警")
                .alarmType(AlarmType.PRESSURE_HIGH)
                .metricName("inletPressure")
                .operator("GT")
                .warningThreshold(new BigDecimal("7.0"))
                .criticalThreshold(new BigDecimal("7.5"))
                .emergencyThreshold(new BigDecimal("8.0"))
                .durationSeconds(10)
                .intervalSeconds(300)
                .enabled(true)
                .description("首站出站压力超过设计值")
                .suggestionTemplate("建议：检查下游阀门开度，必要时调整泵站运行参数")
                .build());

        alarmRules.add(AlarmRule.builder()
                .ruleId(2L)
                .ruleName("疑似泄漏告警")
                .alarmType(AlarmType.LEAKAGE_SUSPECTED)
                .metricName("flowDifferenceRate")
                .operator("GT")
                .warningThreshold(new BigDecimal("2.0"))
                .criticalThreshold(new BigDecimal("5.0"))
                .emergencyThreshold(new BigDecimal("10.0"))
                .durationSeconds(30)
                .intervalSeconds(60)
                .enabled(true)
                .description("进出口流量差异超过阈值")
                .suggestionTemplate("建议：立即启动泄漏应急预案，组织巡线排查")
                .build());

        alarmRules.add(AlarmRule.builder()
                .ruleId(3L)
                .ruleName("末站压力过低告警")
                .alarmType(AlarmType.PRESSURE_LOW)
                .metricName("outletPressure")
                .operator("LT")
                .warningThreshold(new BigDecimal("0.5"))
                .criticalThreshold(new BigDecimal("0.3"))
                .emergencyThreshold(new BigDecimal("0.1"))
                .durationSeconds(20)
                .intervalSeconds(180)
                .enabled(true)
                .description("末站进站压力低于安全值")
                .suggestionTemplate("建议：检查上游泵站运行状态，排查是否存在泄漏")
                .build());

        alarmRules.add(AlarmRule.builder()
                .ruleId(4L)
                .ruleName("泵效率低告警")
                .alarmType(AlarmType.PUMP_EFFICIENCY_LOW)
                .metricName("avgPumpEfficiency")
                .operator("LT")
                .warningThreshold(new BigDecimal("70"))
                .criticalThreshold(new BigDecimal("60"))
                .emergencyThreshold(null)
                .durationSeconds(60)
                .intervalSeconds(600)
                .enabled(true)
                .description("泵站平均效率低于标准")
                .suggestionTemplate("建议：检查泵站运行参数，考虑优化泵组合")
                .build());
    }
}
