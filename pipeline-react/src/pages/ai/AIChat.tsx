import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import { HITLDialog } from '../../components/agent';
import { useAgentTrace } from '../../hooks/useAgentTrace';
import { useScrollToBottom } from '../../hooks/useScrollToBottom';
import {
  ChatTopbar,
  ComposerDock,
  ContextRail,
  ConversationSidebar,
  EmptyStateWelcome,
  ChatMessageItem,
} from '../../features/ai-chat/components';
import { useChatConversations } from '../../features/ai-chat/hooks/useChatConversations';
import type { PendingStreamTarget, UIMessage } from '../../features/ai-chat/types';
import { getFriendlyError, getStreamLabel, WELCOME_PROMPTS } from '../../features/ai-chat/utils/chatUi';

const BUSY_STATES = new Set(['planning', 'executing', 'waiting_hitl']);

export default function AIChat() {
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(true);
  const [pendingTarget, setPendingTarget] = useState<PendingStreamTarget | null>(null);
  const {
    conversations,
    activeConversation,
    activeConversationId,
    setActiveConversationId,
    createNewConversation,
    removeConversation,
    setConversationMode,
    appendExchange,
    updateAssistantMessage,
  } = useChatConversations();

  const {
    activeTools,
    connected,
    currentStep,
    dismissHITL,
    errorMessage,
    finalResponse,
    hitlRequest,
    logs,
    metrics,
    plan,
    reset,
    startChat,
    status,
    stop,
    streaming,
    submitHITL,
  } = useAgentTrace(activeConversationId ?? 'chat-default');

  const busy = BUSY_STATES.has(status);
  const messages = activeConversation?.messages ?? [];
  const streamLabel = useMemo(() => getStreamLabel(status, activeTools), [activeTools, status]);

  const { ref: messagesRef, isAtBottom, scrollToBottom } = useScrollToBottom<HTMLDivElement>(
    [activeConversationId, messages.length, finalResponse, status],
    { enabled: true, behavior: 'smooth', threshold: 120 },
  );

  useEffect(() => {
    reset();
  }, [activeConversationId, reset]);

  useEffect(() => {
    if (!pendingTarget) return;
    if (!activeConversationId || pendingTarget.conversationId !== activeConversationId) return;

    const nextStatus = status === 'error'
      ? 'error'
      : status === 'stopped'
        ? 'stopped'
        : streaming || busy
          ? 'streaming'
          : 'completed';

    updateAssistantMessage(pendingTarget.conversationId, pendingTarget.assistantMessageId, {
      content: finalResponse,
      status: nextStatus,
      toolCalls: activeTools,
      requestText: pendingTarget.requestText,
      error: status === 'error' ? getFriendlyError(errorMessage ?? logs[logs.length - 1]?.text) : null,
    });

  }, [
    activeConversationId,
    activeTools,
    busy,
    errorMessage,
    finalResponse,
    logs,
    pendingTarget,
    status,
    streaming,
    updateAssistantMessage,
  ]);

  const activeMode = activeConversation?.mode ?? 'standard';

  const sendMessage = (text: string) => {
    const content = text.trim();
    if (!content || busy) return;

    const targetConversationId = activeConversationId ?? createNewConversation(activeMode);
    const assistantMessageId = appendExchange(targetConversationId, content);
    setPendingTarget({
      conversationId: targetConversationId,
      assistantMessageId,
      requestText: content,
    });
    setDraft('');
    startChat(content);
  };

  const handleRetry = (message: UIMessage) => {
    if (!message.requestText || busy) return;
    sendMessage(message.requestText);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) {
      setSidebarOpen(false);
      return;
    }
    if (busy || streaming) {
      stop();
    }
    setActiveConversationId(conversationId);
    setSidebarOpen(false);
  };

  const handleCreateConversation = () => {
    if (busy || streaming) {
      stop();
    }
    createNewConversation(activeMode);
    setDraft('');
    setSidebarOpen(false);
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (conversationId === activeConversationId && (busy || streaming)) {
      stop();
    }
    removeConversation(conversationId);
  };

  return (
    <AnimatedPage className="h-[calc(100vh-var(--header-height))] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(226,232,240,0.62),transparent_30%),linear-gradient(180deg,#fafafa_0%,#f5f7fb_100%)] text-neutral-900">
      <div className="flex h-full w-full overflow-hidden">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onCreate={handleCreateConversation}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <ChatTopbar
            title={activeConversation?.title ?? '新会话'}
            mode={activeMode}
            connected={connected}
            contextOpen={contextOpen}
            onToggleSidebar={() => setSidebarOpen(true)}
            onToggleContext={() => setContextOpen((prev) => !prev)}
            onModeChange={(mode) => {
              if (activeConversationId) {
                setConversationMode(activeConversationId, mode);
              }
            }}
          />

          <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
              <div ref={messagesRef} className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col px-4 pb-12 pt-6 md:px-6">
                  {messages.length === 0 ? (
                    <EmptyStateWelcome prompts={WELCOME_PROMPTS} onPromptSelect={sendMessage} />
                  ) : (
                    <div className="mx-auto w-full max-w-[820px] space-y-6 pb-10">
                      {messages.map((message) => (
                        <ChatMessageItem
                          key={message.id}
                          message={message}
                          streamingLabel={message.status === 'streaming' ? streamLabel : null}
                          onRetry={handleRetry}
                          onReusePrompt={(prompt) => setDraft(prompt)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <ComposerDock
                draft={draft}
                mode={activeMode}
                busy={busy || streaming}
                onDraftChange={setDraft}
                onModeChange={(mode) => {
                  if (activeConversationId) {
                    setConversationMode(activeConversationId, mode);
                  }
                }}
                onSubmit={() => sendMessage(draft)}
                onStop={stop}
              />
            </section>

            <aside
              className={[
                'hidden border-l border-neutral-200/70 bg-white/50 transition-all duration-200 xl:block',
                contextOpen ? 'w-[320px]' : 'w-0 overflow-hidden border-l-0',
              ].join(' ')}
            >
              {contextOpen ? (
                <ContextRail
                  plan={plan}
                  logs={logs}
                  metrics={metrics}
                  activeTools={activeTools}
                  currentStep={currentStep}
                />
              ) : null}
            </aside>
          </div>
        </div>
      </div>

      {!isAtBottom && messages.length > 0 ? (
        <button
          type="button"
          className="absolute bottom-36 right-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_10px_30px_rgba(15,23,42,0.12)] ring-1 ring-black/5 transition hover:text-neutral-950"
          onClick={scrollToBottom}
          aria-label="滚动到底部"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      ) : null}

      <HITLDialog request={hitlRequest} onSubmit={submitHITL} onCancel={dismissHITL} />
    </AnimatedPage>
  );
}
