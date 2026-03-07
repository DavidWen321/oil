/**
 * useChartTheme - 图表主题 Hook
 *
 * 功能:
 * - 自动检测系统主题 (浅色/暗色)
 * - 提供 ECharts 主题配置
 * - 响应主题切换
 */

import { useMemo, useEffect, useState } from 'react';
import type { EChartsOption } from 'echarts';

type ThemeMode = 'light' | 'dark';

interface ChartTheme {
  colors: {
    primary: string;
    primaryLight: string;
    primaryMedium: string;
    purple: string;
    cyan: string;
    green: string;
    orange: string;
    red: string;
    textPrimary: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    borderLight: string;
    bgElevated: string;
  };
  backgroundColor: string;
  textStyle: EChartsOption['textStyle'];
  title: EChartsOption['title'];
  legend: EChartsOption['legend'];
  tooltip: EChartsOption['tooltip'];
  grid: EChartsOption['grid'];
  xAxis: EChartsOption['xAxis'];
  yAxis: EChartsOption['yAxis'];
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    // 检测初始主题
    const root = document.documentElement;
    const dataTheme = root.getAttribute('data-theme');
    if (dataTheme === 'dark') return 'dark';
    if (dataTheme === 'light') return 'light';
    // 检测系统偏好
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    // 监听主题变化
    const observer = new MutationObserver(() => {
      const root = document.documentElement;
      const dataTheme = root.getAttribute('data-theme');
      if (dataTheme === 'dark') {
        setTheme('dark');
      } else if (dataTheme === 'light') {
        setTheme('light');
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const root = document.documentElement;
      const dataTheme = root.getAttribute('data-theme');
      if (!dataTheme) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return useMemo(() => {
    if (theme === 'dark') {
      // 暗色主题
      return {
        colors: {
          primary: '#3B82F6',
          primaryLight: 'rgba(59, 130, 246, 0.12)',
          primaryMedium: 'rgba(59, 130, 246, 0.6)',
          purple: '#8B5CF6',
          cyan: '#06B6D4',
          green: '#10B981',
          orange: '#F59E0B',
          red: '#EF4444',
          textPrimary: '#F1F5F9',
          textSecondary: '#CBD5E1',
          textTertiary: '#94A3B8',
          border: 'rgba(255, 255, 255, 0.10)',
          borderLight: 'rgba(255, 255, 255, 0.06)',
          bgElevated: '#1A1F2E',
        },
        backgroundColor: 'transparent',
        textStyle: {
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
          color: '#CBD5E1',
        },
        title: {
          textStyle: {
            color: '#F1F5F9',
            fontWeight: 600,
          },
        },
        legend: {
          textStyle: {
            color: '#CBD5E1',
          },
          inactiveColor: '#475569',
        },
        tooltip: {
          backgroundColor: '#1A1F2E',
          borderColor: 'rgba(255, 255, 255, 0.10)',
          borderWidth: 1,
          textStyle: {
            color: '#F1F5F9',
          },
          extraCssText: 'box-shadow: 0 10px 40px -4px rgba(0, 0, 0, 0.5); border-radius: 12px;',
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '15%',
          containLabel: true,
        },
        xAxis: {
          axisLine: {
            lineStyle: { color: 'rgba(255, 255, 255, 0.10)' },
          },
          axisTick: { show: false },
          axisLabel: {
            color: '#94A3B8',
            fontSize: 11,
          },
          splitLine: { show: false },
        },
        yAxis: {
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#94A3B8',
            fontSize: 11,
          },
          splitLine: {
            lineStyle: {
              color: 'rgba(255, 255, 255, 0.06)',
              type: 'dashed',
            },
          },
        },
      };
    }

    // 浅色主题
    return {
      colors: {
        primary: '#007AFF',
        primaryLight: 'rgba(0, 122, 255, 0.12)',
        primaryMedium: 'rgba(0, 122, 255, 0.6)',
        purple: '#5856D6',
        cyan: '#32ADE6',
        green: '#34C759',
        orange: '#FF9500',
        red: '#FF3B30',
        textPrimary: '#1D1D1F',
        textSecondary: '#6E6E73',
        textTertiary: '#8E8E93',
        border: '#E5E5EA',
        borderLight: '#F2F2F7',
        bgElevated: '#FFFFFF',
      },
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
        color: '#6E6E73',
      },
      title: {
        textStyle: {
          color: '#1D1D1F',
          fontWeight: 600,
        },
      },
      legend: {
        textStyle: {
          color: '#6E6E73',
        },
        inactiveColor: '#C7C7CC',
      },
      tooltip: {
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E5EA',
        borderWidth: 1,
        textStyle: {
          color: '#1D1D1F',
        },
        extraCssText: 'box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12); border-radius: 12px;',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        axisLine: {
          lineStyle: { color: '#E5E5EA' },
        },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
        },
        splitLine: { show: false },
      },
      yAxis: {
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#8E8E93',
          fontSize: 11,
        },
        splitLine: {
          lineStyle: {
            color: '#F2F2F7',
            type: 'dashed',
          },
        },
      },
    };
  }, [theme]);
}
