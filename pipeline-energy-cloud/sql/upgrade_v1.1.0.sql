/*
 * 管道能耗分析系统 - 数据库升级脚本
 * 版本: v1.1.0
 * 日期: 2025-12-28
 * 说明: 新增计算历史、分析报告、敏感性分析、操作日志等表
 */

USE `pipeline_cloud`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 6. 计算历史记录表 (t_calculation_history)
-- 用途: 保存水力分析和优化计算的历史记录，支持对比分析
-- ============================================================
DROP TABLE IF EXISTS `t_calculation_history`;
CREATE TABLE `t_calculation_history` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pro_id` bigint(20) NOT NULL COMMENT '项目ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '管道ID',
    `calc_type` varchar(50) NOT NULL COMMENT '计算类型: HYDRAULIC-水力分析, OPTIMIZATION-泵站优化',
    `calc_name` varchar(100) DEFAULT NULL COMMENT '计算名称/备注',

    -- 输入参数(JSON格式存储完整参数)
    `input_params` json NOT NULL COMMENT '输入参数JSON',

    -- 核心计算结果
    `flow_rate` decimal(12, 4) DEFAULT NULL COMMENT '流量(m³/h)',
    `flow_velocity` decimal(12, 6) DEFAULT NULL COMMENT '流速(m/s)',
    `reynolds_number` decimal(20, 4) DEFAULT NULL COMMENT '雷诺数',
    `flow_regime` varchar(50) DEFAULT NULL COMMENT '流态: LAMINAR-层流, TRANSITION-过渡, HYDRAULIC_SMOOTH-水力光滑, MIXED_FRICTION-混合摩擦, ROUGH-粗糙',
    `friction_factor` decimal(12, 8) DEFAULT NULL COMMENT '摩阻系数',
    `friction_loss` decimal(16, 4) DEFAULT NULL COMMENT '沿程摩阻损失(m)',
    `hydraulic_slope` decimal(12, 8) DEFAULT NULL COMMENT '水力坡降',

    -- 优化结果(仅OPTIMIZATION类型)
    `optimal_pump480` int(11) DEFAULT NULL COMMENT '最优方案-ZMI480泵数量',
    `optimal_pump375` int(11) DEFAULT NULL COMMENT '最优方案-ZMI375泵数量',
    `total_head` decimal(16, 4) DEFAULT NULL COMMENT '总扬程(m)',
    `end_station_pressure` decimal(16, 4) DEFAULT NULL COMMENT '末站进站压力(m)',
    `energy_consumption` decimal(20, 2) DEFAULT NULL COMMENT '年能耗(kWh)',
    `annual_cost` decimal(20, 2) DEFAULT NULL COMMENT '年运行费用(元)',

    -- 完整结果(JSON格式)
    `output_result` json DEFAULT NULL COMMENT '完整输出结果JSON',

    -- 审计字段
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',

    PRIMARY KEY (`id`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_calc_type` (`calc_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计算历史记录表';


-- ============================================================
-- 7. 分析报告表 (t_analysis_report)
-- 用途: 存储生成的分析报告信息
-- ============================================================
DROP TABLE IF EXISTS `t_analysis_report`;
CREATE TABLE `t_analysis_report` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pro_id` bigint(20) NOT NULL COMMENT '项目ID',
    `pipeline_id` bigint(20) DEFAULT NULL COMMENT '管道ID(可选)',

    -- 报告信息
    `report_no` varchar(50) NOT NULL COMMENT '报告编号',
    `report_type` varchar(50) NOT NULL COMMENT '报告类型: HYDRAULIC-水力分析报告, OPTIMIZATION-优化方案报告, COMPARISON-对比分析报告, SENSITIVITY-敏感性分析报告',
    `report_title` varchar(200) NOT NULL COMMENT '报告标题',
    `report_summary` text DEFAULT NULL COMMENT '报告摘要',

    -- 文件信息
    `file_name` varchar(200) DEFAULT NULL COMMENT '文件名',
    `file_path` varchar(500) DEFAULT NULL COMMENT '文件存储路径(MinIO ObjectKey)',
    `file_format` varchar(20) DEFAULT 'DOCX' COMMENT '文件格式: DOCX, PDF',
    `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小(bytes)',

    -- 关联的计算历史
    `history_ids` varchar(500) DEFAULT NULL COMMENT '关联的计算历史ID列表(逗号分隔)',

    -- 状态
    `status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '状态: 0-生成中, 1-已完成, 2-生成失败',
    `error_msg` varchar(500) DEFAULT NULL COMMENT '错误信息',

    -- 审计字段
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_report_no` (`report_no`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_report_type` (`report_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析报告表';


-- ============================================================
-- 8. 敏感性分析结果表 (t_sensitivity_analysis)
-- 用途: 存储参数敏感性分析结果
-- ============================================================
DROP TABLE IF EXISTS `t_sensitivity_analysis`;
CREATE TABLE `t_sensitivity_analysis` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '管道ID',
    `history_id` bigint(20) DEFAULT NULL COMMENT '基准计算历史ID',

    -- 分析配置
    `analysis_type` varchar(50) NOT NULL COMMENT '分析类型: SINGLE-单因素, CROSS-交叉分析',
    `variable_name` varchar(50) NOT NULL COMMENT '分析变量: FLOW_RATE-流量, VISCOSITY-粘度, ROUGHNESS-粗糙度, DIAMETER-管径',
    `base_value` decimal(20, 6) NOT NULL COMMENT '基准值',
    `variation_range` decimal(5, 2) NOT NULL COMMENT '变化范围(±百分比)',
    `steps` int(11) NOT NULL DEFAULT 5 COMMENT '分析步数',

    -- 分析结果
    `results` json NOT NULL COMMENT '分析结果JSON数组',
    `conclusion` text DEFAULT NULL COMMENT '分析结论',
    `sensitivity_index` decimal(10, 4) DEFAULT NULL COMMENT '敏感性指数',

    -- 审计字段
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_variable_name` (`variable_name`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='敏感性分析结果表';


-- ============================================================
-- 9. 操作日志表 (t_operation_log)
-- 用途: 记录用户操作日志，用于审计和问题排查
-- ============================================================
DROP TABLE IF EXISTS `t_operation_log`;
CREATE TABLE `t_operation_log` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',

    -- 用户信息
    `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
    `user_name` varchar(64) DEFAULT '' COMMENT '用户名',

    -- 操作信息
    `module` varchar(50) DEFAULT '' COMMENT '模块名称',
    `operation` varchar(100) DEFAULT '' COMMENT '操作描述',
    `method` varchar(200) DEFAULT '' COMMENT '请求方法',
    `request_url` varchar(500) DEFAULT '' COMMENT '请求URL',
    `request_method` varchar(10) DEFAULT '' COMMENT 'HTTP方法',
    `request_params` text DEFAULT NULL COMMENT '请求参数',
    `response_result` text DEFAULT NULL COMMENT '响应结果',

    -- 执行信息
    `ip` varchar(64) DEFAULT '' COMMENT 'IP地址',
    `location` varchar(100) DEFAULT '' COMMENT '操作地点',
    `cost_time` bigint(20) DEFAULT 0 COMMENT '耗时(ms)',
    `status` tinyint(4) DEFAULT 0 COMMENT '状态: 0-成功, 1-失败',
    `error_msg` text DEFAULT NULL COMMENT '错误信息',

    -- 时间
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_module` (`module`),
    KEY `idx_status` (`status`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';


-- ============================================================
-- 10. 数据字典表 (sys_dict_type)
-- 用途: 系统数据字典类型
-- ============================================================
DROP TABLE IF EXISTS `sys_dict_type`;
CREATE TABLE `sys_dict_type` (
    `dict_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '字典主键',
    `dict_name` varchar(100) NOT NULL COMMENT '字典名称',
    `dict_type` varchar(100) NOT NULL COMMENT '字典类型',
    `status` char(1) DEFAULT '0' COMMENT '状态（0正常 1停用）',
    `create_by` varchar(64) DEFAULT '' COMMENT '创建者',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`dict_id`),
    UNIQUE KEY `uk_dict_type` (`dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典类型表';


-- ============================================================
-- 11. 数据字典数据表 (sys_dict_data)
-- 用途: 系统数据字典数据
-- ============================================================
DROP TABLE IF EXISTS `sys_dict_data`;
CREATE TABLE `sys_dict_data` (
    `dict_code` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '字典编码',
    `dict_sort` int(4) DEFAULT 0 COMMENT '字典排序',
    `dict_label` varchar(100) NOT NULL COMMENT '字典标签',
    `dict_value` varchar(100) NOT NULL COMMENT '字典键值',
    `dict_type` varchar(100) NOT NULL COMMENT '字典类型',
    `css_class` varchar(100) DEFAULT NULL COMMENT '样式属性',
    `list_class` varchar(100) DEFAULT NULL COMMENT '表格回显样式',
    `is_default` char(1) DEFAULT 'N' COMMENT '是否默认（Y是 N否）',
    `status` char(1) DEFAULT '0' COMMENT '状态（0正常 1停用）',
    `create_by` varchar(64) DEFAULT '' COMMENT '创建者',
    `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
    `update_time` datetime DEFAULT NULL COMMENT '更新时间',
    `remark` varchar(500) DEFAULT NULL COMMENT '备注',
    PRIMARY KEY (`dict_code`),
    KEY `idx_dict_type` (`dict_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典数据表';


-- ============================================================
-- 初始化数据字典
-- ============================================================

-- 计算类型字典
INSERT INTO `sys_dict_type` (`dict_name`, `dict_type`, `status`, `create_by`, `remark`) VALUES
('计算类型', 'calc_type', '0', 'admin', '计算类型字典');

INSERT INTO `sys_dict_data` (`dict_sort`, `dict_label`, `dict_value`, `dict_type`, `is_default`, `status`, `create_by`, `remark`) VALUES
(1, '水力分析', 'HYDRAULIC', 'calc_type', 'Y', '0', 'admin', '水力特性分析'),
(2, '泵站优化', 'OPTIMIZATION', 'calc_type', 'N', '0', 'admin', '运行方案优化');

-- 流态类型字典
INSERT INTO `sys_dict_type` (`dict_name`, `dict_type`, `status`, `create_by`, `remark`) VALUES
('流态类型', 'flow_regime', '0', 'admin', '流体流动状态');

INSERT INTO `sys_dict_data` (`dict_sort`, `dict_label`, `dict_value`, `dict_type`, `is_default`, `status`, `create_by`, `remark`) VALUES
(1, '层流', 'LAMINAR', 'flow_regime', 'N', '0', 'admin', 'Re < 2300'),
(2, '过渡流', 'TRANSITION', 'flow_regime', 'N', '0', 'admin', '2300 ≤ Re < 3000'),
(3, '水力光滑区', 'HYDRAULIC_SMOOTH', 'flow_regime', 'N', '0', 'admin', '3000 < Re < Re1'),
(4, '混合摩擦区', 'MIXED_FRICTION', 'flow_regime', 'N', '0', 'admin', 'Re1 ≤ Re < Re2'),
(5, '粗糙区', 'ROUGH', 'flow_regime', 'Y', '0', 'admin', 'Re ≥ Re2');

-- 报告类型字典
INSERT INTO `sys_dict_type` (`dict_name`, `dict_type`, `status`, `create_by`, `remark`) VALUES
('报告类型', 'report_type', '0', 'admin', '分析报告类型');

INSERT INTO `sys_dict_data` (`dict_sort`, `dict_label`, `dict_value`, `dict_type`, `is_default`, `status`, `create_by`, `remark`) VALUES
(1, '水力分析报告', 'HYDRAULIC', 'report_type', 'Y', '0', 'admin', '水力分析报告'),
(2, '优化方案报告', 'OPTIMIZATION', 'report_type', 'N', '0', 'admin', '泵站优化方案报告'),
(3, '对比分析报告', 'COMPARISON', 'report_type', 'N', '0', 'admin', '多方案对比报告'),
(4, '敏感性分析报告', 'SENSITIVITY', 'report_type', 'N', '0', 'admin', '参数敏感性分析报告');

-- 敏感性分析变量字典
INSERT INTO `sys_dict_type` (`dict_name`, `dict_type`, `status`, `create_by`, `remark`) VALUES
('敏感性分析变量', 'sensitivity_variable', '0', 'admin', '敏感性分析变量');

INSERT INTO `sys_dict_data` (`dict_sort`, `dict_label`, `dict_value`, `dict_type`, `is_default`, `status`, `create_by`, `remark`) VALUES
(1, '流量', 'FLOW_RATE', 'sensitivity_variable', 'Y', '0', 'admin', '流量变化'),
(2, '粘度', 'VISCOSITY', 'sensitivity_variable', 'N', '0', 'admin', '运动粘度变化'),
(3, '粗糙度', 'ROUGHNESS', 'sensitivity_variable', 'N', '0', 'admin', '管道粗糙度变化'),
(4, '管径', 'DIAMETER', 'sensitivity_variable', 'N', '0', 'admin', '管道直径变化');


SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- 升级完成提示
-- ============================================================
SELECT '数据库升级至 v1.1.0 完成!' AS message;
