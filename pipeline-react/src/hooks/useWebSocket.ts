import { useEffect, useRef } from 'react';
import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { useMonitorStore } from '../stores/monitorStore';
import type { AlarmMessage, MonitorDataPoint } from '../types';

interface UseWebSocketOptions {
  pipelineId?: number | null;
  scope?: 'pipeline' | 'all';
  subscribeMonitor?: boolean;
  subscribeAlarms?: boolean;
  onMonitorData?: (data: MonitorDataPoint) => void;
  onAlarm?: (alarm: AlarmMessage) => void;
  onAlarmUpdate?: (alarm: AlarmMessage) => void;
}

const WS_URL = import.meta.env.VITE_WS_URL || '/calculation/ws/monitor';

function parseMessage<T>(message: IMessage): T | null {
  try {
    return JSON.parse(message.body) as T;
  } catch {
    return null;
  }
}

export function useWebSocket({
  pipelineId = null,
  scope = pipelineId ? 'pipeline' : 'all',
  subscribeMonitor = false,
  subscribeAlarms = true,
  onMonitorData,
  onAlarm,
  onAlarmUpdate,
}: UseWebSocketOptions = {}) {
  const connected = useMonitorStore((state) => state.connected);
  const setConnectionState = useMonitorStore((state) => state.setConnectionState);
  const setData = useMonitorStore((state) => state.setData);
  const upsertAlarm = useMonitorStore((state) => state.upsertAlarm);
  const sourceIdRef = useRef(`ws-${Math.random().toString(36).slice(2)}`);
  const monitorHandlerRef = useRef(onMonitorData);
  const alarmHandlerRef = useRef(onAlarm);
  const alarmUpdateHandlerRef = useRef(onAlarmUpdate);

  monitorHandlerRef.current = onMonitorData;
  alarmHandlerRef.current = onAlarm;
  alarmUpdateHandlerRef.current = onAlarmUpdate;

  useEffect(() => {
    if (!subscribeMonitor && !subscribeAlarms) {
      return undefined;
    }

    if (scope === 'pipeline' && pipelineId == null) {
      return undefined;
    }

    const sourceId = sourceIdRef.current;
    const subscriptions: StompSubscription[] = [];
    let disposed = false;
    let client: Client | null = null;

    const connect = async () => {
      try {
        const { default: SockJS } = await import('sockjs-client');

        if (disposed) {
          return;
        }

        client = new Client({
          reconnectDelay: 5000,
          heartbeatIncoming: 10000,
          heartbeatOutgoing: 10000,
          webSocketFactory: () => new SockJS(WS_URL),
          debug: () => undefined,
          onConnect: () => {
            if (!client) {
              return;
            }

            setConnectionState(sourceId, true);

            if (subscribeMonitor) {
              const monitorTopic = scope === 'all' ? '/topic/monitor/all' : `/topic/monitor/${pipelineId}`;
              subscriptions.push(
                client.subscribe(monitorTopic, (message) => {
                  const payload = parseMessage<MonitorDataPoint>(message);
                  if (!payload) {
                    return;
                  }

                  setData(payload);
                  monitorHandlerRef.current?.(payload);
                }),
              );
            }

            if (subscribeAlarms) {
              const alarmTopic = scope === 'all' ? '/topic/alarm/all' : `/topic/alarm/${pipelineId}`;
              subscriptions.push(
                client.subscribe(alarmTopic, (message) => {
                  const payload = parseMessage<AlarmMessage>(message);
                  if (!payload) {
                    return;
                  }

                  upsertAlarm(payload);
                  alarmHandlerRef.current?.(payload);
                }),
              );

              subscriptions.push(
                client.subscribe('/topic/alarm/update', (message) => {
                  const payload = parseMessage<AlarmMessage>(message);
                  if (!payload) {
                    return;
                  }

                  upsertAlarm(payload);
                  alarmUpdateHandlerRef.current?.(payload);
                }),
              );
            }
          },
          onStompError: () => {
            setConnectionState(sourceId, false);
          },
          onWebSocketClose: () => {
            setConnectionState(sourceId, false);
          },
          onWebSocketError: () => {
            setConnectionState(sourceId, false);
          },
        });

        client.activate();
      } catch {
        setConnectionState(sourceId, false);
      }
    };

    void connect();

    return () => {
      disposed = true;
      subscriptions.forEach((subscription) => subscription.unsubscribe());
      setConnectionState(sourceId, false);

      if (client) {
        void client.deactivate();
      }
    };
  }, [pipelineId, scope, setConnectionState, setData, subscribeAlarms, subscribeMonitor, upsertAlarm]);

  return { connected };
}

export default useWebSocket;
