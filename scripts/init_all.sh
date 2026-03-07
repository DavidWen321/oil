#!/bin/bash

# 油管能耗分析系统 - 快速初始化脚本
# 用于初始化知识图谱和RAG知识库

set -e

echo "=========================================="
echo "  油管能耗分析系统 - 数据初始化"
echo "=========================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# 检查Python环境
if ! command -v python &> /dev/null; then
    echo "❌ 错误: 未找到Python，请先安装Python 3.11+"
    exit 1
fi

echo "✅ Python环境检查通过"
echo ""

# 1. 初始化知识图谱
echo "=== 步骤 1/2: 初始化知识图谱 ==="
echo "加载设备、故障、标准数据..."
python scripts/init_knowledge_graph.py

if [ $? -eq 0 ]; then
    echo "✅ 知识图谱初始化成功"
else
    echo "❌ 知识图谱初始化失败"
    exit 1
fi

echo ""

# 2. 初始化RAG知识库
echo "=== 步骤 2/2: 初始化RAG知识库 ==="
echo "加载知识文档到Milvus向量数据库..."

# 检查知识库目录
if [ ! -d "$PROJECT_ROOT/knowledge_base" ]; then
    echo "⚠️  警告: knowledge_base目录不存在，跳过RAG初始化"
    echo "   请先创建知识库文档后再运行此步骤"
else
    python scripts/init_knowledge_base.py

    if [ $? -eq 0 ]; then
        echo "✅ RAG知识库初始化成功"
    else
        echo "❌ RAG知识库初始化失败"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "  🎉 初始化完成！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "  1. 启动Java后端服务: cd pipeline-energy-cloud && mvn spring-boot:run"
echo "  2. 启动Python AI服务: cd pipeline-agent && python -m src.main"
echo "  3. 访问前端页面: http://localhost:5173"
echo ""
