import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import MainLayout from './components/layout/MainLayout';
import { useUserStore } from './stores/userStore';

// 懒加载页面组件
const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));

// 数据管理
const ProjectList = lazy(() => import('./pages/data/ProjectList'));
const PipelineList = lazy(() => import('./pages/data/PipelineList'));
const PumpStationList = lazy(() => import('./pages/data/PumpStationList'));
const OilPropertyList = lazy(() => import('./pages/data/OilPropertyList'));

// 计算分析
const HydraulicAnalysis = lazy(() => import('./pages/calculation/HydraulicAnalysis'));
const Optimization = lazy(() => import('./pages/calculation/Optimization'));
const SensitivityAnalysis = lazy(() => import('./pages/calculation/SensitivityAnalysis'));

// 特色功能
const FaultDiagnosis = lazy(() => import('./pages/features/FaultDiagnosis'));
const SchemeComparison = lazy(() => import('./pages/features/SchemeComparison'));
const CarbonCalculation = lazy(() => import('./pages/features/CarbonCalculation'));
const RealtimeMonitor = lazy(() => import('./pages/features/RealtimeMonitor'));

// 报表
const Report = lazy(() => import('./pages/report/Report'));
const AIChat = lazy(() => import('./pages/ai/AIChat'));
const AgentTrace = lazy(() => import('./pages/ai/AgentTrace'));
const ReportPreview = lazy(() => import('./pages/ai/ReportPreview'));

// 加载组件
const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

// 路由守卫
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<Loading />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<Loading />}>
            <Dashboard />
          </Suspense>
        ),
      },
      // 数据管理
      {
        path: 'data/project',
        element: (
          <Suspense fallback={<Loading />}>
            <ProjectList />
          </Suspense>
        ),
      },
      {
        path: 'data/pipeline',
        element: (
          <Suspense fallback={<Loading />}>
            <PipelineList />
          </Suspense>
        ),
      },
      {
        path: 'data/pump',
        element: (
          <Suspense fallback={<Loading />}>
            <PumpStationList />
          </Suspense>
        ),
      },
      {
        path: 'data/oil',
        element: (
          <Suspense fallback={<Loading />}>
            <OilPropertyList />
          </Suspense>
        ),
      },
      // 计算分析
      {
        path: 'calculation/hydraulic',
        element: (
          <Suspense fallback={<Loading />}>
            <HydraulicAnalysis />
          </Suspense>
        ),
      },
      {
        path: 'calculation/optimization',
        element: (
          <Suspense fallback={<Loading />}>
            <Optimization />
          </Suspense>
        ),
      },
      {
        path: 'calculation/sensitivity',
        element: (
          <Suspense fallback={<Loading />}>
            <SensitivityAnalysis />
          </Suspense>
        ),
      },
      // 特色功能
      {
        path: 'features/diagnosis',
        element: (
          <Suspense fallback={<Loading />}>
            <FaultDiagnosis />
          </Suspense>
        ),
      },
      {
        path: 'features/comparison',
        element: (
          <Suspense fallback={<Loading />}>
            <SchemeComparison />
          </Suspense>
        ),
      },
      {
        path: 'features/carbon',
        element: (
          <Suspense fallback={<Loading />}>
            <CarbonCalculation />
          </Suspense>
        ),
      },
      {
        path: 'features/monitor',
        element: (
          <Suspense fallback={<Loading />}>
            <RealtimeMonitor />
          </Suspense>
        ),
      },
      // 报表
      {
        path: 'report',
        element: (
          <Suspense fallback={<Loading />}>
            <Report />
          </Suspense>
        ),
      },
      // AI 智能体
      {
        path: 'ai/chat',
        element: (
          <Suspense fallback={<Loading />}>
            <AIChat />
          </Suspense>
        ),
      },
      {
        path: 'ai/trace',
        element: (
          <Suspense fallback={<Loading />}>
            <AgentTrace />
          </Suspense>
        ),
      },
      {
        path: 'ai/report',
        element: (
          <Suspense fallback={<Loading />}>
            <ReportPreview />
          </Suspense>
        ),
      },
    ],
  },
]);
