/*
 * 绠￠亾鑳借€楀垎鏋愮郴缁熸暟鎹簱鑴氭湰
 * 鏁版嵁搴? pipeline_cloud
 * 浣滆€? AI Assistant
 * 鏃ユ湡: 2025-11-19
 */

CREATE DATABASE IF NOT EXISTS `pipeline_cloud` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

USE `pipeline_cloud`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- 1. 椤圭洰琛?(t_project)
-- ----------------------------
DROP TABLE IF EXISTS `t_project`;
CREATE TABLE `t_project` (
  `pro_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '椤圭洰ID',
  `number` varchar(50) DEFAULT NULL COMMENT '椤圭洰缂栧彿',
  `name` varchar(100) DEFAULT NULL COMMENT '椤圭洰鍚嶇О',
  `responsible` varchar(50) DEFAULT NULL COMMENT '璐熻矗浜?,
  `build_date` datetime DEFAULT NULL COMMENT '鍒涘缓鏃ユ湡',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '璁板綍鍒涘缓鏃堕棿',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '璁板綍鏇存柊鏃堕棿',
  `is_deleted` tinyint(1) DEFAULT 0 COMMENT '閫昏緫鍒犻櫎(0:姝ｅ父, 1:鍒犻櫎)',
  PRIMARY KEY (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='椤圭洰淇℃伅琛?;

-- ----------------------------
-- 2. 绠￠亾鍙傛暟琛?(t_pipeline)
-- ----------------------------
DROP TABLE IF EXISTS `t_pipeline`;
CREATE TABLE `t_pipeline` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
  `pro_id` bigint(20) NOT NULL COMMENT '鍏宠仈椤圭洰ID',
  `name` varchar(100) DEFAULT NULL COMMENT '绠￠亾鍚嶇О',
  `length` decimal(10, 2) DEFAULT NULL COMMENT '绠￠亾闀垮害(km)',
  `diameter` decimal(10, 2) DEFAULT NULL COMMENT '绠￠亾澶栧緞(mm)',
  `thickness` decimal(10, 2) DEFAULT NULL COMMENT '澹佸帤(mm)',
  `throughput` decimal(10, 2) DEFAULT NULL COMMENT '璁捐骞磋緭閲?涓囧惃)',
  `start_altitude` decimal(10, 2) DEFAULT NULL COMMENT '璧风偣楂樼▼(m)',
  `end_altitude` decimal(10, 2) DEFAULT NULL COMMENT '缁堢偣楂樼▼(m)',
  `roughness` decimal(10, 4) DEFAULT NULL COMMENT '褰撻噺绮楃硻搴?m)',
  `work_time` decimal(10, 2) DEFAULT NULL COMMENT '骞村伐浣滄椂闂?h)',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`),
  KEY `idx_pro_id` (`pro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='绠￠亾鍙傛暟琛?;

-- ----------------------------
-- 3. 娉电珯鍙傛暟琛?(t_pump_station)
-- ----------------------------
DROP TABLE IF EXISTS `t_pump_station`;
CREATE TABLE `t_pump_station` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
  `name` varchar(100) DEFAULT NULL COMMENT '娉电珯鍚嶇О',
  `pump_efficiency` decimal(5, 2) DEFAULT NULL COMMENT '娉垫晥鐜?%)',
  `electric_efficiency` decimal(5, 2) DEFAULT NULL COMMENT '鐢垫満鏁堢巼(%)',
  `displacement` decimal(10, 2) DEFAULT NULL COMMENT '鎺掗噺(m3/h)',
  `come_power` decimal(10, 2) DEFAULT NULL COMMENT '杩涚珯鍘嬪姏/鍔熺巼',
  `zmi480_lift` decimal(10, 2) DEFAULT NULL COMMENT 'ZMI480鎵▼',
  `zmi375_lift` decimal(10, 2) DEFAULT NULL COMMENT 'ZMI375鎵▼',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='娉电珯鍙傛暟琛?;

-- ----------------------------
-- 4. 娌瑰搧鐗规€ц〃 (t_oil_property)
-- ----------------------------
DROP TABLE IF EXISTS `t_oil_property`;
CREATE TABLE `t_oil_property` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
  `name` varchar(50) DEFAULT NULL COMMENT '娌瑰搧鍚嶇О',
  `density` decimal(10, 2) DEFAULT NULL COMMENT '瀵嗗害(kg/m3)',
  `viscosity` decimal(10, 6) DEFAULT NULL COMMENT '杩愬姩绮樺害(m2/s)',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='娌瑰搧鐗规€ц〃';

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------
-- 5. 鐢ㄦ埛淇℃伅琛?-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
  `user_id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '鐢ㄦ埛ID',
  `dept_id` bigint(20) DEFAULT NULL COMMENT '閮ㄩ棬ID',
  `user_name` varchar(30) NOT NULL COMMENT '鐢ㄦ埛璐﹀彿',
  `nick_name` varchar(30) NOT NULL COMMENT '鐢ㄦ埛鏄电О',
  `user_type` varchar(2) DEFAULT '00' COMMENT '鐢ㄦ埛绫诲瀷锛?0绯荤粺鐢ㄦ埛锛?,
  `email` varchar(50) DEFAULT '' COMMENT '鐢ㄦ埛閭',
  `phonenumber` varchar(11) DEFAULT '' COMMENT '鎵嬫満鍙风爜',
  `sex` char(1) DEFAULT '0' COMMENT '鐢ㄦ埛鎬у埆锛?鐢?1濂?2鏈煡锛?,
  `avatar` varchar(100) DEFAULT '' COMMENT '澶村儚鍦板潃',
  `password` varchar(100) DEFAULT '' COMMENT '瀵嗙爜',
  `status` char(1) DEFAULT '0' COMMENT '甯愬彿鐘舵€侊紙0姝ｅ父 1鍋滅敤锛?,
  `del_flag` char(1) DEFAULT '0' COMMENT '鍒犻櫎鏍囧織锛?浠ｈ〃瀛樺湪 2浠ｈ〃鍒犻櫎锛?,
  `login_ip` varchar(128) DEFAULT '' COMMENT '鏈€鍚庣櫥褰旾P',
  `login_date` datetime DEFAULT NULL COMMENT '鏈€鍚庣櫥褰曟椂闂?,
  `create_by` varchar(64) DEFAULT '' COMMENT '鍒涘缓鑰?,
  `create_time` datetime DEFAULT NULL COMMENT '鍒涘缓鏃堕棿',
  `update_by` varchar(64) DEFAULT '' COMMENT '鏇存柊鑰?,
  `update_time` datetime DEFAULT NULL COMMENT '鏇存柊鏃堕棿',
  `remark` varchar(500) DEFAULT NULL COMMENT '澶囨敞',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=100 DEFAULT CHARSET=utf8mb4 COMMENT='鐢ㄦ埛淇℃伅琛?;

-- ----------------------------
-- 鍒濆鍖?鐢ㄦ埛淇℃伅琛ㄦ暟鎹?-- 瀵嗙爜涓?admin123 鐨?BCrypt 鍔犲瘑瀵嗘枃
-- ----------------------------
INSERT INTO `sys_user` VALUES (1, 103, 'admin', '绠＄悊鍛?, '00', 'admin@pipeline.com', '15888888888', '0', '', '$2a$10$7JB720yubVSZvJW8KegC5.ZaL9m6WfC9UwYx4kd8BUPEqVQJqAFFu', '0', '0', '127.0.0.1', sysdate(), 'admin', sysdate(), '', null, '绯荤粺绠＄悊鍛?);


-- ============================================================
-- 6. 璁＄畻鍘嗗彶璁板綍琛?(t_calculation_history)
-- ============================================================
DROP TABLE IF EXISTS `t_calculation_history`;
CREATE TABLE `t_calculation_history` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
    `pro_id` bigint(20) NOT NULL COMMENT '椤圭洰ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '绠￠亾ID',
    `calc_type` varchar(50) NOT NULL COMMENT '璁＄畻绫诲瀷: HYDRAULIC-姘村姏鍒嗘瀽, OPTIMIZATION-娉电珯浼樺寲',
    `calc_name` varchar(100) DEFAULT NULL COMMENT '璁＄畻鍚嶇О/澶囨敞',
    `input_params` json NOT NULL COMMENT '杈撳叆鍙傛暟JSON',
    `flow_rate` decimal(12, 4) DEFAULT NULL COMMENT '娴侀噺(m鲁/h)',
    `flow_velocity` decimal(12, 6) DEFAULT NULL COMMENT '娴侀€?m/s)',
    `reynolds_number` decimal(20, 4) DEFAULT NULL COMMENT '闆疯鏁?,
    `flow_regime` varchar(50) DEFAULT NULL COMMENT '娴佹€?,
    `friction_factor` decimal(12, 8) DEFAULT NULL COMMENT '鎽╅樆绯绘暟',
    `friction_loss` decimal(16, 4) DEFAULT NULL COMMENT '娌跨▼鎽╅樆鎹熷け(m)',
    `hydraulic_slope` decimal(12, 8) DEFAULT NULL COMMENT '姘村姏鍧￠檷',
    `optimal_pump480` int(11) DEFAULT NULL COMMENT '鏈€浼樻柟妗?ZMI480娉垫暟閲?,
    `optimal_pump375` int(11) DEFAULT NULL COMMENT '鏈€浼樻柟妗?ZMI375娉垫暟閲?,
    `total_head` decimal(16, 4) DEFAULT NULL COMMENT '鎬绘壃绋?m)',
    `end_station_pressure` decimal(16, 4) DEFAULT NULL COMMENT '鏈珯杩涚珯鍘嬪姏(m)',
    `energy_consumption` decimal(20, 2) DEFAULT NULL COMMENT '骞磋兘鑰?kWh)',
    `annual_cost` decimal(20, 2) DEFAULT NULL COMMENT '骞磋繍琛岃垂鐢?鍏?',
    `output_result` json DEFAULT NULL COMMENT '瀹屾暣杈撳嚭缁撴灉JSON',
    `create_by` varchar(64) DEFAULT '' COMMENT '鍒涘缓浜?,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
    `remark` varchar(500) DEFAULT NULL COMMENT '澶囨敞',
    PRIMARY KEY (`id`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_calc_type` (`calc_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='璁＄畻鍘嗗彶璁板綍琛?;


-- ============================================================
-- 7. 鍒嗘瀽鎶ュ憡琛?(t_analysis_report)
-- ============================================================
DROP TABLE IF EXISTS `t_analysis_report`;
CREATE TABLE `t_analysis_report` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
    `pro_id` bigint(20) NOT NULL DEFAULT 0 COMMENT '椤圭洰ID',
    `pipeline_id` bigint(20) DEFAULT NULL COMMENT '绠￠亾ID',
    `report_no` varchar(50) NOT NULL COMMENT '鎶ュ憡缂栧彿',
    `report_type` varchar(50) NOT NULL COMMENT '鎶ュ憡绫诲瀷',
    `report_title` varchar(200) NOT NULL COMMENT '鎶ュ憡鏍囬',
    `report_summary` text DEFAULT NULL COMMENT '鎶ュ憡鎽樿',
    `file_name` varchar(200) DEFAULT NULL COMMENT '鏂囦欢鍚?,
    `file_path` varchar(500) DEFAULT NULL COMMENT '鏂囦欢瀛樺偍璺緞',
    `file_format` varchar(20) DEFAULT 'DOCX' COMMENT '鏂囦欢鏍煎紡',
    `file_size` bigint(20) DEFAULT NULL COMMENT '鏂囦欢澶у皬(bytes)',
    `history_ids` varchar(500) DEFAULT NULL COMMENT '鍏宠仈鐨勮绠楀巻鍙睮D鍒楄〃',
    `status` tinyint(4) NOT NULL DEFAULT 0 COMMENT '鐘舵€? 0-鐢熸垚涓? 1-宸插畬鎴? 2-鐢熸垚澶辫触',
    `error_msg` varchar(500) DEFAULT NULL COMMENT '閿欒淇℃伅',
    `create_by` varchar(64) DEFAULT '' COMMENT '鍒涘缓浜?,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '鏇存柊鏃堕棿',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_report_no` (`report_no`),
    KEY `idx_pro_id` (`pro_id`),
    KEY `idx_report_type` (`report_type`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鍒嗘瀽鎶ュ憡琛?;


-- ============================================================
-- 8. 鏁忔劅鎬у垎鏋愮粨鏋滆〃 (t_sensitivity_analysis)
-- ============================================================
DROP TABLE IF EXISTS `t_sensitivity_analysis`;
CREATE TABLE `t_sensitivity_analysis` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
    `pipeline_id` bigint(20) NOT NULL COMMENT '绠￠亾ID',
    `history_id` bigint(20) DEFAULT NULL COMMENT '鍩哄噯璁＄畻鍘嗗彶ID',
    `analysis_type` varchar(50) NOT NULL COMMENT '鍒嗘瀽绫诲瀷',
    `variable_name` varchar(50) NOT NULL COMMENT '鍒嗘瀽鍙橀噺',
    `base_value` decimal(20, 6) NOT NULL COMMENT '鍩哄噯鍊?,
    `variation_range` decimal(5, 2) NOT NULL COMMENT '鍙樺寲鑼冨洿(%)',
    `steps` int(11) NOT NULL DEFAULT 5 COMMENT '鍒嗘瀽姝ユ暟',
    `results` json NOT NULL COMMENT '鍒嗘瀽缁撴灉JSON鏁扮粍',
    `conclusion` text DEFAULT NULL COMMENT '鍒嗘瀽缁撹',
    `sensitivity_index` decimal(10, 4) DEFAULT NULL COMMENT '鏁忔劅鎬ф寚鏁?,
    `create_by` varchar(64) DEFAULT '' COMMENT '鍒涘缓浜?,
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
    PRIMARY KEY (`id`),
    KEY `idx_pipeline_id` (`pipeline_id`),
    KEY `idx_variable_name` (`variable_name`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鏁忔劅鎬у垎鏋愮粨鏋滆〃';


-- ============================================================
-- 9. 鎿嶄綔鏃ュ織琛?(t_operation_log)
-- ============================================================
DROP TABLE IF EXISTS `t_operation_log`;
CREATE TABLE `t_operation_log` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '涓婚敭ID',
    `user_id` bigint(20) DEFAULT NULL COMMENT '鐢ㄦ埛ID',
    `user_name` varchar(64) DEFAULT '' COMMENT '鐢ㄦ埛鍚?,
    `module` varchar(50) DEFAULT '' COMMENT '妯″潡鍚嶇О',
    `operation` varchar(100) DEFAULT '' COMMENT '鎿嶄綔鎻忚堪',
    `method` varchar(200) DEFAULT '' COMMENT '璇锋眰鏂规硶',
    `request_url` varchar(500) DEFAULT '' COMMENT '璇锋眰URL',
    `request_method` varchar(10) DEFAULT '' COMMENT 'HTTP鏂规硶',
    `request_params` text DEFAULT NULL COMMENT '璇锋眰鍙傛暟',
    `response_result` text DEFAULT NULL COMMENT '鍝嶅簲缁撴灉',
    `ip` varchar(64) DEFAULT '' COMMENT 'IP鍦板潃',
    `location` varchar(100) DEFAULT '' COMMENT '鎿嶄綔鍦扮偣',
    `cost_time` bigint(20) DEFAULT 0 COMMENT '鑰楁椂(ms)',
    `status` tinyint(4) DEFAULT 0 COMMENT '鐘舵€? 0-鎴愬姛, 1-澶辫触',
    `error_msg` text DEFAULT NULL COMMENT '閿欒淇℃伅',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '鍒涘缓鏃堕棿',
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_module` (`module`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='鎿嶄綔鏃ュ織琛?;

