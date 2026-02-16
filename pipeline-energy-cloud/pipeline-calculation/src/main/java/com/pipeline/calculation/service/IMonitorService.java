package com.pipeline.calculation.service;

import java.util.List;

import com.pipeline.calculation.domain.monitor.AlarmMessage;
import com.pipeline.calculation.domain.monitor.AlarmRule;
import com.pipeline.calculation.domain.monitor.MonitorDataPoint;

/**
 * 实时监控服务接口
 * <p>
 * 提供实时监控数据推送、预警检测和告警管理功能。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
public interface IMonitorService {

    /**
     * 接收并处理监控数据
     * <p>
     * 数据将被分析，触发规则检测，并通过WebSocket推送给订阅者。
     * </p>
     *
     * @param dataPoint 监控数据点
     */
    void processMonitorData(MonitorDataPoint dataPoint);

    /**
     * 获取管道当前监控数据
     *
     * @param pipelineId 管道ID
     * @return 最新的监控数据点
     */
    MonitorDataPoint getCurrentData(Long pipelineId);

    /**
     * 获取所有管道的当前监控数据
     *
     * @return 监控数据列表
     */
    List<MonitorDataPoint> getAllCurrentData();

    /**
     * 获取活动告警列表
     *
     * @param pipelineId 管道ID，为null时返回所有管道的告警
     * @return 告警消息列表
     */
    List<AlarmMessage> getActiveAlarms(Long pipelineId);

    /**
     * 确认告警
     *
     * @param alarmId 告警ID
     * @param userId  确认人ID
     * @return 是否成功
     */
    boolean acknowledgeAlarm(String alarmId, String userId);

    /**
     * 解决告警
     *
     * @param alarmId 告警ID
     * @return 是否成功
     */
    boolean resolveAlarm(String alarmId);

    /**
     * 获取告警规则列表
     *
     * @return 规则列表
     */
    List<AlarmRule> getAlarmRules();

    /**
     * 更新告警规则
     *
     * @param rule 规则配置
     * @return 是否成功
     */
    boolean updateAlarmRule(AlarmRule rule);

    /**
     * 模拟监控数据（用于演示）
     * <p>
     * 生成模拟的实时监控数据，用于系统演示和测试。
     * </p>
     *
     * @param pipelineId 管道ID
     * @param scenario   场景：NORMAL-正常, PRESSURE_HIGH-压力偏高, LEAKAGE-泄漏
     * @return 模拟的数据点
     */
    MonitorDataPoint simulateData(Long pipelineId, String scenario);

    /**
     * 启动模拟数据推送
     * <p>
     * 开始定时推送模拟监控数据，用于演示。
     * </p>
     *
     * @param pipelineId 管道ID
     * @param intervalMs 推送间隔（毫秒）
     */
    void startSimulation(Long pipelineId, long intervalMs);

    /**
     * 停止模拟数据推送
     *
     * @param pipelineId 管道ID
     */
    void stopSimulation(Long pipelineId);
}
