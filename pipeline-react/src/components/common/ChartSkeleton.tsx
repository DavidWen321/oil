import { Skeleton } from 'antd';

interface ChartSkeletonProps {
  height?: number;
}

/**
 * 图表加载骨架屏
 * 用于 ECharts 图表加载时的占位显示
 */
export default function ChartSkeleton({ height = 320 }: ChartSkeletonProps) {
  return (
    <div style={{ padding: '24px' }}>
      <Skeleton.Button active block style={{ height: `${height}px`, marginBottom: 16 }} />
      <Skeleton active paragraph={{ rows: 2 }} />
    </div>
  );
}
