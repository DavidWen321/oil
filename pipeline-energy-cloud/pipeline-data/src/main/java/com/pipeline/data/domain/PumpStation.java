package com.pipeline.data.domain;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import jakarta.validation.constraints.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 泵站参数实体类
 */
@Data
@TableName("t_pump_station")
public class PumpStation implements Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 泵站名称
     */
    @NotBlank(message = "泵站名称不能为空")
    @Size(max = 100, message = "泵站名称长度不能超过100")
    private String name;

    /**
     * 泵效率(%)
     */
    @NotNull(message = "泵效率不能为空")
    @DecimalMin(value = "0.0", message = "泵效率不能小于0")
    @DecimalMax(value = "100.0", message = "泵效率不能大于100")
    private BigDecimal pumpEfficiency;

    /**
     * 电机效率(%)
     */
    @NotNull(message = "电机效率不能为空")
    @DecimalMin(value = "0.0", message = "电机效率不能小于0")
    @DecimalMax(value = "100.0", message = "电机效率不能大于100")
    private BigDecimal electricEfficiency;

    /**
     * 排量(m3/h)
     */
    @NotNull(message = "排量不能为空")
    @DecimalMin(value = "0.0", message = "排量不能小于0")
    private BigDecimal displacement;

    /**
     * 进站压力/功率
     */
    @NotNull(message = "进站压力不能为空")
    @DecimalMin(value = "0.0", message = "进站压力不能小于0")
    private BigDecimal comePower;

    /**
     * ZMI480扬程
     */
    @NotNull(message = "ZMI480扬程不能为空")
    @DecimalMin(value = "0.0", message = "ZMI480扬程不能小于0")
    private BigDecimal zmi480Lift;

    /**
     * ZMI375扬程
     */
    @NotNull(message = "ZMI375扬程不能为空")
    @DecimalMin(value = "0.0", message = "ZMI375扬程不能小于0")
    private BigDecimal zmi375Lift;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
