package com.pipeline.calculation.domain;

import java.math.BigDecimal;

import lombok.Data;

/**
 * Input parameters for hydraulic analysis and quick sensitivity analysis.
 */
@Data
public class HydraulicAnalysisParams {

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

    private Integer pump480Num;

    private Integer pump375Num;

    private BigDecimal pump480Head;

    private BigDecimal pump375Head;
}
