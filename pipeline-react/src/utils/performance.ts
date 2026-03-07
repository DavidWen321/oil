/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Performance Monitoring Utilities
 *  监控 Web Vitals 和关键性能指标
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

/**
 * 性能指标类型
 */
export interface PerformanceMetrics {
  // Core Web Vitals
  FCP?: number; // First Contentful Paint (首次内容绘制)
  LCP?: number; // Largest Contentful Paint (最大内容绘制)
  INP?: number; // Interaction to Next Paint (交互到下次绘制)
  CLS?: number; // Cumulative Layout Shift (累积布局偏移)
  TTFB?: number; // Time to First Byte (首字节时间)

  // 自定义指标
  pageLoadTime?: number; // 页面加载时间
  domContentLoaded?: number; // DOM 内容加载完成时间
  resourceLoadTime?: number; // 资源加载时间
}

/**
 * 性能数据上报函数类型
 */
type ReportHandler = (metrics: PerformanceMetrics) => void;

/**
 * 存储性能指标
 */
const metricsStore: PerformanceMetrics = {};

/**
 * 上报处理器列表
 */
const reportHandlers: ReportHandler[] = [];

/**
 * 处理 Web Vitals 指标
 */
function handleMetric(metric: Metric) {
  const { name, value } = metric;

  // 存储指标
  metricsStore[name as keyof PerformanceMetrics] = value;

  // 控制台输出（开发环境）
  if (import.meta.env.DEV) {
    console.log(`[Performance] ${name}:`, value.toFixed(2), getMetricRating(name, value));
  }

  // 触发上报
  reportHandlers.forEach((handler) => handler({ ...metricsStore }));
}

/**
 * 获取指标评级
 */
function getMetricRating(name: string, value: number): string {
  const thresholds: Record<string, { good: number; needsImprovement: number }> = {
    FCP: { good: 1800, needsImprovement: 3000 },
    LCP: { good: 2500, needsImprovement: 4000 },
    INP: { good: 200, needsImprovement: 500 },
    CLS: { good: 0.1, needsImprovement: 0.25 },
    TTFB: { good: 800, needsImprovement: 1800 },
  };

  const threshold = thresholds[name];
  if (!threshold) return '';

  if (value <= threshold.good) return '✅ Good';
  if (value <= threshold.needsImprovement) return '⚠️ Needs Improvement';
  return '❌ Poor';
}

/**
 * 初始化性能监控
 */
export function initPerformanceMonitoring(reportHandler?: ReportHandler) {
  // 注册上报处理器
  if (reportHandler) {
    reportHandlers.push(reportHandler);
  }

  // 监控 Core Web Vitals
  onFCP(handleMetric);
  onLCP(handleMetric);
  onINP(handleMetric);
  onCLS(handleMetric);
  onTTFB(handleMetric);

  // 监控页面加载性能
  if (typeof window !== 'undefined' && window.performance) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
        const resourceLoadTime = perfData.loadEventEnd - perfData.domContentLoadedEventEnd;

        metricsStore.pageLoadTime = pageLoadTime;
        metricsStore.domContentLoaded = domContentLoaded;
        metricsStore.resourceLoadTime = resourceLoadTime;

        if (import.meta.env.DEV) {
          console.log('[Performance] Page Load Time:', pageLoadTime.toFixed(2), 'ms');
          console.log('[Performance] DOM Content Loaded:', domContentLoaded.toFixed(2), 'ms');
          console.log('[Performance] Resource Load Time:', resourceLoadTime.toFixed(2), 'ms');
        }

        reportHandlers.forEach((handler) => handler({ ...metricsStore }));
      }, 0);
    });
  }
}

/**
 * 上报性能数据到后端
 */
export function reportToBackend(metrics: PerformanceMetrics) {
  // 生产环境才上报
  if (import.meta.env.PROD) {
    // 使用 sendBeacon 确保数据发送（即使页面关闭）
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        metrics,
      });

      navigator.sendBeacon('/api/v1/performance', data);
    } else {
      // 降级方案：使用 fetch
      fetch('/api/v1/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: window.location.href,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          metrics,
        }),
        keepalive: true,
      }).catch(() => {
        // 静默失败
      });
    }
  }
}

/**
 * 上报性能数据到 Google Analytics
 */
export function reportToGA(metrics: PerformanceMetrics) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    Object.entries(metrics).forEach(([name, value]) => {
      if (value !== undefined) {
        (window as any).gtag('event', name, {
          event_category: 'Web Vitals',
          value: Math.round(value),
          event_label: window.location.pathname,
          non_interaction: true,
        });
      }
    });
  }
}

/**
 * 性能埋点：记录关键操作耗时
 */
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();

  /**
   * 开始计时
   */
  start(label: string) {
    this.marks.set(label, performance.now());
  }

  /**
   * 结束计时并返回耗时
   */
  end(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      console.warn(`[PerformanceTracker] No start mark found for: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(label);

    if (import.meta.env.DEV) {
      console.log(`[PerformanceTracker] ${label}:`, duration.toFixed(2), 'ms');
    }

    return duration;
  }

  /**
   * 测量异步操作
   */
  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      return await fn();
    } finally {
      this.end(label);
    }
  }
}

/**
 * 全局性能追踪器实例
 */
export const performanceTracker = new PerformanceTracker();

/**
 * 获取当前性能指标
 */
export function getMetrics(): PerformanceMetrics {
  return { ...metricsStore };
}
