package com.pipeline.calculation.controller;

import java.util.List;
import java.util.Map;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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
 * Realtime monitor controller.
 */
@Tag(name = "Realtime Monitor", description = "Pipeline monitor and alarm APIs")
@RestController
@RequestMapping("/calculation/monitor")
@RequiredArgsConstructor
@Validated
public class MonitorController {

    private final IMonitorService monitorService;

    @Operation(summary = "Get current monitor data", description = "Returns the latest snapshot for a pipeline. If no data exists, the call still succeeds with a null data payload.")
    @GetMapping("/current/{pipelineId}")
    public Result<MonitorDataPoint> getCurrentData(
            @Parameter(description = "Pipeline ID") @PathVariable Long pipelineId) {
        MonitorDataPoint data = monitorService.getCurrentData(pipelineId);
        return Result.ok(data);
    }

    @Operation(summary = "Get all current monitor data", description = "Returns the latest snapshot for all pipelines.")
    @GetMapping("/current/all")
    public Result<List<MonitorDataPoint>> getAllCurrentData() {
        return Result.ok(monitorService.getAllCurrentData());
    }

    @Operation(summary = "Receive monitor data", description = "Processes realtime monitor data and triggers alarm evaluation and push notifications.")
    @PostMapping("/data")
    public Result<Void> receiveData(@RequestBody MonitorDataPoint dataPoint) {
        monitorService.processMonitorData(dataPoint);
        return Result.ok();
    }

    @Operation(summary = "Get active alarms", description = "Queries current active alarms globally or by pipeline.")
    @GetMapping("/alarms")
    public Result<List<AlarmMessage>> getActiveAlarms(
            @Parameter(description = "Pipeline ID, optional")
            @RequestParam(required = false) Long pipelineId) {
        return Result.ok(monitorService.getActiveAlarms(pipelineId));
    }

    @Operation(summary = "Acknowledge alarm", description = "Marks an alarm as acknowledged.")
    @PostMapping("/alarms/{alarmId}/acknowledge")
    public Result<Void> acknowledgeAlarm(
            @Parameter(description = "Alarm ID") @PathVariable String alarmId,
            @RequestBody Map<String, String> params) {
        String userId = params.getOrDefault("userId", "system");
        boolean success = monitorService.acknowledgeAlarm(alarmId, userId);
        return success ? Result.ok() : Result.fail("Acknowledge failed, alarm not found");
    }

    @Operation(summary = "Resolve alarm", description = "Marks an alarm as resolved.")
    @PostMapping("/alarms/{alarmId}/resolve")
    public Result<Void> resolveAlarm(
            @Parameter(description = "Alarm ID") @PathVariable String alarmId) {
        boolean success = monitorService.resolveAlarm(alarmId);
        return success ? Result.ok() : Result.fail("Resolve failed, alarm not found");
    }

    @Operation(summary = "Get alarm rules", description = "Returns the current alarm rule configuration.")
    @GetMapping("/rules")
    public Result<List<AlarmRule>> getAlarmRules() {
        return Result.ok(monitorService.getAlarmRules());
    }

    @Operation(summary = "Update alarm rule", description = "Creates or updates one alarm rule.")
    @PostMapping("/rules")
    public Result<Void> updateAlarmRule(@RequestBody AlarmRule rule) {
        boolean success = monitorService.updateAlarmRule(rule);
        return success ? Result.ok() : Result.fail("Update failed");
    }

    @Operation(summary = "Generate simulated data", description = "Generates one simulated monitor snapshot for the given scenario.")
    @GetMapping("/simulate/{pipelineId}")
    public Result<MonitorDataPoint> simulateData(
            @Parameter(description = "Pipeline ID") @PathVariable Long pipelineId,
            @Parameter(description = "Scenario: NORMAL/PRESSURE_HIGH/LEAKAGE/PUMP_FAULT")
            @RequestParam(defaultValue = "NORMAL") String scenario) {
        MonitorDataPoint data = monitorService.simulateData(pipelineId, scenario);
        return Result.ok(data);
    }

    @Operation(summary = "Start simulation push", description = "Starts scheduled simulated monitor data push.")
    @PostMapping("/simulate/{pipelineId}/start")
    public Result<Void> startSimulation(
            @Parameter(description = "Pipeline ID") @PathVariable Long pipelineId,
            @Parameter(description = "Push interval in milliseconds")
            @RequestParam(defaultValue = "3000") long interval) {
        monitorService.startSimulation(pipelineId, interval);
        return Result.ok();
    }

    @Operation(summary = "Stop simulation push", description = "Stops the simulated monitor data push for the given pipeline.")
    @PostMapping("/simulate/{pipelineId}/stop")
    public Result<Void> stopSimulation(
            @Parameter(description = "Pipeline ID") @PathVariable Long pipelineId) {
        monitorService.stopSimulation(pipelineId);
        return Result.ok();
    }
}