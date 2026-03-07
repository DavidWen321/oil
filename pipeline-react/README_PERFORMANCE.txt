═══════════════════════════════════════════════════════════════════════════
  油管能耗分析系统 - 性能优化完整指南
  Pipeline Energy Analysis System - Performance Optimization Guide
═══════════════════════════════════════════════════════════════════════════

## 🎯 优化目标

### Core Web Vitals 目标
✓ FCP (First Contentful Paint) < 1.8s
✓ LCP (Largest Contentful Paint) < 2.5s
✓ FID (First Input Delay) < 100ms
✓ CLS (Cumulative Layout Shift) < 0.1
✓ TTFB (Time to First Byte) < 800ms

### 其他性能目标
✓ Lighthouse 性能评分 > 90
✓ 首屏加载时间 < 2s（3G 网络）
✓ 交互响应时间 < 100ms
✓ 包体积减少 30%+

═══════════════════════════════════════════════════════════════════════════

## 📦 已完成的优化

### 1. Vite 构建优化 (vite.config.ts)

✅ 代码分割策略
   - vendor-react: React 核心库
   - vendor-router: React Router
   - vendor-antd: Ant Design UI
   - vendor-icons: Ant Design Icons
   - vendor-charts: ECharts 图表库
   - vendor-markdown: Markdown 渲染
   - vendor-utils: axios, zustand, dayjs
   - vendor-animation: motion, @use-gesture
   - vendor-websocket: @stomp, sockjs-client

✅ 压缩优化
   - Gzip 压缩（10KB+ 文件）
   - Brotli 压缩（更高压缩率）
   - Terser 压缩（移除 console/debugger）

✅ 其他优化
   - CSS 代码分割
   - 依赖预构建
   - 包体积分析工具

### 2. 路由懒加载 (src/router.tsx)

✅ 所有页面组件使用 React.lazy
✅ Suspense fallback 骨架屏
✅ 路由预加载函数 prefetchRoute()
✅ 路由级别代码分割

### 3. 性能监控 (src/utils/performance.ts)

✅ Web Vitals 监控（FCP, LCP, FID, CLS, TTFB）
✅ 页面加载时间监控
✅ 性能埋点工具 PerformanceTracker
✅ 上报到后端 API
✅ 上报到 Google Analytics（可选）

### 4. 优化组件

✅ LazyImage - 图片懒加载（Intersection Observer）
✅ VirtualList - 虚拟滚动列表
✅ OptimizedChart - 优化的 ECharts 组件

### 5. 工具函数 (src/utils/debounce.ts)

✅ debounce() / throttle() 函数
✅ useDebounce() / useThrottle() Hooks

═══════════════════════════════════════════════════════════════════════════

## 🚀 快速开始

### 1. 安装依赖（已完成）

npm install

已安装的性能优化依赖：
- rollup-plugin-visualizer (包体积分析)
- vite-plugin-compression (Gzip/Brotli 压缩)
- web-vitals (性能监控)

### 2. 构建命令

# 开发环境
npm run dev

# 生产构建
npm run build

# 生产构建 + 包体积分析
npm run build:analyze
# 构建完成后打开 dist/stats.html 查看分析报告

# 预览构建结果
npm run preview

═══════════════════════════════════════════════════════════════════════════

## 💡 使用指南

### 1. 图片懒加载

import LazyImage from '@/components/common/LazyImage';

<LazyImage
  src="/images/pipeline.jpg"
  alt="管道示意图"
  placeholder="/images/placeholder.svg"
  onLoad={() => console.log('加载完成')}
/>

### 2. 虚拟滚动列表（大数据优化）

import VirtualList from '@/components/common/VirtualList';

<VirtualList
  data={items}
  itemHeight={50}
  containerHeight={600}
  overscan={3}
  renderItem={(item, index) => (
    <div>{item.name}</div>
  )}
/>

### 3. 优化的图表组件

import OptimizedChart from '@/components/common/OptimizedChart';

<OptimizedChart
  option={chartOption}
  loading={isLoading}
  style={{ height: '400px' }}
/>

### 4. 防抖/节流

import { useDebounce, useThrottle } from '@/utils/debounce';

// 防抖搜索（300ms 延迟）
const debouncedSearch = useDebounce((query: string) => {
  fetchData(query);
}, 300);

// 节流滚动（100ms 间隔）
const throttledScroll = useThrottle(() => {
  handleScroll();
}, 100);

### 5. 性能监控

// 自动收集性能数据（已在 main.tsx 中初始化）
import { getMetrics, performanceTracker } from '@/utils/performance';

// 查看当前性能指标
console.log(getMetrics());

// 性能埋点
performanceTracker.start('data-fetch');
await fetchData();
const duration = performanceTracker.end('data-fetch');

// 测量异步操作
await performanceTracker.measure('api-call', async () => {
  return await api.getData();
});

### 6. React 性能优化

参考: src/examples/performance-optimization.tsx

// 使用 React.memo 避免不必要的重渲染
const UserCard = memo(({ name, email }) => {
  return <div>{name} - {email}</div>;
});

// 使用 useMemo 缓存计算结果
const total = useMemo(() => {
  return items.reduce((sum, item) => sum + item.value, 0);
}, [items]);

// 使用 useCallback 缓存函数引用
const handleClick = useCallback(() => {
  doSomething();
}, []);

═══════════════════════════════════════════════════════════════════════════

## 📊 预期优化效果

### 包体积优化
- 代码分割: 初始加载包体积减少 40-50%
- Gzip 压缩: 传输体积减少 70-80%
- Brotli 压缩: 传输体积减少 75-85%
- ECharts 按需引入: 图表库体积减少 60-70%

### 加载性能优化
- 路由懒加载: 首屏加载时间减少 50-60%
- 图片懒加载: 页面加载时间减少 30-40%
- 依赖预构建: 开发环境启动速度提升 2-3 倍

### 运行时性能优化
- React.memo: 减少 30-50% 不必要的重渲染
- 虚拟滚动: 大列表渲染性能提升 10-100 倍
- 防抖/节流: 减少 80-90% 的事件处理调用

═══════════════════════════════════════════════════════════════════════════

## 🔧 下一步优化建议

### 高优先级（立即执行）
1. ✅ 运行 npm run build:analyze 查看包体积分析
2. 替换现有 Chart 组件为 OptimizedChart
3. 在大列表页面（ProjectList, PipelineList 等）使用 VirtualList
4. 在关键组件中使用 React.memo

### 中优先级（本周完成）
5. 配置 Service Worker（PWA）
6. 使用 React Query 缓存 API 数据
7. 优化图片资源（转换为 WebP 格式）
8. 字体子集化（Inter 字体）

### 低优先级（后续优化）
9. 配置 CDN 外链（大型库）
10. 实现更多骨架屏组件
11. 添加更多性能埋点
12. 实现预加载关键资源

═══════════════════════════════════════════════════════════════════════════

## 📁 新增文件清单

核心工具:
✓ src/utils/performance.ts          - 性能监控工具
✓ src/utils/debounce.ts             - 防抖/节流工具
✓ src/utils/echarts.ts              - ECharts 按需引入

优化组件:
✓ src/components/common/LazyImage.tsx       - 图片懒加载
✓ src/components/common/VirtualList.tsx     - 虚拟滚动
✓ src/components/common/OptimizedChart.tsx  - 优化图表

示例代码:
✓ src/examples/performance-optimization.tsx - 性能优化示例
✓ src/router-enhanced.tsx                   - 增强路由配置

文档:
✓ README_PERFORMANCE.txt            - 本文档
✓ OPTIMIZATION_SUMMARY.txt          - 优化总结

修改文件:
✓ vite.config.ts    - 构建优化配置
✓ package.json      - 新增依赖和脚本
✓ src/main.tsx      - 集成性能监控

═══════════════════════════════════════════════════════════════════════════

## 🎓 性能优化最佳实践

### 1. 代码分割
- 路由级别懒加载（已实现）
- 组件级别懒加载（按需实现）
- 第三方库分离打包（已实现）

### 2. 资源优化
- 图片懒加载（已提供组件）
- 图片格式优化（WebP）
- 字体子集化
- SVG 优化

### 3. 运行时优化
- React.memo 避免重渲染
- useMemo 缓存计算
- useCallback 缓存函数
- 虚拟滚动（大列表）
- 防抖/节流（事件处理）

### 4. 网络优化
- HTTP/2 多路复用
- 资源预加载（prefetch/preload）
- CDN 加速
- 缓存策略

### 5. 监控与分析
- Web Vitals 监控（已实现）
- 性能埋点（已实现）
- 包体积分析（已实现）
- Lighthouse 审计

═══════════════════════════════════════════════════════════════════════════

## 📞 技术支持

如有问题，请参考：
- 性能优化示例: src/examples/performance-optimization.tsx
- Vite 官方文档: https://vitejs.dev/
- React 性能优化: https://react.dev/learn/render-and-commit
- Web Vitals: https://web.dev/vitals/

═══════════════════════════════════════════════════════════════════════════
