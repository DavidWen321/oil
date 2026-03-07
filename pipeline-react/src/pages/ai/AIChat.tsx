import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  FloatButton,
  Input,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ClearOutlined,
  DownOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import AnimatedPage from '../../components/common/AnimatedPage';
import { ChatMessage, HITLDialog, TracePanel } from '../../components/agent';
import MessageSkeleton from '../../components/agent/MessageSkeleton';
import { useAgentTrace } from '../../hooks/useAgentTrace';
import { useScrollToBottom } from '../../hooks/useScrollToBottom';
import type { ChatMessageItem } from '../../types';

const QUICK_PROMPTS = [
  '分析 900 m³/h 工况下的能耗瓶颈，并给出优化建议',
  '比较两套泵站运行方案的成本与安全性差异',
  '结合当前数据给出一份可执行的节能调度建议',
];

const INITIAL_MESSAGE: ChatMessageItem = {
  role: 'assistant',
  content:
    '我是管道能耗分析智能体。你可以直接输入项目工况、优化目标或诊断问题，我会调用知识库、计算服务和数据库完成分析。',
};

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲',
  planning: '规划中',
  executing: '执行中',
  waiting_hitl: '等待人工确认',
  completed: '已完成',
  error: '失败',
};

const STATUS_COLOR: Record<string, string> = {
  idle: 'default',
  planning: 'processing',
  executing: 'processing',
  waiting_hitl: 'warning',
  completed: 'success',
  error: 'error',
};

export default function AIChat() {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessageItem[]>([INITIAL_MESSAGE]);
  const {
    activeTools,
    connected,
    currentStep,
    dismissHITL,
    finalResponse,
    hitlRequest,
    lastToolSearch,
    logs,
    metrics,
    plan,
    reset,
    startChat,
    status,
    streaming,
    submitHITL,
  } = useAgentTrace('pipeline-web-session');

  const busy = ['planning', 'executing', 'waiting_hitl'].includes(status);

  // 滚动到底部 Hook
  const { ref: messagesRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>(
    [messages, finalResponse, streaming],
    { enabled: true, behavior: 'smooth', threshold: 100 }
  );

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 0 || prev[prev.length - 1].role !== 'assistant') {
        return prev;
      }

      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      const errorText = logs.length > 0 ? logs[logs.length - 1].text : 'Agent 服务执行失败';
      const nextContent = status === 'error' && !finalResponse ? `请求失败：${errorText}` : finalResponse;
      const nextStreaming = streaming || status === 'planning' || status === 'executing' || status === 'waiting_hitl';

      if (
        last.content === nextContent &&
        last.streaming === nextStreaming &&
        last.tools === activeTools
      ) {
        return prev;
      }

      next[lastIndex] = {
        ...last,
        content: nextContent,
        streaming: nextStreaming,
        tools: activeTools,
      };
      return next;
    });
  }, [activeTools, finalResponse, logs, status, streaming]);

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content || busy) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: 'user', content },
      { role: 'assistant', content: '', streaming: true, tools: [] },
    ]);
    setDraft('');
    startChat(content);
  };

  const statusTagColor = STATUS_COLOR[status] ?? 'default';
  const toolSearchSummary = useMemo(() => {
    if (!lastToolSearch || lastToolSearch.selected_tools.length === 0) {
      return '等待工具选择';
    }
    return lastToolSearch.selected_tools.join(' / ');
  }, [lastToolSearch]);

  return (
    <AnimatedPage>
      <div className="page-header">
        <h2><RobotOutlined /> 智能分析助手</h2>
        <p>基于真实 LangGraph Trace、工具调用和 HITL 审批链路的生产化 AI 分析界面。</p>
      </div>

      <Row gutter={16}>
        <Col xs={24} xl={14}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card className="page-card">
              <Space wrap>
                <Tag color={statusTagColor}>{STATUS_LABEL[status] ?? status}</Tag>
                <Tag color={connected ? 'success' : 'default'}>{connected ? '流式连接已建立' : '等待连接'}</Tag>
                <Tag color="blue">工具搜索：{toolSearchSummary}</Tag>
              </Space>
              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    block
                    disabled={busy}
                    icon={<ThunderboltOutlined />}
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </Card>

            <Card className="page-card" bodyStyle={{ padding: 16, position: 'relative' }}>
              <div
                ref={messagesRef}
                style={{
                  display: 'grid',
                  gap: 12,
                  minHeight: 520,
                  maxHeight: 600,
                  overflowY: 'auto',
                  paddingRight: 8,
                }}
              >
                {messages.map((item, index) => (
                  <ChatMessage
                    key={`${item.role}-${index}`}
                    role={item.role}
                    content={item.content}
                    streaming={item.streaming}
                    tools={item.tools}
                  />
                ))}
                {busy && !finalResponse && <MessageSkeleton />}
              </div>

              {/* 滚动到底部按钮 */}
              {!isAtBottom && (
                <FloatButton
                  icon={<DownOutlined />}
                  onClick={scrollToBottom}
                  style={{ position: 'absolute', right: 24, bottom: 24 }}
                  tooltip="滚动到底部"
                />
              )}
            </Card>

            <Card className="page-card">
              <Input.TextArea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="输入你的项目问题，例如：分析某条管道在当前流量下的能耗瓶颈，并给出优化建议。"
                autoSize={{ minRows: 4, maxRows: 8 }}
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    sendMessage(draft);
                  }
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 12 }}>
                <Typography.Text type="secondary">
                  Enter 发送，Shift + Enter 换行；需要人工确认时会弹出审批对话框。
                </Typography.Text>
                <Space>
                  <Button icon={<ClearOutlined />} onClick={() => {
                    reset();
                    setDraft('');
                    setMessages([INITIAL_MESSAGE]);
                  }}>
                    清空界面
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    disabled={!draft.trim() || busy}
                    onClick={() => sendMessage(draft)}
                  >
                    发送
                  </Button>
                </Space>
              </div>
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="page-card" title="执行追踪" style={{ height: '100%' }}>
            <TracePanel
              plan={plan}
              currentStep={currentStep}
              logs={logs}
              metrics={metrics}
              activeTools={activeTools}
              toolSearch={lastToolSearch}
            />
          </Card>
        </Col>
      </Row>

      <HITLDialog
        request={hitlRequest}
        onSubmit={submitHITL}
        onCancel={dismissHITL}
      />
    </AnimatedPage>
  );
}
