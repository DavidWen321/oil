package com.pipeline.common.core.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 报告类型枚举
 *
 * @author Pipeline Team
 * @since 1.0.0
 */
@Getter
@AllArgsConstructor
public enum ReportTypeEnum {

    /**
     * 水力分析报告
     */
    HYDRAULIC("HYDRAULIC", "水力分析报告"),

    /**
     * 优化方案报告
     */
    OPTIMIZATION("OPTIMIZATION", "优化方案报告"),

    /**
     * 对比分析报告
     */
    COMPARISON("COMPARISON", "对比分析报告"),

    /**
     * 敏感性分析报告
     */
    SENSITIVITY("SENSITIVITY", "敏感性分析报告");

    /**
     * 类型编码
     */
    private final String code;

    /**
     * 类型描述
     */
    private final String desc;

    /**
     * 根据编码获取枚举
     *
     * @param code 类型编码
     * @return 枚举值，未找到返回null
     */
    public static ReportTypeEnum fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (ReportTypeEnum type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }
}
