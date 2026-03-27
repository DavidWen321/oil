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
  `pro_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `number` varchar(50) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `responsible` varchar(50) DEFAULT NULL,
  `build_date` datetime DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_deleted` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- 2. 管道参数表 (t_pipeline)
-- ----------------------------
DROP TABLE IF EXISTS `t_pipeline`;
CREATE TABLE `t_pipeline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `pro_id` bigint(20) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `length` decimal(10, 2) DEFAULT NULL,
  `diameter` decimal(10, 2) DEFAULT NULL,
  `thickness` decimal(10, 2) DEFAULT NULL,
  `throughput` decimal(10, 2) DEFAULT NULL,
  `start_altitude` decimal(10, 2) DEFAULT NULL,
  `end_altitude` decimal(10, 2) DEFAULT NULL,
  `roughness` decimal(10, 4) DEFAULT NULL,
  `work_time` decimal(10, 2) DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pro_id` (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- 3. 泵站参数表 (t_pump_station)
-- ----------------------------
DROP TABLE IF EXISTS `t_pump_station`;
CREATE TABLE `t_pump_station` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `pump_efficiency` decimal(5, 2) DEFAULT NULL,
  `electric_efficiency` decimal(5, 2) DEFAULT NULL,
  `displacement` decimal(10, 2) DEFAULT NULL,
  `come_power` decimal(10, 2) DEFAULT NULL,
  `zmi480_lift` decimal(10, 2) DEFAULT NULL,
  `zmi375_lift` decimal(10, 2) DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- 4. 油品特性表 (t_oil_property)
-- ----------------------------
DROP TABLE IF EXISTS `t_oil_property`;
CREATE TABLE `t_oil_property` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) DEFAULT NULL,
  `density` decimal(10, 2) DEFAULT NULL,
  `viscosity` decimal(10, 6) DEFAULT NULL,
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------
-- 5. 用户信息表
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `user_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `dept_id` bigint(20) DEFAULT NULL,
  `user_name` varchar(30) NOT NULL,
  `nick_name` varchar(30) NOT NULL,
  `user_type` varchar(2) DEFAULT '00',
  `email` varchar(50) DEFAULT '',
  `phonenumber` varchar(11) DEFAULT '',
  `sex` char(1) DEFAULT '0',
  `avatar` varchar(100) DEFAULT '',
  `password` varchar(100) DEFAULT '',
  `status` char(1) DEFAULT '0',
  `del_flag` char(1) DEFAULT '0',
  `login_ip` varchar(128) DEFAULT '',
  `login_date` datetime DEFAULT NULL,
  `create_by` varchar(64) DEFAULT '',
  `create_time` datetime DEFAULT NULL,
  `update_by` varchar(64) DEFAULT '',
  `update_time` datetime DEFAULT NULL,
  `remark` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- 初始化-用户信息表数据
-- 密码为 admin123 的 BCrypt 加密密文
-- ----------------------------
INSERT INTO `sys_user` VALUES (1, 103, 'admin', '???', '00', 'admin@pipeline.com', '15888888888', '0', '', '$2a$10$BwqeKHNeuqjQLbFSqZwD8u2C0BpIv51hWf6JXkIptW2jr6SDscwQS', '0', '0', '127.0.0.1', sysdate(), 'admin', sysdate(), '', null, '?????');


-- ============================================================
-- 6. 计算历史记录表 (t_calculation_history)
-- ============================================================
DROP TABLE IF EXISTS `t_calculation_history`;
CREATE TABLE `t_calculation_history` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `pro_id` bigint(20) NOT NULL,
    `pipeline_id` bigint(20) NOT NULL,
    `calc_type` varchar(50) NOT NULL,
    `calc_name` varchar(100) DEFAULT NULL,
    `input_params` json NOT NULL,
    `flow_rate` decimal(12, 4) DEFAULT NULL,
    `flow_velocity` decimal(12, 6) DEFAULT NULL,
    `reynolds_number` decimal(20, 4) DEFAULT NULL,
    `flow_regime` varchar(50) DEFAULT NULL,
    `friction_factor` decimal(12, 8) DEFAULT NULL,
    `friction_loss` decimal(16, 4) DEFAULT NULL,
    `hydraulic_slope` decimal(12, 8) DEFAULT NULL,
    `optimal_pump480` int(11) DEFAULT NULL,
    `optimal_pump375` int(11) DEFAULT NULL,
    `total_head` decimal(16, 4) DEFAULT NULL,
    `end_station_pressure` decimal(16, 4) DEFAULT NULL,
    `energy_consumption` decimal(20, 2) DEFAULT NULL,
    `annual_cost` decimal(20, 2) DEFAULT NULL,
    `output_result` json DEFAULT NULL,
    `create_by` varchar(64) DEFAULT '',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `remark` varchar(500) DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_calc_type` (`calc_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 7. 分析报告表 (t_analysis_report)
-- ============================================================
DROP TABLE IF EXISTS `t_analysis_report`;
CREATE TABLE `t_analysis_report` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `pro_id` bigint(20) NOT NULL,
    `pipeline_id` bigint(20) DEFAULT NULL,
    `report_no` varchar(50) NOT NULL,
    `report_type` varchar(50) NOT NULL,
    `report_title` varchar(200) NOT NULL,
    `report_summary` text DEFAULT NULL,
    `file_name` varchar(200) DEFAULT NULL,
    `file_path` varchar(500) DEFAULT NULL,
    `file_format` varchar(20) DEFAULT 'DOCX',
    `file_size` bigint(20) DEFAULT NULL,
    `history_ids` varchar(500) DEFAULT NULL,
    `status` tinyint(4) NOT NULL DEFAULT 0,
    `error_msg` varchar(500) DEFAULT NULL,
    `create_by` varchar(64) DEFAULT '',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_report_no` (`report_no`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_report_type` (`report_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 8. 敏感性分析结果表 (t_sensitivity_analysis)
-- ============================================================
DROP TABLE IF EXISTS `t_sensitivity_analysis`;
CREATE TABLE `t_sensitivity_analysis` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `pipeline_id` bigint(20) NOT NULL,
    `history_id` bigint(20) DEFAULT NULL,
    `analysis_type` varchar(50) NOT NULL,
    `variable_name` varchar(50) NOT NULL,
    `base_value` decimal(20, 6) NOT NULL,
    `variation_range` decimal(5, 2) NOT NULL,
    `steps` int(11) NOT NULL DEFAULT 5,
    `results` json NOT NULL,
    `conclusion` text DEFAULT NULL,
    `sensitivity_index` decimal(10, 4) DEFAULT NULL,
    `create_by` varchar(64) DEFAULT '',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_variable_name` (`variable_name`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 9. 操作日志表 (t_operation_log)
-- ============================================================
DROP TABLE IF EXISTS `t_operation_log`;
CREATE TABLE `t_operation_log` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `user_id` bigint(20) DEFAULT NULL,
    `user_name` varchar(64) DEFAULT '',
    `module` varchar(50) DEFAULT '',
    `operation` varchar(100) DEFAULT '',
    `method` varchar(200) DEFAULT '',
    `request_url` varchar(500) DEFAULT '',
    `request_method` varchar(10) DEFAULT '',
    `request_params` text DEFAULT NULL,
    `response_result` text DEFAULT NULL,
    `ip` varchar(64) DEFAULT '',
    `location` varchar(100) DEFAULT '',
    `cost_time` bigint(20) DEFAULT 0,
    `status` tinyint(4) DEFAULT 0,
    `error_msg` text DEFAULT NULL,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_module` (`module`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 10. 知识库文档元数据表 (t_kb_document)
-- ============================================================
DROP TABLE IF EXISTS `t_kb_document`;
CREATE TABLE `t_kb_document` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `title` varchar(200) NOT NULL,
    `category` varchar(50) NOT NULL,
    `source_type` varchar(50) DEFAULT NULL,
    `tags` varchar(500) DEFAULT NULL,
    `remark` varchar(1000) DEFAULT NULL,
    `file_name` varchar(255) NOT NULL,
    `file_extension` varchar(20) DEFAULT NULL,
    `file_size` bigint(20) DEFAULT 0,
    `file_hash` varchar(64) NOT NULL,
    `storage_type` varchar(32) NOT NULL DEFAULT 'MINIO',
    `storage_bucket` varchar(128) NOT NULL,
    `storage_object_key` varchar(500) NOT NULL,
    `agent_doc_id` varchar(64) DEFAULT NULL,
    `chunk_count` int(11) DEFAULT 0,
    `retry_count` int(11) DEFAULT 0,
    `status` varchar(32) NOT NULL DEFAULT 'UPLOADED',
    `failure_reason` varchar(1000) DEFAULT NULL,
    `last_ingest_time` datetime DEFAULT NULL,
    `create_by` varchar(64) DEFAULT '',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `is_deleted` tinyint(1) DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_file_hash` (`file_hash`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`),
    KEY `idx_agent_doc_id` (`agent_doc_id`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `t_kb_ingest_task`;
CREATE TABLE `t_kb_ingest_task` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `document_id` bigint(20) NOT NULL,
    `task_type` varchar(32) NOT NULL,
    `attempt_no` int(11) NOT NULL DEFAULT 1,
    `status` varchar(32) NOT NULL DEFAULT 'PENDING',
    `agent_doc_id` varchar(64) DEFAULT NULL,
    `chunk_count` int(11) DEFAULT 0,
    `failure_reason` varchar(1000) DEFAULT NULL,
    `create_by` varchar(64) DEFAULT '',
    `started_at` datetime DEFAULT NULL,
    `finished_at` datetime DEFAULT NULL,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_document_id` (`document_id`),
    KEY `idx_task_status` (`status`),
    KEY `idx_task_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
