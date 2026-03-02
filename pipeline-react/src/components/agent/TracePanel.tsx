import { List, Tag, Typography } from 'antd';
import PlanTimeline from './PlanTimeline';
import MetricsBar from './MetricsBar';
import type {
  PlanStep,
  TraceLog,
  TraceMetrics,
  ToolSearchSnapshot,
  ToolExecutionEvent,
} from '../../types/agent';

const { Text } = Typography;

interface TracePanelProps {
  plan: PlanStep[];
  currentStep: number;
  logs: TraceLog[];
  metrics: TraceMetrics;
  activeTools?: ToolExecutionEvent[];
  toolSearch?: ToolSearchSnapshot | null;
}

export default function TracePanel({
  plan,
  currentStep,
  logs,
  metrics,
  activeTools,
  toolSearch,
}: TracePanelProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {toolSearch && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>工具选择</Text>
          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid #e6f4ff',
              background: '#f0faff',
              fontSize: '0.85em',
              display: 'grid',
              gap: 6,
            }}
          >
            <div>
              <Text type="secondary">Query:</Text> <Text>{toolSearch.query || '-'}</Text>
            </div>
            <div>
              <Text type="secondary">模式:</Text> <Text>{toolSearch.mode}</Text>
              <Text type="secondary"> · 耗时:</Text> <Text>{toolSearch.duration_ms.toFixed(2)}ms</Text>
              <Text type="secondary"> · 选中:</Text>{' '}
              <Text>{toolSearch.selected_tools.length}/{toolSearch.total_tools}</Text>
            </div>
            {(toolSearch.filters?.categories?.length || toolSearch.filters?.sources?.length) ? (
              <div>
                {toolSearch.filters?.categories?.length ? (
                  <Text type="secondary">
                    分类过滤: {toolSearch.filters.categories.join(', ')}
                  </Text>
                ) : null}
                {toolSearch.filters?.sources?.length ? (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    来源过滤: {toolSearch.filters.sources.join(', ')}
                  </Text>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {toolSearch.selected_tools.map((name) => {
                const scoreItem = toolSearch.selected_scores.find((item) => item.name === name);
                const scoreText = scoreItem ? `(${scoreItem.score.toFixed(2)})` : '';
                return (
                  <Tag
                    key={name}
                    color={scoreItem?.forced ? 'gold' : 'blue'}
                    style={{ marginInlineEnd: 0 }}
                  >
                    {name}{scoreText}
                  </Tag>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTools && activeTools.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong>工具调用</Text>
          {activeTools.map((tool, index) => (
            <div
              key={index}
              style={{
                padding: '4px 8px',
                margin: '4px 0',
                background: tool.status === 'running' ? '#e6f7ff' : '#f6ffed',
                borderRadius: 4,
                fontSize: '0.85em',
              }}
            >
              {tool.status === 'running' ? '🔧' : '✅'} {tool.tool}
              {tool.status === 'completed' && tool.output && (
                <div style={{ color: '#888', marginTop: 2, fontSize: '0.9em' }}>
                  {tool.output.slice(0, 100)}
                  {tool.output.length > 100 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
