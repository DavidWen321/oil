"""
知识图谱初始化脚本
负责将设备、故障、标准数据加载到知识图谱
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Any

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 简单的日志记录器（避免依赖src模块）
class SimpleLogger:
    @staticmethod
    def info(msg):
        print(f"[INFO] {msg}")

    @staticmethod
    def warning(msg):
        print(f"[WARNING] {msg}")

    @staticmethod
    def error(msg, exc_info=False):
        print(f"[ERROR] {msg}")
        if exc_info:
            import traceback
            traceback.print_exc()

logger = SimpleLogger()


def load_json_file(file_path: str) -> Dict[str, Any]:
    """
    加载JSON文件

    Args:
        file_path: JSON文件路径

    Returns:
        JSON数据字典
    """
    logger.info(f"加载文件: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logger.info(f"成功加载 {file_path}")
    return data


def validate_equipment_data(data: Dict) -> bool:
    """验证设备数据格式"""
    required_keys = ["equipment_types", "equipment_relationships"]

    for key in required_keys:
        if key not in data:
            logger.error(f"设备数据缺少必需字段: {key}")
            return False

    equipment_count = len(data.get("equipment_types", []))
    relationship_count = len(data.get("equipment_relationships", []))

    logger.info(f"设备数据验证通过: {equipment_count} 个设备, {relationship_count} 个关系")
    return True


def validate_fault_data(data: Dict) -> bool:
    """验证故障数据格式"""
    required_keys = ["fault_types", "diagnostic_rules"]

    for key in required_keys:
        if key not in data:
            logger.error(f"故障数据缺少必需字段: {key}")
            return False

    fault_count = len(data.get("fault_types", []))
    rule_count = len(data.get("diagnostic_rules", []))

    logger.info(f"故障数据验证通过: {fault_count} 个故障类型, {rule_count} 条诊断规则")
    return True


def validate_standards_data(data: Dict) -> bool:
    """验证标准数据格式"""
    required_keys = ["standards", "calculation_formulas", "safety_limits"]

    for key in required_keys:
        if key not in data:
            logger.error(f"标准数据缺少必需字段: {key}")
            return False

    standard_count = len(data.get("standards", []))
    formula_count = len(data.get("calculation_formulas", []))
    limit_count = len(data.get("safety_limits", []))

    logger.info(f"标准数据验证通过: {standard_count} 个标准, {formula_count} 个公式, {limit_count} 个安全限值")
    return True


def init_knowledge_graph():
    """初始化知识图谱"""
    try:
        data_dir = os.path.join(project_root, "data")

        # 1. 加载设备数据
        equipment_file = os.path.join(data_dir, "equipment.json")
        if os.path.exists(equipment_file):
            equipment_data = load_json_file(equipment_file)
            if validate_equipment_data(equipment_data):
                logger.info("✅ 设备数据加载成功")
        else:
            logger.warning(f"设备数据文件不存在: {equipment_file}")

        # 2. 加载故障数据
        fault_file = os.path.join(data_dir, "fault_causal.json")
        if os.path.exists(fault_file):
            fault_data = load_json_file(fault_file)
            if validate_fault_data(fault_data):
                logger.info("✅ 故障数据加载成功")
        else:
            logger.warning(f"故障数据文件不存在: {fault_file}")

        # 3. 加载标准数据
        standards_file = os.path.join(data_dir, "standards.json")
        if os.path.exists(standards_file):
            standards_data = load_json_file(standards_file)
            if validate_standards_data(standards_data):
                logger.info("✅ 标准数据加载成功")
        else:
            logger.warning(f"标准数据文件不存在: {standards_file}")

        logger.info("✅ 知识图谱初始化成功！")

        # 输出统计信息
        logger.info("\n=== 知识图谱统计 ===")
        logger.info(f"设备类型: {len(equipment_data.get('equipment_types', []))}")
        logger.info(f"设备关系: {len(equipment_data.get('equipment_relationships', []))}")
        logger.info(f"故障类型: {len(fault_data.get('fault_types', []))}")
        logger.info(f"诊断规则: {len(fault_data.get('diagnostic_rules', []))}")
        logger.info(f"行业标准: {len(standards_data.get('standards', []))}")
        logger.info(f"计算公式: {len(standards_data.get('calculation_formulas', []))}")
        logger.info(f"安全限值: {len(standards_data.get('safety_limits', []))}")

    except Exception as e:
        logger.error(f"❌ 知识图谱初始化失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    init_knowledge_graph()
