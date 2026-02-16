/**
 * ═══════════════════════════════════════════════════════════════════
 *  Dashboard - 油气管道智能监测系统
 *  设计理念: Apple + Linear + Vercel 极简主义风格
 * ═══════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'motion/react'
import type { EChartsOption } from 'echarts'
import {
  RiDropLine,
  RiTempColdLine,
  RiAlertLine,
  RiArrowRightSLine,
  RiTimeLine,
  RiMapPinLine,
  RiSettings3Line,
  RiRefreshLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiFlashlightLine,
  RiPulseLine,
  RiBarChartBoxLine,
  RiDashboardLine,
} from 'react-icons/ri'
import AnimatedPage from '../../components/common/AnimatedPage'
import { AnimatedListContainer, AnimatedListItem } from '../../components/common/AnimatedList'
import Chart from '../../components/common/Chart'
import { useChartConfig } from '../../hooks/useChartConfig'
import { useChartGesture } from '../../hooks/useChartGesture'
import styles from './Dashboard.module.css'

// ═══════════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════════
interface StatCardData {
  id: string
  label: string
  value: number
  unit: string
  trend: 'up' | 'down' | 'neutral'
  trendValue: string
  description: string
  icon: React.ReactNode
  colorClass: string
}

interface AlertData {
  id: string
  type: 'critical' | 'warning' | 'info'
  message: string
  time: string
  location: string
}

interface DeviceData {
  id: string
  name: string
  status: 'online' | 'offline' | 'warning'
  value: number
  unit: string
}

// ═══════════════════════════════════════════════════════════════════
// ECharts 浅色主题配置 - Apple HIG 风格
// ═══════════════════════════════════════════════════════════════════

// 主色调定义 - Apple 系统色
const colors = {
  // Apple Blue 主色
  primary: '#007AFF',
  primaryLight: 'rgba(0, 122, 255, 0.12)',
  primaryMedium: 'rgba(0, 122, 255, 0.6)',
  // 辅助色
  purple: '#5856D6',
  purpleLight: 'rgba(88, 86, 214, 0.12)',
  cyan: '#32ADE6',
  cyanLight: 'rgba(50, 173, 230, 0.12)',
  green: '#34C759',
  orange: '#FF9500',
  // 文本色
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#8E8E93',
  textMuted: '#AEAEB2',
  // 边框和背景
  border: '#E5E5EA',
  borderLight: '#F2F2F7',
  bgElevated: '#FFFFFF',
}

const chartTheme = {
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
    color: colors.textSecondary,
  },
  title: {
    textStyle: {
      color: colors.textPrimary,
      fontWeight: 600,
    },
  },
  legend: {
    textStyle: {
      color: colors.textSecondary,
    },
  },
  tooltip: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.border,
    borderWidth: 1,
    textStyle: {
      color: colors.textPrimary,
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
      lineStyle: { color: colors.border },
    },
    axisTick: { show: false },
    axisLabel: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    splitLine: { show: false },
  },
  yAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: colors.textTertiary,
      fontSize: 11,
    },
    splitLine: {
      lineStyle: {
        color: colors.borderLight,
        type: 'dashed' as const,
      },
    },
  },
}

// ═══════════════════════════════════════════════════════════════════
// Dashboard 组件
// ═══════════════════════════════════════════════════════════════════
export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [activeTimeRange, setActiveTimeRange] = useState('24h')
  const flowChart = useChartConfig()
  const pressureChart = useChartConfig()
  const energyChart = useChartConfig()

  useChartGesture(flowChart.containerRef)
  useChartGesture(pressureChart.containerRef)
  useChartGesture(energyChart.containerRef)

  // 实时时钟
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 统计卡片数据
  const statsData: StatCardData[] = useMemo(() => [
    {
      id: 'flow',
      label: '实时流量',
      value: 2847,
      unit: 'm³/h',
      trend: 'up',
      trendValue: '+12.5%',
      description: '较昨日同期',
      icon: <RiDropLine size={20} />,
      colorClass: styles.statIconBlue,
    },
    {
      id: 'pressure',
      label: '管道压力',
      value: 4.82,
      unit: 'MPa',
      trend: 'neutral',
      trendValue: '0.0%',
      description: '运行正常',
      icon: <RiPulseLine size={20} />,
      colorClass: styles.statIconCyan,
    },
    {
      id: 'temperature',
      label: '平均温度',
      value: 42.6,
      unit: '°C',
      trend: 'down',
      trendValue: '-2.3%',
      description: '较昨日同期',
      icon: <RiTempColdLine size={20} />,
      colorClass: styles.statIconGreen,
    },
    {
      id: 'efficiency',
      label: '系统效率',
      value: 94.7,
      unit: '%',
      trend: 'up',
      trendValue: '+3.2%',
      description: '优于目标',
      icon: <RiFlashlightLine size={20} />,
      colorClass: styles.statIconAmber,
    },
  ], [])

  // 预警数据
  const alertsData: AlertData[] = useMemo(() => [
    {
      id: '1',
      type: 'critical',
      message: '3号泵站压力异常，超过预警阈值',
      time: '2分钟前',
      location: 'K128+500',
    },
    {
      id: '2',
      type: 'warning',
      message: '输油温度接近上限，建议调整',
      time: '15分钟前',
      location: 'K256+200',
    },
    {
      id: '3',
      type: 'info',
      message: '设备例行维护提醒：5号阀门',
      time: '1小时前',
      location: 'K89+100',
    },
    {
      id: '4',
      type: 'warning',
      message: '流量传感器数据波动，请关注',
      time: '2小时前',
      location: 'K312+800',
    },
  ], [])

  // 设备数据
  const devicesData: DeviceData[] = useMemo(() => [
    { id: '1', name: '1号泵站', status: 'online', value: 2150, unit: 'kW' },
    { id: '2', name: '2号泵站', status: 'online', value: 1890, unit: 'kW' },
    { id: '3', name: '3号泵站', status: 'warning', value: 2340, unit: 'kW' },
    { id: '4', name: '4号泵站', status: 'online', value: 2010, unit: 'kW' },
    { id: '5', name: '5号泵站', status: 'offline', value: 0, unit: 'kW' },
    { id: '6', name: '6号泵站', status: 'online', value: 1750, unit: 'kW' },
  ], [])

  // 流量趋势图配置
  const flowTrendOption = useMemo<EChartsOption>(() => ({
    ...chartTheme,
    grid: flowChart.grid,
    tooltip: {
      ...chartTheme.tooltip,
      ...flowChart.tooltipConf,
    },
    xAxis: {
      ...chartTheme.xAxis,
      type: 'category' as const,
      data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
      boundaryGap: false,
      axisLabel: {
        ...chartTheme.xAxis.axisLabel,
        ...flowChart.xAxisLabel,
      },
    },
    yAxis: {
      ...chartTheme.yAxis,
      type: 'value' as const,
      name: 'm³/h',
      nameTextStyle: { color: colors.textTertiary, fontSize: 11 },
    },
    series: [
      {
        name: '实时流量',
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: colors.primary,
          shadowColor: 'rgba(0, 122, 255, 0.25)',
          shadowBlur: 8,
        },
        areaStyle: { opacity: 0.25 },
        data: [2100, 2250, 2680, 2890, 2750, 2920, 2847],
      },
      {
        name: '昨日流量',
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: colors.purple,
          type: 'dashed' as const,
        },
        data: [1900, 2100, 2400, 2600, 2500, 2700, 2530],
      },
    ],
    legend: {
      ...(flowChart.legend !== false
        ? {
          ...chartTheme.legend,
          data: ['实时流量', '昨日流量'],
          ...flowChart.legend,
        }
        : { show: false }),
    },
  }), [flowChart.grid, flowChart.xAxisLabel, flowChart.legend, flowChart.tooltipConf])

  // 压力分布图配置
  const pressureDistOption = useMemo<EChartsOption>(() => ({
    ...chartTheme,
    tooltip: {
      ...chartTheme.tooltip,
      ...pressureChart.tooltipConf,
    },
    radar: {
      indicator: [
        { name: '入口压力', max: 6 },
        { name: '1号站', max: 6 },
        { name: '2号站', max: 6 },
        { name: '3号站', max: 6 },
        { name: '4号站', max: 6 },
        { name: '出口压力', max: 6 },
      ],
      shape: 'polygon' as const,
      splitNumber: 4,
      axisName: {
        color: colors.textSecondary,
        fontSize: 11,
      },
      splitLine: {
        lineStyle: { color: colors.border },
      },
      splitArea: {
        areaStyle: { color: [colors.borderLight, 'rgba(0, 122, 255, 0.03)'] },
      },
      axisLine: {
        lineStyle: { color: colors.border },
      },
    },
    series: [{
      type: 'radar' as const,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: {
        width: 2,
        color: colors.cyan,
      },
      itemStyle: {
        color: colors.cyan,
        borderColor: colors.bgElevated,
        borderWidth: 2,
      },
      areaStyle: {
        color: 'rgba(50, 173, 230, 0.15)',
      },
      data: [{
        value: [5.2, 4.8, 4.5, 4.2, 3.9, 3.5],
        name: '当前压力',
      }],
    }],
  }), [pressureChart.tooltipConf])

  // 能耗分析图配置
  const energyOption = useMemo<EChartsOption>(() => ({
    ...chartTheme,
    grid: energyChart.grid,
    tooltip: {
      ...chartTheme.tooltip,
      ...energyChart.tooltipConf,
    },
    xAxis: {
      ...chartTheme.xAxis,
      type: 'category' as const,
      data: ['1号站', '2号站', '3号站', '4号站', '5号站', '6号站'],
      axisLabel: {
        ...chartTheme.xAxis.axisLabel,
        ...energyChart.xAxisLabel,
      },
    },
    yAxis: {
      ...chartTheme.yAxis,
      type: 'value' as const,
      name: 'kWh',
      nameTextStyle: { color: colors.textTertiary, fontSize: 11 },
    },
    series: [
      {
        name: '实际能耗',
        type: 'bar' as const,
        barWidth: 20,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: colors.primary,
        },
        data: [4200, 3800, 4500, 3200, 0, 3600],
      },
      {
        name: '计划能耗',
        type: 'bar' as const,
        barWidth: 20,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: colors.borderLight,
        },
        data: [4000, 4000, 4000, 4000, 4000, 4000],
      },
    ],
    legend: {
      ...(energyChart.legend !== false
        ? {
          ...chartTheme.legend,
          data: ['实际能耗', '计划能耗'],
          ...energyChart.legend,
        }
        : { show: false }),
    },
  }), [energyChart.grid, energyChart.xAxisLabel, energyChart.legend, energyChart.tooltipConf])

  // 获取预警图标样式
  const getAlertIconClass = (type: AlertData['type']) => {
    const classMap = {
      critical: styles.alertIconCritical,
      warning: styles.alertIconWarning,
      info: styles.alertIconInfo,
    }
    return classMap[type]
  }

  // 获取趋势样式
  const getTrendClass = (trend: StatCardData['trend']) => {
    const classMap = {
      up: styles.statTrendUp,
      down: styles.statTrendDown,
      neutral: styles.statTrendNeutral,
    }
    return classMap[trend]
  }

  return (
    <AnimatedPage className={styles.dashboard}>
      <div className={styles.dashboardContent}>
        {/* ═══════════════════════════════════════════════════════════
         * Header 区域
         * ═══════════════════════════════════════════════════════════ */}
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerInfo}>
              <h1 className={styles.pageTitle}>
                <span className={styles.pageTitleAccent}>智能监测</span> 控制中心
              </h1>
              <p className={styles.pageSubtitle}>
                油气管道实时数据监控与智能分析平台
              </p>
            </div>

            <div className={styles.headerActions}>
              <div className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                <span className={styles.liveText}>实时</span>
                <span className={styles.liveTime}>
                  {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
              </div>

              <button className={styles.headerButton}>
                <RiRefreshLine size={16} />
                刷新数据
              </button>

              <button className={`${styles.headerButton} ${styles.headerButtonPrimary}`}>
                <RiSettings3Line size={16} />
                系统设置
              </button>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════
         * 统计卡片区域
         * ═══════════════════════════════════════════════════════════ */}
        <section className={`${styles.statsGrid} grid-auto-stats`}>
          {statsData.map((stat, index) => (
            <motion.div
              key={stat.id}
              className={styles.statCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 24,
                delay: index * 0.08,
              }}
              whileHover={{ y: -4, boxShadow: 'var(--shadow-lg)' }}
            >
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>{stat.label}</span>
                <div className={`${styles.statIconWrapper} ${stat.colorClass}`}>
                  {stat.icon}
                </div>
              </div>

              <div className={styles.statValue}>
                {stat.value.toLocaleString()}
                <span className={styles.statUnit}>{stat.unit}</span>
              </div>

              <div className={styles.statFooter}>
                <span className={`${styles.statTrend} ${getTrendClass(stat.trend)}`}>
                  {stat.trend === 'up' && <RiArrowUpLine size={12} />}
                  {stat.trend === 'down' && <RiArrowDownLine size={12} />}
                  {stat.trendValue}
                </span>
                <span className={styles.statDescription}>{stat.description}</span>
              </div>
            </motion.div>
          ))}
        </section>

        {/* ═══════════════════════════════════════════════════════════
         * 图表区域
         * ═══════════════════════════════════════════════════════════ */}
        <section className={`${styles.chartsSection} grid-auto-charts`}>
          {/* 流量趋势 */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleGroup}>
                <h3 className={styles.chartTitle}>流量趋势</h3>
                <p className={styles.chartSubtitle}>24小时实时流量监控</p>
              </div>
              <div className={styles.chartActions}>
                {['24h', '7d', '30d'].map((range) => (
                  <button
                    key={range}
                    className={`${styles.chartActionBtn} ${activeTimeRange === range ? styles.chartActionBtnActive : ''}`}
                    onClick={() => setActiveTimeRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.chartContainer} ref={flowChart.containerRef}>
              <Chart option={flowTrendOption} renderer={flowChart.renderer} />
            </div>
          </div>

          {/* 压力分布 */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleGroup}>
                <h3 className={styles.chartTitle}>压力分布</h3>
                <p className={styles.chartSubtitle}>各站点压力雷达图</p>
              </div>
            </div>
            <div className={styles.chartContainer} ref={pressureChart.containerRef}>
              <Chart option={pressureDistOption} renderer={pressureChart.renderer} />
            </div>
          </div>

          {/* 能耗分析 - 全宽 */}
          <div className={`${styles.chartCard} ${styles.chartCardFull} grid-full-width`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleGroup}>
                <h3 className={styles.chartTitle}>能耗分析</h3>
                <p className={styles.chartSubtitle}>各泵站能耗对比与优化建议</p>
              </div>
              <div className={styles.chartActions}>
                <button className={styles.chartActionBtn}>
                  <RiBarChartBoxLine size={14} />
                  详细报告
                </button>
              </div>
            </div>
            <div className={`${styles.chartContainer} ${styles.chartContainerLarge}`} ref={energyChart.containerRef}>
              <Chart option={energyOption} renderer={energyChart.renderer} />
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
         * 底部区域 - 预警 & 设备状态
         * ═══════════════════════════════════════════════════════════ */}
        <section className={`${styles.bottomSection} grid-auto-charts perf-lazy-render`}>
          {/* 预警列表 */}
          <div className={styles.alertCard}>
            <div className={styles.alertHeader}>
              <h3 className={styles.alertTitle}>
                <RiAlertLine size={20} />
                实时预警
                <span className={styles.alertBadge}>{alertsData.filter(a => a.type === 'critical').length}</span>
              </h3>
              <button className={styles.alertViewAll}>查看全部</button>
            </div>

            <AnimatedListContainer className={styles.alertList}>
              {alertsData.map((alert) => (
                <AnimatedListItem key={alert.id}>
                  <div className={styles.alertItem}>
                    <div className={`${styles.alertIcon} ${getAlertIconClass(alert.type)}`}>
                      <RiAlertLine size={18} />
                    </div>
                    <div className={styles.alertContent}>
                      <p className={styles.alertMessage}>{alert.message}</p>
                      <div className={styles.alertMeta}>
                        <span className={styles.alertTime}>
                          <RiTimeLine size={12} />
                          {alert.time}
                        </span>
                        <span className={styles.alertLocation}>
                          <RiMapPinLine size={12} />
                          {alert.location}
                        </span>
                      </div>
                    </div>
                    <RiArrowRightSLine size={20} className={styles.alertArrow} />
                  </div>
                </AnimatedListItem>
              ))}
            </AnimatedListContainer>
          </div>

          {/* 设备状态 */}
          <div className={styles.deviceCard}>
            <div className={styles.deviceHeader}>
              <h3 className={styles.deviceTitle}>设备状态</h3>
              <div className={styles.deviceSummary}>
                <div className={styles.deviceStat}>
                  <span className={`${styles.deviceStatDot} ${styles.deviceStatDotOnline}`} />
                  <span className={styles.deviceStatLabel}>在线</span>
                  <span className={styles.deviceStatValue}>
                    {devicesData.filter(d => d.status === 'online').length}
                  </span>
                </div>
                <div className={styles.deviceStat}>
                  <span className={`${styles.deviceStatDot} ${styles.deviceStatDotWarning}`} />
                  <span className={styles.deviceStatLabel}>告警</span>
                  <span className={styles.deviceStatValue}>
                    {devicesData.filter(d => d.status === 'warning').length}
                  </span>
                </div>
                <div className={styles.deviceStat}>
                  <span className={`${styles.deviceStatDot} ${styles.deviceStatDotOffline}`} />
                  <span className={styles.deviceStatLabel}>离线</span>
                  <span className={styles.deviceStatValue}>
                    {devicesData.filter(d => d.status === 'offline').length}
                  </span>
                </div>
              </div>
            </div>

            <div className={`${styles.deviceGrid} grid-auto-devices`}>
              {devicesData.map((device) => (
                <div key={device.id} className={styles.deviceItem}>
                  <div className={styles.deviceItemIcon}>
                    <RiDashboardLine size={20} />
                  </div>
                  <div className={styles.deviceItemInfo}>
                    <p className={styles.deviceItemName}>{device.name}</p>
                    <div className={styles.deviceItemStatus}>
                      <span className={`${styles.deviceItemStatusDot} ${
                        device.status === 'online' ? styles.deviceItemStatusDotOnline : styles.deviceItemStatusDotOffline
                      }`} />
                      {device.status === 'online' ? '运行中' : device.status === 'warning' ? '告警' : '离线'}
                    </div>
                  </div>
                  <div>
                    <span className={styles.deviceItemValue}>{device.value.toLocaleString()}</span>
                    <span className={styles.deviceItemUnit}>{device.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AnimatedPage>
  )
}
