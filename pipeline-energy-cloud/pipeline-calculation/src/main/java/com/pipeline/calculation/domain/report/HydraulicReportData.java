package com.pipeline.calculation.domain.report;

import java.io.Serial;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 水力分析报告数据模型
 * <p>
 * 用于填充Word报告模板的数据结构，
 * 包含项目信息、管道参数、计算结果等。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HydraulicReportData implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    // ==================== 报告基本信息 ====================

    /**
     * 报告标题
     */
    private String title;

    /**
     * 报告编号
     */
    private String reportNo;

    /**
     * 生成日期
     */
    private String generateDate;

    /**
     * 生成人
     */
    private String generatedBy;

    // ==================== 项目信息 ====================

    /**
     * 项目名称
     */
    private String projectName;

    /**
     * 项目编号
     */
    private String projectNo;

    /**
     * 项目负责人
     */
    private String projectManager;

    // ==================== 管道参数 ====================

    /**
     * 管道长度（km）
     */
    private String pipelineLength;

    /**
     * 管道外径（mm）
     */
    private String outerDiameter;

    /**
     * 管道壁厚（mm）
     */
    private String wallThickness;

    /**
     * 管道内径（mm）
     */
    private String innerDiameter;

    /**
     * 起点高程（m）
     */
    private String startElevation;

    /**
     * 终点高程（m）
     */
    private String endElevation;

    /**
     * 高程差（m）
     */
    private String elevationDiff;

    /**
     * 管道粗糙度（mm）
     */
    private String roughness;

    // ==================== 油品参数 ====================

    /**
     * 油品名称
     */
    private String oilName;

    /**
     * 油品密度（kg/m³）
     */
    private String oilDensity;

    /**
     * 运动粘度（mm²/s）
     */
    private String oilViscosity;

    /**
     * 输送温度（°C）
     */
    private String temperature;

    // ==================== 运行参数 ====================

    /**
     * 设计流量（m³/h）
     */
    private String designFlowRate;

    /**
     * 首站进站压头（m）
     */
    private String inletPressure;

    /**
     * 泵配置描述
     */
    private String pumpConfiguration;

    /**
     * ZMI480泵数量
     */
    private Integer pump480Count;

    /**
     * ZMI375泵数量
     */
    private Integer pump375Count;

    // ==================== 计算结果 ====================

    /**
     * 雷诺数
     */
    private String reynoldsNumber;

    /**
     * 流态类型
     */
    private String flowRegime;

    /**
     * 流态说明
     */
    private String flowRegimeDesc;

    /**
     * 沿程摩阻（m）
     */
    private String frictionHeadLoss;

    /**
     * 水力坡降（m/km）
     */
    private String hydraulicSlope;

    /**
     * 总扬程（m）
     */
    private String totalHead;

    /**
     * 首站出站压力（MPa）
     */
    private String firstStationPressure;

    /**
     * 末站进站压力（MPa）
     */
    private String endStationPressure;

    // ==================== 敏感性分析结果（可选） ====================

    /**
     * 是否包含敏感性分析
     */
    private Boolean hasSensitivityAnalysis;

    /**
     * 敏感性分析数据
     */
    private List<SensitivityItem> sensitivityItems;

    /**
     * 敏感性排序描述
     */
    private String sensitivityRanking;

    // ==================== 结论与建议 ====================

    /**
     * 分析结论
     */
    private String conclusion;

    /**
     * 运行建议
     */
    private String recommendations;

    /**
     * 备注
     */
    private String remarks;

    /**
     * 敏感性分析数据项
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SensitivityItem implements Serializable {

        @Serial
        private static final long serialVersionUID = 1L;

        /**
         * 变量名称
         */
        private String variableName;

        /**
         * 变化范围
         */
        private String changeRange;

        /**
         * 敏感性系数
         */
        private String sensitivityCoefficient;

        /**
         * 影响描述
         */
        private String impactDescription;
    }

    /**
     * 创建默认报告数据
     *
     * @return 报告数据
     */
    public static HydraulicReportData createDefault() {
        return HydraulicReportData.builder()
                .title("水力分析报告")
                .reportNo("RPT-" + System.currentTimeMillis())
                .generateDate(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy年MM月dd日")))
                .build();
    }

    /**
     * 生成结论
     *
     * @param endPressure 末站压力
     * @return 结论文本
     */
    public static String generateConclusion(BigDecimal endPressure) {
        if (endPressure == null) {
            return "无法生成结论：缺少末站压力数据";
        }

        if (endPressure.compareTo(BigDecimal.ZERO) > 0) {
            return String.format("计算结果表明，在当前运行工况下，末站进站压力为%.2fMPa，" +
                    "大于0，管道运行安全可行。建议根据实际情况调整泵站运行参数以优化能耗。",
                    endPressure.doubleValue());
        } else {
            return String.format("警告：计算结果显示末站进站压力为%.2fMPa，小于0，" +
                    "表明当前运行方案不可行。建议增加泵站扬程或减小输送流量。",
                    endPressure.doubleValue());
        }
    }
}
