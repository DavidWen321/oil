/**
 * OptimizationComparisonChart - 泵组合优化结果对比图
 *
 * 业务场景: 8 种泵组合方案对比
 * 功能:
 * - 柱状图对比能耗
 * - 散点图 (能耗 vs 成本)
 * - 高亮最优方案
 */

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import BaseChart from './BaseChart';
import { useChartTheme } from '../../hooks/useChartTheme';

export interface OptimizationScheme {
  id: string;
  name: string;
  pump480Count: number;
  pump375Count: number;
  energyConsumption: number; // kWh
  cost: number; // 元
  isFeasible: boolean;
  isOptimal?: boolean;
}

export interface OptimizationComparisonChartProps {
  schemes: OptimizationScheme[];
  height?: string | number;
  loading?: boolean;
  chartType?: 'bar' | 'scatter';
}

export default function OptimizationComparisonChart({
  schemes,
  height = 400,
  loading = false,
  chartType = 'bar',
}: OptimizationComparisonChartProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    if (chartType === 'scatter') {
      // 散点图模式 (能耗 vs 成本)
      return {
        title: {
          text: '泵组合方案 - 能耗成本分析',
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
            const scheme = schemes[params.dataIndex];
            return `
              <div style="font-weight:600;margin-bottom:4px;">${scheme.name}</div>
              <div style="color:${theme.colors.textSecondary};font-size:12px;margin-bottom:4px;">
                ZMI480: ${scheme.pump480Count}台 | ZMI375: ${scheme.pump375Count}台
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span>能耗</span>
                <span style="font-weight:600;margin-left:16px;">${scheme.energyConsumption.toLocaleString()} kWh</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span>成本</span>
                <span style="font-weight:600;margin-left:16px;">¥${scheme.cost.toLocaleString()}</span>
              </div>
              ${scheme.isOptimal ? '<div style="margin-top:4px;color:' + theme.colors.green + ';font-weight:600;">✓ 最优方案</div>' : ''}
              ${!scheme.isFeasible ? '<div style="margin-top:4px;color:' + theme.colors.red + ';">✗ 不可行</div>' : ''}
            `;
          },
          ...theme.tooltip,
        },
        grid: {
          ...theme.grid,
          top: '20%',
        },
        xAxis: {
          type: 'value',
          name: '能耗 (kWh)',
          nameLocation: 'middle',
          nameGap: 30,
          nameTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 12,
          },
          ...theme.xAxis,
        },
        yAxis: {
          type: 'value',
          name: '成本 (元)',
          nameTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 12,
          },
          ...theme.yAxis,
        },
        series: [
          {
            type: 'scatter',
            symbolSize: (data: any, params: any) => {
              const scheme = schemes[params.dataIndex];
              return scheme.isOptimal ? 20 : scheme.isFeasible ? 12 : 8;
            },
            itemStyle: {
              color: (params: any) => {
                const scheme = schemes[params.dataIndex];
                if (scheme.isOptimal) return theme.colors.green;
                if (!scheme.isFeasible) return theme.colors.textTertiary;
                return theme.colors.primary;
              },
              borderColor: theme.colors.bgElevated,
              borderWidth: 2,
            },
            emphasis: {
              scale: 1.5,
              itemStyle: {
                shadowBlur: 10,
                shadowColor: theme.colors.primary,
              },
            },
            data: schemes.map((scheme) => [scheme.energyConsumption, scheme.cost]),
            // 标注最优方案
            markPoint: {
              data: schemes
                .filter((s) => s.isOptimal)
                .map((scheme, index) => ({
                  coord: [scheme.energyConsumption, scheme.cost],
                  symbol: 'pin',
                  symbolSize: 50,
                  itemStyle: {
                    color: theme.colors.green,
                  },
                  label: {
                    formatter: '最优',
                    fontSize: 11,
                  },
                })),
            },
          },
        ],
      };
    }

    // 柱状图模式 (能耗对比)
    const names = schemes.map((s) => s.name);
    const energies = schemes.map((s) => s.energyConsumption);
    const costs = schemes.map((s) => s.cost);

    return {
      title: {
        text: '泵组合方案 - 能耗对比',
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
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          const scheme = schemes[params[0].dataIndex];
          let result = `<div style="font-weight:600;margin-bottom:4px;">${scheme.name}</div>`;
          result += `<div style="color:${theme.colors.textSecondary};font-size:12px;margin-bottom:4px;">ZMI480: ${scheme.pump480Count}台 | ZMI375: ${scheme.pump375Count}台</div>`;
          params.forEach((item: any) => {
            result += `
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span>${item.marker} ${item.seriesName}</span>
                <span style="font-weight:600;margin-left:16px;">${item.value.toLocaleString()} ${item.seriesName.includes('能耗') ? 'kWh' : '元'}</span>
              </div>
            `;
          });
          if (scheme.isOptimal) {
            result += `<div style="margin-top:4px;color:${theme.colors.green};font-weight:600;">✓ 最优方案</div>`;
          }
          if (!scheme.isFeasible) {
            result += `<div style="margin-top:4px;color:${theme.colors.red};">✗ 不可行</div>`;
          }
          return result;
        },
        ...theme.tooltip,
      },
      legend: {
        data: ['能耗', '成本'],
        top: 40,
        ...theme.legend,
      },
      grid: {
        ...theme.grid,
        top: '20%',
      },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: {
          rotate: 45,
          fontSize: 10,
        },
        ...theme.xAxis,
      },
      yAxis: [
        {
          type: 'value',
          name: '能耗 (kWh)',
          position: 'left',
          nameTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 11,
          },
          ...theme.yAxis,
        },
        {
          type: 'value',
          name: '成本 (元)',
          position: 'right',
          nameTextStyle: {
            color: theme.colors.textTertiary,
            fontSize: 11,
          },
          axisLine: {
            show: true,
            lineStyle: {
              color: theme.colors.border,
            },
          },
          axisLabel: {
            color: theme.colors.textTertiary,
            fontSize: 11,
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: '能耗',
          type: 'bar',
          yAxisIndex: 0,
          barWidth: '35%',
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: (params: any) => {
              const scheme = schemes[params.dataIndex];
              if (scheme.isOptimal) return theme.colors.green;
              if (!scheme.isFeasible) return theme.colors.textTertiary;
              return theme.colors.primary;
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: theme.colors.primary,
            },
          },
          data: energies,
          // 标注最优方案
          markPoint: {
            data: schemes
              .map((scheme, index) => (scheme.isOptimal ? { type: 'min', name: '最优', xAxis: index, yAxis: scheme.energyConsumption } : null))
              .filter(Boolean) as any[],
            symbol: 'pin',
            symbolSize: 50,
            itemStyle: {
              color: theme.colors.green,
            },
            label: {
              formatter: '最优',
              fontSize: 11,
            },
          },
        },
        {
          name: '成本',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 2,
            color: theme.colors.orange,
          },
          itemStyle: {
            color: theme.colors.orange,
            borderColor: theme.colors.bgElevated,
            borderWidth: 2,
          },
          data: costs,
        },
      ],
    };
  }, [schemes, theme, chartType]);

  return <BaseChart option={option} height={height} loading={loading} />;
}
