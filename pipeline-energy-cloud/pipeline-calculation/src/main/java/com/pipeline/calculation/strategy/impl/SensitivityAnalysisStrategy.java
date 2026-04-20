package com.pipeline.calculation.strategy.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.HydraulicAnalysisResult;
import com.pipeline.calculation.domain.SensitivityAnalysisParams;
import com.pipeline.calculation.domain.SensitivityAnalysisParams.AnalysisType;
import com.pipeline.calculation.domain.SensitivityAnalysisParams.SensitivityVariable;
import com.pipeline.calculation.domain.SensitivityAnalysisResult;
import com.pipeline.calculation.domain.SensitivityAnalysisResult.CrossAnalysisResult;
import com.pipeline.calculation.domain.SensitivityAnalysisResult.DataPoint;
import com.pipeline.calculation.domain.SensitivityAnalysisResult.RiskRule;
import com.pipeline.calculation.domain.SensitivityAnalysisResult.SensitivityRanking;
import com.pipeline.calculation.domain.SensitivityAnalysisResult.VariableSensitivityResult;
import com.pipeline.calculation.strategy.CalculationStrategy;
import com.pipeline.common.core.domain.Result;
import com.pipeline.common.core.enums.SensitivityVariableEnum;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 敏感性分析策略实现
 * <p>
 * 通过改变输入参数，分析各参数对水力计算结果的影响程度，
 * 支持单因素分析和多因素交叉分析。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SensitivityAnalysisStrategy
        implements CalculationStrategy<SensitivityAnalysisParams, SensitivityAnalysisResult> {

    private static final String STRATEGY_TYPE = "SENSITIVITY_ANALYSIS";
    private static final int SCALE = 6;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal ENERGY_WARNING_THRESHOLD = new BigDecimal("20");
    private static final BigDecimal ENERGY_RISK_THRESHOLD = new BigDecimal("45");
    private static final BigDecimal PRESSURE_WARNING_DROP_THRESHOLD = new BigDecimal("5");
    private static final BigDecimal HIGH_LOAD_SENSITIVITY_THRESHOLD = new BigDecimal("0.8");
    private static final BigDecimal NONLINEAR_SLOPE_MIN_THRESHOLD = new BigDecimal("0.01");
    private static final BigDecimal NONLINEAR_SLOPE_RATIO_THRESHOLD = new BigDecimal("1.8");
    private static final BigDecimal NONLINEAR_SLOPE_DELTA_THRESHOLD = new BigDecimal("0.3");

    private final HydraulicAnalysisStrategy hydraulicAnalysisStrategy;

    @Override
    public Result<SensitivityAnalysisResult> calculate(SensitivityAnalysisParams params) {
        long startTime = System.currentTimeMillis();
        int totalCalculations = 0;

        // 参数校验
        if (params == null || params.getBaseParams() == null) {
            return Result.fail("基准参数不能为空");
        }
        if (params.getVariables() == null || params.getVariables().isEmpty()) {
            return Result.fail("敏感性变量不能为空");
        }

        try {
            // 计算基准结果
            Result<HydraulicAnalysisResult> baseCalcResult =
                    hydraulicAnalysisStrategy.calculate(params.getBaseParams());
            if (!baseCalcResult.isSuccess()) {
                return Result.fail("基准计算失败: " + baseCalcResult.getMsg());
            }
            HydraulicAnalysisResult baseResult = baseCalcResult.getData();
            totalCalculations++;

            SensitivityAnalysisResult.SensitivityAnalysisResultBuilder resultBuilder =
                    SensitivityAnalysisResult.builder().baseResult(baseResult);

            List<VariableSensitivityResult> variableResults = new ArrayList<>();
            List<CrossAnalysisResult> crossResults = new ArrayList<>();

            if (params.getAnalysisType() == AnalysisType.SINGLE) {
                // 单因素分析：逐个变量分析
                for (SensitivityVariable variable : params.getVariables()) {
                    VariableSensitivityResult varResult = analyzeSingleVariable(
                            params.getBaseParams(), baseResult, variable);
                    variableResults.add(varResult);
                    totalCalculations += varResult.getDataPoints().size();
                }
            } else {
                // 多因素交叉分析
                crossResults = analyzeCrossVariables(params.getBaseParams(), baseResult, params.getVariables());
                totalCalculations += crossResults.size();

                // 同时也生成单因素分析结果用于对比
                for (SensitivityVariable variable : params.getVariables()) {
                    VariableSensitivityResult varResult = analyzeSingleVariable(
                            params.getBaseParams(), baseResult, variable);
                    variableResults.add(varResult);
                    totalCalculations += varResult.getDataPoints().size();
                }
            }

            // 计算敏感性排序
            List<SensitivityRanking> rankings = calculateSensitivityRanking(variableResults);
            List<RiskRule> riskRules = buildRiskRules(variableResults, rankings);

            long duration = System.currentTimeMillis() - startTime;

            SensitivityAnalysisResult result = resultBuilder
                    .variableResults(variableResults)
                    .crossResults(crossResults.isEmpty() ? null : crossResults)
                    .sensitivityRanking(rankings)
                    .riskRules(riskRules)
                    .duration(duration)
                    .totalCalculations(totalCalculations)
                    .build();

            log.info("敏感性分析完成: 变量数={}, 计算次数={}, 耗时={}ms",
                    params.getVariables().size(), totalCalculations, duration);

            return Result.ok(result);

        } catch (Exception e) {
            log.error("敏感性分析异常", e);
            return Result.fail("敏感性分析失败: " + e.getMessage());
        }
    }

    /**
     * 单因素敏感性分析
     */
    private VariableSensitivityResult analyzeSingleVariable(
            HydraulicAnalysisParams baseParams,
            HydraulicAnalysisResult baseResult,
            SensitivityVariable variable) {

        SensitivityVariableEnum varEnum = SensitivityVariableEnum.fromCode(variable.getVariableType());
        String varName = varEnum != null ? varEnum.getName() : variable.getVariableType();
        String unit = varEnum != null ? varEnum.getUnit() : "";

        BigDecimal baseValue = getVariableValue(baseParams, variable.getVariableType());
        List<DataPoint> dataPoints = new ArrayList<>();

        BigDecimal start = variable.getStartPercent();
        BigDecimal end = variable.getEndPercent();
        BigDecimal step = variable.getStepPercent();

        BigDecimal maxImpact = BigDecimal.ZERO;
        BigDecimal sumSensitivity = BigDecimal.ZERO;
        int pointCount = 0;

        // 遍历变化范围
        for (BigDecimal percent = start;
             percent.compareTo(end) <= 0;
             percent = percent.add(step)) {

            // 创建修改后的参数
            HydraulicAnalysisParams modifiedParams = cloneAndModifyParams(
                    baseParams, variable.getVariableType(), percent);

            // 执行计算
            Result<HydraulicAnalysisResult> calcResult = hydraulicAnalysisStrategy.calculate(modifiedParams);

            if (calcResult.isSuccess()) {
                HydraulicAnalysisResult result = calcResult.getData();
                BigDecimal modifiedValue = getVariableValue(modifiedParams, variable.getVariableType());

                // 计算变化率
                BigDecimal frictionChange = calculateChangePercent(
                        baseResult.getFrictionHeadLoss(), result.getFrictionHeadLoss());
                BigDecimal pressureChange = calculateChangePercent(
                        baseResult.getEndStationInPressure(), result.getEndStationInPressure());

                DataPoint point = DataPoint.builder()
                        .changePercent(percent)
                        .variableValue(modifiedValue)
                        .frictionHeadLoss(result.getFrictionHeadLoss())
                        .frictionChangePercent(frictionChange)
                        .endStationPressure(result.getEndStationInPressure())
                        .pressureChangePercent(pressureChange)
                        .hydraulicSlope(result.getHydraulicSlope())
                        .reynoldsNumber(result.getReynoldsNumber())
                        .flowRegime(result.getFlowRegime())
                        .fullResult(result)
                        .build();

                dataPoints.add(point);

                // 更新最大影响
                if (frictionChange.abs().compareTo(maxImpact) > 0) {
                    maxImpact = frictionChange.abs();
                }

                // 累计敏感性系数（用于平均）
                if (percent.compareTo(BigDecimal.ZERO) != 0) {
                    BigDecimal sensitivity = frictionChange.divide(percent, SCALE, RoundingMode.HALF_UP);
                    sumSensitivity = sumSensitivity.add(sensitivity.abs());
                    pointCount++;
                }
            }
        }

        // 计算平均敏感性系数
        BigDecimal avgSensitivity = pointCount > 0
                ? sumSensitivity.divide(BigDecimal.valueOf(pointCount), SCALE, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        // 判断趋势
        String trend = determineTrend(dataPoints);

        return VariableSensitivityResult.builder()
                .variableType(variable.getVariableType())
                .variableName(varName)
                .unit(unit)
                .baseValue(baseValue)
                .dataPoints(dataPoints)
                .sensitivityCoefficient(avgSensitivity)
                .trend(trend)
                .maxImpactPercent(maxImpact)
                .build();
    }

    /**
     * 多因素交叉分析
     */
    private List<CrossAnalysisResult> analyzeCrossVariables(
            HydraulicAnalysisParams baseParams,
            HydraulicAnalysisResult baseResult,
            List<SensitivityVariable> variables) {

        List<CrossAnalysisResult> results = new ArrayList<>();

        // 简化实现：使用固定的变化点（-10%, 0%, +10%）
        BigDecimal[] changePoints = {
                new BigDecimal("-10"),
                BigDecimal.ZERO,
                new BigDecimal("10")
        };

        // 对于两个变量的情况，生成3x3的组合矩阵
        if (variables.size() >= 2) {
            SensitivityVariable var1 = variables.get(0);
            SensitivityVariable var2 = variables.get(1);

            for (BigDecimal change1 : changePoints) {
                for (BigDecimal change2 : changePoints) {
                    // 修改参数
                    HydraulicAnalysisParams modifiedParams = cloneParams(baseParams);
                    modifyParamByPercent(modifiedParams, var1.getVariableType(), change1);
                    modifyParamByPercent(modifiedParams, var2.getVariableType(), change2);

                    // 执行计算
                    Result<HydraulicAnalysisResult> calcResult =
                            hydraulicAnalysisStrategy.calculate(modifiedParams);

                    if (calcResult.isSuccess()) {
                        Map<String, BigDecimal> changes = new HashMap<>();
                        changes.put(var1.getVariableType(), change1);
                        changes.put(var2.getVariableType(), change2);

                        BigDecimal overallChange = calculateChangePercent(
                                baseResult.getFrictionHeadLoss(),
                                calcResult.getData().getFrictionHeadLoss());

                        String desc = String.format("%s: %+.0f%%, %s: %+.0f%%",
                                var1.getVariableType(), change1.doubleValue(),
                                var2.getVariableType(), change2.doubleValue());

                        results.add(CrossAnalysisResult.builder()
                                .combinationDesc(desc)
                                .variableChanges(changes)
                                .result(calcResult.getData())
                                .overallChangePercent(overallChange)
                                .build());
                    }
                }
            }
        }

        return results;
    }

    /**
     * 计算敏感性排序
     */
    private List<SensitivityRanking> calculateSensitivityRanking(
            List<VariableSensitivityResult> variableResults) {

        List<SensitivityRanking> rankings = new ArrayList<>();

        // 按敏感性系数排序
        variableResults.stream()
                .sorted(Comparator.comparing(
                        v -> v.getSensitivityCoefficient().abs(),
                        Comparator.reverseOrder()))
                .forEach(v -> {
                    int rank = rankings.size() + 1;
                    String description = generateSensitivityDescription(v);

                    rankings.add(SensitivityRanking.builder()
                            .rank(rank)
                            .variableType(v.getVariableType())
                            .variableName(v.getVariableName())
                            .sensitivityCoefficient(v.getSensitivityCoefficient())
                            .description(description)
                            .build());
                });

        return rankings;
    }

    /**
     * 基于核心计算结果生成规则判断，供报告层和 AI 层引用。
     */
    private List<RiskRule> buildRiskRules(
            List<VariableSensitivityResult> variableResults,
            List<SensitivityRanking> rankings) {
        if (variableResults == null || variableResults.isEmpty()) {
            return List.of();
        }

        VariableSensitivityResult primaryResult = resolvePrimaryVariableResult(variableResults, rankings);
        SensitivityRiskMetrics metrics = calculateRiskMetrics(primaryResult);

        List<RiskRule> rules = new ArrayList<>();
        rules.add(buildEnergyRiskRule(primaryResult, metrics));
        rules.add(buildStabilityRiskRule(primaryResult, metrics));
        rules.add(buildEquipmentRiskRule(primaryResult, metrics));
        return rules;
    }

    private VariableSensitivityResult resolvePrimaryVariableResult(
            List<VariableSensitivityResult> variableResults,
            List<SensitivityRanking> rankings) {
        if (rankings != null && !rankings.isEmpty()) {
            String topVariableType = rankings.get(0).getVariableType();
            for (VariableSensitivityResult result : variableResults) {
                if (topVariableType != null && topVariableType.equals(result.getVariableType())) {
                    return result;
                }
            }
        }
        return variableResults.get(0);
    }

    private SensitivityRiskMetrics calculateRiskMetrics(VariableSensitivityResult result) {
        SensitivityRiskMetrics metrics = new SensitivityRiskMetrics();
        metrics.variableName = safeText(result.getVariableName(), result.getVariableType(), "当前变量");
        metrics.sensitivityCoefficient = result.getSensitivityCoefficient();
        metrics.maxImpactPercent = result.getMaxImpactPercent();

        List<DataPoint> points = sortedDataPoints(result.getDataPoints());
        metrics.pointCount = points.size();
        if (points.isEmpty()) {
            return metrics;
        }

        DataPoint firstPoint = points.get(0);
        DataPoint lastPoint = points.get(points.size() - 1);
        metrics.pressureTrend = resolveTrend(firstPoint.getEndStationPressure(), lastPoint.getEndStationPressure());
        metrics.frictionTrend = resolveTrend(firstPoint.getFrictionHeadLoss(), lastPoint.getFrictionHeadLoss());

        Set<String> flowRegimes = new LinkedHashSet<>();
        for (DataPoint point : points) {
            if (point.getFlowRegime() != null && !point.getFlowRegime().isBlank()) {
                flowRegimes.add(point.getFlowRegime());
            }

            BigDecimal frictionChange = point.getFrictionChangePercent();
            if (frictionChange != null) {
                if (metrics.maxFrictionChangePercent == null
                        || frictionChange.compareTo(metrics.maxFrictionChangePercent) > 0) {
                    metrics.maxFrictionChangePercent = frictionChange;
                }
                if (frictionChange.compareTo(BigDecimal.ZERO) > 0
                        && (metrics.maxFrictionIncreasePercent == null
                        || frictionChange.compareTo(metrics.maxFrictionIncreasePercent) > 0)) {
                    metrics.maxFrictionIncreasePercent = frictionChange;
                    metrics.maxFrictionIncreasePoint = point;
                }
            }

            BigDecimal pressureChange = point.getPressureChangePercent();
            if (pressureChange != null
                    && (metrics.minPressureChangePercent == null
                    || pressureChange.compareTo(metrics.minPressureChangePercent) < 0)) {
                metrics.minPressureChangePercent = pressureChange;
            }

            BigDecimal endStationPressure = point.getEndStationPressure();
            if (endStationPressure != null
                    && (metrics.minEndStationPressure == null
                    || endStationPressure.compareTo(metrics.minEndStationPressure) < 0)) {
                metrics.minEndStationPressure = endStationPressure;
                metrics.minPressurePoint = point;
            }
        }

        if (metrics.minPressureChangePercent != null
                && metrics.minPressureChangePercent.compareTo(BigDecimal.ZERO) < 0) {
            metrics.maxPressureDropPercent = metrics.minPressureChangePercent.abs();
        }

        metrics.flowRegimeChanged = flowRegimes.size() > 1;
        metrics.flowRegimeSegments = buildFlowRegimeSegments(points);

        NonlinearRiskInfo nonlinearRiskInfo = analyzeNonlinearGrowth(points);
        metrics.nonlinearGrowth = nonlinearRiskInfo.hasNonlinearGrowth;
        metrics.nonlinearSegmentLabel = nonlinearRiskInfo.segmentLabel;
        metrics.nonlinearSlopeRatio = nonlinearRiskInfo.slopeRatio;

        return metrics;
    }

    private RiskRule buildEnergyRiskRule(VariableSensitivityResult result, SensitivityRiskMetrics metrics) {
        String level;
        if (metrics.pointCount == 0) {
            level = "数据不足";
        } else if (gte(metrics.maxFrictionIncreasePercent, ENERGY_RISK_THRESHOLD)) {
            level = "风险区";
        } else if (gte(metrics.maxFrictionIncreasePercent, ENERGY_WARNING_THRESHOLD)) {
            level = "高能耗区";
        } else {
            level = "安全区";
        }

        String frictionIncreaseText = metrics.maxFrictionIncreasePercent == null
                ? "未出现正向增幅"
                : formatNumber(metrics.maxFrictionIncreasePercent, "%");
        String changeLabel = formatChangeLabel(metrics.maxFrictionIncreasePoint);
        String message = switch (level) {
            case "风险区" -> "核心算法逐点计算显示，" + metrics.variableName
                    + "的敏感系数为 " + formatNumber(metrics.sensitivityCoefficient, "")
                    + "，最大影响幅度为 " + formatNumber(metrics.maxImpactPercent, "%")
                    + "，摩阻损失最大正向增幅为 " + frictionIncreaseText
                    + ("-".equals(changeLabel) ? "" : "（发生在 " + changeLabel + "）")
                    + "，已超过能耗风险阈值 " + formatNumber(ENERGY_RISK_THRESHOLD, "%") + "。";
            case "高能耗区" -> "核心算法逐点计算显示，" + metrics.variableName
                    + "扰动后摩阻损失最大正向增幅为 " + frictionIncreaseText
                    + "，已超过高能耗阈值 " + formatNumber(ENERGY_WARNING_THRESHOLD, "%")
                    + "，但尚未达到风险阈值 " + formatNumber(ENERGY_RISK_THRESHOLD, "%") + "。";
            case "安全区" -> "核心算法逐点计算显示，" + metrics.variableName
                    + "扰动后的摩阻损失最大正向增幅为 " + frictionIncreaseText
                    + "，未达到高能耗阈值 " + formatNumber(ENERGY_WARNING_THRESHOLD, "%")
                    + "，当前能耗侧仍处于可控带内。";
            default -> "核心算法结果缺少有效采样点，暂不能完成能耗区规则判断。";
        };

        String impact = switch (level) {
            case "风险区" -> "单位输量能耗和泵组负荷会被阻力项快速放大，应限制继续向不利方向调整。";
            case "高能耗区" -> "系统尚可运行，但新增扬程会优先用于克服沿程阻力，继续粗放上调变量会扩大能耗。";
            case "安全区" -> "当前能耗侧仍有调节余量，但仍应围绕头部敏感变量做小步调整。";
            default -> "缺少规则证据时，不应由 AI 自行给出能耗风险结论。";
        };

        return RiskRule.builder()
                .riskCode("energy_consumption_zone")
                .category("ENERGY")
                .title("能耗区判断")
                .targetName(metrics.variableName)
                .level(level)
                .message(message)
                .impact(impact)
                .suggestion("建议以摩阻损失增幅作为能耗侧复核指标，优先控制头部敏感变量。")
                .evidence(evidence(
                        "variableType", result.getVariableType(),
                        "sensitivityCoefficient", metrics.sensitivityCoefficient,
                        "maxImpactPercent", metrics.maxImpactPercent,
                        "maxFrictionIncreasePercent", metrics.maxFrictionIncreasePercent,
                        "thresholds", Map.of("warning", ENERGY_WARNING_THRESHOLD, "risk", ENERGY_RISK_THRESHOLD)
                ))
                .source("core_algorithm_rule")
                .build();
    }

    private RiskRule buildStabilityRiskRule(VariableSensitivityResult result, SensitivityRiskMetrics metrics) {
        String level;
        if (metrics.pointCount == 0) {
            level = "数据不足";
        } else if (metrics.minEndStationPressure != null
                && metrics.minEndStationPressure.compareTo(BigDecimal.ZERO) < 0) {
            level = "风险区";
        } else if (gte(metrics.maxPressureDropPercent, PRESSURE_WARNING_DROP_THRESHOLD)) {
            level = "预警区";
        } else {
            level = "安全区";
        }

        String minPressureLabel = formatChangeLabel(metrics.minPressurePoint);
        String pressureDropText = metrics.maxPressureDropPercent == null
                ? "未出现下降"
                : formatNumber(metrics.maxPressureDropPercent, "%");
        String message = switch (level) {
            case "风险区" -> "核心算法逐点计算显示，"
                    + ("-".equals(minPressureLabel) ? "最不利区间" : minPressureLabel + " 区间")
                    + "末站进站压力为 " + formatNumber(metrics.minEndStationPressure, "")
                    + "，已低于 0，压力边界被直接触发。";
            case "预警区" -> "核心算法逐点计算显示，末站进站压力最大降幅为 " + pressureDropText
                    + "，已超过预警阈值 " + formatNumber(PRESSURE_WARNING_DROP_THRESHOLD, "%")
                    + "；压力趋势为" + metrics.pressureTrend + "。";
            case "安全区" -> "核心算法逐点计算显示，最小末站进站压力为 "
                    + formatNumber(metrics.minEndStationPressure, "")
                    + "，最大压力降幅为 " + pressureDropText
                    + "，尚未触发压力风险或预警阈值。";
            default -> "核心算法结果缺少有效采样点，暂不能完成运行稳定区规则判断。";
        };

        String impact = switch (level) {
            case "风险区" -> "末站供输裕度被压缩到边界以下，当前方案不宜按常规稳定工况处理。";
            case "预警区" -> "当前仍可运行，但调度弹性已经变窄，继续向不利区间偏移可能进入风险区。";
            case "安全区" -> "供输稳定性总体可控，但应持续监测末站压力降幅，防止连续扰动压缩安全边界。";
            default -> "缺少规则证据时，不应由 AI 自行给出稳定性风险结论。";
        };

        return RiskRule.builder()
                .riskCode("operation_stability_zone")
                .category("STABILITY")
                .title("运行稳定区判断")
                .targetName("当前方案")
                .level(level)
                .message(message)
                .impact(impact)
                .suggestion("建议将末站进站压力和压力变化率作为稳定性复核指标。")
                .evidence(evidence(
                        "variableType", result.getVariableType(),
                        "minEndStationPressure", metrics.minEndStationPressure,
                        "maxPressureDropPercent", metrics.maxPressureDropPercent,
                        "pressureTrend", metrics.pressureTrend,
                        "thresholds", Map.of("warningPressureDropPercent", PRESSURE_WARNING_DROP_THRESHOLD)
                ))
                .source("core_algorithm_rule")
                .build();
    }

    private RiskRule buildEquipmentRiskRule(VariableSensitivityResult result, SensitivityRiskMetrics metrics) {
        String level;
        if (metrics.pointCount == 0) {
            level = "数据不足";
        } else if (metrics.flowRegimeChanged || metrics.nonlinearGrowth) {
            level = "风险区";
        } else if (gte(metrics.sensitivityCoefficient, HIGH_LOAD_SENSITIVITY_THRESHOLD)) {
            level = "高负荷区";
        } else {
            level = "安全区";
        }

        String message;
        if ("风险区".equals(level)) {
            List<String> reasons = new ArrayList<>();
            if (metrics.flowRegimeChanged) {
                reasons.add("核心算法输出显示流态在采样区间发生切换："
                        + safeText(metrics.flowRegimeSegments, "未形成流态区间描述") + "。");
            }
            if (metrics.nonlinearGrowth) {
                reasons.add("摩阻变化在 " + safeText(metrics.nonlinearSegmentLabel, "当前采样区间")
                        + " 出现非线性放大，最大局部响应约为最小响应的 "
                        + formatNumber(metrics.nonlinearSlopeRatio, "") + " 倍。");
            }
            message = String.join("", reasons);
        } else if ("高负荷区".equals(level)) {
            message = "核心算法逐点计算显示，" + metrics.variableName
                    + "敏感系数为 " + formatNumber(metrics.sensitivityCoefficient, "")
                    + "，达到高负荷关注阈值 " + formatNumber(HIGH_LOAD_SENSITIVITY_THRESHOLD, "")
                    + "；虽然未出现流态切换或非线性放大，但设备余量会被持续占用。";
        } else if ("安全区".equals(level)) {
            message = "核心算法逐点计算显示，采样区间内未发生流态切换，且未识别出明显非线性放大；"
                    + metrics.variableName + "敏感系数为 " + formatNumber(metrics.sensitivityCoefficient, "")
                    + "，未达到高负荷关注阈值。";
        } else {
            message = "核心算法结果缺少有效采样点，暂不能完成设备边界区规则判断。";
        }

        String impact = switch (level) {
            case "风险区" -> "相同幅度的参数扰动不再可靠对应线性结果变化，容易导致误调度和泵组高负荷运行。";
            case "高负荷区" -> "设备可运行但不宜长期贴近高阻、高负荷带，否则泵效率下降和维护周期缩短会先于故障边界出现。";
            case "安全区" -> "设备侧仍有调节余度，但调度策略仍应避免大步长调整。";
            default -> "缺少规则证据时，不应由 AI 自行给出设备边界风险结论。";
        };

        return RiskRule.builder()
                .riskCode("equipment_boundary_zone")
                .category("EQUIPMENT")
                .title("设备边界区判断")
                .targetName("当前方案")
                .level(level)
                .message(message)
                .impact(impact)
                .suggestion("建议同步跟踪流态、雷诺数和局部摩阻响应，避免越过稳定采样窗口。")
                .evidence(evidence(
                        "variableType", result.getVariableType(),
                        "sensitivityCoefficient", metrics.sensitivityCoefficient,
                        "flowRegimeChanged", metrics.flowRegimeChanged,
                        "flowRegimeSegments", metrics.flowRegimeSegments,
                        "nonlinearGrowth", metrics.nonlinearGrowth,
                        "nonlinearSegmentLabel", metrics.nonlinearSegmentLabel,
                        "nonlinearSlopeRatio", metrics.nonlinearSlopeRatio,
                        "thresholds", Map.of("highLoadSensitivity", HIGH_LOAD_SENSITIVITY_THRESHOLD)
                ))
                .source("core_algorithm_rule")
                .build();
    }

    private List<DataPoint> sortedDataPoints(List<DataPoint> dataPoints) {
        if (dataPoints == null || dataPoints.isEmpty()) {
            return List.of();
        }
        return dataPoints.stream()
                .sorted(Comparator.comparing(
                        point -> point.getChangePercent() == null ? BigDecimal.ZERO : point.getChangePercent()))
                .toList();
    }

    private NonlinearRiskInfo analyzeNonlinearGrowth(List<DataPoint> points) {
        NonlinearRiskInfo info = new NonlinearRiskInfo();
        if (points.size() < 2) {
            return info;
        }

        List<SegmentSlope> slopes = new ArrayList<>();
        for (int i = 1; i < points.size(); i++) {
            DataPoint previous = points.get(i - 1);
            DataPoint current = points.get(i);
            BigDecimal start = previous.getChangePercent();
            BigDecimal end = current.getChangePercent();
            BigDecimal previousValue = previous.getFrictionChangePercent();
            BigDecimal currentValue = current.getFrictionChangePercent();
            if (start == null || end == null || previousValue == null || currentValue == null) {
                continue;
            }
            BigDecimal delta = end.subtract(start);
            if (delta.compareTo(BigDecimal.ZERO) == 0) {
                continue;
            }
            BigDecimal slope = currentValue.subtract(previousValue)
                    .divide(delta, SCALE, RoundingMode.HALF_UP)
                    .abs();
            slopes.add(new SegmentSlope(start, end, slope));
        }

        if (slopes.isEmpty()) {
            return info;
        }

        SegmentSlope maxSegment = slopes.stream()
                .max(Comparator.comparing(SegmentSlope::slope))
                .orElse(slopes.get(0));
        BigDecimal minPositiveSlope = null;
        int positiveCount = 0;
        for (SegmentSlope slope : slopes) {
            if (slope.slope().compareTo(NONLINEAR_SLOPE_MIN_THRESHOLD) > 0) {
                positiveCount++;
                if (minPositiveSlope == null || slope.slope().compareTo(minPositiveSlope) < 0) {
                    minPositiveSlope = slope.slope();
                }
            }
        }

        BigDecimal slopeRatio = BigDecimal.ONE;
        if (minPositiveSlope != null && minPositiveSlope.compareTo(BigDecimal.ZERO) > 0) {
            slopeRatio = maxSegment.slope().divide(minPositiveSlope, SCALE, RoundingMode.HALF_UP);
        }

        BigDecimal slopeDelta = minPositiveSlope == null ? BigDecimal.ZERO : maxSegment.slope().subtract(minPositiveSlope);
        info.hasNonlinearGrowth = positiveCount >= 2
                && slopeRatio.compareTo(NONLINEAR_SLOPE_RATIO_THRESHOLD) >= 0
                && slopeDelta.compareTo(NONLINEAR_SLOPE_DELTA_THRESHOLD) >= 0;
        info.segmentLabel = formatSignedPercent(maxSegment.start()) + " 至 " + formatSignedPercent(maxSegment.end());
        info.slopeRatio = slopeRatio;
        return info;
    }

    private String buildFlowRegimeSegments(List<DataPoint> points) {
        if (points.isEmpty()) {
            return "";
        }

        List<String> segments = new ArrayList<>();
        String currentRegime = safeText(points.get(0).getFlowRegime(), "-");
        String startLabel = formatChangeLabel(points.get(0));
        String endLabel = startLabel;

        for (int i = 1; i < points.size(); i++) {
            DataPoint point = points.get(i);
            String regime = safeText(point.getFlowRegime(), "-");
            String label = formatChangeLabel(point);
            if (regime.equals(currentRegime)) {
                endLabel = label;
                continue;
            }
            segments.add(startLabel + " 至 " + endLabel + " 为 " + currentRegime);
            currentRegime = regime;
            startLabel = label;
            endLabel = label;
        }

        segments.add(startLabel + " 至 " + endLabel + " 为 " + currentRegime);
        return String.join("；", segments);
    }

    private String resolveTrend(BigDecimal firstValue, BigDecimal lastValue) {
        if (firstValue == null || lastValue == null) {
            return "数据不足";
        }
        int compareResult = lastValue.compareTo(firstValue);
        if (compareResult > 0) {
            return "整体上升";
        }
        if (compareResult < 0) {
            return "整体下降";
        }
        return "变化不明显";
    }

    private boolean gte(BigDecimal value, BigDecimal threshold) {
        return value != null && value.compareTo(threshold) >= 0;
    }

    private String formatChangeLabel(DataPoint point) {
        if (point == null || point.getChangePercent() == null) {
            return "-";
        }
        return formatSignedPercent(point.getChangePercent());
    }

    private String formatSignedPercent(BigDecimal value) {
        if (value == null) {
            return "-";
        }
        return (value.compareTo(BigDecimal.ZERO) > 0 ? "+" : "") + formatNumber(value, "%");
    }

    private String formatNumber(BigDecimal value, String suffix) {
        if (value == null) {
            return "-";
        }
        BigDecimal normalized = value.stripTrailingZeros();
        if (normalized.scale() < 0) {
            normalized = normalized.setScale(0);
        }
        return normalized.toPlainString() + suffix;
    }

    private String safeText(String... candidates) {
        for (String candidate : candidates) {
            if (candidate != null && !candidate.isBlank()) {
                return candidate;
            }
        }
        return "";
    }

    private Map<String, Object> evidence(Object... entries) {
        Map<String, Object> evidence = new LinkedHashMap<>();
        for (int i = 0; i + 1 < entries.length; i += 2) {
            Object key = entries[i];
            if (key == null) {
                continue;
            }
            evidence.put(String.valueOf(key), entries[i + 1]);
        }
        return evidence;
    }

    private static final class SensitivityRiskMetrics {
        private String variableName;
        private int pointCount;
        private BigDecimal sensitivityCoefficient;
        private BigDecimal maxImpactPercent;
        private BigDecimal maxFrictionChangePercent;
        private BigDecimal maxFrictionIncreasePercent;
        private BigDecimal minPressureChangePercent;
        private BigDecimal maxPressureDropPercent;
        private BigDecimal minEndStationPressure;
        private DataPoint maxFrictionIncreasePoint;
        private DataPoint minPressurePoint;
        private boolean flowRegimeChanged;
        private String flowRegimeSegments;
        private boolean nonlinearGrowth;
        private String nonlinearSegmentLabel;
        private BigDecimal nonlinearSlopeRatio;
        private String pressureTrend = "数据不足";
        private String frictionTrend = "数据不足";
    }

    private static final class NonlinearRiskInfo {
        private boolean hasNonlinearGrowth;
        private String segmentLabel = "";
        private BigDecimal slopeRatio = BigDecimal.ONE;
    }

    private record SegmentSlope(BigDecimal start, BigDecimal end, BigDecimal slope) {
    }

    /**
     * 生成敏感性描述
     */
    private String generateSensitivityDescription(VariableSensitivityResult result) {
        BigDecimal coefficient = result.getSensitivityCoefficient();

        if (coefficient.compareTo(new BigDecimal("1.5")) > 0) {
            return "高敏感性：" + result.getVariableName() + "变化对结果影响显著";
        } else if (coefficient.compareTo(new BigDecimal("0.5")) > 0) {
            return "中敏感性：" + result.getVariableName() + "变化对结果有明显影响";
        } else {
            return "低敏感性：" + result.getVariableName() + "变化对结果影响较小";
        }
    }

    /**
     * 获取变量值
     */
    private BigDecimal getVariableValue(HydraulicAnalysisParams params, String variableType) {
        return switch (variableType) {
            case "FLOW_RATE" -> params.getFlowRate();
            case "OIL_DENSITY" -> params.getDensity();
            case "OIL_VISCOSITY" -> params.getViscosity();
            case "PIPE_DIAMETER" -> params.getDiameter();
            case "PIPE_ROUGHNESS" -> params.getRoughness();
            case "TEMPERATURE" -> BigDecimal.ZERO; // 需要温度-粘度换算
            case "PUMP_EFFICIENCY" -> BigDecimal.ZERO; // 需要扩展
            default -> BigDecimal.ZERO;
        };
    }

    /**
     * 克隆并修改参数
     */
    private HydraulicAnalysisParams cloneAndModifyParams(
            HydraulicAnalysisParams base, String variableType, BigDecimal changePercent) {
        HydraulicAnalysisParams params = cloneParams(base);
        modifyParamByPercent(params, variableType, changePercent);
        return params;
    }

    /**
     * 克隆参数
     */
    private HydraulicAnalysisParams cloneParams(HydraulicAnalysisParams base) {
        HydraulicAnalysisParams params = new HydraulicAnalysisParams();
        params.setPipelineId(base.getPipelineId());
        params.setOilId(base.getOilId());
        params.setFlowRate(base.getFlowRate());
        params.setDensity(base.getDensity());
        params.setViscosity(base.getViscosity());
        params.setLength(base.getLength());
        params.setDiameter(base.getDiameter());
        params.setThickness(base.getThickness());
        params.setRoughness(base.getRoughness());
        params.setStartAltitude(base.getStartAltitude());
        params.setEndAltitude(base.getEndAltitude());
        params.setInletPressure(base.getInletPressure());
        params.setPump480Num(base.getPump480Num());
        params.setPump375Num(base.getPump375Num());
        params.setPump480Head(base.getPump480Head());
        params.setPump375Head(base.getPump375Head());
        return params;
    }

    /**
     * 按百分比修改参数
     */
    private void modifyParamByPercent(HydraulicAnalysisParams params,
                                       String variableType, BigDecimal changePercent) {
        BigDecimal multiplier = BigDecimal.ONE.add(changePercent.divide(HUNDRED, SCALE, RoundingMode.HALF_UP));

        switch (variableType) {
            case "FLOW_RATE" -> params.setFlowRate(
                    params.getFlowRate().multiply(multiplier).setScale(SCALE, RoundingMode.HALF_UP));
            case "OIL_DENSITY" -> params.setDensity(
                    params.getDensity().multiply(multiplier).setScale(SCALE, RoundingMode.HALF_UP));
            case "OIL_VISCOSITY" -> params.setViscosity(
                    params.getViscosity().multiply(multiplier).setScale(SCALE, RoundingMode.HALF_UP));
            case "PIPE_DIAMETER" -> params.setDiameter(
                    params.getDiameter().multiply(multiplier).setScale(SCALE, RoundingMode.HALF_UP));
            case "PIPE_ROUGHNESS" -> params.setRoughness(
                    params.getRoughness().multiply(multiplier).setScale(SCALE, RoundingMode.HALF_UP));
            default -> log.warn("未知的变量类型: {}", variableType);
        }
    }

    /**
     * 计算变化百分比
     */
    private BigDecimal calculateChangePercent(BigDecimal base, BigDecimal current) {
        if (base == null || current == null || base.compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return current.subtract(base)
                .divide(base, SCALE, RoundingMode.HALF_UP)
                .multiply(HUNDRED)
                .setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * 判断趋势
     */
    private String determineTrend(List<DataPoint> dataPoints) {
        if (dataPoints.size() < 2) {
            return "UNKNOWN";
        }

        boolean allPositive = true;
        boolean allNegative = true;

        for (DataPoint point : dataPoints) {
            BigDecimal change = point.getFrictionChangePercent();
            BigDecimal percent = point.getChangePercent();

            // 判断变化方向是否一致
            boolean sameDirection = (change.compareTo(BigDecimal.ZERO) >= 0)
                    == (percent.compareTo(BigDecimal.ZERO) >= 0);

            if (!sameDirection) {
                allPositive = false;
            }
            if (sameDirection && change.compareTo(BigDecimal.ZERO) != 0) {
                allNegative = false;
            }
        }

        if (allPositive && !allNegative) {
            return "POSITIVE";
        } else if (allNegative && !allPositive) {
            return "NEGATIVE";
        } else {
            return "MIXED";
        }
    }

    @Override
    public String getType() {
        return STRATEGY_TYPE;
    }
}
