import { List, Tag, Typography } from 'antd';
import PlanTimeline from './PlanTimeline';
import MetricsBar from './MetricsBar';
import type { PlanStep, TraceLog, TraceMetrics } from '../../types/agent';

const { Text } = Typography;

interface TracePanelProps {
  plan: PlanStep[];
  currentStep: number;
  logs: TraceLog[];
  metrics: TraceMetrics;
}

export default function TracePanel({ plan, currentStep, logs, metrics }: TracePanelProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <Text strong>执行计划</Text>
        <div style={{ marginTop: 8 }}>
          <PlanTimeline plan={plan} currentStep={currentStep} />
        </div>
      </div>

      <div>
        <Text strong>实时日志</Text>
        <List
          size="small"
          bordered
          style={{ marginTop: 8, maxHeight: 280, overflowY: 'auto', background: '#fff' }}
          dataSource={logs.slice().reverse()}
          renderItem={(item) => (
            <List.Item>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%' }}>
                <Tag>{item.type}</Tag>
                <Text type="secondary" style={{ minWidth: 120 }}>
                  {new Date(item.timestamp).toLocaleTimeString()}
                </Text>
                <Text>{item.text}</Text>
              </div>
            </List.Item>
          )}
        />
      </div>

      <div>
        <Text strong>性能指标</Text>
        <div style={{ marginTop: 8 }}>
          <MetricsBar metrics={metrics} />
        </div>
      </div>
    </div>
  );
}
