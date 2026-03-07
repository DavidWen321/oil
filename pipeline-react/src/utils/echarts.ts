/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  ECharts Optimized Import
 *  按需引入 ECharts 模块（减少包体积）
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as echarts from 'echarts/core';

// 引入需要的图表类型
import {
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GaugeChart,
} from 'echarts/charts';

// 引入需要的组件
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components';

// 引入渲染器
import { CanvasRenderer } from 'echarts/renderers';

// 注册必需的组件
echarts.use([
  // 图表类型
  LineChart,
  BarChart,
  PieChart,
  ScatterChart,
  GaugeChart,

  // 组件
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,

  // 渲染器
  CanvasRenderer,
]);

export default echarts;
