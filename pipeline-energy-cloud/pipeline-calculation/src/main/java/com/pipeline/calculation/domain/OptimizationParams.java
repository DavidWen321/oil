package com.pipeline.calculation.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

import lombok.Data;

/**
 * Input parameters for pump station optimization.
 */
@Data
public class OptimizationParams {

    private Long projectId;

    private Long pipelineId;

    private String pipelineName;

    private Long oilId;

    private String oilName;

    private Long pumpStationId;

    private String pumpStationName;

    private BigDecimal flowRate;

    private BigDecimal density;

    private BigDecimal viscosity;

    private BigDecimal length;

    private BigDecimal diameter;

    private BigDecimal thickness;

    private BigDecimal roughness;

    private BigDecimal startAltitude;

    private BigDecimal endAltitude;

    private BigDecimal inletPressure;

    private BigDecimal pump480Head;

    private BigDecimal pump375Head;

    private BigDecimal pumpEfficiency;

    private BigDecimal motorEfficiency;

    private BigDecimal workingDays;

    private BigDecimal electricityPrice;

    public BigDecimal getWorkingDays() {
        if (workingDays == null) {
            return new BigDecimal("350");
        }
        return workingDays;
    }

    public BigDecimal getPumpEfficiency() {
        if (pumpEfficiency == null) {
            return new BigDecimal("0.80");
        }
        return pumpEfficiency;
    }

    public BigDecimal getMotorEfficiency() {
        if (motorEfficiency == null) {
            return new BigDecimal("0.95");
        }
        return motorEfficiency;
    }

    public BigDecimal getElectricityPrice() {
        if (electricityPrice == null) {
            return new BigDecimal("0.8");
        }
        return electricityPrice;
    }

    public BigDecimal getMassFlowRate() {
        if (flowRate == null || density == null) {
            return BigDecimal.ZERO;
        }
        return flowRate.multiply(density).divide(new BigDecimal("3600"), 8, RoundingMode.HALF_UP);
    }
}
