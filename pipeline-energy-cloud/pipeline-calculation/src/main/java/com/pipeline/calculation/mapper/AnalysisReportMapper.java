package com.pipeline.calculation.mapper;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.pipeline.calculation.domain.entity.AnalysisReport;

/**
 * 分析报告 Mapper 接口
 * <p>
 * SQL 列名对齐 t_analysis_report (upgrade_v1.1.0.sql)
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Mapper
public interface AnalysisReportMapper extends BaseMapper<AnalysisReport> {

    @Select("SELECT COUNT(*) FROM t_analysis_report WHERE report_type = #{reportType}")
    long countByReportType(@Param("reportType") String reportType);

    @Select("SELECT * FROM t_analysis_report WHERE create_by = #{createBy} " +
            "ORDER BY create_time DESC LIMIT #{limit}")
    List<AnalysisReport> selectRecentByCreateBy(@Param("createBy") String createBy, @Param("limit") int limit);

    @Select("SELECT * FROM t_analysis_report WHERE pro_id = #{proId} " +
            "ORDER BY create_time DESC")
    List<AnalysisReport> selectByProId(@Param("proId") Long proId);
}
