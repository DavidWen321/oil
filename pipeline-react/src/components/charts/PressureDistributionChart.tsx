/**
 * PressureDistributionChart - 管道压力分布图
 *
 * 业务场景: 管道节点压力监控
 * 功能:
 * - 热力图或渐变色折线图
 * - 安全阈值线 (红色警戒线)
 * - 节点点击显示详细信息
 * - 动态更新 (实时监控)
 */

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import BaseChart from './BaseChart';
import { useChartTheme } from '../../hooks/useChartTheme';

export interface PressureNode {
  position: string; // 节点位置 (如 "K0+000")
  pressure: number; // 压力值 (MPa)
  status?: 'normal' | 'warning' | 'critical';
  stationName?: string;
}

export interface PressureDistributionChartProps {
  data: PressureNode[];
  height?: string | number;
  loading?: boolean;
  safetyThreshold?: number; // 安全阈值 (MPa)
  warningThreshold?: number; // 警告阈值 (MPa)
  onNodeClick?: (node: PressureNode) => void;
  showHeatmap?: boolean; // 是否显示热力图模式
}

export default function PressureDistributionChart({
  data,
  height = 400,
  loading = false,
  safetyThreshold = 7.5,
  warningThreshold = 6.5,
  onNodeClick,
  showHeatmap = false,
}: PressureDistributionChartProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const positions = data.map((d) => d.position);
    const pressures = data.map((d) => d.pressure);

    // 根据压力值计算颜色
    const getColorByPressure = (pressure: number) => {
      if (pressure >= safetyThreshold) return theme.colors.red;
      if (pressure >= warningThreshold) return theme.colors.orange;
      return theme.colors.green;
    };

    if (showHeatmap) {
      // 热力图模式
      return {
        title: {
          text: '管道压力分布热力图',
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
            const node = data[params.dataIndex];
            return `
              <div style="font-weight:600;margin-bottom:4px;">${node.position}</div>
              ${node.stationName ? `<div style="color:${theme.colors.textSecondary};font-size:12px;margin-bottom:4px;">${node.stationName}</div>` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span>压力值</span>
                <span style="font-weight:600;margin-left:16px;color:${getColorByPressure(node.pressure)};">${node.pressure} MPa</span>
              </div>
              <div style="margin-top:4px;font-size:12px;color:${theme.colors.textTertiary};">
                ${node.pressure >= safetyThreshold ? '⚠️ 超过安全阈值' : node.pressure >= warningThreshold ? '⚠ 接近警告阈值' : '✓ 正常范围'}
              </div>
            `;
          },
          ...theme.tooltip,
        },
        visualMap: {
          min: 0,
          max: safetyThreshold,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '5%',
          inRange: {
            color: [theme.colors.green, theme.colors.cyan, theme.colors.orange, theme.colors.red],
          },
          text: ['高压', '低压'],
          textStyle: {
            color: theme.colors.textSecondary,
          },
        },
        xAxis: {
          type: 'category',
          data: positions,
          ...theme.xAxis,
        },
        yAxis: {
          type: 'value',
          name: '压力 (MPa)',
          nameTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 11,
          },
          ...theme.yAxis,
        },
        series: [
          {
            type: 'heatmap',
            data: data.map((node, index) => [index, 0, node.pressure]),
            label: {
              show: true,
              formatter: '{c} MPa',
              fontSize: 11,
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      };
    }

    // 渐变色折线图模式
    return {
      title: {
        text: '管道压力分布',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: theme.colors.textPrimary,
        },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const node = data[params[0].dataIndex];
          return `
            <div style="font-weight:600;margin-bottom:4px;">${node.position}</div>
            ${node.stationName ? `<div style="color:${theme.colors.textSecondary};font-size:12px;margin-bottom:4px;">${node.stationName}</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <span>${params[0].marker} 压力值</span>
              <span style="font-weight:600;margin-left:16px;color:${getColorByPressure(node.pressure)};">${node.pressure} MPa</span>
            </div>
            <div style="margin-top:4px;font-size:12px;color:${theme.colors.textTertiary};">
              ${node.pressure >= safetyThreshold ? '⚠️ 超过安全阈值' : node.pressure >= warningThreshold ? '⚠ 接近警告阈值' : '✓ 正常范围'}
            </div>
          `;
        },
        ...theme.tooltip,
      },
      grid: {
        ...theme.grid,
        top: '20%',
      },
      xAxis: {
        type: 'category',
        data: positions,
        boundaryGap: false,
        ...theme.xAxis,
      },
      yAxis: {
        type: 'value',
        name: '压力 (MPa)',
        nameTextStyle: {
          color: theme.colors.textTertiary,
          fontSize: 11,
        },
        ...theme.yAxis,
      },
      series: [
        {
          name: '压力分布',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 10,
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: data.map((node, index) => ({
                offset: index / (data.length - 1),
                color: getColorByPressure(node.pressure),
              })),
            },
          },
          itemStyle: {
            color: (params: any) => getColorByPressure(data[params.dataIndex].pressure),
            borderColor: theme.colors.bgElevated,
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: theme.colors.primaryMedium },
                { offset: 1, color: theme.colors.primaryLight },
              ],
            },
          },
          data: pressures,
          // 安全阈值线
          markLine: {
            silent: false,
            symbol: 'none',
            label: {
              position: 'end',
              formatter: '{b}: {c} MPa',
              fontSize: 11,
            },
            data: [
              {
                name: '安全阈值',
                yAxis: safetyThreshold,
                lineStyle: {
                  type: 'solid',
                  color: theme.colors.red,
                  width: 2,
                },
                label: {
                  color: theme.colors.red,
                },
              },
              {
                name: '警告阈值',
                yAxis: warningThreshold,
                lineStyle: {
                  type: 'dashed',
                  color: theme.colors.orange,
                  width: 2,
                },
                label: {
                  color: theme.colors.orange,
                },
              },
            ],
          },
        },
      ],
    };
  }, [data, theme, safetyThreshold, warningThreshold, showHeatmap]);

  return (
    <BaseChart
      option={option}
      height={height}
      loading={loading}
      onChartReady={(chart) => {
        if (onNodeClick) {
          chart.on('click', (params: any) => {
            if (params.componentType === 'series') {
              onNodeClick(data[params.dataIndex]);
            }
          });
        }
      }}
    />
  );
}
