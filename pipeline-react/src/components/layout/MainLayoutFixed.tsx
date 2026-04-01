import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Avatar, Button, Dropdown, Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  ApiOutlined,
  BarChartOutlined,
  CalculatorOutlined,
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
  MoonOutlined,
  ProjectOutlined,
  RobotOutlined,
  SettingOutlined,
  SunOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useResponsive } from '../../hooks/useResponsive';
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
      { key: '/data/oil', icon: <ExperimentOutlined />, label: '油品物性' },
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

export default function MainLayoutFixed() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const isAIRoute = location.pathname.startsWith('/ai');
  const isAIChatRoute = location.pathname === '/ai/chat';
  const { userInfo, logout } = useUserStore();
  const { resolved, setMode } = useThemeStore();
  const { isMobile, isTablet, width } = useResponsive();

  useEffect(() => {
    if (isTablet) {
      setCollapsed(true);
    } else if (!isMobile) {
      setCollapsed(false);
    }
  }, [isMobile, isTablet, width]);

  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [location.pathname, mobileMenuOpen]);

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
    if (path.startsWith('/ai')) return ['ai'];
    return [];
  };

  const getSiderWidth = () => {
    if (isMobile) return 280;
    if (width < 768) return 200;
    if (width < 1024) return 220;
    return 260;
  };

  const siderCollapsed = isMobile ? false : isTablet ? true : collapsed;

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
      {isMobile ? (
        <div
          className={`${styles.overlay} ${mobileMenuOpen ? styles.visible : ''}`}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      ) : null}

      <Sider
        trigger={null}
        collapsible
        collapsed={siderCollapsed}
        className={`${styles.sider} ${mobileMenuOpen ? styles.mobileOpen : ''}`}
        width={getSiderWidth()}
        collapsedWidth={72}
      >
        <div className={styles.logo}>
          <span className={styles.logoIcon}>Q</span>
          {!siderCollapsed || isMobile ? <span className={styles.logoText}>管道能耗</span> : null}
        </div>

        <Menu
          mode="inline"
          selectedKeys={getSelectedKeys()}
          defaultOpenKeys={collapsed ? [] : getOpenKeys()}
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
              aria-label={resolved === 'dark' ? '切换为浅色模式' : '切换为深色模式'}
            />

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className={styles.userInfo} role="button" tabIndex={0}>
                <Avatar size="small" icon={<UserOutlined />} />
                <span className={styles.userName}>{userInfo?.nickname || '用户'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className={`${styles.content} container-responsive`}>
          {isAIRoute ? (
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
