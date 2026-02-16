package com.pipeline.calculation.controller;

import java.util.List;
import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import com.pipeline.calculation.domain.monitor.AlarmMessage;
import com.pipeline.calculation.domain.monitor.AlarmRule;
import com.pipeline.calculation.domain.monitor.MonitorDataPoint;
import com.pipeline.calculation.service.IMonitorService;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

/**
 * 实时监控控制器
 * <p>
 * 提供实时监控数据查询、告警管理、模拟数据推送等REST接口。
 * 实时数据推送通过WebSocket实现，客户端需连接 /ws/monitor 端点。
 * </p>
 *
 * <h3>WebSocket订阅主题：</h3>
 * <ul>
 *   <li>/topic/monitor/{pipelineId} - 订阅指定管道的监控数据</li>
 *   <li>/topic/monitor/all - 订阅所有管道的监控数据</li>
 *   <li>/topic/alarm/{pipelineId} - 订阅指定管道的告警</li>
 *   <li>/topic/alarm/all - 订阅所有告警</li>
 *   <li>/topic/alarm/update - 订阅告警状态变更</li>
 * </ul>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "实时监控", description = "管道系统实时监控与预警接口")
@RestController
@RequestMapping("/calculation/monitor")
@RequiredArgsConstructor
@Validated
public class MonitorController {

    private final IMonitorService monitorService;

    // ========== 监控数据接口 ==========

    /**
     * 获取指定管道的当前监控数据
     *
     * @param pipelineId 管道ID
     * @return 当前监控数据
     */
    @Operation(summary = "获取当前监控数据", description = "获取指定管道的最新监控数据")
    @GetMapping("/current/{pipelineId}")
    public Result<MonitorDataPoint> getCurrentData(
            @Parameter(description = "管道ID") @PathVariable Long pipelineId) {
        MonitorDataPoint data = monitorService.getCurrentData(pipelineId);
        if (data == null) {
            return Result.fail("未找到该管道的监控数据");
        }
        return Result.ok(data);
    }

    /**
     * 获取所有管道的当前监控数据
     *
     * @return 所有管道的监控数据列表
     */
    @Operation(summary = "获取所有监控数据", description = "获取所有管道的最新监控数据")
    @GetMapping("/current/all")
    public Result<List<MonitorDataPoint>> getAllCurrentData() {
        return Result.ok(monitorService.getAllCurrentData());
    }

    /**
     * 接收监控数据上报
     * <p>
     * 数据将被处理并通过WebSocket推送给订阅者。
     * </p>
     *
     * @param dataPoint 监控数据点
     * @return 操作结果
     */
    @Operation(summary = "上报监控数据", description = "接收并处理监控数据，触发告警检测")
    @PostMapping("/data")
    public Result<Void> receiveData(@RequestBody MonitorDataPoint dataPoint) {
        monitorService.processMonitorData(dataPoint);
        return Result.ok();
    }

    // ========== 告警管理接口 ==========

    /**
     * 获取活动告警列表
     *
     * @param pipelineId 管道ID（可选）
     * @return 活动告警列表
     */
    @Operation(summary = "获取活动告警", description = "获取当前活动的告警列表")
    @GetMapping("/alarms")
    public Result<List<AlarmMessage>> getActiveAlarms(
            @Parameter(description = "管道ID，不传则返回所有") @RequestParam(required = false) Long pipelineId) {
        return Result.ok(monitorService.getActiveAlarms(pipelineId));
    }

    /**
     * 确认告警
     *
     * @param alarmId 告警ID
     * @param params  包含userId的参数
     * @return 操作结果
     */
    @Operation(summary = "确认告警", description = "确认告警，标记为已知晓")
    @PostMapping("/alarms/{alarmId}/acknowledge")
    public Result<Void> acknowledgeAlarm(
            @Parameter(description = "告警ID") @PathVariable String alarmId,
            @RequestBody Map<String, String> params) {
        String userId = params.getOrDefault("userId", "system");
        boolean success = monitorService.acknowledgeAlarm(alarmId, userId);
        return success ? Result.ok() : Result.fail("确认失败，告警不存在");
    }

    /**
     * 解决告警
     *
     * @param alarmId 告警ID
     * @return 操作结果
     */
    @Operation(summary = "解决告警", description = "标记告警为已解决")
    @PostMapping("/alarms/{alarmId}/resolve")
    public Result<Void> resolveAlarm(@Parameter(description = "告警ID") @PathVariable String alarmId) {
        boolean success = monitorService.resolveAlarm(alarmId);
        return success ? Result.ok() : Result.fail("解决失败，告警不存在");
    }

    // ========== 告警规则接口 ==========

    /**
     * 获取告警规则列表
     *
     * @return 告警规则列表
     */
    @Operation(summary = "获取告警规则", description = "获取所有告警规则配置")
    @GetMapping("/rules")
    public Result<List<AlarmRule>> getAlarmRules() {
        return Result.ok(monitorService.getAlarmRules());
    }

    /**
     * 更新告警规则
     *
     * @param rule 告警规则
     * @return 操作结果
     */
    @Operation(summary = "更新告警规则", description = "创建或更新告警规则")
    @PostMapping("/rules")
    public Result<Void> updateAlarmRule(@RequestBody AlarmRule rule) {
        boolean success = monitorService.updateAlarmRule(rule);
        return success ? Result.ok() : Result.fail("更新失败");
    }

    // ========== 模拟数据接口（演示用） ==========

    /**
     * 生成模拟数据
     *
     * @param pipelineId 管道ID
     * @param scenario   场景：NORMAL, PRESSURE_HIGH, LEAKAGE, PUMP_FAULT
     * @return 模拟的数据点
     */
    @Operation(summary = "生成模拟数据", description = "生成指定场景的模拟监控数据")
    @GetMapping("/simulate/{pipelineId}")
    public Result<MonitorDataPoint> simulateData(
            @Parameter(description = "管道ID") @PathVariable Long pipelineId,
            @Parameter(description = "场景：NORMAL/PRESSURE_HIGH/LEAKAGE/PUMP_FAULT")
            @RequestParam(defaultValue = "NORMAL") String scenario) {
        MonitorDataPoint data = monitorService.simulateData(pipelineId, scenario);
        return Result.ok(data);
    }

    /**
     * 启动模拟数据推送
     * <p>
     * 定时推送模拟监控数据到WebSocket，用于演示。
     * </p>
     *
     * @param pipelineId 管道ID
     * @param interval   推送间隔（毫秒），默认3000
     * @return 操作结果
     */
    @Operation(summary = "启动模拟推送", description = "启动定时推送模拟监控数据（演示用）")
    @PostMapping("/simulate/{pipelineId}/start")
    public Result<Void> startSimulation(
            @Parameter(description = "管道ID") @PathVariable Long pipelineId,
            @Parameter(description = "推送间隔(ms)") @RequestParam(defaultValue = "3000") long interval) {
        monitorService.startSimulation(pipelineId, interval);
        return Result.ok();
    }

    /**
     * 停止模拟数据推送
     *
     * @param pipelineId 管道ID
     * @return 操作结果
     */
    @Operation(summary = "停止模拟推送", description = "停止模拟数据推送")
    @PostMapping("/simulate/{pipelineId}/stop")
    public Result<Void> stopSimulation(@Parameter(description = "管道ID") @PathVariable Long pipelineId) {
        monitorService.stopSimulation(pipelineId);
        return Result.ok();
    }
}
