package com.pipeline.calculation.domain.entity;

import java.io.Serial;
import java.io.Serializable;
import java.time.LocalDateTime;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * 分析报告实体类
 * <p>
 * 对齐 t_analysis_report 表结构 (upgrade_v1.1.0.sql)
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Data
@TableName("t_analysis_report")
public class AnalysisReport implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("pro_id")
    private Long proId;

    @TableField("pipeline_id")
    private Long pipelineId;

    private String reportNo;

    private String reportType;

    private String reportTitle;

    private String reportSummary;

    private String fileName;

    private String filePath;

    private String fileFormat;

    private Long fileSize;

    private String historyIds;

    private Integer status;

    private String errorMsg;

    private String createBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    // ==================== 状态常量 ====================

    public static final int STATUS_GENERATING = 0;
    public static final int STATUS_COMPLETED = 1;
    public static final int STATUS_FAILED = 2;

    // ==================== 格式常量 ====================

    public static final String FORMAT_DOCX = "DOCX";
    public static final String FORMAT_PDF = "PDF";
    public static final String FORMAT_HTML = "HTML";
}
