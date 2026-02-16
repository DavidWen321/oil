package com.pipeline.calculation.controller;

import java.util.List;

import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pipeline.calculation.domain.dto.CalculationHistoryQuery;
import com.pipeline.calculation.domain.vo.CalculationHistoryVO;
import com.pipeline.calculation.service.ICalculationHistoryService;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;

/**
 * 计算历史控制器
 * <p>
 * 提供计算历史记录的查询、删除等RESTful API接口。
 * </p>
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Tag(name = "计算历史", description = "计算历史记录的查询和管理接口")
@Validated
@RestController
@RequestMapping("/calculation/history")
@RequiredArgsConstructor
public class CalculationHistoryController {

    private final ICalculationHistoryService calculationHistoryService;

    /**
     * 分页查询计算历史
     *
     * @param query 查询参数
     * @return 分页结果
     */
    @Operation(summary = "分页查询计算历史", description = "支持按计算类型、项目、用户、状态、时间等条件筛选")
    @GetMapping("/page")
    public Result<PageResult<CalculationHistoryVO>> queryPage(CalculationHistoryQuery query) {
        PageResult<CalculationHistoryVO> result = calculationHistoryService.queryPage(query);
        return Result.ok(result);
    }

    /**
     * 查询计算历史详情
     *
     * @param id 记录ID
     * @return 历史详情
     */
    @Operation(summary = "查询计算历史详情", description = "根据记录ID获取详细的计算历史信息")
    @GetMapping("/{id}")
    public Result<CalculationHistoryVO> getDetail(
            @PathVariable("id") @NotNull(message = "记录ID不能为空") Long id) {
        CalculationHistoryVO detail = calculationHistoryService.getDetail(id);
        return Result.ok(detail);
    }

    /**
     * 获取当前用户最近的计算记录
     *
     * @param userId 用户ID（可选，不传则使用当前登录用户）
     * @param limit  数量限制（默认10条）
     * @return 计算历史列表
     */
    @Operation(summary = "获取最近计算记录", description = "获取当前用户最近的计算历史记录")
    @GetMapping("/recent")
    public Result<List<CalculationHistoryVO>> getRecentHistory(
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "limit", required = false, defaultValue = "10") Integer limit) {
        // TODO: 如果userId为空，从安全上下文获取当前用户ID
        if (userId == null) {
            userId = 1L; // 临时默认值，待集成Sa-Token后修改
        }
        List<CalculationHistoryVO> histories = calculationHistoryService.getRecentByUser(userId, limit);
        return Result.ok(histories);
    }

    /**
     * 查询指定项目的计算历史
     *
     * @param projectId 项目ID
     * @param query     分页参数
     * @return 分页结果
     */
    @Operation(summary = "查询项目计算历史", description = "分页查询指定项目的计算历史")
    @GetMapping("/project/{projectId}")
    public Result<PageResult<CalculationHistoryVO>> getByProject(
            @PathVariable("projectId") @NotNull(message = "项目ID不能为空") Long projectId,
            CalculationHistoryQuery query) {
        PageResult<CalculationHistoryVO> result = calculationHistoryService.getByProject(projectId, query);
        return Result.ok(result);
    }

    /**
     * 删除计算历史记录
     *
     * @param id 记录ID
     * @return 操作结果
     */
    @Operation(summary = "删除计算历史", description = "根据ID删除单条计算历史记录")
    @DeleteMapping("/{id}")
    public Result<Void> deleteHistory(
            @PathVariable("id") @NotNull(message = "记录ID不能为空") Long id) {
        boolean success = calculationHistoryService.deleteHistory(id);
        if (success) {
            return Result.ok();
        }
        return Result.fail("删除失败");
    }

    /**
     * 批量删除计算历史记录
     *
     * @param ids 记录ID列表
     * @return 删除数量
     */
    @Operation(summary = "批量删除计算历史", description = "根据ID列表批量删除计算历史记录")
    @PostMapping("/batch-delete")
    public Result<Integer> batchDelete(
            @RequestBody @NotEmpty(message = "ID列表不能为空") List<Long> ids) {
        int count = calculationHistoryService.batchDelete(ids);
        return Result.ok(count);
    }

    /**
     * 统计项目的计算次数
     *
     * @param projectId 项目ID
     * @return 计算次数
     */
    @Operation(summary = "统计项目计算次数", description = "统计指定项目的计算总次数")
    @GetMapping("/count/project/{projectId}")
    public Result<Long> countByProject(
            @PathVariable("projectId") @NotNull(message = "项目ID不能为空") Long projectId) {
        long count = calculationHistoryService.countByProject(projectId);
        return Result.ok(count);
    }

    /**
     * 统计用户的计算次数
     *
     * @param userId 用户ID
     * @return 计算次数
     */
    @Operation(summary = "统计用户计算次数", description = "统计指定用户的计算总次数")
    @GetMapping("/count/user/{userId}")
    public Result<Long> countByUser(
            @PathVariable("userId") @NotNull(message = "用户ID不能为空") Long userId) {
        long count = calculationHistoryService.countByUser(userId);
        return Result.ok(count);
    }
}
