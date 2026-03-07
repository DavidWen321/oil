/**
 * Main Layout Component
 * Design: Apple HIG + Linear + Stripe Light Theme
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
import { useWebSocket } from '../../hooks/useWebSocket';
import { useThemeStore } from '../../stores/themeStore';
import MobileTabBar from './MobileTabBar';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

// Menu Items Configuration
const menuItems: MenuProps['items'] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: 'data',
    icon: <DatabaseOutlined />,
    label: 'Data Management',
    children: [
      { key: '/data/project', icon: <ProjectOutlined />, label: 'Projects' },
      { key: '/data/pipeline', icon: <ApiOutlined />, label: 'Pipelines' },
      { key: '/data/pump', icon: <ControlOutlined />, label: 'Pump Stations' },
      { key: '/data/oil', icon: <ExperimentOutlined />, label: 'Oil Properties' },
    ],
  },
  {
    key: 'calculation',
    icon: <CalculatorOutlined />,
    label: 'Calculation',
    children: [
      { key: '/calculation/hydraulic', icon: <ThunderboltOutlined />, label: 'Hydraulic Analysis' },
      { key: '/calculation/optimization', icon: <SettingOutlined />, label: 'Pump Optimization' },
      { key: '/calculation/sensitivity', icon: <BarChartOutlined />, label: 'Sensitivity Analysis' },
    ],
  },
  {
    key: 'features',
    icon: <ThunderboltOutlined />,
    label: 'Features',
    children: [
      { key: '/features/diagnosis', icon: <AlertOutlined />, label: 'Fault Diagnosis' },
      { key: '/features/comparison', icon: <SwapOutlined />, label: 'Scheme Comparison' },
      { key: '/features/carbon', icon: <CloudOutlined />, label: 'Carbon Emissions' },
      { key: '/features/monitor', icon: <MonitorOutlined />, label: 'Real-time Monitor' },
    ],
  },
  {
    key: '/report',
    icon: <BarChartOutlined />,
    label: 'Reports',
  },
  {
    key: 'ai',
    icon: <RobotOutlined />,
    label: 'AI Assistant',
    children: [
      { key: '/ai/chat', icon: <DeploymentUnitOutlined />, label: 'AI Chat' },
      { key: '/ai/trace', icon: <FileSearchOutlined />, label: 'Trace Analysis' },
      { key: '/ai/report', icon: <BarChartOutlined />, label: 'AI Reports' },
    ],
  },
];

// MainLayout Component
export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userInfo, logout } = useUserStore();
  const { resolved, setMode } = useThemeStore();
  const alarms = useMonitorStore((s) => s.alarms);
  const monitorConnected = useMonitorStore((s) => s.connected);
  useWebSocket({ scope: 'all', subscribeMonitor: false, subscribeAlarms: true });
  const activeCount = alarms.filter((alarm) => alarm.status === 'ACTIVE').length;

  // Responsive detection
  const { isMobile, isTablet, width } = useResponsive();

  // Auto collapse sidebar on tablet/mobile
  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (!isMobile) {
      setCollapsed(false);
    }
  }, [isMobile, isTablet, width]);

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Handle overlay click
  const handleOverlayClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // Prevent body scroll when mobile menu is open
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

  // Handle menu click
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  // User menu items
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
    },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  // Get selected menu keys
  const getSelectedKeys = () => {
    const path = location.pathname;
    return [path];
  };

  // Get open menu keys
  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/data')) return ['data'];
    if (path.startsWith('/calculation')) return ['calculation'];
    if (path.startsWith('/features')) return ['features'];
    if (path.startsWith('/ai')) return ['ai'];
    return [];
  };

  // Toggle mobile menu
  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  // Toggle sidebar collapse
  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  // Get sidebar width
  const getSiderWidth = () => {
    if (isMobile) return 280;
    if (width < 768) return 200;
    if (width < 1024) return 220;
    return 260;
  };

  return (
    <Layout className={styles.layout}>
      {/* Mobile overlay */}
      {isMobile && (
        <div
          className={`${styles.overlay} ${mobileMenuOpen ? styles.visible : ''}`}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
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
            <span className={styles.logoText}>Pipeline Energy</span>
          )}
        </div>

        {/* Menu */}
        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={collapsed ? [] : getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          inlineCollapsed={!isMobile && collapsed}
        />
      </Sider>

      {/* Main content area */}
      <Layout>
        {/* Header */}
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Mobile menu toggle */}
            {isMobile ? (
              <Button
                type="text"
                icon={mobileMenuOpen ? <CloseOutlined /> : <MenuOutlined />}
                onClick={toggleMobileMenu}
                className={styles.mobileMenuBtn}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                className={styles.trigger}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              />
            )}
          </div>

          <div className={styles.headerRight}>
            <Button
              type="text"
              icon={resolved === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              className={styles.headerBtn}
              onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            />

            {/* Alarm notifications */}
            <Badge count={activeCount} size="small" offset={[-2, 2]} color={monitorConnected ? undefined : '#faad14'}>
              <Button
                type="text"
                icon={<BellOutlined />}
                className={styles.headerBtn}
                onClick={() => navigate('/features/monitor')}
                aria-label={`Monitor alerts ${activeCount > 0 ? `(${activeCount} active)` : ''}`}
                title={monitorConnected ? 'Alarm channel connected' : 'Alarm channel disconnected, using HTTP refresh fallback'}
              />
            </Badge>

            {/* User dropdown */}
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
                  {userInfo?.nickname || 'User'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Content */}
        <Content className={`${styles.content} container-responsive`}>
          <Outlet />
        </Content>

        {isMobile && <MobileTabBar />}
      </Layout>
    </Layout>
  );
}
