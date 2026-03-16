"""
Supervisor Agent
负责意图理解、任务分解和Agent调度
"""

import json
from typing import Callable, Generator, List, Dict, Any, Optional

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from src.config import settings
from src.utils import logger, generate_task_id
from src.models.enums import IntentType, AgentType
from src.models.state import AgentState, SubTask
from .prompts import (
    SUPERVISOR_SYSTEM_PROMPT,
    SUPERVISOR_TASK_PROMPT,
    INTENT_CLASSIFICATION_PROMPT,
    SYNTHESIS_PROMPT
)


class SupervisorAgent:
    """
    Supervisor Agent

    职责：
    1. 分析用户意图
    2. 分解任务
    3. 调度其他Agent
    4. 汇总结果
    """

    def __init__(self):
        """初始化Supervisor"""
        self._llm = None

    @property
    def llm(self) -> ChatOpenAI:
        """获取LLM实例"""
        if self._llm is None:
            self._llm = ChatOpenAI(
                api_key=settings.OPENAI_API_KEY,
                base_url=settings.OPENAI_API_BASE,
                model=settings.LLM_MODEL,
                temperature=0.1,
                max_tokens=2000
            )
        return self._llm

    def analyze_intent(self, user_input: str) -> Dict[str, Any]:
        """
        分析用户意图并分解任务

        Args:
            user_input: 用户输入

        Returns:
            {
                "intent": "意图类型",
                "sub_tasks": [...],
                "reasoning": "推理过程"
            }
        """
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", SUPERVISOR_SYSTEM_PROMPT),
                ("human", SUPERVISOR_TASK_PROMPT)
            ])

            chain = prompt | self.llm | StrOutputParser()

            response = chain.invoke({"user_input": user_input})

            # 解析JSON响应
            result = self._parse_decision(response)

            logger.info(f"Supervisor决策: intent={result.get('intent')}, "
                        f"tasks={len(result.get('sub_tasks', []))}")

            return result

        except Exception as e:
            logger.error(f"Supervisor分析失败: {e}")
            # 降级处理
            return self._fallback_decision(user_input)

    def classify_intent(self, user_input: str) -> IntentType:
        """
        快速意图分类

        Args:
            user_input: 用户输入

        Returns:
            意图类型
        """
        try:
            prompt = ChatPromptTemplate.from_template(INTENT_CLASSIFICATION_PROMPT)
            chain = prompt | self.llm | StrOutputParser()

            response = chain.invoke({"user_input": user_input}).strip().lower()

            # 映射到IntentType
            intent_mapping = {
                "query": IntentType.QUERY,
                "calculate": IntentType.CALCULATE,
                "knowledge": IntentType.KNOWLEDGE,
                "complex": IntentType.COMPLEX,
                "chat": IntentType.CHAT
            }

            for key, intent in intent_mapping.items():
                if key in response:
                    return intent

            return IntentType.KNOWLEDGE  # 默认

        except Exception as e:
            logger.warning(f"意图分类失败: {e}")
            return IntentType.KNOWLEDGE

    def create_sub_tasks(self, decision: Dict[str, Any]) -> List[SubTask]:
        """
        从决策创建子任务列表

        Args:
            decision: Supervisor决策

        Returns:
            子任务列表
        """
        sub_tasks = []
        raw_tasks = decision.get("sub_tasks", [])

        for i, task_info in enumerate(raw_tasks):
            sub_task = SubTask(
                id=generate_task_id(),
                agent=task_info.get("agent", "knowledge_agent"),
                task=task_info.get("task", ""),
                depends_on=task_info.get("depends_on", []),
                status="pending",
                result=None
            )
            sub_tasks.append(sub_task)

        return sub_tasks

    def determine_next_agent(self, state: AgentState) -> Optional[str]:
        """
        确定下一个执行的Agent

        Args:
            state: 当前状态

        Returns:
            下一个Agent名称，None表示结束
        """
        sub_tasks = state.get("sub_tasks", [])
        completed = state.get("completed_tasks", [])
        current_index = state.get("current_task_index", 0)

        if current_index >= len(sub_tasks):
            return None  # 所有任务完成

        current_task = sub_tasks[current_index]

        # 检查依赖是否完成
        depends_on = current_task.get("depends_on", [])
        completed_ids = {t.get("id") for t in completed}

        for dep_id in depends_on:
            if dep_id not in completed_ids:
                logger.warning(f"任务 {current_task['id']} 依赖 {dep_id} 未完成")
                return None

        return current_task.get("agent")

    def synthesize_response(
        self,
        user_input: str,
        completed_tasks: List[Dict],
        intent: str
    ) -> str:
        """
        汇总各Agent结果生成最终回答

        Args:
            user_input: 用户输入
            completed_tasks: 已完成的任务列表
            intent: 意图类型

        Returns:
            最终回答
        """
        if not completed_tasks:
            return "抱歉，无法处理您的请求。"

        # 简单任务直接返回结果
        if len(completed_tasks) == 1:
            result = completed_tasks[0].get("result", "")
            if result:
                return result

        # 复杂任务需要汇总
        try:
            # 构建Agent结果摘要
            results_text = []
            for task in completed_tasks:
                agent = task.get("agent", "unknown")
                task_desc = task.get("task", "")
                result = task.get("result", "无结果")
                results_text.append(f"[{agent}] {task_desc}\n结果: {result}")

            agent_results = "\n\n".join(results_text)

            prompt = ChatPromptTemplate.from_template(SYNTHESIS_PROMPT)
            chain = prompt | self.llm | StrOutputParser()

            response = chain.invoke({
                "user_input": user_input,
                "agent_results": agent_results
            })

            return response.strip()

        except Exception as e:
            logger.error(f"结果汇总失败: {e}")
            # 降级：拼接所有结果
            return "\n\n".join([
                str(t.get("result", "")) for t in completed_tasks if t.get("result")
            ])

    def synthesize_response_stream(
        self,
        user_input: str,
        completed_tasks: List[Dict],
        intent: str,
        on_chunk: Optional[Callable[[str], None]] = None,
    ) -> str:
        """流式汇总各 Agent 结果，每个 token 通过 on_chunk 回调发出。"""

        if not completed_tasks:
            text = "抱歉，无法处理您的请求。"
            if on_chunk:
                on_chunk(text)
            return text

        # 单任务直接流式返回结果
        if len(completed_tasks) == 1:
            result = completed_tasks[0].get("result", "")
            if result:
                if on_chunk:
                    on_chunk(result)
                return result

        # 复杂任务用 LLM 流式合成
        try:
            results_text = []
            for task in completed_tasks:
                agent = task.get("agent", "unknown")
                task_desc = task.get("task", "")
                result = task.get("result", "无结果")
                results_text.append(f"[{agent}] {task_desc}\n结果: {result}")

            agent_results = "\n\n".join(results_text)

            prompt = ChatPromptTemplate.from_template(SYNTHESIS_PROMPT)
            chain = prompt | self.llm

            full_text = ""
            for chunk in chain.stream({
                "user_input": user_input,
                "agent_results": agent_results,
            }):
                token = chunk.content if hasattr(chunk, "content") else str(chunk)
                if token:
                    full_text += token
                    if on_chunk:
                        on_chunk(token)

            return full_text.strip()

        except Exception as e:
            logger.error(f"流式汇总失败: {e}")
            fallback = "\n\n".join([
                str(t.get("result", "")) for t in completed_tasks if t.get("result")
            ])
            if on_chunk:
                on_chunk(fallback)
            return fallback

    def handle_chat(self, user_input: str) -> str:
        """
        处理闲聊类型的输入

        Args:
            user_input: 用户输入

        Returns:
            回复
        """
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "你是管道能耗分析系统的AI助手。对于与系统功能无关的问题，"
                          "请礼貌地告知用户你主要帮助处理管道工程相关的问题。"),
                ("human", "{input}")
            ])

            chain = prompt | self.llm | StrOutputParser()
            return chain.invoke({"input": user_input})

        except Exception as e:
            logger.error(f"闲聊处理失败: {e}")
            return "我是管道能耗分析系统的AI助手，主要帮助您解答管道工程相关问题。请问有什么可以帮您？"

    def _parse_decision(self, response: str) -> Dict[str, Any]:
        """解析Supervisor的JSON决策"""
        try:
            # 提取JSON部分
            start = response.find("{")
            end = response.rfind("}") + 1

            if start >= 0 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
            else:
                raise ValueError("响应中未找到JSON")

        except json.JSONDecodeError as e:
            logger.warning(f"JSON解析失败: {e}")
            return self._extract_decision_from_text(response)

    def _extract_decision_from_text(self, response: str) -> Dict[str, Any]:
        """从非JSON响应中提取决策"""
        response_lower = response.lower()

        # 简单规则判断
        if "查询" in response or "数据" in response:
            intent = "query"
            agent = "data_agent"
        elif "计算" in response or "雷诺" in response or "摩阻" in response:
            intent = "calculate"
            agent = "calc_agent"
        elif "知识" in response or "概念" in response or "什么是" in response:
            intent = "knowledge"
            agent = "knowledge_agent"
        else:
            intent = "chat"
            agent = None

        result = {
            "intent": intent,
            "sub_tasks": [],
            "reasoning": "从文本响应中提取"
        }

        if agent:
            result["sub_tasks"].append({
                "agent": agent,
                "task": "处理用户请求",
                "depends_on": []
            })

        return result

    def _fallback_decision(self, user_input: str) -> Dict[str, Any]:
        """降级决策"""
        # 简单关键词匹配
        user_lower = user_input.lower()

        if any(kw in user_lower for kw in ["项目", "管道", "泵站", "查询", "多少"]):
            return {
                "intent": "query",
                "sub_tasks": [{"agent": "data_agent", "task": user_input, "depends_on": []}],
                "reasoning": "关键词匹配-数据查询"
            }
        elif any(kw in user_lower for kw in ["计算", "雷诺", "摩阻", "流量", "扬程"]):
            return {
                "intent": "calculate",
                "sub_tasks": [{"agent": "calc_agent", "task": user_input, "depends_on": []}],
                "reasoning": "关键词匹配-计算"
            }
        else:
            return {
                "intent": "knowledge",
                "sub_tasks": [{"agent": "knowledge_agent", "task": user_input, "depends_on": []}],
                "reasoning": "默认-知识问答"
            }


# 全局实例
_supervisor: Optional[SupervisorAgent] = None


def get_supervisor() -> SupervisorAgent:
    """获取Supervisor实例"""
    global _supervisor
    if _supervisor is None:
        _supervisor = SupervisorAgent()
    return _supervisor
