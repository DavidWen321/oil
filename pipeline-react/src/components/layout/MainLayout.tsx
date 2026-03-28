import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Dropdown, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  AlertOutlined,
  ApiOutlined,
  BarChartOutlined,
  BellOutlined,
  CalculatorOutlined,
  CloudOutlined,
  CloudUploadOutlined,
  CloseOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  MonitorOutlined,
  MoonOutlined,
  ProjectOutlined,
  RobotOutlined,
  SettingOutlined,
  SunOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useResponsive } from '../../hooks/useResponsive';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMonitorStore } from '../../stores/monitorStore';
import { useThemeStore } from '../../stores/themeStore';
import { useUserStore } from '../../stores/userStore';
import MobileTabBar from './MobileTabBar';
import styles from './MainLayout.module.css';

const { Header, Sider, Content } = Layout;

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
      { key: '/ai/knowledge', icon: <CloudUploadOutlined />, label: '知识库录入' },
      { key: '/ai/report', icon: <BarChartOutlined />, label: '智能报告' },
    ],
  },
];

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isFeatureRoute = location.pathname.startsWith('/features');
  const isAIRoute = location.pathname.startsWith('/ai');
  const isAIChatRoute = location.pathname === '/ai/chat';
  const { userInfo, logout } = useUserStore();
  const { resolved, setMode } = useThemeStore();
  const alarms = useMonitorStore((state) => state.alarms);
  const monitorConnected = useMonitorStore((state) => state.connected);
  const activeCount = alarms.filter((alarm) => alarm.status === 'ACTIVE').length;
  const { isMobile, isTablet, width } = useResponsive();

  useWebSocket({ scope: 'all', subscribeMonitor: false, subscribeAlarms: true });

  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (!isMobile) {
      setCollapsed(false);
    }
  }, [isMobile, isTablet, width]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleOverlayClick = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'settings') {
      navigate('/settings');
      return;
    }

    if (key === 'logout') {
      logout();
      navigate('/login');
    }
  };

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const getSelectedKeys = () => [location.pathname];

  const getOpenKeys = () => {
    const path = location.pathname;
    if (path.startsWith('/data')) return ['data'];
    if (path.startsWith('/calculation')) return ['calculation'];
    if (path.startsWith('/features')) return ['features'];
    if (path.startsWith('/ai')) return ['ai'];
    return [];
  };

  const getSiderWidth = () => {
    if (isMobile) return 280;
    if (width < 768) return 200;
    if (width < 1024) return 220;
    return 260;
  };

  const siderCollapsed = isMobile ? false : collapsed;

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

  return (
    <Layout className={styles.layout}>
      {isMobile && (
        <div
          className={`${styles.overlay} ${mobileMenuOpen ? styles.visible : ''}`}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <Sider
        trigger={null}
        collapsible
        collapsed={siderCollapsed}
        className={`${styles.sider} ${mobileMenuOpen ? styles.mobileOpen : ''}`}
        width={getSiderWidth()}
        collapsedWidth={72}
      >
        <div className={styles.logo}>
          <span className={styles.logoIcon}>P</span>
          {!siderCollapsed || isMobile ? (
            <span className={styles.logoText}>管道能耗分析</span>
          ) : null}
        </div>

        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={siderCollapsed ? [] : getOpenKeys()}
          items={menuItems}
          onClick={handleMenuClick}
          inlineCollapsed={!isMobile && siderCollapsed}
        />
      </Sider>

      <Layout>
        <Header className={styles.header}>
          <div className={styles.headerLeft}>
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
                icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleCollapsed}
                className={styles.trigger}
                aria-label={siderCollapsed ? '展开侧边栏' : '收起侧边栏'}
              />
            )}
          </div>

          <div className={styles.headerRight}>
            <Button
              type="text"
              icon={resolved === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              className={styles.headerBtn}
              onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
              aria-label={resolved === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
            />

            <Badge
              count={activeCount}
              size="small"
              offset={[-2, 2]}
              color={monitorConnected ? undefined : '#faad14'}
            >
              <Button
                type="text"
                icon={<BellOutlined />}
                className={styles.headerBtn}
                onClick={() => navigate('/features/monitor')}
                aria-label={activeCount > 0 ? `当前有 ${activeCount} 条活动告警` : '告警中心'}
                title={monitorConnected ? '告警通道已连接' : '告警通道未连接，当前使用接口刷新兜底'}
              />
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className={styles.userInfo} role="button" tabIndex={0}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span className={styles.userName}>{userInfo?.nickname || '当前用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className={`${styles.content} container-responsive`}>
          {isFeatureRoute ? (
            <div className={styles.featureViewport}>
              <div className={styles.featureStage}>
                <Outlet />
              </div>
            </div>
          ) : isAIRoute ? (
            <div className={`${styles.aiViewport} ${isAIChatRoute ? styles.aiChatViewport : ''}`}>
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </Content>

        {isMobile ? <MobileTabBar /> : null}
      </Layout>
    </Layout>
  );
}
