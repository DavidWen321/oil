USE `pipeline_cloud`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `t_kb_document`
    ADD COLUMN `author` varchar(100) DEFAULT NULL AFTER `remark`,
    ADD COLUMN `summary` varchar(1000) DEFAULT NULL AFTER `author`,
    ADD COLUMN `language` varchar(20) DEFAULT 'zh-CN' AFTER `summary`,
    ADD COLUMN `version` varchar(50) DEFAULT NULL AFTER `language`,
    ADD COLUMN `external_id` varchar(100) DEFAULT NULL AFTER `version`,
    ADD COLUMN `effective_at` datetime DEFAULT NULL AFTER `external_id`;

UPDATE `t_kb_document`
SET `language` = COALESCE(NULLIF(`language`, ''), 'zh-CN');

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'knowledge metadata upgrade complete' AS message;
