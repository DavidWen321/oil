package com.pipeline.calculation.service;

import java.util.List;

import com.baomidou.mybatisplus.extension.service.IService;
import com.pipeline.calculation.domain.HydraulicAnalysisParams;
import com.pipeline.calculation.domain.HydraulicAnalysisResult;
import com.pipeline.calculation.domain.entity.AnalysisReport;
import com.pipeline.calculation.domain.report.HydraulicReportData;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;

/**
 * 报告服务接口
 * <p>
 * 提供分析报告的生成、查询、下载等功能。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
public interface IReportService extends IService<AnalysisReport> {

    /**
     * 生成水力分析报告
     *
     * @param params   计算参数
     * @param result   计算结果
     * @param userId   用户ID
     * @param userName 用户名
     * @return 报告ID
     */
    Result<Long> generateHydraulicReport(
            HydraulicAnalysisParams params,
            HydraulicAnalysisResult result,
            Long userId,
            String userName);

    /**
     * 根据计算历史ID生成报告
     *
     * @param historyId 计算历史ID
     * @param userId    用户ID
     * @param userName  用户名
     * @return 报告ID
     */
    Result<Long> generateReportFromHistory(Long historyId, Long userId, String userName);

    /**
     * 获取报告详情
     *
     * @param id 报告ID
     * @return 报告信息
     */
    AnalysisReport getReportDetail(Long id);

    /**
     * 获取报告下载URL
     *
     * @param id 报告ID
     * @return 下载URL
     */
    Result<String> getDownloadUrl(Long id);

    /**
     * 获取报告内容（字节数组）
     *
     * @param id 报告ID
     * @return 报告字节数组
     */
    Result<byte[]> getReportContent(Long id);

    /**
     * 分页查询报告列表
     *
     * @param reportType 报告类型（可选）
     * @param projectId  项目ID（可选）
     * @param userId     用户ID（可选）
     * @param pageNum    页码
     * @param pageSize   每页大小
     * @return 分页结果
     */
    PageResult<AnalysisReport> queryReportPage(
            String reportType, Long projectId, Long userId,
            int pageNum, int pageSize);

    /**
     * 获取用户最近的报告
     *
     * @param userId 用户ID
     * @param limit  数量限制
     * @return 报告列表
     */
    List<AnalysisReport> getRecentReports(Long userId, int limit);

    /**
     * 删除报告
     *
     * @param id 报告ID
     * @return 是否成功
     */
    boolean deleteReport(Long id);

    /**
     * 构建报告数据
     *
     * @param params 计算参数
     * @param result 计算结果
     * @return 报告数据
     */
    HydraulicReportData buildReportData(HydraulicAnalysisParams params, HydraulicAnalysisResult result);
}
