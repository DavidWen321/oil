package com.pipeline.calculation.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.pipeline.calculation.domain.comparison.*;
import com.pipeline.calculation.domain.comparison.ComparisonRequest.PumpConfig;
import com.pipeline.calculation.domain.comparison.ComparisonRequest.SchemeData;
import com.pipeline.calculation.domain.comparison.ComparisonResult.*;
import com.pipeline.calculation.service.ISchemeComparisonService;

import lombok.extern.slf4j.Slf4j;

/**
 * 多方案对比分析服务实现
 * <p>
 * 对多个运行方案进行能耗、成本、效率、安全性、碳排放等
 * 多维度对比分析，生成可视化数据和推荐结论。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Service
public class SchemeComparisonServiceImpl implements ISchemeComparisonService {

    /**
     * 碳排放因子 (kgCO2/kWh) - 国家电网平均排放因子
     */
    private static final BigDecimal CARBON_FACTOR = new BigDecimal("0.5839");

    /**
     * 每月天数（平均）
     */
    private static final BigDecimal DAYS_PER_MONTH = new BigDecimal("30");

    /**
     * 每年天数
     */
    private static final BigDecimal DAYS_PER_YEAR = new BigDecimal("365");

    /**
     * 默认电价 (元/kWh)
     */
    private static final BigDecimal DEFAULT_ELECTRICITY_PRICE = new BigDecimal("0.65");

    /**
     * 默认运行时间 (小时/天)
     */
    private static final BigDecimal DEFAULT_OPERATING_HOURS = new BigDecimal("24");

    @Override
    public ComparisonResult compare(ComparisonRequest request) {
        log.info("开始多方案对比分析，方案数: {}", request.getSchemes().size());

        String comparisonId = UUID.randomUUID().toString().replace("-", "");
        List<SchemeAnalysis> analyses = new ArrayList<>();

        // 1. 分析每个方案
        for (SchemeData scheme : request.getSchemes()) {
            SchemeAnalysis analysis = analyzeScheme(scheme, request);
            analyses.add(analysis);
        }

        // 2. 计算各方案评分（相对评分）
        calculateRelativeScores(analyses);

        // 3. 生成指标对比表
        Map<String, List<MetricValue>> metricsComparison = buildMetricsComparison(analyses);

        // 4. 生成雷达图数据
        RadarChartData radarChart = buildRadarChart(analyses);

        // 5. 生成柱状图数据
        List<BarChartData> barCharts = buildBarCharts(analyses);

        // 6. 计算综合排名
        List<RankingItem> ranking = calculateRanking(analyses);

        // 7. 生成推荐方案
        RecommendedScheme recommendation = generateRecommendation(analyses, ranking);

        // 8. 计算节能潜力
        EnergySavingPotential savingPotential = calculateSavingPotential(analyses);

        // 9. 生成结论
        String conclusion = generateConclusion(analyses, ranking);

        return ComparisonResult.builder()
                .comparisonId(comparisonId)
                .comparisonTime(LocalDateTime.now())
                .projectId(request.getProjectId())
                .pipelineId(request.getPipelineId())
                .schemeCount(request.getSchemes().size())
                .schemeAnalyses(analyses)
                .metricsComparison(metricsComparison)
                .radarChart(radarChart)
                .barCharts(barCharts)
                .overallRanking(ranking)
                .recommendation(recommendation)
                .savingPotential(savingPotential)
                .conclusion(conclusion)
                .build();
    }

    @Override
    public String[] getComparisonDimensions() {
        return new String[]{"ENERGY", "COST", "EFFICIENCY", "SAFETY", "CARBON"};
    }

    /**
     * 分析单个方案
     */
    private SchemeAnalysis analyzeScheme(SchemeData scheme, ComparisonRequest request) {
        BigDecimal operatingHours = scheme.getDailyOperatingHours() != null
                ? scheme.getDailyOperatingHours() : DEFAULT_OPERATING_HOURS;
        BigDecimal electricityPrice = scheme.getElectricityPrice() != null
                ? scheme.getElectricityPrice() : DEFAULT_ELECTRICITY_PRICE;

        // 计算总功率
        BigDecimal totalPower = calculateTotalPower(scheme.getPumpConfigs());

        // 计算能耗
        BigDecimal dailyEnergy = totalPower.multiply(operatingHours);
        BigDecimal monthlyEnergy = dailyEnergy.multiply(DAYS_PER_MONTH);
        BigDecimal yearlyEnergy = dailyEnergy.multiply(DAYS_PER_YEAR);

        // 计算成本
        BigDecimal dailyCost = dailyEnergy.multiply(electricityPrice);
        BigDecimal monthlyCost = monthlyEnergy.multiply(electricityPrice);
        BigDecimal yearlyCost = yearlyEnergy.multiply(electricityPrice);

        // 计算单位输量能耗 (kWh/t·km)
        // 假设管道长度100km（实际应从数据库获取）
        BigDecimal pipelineLength = new BigDecimal("100");
        BigDecimal density = scheme.getOilDensity() != null ? scheme.getOilDensity() : new BigDecimal("850");
        BigDecimal dailyThroughput = scheme.getFlowRate().multiply(operatingHours).multiply(density)
                .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP); // 转换为吨

        BigDecimal unitEnergy = dailyEnergy.divide(dailyThroughput.multiply(pipelineLength), 6, RoundingMode.HALF_UP);

        // 计算单位输送成本
        BigDecimal unitCost = dailyCost.divide(dailyThroughput, 4, RoundingMode.HALF_UP);

        // 计算效率
        BigDecimal avgPumpEff = calculateAveragePumpEfficiency(scheme.getPumpConfigs());
        BigDecimal systemEff = avgPumpEff.multiply(new BigDecimal("0.95")); // 考虑系统损耗

        // 计算水力参数
        BigDecimal frictionLoss = calculateFrictionLoss(scheme);
        BigDecimal hydraulicGradient = frictionLoss.multiply(new BigDecimal("1000"))
                .divide(pipelineLength, 4, RoundingMode.HALF_UP);

        // 计算雷诺数和流态
        BigDecimal viscosity = scheme.getOilViscosity() != null ? scheme.getOilViscosity() : new BigDecimal("20");
        BigDecimal diameter = new BigDecimal("0.508"); // 假设管径
        BigDecimal velocity = calculateVelocity(scheme.getFlowRate(), diameter);
        BigDecimal reynoldsNumber = calculateReynolds(velocity, diameter, viscosity);
        String flowRegime = determineFlowRegime(reynoldsNumber);

        // 计算安全裕度
        BigDecimal residualPressure = scheme.getOutletPressure() != null
                ? scheme.getOutletPressure() : scheme.getInletPressure().subtract(frictionLoss);
        BigDecimal minSafePressure = new BigDecimal("0.3");
        BigDecimal safetyMargin = residualPressure.subtract(minSafePressure)
                .divide(residualPressure, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));
        String pressureRisk = determinePressureRisk(residualPressure);

        // 计算碳排放
        BigDecimal yearlyCarbonEmission = yearlyEnergy.multiply(CARBON_FACTOR)
                .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP); // 转为tCO2
        BigDecimal unitCarbon = unitEnergy.multiply(CARBON_FACTOR);
        String carbonLevel = determineCarbonLevel(unitCarbon);

        // 分析优劣势
        List<String> advantages = new ArrayList<>();
        List<String> disadvantages = new ArrayList<>();

        if (avgPumpEff.compareTo(new BigDecimal("75")) >= 0) {
            advantages.add("泵站效率较高");
        } else {
            disadvantages.add("泵站效率偏低");
        }

        if (unitEnergy.compareTo(new BigDecimal("0.15")) <= 0) {
            advantages.add("单位能耗低");
        } else if (unitEnergy.compareTo(new BigDecimal("0.25")) > 0) {
            disadvantages.add("单位能耗偏高");
        }

        if (safetyMargin.compareTo(new BigDecimal("30")) >= 0) {
            advantages.add("安全裕度充足");
        } else if (safetyMargin.compareTo(new BigDecimal("10")) < 0) {
            disadvantages.add("安全裕度不足");
        }

        return SchemeAnalysis.builder()
                .schemeName(scheme.getSchemeName())
                .description(scheme.getDescription())
                .totalPower(totalPower)
                .dailyEnergyConsumption(dailyEnergy.setScale(2, RoundingMode.HALF_UP))
                .monthlyEnergyConsumption(monthlyEnergy.setScale(2, RoundingMode.HALF_UP))
                .yearlyEnergyConsumption(yearlyEnergy.setScale(2, RoundingMode.HALF_UP))
                .unitEnergyConsumption(unitEnergy.setScale(6, RoundingMode.HALF_UP))
                .dailyCost(dailyCost.setScale(2, RoundingMode.HALF_UP))
                .monthlyCost(monthlyCost.setScale(2, RoundingMode.HALF_UP))
                .yearlyCost(yearlyCost.setScale(2, RoundingMode.HALF_UP))
                .unitTransportCost(unitCost.setScale(4, RoundingMode.HALF_UP))
                .systemEfficiency(systemEff.setScale(2, RoundingMode.HALF_UP))
                .avgPumpEfficiency(avgPumpEff.setScale(2, RoundingMode.HALF_UP))
                .pipelineEfficiency(new BigDecimal("95.00"))
                .frictionLoss(frictionLoss.setScale(4, RoundingMode.HALF_UP))
                .hydraulicGradient(hydraulicGradient.setScale(4, RoundingMode.HALF_UP))
                .reynoldsNumber(reynoldsNumber.setScale(0, RoundingMode.HALF_UP))
                .flowRegime(flowRegime)
                .residualPressure(residualPressure.setScale(4, RoundingMode.HALF_UP))
                .safetyMargin(safetyMargin.setScale(2, RoundingMode.HALF_UP))
                .pressureRiskLevel(pressureRisk)
                .yearlyCarbonEmission(yearlyCarbonEmission.setScale(4, RoundingMode.HALF_UP))
                .unitCarbonEmission(unitCarbon.setScale(6, RoundingMode.HALF_UP))
                .carbonLevel(carbonLevel)
                .advantages(advantages)
                .disadvantages(disadvantages)
                .build();
    }

    /**
     * 计算相对评分
     */
    private void calculateRelativeScores(List<SchemeAnalysis> analyses) {
        if (analyses.isEmpty()) return;

        // 找出各指标的最优值
        BigDecimal minEnergy = analyses.stream()
                .map(SchemeAnalysis::getUnitEnergyConsumption)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        BigDecimal minCost = analyses.stream()
                .map(SchemeAnalysis::getYearlyCost)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        BigDecimal maxEfficiency = analyses.stream()
                .map(SchemeAnalysis::getSystemEfficiency)
                .max(BigDecimal::compareTo).orElse(new BigDecimal("100"));
        BigDecimal maxSafety = analyses.stream()
                .map(SchemeAnalysis::getSafetyMargin)
                .max(BigDecimal::compareTo).orElse(new BigDecimal("100"));
        BigDecimal minCarbon = analyses.stream()
                .map(SchemeAnalysis::getUnitCarbonEmission)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ONE);

        for (SchemeAnalysis analysis : analyses) {
            // 能耗评分（越低越好）
            int energyScore = calculateScore(minEnergy, analysis.getUnitEnergyConsumption(), true);
            // 成本评分（越低越好）
            int costScore = calculateScore(minCost, analysis.getYearlyCost(), true);
            // 效率评分（越高越好）
            int efficiencyScore = calculateScore(maxEfficiency, analysis.getSystemEfficiency(), false);
            // 安全评分（越高越好）
            int safetyScore = calculateScore(maxSafety, analysis.getSafetyMargin(), false);
            // 环保评分（越低越好）
            int environmentScore = calculateScore(minCarbon, analysis.getUnitCarbonEmission(), true);

            analysis.setEnergyScore(energyScore);
            analysis.setCostScore(costScore);
            analysis.setEfficiencyScore(efficiencyScore);
            analysis.setSafetyScore(safetyScore);
            analysis.setEnvironmentScore(environmentScore);

            // 综合评分（加权平均）
            int overallScore = (int) Math.round(
                    energyScore * 0.25 +
                    costScore * 0.25 +
                    efficiencyScore * 0.20 +
                    safetyScore * 0.15 +
                    environmentScore * 0.15
            );
            analysis.setOverallScore(overallScore);
        }
    }

    private int calculateScore(BigDecimal best, BigDecimal current, boolean lowerIsBetter) {
        if (best.compareTo(BigDecimal.ZERO) == 0) return 100;

        BigDecimal ratio;
        if (lowerIsBetter) {
            ratio = best.divide(current, 4, RoundingMode.HALF_UP);
        } else {
            ratio = current.divide(best, 4, RoundingMode.HALF_UP);
        }

        int score = ratio.multiply(new BigDecimal("100")).intValue();
        return Math.max(0, Math.min(100, score));
    }

    /**
     * 构建指标对比表
     */
    private Map<String, List<MetricValue>> buildMetricsComparison(List<SchemeAnalysis> analyses) {
        Map<String, List<MetricValue>> comparison = new LinkedHashMap<>();

        // 能耗对比
        comparison.put("日耗电量", buildMetricValues(analyses, "dailyEnergy", "kWh", true));
        comparison.put("年耗电量", buildMetricValues(analyses, "yearlyEnergy", "kWh", true));
        comparison.put("单位能耗", buildMetricValues(analyses, "unitEnergy", "kWh/t·km", true));

        // 成本对比
        comparison.put("年运行成本", buildMetricValues(analyses, "yearlyCost", "元", true));
        comparison.put("单位输送成本", buildMetricValues(analyses, "unitCost", "元/吨", true));

        // 效率对比
        comparison.put("系统效率", buildMetricValues(analyses, "systemEfficiency", "%", false));
        comparison.put("泵站效率", buildMetricValues(analyses, "pumpEfficiency", "%", false));

        // 安全对比
        comparison.put("安全裕度", buildMetricValues(analyses, "safetyMargin", "%", false));

        // 碳排放对比
        comparison.put("年碳排放", buildMetricValues(analyses, "yearlyCarbon", "tCO2", true));

        return comparison;
    }

    private List<MetricValue> buildMetricValues(List<SchemeAnalysis> analyses, String metricType,
                                                 String unit, boolean lowerIsBetter) {
        List<MetricValue> values = new ArrayList<>();

        BigDecimal bestValue = null;
        for (SchemeAnalysis a : analyses) {
            BigDecimal val = getMetricValue(a, metricType);
            if (bestValue == null) {
                bestValue = val;
            } else if (lowerIsBetter && val.compareTo(bestValue) < 0) {
                bestValue = val;
            } else if (!lowerIsBetter && val.compareTo(bestValue) > 0) {
                bestValue = val;
            }
        }

        for (SchemeAnalysis a : analyses) {
            BigDecimal val = getMetricValue(a, metricType);
            boolean isBest = val.compareTo(bestValue) == 0;
            BigDecimal diff = BigDecimal.ZERO;
            if (bestValue.compareTo(BigDecimal.ZERO) != 0) {
                diff = val.subtract(bestValue).divide(bestValue, 4, RoundingMode.HALF_UP)
                        .multiply(new BigDecimal("100"));
            }

            values.add(MetricValue.builder()
                    .schemeName(a.getSchemeName())
                    .value(val)
                    .unit(unit)
                    .isBest(isBest)
                    .diffPercent(diff.setScale(2, RoundingMode.HALF_UP))
                    .build());
        }

        return values;
    }

    private BigDecimal getMetricValue(SchemeAnalysis a, String type) {
        return switch (type) {
            case "dailyEnergy" -> a.getDailyEnergyConsumption();
            case "yearlyEnergy" -> a.getYearlyEnergyConsumption();
            case "unitEnergy" -> a.getUnitEnergyConsumption();
            case "yearlyCost" -> a.getYearlyCost();
            case "unitCost" -> a.getUnitTransportCost();
            case "systemEfficiency" -> a.getSystemEfficiency();
            case "pumpEfficiency" -> a.getAvgPumpEfficiency();
            case "safetyMargin" -> a.getSafetyMargin();
            case "yearlyCarbon" -> a.getYearlyCarbonEmission();
            default -> BigDecimal.ZERO;
        };
    }

    /**
     * 构建雷达图数据
     */
    private RadarChartData buildRadarChart(List<SchemeAnalysis> analyses) {
        List<String> dimensions = List.of("能耗", "成本", "效率", "安全", "环保");

        List<RadarSeries> series = analyses.stream()
                .map(a -> RadarSeries.builder()
                        .name(a.getSchemeName())
                        .values(List.of(
                                a.getEnergyScore(),
                                a.getCostScore(),
                                a.getEfficiencyScore(),
                                a.getSafetyScore(),
                                a.getEnvironmentScore()
                        ))
                        .build())
                .collect(Collectors.toList());

        return RadarChartData.builder()
                .dimensions(dimensions)
                .series(series)
                .build();
    }

    /**
     * 构建柱状图数据
     */
    private List<BarChartData> buildBarCharts(List<SchemeAnalysis> analyses) {
        List<BarChartData> charts = new ArrayList<>();

        // 年运行成本对比
        BigDecimal minCost = analyses.stream()
                .map(SchemeAnalysis::getYearlyCost)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        charts.add(BarChartData.builder()
                .metricName("年运行成本")
                .unit("万元")
                .items(analyses.stream()
                        .map(a -> BarItem.builder()
                                .schemeName(a.getSchemeName())
                                .value(a.getYearlyCost().divide(new BigDecimal("10000"), 2, RoundingMode.HALF_UP))
                                .isBest(a.getYearlyCost().compareTo(minCost) == 0)
                                .build())
                        .collect(Collectors.toList()))
                .build());

        // 年碳排放对比
        BigDecimal minCarbon = analyses.stream()
                .map(SchemeAnalysis::getYearlyCarbonEmission)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ONE);
        charts.add(BarChartData.builder()
                .metricName("年碳排放")
                .unit("tCO2")
                .items(analyses.stream()
                        .map(a -> BarItem.builder()
                                .schemeName(a.getSchemeName())
                                .value(a.getYearlyCarbonEmission())
                                .isBest(a.getYearlyCarbonEmission().compareTo(minCarbon) == 0)
                                .build())
                        .collect(Collectors.toList()))
                .build());

        return charts;
    }

    /**
     * 计算综合排名
     */
    private List<RankingItem> calculateRanking(List<SchemeAnalysis> analyses) {
        List<SchemeAnalysis> sorted = analyses.stream()
                .sorted(Comparator.comparingInt(SchemeAnalysis::getOverallScore).reversed())
                .collect(Collectors.toList());

        List<RankingItem> ranking = new ArrayList<>();
        for (int i = 0; i < sorted.size(); i++) {
            SchemeAnalysis a = sorted.get(i);
            Map<String, Integer> dimensionScores = new LinkedHashMap<>();
            dimensionScores.put("能耗", a.getEnergyScore());
            dimensionScores.put("成本", a.getCostScore());
            dimensionScores.put("效率", a.getEfficiencyScore());
            dimensionScores.put("安全", a.getSafetyScore());
            dimensionScores.put("环保", a.getEnvironmentScore());

            String comment = generateComment(a, i + 1);

            ranking.add(RankingItem.builder()
                    .rank(i + 1)
                    .schemeName(a.getSchemeName())
                    .score(a.getOverallScore())
                    .dimensionScores(dimensionScores)
                    .comment(comment)
                    .build());
        }

        return ranking;
    }

    private String generateComment(SchemeAnalysis a, int rank) {
        if (rank == 1) {
            return "综合表现最优，推荐采用";
        } else if (a.getOverallScore() >= 80) {
            return "表现良好，可作为备选方案";
        } else if (a.getOverallScore() >= 60) {
            return "表现一般，存在优化空间";
        } else {
            return "表现较差，不建议采用";
        }
    }

    /**
     * 生成推荐方案
     */
    private RecommendedScheme generateRecommendation(List<SchemeAnalysis> analyses, List<RankingItem> ranking) {
        if (ranking.isEmpty()) return null;

        RankingItem best = ranking.get(0);
        SchemeAnalysis bestAnalysis = analyses.stream()
                .filter(a -> a.getSchemeName().equals(best.getSchemeName()))
                .findFirst().orElse(null);

        if (bestAnalysis == null) return null;

        // 计算与最差方案的差异作为预期收益
        SchemeAnalysis worstAnalysis = analyses.stream()
                .min(Comparator.comparingInt(SchemeAnalysis::getOverallScore))
                .orElse(bestAnalysis);

        BigDecimal savingEnergy = worstAnalysis.getYearlyEnergyConsumption()
                .subtract(bestAnalysis.getYearlyEnergyConsumption());
        BigDecimal savingCost = worstAnalysis.getYearlyCost()
                .subtract(bestAnalysis.getYearlyCost());
        BigDecimal carbonReduction = worstAnalysis.getYearlyCarbonEmission()
                .subtract(bestAnalysis.getYearlyCarbonEmission());

        List<String> reasons = new ArrayList<>();
        if (bestAnalysis.getEnergyScore() >= 90) reasons.add("能耗表现优秀，单位能耗最低");
        if (bestAnalysis.getCostScore() >= 90) reasons.add("运行成本最低，经济性最优");
        if (bestAnalysis.getEfficiencyScore() >= 90) reasons.add("系统效率最高");
        if (bestAnalysis.getSafetyScore() >= 90) reasons.add("安全裕度充足");
        if (bestAnalysis.getEnvironmentScore() >= 90) reasons.add("碳排放最低，环保性最好");

        if (reasons.isEmpty()) {
            reasons.add("综合各项指标表现最均衡");
        }

        List<String> suggestions = List.of(
                "建议按此方案调整泵站运行组合",
                "持续监测运行参数，确保方案效果",
                "定期评估方案执行情况，及时优化调整"
        );

        int level = bestAnalysis.getOverallScore() >= 90 ? 5 :
                   bestAnalysis.getOverallScore() >= 80 ? 4 :
                   bestAnalysis.getOverallScore() >= 70 ? 3 : 2;

        return RecommendedScheme.builder()
                .schemeName(best.getSchemeName())
                .reasons(reasons)
                .recommendationLevel(level)
                .implementationSuggestions(suggestions)
                .expectedBenefit(ExpectedBenefit.builder()
                        .yearlySavingEnergy(savingEnergy.setScale(2, RoundingMode.HALF_UP))
                        .yearlySavingCost(savingCost.setScale(2, RoundingMode.HALF_UP))
                        .yearlyCarbonReduction(carbonReduction.setScale(4, RoundingMode.HALF_UP))
                        .build())
                .build();
    }

    /**
     * 计算节能潜力
     */
    private EnergySavingPotential calculateSavingPotential(List<SchemeAnalysis> analyses) {
        if (analyses.size() < 2) return null;

        BigDecimal maxEnergy = analyses.stream()
                .map(SchemeAnalysis::getYearlyEnergyConsumption)
                .max(BigDecimal::compareTo).orElse(BigDecimal.ZERO);
        BigDecimal minEnergy = analyses.stream()
                .map(SchemeAnalysis::getYearlyEnergyConsumption)
                .min(BigDecimal::compareTo).orElse(BigDecimal.ZERO);

        BigDecimal gap = maxEnergy.subtract(minEnergy);
        BigDecimal ratio = BigDecimal.ZERO;
        if (maxEnergy.compareTo(BigDecimal.ZERO) > 0) {
            ratio = gap.divide(maxEnergy, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
        }

        BigDecimal economicPotential = gap.multiply(DEFAULT_ELECTRICITY_PRICE);

        List<String> measures = new ArrayList<>();
        measures.add("优化泵组合运行，减少节流损失");
        measures.add("采用变频调速技术，提升调节灵活性");
        measures.add("定期清管，降低沿程摩阻");
        measures.add("合理安排输送批次，提高负荷率");

        return EnergySavingPotential.builder()
                .energyGap(gap.setScale(2, RoundingMode.HALF_UP))
                .savingRatio(ratio.setScale(2, RoundingMode.HALF_UP))
                .yearlyPotential(gap.setScale(2, RoundingMode.HALF_UP))
                .yearlyEconomicPotential(economicPotential.setScale(2, RoundingMode.HALF_UP))
                .savingMeasures(measures)
                .build();
    }

    /**
     * 生成对比结论
     */
    private String generateConclusion(List<SchemeAnalysis> analyses, List<RankingItem> ranking) {
        if (ranking.isEmpty()) return "无法生成结论，请检查输入数据";

        RankingItem best = ranking.get(0);
        StringBuilder sb = new StringBuilder();
        sb.append("本次共对比分析了 ").append(analyses.size()).append(" 个运行方案。");
        sb.append("综合评估结果显示，\"").append(best.getSchemeName()).append("\"方案表现最优，");
        sb.append("综合得分 ").append(best.getScore()).append(" 分。");

        if (ranking.size() > 1) {
            int scoreDiff = best.getScore() - ranking.get(ranking.size() - 1).getScore();
            sb.append("与最差方案相比，综合评分高出 ").append(scoreDiff).append(" 分。");
        }

        sb.append("建议优先采用推荐方案实施。");

        return sb.toString();
    }

    // ========== 辅助计算方法 ==========

    private BigDecimal calculateTotalPower(List<PumpConfig> configs) {
        if (configs == null || configs.isEmpty()) {
            return new BigDecimal("1000"); // 默认功率
        }
        return configs.stream()
                .filter(c -> c.getPumpPower() != null && c.getRunningPumpCount() != null)
                .map(c -> c.getPumpPower().multiply(new BigDecimal(c.getRunningPumpCount())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal calculateAveragePumpEfficiency(List<PumpConfig> configs) {
        if (configs == null || configs.isEmpty()) {
            return new BigDecimal("75"); // 默认效率
        }
        return configs.stream()
                .filter(c -> c.getPumpEfficiency() != null)
                .map(PumpConfig::getPumpEfficiency)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(new BigDecimal(configs.size()), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateFrictionLoss(SchemeData scheme) {
        // 简化的摩阻计算
        BigDecimal flowRate = scheme.getFlowRate();
        BigDecimal viscosity = scheme.getOilViscosity() != null ? scheme.getOilViscosity() : new BigDecimal("20");

        // 摩阻与流量平方成正比，与粘度成正比
        return flowRate.pow(2).multiply(viscosity)
                .divide(new BigDecimal("100000000"), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateVelocity(BigDecimal flowRate, BigDecimal diameter) {
        // v = Q / (π * D² / 4)
        BigDecimal area = diameter.pow(2).multiply(new BigDecimal("3.14159"))
                .divide(new BigDecimal("4"), 6, RoundingMode.HALF_UP);
        return flowRate.divide(new BigDecimal("3600"), 6, RoundingMode.HALF_UP)
                .divide(area, 4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateReynolds(BigDecimal velocity, BigDecimal diameter, BigDecimal viscosity) {
        // Re = v * D / ν
        return velocity.multiply(diameter)
                .divide(viscosity.divide(new BigDecimal("1000000"), 10, RoundingMode.HALF_UP), 0, RoundingMode.HALF_UP);
    }

    private String determineFlowRegime(BigDecimal re) {
        if (re.compareTo(new BigDecimal("2300")) < 0) return "层流";
        if (re.compareTo(new BigDecimal("4000")) < 0) return "过渡区";
        return "紊流";
    }

    private String determinePressureRisk(BigDecimal pressure) {
        if (pressure.compareTo(new BigDecimal("0.5")) >= 0) return "低风险";
        if (pressure.compareTo(new BigDecimal("0.3")) >= 0) return "中风险";
        return "高风险";
    }

    private String determineCarbonLevel(BigDecimal unitCarbon) {
        if (unitCarbon.compareTo(new BigDecimal("0.1")) <= 0) return "低碳";
        if (unitCarbon.compareTo(new BigDecimal("0.15")) <= 0) return "中碳";
        return "高碳";
    }
}
