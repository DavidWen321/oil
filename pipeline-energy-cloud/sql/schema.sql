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
