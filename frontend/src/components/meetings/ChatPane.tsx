'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, Bot, User, Play, Sparkles, Trash2, X, MessageSquare, Loader2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { ChatMessage, Citation } from '@/lib/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface ChatPaneProps {
  meetingId: number;
  meetingTitle: string;
  onSeek: (seconds: number) => void;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  meetingId,
  meetingTitle,
  onSeek,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedCitationKey, setExpandedCitationKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (meetingId) {
      loadHistory();
    }
  }, [meetingId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const history = await api.getChatHistory(meetingId);
      setMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputQuery.trim();
    if (!query || isLoading) return;

    setInputQuery('');
    setErrorMessage(null);

    const tempUserMsg: ChatMessage = {
      meeting_id: meetingId,
      role: 'user',
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const res = await api.sendChatMessage(meetingId, query);
      const assistantMsg: ChatMessage = {
        meeting_id: meetingId,
        role: 'assistant',
        content: res.answer,
        citations: res.citations,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const userFriendlyError = err.message || 'Local AI service unavailable. Please check that Ollama is running.';
      setErrorMessage(userFriendlyError);
      const errorMsg: ChatMessage = {
        meeting_id: meetingId,
        role: 'assistant',
        content: `Error: ${userFriendlyError}`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('Clear chat conversation history for this meeting?')) return;
    try {
      await api.clearChatHistory(meetingId);
      setMessages([]);
      setExpandedCitationKey(null);
      setErrorMessage(null);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  const toggleCitation = (key: string) => {
    setExpandedCitationKey((prev) => (prev === key ? null : key));
  };

  if (!mounted) {
    return null;
  }

  const widgetContent = (
    <div className="mis-chat-widget">
      {/* Floating Panel (Anchored to bottom-right viewport above the launcher button) */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Meeting Intelligence Chat Assistant"
          className="fixed bottom-24 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[440px] h-[580px] max-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-[#E5E4DE] bg-[#FAF9F6] text-[#232529] flex flex-col overflow-hidden animate-slide-up"
        >
          {/* Panel Header */}
          <div className="px-4 py-3 border-b border-[#E5E4DE] bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#EBF1EC] border border-[#D0DDD4] text-[#4E6B56] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-[#18191B] tracking-tight">
                  Meeting AI Assistant
                </h3>
                <p className="text-[11px] text-[#666870] truncate max-w-[220px]">
                  {meetingTitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[#8C8E96] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                  title="Clear Chat History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[#8C8E96] hover:text-[#18191B] p-1.5 rounded-lg hover:bg-[#F5F4EE] transition cursor-pointer"
                title="Close chat panel (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAF9F6]">
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#666870] space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-xs font-semibold text-[#18191B]">
                    Ask anything about this meeting
                  </p>
                  <p className="text-[11px] text-[#666870] leading-relaxed">
                    Answers are strictly evidence-based and cite verified transcript spans.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                  {[
                    'What were the key decisions?',
                    'Who was assigned which tasks?',
                    'What are the upcoming deadlines?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInputQuery(suggestion)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-[#E5E4DE] hover:border-[#4E6B56] hover:text-[#34483A] transition text-[#484B52] bg-white shadow-subtle cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex gap-2.5 text-xs animate-fade-in',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center shrink-0 mt-0.5 border border-[#D0DDD4]">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl p-3 space-y-2',
                    msg.role === 'user'
                      ? 'bg-[#4E6B56] text-white rounded-tr-xs shadow-subtle'
                      : 'bg-white text-[#18191B] rounded-tl-xs border border-[#E5E4DE] shadow-subtle'
                  )}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                  {/* Inspectable Citations Bar */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-[#E5E4DE] space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#666870] block">
                        Source Citations ({msg.citations.length})
                      </span>
                      <div className="space-y-1.5">
                        {msg.citations.map((c, cIdx) => {
                          const citeKey = `${idx}-${cIdx}`;
                          const isExpanded = expandedCitationKey === citeKey;

                          return (
                            <div key={cIdx} className="rounded-lg border border-[#E5E4DE] bg-[#FAF9F6] overflow-hidden text-[11px]">
                              {/* Citation Pill Header */}
                              <button
                                type="button"
                                onClick={() => toggleCitation(citeKey)}
                                className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-[#F5F4EE] transition text-left cursor-pointer"
                              >
                                <span className="font-mono text-[#4E6B56] font-semibold">
                                  [{c.timestamp_str}]
                                </span>
                                <span className="text-[#666870] truncate flex-1 text-[10px]">
                                  {c.speaker_label || 'Unknown Speaker'}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-[#8C8E96]" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-[#8C8E96]" />
                                )}
                              </button>

                              {/* Expanded Citation Inspector */}
                              {isExpanded && (
                                <div className="p-2.5 border-t border-[#E5E4DE] bg-white space-y-2 animate-fade-in">
                                  <div className="text-[11px] text-[#232529] leading-relaxed italic bg-[#F9F8F5] p-2 rounded border border-[#E5E4DE]">
                                    &ldquo;{c.text}&rdquo;
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-[#666870]">
                                    <span>Speaker: <strong>{c.speaker_label}</strong></span>
                                    <button
                                      type="button"
                                      onClick={() => onSeek(c.start_time)}
                                      className="inline-flex items-center gap-1 font-semibold text-[#4E6B56] hover:text-[#34483A] bg-[#EBF1EC] px-2 py-0.5 rounded border border-[#D0DDD4] transition cursor-pointer"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                      Seek Audio [{c.timestamp_str.split(' - ')[0]}]
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-[#E8E7E1] text-[#484B52] flex items-center justify-center shrink-0 mt-0.5 border border-[#D8D7CF]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 text-xs animate-fade-in">
                <div className="w-6 h-6 rounded-md bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center shrink-0 border border-[#D0DDD4]">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="p-3 rounded-2xl bg-white rounded-tl-xs border border-[#E5E4DE] flex items-center gap-2 text-[#666870] shadow-subtle">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#4E6B56]" />
                  Searching transcript & verifying evidence...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[#E5E4DE] bg-white flex gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask a question about this meeting..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={isLoading}
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-[#FAF9F6] border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56]"
            />
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!inputQuery.trim() || isLoading}
              className="bg-[#4E6B56] hover:bg-[#415B49] text-white rounded-xl px-3 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}

      {/* Floating Circular Toggle Button (Bottom-Right Viewport) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close chat assistant' : 'Open chat assistant'}
        className={cn(
          'fixed bottom-6 right-6 z-[9999] w-14 h-14 min-w-[56px] min-h-[56px] rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#4E6B56]/50 cursor-pointer',
          isOpen
            ? 'bg-[#18191B] text-white hover:bg-[#232529] rotate-90 scale-95'
            : 'bg-[#4E6B56] text-white hover:bg-[#415B49] hover:scale-105 active:scale-95'
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform" />
        ) : (
          <div className="relative flex items-center justify-center">
            <MessageSquare className="w-6 h-6 fill-white/20" />
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EBF1EC] border-2 border-[#4E6B56]" />
            )}
          </div>
        )}
      </button>
    </div>
  );

  return createPortal(widgetContent, document.body);
};
