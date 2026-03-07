/**
 * PumpStationGauge - 泵站运行状态仪表盘
 *
 * 业务场景: 泵站效率和功率监控
 * 功能:
 * - 仪表盘 (Gauge) 显示效率
 * - 状态卡片 (运行/停止/故障)
 * - 多泵站对比雷达图
 */

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import BaseChart from './BaseChart';
import { useChartTheme } from '../../hooks/useChartTheme';

export interface PumpStationData {
  id: string;
  name: string;
  efficiency: number; // 效率 (0-100)
  power: number; // 功率 (kW)
  status: 'running' | 'stopped' | 'fault';
  temperature?: number;
  vibration?: number;
}

export interface PumpStationGaugeProps {
  data: PumpStationData;
  height?: string | number;
  loading?: boolean;
  showDetails?: boolean;
}

export default function PumpStationGauge({
  data,
  height = 300,
  loading = false,
  showDetails = true,
}: PumpStationGaugeProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const getStatusColor = () => {
      if (data.status === 'fault') return theme.colors.red;
      if (data.status === 'stopped') return theme.colors.textTertiary;
      return theme.colors.green;
    };

    const getEfficiencyColor = (efficiency: number) => {
      if (efficiency >= 90) return theme.colors.green;
      if (efficiency >= 75) return theme.colors.cyan;
      if (efficiency >= 60) return theme.colors.orange;
      return theme.colors.red;
    };

    return {
      title: {
        text: data.name,
        left: 'center',
        top: '5%',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: theme.colors.textPrimary,
        },
        subtextStyle: {
          color: getStatusColor(),
          fontSize: 12,
        },
        subtext: data.status === 'running' ? '运行中' : data.status === 'stopped' ? '已停止' : '故障',
      },
      series: [
        {
          type: 'gauge',
          center: ['50%', '60%'],
          radius: '80%',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 100,
          splitNumber: 10,
          axisLine: {
            lineStyle: {
              width: 20,
              color: [
                [0.6, theme.colors.red],
                [0.75, theme.colors.orange],
                [0.9, theme.colors.cyan],
                [1, theme.colors.green],
              ],
            },
          },
          pointer: {
            itemStyle: {
              color: getEfficiencyColor(data.efficiency),
            },
            width: 6,
            length: '60%',
          },
          axisTick: {
            distance: -20,
            length: 6,
            lineStyle: {
              color: theme.colors.border,
              width: 1,
            },
          },
          splitLine: {
            distance: -20,
            length: 12,
            lineStyle: {
              color: theme.colors.border,
              width: 2,
            },
          },
          axisLabel: {
            color: theme.colors.textTertiary,
            distance: 15,
            fontSize: 10,
          },
          detail: {
            valueAnimation: true,
            formatter: '{value}%',
            color: getEfficiencyColor(data.efficiency),
            fontSize: 28,
            fontWeight: 'bold',
            offsetCenter: [0, '80%'],
          },
          data: [
            {
              value: data.efficiency,
              name: '效率',
              title: {
                offsetCenter: [0, '100%'],
                fontSize: 12,
                color: theme.colors.textSecondary,
              },
            },
          ],
        },
        // 功率环形图
        {
          type: 'gauge',
          center: ['50%', '60%'],
          radius: '60%',
          startAngle: 200,
          endAngle: -20,
          min: 0,
          max: 3000,
          splitNumber: 6,
          axisLine: {
            lineStyle: {
              width: 8,
              color: [[1, theme.colors.primaryLight]],
            },
          },
          pointer: {
            show: false,
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            show: false,
          },
          axisLabel: {
            show: false,
          },
          detail: {
            show: false,
          },
          data: [
            {
              value: data.power,
            },
          ],
        },
      ],
    };
  }, [data, theme]);

  return <BaseChart option={option} height={height} loading={loading} />;
}

// 多泵站对比雷达图
export interface PumpStationRadarProps {
  stations: PumpStationData[];
  height?: string | number;
  loading?: boolean;
}

export function PumpStationRadar({ stations, height = 400, loading = false }: PumpStationRadarProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    return {
      title: {
        text: '泵站性能对比',
        left: 'center',
        textStyle: {
          fontSize: 16,
          fontWeight: 600,
          color: theme.colors.textPrimary,
        },
      },
      tooltip: {
        trigger: 'item',
        ...theme.tooltip,
      },
      legend: {
        data: stations.map((s) => s.name),
        bottom: '5%',
        ...theme.legend,
      },
      radar: {
        indicator: [
          { name: '效率', max: 100 },
          { name: '功率', max: 3000 },
          { name: '温度', max: 100 },
          { name: '振动', max: 10 },
        ],
        shape: 'polygon',
        splitNumber: 4,
        center: ['50%', '50%'],
        radius: '60%',
        axisName: {
          color: theme.colors.textSecondary,
          fontSize: 12,
        },
        splitLine: {
          lineStyle: {
            color: theme.colors.border,
          },
        },
        splitArea: {
          areaStyle: {
            color: [theme.colors.borderLight, 'transparent'],
          },
        },
        axisLine: {
          lineStyle: {
            color: theme.colors.border,
          },
        },
      },
      series: [
        {
          type: 'radar',
          data: stations.map((station, index) => ({
            value: [
              station.efficiency,
              station.power,
              station.temperature || 0,
              station.vibration || 0,
            ],
            name: station.name,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: {
              width: 2,
              color: [theme.colors.primary, theme.colors.purple, theme.colors.cyan, theme.colors.green][
                index % 4
              ],
            },
            itemStyle: {
              color: [theme.colors.primary, theme.colors.purple, theme.colors.cyan, theme.colors.green][
                index % 4
              ],
              borderColor: theme.colors.bgElevated,
              borderWidth: 2,
            },
            areaStyle: {
              opacity: 0.15,
            },
          })),
        },
      ],
    };
  }, [stations, theme]);

  return <BaseChart option={option} height={height} loading={loading} />;
}
