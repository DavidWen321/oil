import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TraceEvent } from '../types/agent';

export interface UseSSEOptions {
  url: string;
  onEvent: (event: TraceEvent) => void;
  onError?: (error: Error) => void;
}

export interface SSEConnectOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Parse SSE text into events.
 * Handles both \n and \r\n line endings.
 */
function parseSSEChunk(text: string): { events: TraceEvent[]; remainder: string } {
  const events: TraceEvent[] = [];
  // Normalise \r\n → \n so the split logic is consistent
  const normalised = text.replace(/\r\n/g, '\n');
  const parts = normalised.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const lines = part.split('\n');
    let eventName = 'message';
    const dataParts: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataParts.push(line.slice(5).trim());
      }
      // SSE comments (lines starting with ':') are silently ignored
    }

    if (!dataParts.length) continue;

    const raw = dataParts.join('\n');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      payload = { raw };
    }

    events.push({ event: eventName, data: payload });
  }

  return { events, remainder };
}

export function useSSE({ url, onEvent, onError }: UseSSEOptions) {
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  // Keep callbacks in refs so the XHR handlers always see the latest version
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const disconnect = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setConnected(false);
    setStreaming(false);
  }, []);

  const connect = useCallback(
    (options?: SSEConnectOptions) => {
      disconnect();

      const method = options?.method ?? 'GET';
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      let lastIndex = 0;
      let buffer = '';

      xhr.open(method, url, true);

      // Set request headers
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      if (method === 'POST') {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }
      if (options?.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          xhr.setRequestHeader(key, value);
        }
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 2) {
          // Headers received
          if (xhr.status >= 200 && xhr.status < 300) {
            setConnected(true);
            setStreaming(true);
          } else {
            onErrorRef.current?.(new Error(`SSE request failed: ${xhr.status}`));
            disconnect();
          }
        }
      };

      xhr.onprogress = () => {
        // Get only the new data since the last progress event
        const newData = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;

        if (!newData) return;

        buffer += newData;
        const { events, remainder } = parseSSEChunk(buffer);
        buffer = remainder;

        for (const event of events) {
          onEventRef.current(event);
        }
      };

      xhr.onload = () => {
        // Process any remaining data in the buffer
        if (buffer) {
          const { events } = parseSSEChunk(buffer + '\n\n');
          for (const event of events) {
            onEventRef.current(event);
          }
        }
        setStreaming(false);
        setConnected(false);
      };

      xhr.onerror = () => {
        onErrorRef.current?.(new Error('SSE connection error'));
        setConnected(false);
        setStreaming(false);
      };

      xhr.onabort = () => {
        setConnected(false);
        setStreaming(false);
      };

      // Send request
      const body =
        method === 'POST' && options?.body !== undefined
          ? JSON.stringify(options.body)
          : undefined;
      xhr.send(body ?? null);
    },
    [disconnect, url],
  );

  useEffect(() => () => disconnect(), [disconnect]);

  return useMemo(
    () => ({
      connected,
      streaming,
      connect,
      disconnect,
    }),
    [connected, streaming, connect, disconnect],
  );
}

export default useSSE;
