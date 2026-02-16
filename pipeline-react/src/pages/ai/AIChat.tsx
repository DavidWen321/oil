import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Space, Typography } from 'antd';
import { SendOutlined, ReloadOutlined } from '@ant-design/icons';
import { HITLDialog, TracePanel, GraphViewer, MarkdownRenderer } from '../../components/agent';
import { agentApi } from '../../api/agent';
import { useAgentTrace } from '../../hooks/useAgentTrace';
import type { HITLResponse } from '../../types/agent';
import AnimatedPage from '../../components/common/AnimatedPage';
import styles from './AIChat.module.css';

const { Text } = Typography;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

export default function AIChat() {
  const sessionIdRef = useRef(createSessionId());
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [graphData, setGraphData] = useState<{ nodes?: any[]; edges?: any[] }>({
    nodes: [],
    edges: [],
  });

  const {
    status,
    finalResponse,
    plan,
    currentStep,
    logs,
    metrics,
    hitlRequest,
    startChat,
    submitHITL,
    dismissHITL,
    reset,
    streaming,
  } = useAgentTrace(sessionIdRef.current);

  const sending = streaming || status === 'planning' || status === 'executing';

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => Boolean(input.trim()) && !sending, [input, sending]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending, finalResponse]);

  // 只在流完成后，将最终响应加入历史消息
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasActive = prevStatusRef.current === 'executing' || prevStatusRef.current === 'planning';
    prevStatusRef.current = status;

    if (status === 'completed' && wasActive && finalResponse) {
      setMessages((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && prev[prev.length - 1].content === finalResponse) {
          return prev;
        }
        return [...prev, { role: 'assistant', content: finalResponse }];
      });
    }
  }, [status, finalResponse]);

  const handleSend = () => {
    const message = input.trim();
    if (!message || sending) {
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');

    // Start SSE stream (XHR-based, non-blocking)
    startChat(message);

    // Fire-and-forget graph query
    agentApi
      .queryGraph(message)
      .then((graphResult) => {
        const result = graphResult?.result as Record<string, unknown> | undefined;
        const graph = (result?.graph as { nodes?: any[]; edges?: any[] } | undefined) ?? null;
        if (graph) {
          setGraphData(graph);
        }
      })
      .catch(() => {
        // Graph query is optional, ignore errors
      });
  };

  const handleSubmitHITL = async (response: HITLResponse) => {
    await submitHITL(response);
  };

  return (
    <AnimatedPage>
      <div className={styles.aiChatLayout}>
        <aside className={styles.sessionList}>
          <Card title="会话列表" style={{ margin: 12 }}>
            <Text type="secondary">当前会话: {sessionIdRef.current.slice(0, 8)}...</Text>
          </Card>
        </aside>

        <main className={styles.chatMain}>
          <div className={styles.chatMessages}>
            <Card title="AI 对话" extra={<Text type="secondary">状态: {status}</Text>}>
              {messages.map((msg, index) => (
                <div
                  key={`${msg.role}-${index}`}
                  className={msg.role === 'user' ? styles.userMsg : styles.assistantMsg}
                >
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
              {sending && finalResponse ? (
                <div className={styles.assistantMsg}>
                  <MarkdownRenderer content={finalResponse} />
                  <span className={styles.cursor}>▍</span>
                </div>
              ) : sending ? (
                <div className={styles.assistantMsg}>正在分析中...</div>
              ) : null}
              <div ref={messagesEndRef} />
            </Card>
          </div>

          <div className={styles.chatInput}>
            <Space.Compact block>
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="请输入分析需求，例如：分析流量从800提升到1200的影响并给出优化方案"
                onPressEnter={(event) => {
                  if (!event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!canSend}>
                发送
              </Button>
            </Space.Compact>

            <Button style={{ marginTop: 10 }} icon={<ReloadOutlined />} onClick={reset}>
              重置会话
            </Button>
          </div>
        </main>

        <aside className={styles.tracePanel}>
          <Card title="Agent 可观测性面板">
            <TracePanel plan={plan} currentStep={currentStep} logs={logs} metrics={metrics} />
          </Card>

          <Card title="知识图谱" style={{ marginTop: 12 }}>
            <GraphViewer data={graphData} />
          </Card>
        </aside>

        <HITLDialog
          request={hitlRequest}
          onSubmit={handleSubmitHITL}
          onCancel={dismissHITL}
        />
      </div>
    </AnimatedPage>
  );
}
