'use client';

import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Calendar, 
  HelpCircle, 
  Lightbulb, 
  Gavel, 
  Trash2, 
  Play, 
  Clock, 
  User, 
  Quote, 
  CheckCircle2, 
  CalendarCheck2 
} from 'lucide-react';
import { 
  ActionItem, Decision, KeyPoint, ImportantDate, 
  ScheduledEvent, Takeaway, UnresolvedQuestion 
} from '@/lib/types';
import { formatSecondsToTime, cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface ExtractionsListProps {
  meetingId: number;
  type: 'action_items' | 'decisions' | 'key_points' | 'dates' | 'questions' | 'takeaways';
  actionItems?: ActionItem[];
  decisions?: Decision[];
  keyPoints?: KeyPoint[];
  importantDates?: ImportantDate[];
  scheduledEvents?: ScheduledEvent[];
  questions?: UnresolvedQuestion[];
  takeaways?: Takeaway[];
  onSeek: (seconds: number) => void;
  onRefresh: () => void;
}

export const ExtractionsList: React.FC<ExtractionsListProps> = ({
  meetingId,
  type,
  actionItems = [],
  decisions = [],
  keyPoints = [],
  importantDates = [],
  scheduledEvents = [],
  questions = [],
  takeaways = [],
  onSeek,
  onRefresh,
}) => {
  const handleToggleActionItem = async (item: ActionItem) => {
    try {
      await api.updateActionItem(meetingId, item.id, { is_completed: !item.is_completed });
      onRefresh();
    } catch (err: any) {
      alert(`Failed to update action item: ${err.message}`);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    try {
      if (type === 'action_items') await api.deleteActionItem(meetingId, id);
      else if (type === 'decisions') await api.deleteDecision(meetingId, id);
      else if (type === 'key_points') await api.deleteKeyPoint(meetingId, id);
      else if (type === 'dates') await api.deleteImportantDate(meetingId, id);
      else if (type === 'questions') await api.deleteQuestion(meetingId, id);
      else if (type === 'takeaways') await api.deleteTakeaway(meetingId, id);
      onRefresh();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // --- ACTION ITEMS RENDER ---
  if (type === 'action_items') {
    return (
      <div className="space-y-3">
        {actionItems.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No action items identified in this meeting.
          </div>
        ) : (
          actionItems.map((item) => {
            const isUnassigned = !item.assignee || item.assignee.toLowerCase() === 'unassigned';
            const hasNoDeadline = !item.deadline || item.deadline.toLowerCase() === 'none';

            return (
              <div
                key={item.id}
                className={cn(
                  'p-4 rounded-xl border transition-all',
                  item.is_completed
                    ? 'bg-[#FAF9F6] border-[#E5E4DE] opacity-60'
                    : 'bg-white border-[#E5E4DE] hover:border-[#D0DDD4] shadow-subtle'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActionItem(item)}
                      className="mt-0.5 text-[#8C8E96] hover:text-[#4E6B56] transition"
                    >
                      {item.is_completed ? (
                        <CheckSquare className="w-5 h-5 text-[#4E6B56]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-2 flex-1">
                      <p className={cn('text-xs font-semibold text-[#18191B]', item.is_completed && 'line-through text-[#8C8E96]')}>
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        {/* Assignee Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border ${
                          isUnassigned
                            ? 'bg-[#F5F4EE] text-[#666870] border-[#E5E4DE]'
                            : 'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4] font-medium'
                        }`}>
                          <User className="w-3 h-3" />
                          <span>Owner: {isUnassigned ? 'Unassigned' : item.assignee}</span>
                        </span>

                        {/* Deadline Badge */}
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border ${
                          hasNoDeadline
                            ? 'bg-[#F5F4EE] text-[#8C8E96] border-[#E5E4DE]'
                            : 'bg-white text-[#232529] border-[#E5E4DE]'
                        }`}>
                          <Clock className="w-3 h-3 text-[#8C8E96]" />
                          <span>Deadline: {hasNoDeadline ? 'None specified' : item.deadline}</span>
                        </span>

                        {/* Priority Badge */}
                        <span className="px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#484B52] font-medium text-[10px] uppercase">
                          {item.priority} Priority
                        </span>

                        {/* Timestamp Seek */}
                        {item.start_time !== undefined && item.start_time !== null && (
                          <button
                            type="button"
                            onClick={() => onSeek(item.start_time || 0)}
                            className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#F5F4EE] hover:bg-[#4E6B56] hover:text-white text-[#484B52] border border-[#E5E4DE] transition"
                            title="Seek recording to evidence"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            {formatSecondsToTime(item.start_time)}
                          </button>
                        )}
                      </div>

                      {/* Source Evidence Quote */}
                      {item.source_text && (
                        <div className="mt-1 p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] text-[11px] text-[#484B52] flex items-start gap-2">
                          <Quote className="w-3.5 h-3.5 text-[#4E6B56] shrink-0 mt-0.5" />
                          <span className="italic leading-relaxed">&ldquo;{item.source_text}&rdquo;</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-[#8C8E96] hover:text-rose-600 p-1 rounded transition"
                    title="Delete action item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // --- DECISIONS RENDER ---
  if (type === 'decisions') {
    return (
      <div className="space-y-4">
        {decisions.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No decisions recorded for this meeting.
          </div>
        ) : (
          decisions.map((dec) => (
            <div
              key={dec.id}
              className="p-5 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-[#EBF1EC] border border-[#D0DDD4] text-[#4E6B56] flex items-center justify-center shrink-0">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-[#18191B]">{dec.decision}</h4>
                    {dec.context && (
                      <p className="text-xs text-[#666870]"><span className="font-semibold text-[#18191B]">Context:</span> {dec.context}</p>
                    )}
                    {dec.impact && (
                      <p className="text-xs text-[#666870]"><span className="font-semibold text-[#18191B]">Impact:</span> {dec.impact}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {dec.start_time !== undefined && dec.start_time !== null && (
                    <button
                      type="button"
                      onClick={() => onSeek(dec.start_time || 0)}
                      className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-[#F5F4EE] hover:bg-[#4E6B56] hover:text-white text-[#484B52] border border-[#E5E4DE] transition"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      {formatSecondsToTime(dec.start_time)}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(dec.id)}
                    className="text-[#8C8E96] hover:text-rose-600 p-1 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {dec.source_text && (
                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] text-[11px] text-[#484B52] flex items-start gap-2">
                  <Quote className="w-3.5 h-3.5 text-[#4E6B56] shrink-0 mt-0.5" />
                  <span className="italic leading-relaxed">&ldquo;{dec.source_text}&rdquo;</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  }

  // --- KEY POINTS RENDER ---
  if (type === 'key_points') {
    return (
      <div className="space-y-3">
        {keyPoints.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No key points extracted.
          </div>
        ) : (
          keyPoints.map((kp) => (
            <div key={kp.id} className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-7 h-7 rounded-lg bg-[#FAF9F6] text-[#4E6B56] border border-[#E5E4DE] flex items-center justify-center shrink-0">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-semibold text-[#666870] tracking-wider block">
                    {kp.category || 'General Discussion'}
                  </span>
                  <p className="text-xs text-[#18191B] font-medium leading-relaxed">{kp.point}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {kp.start_time !== undefined && kp.start_time !== null && (
                  <button
                    type="button"
                    onClick={() => onSeek(kp.start_time || 0)}
                    className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#F5F4EE] hover:bg-[#4E6B56] hover:text-white text-[#484B52] border border-[#E5E4DE] transition"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    {formatSecondsToTime(kp.start_time)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteItem(kp.id)}
                  className="text-[#8C8E96] hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  // --- DATES RENDER ---
  if (type === 'dates') {
    return (
      <div className="space-y-4">
        {importantDates.length === 0 && scheduledEvents.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No dates or scheduled events identified.
          </div>
        ) : (
          <div className="space-y-3">
            {importantDates.map((dt) => (
              <div key={dt.id} className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-[#18191B]">{dt.raw_phrase}</h5>
                    <p className="text-xs text-[#666870]">{dt.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteItem(dt.id)}
                  className="text-[#8C8E96] hover:text-rose-600 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- QUESTIONS RENDER ---
  if (type === 'questions') {
    return (
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No unresolved questions recorded.
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-7 h-7 rounded-lg bg-[#FAF9F6] text-[#666870] border border-[#E5E4DE] flex items-center justify-center shrink-0">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#18191B]">{q.question}</p>
                  {q.raised_by && (
                    <span className="text-[10px] text-[#8C8E96]">Raised by: {q.raised_by}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteItem(q.id)}
                className="text-[#8C8E96] hover:text-rose-600 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  // --- TAKEAWAYS RENDER ---
  return (
    <div className="space-y-3">
      {takeaways.length === 0 ? (
        <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
          No takeaways recorded.
        </div>
      ) : (
        takeaways.map((t) => (
          <div key={t.id} className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-7 h-7 rounded-lg bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-[#18191B] font-medium">{t.takeaway}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDeleteItem(t.id)}
              className="text-[#8C8E96] hover:text-rose-600 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}
    </div>
  );
};
