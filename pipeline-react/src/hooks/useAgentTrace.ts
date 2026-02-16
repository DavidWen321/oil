import { useCallback, useMemo, useState } from 'react';
import { agentApi } from '../api/agent';
import { useSSE } from './useSSE';
import type {
  AgentTraceState,
  HITLRequest,
  HITLResponse,
  PlanStep,
  TraceEvent,
  TraceLog,
  TraceMetrics,
} from '../types/agent';

const EMPTY_METRICS: TraceMetrics = {
  total_duration_ms: 0,
  llm_calls: 0,
  tool_calls: 0,
  total_tokens: 0,
  steps_completed: 0,
  steps_failed: 0,
  retries: 0,
};

function initialState(sessionId: string): AgentTraceState {
  return {
    traceId: null,
    plan: [],
    currentStep: 0,
    logs: [],
    metrics: { ...EMPTY_METRICS },
    hitlRequest: null,
    status: 'idle',
    finalResponse: '',
    sessionId,
  };
}

function appendLog(logs: TraceLog[], item: TraceLog): TraceLog[] {
  const next = [...logs, item];
  return next.length > 200 ? next.slice(next.length - 200) : next;
}

export function useAgentTrace(sessionId: string) {
  const [state, setState] = useState<AgentTraceState>(() => initialState(sessionId));

  const onEvent = useCallback((event: TraceEvent) => {
    setState((prev) => {
      const timestamp = String(event.data.timestamp ?? new Date().toISOString());
      const stepNumber = typeof event.data.step_number === 'number' ? event.data.step_number : undefined;
      const agent = typeof event.data.agent === 'string' ? event.data.agent : undefined;

      switch (event.event) {
        case 'trace_init': {
          const traceId = String(event.data.trace_id ?? '');
          const newSessionId = String(event.data.session_id ?? prev.sessionId);
          return {
            ...prev,
            traceId,
            sessionId: newSessionId,
            status: 'planning',
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `trace started: ${traceId}`,
            }),
          };
        }
        case 'plan_created':
        case 'plan_updated': {
          const plan = Array.isArray(event.data.plan) ? (event.data.plan as PlanStep[]) : prev.plan;
          return {
            ...prev,
            plan,
            status: 'executing',
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `${event.event} (${plan.length} steps)`,
            }),
          };
        }
        case 'step_started': {
          const nextPlan: PlanStep[] = prev.plan.map((step): PlanStep =>
            step.step_number === stepNumber ? { ...step, status: 'in_progress' } : step
          );
          return {
            ...prev,
            plan: nextPlan,
            currentStep: stepNumber ?? prev.currentStep,
            status: 'executing',
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `Step ${stepNumber}: ${String(event.data.description ?? '')}`,
              stepNumber,
              agent,
            }),
          };
        }
        case 'step_completed': {
          const duration =
            typeof event.data.duration_ms === 'number' ? event.data.duration_ms : undefined;
          const nextPlan: PlanStep[] = prev.plan.map((step): PlanStep =>
            step.step_number === stepNumber
              ? { ...step, status: 'completed', duration_ms: duration ?? step.duration_ms }
              : step
          );

          return {
            ...prev,
            plan: nextPlan,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `Step ${stepNumber} completed`,
              stepNumber,
              agent,
            }),
          };
        }
        case 'step_failed': {
          const nextPlan: PlanStep[] = prev.plan.map((step): PlanStep =>
            step.step_number === stepNumber
              ? { ...step, status: 'failed', error: String(event.data.error ?? 'failed') }
              : step
          );

          return {
            ...prev,
            plan: nextPlan,
            status: 'error',
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `Step ${stepNumber} failed: ${String(event.data.error ?? '')}`,
              stepNumber,
              agent,
            }),
          };
        }
        case 'hitl_waiting': {
          return {
            ...prev,
            status: 'waiting_hitl',
            hitlRequest: event.data as unknown as HITLRequest,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: 'waiting for human confirmation',
            }),
          };
        }
        case 'hitl_resumed': {
          return {
            ...prev,
            status: 'executing',
            hitlRequest: null,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `HITL resumed: ${String(event.data.selected_option ?? '')}`,
            }),
          };
        }
        case 'response_chunk': {
          const chunk = String(event.data.chunk ?? '');
          return {
            ...prev,
            finalResponse: prev.finalResponse + chunk,
          };
        }
        case 'completed': {
          const metrics =
            event.data.metrics && typeof event.data.metrics === 'object'
              ? (event.data.metrics as TraceMetrics)
              : prev.metrics;
          return {
            ...prev,
            status: 'completed',
            metrics,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: 'workflow completed',
            }),
          };
        }
        case 'final_response': {
          const response = String(
            (event.data.response as string) ||
              (event.data.final_response as string) ||
              (event.data.raw as string) ||
              ''
          );
          return {
            ...prev,
            finalResponse: response,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: 'final response arrived',
            }),
          };
        }
        case 'error': {
          return {
            ...prev,
            status: 'error',
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: `error: ${String(event.data.error ?? event.data.raw ?? '')}`,
            }),
          };
        }
        default:
          return {
            ...prev,
            logs: appendLog(prev.logs, {
              timestamp,
              type: event.event,
              text: JSON.stringify(event.data),
              stepNumber,
              agent,
            }),
          };
      }
    });
  }, []);

  const onError = useCallback((error: Error) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      logs: appendLog(prev.logs, {
        timestamp: new Date().toISOString(),
        type: 'error',
        text: error.message,
      }),
    }));
  }, []);

  const sse = useSSE({
    url: `${agentApi.baseUrl}/chat/stream`,
    onEvent,
    onError,
  });

  const startChat = useCallback(
    (message: string) => {
      setState(initialState(sessionId));
      sse.connect({
        method: 'POST',
        body: {
          message,
          session_id: sessionId,
        },
      });
    },
    [sessionId, sse.connect]
  );

  const submitHITL = useCallback(
    async (response: HITLResponse) => {
      await agentApi.confirm(state.sessionId, response);
    },
    [state.sessionId]
  );

  const dismissHITL = useCallback(() => {
    setState((prev) => ({ ...prev, hitlRequest: null }));
  }, []);

  const reset = useCallback(() => {
    sse.disconnect();
    setState(initialState(sessionId));
  }, [sessionId, sse.disconnect]);

  return useMemo(
    () => ({
      ...state,
      connected: sse.connected,
      streaming: sse.streaming,
      startChat,
      submitHITL,
      dismissHITL,
      reset,
    }),
    [reset, sse.connected, sse.streaming, startChat, state, submitHITL, dismissHITL]
  );
}

export default useAgentTrace;
