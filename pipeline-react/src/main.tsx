import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initPerformanceMonitoring, reportToBackend } from './utils/performance';

// 初始化性能监控
initPerformanceMonitoring(reportToBackend);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
