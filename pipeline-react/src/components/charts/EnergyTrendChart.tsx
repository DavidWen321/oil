/**
 * EnergyTrendChart - 能耗趋势分析图表
 *
 * 业务场景: 时间序列能耗监控
 * 功能:
 * - 折线图 + 面积图组合
 * - 时间范围选择 (小时/天/月)
 * - 峰值/谷值标注
 * - 多泵站对比
 * - 数据缩放 (dataZoom)
 */

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import BaseChart from './BaseChart';
import { useChartTheme } from '../../hooks/useChartTheme';

export interface EnergyDataPoint {
  time: string;
  value: number;
  station?: string;
}

export interface EnergyTrendChartProps {
  data: EnergyDataPoint[];
  compareData?: EnergyDataPoint[];
  height?: string | number;
  loading?: boolean;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  showPeakValley?: boolean;
  unit?: string;
  title?: string;
}

export default function EnergyTrendChart({
  data,
  compareData,
  height = 400,
  loading = false,
  timeRange = '24h',
  showPeakValley = true,
  unit = 'kWh',
  title = '能耗趋势',
}: EnergyTrendChartProps) {
  const theme = useChartTheme();

  const option = useMemo<EChartsOption>(() => {
    const times = data.map((d) => d.time);
    const values = data.map((d) => d.value);
    const compareValues = compareData?.map((d) => d.value) || [];

    // 计算峰值和谷值
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const maxIndex = values.indexOf(maxValue);
    const minIndex = values.indexOf(minValue);

    const series: any[] = [
      {
        name: '实时能耗',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: theme.colors.primary,
          shadowColor: theme.colors.primaryLight,
          shadowBlur: 10,
        },
        itemStyle: {
          color: theme.colors.primary,
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
        emphasis: {
          focus: 'series',
          itemStyle: {
            shadowBlur: 10,
            shadowColor: theme.colors.primary,
          },
        },
        data: values,
        // 标注峰值和谷值
        markPoint: showPeakValley
          ? {
              data: [
                {
                  name: '峰值',
                  value: maxValue,
                  xAxis: maxIndex,
                  yAxis: maxValue,
                  symbol: 'pin',
                  symbolSize: 50,
                  itemStyle: {
                    color: theme.colors.red,
                  },
                  label: {
                    formatter: `峰值\n{c} ${unit}`,
                    fontSize: 11,
                  },
                },
                {
                  name: '谷值',
                  value: minValue,
                  xAxis: minIndex,
                  yAxis: minValue,
                  symbol: 'pin',
                  symbolSize: 50,
                  itemStyle: {
                    color: theme.colors.green,
                  },
                  label: {
                    formatter: `谷值\n{c} ${unit}`,
                    fontSize: 11,
                  },
                },
              ],
            }
          : undefined,
        // 平均线
        markLine: {
          silent: true,
          lineStyle: {
            type: 'dashed',
            color: theme.colors.orange,
            width: 2,
          },
          label: {
            formatter: `平均: {c} ${unit}`,
            fontSize: 11,
          },
          data: [{ type: 'average', name: '平均值' }],
        },
      },
    ];

    // 对比数据
    if (compareData && compareValues.length > 0) {
      series.push({
        name: '对比能耗',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: theme.colors.purple,
          type: 'dashed',
        },
        data: compareValues,
      });
    }

    return {
      title: {
        text: title,
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
          crossStyle: {
            color: theme.colors.textTertiary,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          let result = `<div style="font-weight:600;margin-bottom:4px;">${params[0].axisValue}</div>`;
          params.forEach((item: any) => {
            const trend = item.dataIndex > 0 ? values[item.dataIndex] - values[item.dataIndex - 1] : 0;
            const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
            const trendColor = trend > 0 ? theme.colors.red : trend < 0 ? theme.colors.green : theme.colors.textTertiary;
            result += `
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span>${item.marker} ${item.seriesName}</span>
                <span style="font-weight:600;margin-left:16px;">${item.value.toLocaleString()} ${unit}</span>
                <span style="color:${trendColor};margin-left:8px;font-size:12px;">${trendIcon}</span>
              </div>
            `;
          });
          return result;
        },
        ...theme.tooltip,
      },
      legend: {
        data: compareData ? ['实时能耗', '对比能耗'] : ['实时能耗'],
        top: 40,
        ...theme.legend,
      },
      grid: {
        ...theme.grid,
        top: '20%',
      },
      xAxis: {
        type: 'category',
        data: times,
        boundaryGap: false,
        ...theme.xAxis,
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: {
          color: theme.colors.textTertiary,
          fontSize: 11,
        },
        ...theme.yAxis,
      },
      series,
    };
  }, [data, compareData, theme, showPeakValley, unit, title]);

  return <BaseChart option={option} height={height} loading={loading} enableDataZoom />;
}
