package com.pipeline.calculation.service.impl;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

import org.springframework.stereotype.Service;

import com.pipeline.calculation.domain.carbon.*;
import com.pipeline.calculation.domain.carbon.CarbonCalculationRequest.StationEnergy;
import com.pipeline.calculation.domain.carbon.CarbonCalculationResult.*;
import com.pipeline.calculation.service.ICarbonCalculationService;

import lombok.extern.slf4j.Slf4j;

/**
 * 碳排放核算服务实现
 * <p>
 * 基于《企业温室气体排放核算方法与报告指南》实现，
 * 涵盖范围一（直接排放）、范围二（间接排放）、范围三（其他间接排放）。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Slf4j
@Service
public class CarbonCalculationServiceImpl implements ICarbonCalculationService {

    // ========== 电网排放因子 (kgCO2/kWh) - 2022年数据 ==========

    private static final Map<String, BigDecimal> GRID_EMISSION_FACTORS = Map.of(
            "NORTH", new BigDecimal("0.8843"),      // 华北电网
            "EAST", new BigDecimal("0.7921"),       // 华东电网
            "SOUTH", new BigDecimal("0.6379"),      // 南方电网
            "CENTRAL", new BigDecimal("0.5257"),    // 华中电网
            "NORTHWEST", new BigDecimal("0.8922"),  // 西北电网
            "NORTHEAST", new BigDecimal("0.8574"),  // 东北电网
            "DEFAULT", new BigDecimal("0.5839")     // 全国平均
    );

    // ========== 燃料排放因子 ==========

    /**
     * 天然气排放因子 (kgCO2/m³)
     */
    private static final BigDecimal NATURAL_GAS_FACTOR = new BigDecimal("2.1622");

    /**
     * 柴油排放因子 (kgCO2/L)
     */
    private static final BigDecimal DIESEL_FACTOR = new BigDecimal("2.6256");

    /**
     * 原油挥发CH4转CO2e因子
     */
    private static final BigDecimal VOLATILE_CH4_FACTOR = new BigDecimal("25");

    /**
     * 原油挥发基础因子 (kg CH4/吨原油)
     */
    private static final BigDecimal OIL_VOLATILE_BASE = new BigDecimal("0.5");

    // ========== 碳汇因子 ==========

    /**
     * 绿地碳汇因子 (kgCO2/m²/年)
     */
    private static final BigDecimal GREEN_AREA_SINK_FACTOR = new BigDecimal("2.5");

    /**
     * 行业平均排放强度 (kgCO2e/吨·公里)
     */
    private static final BigDecimal INDUSTRY_AVG_INTENSITY = new BigDecimal("0.015");

    /**
     * 碳市场参考价格 (元/tCO2e)
     */
    private static final BigDecimal CARBON_PRICE = new BigDecimal("70");

    @Override
    public CarbonCalculationResult calculate(CarbonCalculationRequest request) {
        log.info("开始碳排放核算，项目ID: {}, 周期: {} ~ {}",
                request.getProjectId(), request.getStartDate(), request.getEndDate());

        String calculationId = UUID.randomUUID().toString().replace("-", "");
        List<EmissionDetail> emissionDetails = new ArrayList<>();

        // 1. 计算范围一：直接排放
        BigDecimal scope1 = calculateScope1Emissions(request, emissionDetails);

        // 2. 计算范围二：间接排放（电力）
        BigDecimal scope2 = calculateScope2Emissions(request, emissionDetails);

        // 3. 计算范围三：其他间接排放
        BigDecimal scope3 = calculateScope3Emissions(request, emissionDetails);

        // 4. 计算碳汇
        BigDecimal carbonSink = calculateCarbonSink(request);

        // 5. 计算总排放和净排放
        BigDecimal totalEmission = scope1.add(scope2).add(scope3);
        BigDecimal netEmission = totalEmission.subtract(carbonSink);

        // 6. 计算排放强度
        BigDecimal emissionPerTon = calculateEmissionPerTon(totalEmission, request);
        BigDecimal emissionPerTonKm = calculateEmissionPerTonKm(totalEmission, request);
        BigDecimal emissionPerKwh = calculateEmissionPerKwh(totalEmission, request);

        // 7. 计算排放占比
        List<EmissionShare> shares = calculateEmissionShares(emissionDetails, totalEmission);

        // 8. 对标分析
        BigDecimal compareToIndustry = emissionPerTonKm.subtract(INDUSTRY_AVG_INTENSITY)
                .divide(INDUSTRY_AVG_INTENSITY, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));
        String emissionLevel = determineEmissionLevel(emissionPerTonKm);
        int carbonScore = calculateCarbonScore(emissionPerTonKm, compareToIndustry);

        // 9. 减排潜力分析
        ReductionPotential potential = analyzeReductionPotential(request, totalEmission);

        // 10. 减排建议
        List<ReductionSuggestion> suggestions = generateReductionSuggestions(request, emissionDetails);

        // 11. 碳配额分析
        CarbonQuota quota = calculateCarbonQuota(request, totalEmission);

        // 12. 核算方法说明
        String methodology = generateMethodologyNote(request);

        // 13. 排放因子映射
        Map<String, BigDecimal> factors = buildEmissionFactorsMap(request);

        return CarbonCalculationResult.builder()
                .calculationId(calculationId)
                .calculationTime(LocalDateTime.now())
                .projectId(request.getProjectId())
                .period(request.getPeriodType())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .totalEmission(totalEmission.setScale(4, RoundingMode.HALF_UP))
                .scope1Emission(scope1.setScale(4, RoundingMode.HALF_UP))
                .scope2Emission(scope2.setScale(4, RoundingMode.HALF_UP))
                .scope3Emission(scope3.setScale(4, RoundingMode.HALF_UP))
                .carbonSink(carbonSink.setScale(4, RoundingMode.HALF_UP))
                .netEmission(netEmission.setScale(4, RoundingMode.HALF_UP))
                .emissionPerTon(emissionPerTon.setScale(4, RoundingMode.HALF_UP))
                .emissionPerTonKm(emissionPerTonKm.setScale(6, RoundingMode.HALF_UP))
                .emissionPerKwh(emissionPerKwh.setScale(4, RoundingMode.HALF_UP))
                .emissionDetails(emissionDetails)
                .emissionShares(shares)
                .industryAvgIntensity(INDUSTRY_AVG_INTENSITY)
                .compareToIndustry(compareToIndustry.setScale(2, RoundingMode.HALF_UP))
                .emissionLevel(emissionLevel)
                .carbonScore(carbonScore)
                .reductionPotential(potential)
                .reductionSuggestions(suggestions)
                .carbonQuota(quota)
                .emissionFactors(factors)
                .methodologyNote(methodology)
                .dataQualityAssessment("数据质量等级：B级 - 基于活动数据和排放因子法核算")
                .build();
    }

    @Override
    public Map<String, Double> getGridEmissionFactors() {
        Map<String, Double> result = new HashMap<>();
        GRID_EMISSION_FACTORS.forEach((k, v) -> result.put(k, v.doubleValue()));
        return result;
    }

    @Override
    public Double getIndustryAverageIntensity() {
        return INDUSTRY_AVG_INTENSITY.doubleValue();
    }

    // ========== 范围一：直接排放计算 ==========

    private BigDecimal calculateScope1Emissions(CarbonCalculationRequest request,
                                                 List<EmissionDetail> details) {
        BigDecimal total = BigDecimal.ZERO;

        // 1. 天然气燃烧排放
        if (request.getNaturalGasConsumption() != null
                && request.getNaturalGasConsumption().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal gasEmission = request.getNaturalGasConsumption()
                    .multiply(NATURAL_GAS_FACTOR)
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);
            total = total.add(gasEmission);

            details.add(EmissionDetail.builder()
                    .source("天然气燃烧")
                    .scope("范围一")
                    .activityData(request.getNaturalGasConsumption())
                    .activityUnit("m³")
                    .emissionFactor(NATURAL_GAS_FACTOR)
                    .factorUnit("kgCO2/m³")
                    .emission(gasEmission)
                    .dataSource("企业计量数据")
                    .build());
        }

        // 2. 柴油燃烧排放
        if (request.getDieselConsumption() != null
                && request.getDieselConsumption().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal dieselEmission = request.getDieselConsumption()
                    .multiply(DIESEL_FACTOR)
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);
            total = total.add(dieselEmission);

            details.add(EmissionDetail.builder()
                    .source("柴油燃烧")
                    .scope("范围一")
                    .activityData(request.getDieselConsumption())
                    .activityUnit("L")
                    .emissionFactor(DIESEL_FACTOR)
                    .factorUnit("kgCO2/L")
                    .emission(dieselEmission)
                    .dataSource("企业计量数据")
                    .build());
        }

        // 3. 油品挥发逸散排放（甲烷）
        if (request.getOilThroughput() != null
                && request.getOilThroughput().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal volatileRate = request.getVolatileRate() != null
                    ? request.getVolatileRate().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                    : new BigDecimal("0.001");
            BigDecimal recoveryRate = request.getVaporRecoveryRate() != null
                    ? request.getVaporRecoveryRate().divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP)
                    : BigDecimal.ZERO;

            BigDecimal ch4Emission = request.getOilThroughput()
                    .multiply(OIL_VOLATILE_BASE)
                    .multiply(volatileRate)
                    .multiply(BigDecimal.ONE.subtract(recoveryRate))
                    .multiply(VOLATILE_CH4_FACTOR)
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);
            total = total.add(ch4Emission);

            details.add(EmissionDetail.builder()
                    .source("油品挥发逸散(CH4)")
                    .scope("范围一")
                    .activityData(request.getOilThroughput())
                    .activityUnit("吨")
                    .emissionFactor(OIL_VOLATILE_BASE.multiply(VOLATILE_CH4_FACTOR))
                    .factorUnit("kgCO2e/吨原油")
                    .emission(ch4Emission)
                    .dataSource("行业经验值")
                    .build());
        }

        return total;
    }

    // ========== 范围二：间接排放计算（电力） ==========

    private BigDecimal calculateScope2Emissions(CarbonCalculationRequest request,
                                                 List<EmissionDetail> details) {
        if (request.getElectricityConsumption() == null
                || request.getElectricityConsumption().compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // 获取电网排放因子
        String gridType = request.getGridType() != null ? request.getGridType() : "DEFAULT";
        BigDecimal gridFactor = GRID_EMISSION_FACTORS.getOrDefault(gridType,
                GRID_EMISSION_FACTORS.get("DEFAULT"));

        // 考虑绿电比例
        BigDecimal effectiveElectricity = request.getElectricityConsumption();
        if (Boolean.TRUE.equals(request.getUseGreenPower()) && request.getGreenPowerRatio() != null) {
            BigDecimal greenRatio = request.getGreenPowerRatio().divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP);
            effectiveElectricity = effectiveElectricity.multiply(BigDecimal.ONE.subtract(greenRatio));
        }

        BigDecimal electricityEmission = effectiveElectricity
                .multiply(gridFactor)
                .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);

        details.add(EmissionDetail.builder()
                .source("电力消耗")
                .scope("范围二")
                .activityData(effectiveElectricity)
                .activityUnit("kWh")
                .emissionFactor(gridFactor)
                .factorUnit("kgCO2/kWh")
                .emission(electricityEmission)
                .dataSource("电力计量 + " + gridType + "电网排放因子")
                .build());

        // 如果有光伏发电，计算避免的排放
        if (request.getSolarGeneration() != null
                && request.getSolarGeneration().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal solarOffset = request.getSolarGeneration()
                    .multiply(gridFactor)
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);

            details.add(EmissionDetail.builder()
                    .source("光伏发电抵消")
                    .scope("范围二抵消")
                    .activityData(request.getSolarGeneration())
                    .activityUnit("kWh")
                    .emissionFactor(gridFactor.negate())
                    .factorUnit("kgCO2/kWh")
                    .emission(solarOffset.negate())
                    .dataSource("光伏发电计量")
                    .build());

            electricityEmission = electricityEmission.subtract(solarOffset);
        }

        return electricityEmission;
    }

    // ========== 范围三：其他间接排放 ==========

    private BigDecimal calculateScope3Emissions(CarbonCalculationRequest request,
                                                 List<EmissionDetail> details) {
        // 范围三暂时简化处理，主要考虑上游能源生产的间接排放
        // 实际应包括：上游燃料开采、输配电损耗等
        BigDecimal scope3 = BigDecimal.ZERO;

        if (request.getElectricityConsumption() != null
                && request.getElectricityConsumption().compareTo(BigDecimal.ZERO) > 0) {
            // 输配电损耗约5%
            BigDecimal transmissionLoss = request.getElectricityConsumption()
                    .multiply(new BigDecimal("0.05"))
                    .multiply(GRID_EMISSION_FACTORS.get("DEFAULT"))
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);
            scope3 = scope3.add(transmissionLoss);

            details.add(EmissionDetail.builder()
                    .source("输配电损耗")
                    .scope("范围三")
                    .activityData(request.getElectricityConsumption().multiply(new BigDecimal("0.05")))
                    .activityUnit("kWh")
                    .emissionFactor(GRID_EMISSION_FACTORS.get("DEFAULT"))
                    .factorUnit("kgCO2/kWh")
                    .emission(transmissionLoss)
                    .dataSource("行业经验值(5%损耗率)")
                    .build());
        }

        return scope3;
    }

    // ========== 碳汇计算 ==========

    private BigDecimal calculateCarbonSink(CarbonCalculationRequest request) {
        BigDecimal sink = BigDecimal.ZERO;

        if (request.getGreenAreaSize() != null
                && request.getGreenAreaSize().compareTo(BigDecimal.ZERO) > 0) {
            // 计算核算周期天数
            long days = ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate()) + 1;
            BigDecimal yearFraction = new BigDecimal(days).divide(new BigDecimal("365"), 4, RoundingMode.HALF_UP);

            sink = request.getGreenAreaSize()
                    .multiply(GREEN_AREA_SINK_FACTOR)
                    .multiply(yearFraction)
                    .divide(new BigDecimal("1000"), 4, RoundingMode.HALF_UP);
        }

        return sink;
    }

    // ========== 排放强度计算 ==========

    private BigDecimal calculateEmissionPerTon(BigDecimal total, CarbonCalculationRequest request) {
        if (request.getOilThroughput() == null
                || request.getOilThroughput().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return total.multiply(new BigDecimal("1000"))
                .divide(request.getOilThroughput(), 4, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateEmissionPerTonKm(BigDecimal total, CarbonCalculationRequest request) {
        if (request.getOilThroughput() == null || request.getPipelineLength() == null
                || request.getOilThroughput().compareTo(BigDecimal.ZERO) == 0
                || request.getPipelineLength().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return total.multiply(new BigDecimal("1000"))
                .divide(request.getOilThroughput().multiply(request.getPipelineLength()), 6, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateEmissionPerKwh(BigDecimal total, CarbonCalculationRequest request) {
        if (request.getElectricityConsumption() == null
                || request.getElectricityConsumption().compareTo(BigDecimal.ZERO) == 0) {
            return BigDecimal.ZERO;
        }
        return total.multiply(new BigDecimal("1000"))
                .divide(request.getElectricityConsumption(), 4, RoundingMode.HALF_UP);
    }

    // ========== 排放占比计算 ==========

    private List<EmissionShare> calculateEmissionShares(List<EmissionDetail> details, BigDecimal total) {
        if (total.compareTo(BigDecimal.ZERO) == 0) {
            return Collections.emptyList();
        }

        return details.stream()
                .filter(d -> d.getEmission().compareTo(BigDecimal.ZERO) > 0)
                .map(d -> {
                    BigDecimal percent = d.getEmission()
                            .divide(total, 4, RoundingMode.HALF_UP)
                            .multiply(new BigDecimal("100"));
                    d.setSharePercent(percent);
                    return EmissionShare.builder()
                            .name(d.getSource())
                            .value(d.getEmission())
                            .percent(percent.setScale(2, RoundingMode.HALF_UP))
                            .build();
                })
                .sorted(Comparator.comparing(EmissionShare::getValue).reversed())
                .toList();
    }

    // ========== 排放等级判定 ==========

    private String determineEmissionLevel(BigDecimal intensity) {
        if (intensity.compareTo(new BigDecimal("0.010")) <= 0) return "A";
        if (intensity.compareTo(new BigDecimal("0.015")) <= 0) return "B";
        if (intensity.compareTo(new BigDecimal("0.020")) <= 0) return "C";
        return "D";
    }

    private int calculateCarbonScore(BigDecimal intensity, BigDecimal compare) {
        // 基础分60分，比行业平均低则加分，高则减分
        int base = 60;
        int adjustment = compare.negate().intValue(); // 低于行业平均为正
        adjustment = Math.max(-30, Math.min(40, adjustment)); // 限制范围
        return Math.max(0, Math.min(100, base + adjustment));
    }

    // ========== 减排潜力分析 ==========

    private ReductionPotential analyzeReductionPotential(CarbonCalculationRequest request, BigDecimal total) {
        BigDecimal energySaving = total.multiply(new BigDecimal("0.10")); // 假设节能10%
        BigDecimal greenPower = BigDecimal.ZERO;
        if (!Boolean.TRUE.equals(request.getUseGreenPower())) {
            greenPower = total.multiply(new BigDecimal("0.30")); // 绿电替代30%
        }
        BigDecimal processOpt = total.multiply(new BigDecimal("0.05")); // 工艺优化5%
        BigDecimal sinkIncrease = new BigDecimal("10"); // 增加碳汇

        BigDecimal totalPotential = energySaving.add(greenPower).add(processOpt).add(sinkIncrease);

        return ReductionPotential.builder()
                .totalPotential(totalPotential.setScale(4, RoundingMode.HALF_UP))
                .energySavingPotential(energySaving.setScale(4, RoundingMode.HALF_UP))
                .greenPowerPotential(greenPower.setScale(4, RoundingMode.HALF_UP))
                .processOptimizationPotential(processOpt.setScale(4, RoundingMode.HALF_UP))
                .carbonSinkPotential(sinkIncrease.setScale(4, RoundingMode.HALF_UP))
                .reductionCost(new BigDecimal("150")) // 元/tCO2e
                .build();
    }

    // ========== 减排建议生成 ==========

    private List<ReductionSuggestion> generateReductionSuggestions(CarbonCalculationRequest request,
                                                                    List<EmissionDetail> details) {
        List<ReductionSuggestion> suggestions = new ArrayList<>();
        int seq = 1;

        // 1. 电力优化建议
        suggestions.add(ReductionSuggestion.builder()
                .seq(seq++)
                .category("节能降耗")
                .suggestion("优化泵站运行组合，采用变频调速技术，降低节流损耗")
                .expectedReduction(new BigDecimal("500"))
                .investmentCost(new BigDecimal("100"))
                .paybackPeriod(new BigDecimal("2.5"))
                .difficulty("MEDIUM")
                .priority(1)
                .build());

        // 2. 绿电替代
        if (!Boolean.TRUE.equals(request.getUseGreenPower())) {
            suggestions.add(ReductionSuggestion.builder()
                    .seq(seq++)
                    .category("清洁能源")
                    .suggestion("购买绿色电力证书或签订绿电购买协议，提高清洁能源使用比例")
                    .expectedReduction(new BigDecimal("1000"))
                    .investmentCost(new BigDecimal("50"))
                    .paybackPeriod(new BigDecimal("1.0"))
                    .difficulty("LOW")
                    .priority(2)
                    .build());
        }

        // 3. 光伏发电
        suggestions.add(ReductionSuggestion.builder()
                .seq(seq++)
                .category("清洁能源")
                .suggestion("在站场屋顶及空地建设分布式光伏发电项目")
                .expectedReduction(new BigDecimal("300"))
                .investmentCost(new BigDecimal("200"))
                .paybackPeriod(new BigDecimal("5.0"))
                .difficulty("MEDIUM")
                .priority(3)
                .build());

        // 4. 油气回收
        if (request.getVaporRecoveryRate() == null
                || request.getVaporRecoveryRate().compareTo(new BigDecimal("95")) < 0) {
            suggestions.add(ReductionSuggestion.builder()
                    .seq(seq++)
                    .category("逸散控制")
                    .suggestion("升级油气回收系统，将回收率提升至95%以上")
                    .expectedReduction(new BigDecimal("50"))
                    .investmentCost(new BigDecimal("80"))
                    .paybackPeriod(new BigDecimal("3.0"))
                    .difficulty("MEDIUM")
                    .priority(4)
                    .build());
        }

        // 5. 碳汇增加
        suggestions.add(ReductionSuggestion.builder()
                .seq(seq++)
                .category("碳汇增加")
                .suggestion("在站场周边增加绿化面积，种植固碳能力强的树种")
                .expectedReduction(new BigDecimal("20"))
                .investmentCost(new BigDecimal("10"))
                .paybackPeriod(new BigDecimal("0"))
                .difficulty("LOW")
                .priority(5)
                .build());

        // 6. 数字化管理
        suggestions.add(ReductionSuggestion.builder()
                .seq(seq)
                .category("管理优化")
                .suggestion("建立碳排放监测管理系统，实时监控和优化能耗")
                .expectedReduction(new BigDecimal("100"))
                .investmentCost(new BigDecimal("30"))
                .paybackPeriod(new BigDecimal("1.5"))
                .difficulty("LOW")
                .priority(6)
                .build());

        return suggestions;
    }

    // ========== 碳配额计算 ==========

    private CarbonQuota calculateCarbonQuota(CarbonCalculationRequest request, BigDecimal currentEmission) {
        // 假设年度配额为当前排放的90%（模拟配额管控）
        long days = ChronoUnit.DAYS.between(request.getStartDate(), request.getEndDate()) + 1;
        BigDecimal yearFraction = new BigDecimal(days).divide(new BigDecimal("365"), 4, RoundingMode.HALF_UP);
        BigDecimal annualizedEmission = currentEmission.divide(yearFraction, 4, RoundingMode.HALF_UP);

        BigDecimal annualQuota = annualizedEmission.multiply(new BigDecimal("0.90"));
        BigDecimal usedQuota = currentEmission;
        BigDecimal quotaForPeriod = annualQuota.multiply(yearFraction);
        BigDecimal remaining = quotaForPeriod.subtract(usedQuota);

        BigDecimal usageRate = usedQuota.divide(quotaForPeriod, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"));

        BigDecimal projectedGap = remaining.negate(); // 缺口为正值
        BigDecimal tradingAmount = projectedGap.multiply(CARBON_PRICE)
                .divide(new BigDecimal("10000"), 4, RoundingMode.HALF_UP); // 万元

        return CarbonQuota.builder()
                .annualQuota(annualQuota.setScale(4, RoundingMode.HALF_UP))
                .usedQuota(usedQuota.setScale(4, RoundingMode.HALF_UP))
                .remainingQuota(remaining.setScale(4, RoundingMode.HALF_UP))
                .usageRate(usageRate.setScale(2, RoundingMode.HALF_UP))
                .projectedGap(projectedGap.setScale(4, RoundingMode.HALF_UP))
                .carbonPrice(CARBON_PRICE)
                .projectedTradingAmount(tradingAmount.abs().setScale(4, RoundingMode.HALF_UP))
                .build();
    }

    // ========== 核算方法说明 ==========

    private String generateMethodologyNote(CarbonCalculationRequest request) {
        StringBuilder sb = new StringBuilder();
        sb.append("本次核算采用《企业温室气体排放核算方法与报告指南》推荐的排放因子法。");
        sb.append("范围一排放包括天然气、柴油燃烧及油品挥发逸散；");
        sb.append("范围二排放采用");
        String gridType = request.getGridType() != null ? request.getGridType() : "全国平均";
        sb.append(gridType).append("电网排放因子计算；");
        sb.append("范围三考虑输配电损耗。");
        if (Boolean.TRUE.equals(request.getUseGreenPower())) {
            sb.append("已扣除绿电部分的排放。");
        }
        return sb.toString();
    }

    // ========== 排放因子映射 ==========

    private Map<String, BigDecimal> buildEmissionFactorsMap(CarbonCalculationRequest request) {
        Map<String, BigDecimal> factors = new LinkedHashMap<>();
        String gridType = request.getGridType() != null ? request.getGridType() : "DEFAULT";
        factors.put("电网排放因子(kgCO2/kWh)", GRID_EMISSION_FACTORS.get(gridType));
        factors.put("天然气排放因子(kgCO2/m³)", NATURAL_GAS_FACTOR);
        factors.put("柴油排放因子(kgCO2/L)", DIESEL_FACTOR);
        factors.put("甲烷GWP(CO2当量)", VOLATILE_CH4_FACTOR);
        factors.put("绿地碳汇因子(kgCO2/m²/年)", GREEN_AREA_SINK_FACTOR);
        return factors;
    }
}
