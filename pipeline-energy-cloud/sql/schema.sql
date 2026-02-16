/*
 * 管道能耗分析系统数据库脚本
 * 数据库: pipeline_cloud
 * 作者: AI Assistant
 * 日期: 2025-11-19
 */

CREATE DATABASE IF NOT EXISTS `pipeline_cloud` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE `pipeline_cloud`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 项目表 (t_project)
-- ----------------------------
DROP TABLE IF EXISTS `t_project`;
CREATE TABLE `t_project` (
  `pro_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '项目ID',
  `number` varchar(50) DEFAULT NULL COMMENT '项目编号',
  `name` varchar(100) DEFAULT NULL COMMENT '项目名称',
  `responsible` varchar(50) DEFAULT NULL COMMENT '负责人',
  `build_date` datetime DEFAULT NULL COMMENT '创建日期',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  `is_deleted` tinyint(1) DEFAULT 0 COMMENT '逻辑删除(0:正常, 1:删除)',
  PRIMARY KEY (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目信息表';

-- ----------------------------
-- 2. 管道参数表 (t_pipeline)
-- ----------------------------
DROP TABLE IF EXISTS `t_pipeline`;
CREATE TABLE `t_pipeline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `pro_id` bigint(20) NOT NULL COMMENT '关联项目ID',
  `name` varchar(100) DEFAULT NULL COMMENT '管道名称',
  `length` decimal(10, 2) DEFAULT NULL COMMENT '管道长度(km)',
  `diameter` decimal(10, 2) DEFAULT NULL COMMENT '管道外径(mm)',
  `thickness` decimal(10, 2) DEFAULT NULL COMMENT '壁厚(mm)',
  `throughput` decimal(10, 2) DEFAULT NULL COMMENT '设计年输量(万吨)',
  `start_altitude` decimal(10, 2) DEFAULT NULL COMMENT '起点高程(m)',
  `end_altitude` decimal(10, 2) DEFAULT NULL COMMENT '终点高程(m)',
  `roughness` decimal(10, 4) DEFAULT NULL COMMENT '当量粗糙度(m)',
  `work_time` decimal(10, 2) DEFAULT NULL COMMENT '年工作时间(h)',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_pro_id` (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管道参数表';

-- ----------------------------
-- 3. 泵站参数表 (t_pump_station)
-- ----------------------------
DROP TABLE IF EXISTS `t_pump_station`;
CREATE TABLE `t_pump_station` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(100) DEFAULT NULL COMMENT '泵站名称',
  `pump_efficiency` decimal(5, 2) DEFAULT NULL COMMENT '泵效率(%)',
  `electric_efficiency` decimal(5, 2) DEFAULT NULL COMMENT '电机效率(%)',
  `displacement` decimal(10, 2) DEFAULT NULL COMMENT '排量(m3/h)',
  `come_power` decimal(10, 2) DEFAULT NULL COMMENT '进站压力/功率',
  `zmi480_lift` decimal(10, 2) DEFAULT NULL COMMENT 'ZMI480扬程',
  `zmi375_lift` decimal(10, 2) DEFAULT NULL COMMENT 'ZMI375扬程',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='泵站参数表';

-- ----------------------------
-- 4. 油品特性表 (t_oil_property)
-- ----------------------------
DROP TABLE IF EXISTS `t_oil_property`;
CREATE TABLE `t_oil_property` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(50) DEFAULT NULL COMMENT '油品名称',
  `density` decimal(10, 2) DEFAULT NULL COMMENT '密度(kg/m3)',
  `viscosity` decimal(10, 6) DEFAULT NULL COMMENT '运动粘度(m2/s)',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='油品特性表';

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------
-- 5. 用户信息表
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `user_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `dept_id` bigint(20) DEFAULT NULL COMMENT '部门ID',
  `user_name` varchar(30) NOT NULL COMMENT '用户账号',
  `nick_name` varchar(30) NOT NULL COMMENT '用户昵称',
  `user_type` varchar(2) DEFAULT '00' COMMENT '用户类型（00系统用户）',
  `email` varchar(50) DEFAULT '' COMMENT '用户邮箱',
  `phonenumber` varchar(11) DEFAULT '' COMMENT '手机号码',
  `sex` char(1) DEFAULT '0' COMMENT '用户性别（0男 1女 2未知）',
  `avatar` varchar(100) DEFAULT '' COMMENT '头像地址',
  `password` varchar(100) DEFAULT '' COMMENT '密码',
  `status` char(1) DEFAULT '0' COMMENT '帐号状态（0正常 1停用）',
  `del_flag` char(1) DEFAULT '0' COMMENT '删除标志（0代表存在 2代表删除）',
  `login_ip` varchar(128) DEFAULT '' COMMENT '最后登录IP',
  `login_date` datetime DEFAULT NULL COMMENT '最后登录时间',
  `create_by` varchar(64) DEFAULT '' COMMENT '创建者',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `update_by` varchar(64) DEFAULT '' COMMENT '更新者',
  `update_time` datetime DEFAULT NULL COMMENT '更新时间',
  `remark` varchar(500) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';

-- ----------------------------
-- 初始化-用户信息表数据
-- 密码为 admin123 的 BCrypt 加密密文
-- ----------------------------
INSERT INTO `sys_user` VALUES (1, 103, 'admin', '管理员', '00', 'admin@pipeline.com', '15888888888', '0', '', '$2a$10$7JB720yubVSZvJW8KegC5.ZaL9m6WfC9UwYx4kd8BUPEqVQJqAFFu', '0', '0', '127.0.0.1', sysdate(), 'admin', sysdate(), '', null, '系统管理员');


-- ============================================================
-- 6. 计算历史记录表 (t_calculation_history)
-- ============================================================
DROP TABLE IF EXISTS `t_calculation_history`;
CREATE TABLE `t_calculation_history` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pro_id` bigint(20) NOT NULL COMMENT '项目ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '管道ID',
    `calc_type` varchar(50) NOT NULL COMMENT '计算类型: HYDRAULIC-水力分析, OPTIMIZATION-泵站优化',
    `calc_name` varchar(100) DEFAULT NULL COMMENT '计算名称/备注',
    `input_params` json NOT NULL COMMENT '输入参数JSON',
    `flow_rate` decimal(12, 4) DEFAULT NULL COMMENT '流量(m³/h)',
    `flow_velocity` decimal(12, 6) DEFAULT NULL COMMENT '流速(m/s)',
    `reynolds_number` decimal(20, 4) DEFAULT NULL COMMENT '雷诺数',
    `flow_regime` varchar(50) DEFAULT NULL COMMENT '流态',
    `friction_factor` decimal(12, 8) DEFAULT NULL COMMENT '摩阻系数',
    `friction_loss` decimal(16, 4) DEFAULT NULL COMMENT '沿程摩阻损失(m)',
    `hydraulic_slope` decimal(12, 8) DEFAULT NULL COMMENT '水力坡降',
    `optimal_pump480` int(11) DEFAULT NULL COMMENT '最优方案-ZMI480泵数量',
    `optimal_pump375` int(11) DEFAULT NULL COMMENT '最优方案-ZMI375泵数量',
    `total_head` decimal(16, 4) DEFAULT NULL COMMENT '总扬程(m)',
    `end_station_pressure` decimal(16, 4) DEFAULT NULL COMMENT '末站进站压力(m)',
    `energy_consumption` decimal(20, 2) DEFAULT NULL COMMENT '年能耗(kWh)',
    `annual_cost` decimal(20, 2) DEFAULT NULL COMMENT '年运行费用(元)',
    `output_result` json DEFAULT NULL COMMENT '完整输出结果JSON',
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
-- ============================================================
DROP TABLE IF EXISTS `t_analysis_report`;
CREATE TABLE `t_analysis_report` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pro_id` bigint(20) NOT NULL COMMENT '项目ID',
    `pipeline_id` bigint(20) DEFAULT NULL COMMENT '管道ID',
    `report_no` varchar(50) NOT NULL COMMENT '报告编号',
    `report_type` varchar(50) NOT NULL COMMENT '报告类型',
    `report_title` varchar(200) NOT NULL COMMENT '报告标题',
    `report_summary` text DEFAULT NULL COMMENT '报告摘要',
    `file_name` varchar(200) DEFAULT NULL COMMENT '文件名',
    `file_path` varchar(500) DEFAULT NULL COMMENT '文件存储路径',
    `file_format` varchar(20) DEFAULT 'DOCX' COMMENT '文件格式',
    `file_size` bigint(20) DEFAULT NULL COMMENT '文件大小(bytes)',
    `history_ids` varchar(500) DEFAULT NULL COMMENT '关联的计算历史ID列表',
    `status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '状态: 0-生成中, 1-已完成, 2-生成失败',
    `error_msg` varchar(500) DEFAULT NULL COMMENT '错误信息',
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_report_no` (`report_no`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_report_type` (`report_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析报告表';


-- ============================================================
-- 8. 敏感性分析结果表 (t_sensitivity_analysis)
-- ============================================================
DROP TABLE IF EXISTS `t_sensitivity_analysis`;
CREATE TABLE `t_sensitivity_analysis` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '管道ID',
    `history_id` bigint(20) DEFAULT NULL COMMENT '基准计算历史ID',
    `analysis_type` varchar(50) NOT NULL COMMENT '分析类型',
    `variable_name` varchar(50) NOT NULL COMMENT '分析变量',
    `base_value` decimal(20, 6) NOT NULL COMMENT '基准值',
    `variation_range` decimal(5, 2) NOT NULL COMMENT '变化范围(%)',
    `steps` int(11) NOT NULL DEFAULT 5 COMMENT '分析步数',
    `results` json NOT NULL COMMENT '分析结果JSON数组',
    `conclusion` text DEFAULT NULL COMMENT '分析结论',
    `sensitivity_index` decimal(10, 4) DEFAULT NULL COMMENT '敏感性指数',
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_variable_name` (`variable_name`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='敏感性分析结果表';


-- ============================================================
-- 9. 操作日志表 (t_operation_log)
-- ============================================================
DROP TABLE IF EXISTS `t_operation_log`;
CREATE TABLE `t_operation_log` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `user_id` bigint(20) DEFAULT NULL COMMENT '用户ID',
    `user_name` varchar(64) DEFAULT '' COMMENT '用户名',
    `module` varchar(50) DEFAULT '' COMMENT '模块名称',
    `operation` varchar(100) DEFAULT '' COMMENT '操作描述',
    `method` varchar(200) DEFAULT '' COMMENT '请求方法',
    `request_url` varchar(500) DEFAULT '' COMMENT '请求URL',
    `request_method` varchar(10) DEFAULT '' COMMENT 'HTTP方法',
    `request_params` text DEFAULT NULL COMMENT '请求参数',
    `response_result` text DEFAULT NULL COMMENT '响应结果',
    `ip` varchar(64) DEFAULT '' COMMENT 'IP地址',
    `location` varchar(100) DEFAULT '' COMMENT '操作地点',
    `cost_time` bigint(20) DEFAULT 0 COMMENT '耗时(ms)',
    `status` tinyint(4) DEFAULT 0 COMMENT '状态: 0-成功, 1-失败',
    `error_msg` text DEFAULT NULL COMMENT '错误信息',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_module` (`module`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';
