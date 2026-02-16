package com.pipeline.calculation.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import com.pipeline.calculation.domain.diagnosis.*;
import com.pipeline.calculation.domain.diagnosis.DiagnosisRequest.PumpOperationData;
import com.pipeline.calculation.domain.diagnosis.DiagnosisResult.*;
import com.pipeline.calculation.service.IFaultDiagnosisService;

import lombok.extern.slf4j.Slf4j;

/**
 * 智能故障诊断服务实现
 * <p>
 * 采用规则引擎+阈值判断的混合诊断方法，
 * 支持压力、流量、泵站、能耗四大类故障的智能识别。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Service
public class FaultDiagnosisServiceImpl implements IFaultDiagnosisService {

    /**
     * 诊断历史缓存（实际生产应使用Redis）
     */
    private final Map<Long, DiagnosisResult> diagnosisCache = new ConcurrentHashMap<>();

    // ========== 诊断阈值常量 ==========

    /**
     * 流量差异报警阈值 (%)
     */
    private static final BigDecimal FLOW_DIFF_THRESHOLD = new BigDecimal("2.0");

    /**
     * 流量差异严重阈值 (%)
     */
    private static final BigDecimal FLOW_DIFF_CRITICAL = new BigDecimal("5.0");

    /**
     * 压力偏差警告阈值 (%)
     */
    private static final BigDecimal PRESSURE_WARN_THRESHOLD = new BigDecimal("10.0");

    /**
     * 压力偏差严重阈值 (%)
     */
    private static final BigDecimal PRESSURE_CRITICAL_THRESHOLD = new BigDecimal("20.0");

    /**
     * 泵效率下降阈值 (%)
     */
    private static final BigDecimal PUMP_EFF_DROP_THRESHOLD = new BigDecimal("5.0");

    /**
     * 摩阻偏差阈值 (%)
     */
    private static final BigDecimal FRICTION_DEVIATION_THRESHOLD = new BigDecimal("15.0");

    /**
     * 能耗偏差阈值 (%)
     */
    private static final BigDecimal ENERGY_DEVIATION_THRESHOLD = new BigDecimal("10.0");

    /**
     * 压力波动标准差阈值 (MPa)
     */
    private static final BigDecimal PRESSURE_FLUCTUATION_THRESHOLD = new BigDecimal("0.3");

    @Override
    public DiagnosisResult diagnose(DiagnosisRequest request) {
        log.info("开始执行故障诊断，管道ID: {}", request.getPipelineId());

        String diagnosisId = UUID.randomUUID().toString().replace("-", "");
        List<FaultInfo> faults = new ArrayList<>();

        // 1. 压力分析
        analyzePressure(request, faults);

        // 2. 流量分析（泄漏检测）
        analyzeFlow(request, faults);

        // 3. 泵站效率分析
        analyzePumpEfficiency(request, faults);

        // 4. 摩阻分析
        analyzeFriction(request, faults);

        // 5. 能耗分析
        analyzeEnergy(request, faults);

        // 6. 压力波动分析
        analyzePressureFluctuation(request, faults);

        // 计算健康评分和等级
        DiagnosisMetrics metrics = calculateMetrics(request, faults);
        int healthScore = calculateHealthScore(faults, metrics);
        String healthLevel = determineHealthLevel(healthScore);

        // 生成综合结论
        String conclusion = generateConclusion(faults, healthScore);

        // 生成优先处理建议
        List<String> priorityActions = generatePriorityActions(faults);

        // 生成风险预测
        List<RiskPrediction> riskPredictions = predictRisks(faults, request);

        DiagnosisResult result = DiagnosisResult.builder()
                .diagnosisId(diagnosisId)
                .pipelineId(request.getPipelineId())
                .diagnosisTime(LocalDateTime.now())
                .healthScore(healthScore)
                .healthLevel(healthLevel)
                .faults(faults)
                .conclusion(conclusion)
                .priorityActions(priorityActions)
                .riskPredictions(riskPredictions)
                .metrics(metrics)
                .build();

        // 缓存诊断结果
        diagnosisCache.put(request.getPipelineId(), result);

        log.info("故障诊断完成，健康评分: {}, 检测到 {} 个问题", healthScore, faults.size());
        return result;
    }

    @Override
    public Integer quickHealthCheck(DiagnosisRequest request) {
        List<FaultInfo> faults = new ArrayList<>();
        analyzePressure(request, faults);
        analyzeFlow(request, faults);
        DiagnosisMetrics metrics = calculateMetrics(request, faults);
        return calculateHealthScore(faults, metrics);
    }

    @Override
    public DiagnosisResult getLatestDiagnosis(Long pipelineId) {
        return diagnosisCache.get(pipelineId);
    }

    // ========== 压力分析 ==========

    private void analyzePressure(DiagnosisRequest request, List<FaultInfo> faults) {
        BigDecimal inletP = request.getInletPressure();
        BigDecimal outletP = request.getOutletPressure();
        BigDecimal maxP = request.getMaxDesignPressure();
        BigDecimal minP = request.getMinDesignPressure();

        // 检查压力是否超过设计上限
        if (maxP != null && inletP.compareTo(maxP) > 0) {
            BigDecimal deviation = inletP.subtract(maxP).divide(maxP, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
            faults.add(createPressureFault(FaultType.PRESSURE_HIGH, inletP, maxP, deviation, "首站"));
        }

        // 检查压力是否低于设计下限
        if (minP != null && outletP.compareTo(minP) < 0) {
            BigDecimal deviation = minP.subtract(outletP).divide(minP, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
            faults.add(createPressureFault(FaultType.PRESSURE_LOW, outletP, minP, deviation, "末站"));
        }
    }

    private FaultInfo createPressureFault(FaultType type, BigDecimal actual, BigDecimal design,
                                          BigDecimal deviation, String location) {
        return FaultInfo.builder()
                .faultType(type)
                .faultCode(type.getCode())
                .faultName(type.getName())
                .severity(type.getSeverity())
                .confidence(85)
                .description(location + type.getDescription())
                .detectedValue(actual + " MPa")
                .normalRange(design + " MPa")
                .deviationPercent(deviation)
                .possibleCauses(getPressureCauses(type))
                .recommendations(getPressureRecommendations(type))
                .relatedFaults(getRelatedFaults(type))
                .build();
    }

    // ========== 流量分析（泄漏检测） ==========

    private void analyzeFlow(DiagnosisRequest request, List<FaultInfo> faults) {
        BigDecimal inletFlow = request.getInletFlowRate();
        BigDecimal outletFlow = request.getOutletFlowRate();
        BigDecimal designFlow = request.getDesignFlowRate();

        // 进出口流量差异分析（泄漏检测核心算法）
        BigDecimal flowDiff = inletFlow.subtract(outletFlow).abs();
        BigDecimal flowDiffRate = flowDiff.divide(inletFlow, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        if (flowDiffRate.compareTo(FLOW_DIFF_CRITICAL) >= 0) {
            faults.add(createLeakageFault(inletFlow, outletFlow, flowDiffRate, "critical"));
        } else if (flowDiffRate.compareTo(FLOW_DIFF_THRESHOLD) >= 0) {
            faults.add(createLeakageFault(inletFlow, outletFlow, flowDiffRate, "warning"));
        }

        // 与设计流量对比
        if (designFlow != null) {
            BigDecimal avgFlow = inletFlow.add(outletFlow).divide(new BigDecimal("2"), 4, RoundingMode.HALF_UP);
            BigDecimal flowDeviation = avgFlow.subtract(designFlow).divide(designFlow, 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));

            if (flowDeviation.compareTo(new BigDecimal("-15")) < 0) {
                faults.add(FaultInfo.builder()
                        .faultType(FaultType.FLOW_LOW)
                        .faultCode(FaultType.FLOW_LOW.getCode())
                        .faultName(FaultType.FLOW_LOW.getName())
                        .severity("warning")
                        .confidence(75)
                        .description("实际流量显著低于设计流量")
                        .detectedValue(avgFlow + " m³/h")
                        .normalRange(designFlow + " m³/h")
                        .deviationPercent(flowDeviation.abs())
                        .possibleCauses(List.of("管道堵塞", "阀门未完全打开", "泵站出力不足", "下游需求减少"))
                        .recommendations(List.of("检查管道是否有堵塞", "确认各阀门开度", "核实下游用户需求"))
                        .build());
            } else if (flowDeviation.compareTo(new BigDecimal("15")) > 0) {
                faults.add(FaultInfo.builder()
                        .faultType(FaultType.FLOW_HIGH)
                        .faultCode(FaultType.FLOW_HIGH.getCode())
                        .faultName(FaultType.FLOW_HIGH.getName())
                        .severity("warning")
                        .confidence(70)
                        .description("实际流量显著高于设计流量")
                        .detectedValue(avgFlow + " m³/h")
                        .normalRange(designFlow + " m³/h")
                        .deviationPercent(flowDeviation)
                        .possibleCauses(List.of("流量计量误差", "违规超量输送", "紧急调配需求"))
                        .recommendations(List.of("校验流量计准确性", "确认是否有超量输送指令", "评估管道承载能力"))
                        .build());
            }
        }
    }

    private FaultInfo createLeakageFault(BigDecimal inlet, BigDecimal outlet,
                                         BigDecimal diffRate, String severity) {
        BigDecimal leakageVolume = inlet.subtract(outlet);
        return FaultInfo.builder()
                .faultType(FaultType.LEAKAGE_SUSPECTED)
                .faultCode(FaultType.LEAKAGE_SUSPECTED.getCode())
                .faultName(FaultType.LEAKAGE_SUSPECTED.getName())
                .severity(severity)
                .confidence(severity.equals("critical") ? 90 : 70)
                .description("进出口流量差异超过阈值，疑似存在管道泄漏")
                .detectedValue("入口 " + inlet + " m³/h, 出口 " + outlet + " m³/h")
                .normalRange("差异应 < " + FLOW_DIFF_THRESHOLD + "%")
                .deviationPercent(diffRate)
                .possibleCauses(List.of(
                        "管道腐蚀穿孔",
                        "焊缝开裂",
                        "阀门密封失效",
                        "法兰连接泄漏",
                        "第三方破坏"
                ))
                .recommendations(List.of(
                        "【紧急】立即启动泄漏应急预案",
                        "使用负压波法或声波法定位泄漏点",
                        "检查近期施工区域的管道段",
                        "部署无人机沿线巡检",
                        "预估泄漏量: 约 " + leakageVolume.setScale(1, RoundingMode.HALF_UP) + " m³/h"
                ))
                .relatedFaults(List.of("PRESSURE_LOW", "FRICTION_HIGH"))
                .build();
    }

    // ========== 泵站效率分析 ==========

    private void analyzePumpEfficiency(DiagnosisRequest request, List<FaultInfo> faults) {
        List<PumpOperationData> pumpList = request.getPumpDataList();
        if (pumpList == null || pumpList.isEmpty()) {
            return;
        }

        for (PumpOperationData pump : pumpList) {
            // 效率分析
            if (pump.getActualEfficiency() != null && pump.getRatedEfficiency() != null) {
                BigDecimal effDrop = pump.getRatedEfficiency().subtract(pump.getActualEfficiency());
                if (effDrop.compareTo(PUMP_EFF_DROP_THRESHOLD) > 0) {
                    faults.add(FaultInfo.builder()
                            .faultType(FaultType.PUMP_EFFICIENCY_LOW)
                            .faultCode(FaultType.PUMP_EFFICIENCY_LOW.getCode())
                            .faultName(pump.getPumpName() + " - " + FaultType.PUMP_EFFICIENCY_LOW.getName())
                            .severity("warning")
                            .confidence(80)
                            .description(pump.getPumpName() + "运行效率下降超过" + PUMP_EFF_DROP_THRESHOLD + "%")
                            .detectedValue(pump.getActualEfficiency() + "%")
                            .normalRange("≥ " + pump.getRatedEfficiency() + "%")
                            .deviationPercent(effDrop)
                            .possibleCauses(List.of(
                                    "叶轮磨损",
                                    "密封件老化",
                                    "气蚀现象",
                                    "进口过滤器堵塞",
                                    "运行工况偏离最优点"
                            ))
                            .recommendations(List.of(
                                    "检查叶轮状态，必要时更换",
                                    "检查密封系统",
                                    "确认进口压力是否满足NPSH要求",
                                    "清洗进口过滤器",
                                    "调整运行参数至高效区"
                            ))
                            .build());
                }
            }

            // 振动分析
            if (pump.getVibrationValue() != null && pump.getVibrationThreshold() != null) {
                if (pump.getVibrationValue().compareTo(pump.getVibrationThreshold()) > 0) {
                    BigDecimal vibDeviation = pump.getVibrationValue()
                            .subtract(pump.getVibrationThreshold())
                            .divide(pump.getVibrationThreshold(), 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100"));
                    faults.add(FaultInfo.builder()
                            .faultType(FaultType.PUMP_VIBRATION)
                            .faultCode(FaultType.PUMP_VIBRATION.getCode())
                            .faultName(pump.getPumpName() + " - " + FaultType.PUMP_VIBRATION.getName())
                            .severity("critical")
                            .confidence(90)
                            .description(pump.getPumpName() + "振动值超标，存在设备损坏风险")
                            .detectedValue(pump.getVibrationValue() + " mm/s")
                            .normalRange("< " + pump.getVibrationThreshold() + " mm/s")
                            .deviationPercent(vibDeviation)
                            .possibleCauses(List.of(
                                    "轴承损坏",
                                    "转子不平衡",
                                    "联轴器对中不良",
                                    "基础松动",
                                    "共振现象"
                            ))
                            .recommendations(List.of(
                                    "【紧急】安排停机检修",
                                    "检查并更换轴承",
                                    "进行动平衡校正",
                                    "检查联轴器对中情况",
                                    "加固设备基础"
                            ))
                            .build());
                }
            }
        }
    }

    // ========== 摩阻分析 ==========

    private void analyzeFriction(DiagnosisRequest request, List<FaultInfo> faults) {
        BigDecimal actual = request.getActualFrictionLoss();
        BigDecimal theoretical = request.getTheoreticalFrictionLoss();

        if (actual == null || theoretical == null || theoretical.compareTo(BigDecimal.ZERO) == 0) {
            return;
        }

        BigDecimal deviation = actual.subtract(theoretical)
                .divide(theoretical, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        if (deviation.compareTo(FRICTION_DEVIATION_THRESHOLD) > 0) {
            faults.add(FaultInfo.builder()
                    .faultType(FaultType.FRICTION_HIGH)
                    .faultCode(FaultType.FRICTION_HIGH.getCode())
                    .faultName(FaultType.FRICTION_HIGH.getName())
                    .severity("warning")
                    .confidence(75)
                    .description("沿程摩阻损失异常偏高，超过理论值" + deviation.setScale(1, RoundingMode.HALF_UP) + "%")
                    .detectedValue(actual + " MPa")
                    .normalRange("理论值 " + theoretical + " MPa")
                    .deviationPercent(deviation)
                    .possibleCauses(List.of(
                            "管道内壁结垢",
                            "管道内部腐蚀导致粗糙度增加",
                            "油品粘度变化",
                            "管道局部变形",
                            "异物堵塞"
                    ))
                    .recommendations(List.of(
                            "安排清管作业（清管器通过）",
                            "检测管道内壁腐蚀情况",
                            "核实油品实际粘度",
                            "管道内检测（智能清管器）"
                    ))
                    .build());
        }
    }

    // ========== 能耗分析 ==========

    private void analyzeEnergy(DiagnosisRequest request, List<FaultInfo> faults) {
        BigDecimal actual = request.getActualUnitEnergy();
        BigDecimal standard = request.getStandardUnitEnergy();

        if (actual == null || standard == null || standard.compareTo(BigDecimal.ZERO) == 0) {
            return;
        }

        BigDecimal deviation = actual.subtract(standard)
                .divide(standard, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        if (deviation.compareTo(ENERGY_DEVIATION_THRESHOLD) > 0) {
            faults.add(FaultInfo.builder()
                    .faultType(FaultType.ENERGY_HIGH)
                    .faultCode(FaultType.ENERGY_HIGH.getCode())
                    .faultName(FaultType.ENERGY_HIGH.getName())
                    .severity("info")
                    .confidence(85)
                    .description("单位输量能耗高于行业标准" + deviation.setScale(1, RoundingMode.HALF_UP) + "%")
                    .detectedValue(actual + " kWh/t·km")
                    .normalRange("行业标准 " + standard + " kWh/t·km")
                    .deviationPercent(deviation)
                    .possibleCauses(List.of(
                            "泵站运行效率低",
                            "输送工况不在经济运行区",
                            "管道摩阻偏大",
                            "泵组合方案非最优"
                    ))
                    .recommendations(List.of(
                            "优化泵组合运行方案",
                            "调整输送批次减少开停泵次数",
                            "考虑变频调速降低节流损失",
                            "参考系统优化计算结果调整运行"
                    ))
                    .build());
        }
    }

    // ========== 压力波动分析 ==========

    private void analyzePressureFluctuation(DiagnosisRequest request, List<FaultInfo> faults) {
        List<BigDecimal> history = request.getPressureHistory();
        if (history == null || history.size() < 5) {
            return;
        }

        // 计算标准差
        BigDecimal mean = history.stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(history.size()), 4, RoundingMode.HALF_UP);

        BigDecimal variance = history.stream()
                .map(p -> p.subtract(mean).pow(2))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(history.size()), 4, RoundingMode.HALF_UP);

        BigDecimal stdDev = new BigDecimal(Math.sqrt(variance.doubleValue()))
                .setScale(4, RoundingMode.HALF_UP);

        if (stdDev.compareTo(PRESSURE_FLUCTUATION_THRESHOLD) > 0) {
            faults.add(FaultInfo.builder()
                    .faultType(FaultType.PRESSURE_FLUCTUATION)
                    .faultCode(FaultType.PRESSURE_FLUCTUATION.getCode())
                    .faultName(FaultType.PRESSURE_FLUCTUATION.getName())
                    .severity("warning")
                    .confidence(70)
                    .description("压力波动异常，标准差达到" + stdDev + " MPa")
                    .detectedValue("σ = " + stdDev + " MPa")
                    .normalRange("σ < " + PRESSURE_FLUCTUATION_THRESHOLD + " MPa")
                    .deviationPercent(stdDev.subtract(PRESSURE_FLUCTUATION_THRESHOLD)
                            .divide(PRESSURE_FLUCTUATION_THRESHOLD, 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100")))
                    .possibleCauses(List.of(
                            "阀门操作频繁",
                            "水击现象",
                            "泵站切换过程",
                            "下游用户负荷突变",
                            "调节阀控制不稳定"
                    ))
                    .recommendations(List.of(
                            "检查阀门操作是否规范",
                            "分析水击产生原因并采取缓解措施",
                            "优化泵站切换策略",
                            "与下游用户协调平稳用油"
                    ))
                    .build());
        }
    }

    // ========== 指标计算 ==========

    private DiagnosisMetrics calculateMetrics(DiagnosisRequest request, List<FaultInfo> faults) {
        // 基础分100分，每个故障根据严重程度扣分
        int pressureScore = 100;
        int flowScore = 100;
        int pumpScore = 100;
        int energyScore = 100;

        for (FaultInfo fault : faults) {
            int deduction = getDeduction(fault.getSeverity());
            switch (fault.getFaultType()) {
                case PRESSURE_HIGH, PRESSURE_LOW, PRESSURE_FLUCTUATION -> pressureScore -= deduction;
                case FLOW_LOW, FLOW_HIGH, LEAKAGE_SUSPECTED -> flowScore -= deduction;
                case PUMP_EFFICIENCY_LOW, PUMP_VIBRATION -> pumpScore -= deduction;
                case ENERGY_HIGH -> energyScore -= deduction;
                default -> { }
            }
        }

        // 确保分数在0-100范围内
        pressureScore = Math.max(0, Math.min(100, pressureScore));
        flowScore = Math.max(0, Math.min(100, flowScore));
        pumpScore = Math.max(0, Math.min(100, pumpScore));
        energyScore = Math.max(0, Math.min(100, energyScore));

        // 计算差异率
        BigDecimal flowDiffRate = BigDecimal.ZERO;
        if (request.getInletFlowRate() != null && request.getOutletFlowRate() != null) {
            BigDecimal diff = request.getInletFlowRate().subtract(request.getOutletFlowRate()).abs();
            flowDiffRate = diff.divide(request.getInletFlowRate(), 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }

        BigDecimal frictionDevRate = BigDecimal.ZERO;
        if (request.getActualFrictionLoss() != null && request.getTheoreticalFrictionLoss() != null
                && request.getTheoreticalFrictionLoss().compareTo(BigDecimal.ZERO) != 0) {
            frictionDevRate = request.getActualFrictionLoss().subtract(request.getTheoreticalFrictionLoss())
                    .divide(request.getTheoreticalFrictionLoss(), 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }

        BigDecimal energyDevRate = BigDecimal.ZERO;
        if (request.getActualUnitEnergy() != null && request.getStandardUnitEnergy() != null
                && request.getStandardUnitEnergy().compareTo(BigDecimal.ZERO) != 0) {
            energyDevRate = request.getActualUnitEnergy().subtract(request.getStandardUnitEnergy())
                    .divide(request.getStandardUnitEnergy(), 4, RoundingMode.HALF_UP)
                    .multiply(new BigDecimal("100"));
        }

        return DiagnosisMetrics.builder()
                .pressureScore(pressureScore)
                .flowScore(flowScore)
                .pumpScore(pumpScore)
                .energyScore(energyScore)
                .pressureStatus(getStatusText(pressureScore))
                .flowStatus(getStatusText(flowScore))
                .pumpStatus(getStatusText(pumpScore))
                .energyStatus(getStatusText(energyScore))
                .flowDifferenceRate(flowDiffRate)
                .frictionDeviationRate(frictionDevRate)
                .energyDeviationRate(energyDevRate)
                .build();
    }

    private int getDeduction(String severity) {
        return switch (severity) {
            case "critical" -> 30;
            case "warning" -> 15;
            case "info" -> 5;
            default -> 0;
        };
    }

    private String getStatusText(int score) {
        if (score >= 90) return "优秀";
        if (score >= 75) return "良好";
        if (score >= 60) return "一般";
        return "异常";
    }

    // ========== 综合评分计算 ==========

    private int calculateHealthScore(List<FaultInfo> faults, DiagnosisMetrics metrics) {
        // 加权平均：压力30% + 流量30% + 泵站25% + 能耗15%
        double score = metrics.getPressureScore() * 0.30
                + metrics.getFlowScore() * 0.30
                + metrics.getPumpScore() * 0.25
                + metrics.getEnergyScore() * 0.15;
        return (int) Math.round(score);
    }

    private String determineHealthLevel(int score) {
        if (score >= 90) return "EXCELLENT";
        if (score >= 75) return "GOOD";
        if (score >= 60) return "WARNING";
        return "CRITICAL";
    }

    // ========== 结论生成 ==========

    private String generateConclusion(List<FaultInfo> faults, int healthScore) {
        if (faults.isEmpty()) {
            return "管道系统运行状态良好，各项指标正常，未检测到异常。建议继续保持当前运行参数。";
        }

        long criticalCount = faults.stream().filter(f -> "critical".equals(f.getSeverity())).count();
        long warningCount = faults.stream().filter(f -> "warning".equals(f.getSeverity())).count();

        StringBuilder sb = new StringBuilder();
        sb.append("本次诊断共发现 ").append(faults.size()).append(" 个问题");

        if (criticalCount > 0) {
            sb.append("，其中 ").append(criticalCount).append(" 个严重问题需要立即处理");
        }
        if (warningCount > 0) {
            sb.append("，").append(warningCount).append(" 个警告需要关注");
        }
        sb.append("。系统健康评分为 ").append(healthScore).append(" 分。");

        // 添加主要问题描述
        if (criticalCount > 0) {
            sb.append("主要问题包括：");
            faults.stream()
                    .filter(f -> "critical".equals(f.getSeverity()))
                    .forEach(f -> sb.append(f.getFaultName()).append("、"));
            sb.setLength(sb.length() - 1);
            sb.append("。请立即按优先级处理。");
        }

        return sb.toString();
    }

    // ========== 优先处理建议 ==========

    private List<String> generatePriorityActions(List<FaultInfo> faults) {
        List<String> actions = new ArrayList<>();

        // 按严重程度排序处理
        faults.stream()
                .sorted(Comparator.comparingInt(f -> switch (f.getSeverity()) {
                    case "critical" -> 0;
                    case "warning" -> 1;
                    default -> 2;
                }))
                .limit(5)
                .forEach(fault -> {
                    if (!fault.getRecommendations().isEmpty()) {
                        actions.add("[" + fault.getFaultName() + "] " + fault.getRecommendations().get(0));
                    }
                });

        if (actions.isEmpty()) {
            actions.add("系统运行正常，建议保持现有运行参数并定期巡检");
        }

        return actions;
    }

    // ========== 风险预测 ==========

    private List<RiskPrediction> predictRisks(List<FaultInfo> faults, DiagnosisRequest request) {
        List<RiskPrediction> predictions = new ArrayList<>();

        // 基于当前故障预测潜在风险
        boolean hasLeakage = faults.stream().anyMatch(f -> f.getFaultType() == FaultType.LEAKAGE_SUSPECTED);
        boolean hasPressureHigh = faults.stream().anyMatch(f -> f.getFaultType() == FaultType.PRESSURE_HIGH);
        boolean hasPumpIssue = faults.stream().anyMatch(f ->
                f.getFaultType() == FaultType.PUMP_EFFICIENCY_LOW || f.getFaultType() == FaultType.PUMP_VIBRATION);

        if (hasLeakage) {
            predictions.add(RiskPrediction.builder()
                    .riskType("环境污染风险")
                    .riskDescription("若泄漏持续，可能造成土壤和水源污染")
                    .probability(80)
                    .impactLevel("严重")
                    .preventiveMeasures(List.of(
                            "立即封堵泄漏点",
                            "准备应急处置物资",
                            "通知环保部门"
                    ))
                    .build());
        }

        if (hasPressureHigh) {
            predictions.add(RiskPrediction.builder()
                    .riskType("管道破裂风险")
                    .riskDescription("持续超压运行可能导致管道疲劳破裂")
                    .probability(60)
                    .impactLevel("严重")
                    .preventiveMeasures(List.of(
                            "降低输送压力至安全范围",
                            "检查安全阀状态",
                            "增加压力监测频率"
                    ))
                    .build());
        }

        if (hasPumpIssue) {
            predictions.add(RiskPrediction.builder()
                    .riskType("泵站停机风险")
                    .riskDescription("泵设备异常可能导致非计划停机")
                    .probability(55)
                    .impactLevel("中等")
                    .preventiveMeasures(List.of(
                            "安排备用泵组待命",
                            "准备关键备件",
                            "制定应急切换预案"
                    ))
                    .build());
        }

        // 能耗预警
        if (request.getActualUnitEnergy() != null && request.getStandardUnitEnergy() != null) {
            BigDecimal energyRatio = request.getActualUnitEnergy()
                    .divide(request.getStandardUnitEnergy(), 4, RoundingMode.HALF_UP);
            if (energyRatio.compareTo(new BigDecimal("1.2")) > 0) {
                predictions.add(RiskPrediction.builder()
                        .riskType("能耗超标风险")
                        .riskDescription("持续高能耗运行将增加运营成本")
                        .probability(70)
                        .impactLevel("中等")
                        .preventiveMeasures(List.of(
                                "优化泵组合运行方案",
                                "评估变频改造可行性",
                                "安排清管作业降低摩阻"
                        ))
                        .build());
            }
        }

        return predictions;
    }

    // ========== 辅助方法 ==========

    private List<String> getPressureCauses(FaultType type) {
        return switch (type) {
            case PRESSURE_HIGH -> List.of("出口阀门关闭或开度不足", "下游管道堵塞", "泵站出力过大", "误操作");
            case PRESSURE_LOW -> List.of("管道泄漏", "泵站故障", "上游供给不足", "阀门全开");
            default -> List.of();
        };
    }

    private List<String> getPressureRecommendations(FaultType type) {
        return switch (type) {
            case PRESSURE_HIGH -> List.of("检查并适度开大出口阀门", "检查下游管道畅通性", "调整泵站运行参数", "启动减压保护");
            case PRESSURE_LOW -> List.of("排查泄漏点", "检查泵站运行状态", "核实上游供给情况", "调整阀门开度");
            default -> List.of();
        };
    }

    private List<String> getRelatedFaults(FaultType type) {
        return switch (type) {
            case PRESSURE_HIGH -> List.of("PUMP_VIBRATION", "FRICTION_HIGH");
            case PRESSURE_LOW -> List.of("LEAKAGE_SUSPECTED", "PUMP_EFFICIENCY_LOW");
            case LEAKAGE_SUSPECTED -> List.of("PRESSURE_LOW", "FLOW_LOW");
            default -> List.of();
        };
    }
}
