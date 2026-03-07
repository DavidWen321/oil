package com.pipeline.data.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.pipeline.common.core.domain.PageQuery;
import com.pipeline.common.core.domain.PageResult;
import com.pipeline.common.core.domain.Result;
import com.pipeline.data.domain.PumpStation;
import com.pipeline.data.service.IPumpStationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * 泵站参数管理控制器
 */
@Validated
@RestController
@RequestMapping("/pump-station")
public class PumpStationController {

    @Autowired
    private IPumpStationService pumpStationService;

    /**
     * 查询泵站列表（全量）
     */
    @GetMapping("/list")
    public Result<List<PumpStation>> list(@RequestParam(required = false) String name) {
        LambdaQueryWrapper<PumpStation> wrapper = new LambdaQueryWrapper<>();
        if (name != null && !name.trim().isEmpty()) {
            wrapper.like(PumpStation::getName, name);
        }
        wrapper.orderByDesc(PumpStation::getCreateTime);
        return Result.ok(pumpStationService.list(wrapper));
    }

    /**
     * 分页查询泵站列表
     */
    @GetMapping("/page")
    public Result<PageResult<PumpStation>> page(@Valid PageQuery pageQuery,
                                                  @RequestParam(required = false) String name) {
        Page<PumpStation> page = new Page<>(pageQuery.getPageNum(), pageQuery.getPageSize());
        LambdaQueryWrapper<PumpStation> wrapper = new LambdaQueryWrapper<>();

        // 条件查询
        if (name != null && !name.trim().isEmpty()) {
            wrapper.like(PumpStation::getName, name);
        }

        // 排序
        wrapper.orderByDesc(PumpStation::getCreateTime);

        IPage<PumpStation> result = pumpStationService.page(page, wrapper);
        return Result.ok(PageResult.build(
            result.getRecords(),
            result.getTotal(),
            result.getCurrent(),
            result.getSize()
        ));
    }

    /**
     * 获取泵站详细信息
     */
    @GetMapping(value = "/{id}")
    public Result<PumpStation> getInfo(@PathVariable("id")
                                        @NotNull(message = "泵站ID不能为空") Long id) {
        PumpStation pumpStation = pumpStationService.getById(id);
        if (pumpStation == null) {
            return Result.fail("泵站不存在");
        }
        return Result.ok(pumpStation);
    }

    /**
     * 新增泵站
     */
    @PostMapping
    public Result<Boolean> add(@RequestBody @Valid PumpStation pumpStation) {
        // 检查名称是否重复
        LambdaQueryWrapper<PumpStation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PumpStation::getName, pumpStation.getName());
        if (pumpStationService.count(wrapper) > 0) {
            return Result.fail("泵站名称已存在");
        }

        return Result.ok(pumpStationService.save(pumpStation));
    }

    /**
     * 修改泵站
     */
    @PutMapping
    public Result<Boolean> edit(@RequestBody @Valid PumpStation pumpStation) {
        if (pumpStation.getId() == null) {
            return Result.fail("泵站ID不能为空");
        }

        // 检查是否存在
        if (pumpStationService.getById(pumpStation.getId()) == null) {
            return Result.fail("泵站不存在");
        }

        // 检查名称是否重复（排除自己）
        LambdaQueryWrapper<PumpStation> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PumpStation::getName, pumpStation.getName())
               .ne(PumpStation::getId, pumpStation.getId());
        if (pumpStationService.count(wrapper) > 0) {
            return Result.fail("泵站名称已存在");
        }

        return Result.ok(pumpStationService.updateById(pumpStation));
    }

    /**
     * 删除泵站
     */
    @DeleteMapping("/{ids}")
    public Result<Boolean> remove(@PathVariable @NotEmpty(message = "删除ID不能为空") List<Long> ids) {
        return Result.ok(pumpStationService.removeBatchByIds(ids));
    }
}
