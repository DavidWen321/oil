package com.pipeline.calculation.domain.dto;

import java.util.List;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 智能报告归档请求
 */
@Data
public class ReportHistoryCreateRequest {

    @NotBlank(message = "报告标题不能为空")
    private String title;

    private String reportType;

    private String reportTypeLabel;

    private List<Long> selectedProjectIds;

    private List<String> projectNames;

    private String rangeLabel;

    private String intelligenceLabel;

    private String outputFormat;

    private String sourceLabel;

    @NotNull(message = "报告结果不能为空")
    private Map<String, Object> result;
}
