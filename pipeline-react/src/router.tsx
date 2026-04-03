import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { useUserStore } from './stores/userStore';

const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const Login = lazy(() => import('./pages/auth/Login'));
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const SystemSettings = lazy(() => import('./pages/system/SystemSettings'));

const ProjectList = lazy(() => import('./pages/data/ProjectList'));
const PipelineList = lazy(() => import('./pages/data/PipelineList'));
const PumpStationList = lazy(() => import('./pages/data/PumpStationList'));
const OilPropertyList = lazy(() => import('./pages/data/OilPropertyList'));
const KnowledgeBase = lazy(() => import('./pages/data/KnowledgeBase'));

const HydraulicAnalysis = lazy(() => import('./pages/calculation/HydraulicAnalysis'));
const Optimization = lazy(() => import('./pages/calculation/Optimization'));
const SensitivityAnalysis = lazy(() => import('./pages/calculation/SensitivityAnalysis'));

const AIChat = lazy(() => import('./pages/ai/AIChat'));
const ReportPreview = lazy(() => import('./pages/ai/ReportPreview'));

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Spin size="large" />
  </div>
);

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
        <Suspense fallback={<Loading />}>
          <MainLayout />
        </Suspense>
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
      {
        path: 'settings',
        element: (
          <Suspense fallback={<Loading />}>
            <SystemSettings />
          </Suspense>
        ),
      },
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
      {
        path: 'ai/chat',
        element: (
          <Suspense fallback={<Loading />}>
            <AIChat />
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
      {
        path: 'ai/trace',
        element: (
          <Suspense fallback={<Loading />}>
            <KnowledgeBase />
          </Suspense>
        ),
      },
    ],
  },
]);
