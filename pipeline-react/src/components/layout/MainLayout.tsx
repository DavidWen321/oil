/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MainLayout - Apple风格浅色主题响应式布局
 *  Design: Apple HIG + Linear + Stripe Light Theme
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Badge, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  CalculatorOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  ProjectOutlined,
  ApiOutlined,
  ControlOutlined,
  ExperimentOutlined,
  AlertOutlined,
  SwapOutlined,
  CloudOutlined,
  MonitorOutlined,
  MenuOutlined,
  CloseOutlined,
  RobotOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useUserStore } from '../../stores/userStore';
import { useMonitorStore } from '../../stores/monitorStore';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemeStore } from '../../stores/themeStore';
import MobileTabBar from './MobileTabBar';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

// ═══════════════════════════════════════════════════════════════════════════
// 菜单配置
// ═══════════════════════════════════════════════════════════════════════════
const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '首页大屏',
  },
  {
    key: 'data',
    icon: <DatabaseOutlined />,
    label: '数据管理',
    children: [
      { key: '/data/project', icon: <ProjectOutlined />, label: '项目管理' },
      { key: '/data/pipeline', icon: <ApiOutlined />, label: '管道参数' },
      { key: '/data/pump', icon: <ControlOutlined />, label: '泵站参数' },
      { key: '/data/oil', icon: <ExperimentOutlined />, label: '油品特性' },
    ],
  },
  {
    key: 'calculation',
    icon: <CalculatorOutlined />,
    label: '计算分析',
    children: [
      { key: '/calculation/hydraulic', icon: <ThunderboltOutlined />, label: '水力分析' },
      { key: '/calculation/optimization', icon: <SettingOutlined />, label: '泵站优化' },
      { key: '/calculation/sensitivity', icon: <BarChartOutlined />, label: '敏感性分析' },
    ],
  },
  {
    key: 'features',
    icon: <ThunderboltOutlined />,
    label: '特色功能',
    children: [
      { key: '/features/diagnosis', icon: <AlertOutlined />, label: '智能故障诊断' },
      { key: '/features/comparison', icon: <SwapOutlined />, label: '多方案对比' },
      { key: '/features/carbon', icon: <CloudOutlined />, label: '碳排放核算' },
      { key: '/features/monitor', icon: <MonitorOutlined />, label: '实时监控' },
    ],
  },
  {
    key: '/report',
    icon: <BarChartOutlined />,
    label: '统计报表',
  },
  {
    key: 'ai',
    icon: <RobotOutlined />,
    label: 'AI 智能体',
    children: [
      { key: '/ai/chat', icon: <DeploymentUnitOutlined />, label: '智能对话' },
      { key: '/ai/trace', icon: <FileSearchOutlined />, label: '执行追踪' },
      { key: '/ai/report', icon: <BarChartOutlined />, label: '报告预览' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MainLayout 组件
// ═══════════════════════════════════════════════════════════════════════════
export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo, logout } = useUserStore();
  const { resolved, setMode } = useThemeStore();
  const alarms = useMonitorStore((s) => s.alarms);
  const activeCount = alarms.filter((a: { acknowledged: boolean }) => !a.acknowledged).length;

  // 响应式状态
  const { isMobile, isTablet, width } = useResponsive();

  // 根据屏幕尺寸自动折叠侧边栏
  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (!isMobile) {
      setCollapsed(false);
    }
  }, [isMobile, isTablet, width]);

  // 路由变化时关闭移动端菜单
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 点击遮罩关闭菜单
  const handleOverlayClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // 阻止遮罩上的滚动
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // 菜单点击处理
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  // 获取当前选中的菜单项
  const getSelectedKeys = () => {
    const path = location.pathname;
    return [path];
  };

  // 获取默认展开的子菜单
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/data')) return ['data'];
    if (path.startsWith('/calculation')) return ['calculation'];
    if (path.startsWith('/features')) return ['features'];
    if (path.startsWith('/ai')) return ['ai'];
    return [];
  };

  // 切换移动端菜单
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  // 切换侧边栏折叠状态
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  // 计算侧边栏宽度
  const getSiderWidth = () => {
    if (isMobile) return 280;
    if (width < 768) return 200;
    if (width < 1024) return 220;
    return 260;
  };

  return (
    <Layout className={styles.layout}>
      {/* 移动端遮罩层 */}
      {isMobile && (
        <div
          className={`${styles.overlay} ${mobileMenuOpen ? styles.visible : ''}`}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={isMobile ? false : collapsed}
        className={`${styles.sider} ${mobileMenuOpen ? styles.mobileOpen : ''}`}
        width={getSiderWidth()}
        collapsedWidth={72}
      >
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>⚡</span>
          {(!collapsed || isMobile) && (
            <span className={styles.logoText}>管道能耗分析</span>
          )}
        </div>

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={collapsed ? [] : getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          inlineCollapsed={!isMobile && collapsed}
        />
      </Sider>

      {/* 右侧布局 */}
      <Layout>
        {/* 顶部导航栏 */}
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* 移动端菜单按钮 */}
            {isMobile ? (
              <Button
                type="text"
                icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
                onClick={toggleMobileMenu}
                className={styles.mobileMenuBtn}
                aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                className={styles.trigger}
                aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
              />
            )}
          </div>

          <div className={styles.headerRight}>
            <Button
              type="text"
              icon={resolved === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              className={styles.headerBtn}
              onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={resolved === 'dark' ? '切换亮色' : '切换暗色'}
            />

            {/* 通知按钮 */}
            <Badge count={activeCount} size="small" offset={[-2, 2]}>
              <Button
                type="text"
                icon={<BellOutlined />}
                className={styles.headerBtn}
                onClick={() => navigate('/features/monitor')}
                aria-label={`通知 ${activeCount > 0 ? `(${activeCount}条未读)` : ''}`}
              />
            </Badge>

            {/* 用户信息 */}
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className={styles.userInfo} role="button" tabIndex={0}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                />
                <span className={styles.userName}>
                  {userInfo?.nickname || '用户'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* 主内容区 */}
        <Content className={`${styles.content} container-responsive`}>
          <Outlet />
        </Content>

        {isMobile && <MobileTabBar />}
      </Layout>
    </Layout>
  );
}
