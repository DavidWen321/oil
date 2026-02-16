import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  DatabaseOutlined,
  CalculatorOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons';
import styles from './MobileTabBar.module.css';

const tabs = [
  { key: 'dashboard', label: '首页', icon: <DashboardOutlined />, path: '/dashboard', matchPrefix: '/dashboard' },
  { key: 'data', label: '数据', icon: <DatabaseOutlined />, path: '/data/project', matchPrefix: '/data' },
  { key: 'calculation', label: '计算', icon: <CalculatorOutlined />, path: '/calculation/hydraulic', matchPrefix: '/calculation' },
  { key: 'ai', label: 'AI', icon: <RobotOutlined />, path: '/ai/chat', matchPrefix: '/ai' },
  { key: 'more', label: '更多', icon: <UserOutlined />, path: '/features/monitor', matchPrefix: '/features' },
];

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabs.find((tab) => location.pathname.startsWith(tab.matchPrefix))?.key || 'dashboard';

  return (
    <nav className={styles.tabBar} aria-label="主导航">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tabItem} ${activeTab === tab.key ? styles.tabItemActive : ''}`}
          onClick={() => navigate(tab.path)}
          aria-label={tab.label}
        >
          <span className={styles.tabIcon}>{tab.icon}</span>
          <span className={styles.tabLabel}>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

