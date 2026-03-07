/**
 * FaultDiagnosisSankey - 故障诊断因果关系图
 *
 * 业务场景: 故障类型、原因、概率分析
 * 功能:
 * - 桑基图 (Sankey) 显示因果关系链路
 * - 节点点击展开详情
 * - 流量粗细表示概率/影响程度
 */

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import BaseChart from './BaseChart';
import { useChartTheme } from '../../hooks/useChartTheme';

export interface FaultNode {
  name: string;
  category: 'fault' | 'cause' | 'impact';
  severity?: 'critical' | 'warning' | 'info';
}

export interface FaultLink {
  source: string;
  target: string;
  value: number; // 概率或影响程度 (0-100)
}

export interface FaultDiagnosisSankeyProps {
  nodes: FaultNode[];
  links: FaultLink[];
  height?: string | number;
  loading?: boolean;
  onNodeClick?: (node: FaultNode) => void;
}

export default function FaultDiagnosisSankey({
  nodes,
  links,
  height = 500,
  loading = false,
  onNodeClick,
}: FaultDiagnosisSankeyProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const getNodeColor = (node: FaultNode) => {
      if (node.category === 'fault') {
        if (node.severity === 'critical') return theme.colors.red;
        if (node.severity === 'warning') return theme.colors.orange;
        return theme.colors.cyan;
      }
      if (node.category === 'cause') return theme.colors.purple;
      return theme.colors.green;
    };

    return {
      title: {
        text: '故障诊断因果关系图',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: theme.colors.textPrimary,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const node = nodes.find((n) => n.name === params.name);
            return `
              <div style="font-weight:600;margin-bottom:4px;">${params.name}</div>
              <div style="color:${theme.colors.textSecondary};font-size:12px;">
                ${node?.category === 'fault' ? '故障类型' : node?.category === 'cause' ? '可能原因' : '影响'}
              </div>
              ${node?.severity ? `<div style="margin-top:4px;color:${getNodeColor(node)};font-weight:600;">${node.severity === 'critical' ? '严重' : node.severity === 'warning' ? '警告' : '提示'}</div>` : ''}
            `;
          }
          if (params.dataType === 'edge') {
            return `
              <div style="font-weight:600;margin-bottom:4px;">${params.data.source} → ${params.data.target}</div>
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span>关联度</span>
                <span style="font-weight:600;margin-left:16px;">${params.data.value}%</span>
              </div>
            `;
          }
          return '';
        },
        ...theme.tooltip,
      },
      series: [
        {
          type: 'sankey',
          layout: 'none',
          emphasis: {
            focus: 'adjacency',
          },
          nodeAlign: 'left',
          nodeGap: 20,
          nodeWidth: 20,
          layoutIterations: 0,
          data: nodes.map((node) => ({
            name: node.name,
            itemStyle: {
              color: getNodeColor(node),
              borderColor: theme.colors.bgElevated,
              borderWidth: 2,
            },
            label: {
              color: theme.colors.textPrimary,
              fontSize: 12,
            },
          })),
          links: links.map((link) => ({
            source: link.source,
            target: link.target,
            value: link.value,
            lineStyle: {
              color: 'source',
              opacity: 0.3,
            },
          })),
          lineStyle: {
            curveness: 0.5,
          },
        },
      ],
    };
  }, [nodes, links, theme]);

  return (
    <BaseChart
      option={option}
      height={height}
      loading={loading}
      onChartReady={(chart) => {
        if (onNodeClick) {
          chart.on('click', (params: any) => {
            if (params.dataType === 'node') {
              const node = nodes.find((n) => n.name === params.name);
              if (node) onNodeClick(node);
            }
          });
        }
      }}
    />
  );
}

// 树图模式 (备选方案)
export interface FaultDiagnosisTreeProps {
  data: {
    name: string;
    value?: number;
    children?: FaultDiagnosisTreeProps['data'][];
    severity?: 'critical' | 'warning' | 'info';
  };
  height?: string | number;
  loading?: boolean;
}

export function FaultDiagnosisTree({ data, height = 500, loading = false }: FaultDiagnosisTreeProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    return {
      title: {
        text: '故障诊断树',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: theme.colors.textPrimary,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `
            <div style="font-weight:600;margin-bottom:4px;">${params.name}</div>
            ${params.data.value ? `<div style="display:flex;align-items:center;justify-content:space-between;"><span>概率</span><span style="font-weight:600;margin-left:16px;">${params.data.value}%</span></div>` : ''}
          `;
        },
        ...theme.tooltip,
      },
      series: [
        {
          type: 'tree',
          data: [data],
          top: '10%',
          bottom: '10%',
          layout: 'orthogonal',
          orient: 'LR',
          symbol: 'circle',
          symbolSize: 10,
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
            fontSize: 12,
            color: theme.colors.textPrimary,
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left',
            },
          },
          emphasis: {
            focus: 'descendant',
          },
          expandAndCollapse: true,
          animationDuration: 550,
          animationDurationUpdate: 750,
          itemStyle: {
            color: (params: any) => {
              if (params.data.severity === 'critical') return theme.colors.red;
              if (params.data.severity === 'warning') return theme.colors.orange;
              return theme.colors.primary;
            },
            borderColor: theme.colors.bgElevated,
            borderWidth: 2,
          },
          lineStyle: {
            color: theme.colors.border,
            width: 2,
          },
        },
      ],
    };
  }, [data, theme]);

  return <BaseChart option={option} height={height} loading={loading} />;
}
