<<<<<<< Updated upstream
/**
 * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? *  Dashboard - 娌规皵绠￠亾鏅鸿兘鐩戞祴绯荤粺
 *  璁捐鐞嗗康: Apple + Linear + Vercel 鏋佺畝涓讳箟椋庢牸
 * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺? */
=======
﻿/**
 * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
 *  Dashboard - 娌规皵绠￠亾鏅鸿兘鐩戞祴绯荤粺
 *  璁捐鐞嗗康: Apple + Linear + Vercel 鏋佺畝涓讳箟椋庢牸
 * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
 */
>>>>>>> Stashed changes

import { useState, useMemo } from 'react'
import { motion } from 'motion/react'
import type { EChartsOption } from 'echarts'
import {
  RiDropLine,
  RiTempColdLine,
  RiAlertLine,
  RiArrowRightSLine,
  RiTimeLine,
  RiMapPinLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiFlashlightLine,
  RiPulseLine,
  RiDashboardLine,
} from 'react-icons/ri'
import AnimatedPage from '../../components/common/AnimatedPage'
import { AnimatedListContainer, AnimatedListItem } from '../../components/common/AnimatedList'
import Chart from '../../components/common/Chart'
import { useChartConfig } from '../../hooks/useChartConfig'
import { useChartGesture } from '../../hooks/useChartGesture'
import styles from './Dashboard.module.css'

<<<<<<< Updated upstream
// 类型定义
=======
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
// 绫诲瀷瀹氫箟
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
// ECharts 主题配置 - Apple HIG 风格
// 主色调定义
const colors = {
  primary: '#007AFF',
  primaryLight: 'rgba(0, 122, 255, 0.12)',
  primaryMedium: 'rgba(0, 122, 255, 0.6)',
=======
type TimeRange = '24h' | '7d' | '30d'

interface FlowTrendRangeConfig {
  value: TimeRange
  label: string
  subtitle: string
  categories: string[]
  currentSeriesName: string
  previousSeriesName: string
  currentData: number[]
  previousData: number[]
}

const flowTrendRanges: FlowTrendRangeConfig[] = [
  {
    value: '24h',
    label: '24h',
    subtitle: '24小时实时流量监控',
    categories: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
    currentSeriesName: '当前流量',
    previousSeriesName: '昨日流量',
    currentData: [2100, 2250, 2680, 2890, 2750, 2920, 2847],
    previousData: [1900, 2100, 2400, 2600, 2500, 2700, 2530],
  },
  {
    value: '7d',
    label: '7d',
    subtitle: '最近7天平均流量趋势',
    categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    currentSeriesName: '本周均值',
    previousSeriesName: '上周均值',
    currentData: [2520, 2610, 2740, 2680, 2810, 2895, 2850],
    previousData: [2380, 2460, 2580, 2510, 2630, 2715, 2690],
  },
  {
    value: '30d',
    label: '30d',
    subtitle: '最近30天阶段流量趋势',
    categories: ['1日', '5日', '10日', '15日', '20日', '25日', '30日'],
    currentSeriesName: '本月均值',
    previousSeriesName: '上月均值',
    currentData: [2320, 2480, 2590, 2710, 2790, 2870, 2930],
    previousData: [2210, 2340, 2460, 2550, 2640, 2720, 2810],
  },
]

// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
// ECharts 娴呰壊涓婚閰嶇疆 - Apple HIG 椋庢牸
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

// 涓昏壊璋冨畾涔?- Apple 绯荤粺鑹?
const colors = {
  // Apple Blue 涓昏壊
  primary: '#007AFF',
  primaryLight: 'rgba(0, 122, 255, 0.12)',
  primaryMedium: 'rgba(0, 122, 255, 0.6)',
  // 杈呭姪鑹?
>>>>>>> Stashed changes
  purple: '#5856D6',
  purpleLight: 'rgba(88, 86, 214, 0.12)',
  cyan: '#32ADE6',
  cyanLight: 'rgba(50, 173, 230, 0.12)',
  green: '#34C759',
  orange: '#FF9500',
<<<<<<< Updated upstream
=======
  // 鏂囨湰鑹?
>>>>>>> Stashed changes
  textPrimary: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#8E8E93',
  textMuted: '#AEAEB2',
<<<<<<< Updated upstream
=======
  // 杈规鍜岃儗鏅?
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
// Dashboard 组件

type TimeRangeKey = '24h' | '7d' | '30m'

interface DashboardSnapshot {
  stats: {
    flow: number
    pressure: number
    temperature: number
    efficiency: number
  }
  trends: {
    flow: string
    pressure: string
    temperature: string
    efficiency: string
  }
  flow: Record<TimeRangeKey, { current: number[]; previous: number[] }>
  pressure: number[]
  energyActual: number[]
  deviceValues: number[]
  deviceStatuses: DeviceData['status'][]
}

const flowSeriesBase: DashboardSnapshot['flow'] = {
  '24h': {
    current: [2050, 2140, 2260, 2410, 2580, 2720, 2840, 2910, 2890, 2870, 2920, 2895, 2847],
    previous: [1910, 1980, 2070, 2190, 2320, 2440, 2550, 2630, 2660, 2690, 2725, 2660, 2530],
  },
  '7d': {
    current: [2520, 2610, 2750, 2880, 2810, 2950, 2847],
    previous: [2380, 2460, 2590, 2670, 2710, 2790, 2730],
  },
  '30m': {
    current: [2745, 2760, 2772, 2788, 2805, 2820, 2836, 2844, 2856, 2850, 2847],
    previous: [2700, 2712, 2720, 2735, 2746, 2760, 2772, 2780, 2790, 2798, 2805],
  },
}

const pressureBase = [5.2, 4.8, 4.5, 4.2, 3.9, 3.5]
const energyBase = [4200, 3800, 4500, 3200, 0, 3600]
const deviceBase = [2150, 1890, 2340, 2010, 0, 1750]

function createSeededRandom(seed: number) {
  let value = seed % 2147483647
  if (value <= 0) {
    value += 2147483646
  }

  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function varySeries(base: number[], spread: number, rand: () => number, minValue = 0) {
  return base.map((value) => Math.max(minValue, Math.round(value + (rand() * 2 - 1) * spread)))
}

function createDashboardSnapshot(seed: number): DashboardSnapshot {
  const rand = createSeededRandom(seed)
  const flow24hCurrent = varySeries(flowSeriesBase['24h'].current, 120, rand, 1800)
  const flow24hPrevious = varySeries(flowSeriesBase['24h'].previous, 90, rand, 1700)
  const flow7dCurrent = varySeries(flowSeriesBase['7d'].current, 140, rand, 2200)
  const flow7dPrevious = varySeries(flowSeriesBase['7d'].previous, 110, rand, 2100)
  const flow30mCurrent = varySeries(flowSeriesBase['30m'].current, 45, rand, 2500)
  const flow30mPrevious = varySeries(flowSeriesBase['30m'].previous, 35, rand, 2450)
  const pressure = pressureBase.map((value) => Number((value + (rand() * 2 - 1) * 0.18).toFixed(2)))
  const energyActual = energyBase.map((value, index) => {
    if (index === 4) {
      return 0
    }
    return Math.max(2600, Math.round(value + (rand() * 2 - 1) * 280))
  })
  const deviceValues = deviceBase.map((value, index) => {
    if (index === 4) {
      return 0
    }
    return Math.max(1500, Math.round(value + (rand() * 2 - 1) * 180))
  })
  const deviceStatuses = deviceValues.map((value, index) => {
    if (index === 4) {
      return 'offline'
    }
    if (index === 2 || value > 2280) {
      return 'warning'
    }
    return 'online'
  })

  return {
    stats: {
      flow: flow24hCurrent[flow24hCurrent.length - 1],
      pressure: Number((4.7 + rand() * 0.4).toFixed(2)),
      temperature: Number((41.5 + rand() * 2.4).toFixed(1)),
      efficiency: Number((93.2 + rand() * 2.1).toFixed(1)),
    },
    trends: {
      flow: `+${(8.5 + rand() * 5).toFixed(1)}%`,
      pressure: `${(rand() * 0.6 - 0.3).toFixed(1)}%`,
      temperature: `-${(1.2 + rand() * 1.8).toFixed(1)}%`,
      efficiency: `+${(2 + rand() * 2).toFixed(1)}%`,
    },
    flow: {
      '24h': { current: flow24hCurrent, previous: flow24hPrevious },
      '7d': { current: flow7dCurrent, previous: flow7dPrevious },
      '30m': { current: flow30mCurrent, previous: flow30mPrevious },
    },
    pressure,
    energyActual,
    deviceValues,
    deviceStatuses,
  }
}
export default function Dashboard() {
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRangeKey>('24h')
  const [refreshSeed, setRefreshSeed] = useState(() => Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const dashboardSnapshot = useMemo(() => createDashboardSnapshot(refreshSeed), [refreshSeed])
=======
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
// Dashboard 缁勪欢
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
export default function Dashboard() {
  const [activeTimeRange, setActiveTimeRange] = useState<TimeRange>('24h')
>>>>>>> Stashed changes
  const flowChart = useChartConfig()
  const pressureChart = useChartConfig({ mobileSvg: false })
  const energyChart = useChartConfig()

  useChartGesture(flowChart.containerRef)
  useChartGesture(pressureChart.containerRef)
  useChartGesture(energyChart.containerRef)

  // 瀹炴椂鏃堕挓
<<<<<<< Updated upstream
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setRefreshSeed(Date.now())
    setCurrentTime(new Date())
    window.setTimeout(() => setIsRefreshing(false), 450)
  }

  // 统计卡片数据
=======

  // 缁熻鍗＄墖鏁版嵁
>>>>>>> Stashed changes
  const statsData: StatCardData[] = useMemo(() => [
    {
      id: 'flow',
      label: '实时流量',
<<<<<<< Updated upstream
      value: dashboardSnapshot.stats.flow,
      unit: 'm3/h',
      trend: 'up',
      trendValue: dashboardSnapshot.trends.flow,
      description: '较昨日同期',
=======
      value: 2847,
      unit: 'm3/h',
      trend: 'up',
      trendValue: '+12.5%',
      description: '较昨日同时段提升',
>>>>>>> Stashed changes
      icon: <RiDropLine size={20} />,
      colorClass: styles.statIconBlue,
    },
    {
      id: 'pressure',
      label: '管道压力',
      value: dashboardSnapshot.stats.pressure,
      unit: 'MPa',
      trend: 'neutral',
<<<<<<< Updated upstream
      trendValue: dashboardSnapshot.trends.pressure,
      description: '运行正常',
=======
      trendValue: '0.0%',
      description: '运行状态稳定',
>>>>>>> Stashed changes
      icon: <RiPulseLine size={20} />,
      colorClass: styles.statIconCyan,
    },
    {
      id: 'temperature',
      label: '平均温度',
      value: dashboardSnapshot.stats.temperature,
      unit: '°C',
      trend: 'down',
<<<<<<< Updated upstream
      trendValue: dashboardSnapshot.trends.temperature,
      description: '较昨日同期',
=======
      trendValue: '-2.3%',
      description: '较昨日同时段下降',
>>>>>>> Stashed changes
      icon: <RiTempColdLine size={20} />,
      colorClass: styles.statIconGreen,
    },
    {
      id: 'efficiency',
      label: '系统效率',
      value: dashboardSnapshot.stats.efficiency,
      unit: '%',
      trend: 'up',
<<<<<<< Updated upstream
      trendValue: dashboardSnapshot.trends.efficiency,
      description: '优于目标',
=======
      trendValue: '+3.2%',
      description: '优于目标区间',
>>>>>>> Stashed changes
      icon: <RiFlashlightLine size={20} />,
      colorClass: styles.statIconAmber,
    },
  ], [dashboardSnapshot])

  // 棰勮鏁版嵁
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
      message: '输油温度接近上限，建议调整参数',
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

  // 璁惧鏁版嵁
  const devicesData: DeviceData[] = useMemo(() => [
    { id: '1', name: '1号泵站', status: dashboardSnapshot.deviceStatuses[0], value: dashboardSnapshot.deviceValues[0], unit: 'kW' },
    { id: '2', name: '2号泵站', status: dashboardSnapshot.deviceStatuses[1], value: dashboardSnapshot.deviceValues[1], unit: 'kW' },
    { id: '3', name: '3号泵站', status: dashboardSnapshot.deviceStatuses[2], value: dashboardSnapshot.deviceValues[2], unit: 'kW' },
    { id: '4', name: '4号泵站', status: dashboardSnapshot.deviceStatuses[3], value: dashboardSnapshot.deviceValues[3], unit: 'kW' },
    { id: '5', name: '5号泵站', status: dashboardSnapshot.deviceStatuses[4], value: dashboardSnapshot.deviceValues[4], unit: 'kW' },
    { id: '6', name: '6号泵站', status: dashboardSnapshot.deviceStatuses[5], value: dashboardSnapshot.deviceValues[5], unit: 'kW' },
  ], [dashboardSnapshot])

<<<<<<< Updated upstream
  // 流量趋势图配置
  const flowRangeConfig = useMemo(() => {
    switch (activeTimeRange) {
      case '7d':
        return {
          subtitle: '近7天实时流量变化',
          compareLabel: '上周同期',
          xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
          current: dashboardSnapshot.flow['7d'].current,
          previous: dashboardSnapshot.flow['7d'].previous,
        }
      case '30m':
        return {
          subtitle: '最近30分钟分钟级流量监控',
          compareLabel: '上一时段',
          xAxis: ['00分', '03分', '06分', '09分', '12分', '15分', '18分', '21分', '24分', '27分', '30分'],
          current: dashboardSnapshot.flow['30m'].current,
          previous: dashboardSnapshot.flow['30m'].previous,
        }
      default:
        return {
          subtitle: '24小时实时流量监控',
          compareLabel: '昨日流量',
          xAxis: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'],
          current: dashboardSnapshot.flow['24h'].current,
          previous: dashboardSnapshot.flow['24h'].previous,
        }
    }
  }, [activeTimeRange, dashboardSnapshot])
=======
  // 娴侀噺瓒嬪娍鍥鹃厤缃?
  const activeFlowTrend = useMemo(
    () => flowTrendRanges.find((item) => item.value === activeTimeRange) ?? flowTrendRanges[0],
    [activeTimeRange],
  )

  const flowLegend = useMemo<Record<string, unknown> | false>(() => {
    if (flowChart.legend === false) {
      return false
    }

    return {
      ...chartTheme.legend,
      data: ['currentFlow', 'previousFlow'],
      formatter: (name: string) => (
        name === 'currentFlow'
          ? activeFlowTrend.currentSeriesName
          : activeFlowTrend.previousSeriesName
      ),
      ...(flowChart.isMedium
        ? { top: 0, right: 0, bottom: 'auto', icon: 'roundRect', itemWidth: 14, itemHeight: 3, textStyle: { fontSize: 11 } }
        : flowChart.legend),
    }
  }, [activeFlowTrend, flowChart.isMedium, flowChart.legend])
>>>>>>> Stashed changes

  const flowTrendOption = useMemo<EChartsOption>(() => ({
    ...chartTheme,
    grid: flowChart.isCompact
      ? flowChart.grid
      : { ...flowChart.grid, top: 28, right: 18, bottom: 22, left: 20 },
    tooltip: {
      ...chartTheme.tooltip,
      ...flowChart.tooltipConf,
    },
    xAxis: {
      ...chartTheme.xAxis,
      type: 'category' as const,
<<<<<<< Updated upstream
      data: flowRangeConfig.xAxis,
=======
      data: activeFlowTrend.categories,
>>>>>>> Stashed changes
      boundaryGap: false,
      axisLabel: {
        ...chartTheme.xAxis.axisLabel,
        ...flowChart.xAxisLabel,
      },
    },
    yAxis: {
      ...chartTheme.yAxis,
      type: 'value' as const,
      name: 'm3/h',
      nameTextStyle: { color: colors.textTertiary, fontSize: 12, padding: [0, 0, 8, 0] },
      splitNumber: 5,
      min: ({ min }: { min: number }) => Math.floor((min - 160) / 100) * 100,
      max: ({ max }: { max: number }) => Math.ceil((max + 120) / 100) * 100,
    },
    series: [
      {
        name: 'currentFlow',
        type: 'line' as const,
        smooth: 0.28,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: flowChart.isCompact ? 5 : 7,
        lineStyle: {
          width: 4,
          color: colors.primary,
          shadowColor: 'rgba(0, 122, 255, 0.25)',
          shadowBlur: 8,
        },
        areaStyle: { opacity: 0.25 },
<<<<<<< Updated upstream
        data: flowRangeConfig.current,
      },
      {
        name: flowRangeConfig.compareLabel,
=======
        data: activeFlowTrend.currentData,
      },
      {
        name: 'previousFlow',
>>>>>>> Stashed changes
        type: 'line' as const,
        smooth: 0.24,
        symbol: 'none',
        lineStyle: {
          width: 3,
          color: colors.purple,
          type: 'dashed' as const,
          opacity: 0.9,
        },
<<<<<<< Updated upstream
        data: flowRangeConfig.previous,
      },
    ],
    legend: {
      ...(flowChart.legend !== false
        ? {
            ...chartTheme.legend,
            data: ['实时流量', flowRangeConfig.compareLabel],
            ...flowChart.legend,
          }
        : { show: false }),
    },
  }), [activeTimeRange, flowChart.grid, flowChart.isCompact, flowChart.xAxisLabel, flowChart.legend, flowChart.tooltipConf, flowRangeConfig])

  const pressureDistOption = useMemo<EChartsOption>(() => {
    const radarLayout = pressureChart.isCompact
      ? { center: ['50%', '58%'], radius: '56%', nameGap: 8, fontSize: 10, splitNumber: 4 }
      : pressureChart.isMedium
        ? { center: ['50%', '56%'], radius: '63%', nameGap: 10, fontSize: 12, splitNumber: 4 }
        : { center: ['50%', '55%'], radius: '70%', nameGap: 12, fontSize: 12, splitNumber: 5 }

    return {
      ...chartTheme,
      legend: { show: false },
      tooltip: {
        ...chartTheme.tooltip,
        ...pressureChart.tooltipConf,
=======
        data: activeFlowTrend.previousData,
      },
    ],
    legend: flowLegend === false ? { show: false } : flowLegend,
  }), [activeFlowTrend, flowChart.grid, flowChart.xAxisLabel, flowChart.tooltipConf, flowLegend])

  // 鍘嬪姏鍒嗗竷鍥鹃厤缃?
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
>>>>>>> Stashed changes
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
        center: radarLayout.center,
        radius: radarLayout.radius,
        splitNumber: radarLayout.splitNumber,
        nameGap: radarLayout.nameGap,
        axisName: {
          color: colors.textSecondary,
          fontSize: radarLayout.fontSize,
          lineHeight: radarLayout.fontSize + 6,
          padding: [2, 4, 0, 4],
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
        symbolSize: pressureChart.isCompact ? 6 : 8,
        lineStyle: {
          width: 3,
          color: colors.cyan,
        },
        itemStyle: {
          color: colors.cyan,
          borderColor: colors.bgElevated,
          borderWidth: 2,
        },
        areaStyle: {
          color: 'rgba(50, 173, 230, 0.22)',
        },
        data: [{
          value: dashboardSnapshot.pressure,
          name: '当前压力',
        }],
      }],
    }
  }, [dashboardSnapshot.pressure, pressureChart.isCompact, pressureChart.isMedium, pressureChart.tooltipConf])

<<<<<<< Updated upstream
=======
  // 鑳借€楀垎鏋愬浘閰嶇疆
>>>>>>> Stashed changes
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
        data: dashboardSnapshot.energyActual,
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
  }), [dashboardSnapshot.energyActual, energyChart.grid, energyChart.xAxisLabel, energyChart.legend, energyChart.tooltipConf])

  // 鑾峰彇棰勮鍥炬爣鏍峰紡
  const getAlertIconClass = (type: AlertData['type']) => {
    const classMap = {
      critical: styles.alertIconCritical,
      warning: styles.alertIconWarning,
      info: styles.alertIconInfo,
    }
    return classMap[type]
  }

  // 鑾峰彇瓒嬪娍鏍峰紡
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
<<<<<<< Updated upstream
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?         * Header 鍖哄煙
=======
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
         * Header 鍖哄煙
>>>>>>> Stashed changes
         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <div className={styles.headerInfo}>
              <h1 className={styles.pageTitle}>
                <span className={styles.pageTitleAccent}>智能监测</span> 控制中心
              </h1>
              <p className={styles.pageSubtitle}>
                油气管道实时数据监控与智能分析平台</p>
            </div>

            {/*
            <div className={styles.headerActions}>
              <div className={styles.liveIndicator}>
                <span className={styles.liveDot} />
                <span className={styles.liveText}>瀹炴椂</span>
                <span className={styles.liveTime}>
                  {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
                </span>
              </div>

<<<<<<< Updated upstream
              <button
                className={styles.headerButton}
                onClick={handleRefresh}
                type="button"
              >
                <RiRefreshLine size={16} style={isRefreshing ? { transform: 'rotate(180deg)', transition: 'transform 0.3s ease' } : undefined} />
                {isRefreshing ? '刷新中...' : '刷新数据'}
=======
              <button className={styles.headerButton}>
                <RiRefreshLine size={16} />
                鍒锋柊鏁版嵁
>>>>>>> Stashed changes
              </button>

              <button
                className={`${styles.headerButton} ${styles.headerButtonPrimary}`}
                onClick={() => navigate('/settings')}
                type="button"
              >
                <RiSettings3Line size={16} />
                绯荤粺璁剧疆
              </button>
            </div>
            */}
          </div>
        </header>

<<<<<<< Updated upstream
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?         * 缁熻鍗＄墖鍖哄煙
=======
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
         * 缁熻鍗＄墖鍖哄煙
>>>>>>> Stashed changes
         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
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

<<<<<<< Updated upstream
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?         * 鍥捐〃鍖哄煙
         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
        <section className={`${styles.chartsSection} grid-auto-charts`}>
=======
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
         * 鍥捐〃鍖哄煙
         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
        <section className={styles.chartsSection}>
>>>>>>> Stashed changes
          {/* 娴侀噺瓒嬪娍 */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleGroup}>
                <h3 className={styles.chartTitle}>流量趋势</h3>
<<<<<<< Updated upstream
                <p className={styles.chartSubtitle}>{flowRangeConfig.subtitle}</p>
              </div>
              <div className={styles.chartActions}>
                {([
                  { key: '24h', label: '24小时' },
                  { key: '7d', label: '7天' },
                  { key: '30m', label: '30分钟' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.chartActionBtn} ${activeTimeRange === key ? styles.chartActionBtnActive : ''}`}
                    onClick={() => setActiveTimeRange(key)}
                    type="button"
                  >
                    {label}
=======
                <p className={styles.chartSubtitle}>{activeFlowTrend.subtitle}</p>
              </div>
              <div className={styles.chartActions}>
                {flowTrendRanges.map((range) => (
                  <button
                    key={range.value}
                    className={`${styles.chartActionBtn} ${activeTimeRange === range.value ? styles.chartActionBtnActive : ''}`}
                    onClick={() => setActiveTimeRange(range.value)}
                  >
                    {range.label}
>>>>>>> Stashed changes
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.chartContainer} ref={flowChart.containerRef}>
              <Chart option={flowTrendOption} renderer={flowChart.renderer} />
            </div>
          </div>

          {/* 鍘嬪姏鍒嗗竷 */}
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

          {/* 鑳借€楀垎鏋?- 鍏ㄥ */}
          <div className={`${styles.chartCard} ${styles.chartCardFull} grid-full-width`}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTitleGroup}>
                <h3 className={styles.chartTitle}>能耗分析</h3>
                <p className={styles.chartSubtitle}>各泵站能耗对比与优化建议</p>
              </div>
            </div>
            <div className={`${styles.chartContainer} ${styles.chartContainerLarge}`} ref={energyChart.containerRef}>
              <Chart option={energyOption} renderer={energyChart.renderer} />
            </div>
          </div>
        </section>

<<<<<<< Updated upstream
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?         * 搴曢儴鍖哄煙 - 棰勮 & 璁惧鐘舵€?         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
        <section className={`${styles.bottomSection} grid-auto-charts perf-lazy-render`}>
=======
        {/* 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
         * 搴曢儴鍖哄煙 - 棰勮 & 璁惧鐘舵€?
         * 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?*/}
        <section className={`${styles.bottomSection} perf-lazy-render`}>
>>>>>>> Stashed changes
          {/* 棰勮鍒楄〃 */}
          <div className={styles.alertCard}>
            <div className={styles.alertHeader}>
              <h3 className={styles.alertTitle}>
                <RiAlertLine size={20} />
                实时预警
                <span className={styles.alertBadge}>{alertsData.filter(a => a.type === 'critical').length}</span>
              </h3>
<<<<<<< Updated upstream
              <button
                className={styles.alertViewAll}
                onClick={() => navigate('/features/monitor')}
                type="button"
              >查看全部</button>
=======
>>>>>>> Stashed changes
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

          {/* 璁惧鐘舵€?*/}
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

<<<<<<< Updated upstream





=======
>>>>>>> Stashed changes
