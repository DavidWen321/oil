/**
 * Main Layout Component
 * Design: Apple HIG + Linear + Stripe Light Theme
 */

import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Dropdown, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  AlertOutlined,
  ApiOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CalculatorOutlined,
  CloudOutlined,
  CloseOutlined,
  ControlOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
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
    label: '首页总览',
  },
  {
    key: 'data',
    icon: <DatabaseOutlined />,
    label: '数据管理',
    children: [
      { key: '/data/project', icon: <ProjectOutlined />, label: '项目管理' },
      { key: '/data/pipeline', icon: <ApiOutlined />, label: '管道参数' },
      { key: '/data/pump', icon: <ControlOutlined />, label: '泵站参数' },
      { key: '/data/oil', icon: <ExperimentOutlined />, label: '油品参数' },
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
      { key: '/features/diagnosis', icon: <AlertOutlined />, label: '故障诊断' },
      { key: '/features/comparison', icon: <SwapOutlined />, label: '方案对比' },
      { key: '/features/carbon', icon: <CloudOutlined />, label: '碳排核算' },
      { key: '/features/monitor', icon: <MonitorOutlined />, label: '实时监控' },
    ],
  },
  {
    key: '/report',
    icon: <BarChartOutlined />,
    label: '报告中心',
  },
  {
    key: 'ai',
    icon: <RobotOutlined />,
    label: '智能助手',
    children: [
      { key: '/ai/chat', icon: <DeploymentUnitOutlined />, label: '智能对话' },
      { key: '/ai/trace', icon: <BookOutlined />, label: '知识库录入' },
      { key: '/ai/report', icon: <BarChartOutlined />, label: '智能报告' },
    ],
  },
];

const GENERIC_USER_NAMES = new Set(['管理员', 'admin', 'Admin', 'ADMIN', '当前用户']);

const ROLE_LABEL_MAP: Record<string, string> = {
  admin: '系统管理员',
  operator: '运行人员',
  analyst: '分析人员',
  user: '平台用户',
};

function getRoleLabel(role?: string) {
  if (!role) {
    return '平台用户';
  }

  return ROLE_LABEL_MAP[role.toLowerCase()] || role;
}

function buildUserSummary(userInfo: {
  nickname?: string;
  username?: string;
  roles?: string[];
} | null) {
  const nickname = userInfo?.nickname?.trim();
  const username = userInfo?.username?.trim();
  const primaryRole = getRoleLabel(userInfo?.roles?.[0]);

  const displayName = nickname && !GENERIC_USER_NAMES.has(nickname) ? nickname : primaryRole;

  const secondaryText =
    username && username !== displayName
      ? `账号 ${username}`
      : primaryRole !== displayName
        ? primaryRole
        : '点击展开';

  return { displayName, secondaryText };
}

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
  const userSummary = buildUserSummary(userInfo);

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
      label: '个人资料',
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
        className={`${styles.sider} ${mobileMenuOpen ? styles.mobileOpen : ''} ${siderCollapsed && !isMobile ? styles.siderCollapsed : ''}`}
        width={getSiderWidth()}
        collapsedWidth={84}
      >
        <div className={`${styles.logo} ${siderCollapsed && !isMobile ? styles.logoCollapsed : ''}`}>
          {!siderCollapsed || isMobile ? (
            <div className={styles.logoBrand}>
              <span className={styles.logoIcon}>P</span>
              <span className={styles.logoText}>管道能耗分析</span>
            </div>
          ) : null}

          {!isMobile ? (
            <Button
              type="text"
              icon={siderCollapsed ? <MenuOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
              className={styles.logoTrigger}
              aria-label={siderCollapsed ? '展开侧边栏' : '收起侧边栏'}
              title={siderCollapsed ? '展开侧边栏' : '收起侧边栏'}
            />
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
            ) : null}
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
                aria-label={activeCount > 0 ? `监控告警，当前 ${activeCount} 条活动告警` : '监控告警'}
                title={monitorConnected ? '告警通道已连接' : '告警通道未连接，当前使用接口刷新兜底'}
              />
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div
                className={styles.userInfo}
                role="button"
                tabIndex={0}
                title={
                  userSummary.secondaryText === '点击展开'
                    ? userSummary.displayName
                    : `${userSummary.displayName} · ${userSummary.secondaryText}`
                }
              >
                <Avatar size={34} icon={<UserOutlined />} />
                <span className={styles.userName}>{userSummary.displayName}</span>
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
