import { create } from 'zustand';
import type { MonitorData, AlarmInfo } from '../types';

interface MonitorState {
  // 监控数据
  data: MonitorData | null;
  // 活动告警
  alarms: AlarmInfo[];
  // 连接状态
  connected: boolean;

  // 设置监控数据
  setData: (data: MonitorData) => void;
  // 添加告警
  addAlarm: (alarm: AlarmInfo) => void;
  // 清除告警
  clearAlarms: () => void;
  // 设置连接状态
  setConnected: (connected: boolean) => void;
}

export const useMonitorStore = create<MonitorState>((set) => ({
  data: null,
  alarms: [],
  connected: true, // 演示模式默认已连接

  setData: (data) => set({ data }),

  addAlarm: (alarm) =>
    set((state) => ({
      alarms: [alarm, ...state.alarms].slice(0, 50), // 最多保留50条
    })),

  clearAlarms: () => set({ alarms: [] }),

  setConnected: (connected) => set({ connected }),
}));
