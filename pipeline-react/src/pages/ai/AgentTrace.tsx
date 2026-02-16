import { useState } from 'react';
import { Button, Card, Input, Space, Typography } from 'antd';
import { agentApi } from '../../api/agent';
import AnimatedPage from '../../components/common/AnimatedPage';

const { Paragraph, Text } = Typography;

export default function AgentTrace() {
  const [traceId, setTraceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleQuery = async () => {
    const id = traceId.trim();
    if (!id) {
      return;
    }

    setLoading(true);
    try {
      const response = await agentApi.getTrace(id);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedPage>
      <Card title="Trace 查询">
        <Space.Compact block>
          <Input
            value={traceId}
            onChange={(event) => setTraceId(event.target.value)}
            placeholder="请输入 trace_id"
          />
          <Button type="primary" onClick={() => void handleQuery()} loading={loading}>
            查询
          </Button>
        </Space.Compact>

        <div style={{ marginTop: 12 }}>
          {result ? (
            <pre style={{ maxHeight: 420, overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <Text type="secondary">输入 trace_id 后可查看执行摘要与时间线。</Text>
          )}
        </div>

        <Paragraph type="secondary" style={{ marginTop: 8 }}>
          该页面用于调试和回溯 Agent 执行轨迹。
        </Paragraph>
      </Card>
    </AnimatedPage>
  );
}
