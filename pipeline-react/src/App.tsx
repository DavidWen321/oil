/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Pipeline Energy Analysis System - App Root Component
 *  Design System: Vercel Geist + Linear + Stripe 风格
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { router } from './router';
import { useThemeStore } from './stores/themeStore';

// 导入设计系统样式
import './assets/styles/design-system-light.css';
import './assets/styles/responsive.css';
import './assets/styles/container-queries.css';
import './assets/styles/global.css';

/**
 * Ant Design 精致浅色主题配置
 * 基于 Vercel Geist + Linear + Stripe 设计原则
 */
const refinedLightTheme = {
  token: {
    // ─────────────────────────────────────────────
    // 品牌色 - 蓝色系（偏靛蓝，更有深度）
    // ─────────────────────────────────────────────
    colorPrimary: '#3B82F6',
    colorInfo: '#06B6D4',
    colorSuccess: '#10B981',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorLink: '#2563EB',
    colorLinkHover: '#1D4ED8',

    // ─────────────────────────────────────────────
    // 背景色 - 微妙的冷灰色层级（不是纯白）
    // ─────────────────────────────────────────────
    colorBgBase: '#F8FAFC',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F8FAFC',
    colorBgSpotlight: '#F1F5F9',
    colorBgMask: 'rgba(15, 23, 42, 0.6)',

    // ─────────────────────────────────────────────
    // 边框色 - 柔和的冷灰色
    // ─────────────────────────────────────────────
    colorBorder: 'rgba(15, 23, 42, 0.10)',
    colorBorderSecondary: 'rgba(15, 23, 42, 0.06)',
    colorSplit: 'rgba(15, 23, 42, 0.06)',

    // ─────────────────────────────────────────────
    // 文字色 - 深蓝黑色系
    // ─────────────────────────────────────────────
    colorText: '#0F172A',
    colorTextSecondary: '#334155',
    colorTextTertiary: '#64748B',
    colorTextQuaternary: '#94A3B8',
    colorTextDisabled: '#CBD5E1',

    // ─────────────────────────────────────────────
    // 填充色 - 交互状态
    // ─────────────────────────────────────────────
    colorFill: 'rgba(15, 23, 42, 0.04)',
    colorFillSecondary: 'rgba(15, 23, 42, 0.06)',
    colorFillTertiary: 'rgba(15, 23, 42, 0.08)',
    colorFillQuaternary: 'rgba(15, 23, 42, 0.02)',

    // ─────────────────────────────────────────────
    // 圆角 - 现代圆润风格
    // ─────────────────────────────────────────────
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // ─────────────────────────────────────────────
    // 字体 - Apple优先字体栈
    // ─────────────────────────────────────────────
    fontFamily: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text',
                 'Inter', 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif`,
    fontSize: 15,
    fontSizeLG: 17,
    fontSizeSM: 13,
    fontSizeXL: 21,
    fontSizeHeading1: 32,
    fontSizeHeading2: 26,
    fontSizeHeading3: 22,
    fontSizeHeading4: 19,
    fontSizeHeading5: 17,

    // ─────────────────────────────────────────────
    // 间距 - 基于8pt网格
    // ─────────────────────────────────────────────
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,
    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,

    // ─────────────────────────────────────────────
    // 阴影 - 柔和精致
    // ─────────────────────────────────────────────
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
    boxShadowSecondary: '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
    boxShadowTertiary: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',

    // ─────────────────────────────────────────────
    // 动效
    // ─────────────────────────────────────────────
    motionDurationFast: '0.15s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',
    motionEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',

    // ─────────────────────────────────────────────
    // 控件尺寸
    // ─────────────────────────────────────────────
    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
    controlHeightXS: 24,

    wireframe: false,
    motion: true,
  },

  components: {
    // ─────────────────────────────────────────────
    // Layout 布局 - 冷灰色背景层级
    // ─────────────────────────────────────────────
    Layout: {
      headerBg: '#FFFFFF',
      headerColor: '#0F172A',
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBg: '#FFFFFF',
      bodyBg: '#F8FAFC',
      footerBg: '#F8FAFC',
      triggerBg: '#F1F5F9',
      triggerColor: '#64748B',
    },

    // ─────────────────────────────────────────────
    // Menu 菜单 - 精致选中态
    // ─────────────────────────────────────────────
    Menu: {
      itemBg: 'transparent',
      itemColor: '#334155',
      itemHoverBg: '#F1F5F9',
      itemHoverColor: '#0F172A',
      itemSelectedBg: 'rgba(59, 130, 246, 0.08)',
      itemSelectedColor: '#2563EB',
      itemActiveBg: 'rgba(59, 130, 246, 0.12)',
      subMenuItemBg: 'transparent',
      itemBorderRadius: 8,
      itemMarginBlock: 4,
      itemMarginInline: 8,
      itemPaddingInline: 16,
      iconSize: 18,
      collapsedIconSize: 20,
      groupTitleColor: '#64748B',
      groupTitleFontSize: 12,
    },

    // ─────────────────────────────────────────────
    // Card 卡片 - 微妙阴影+悬停效果
    // ─────────────────────────────────────────────
    Card: {
      colorBgContainer: '#FFFFFF',
      colorBorderSecondary: 'rgba(15, 23, 42, 0.06)',
      borderRadiusLG: 12,
      paddingLG: 24,
      boxShadowTertiary: '0 1px 3px rgba(15, 23, 42, 0.04)',
      headerBg: 'transparent',
      headerFontSize: 17,
      headerFontSizeSM: 15,
      headerHeight: 56,
      headerHeightSM: 48,
    },

    // ─────────────────────────────────────────────
    // Table 表格 - 冷灰色表头
    // ─────────────────────────────────────────────
    Table: {
      colorBgContainer: '#FFFFFF',
      headerBg: '#F8FAFC',
      headerColor: '#64748B',
      headerSortActiveBg: '#F1F5F9',
      headerSortHoverBg: '#F1F5F9',
      rowHoverBg: '#F8FAFC',
      rowSelectedBg: 'rgba(59, 130, 246, 0.06)',
      rowSelectedHoverBg: 'rgba(59, 130, 246, 0.10)',
      borderColor: 'rgba(15, 23, 42, 0.06)',
      headerBorderRadius: 10,
      cellPaddingBlock: 16,
      cellPaddingInline: 16,
      cellFontSize: 15,
      headerSplitColor: 'transparent',
      footerBg: '#F8FAFC',
    },

    // ─────────────────────────────────────────────
    // Button 按钮 - 渐变主按钮
    // ─────────────────────────────────────────────
    Button: {
      primaryShadow: '0 1px 2px rgba(15, 23, 42, 0.1)',
      defaultShadow: 'none',
      dangerShadow: 'none',
      defaultBg: '#FFFFFF',
      defaultBorderColor: 'rgba(15, 23, 42, 0.12)',
      defaultColor: '#0F172A',
      defaultHoverBg: '#F8FAFC',
      defaultHoverColor: '#0F172A',
      defaultHoverBorderColor: 'rgba(15, 23, 42, 0.20)',
      defaultActiveBg: '#F1F5F9',
      defaultActiveColor: '#0F172A',
      defaultActiveBorderColor: 'rgba(15, 23, 42, 0.20)',
      primaryColor: '#FFFFFF',
      borderRadius: 8,
      borderRadiusLG: 10,
      borderRadiusSM: 6,
      contentFontSize: 15,
      contentFontSizeLG: 17,
      contentFontSizeSM: 13,
      paddingInline: 16,
      paddingInlineLG: 24,
      paddingInlineSM: 12,
      controlHeight: 40,
      controlHeightLG: 48,
      controlHeightSM: 32,
    },

    // ─────────────────────────────────────────────
    // Input 输入框 - 凹陷背景
    // ─────────────────────────────────────────────
    Input: {
      colorBgContainer: '#FFFFFF',
      colorBorder: 'rgba(15, 23, 42, 0.12)',
      colorBgContainerDisabled: '#F1F5F9',
      activeBorderColor: '#3B82F6',
      hoverBorderColor: 'rgba(15, 23, 42, 0.24)',
      activeShadow: '0 0 0 3px rgba(59, 130, 246, 0.12)',
      errorActiveShadow: '0 0 0 3px rgba(239, 68, 68, 0.12)',
      warningActiveShadow: '0 0 0 3px rgba(245, 158, 11, 0.12)',
      borderRadius: 8,
      borderRadiusLG: 10,
      borderRadiusSM: 6,
      paddingBlock: 10,
      paddingBlockLG: 12,
      paddingBlockSM: 6,
      paddingInline: 14,
      paddingInlineLG: 16,
      paddingInlineSM: 10,
      inputFontSize: 15,
      inputFontSizeLG: 17,
      inputFontSizeSM: 13,
    },

    // ─────────────────────────────────────────────
    // Select 选择器
    // ─────────────────────────────────────────────
    Select: {
      colorBgContainer: '#FFFFFF',
      colorBgElevated: '#FFFFFF',
      colorBorder: 'rgba(15, 23, 42, 0.12)',
      optionSelectedBg: 'rgba(59, 130, 246, 0.08)',
      optionSelectedColor: '#2563EB',
      optionActiveBg: '#F1F5F9',
      selectorBg: '#FFFFFF',
      multipleItemBg: '#F1F5F9',
      multipleItemBorderColor: 'transparent',
      borderRadius: 8,
      optionPadding: '10px 14px',
    },

    // ─────────────────────────────────────────────
    // Modal 弹窗
    // ─────────────────────────────────────────────
    Modal: {
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
      footerBg: '#FFFFFF',
      titleColor: '#0F172A',
      titleFontSize: 17,
      borderRadiusLG: 16,
      paddingLG: 24,
      paddingMD: 20,
      paddingContentHorizontalLG: 24,
    },

    // ─────────────────────────────────────────────
    // Dropdown 下拉菜单
    // ─────────────────────────────────────────────
    Dropdown: {
      colorBgElevated: '#FFFFFF',
      borderRadiusLG: 10,
      paddingBlock: 6,
      controlItemBgHover: '#F1F5F9',
      controlItemBgActive: 'rgba(59, 130, 246, 0.08)',
      controlItemBgActiveHover: 'rgba(59, 130, 246, 0.12)',
    },

    // ─────────────────────────────────────────────
    // Pagination 分页
    // ─────────────────────────────────────────────
    Pagination: {
      itemBg: '#FFFFFF',
      itemActiveBg: '#3B82F6',
      itemActiveColorDisabled: 'rgba(0, 0, 0, 0.25)',
      itemInputBg: '#FFFFFF',
      itemLinkBg: '#FFFFFF',
      itemSize: 36,
      itemSizeSM: 28,
      borderRadius: 8,
    },

    // ─────────────────────────────────────────────
    // Tag 标签 - 鲜艳语义色
    // ─────────────────────────────────────────────
    Tag: {
      defaultBg: '#F1F5F9',
      defaultColor: '#334155',
      borderRadiusSM: 6,
    },

    // ─────────────────────────────────────────────
    // Badge 徽标
    // ─────────────────────────────────────────────
    Badge: {
      colorBgContainer: '#EF4444',
      colorBorderBg: '#FFFFFF',
      dotSize: 8,
      indicatorHeight: 20,
      indicatorHeightSM: 16,
      textFontSize: 12,
      textFontSizeSM: 10,
    },

    // ─────────────────────────────────────────────
    // Tabs 标签页
    // ─────────────────────────────────────────────
    Tabs: {
      cardBg: '#F8FAFC',
      cardGutter: 4,
      cardHeight: 44,
      cardPadding: '8px 16px',
      horizontalItemGutter: 24,
      horizontalItemPadding: '12px 0',
      horizontalItemPaddingLG: '16px 0',
      horizontalMargin: '0 0 16px 0',
      inkBarColor: '#3B82F6',
      itemActiveColor: '#3B82F6',
      itemColor: '#64748B',
      itemHoverColor: '#0F172A',
      itemSelectedColor: '#3B82F6',
      titleFontSize: 15,
      titleFontSizeLG: 17,
      titleFontSizeSM: 13,
    },

    // ─────────────────────────────────────────────
    // Form 表单
    // ─────────────────────────────────────────────
    Form: {
      labelColor: '#334155',
      labelFontSize: 15,
      labelHeight: 32,
      labelColonMarginInlineEnd: 8,
      labelColonMarginInlineStart: 2,
      itemMarginBottom: 24,
      verticalLabelPadding: '0 0 8px',
    },

    // ─────────────────────────────────────────────
    // Message 消息提示
    // ─────────────────────────────────────────────
    Message: {
      contentBg: '#FFFFFF',
      contentPadding: '12px 20px',
    },

    // ─────────────────────────────────────────────
    // Notification 通知
    // ─────────────────────────────────────────────
    Notification: {
      colorBg: '#FFFFFF',
      colorBgElevated: '#FFFFFF',
      width: 400,
      padding: 20,
    },

    // ─────────────────────────────────────────────
    // Tooltip 文字提示 - 深色反转
    // ─────────────────────────────────────────────
    Tooltip: {
      colorBgSpotlight: '#0F172A',
      colorTextLightSolid: '#FFFFFF',
      borderRadius: 6,
      fontSize: 13,
    },

    // ─────────────────────────────────────────────
    // Popover 气泡卡片
    // ─────────────────────────────────────────────
    Popover: {
      colorBgElevated: '#FFFFFF',
      borderRadiusLG: 10,
      boxShadowSecondary: '0 10px 40px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
    },

    // ─────────────────────────────────────────────
    // DatePicker 日期选择器
    // ─────────────────────────────────────────────
    DatePicker: {
      colorBgContainer: '#FFFFFF',
      colorBgElevated: '#FFFFFF',
      cellActiveWithRangeBg: 'rgba(59, 130, 246, 0.08)',
      cellHoverBg: '#F1F5F9',
      cellRangeBorderColor: '#3B82F6',
      borderRadius: 8,
    },

    // ─────────────────────────────────────────────
    // Drawer 抽屉
    // ─────────────────────────────────────────────
    Drawer: {
      colorBgElevated: '#FFFFFF',
      colorBgMask: 'rgba(15, 23, 42, 0.6)',
      footerPaddingBlock: 16,
      footerPaddingInline: 24,
    },

    // ─────────────────────────────────────────────
    // Spin 加载中
    // ─────────────────────────────────────────────
    Spin: {
      colorPrimary: '#3B82F6',
      dotSize: 24,
      dotSizeLG: 32,
      dotSizeSM: 16,
    },

    // ─────────────────────────────────────────────
    // Switch 开关 - 翠绿色
    // ─────────────────────────────────────────────
    Switch: {
      colorPrimary: '#10B981',
      colorPrimaryHover: '#059669',
      handleBg: '#FFFFFF',
      handleShadow: '0 2px 4px rgba(15, 23, 42, 0.12)',
      trackHeight: 28,
      trackMinWidth: 48,
      trackPadding: 3,
    },

    // ─────────────────────────────────────────────
    // Checkbox 复选框
    // ─────────────────────────────────────────────
    Checkbox: {
      colorPrimary: '#3B82F6',
      colorPrimaryHover: '#2563EB',
      borderRadiusSM: 4,
      controlInteractiveSize: 18,
    },

    // ─────────────────────────────────────────────
    // Radio 单选框
    // ─────────────────────────────────────────────
    Radio: {
      colorPrimary: '#3B82F6',
      colorPrimaryHover: '#2563EB',
      dotSize: 10,
      radioSize: 18,
    },

    // ─────────────────────────────────────────────
    // Progress 进度条
    // ─────────────────────────────────────────────
    Progress: {
      defaultColor: '#3B82F6',
      remainingColor: '#E2E8F0',
      circleTextColor: '#0F172A',
      lineBorderRadius: 100,
    },

    // ─────────────────────────────────────────────
    // Statistic 统计数值
    // ─────────────────────────────────────────────
    Statistic: {
      contentFontSize: 28,
      titleFontSize: 13,
    },

    // ─────────────────────────────────────────────
    // Avatar 头像
    // ─────────────────────────────────────────────
    Avatar: {
      colorTextPlaceholder: '#FFFFFF',
      containerSize: 36,
      containerSizeLG: 44,
      containerSizeSM: 28,
      textFontSize: 15,
      textFontSizeLG: 19,
      textFontSizeSM: 13,
      groupBorderColor: '#FFFFFF',
      groupOverlapping: -8,
    },

    // ─────────────────────────────────────────────
    // Breadcrumb 面包屑
    // ─────────────────────────────────────────────
    Breadcrumb: {
      iconFontSize: 14,
      itemColor: '#64748B',
      lastItemColor: '#0F172A',
      linkColor: '#64748B',
      linkHoverColor: '#3B82F6',
      separatorColor: '#94A3B8',
      separatorMargin: 8,
    },

    // ─────────────────────────────────────────────
    // Empty 空状态
    // ─────────────────────────────────────────────
    Empty: {
      colorText: '#64748B',
      colorTextDisabled: '#94A3B8',
    },

    // ─────────────────────────────────────────────
    // Alert 警告提示 - 鲜艳语义色
    // ─────────────────────────────────────────────
    Alert: {
      colorInfoBg: '#ECFEFF',
      colorInfoBorder: 'rgba(6, 182, 212, 0.3)',
      colorSuccessBg: '#ECFDF5',
      colorSuccessBorder: 'rgba(16, 185, 129, 0.3)',
      colorWarningBg: '#FFFBEB',
      colorWarningBorder: 'rgba(245, 158, 11, 0.3)',
      colorErrorBg: '#FEF2F2',
      colorErrorBorder: 'rgba(239, 68, 68, 0.3)',
      borderRadiusLG: 10,
    },

    // ─────────────────────────────────────────────
    // Divider 分割线
    // ─────────────────────────────────────────────
    Divider: {
      colorSplit: 'rgba(15, 23, 42, 0.06)',
      textPaddingInline: 16,
    },

    // ─────────────────────────────────────────────
    // Collapse 折叠面板
    // ─────────────────────────────────────────────
    Collapse: {
      colorBgContainer: '#FFFFFF',
      colorBorder: 'rgba(15, 23, 42, 0.06)',
      contentBg: '#F8FAFC',
      contentPadding: '16px 24px',
      headerBg: '#FFFFFF',
      headerPadding: '16px 24px',
      borderRadiusLG: 10,
    },

    // ─────────────────────────────────────────────
    // List 列表
    // ─────────────────────────────────────────────
    List: {
      colorBorder: 'rgba(15, 23, 42, 0.06)',
      colorSplit: 'rgba(15, 23, 42, 0.06)',
      colorText: '#0F172A',
      colorTextDescription: '#64748B',
      itemPadding: '16px 0',
      itemPaddingLG: '20px 0',
      itemPaddingSM: '12px 0',
      metaMarginBottom: 8,
      titleMarginBottom: 4,
    },

    // ─────────────────────────────────────────────
    // Steps 步骤条
    // ─────────────────────────────────────────────
    Steps: {
      colorPrimary: '#3B82F6',
      colorText: '#0F172A',
      colorTextDescription: '#64748B',
      colorTextDisabled: '#94A3B8',
      dotCurrentSize: 10,
      dotSize: 8,
      iconSize: 32,
      iconSizeSM: 24,
    },

    // ─────────────────────────────────────────────
    // Timeline 时间轴
    // ─────────────────────────────────────────────
    Timeline: {
      colorText: '#0F172A',
      dotBg: '#FFFFFF',
      dotBorderWidth: 2,
      itemPaddingBottom: 24,
      tailColor: 'rgba(15, 23, 42, 0.12)',
      tailWidth: 2,
    },

    // ─────────────────────────────────────────────
    // Tree 树形控件
    // ─────────────────────────────────────────────
    Tree: {
      colorBgContainer: 'transparent',
      directoryNodeSelectedBg: 'rgba(59, 130, 246, 0.08)',
      directoryNodeSelectedColor: '#2563EB',
      nodeHoverBg: '#F1F5F9',
      nodeSelectedBg: 'rgba(59, 130, 246, 0.08)',
      titleHeight: 36,
      borderRadius: 6,
    },

    // ─────────────────────────────────────────────
    // Upload 上传
    // ─────────────────────────────────────────────
    Upload: {
      colorBorder: 'rgba(15, 23, 42, 0.12)',
      colorBorderHover: '#3B82F6',
      colorFillAlter: '#F8FAFC',
      borderRadiusLG: 10,
    },

    // ─────────────────────────────────────────────
    // Segmented 分段控制器
    // ─────────────────────────────────────────────
    Segmented: {
      itemColor: '#64748B',
      itemHoverBg: 'transparent',
      itemHoverColor: '#0F172A',
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#0F172A',
      trackBg: '#F1F5F9',
      trackPadding: 4,
      borderRadiusLG: 8,
      borderRadiusSM: 6,
    },

    // ─────────────────────────────────────────────
    // Slider 滑动输入条
    // ─────────────────────────────────────────────
    Slider: {
      colorPrimaryBorder: '#3B82F6',
      colorPrimaryBorderHover: '#2563EB',
      handleColor: '#3B82F6',
      handleColorDisabled: '#94A3B8',
      handleSize: 18,
      handleSizeHover: 20,
      railBg: '#E2E8F0',
      railHoverBg: '#CBD5E1',
      trackBg: '#3B82F6',
      trackHoverBg: '#2563EB',
      dotActiveBorderColor: '#3B82F6',
      dotBorderColor: 'rgba(15, 23, 42, 0.12)',
      dotSize: 10,
    },
  },
};

function App() {
  const resolved = useThemeStore((s) => s.resolved);

  const currentTheme = {
    ...refinedLightTheme,
    algorithm: resolved === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
  };

  return (
    <ConfigProvider locale={zhCN} theme={currentTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

export default App;
