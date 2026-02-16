import { useEffect, useRef, useCallback } from 'react';
import { useMonitorStore } from '../stores/monitorStore';

// 简化版WebSocket钩子 - 当前使用模拟数据
export function useWebSocket(_pipelineId?: number) {
  const { setConnected } = useMonitorStore();
  const connectedRef = useRef(false);

  const connect = useCallback(() => {
    if (!connectedRef.current) {
      console.log('模拟WebSocket连接');
      setConnected(true);
      connectedRef.current = true;
    }
  }, [setConnected]);

  const disconnect = useCallback(() => {
    if (connectedRef.current) {
      console.log('模拟WebSocket断开');
      setConnected(false);
      connectedRef.current = false;
    }
  }, [setConnected]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    connected: useMonitorStore((s) => s.connected),
    connect,
    disconnect,
  };
}
