import { create } from 'zustand';
import type { AlarmMessage, MonitorDataPoint } from '../types';

interface MonitorState {
  data: MonitorDataPoint | null;
  alarms: AlarmMessage[];
  connected: boolean;
  connectedSources: Record<string, boolean>;
  setData: (data: MonitorDataPoint | null) => void;
  setAlarms: (alarms: AlarmMessage[]) => void;
  upsertAlarm: (alarm: AlarmMessage) => void;
  clearAlarms: (pipelineId?: number) => void;
  setConnectionState: (sourceId: string, connected: boolean) => void;
}

function sortAlarms(alarms: AlarmMessage[]) {
  return [...alarms].sort(
    (left, right) => new Date(right.alarmTime).getTime() - new Date(left.alarmTime).getTime(),
  );
}

export const useMonitorStore = create<MonitorState>((set) => ({
  data: null,
  alarms: [],
  connected: false,
  connectedSources: {},

  setData: (data) => set({ data }),

  setAlarms: (alarms) => set({ alarms: sortAlarms(alarms).slice(0, 100) }),

  upsertAlarm: (alarm) =>
    set((state) => {
      const next = state.alarms.filter((item) => item.alarmId !== alarm.alarmId);
      if (alarm.status !== 'RESOLVED') {
        next.unshift(alarm);
      }
      return { alarms: sortAlarms(next).slice(0, 100) };
    }),

  clearAlarms: (pipelineId) =>
    set((state) => ({
      alarms: pipelineId == null ? [] : state.alarms.filter((item) => item.pipelineId !== pipelineId),
    })),

  setConnectionState: (sourceId, connected) =>
    set((state) => {
      const nextSources = { ...state.connectedSources };
      if (connected) {
        nextSources[sourceId] = true;
      } else {
        delete nextSources[sourceId];
      }
      return {
        connectedSources: nextSources,
        connected: Object.keys(nextSources).length > 0,
      };
    }),
}));
