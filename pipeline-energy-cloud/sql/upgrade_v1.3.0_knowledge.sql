/*
 * 管道能耗分析系统 - 知识库录入第一阶段升级脚本
 * 版本: v1.3.0
 * 日期: 2026-03-23
 * 说明: 新增知识库文档元数据表
 */

USE `pipeline_cloud`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `t_kb_document` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `title` varchar(200) NOT NULL COMMENT '文档标题',
    `category` varchar(50) NOT NULL COMMENT '知识分类',
    `source_type` varchar(50) DEFAULT NULL COMMENT '来源类型',
    `tags` varchar(500) DEFAULT NULL COMMENT '标签，逗号分隔',
    `remark` varchar(1000) DEFAULT NULL COMMENT '录入说明',
    `file_name` varchar(255) NOT NULL COMMENT '原始文件名',
    `file_extension` varchar(20) DEFAULT NULL COMMENT '文件扩展名',
    `file_size` bigint(20) DEFAULT 0 COMMENT '文件大小，单位字节',
    `agent_doc_id` varchar(64) DEFAULT NULL COMMENT 'Python Agent 侧文档ID',
    `chunk_count` int(11) DEFAULT 0 COMMENT '切片数量',
    `status` varchar(32) NOT NULL DEFAULT 'PENDING' COMMENT '文档状态：PENDING/INDEXED/FAILED',
    `failure_reason` varchar(1000) DEFAULT NULL COMMENT '失败原因',
    `create_by` varchar(64) DEFAULT '' COMMENT '创建人',
    `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `is_deleted` tinyint(1) DEFAULT 0 COMMENT '逻辑删除',
    PRIMARY KEY (`id`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`),
    KEY `idx_agent_doc_id` (`agent_doc_id`),
    KEY `idx_create_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文档元数据表';

SET FOREIGN_KEY_CHECKS = 1;

SELECT '数据库已升级至 v1.3.0（知识库录入第一阶段）' AS message;
