'use client';

import React from 'react';
import { Download, FileText, FileCode, CheckCircle2, Clock, User, Gavel } from 'lucide-react';
import { MeetingDetail } from '@/lib/types';
import { formatSecondsToTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface MinutesViewProps {
  meeting: MeetingDetail;
}

export const MinutesView: React.FC<MinutesViewProps> = ({ meeting }) => {
  const handleDownload = (format: 'markdown' | 'json' | 'pdf') => {
    let url = '';
    if (format === 'markdown') url = api.getExportMarkdownUrl(meeting.id);
    else if (format === 'json') url = api.getExportJsonUrl(meeting.id);
    else if (format === 'pdf') url = api.getExportPdfUrl(meeting.id);

    window.open(url, '_blank');
  };

  const participants = meeting.speakers.map((s) => s.display_name).join(', ') || 'Participants';

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle">
        <div>
          <h3 className="text-xs font-bold text-[#18191B] tracking-tight">
            Official Minutes of Meeting (MoM)
          </h3>
          <p className="text-[11px] text-[#666870]">
            Export formatted minutes directly to Markdown, structured JSON, or print-ready PDF.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDownload('markdown')} className="border-[#E5E4DE] text-xs">
            <FileText className="w-3.5 h-3.5 text-[#4E6B56]" /> Markdown
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownload('json')} className="border-[#E5E4DE] text-xs">
            <FileCode className="w-3.5 h-3.5 text-[#4E6B56]" /> JSON
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleDownload('pdf')} className="bg-[#4E6B56] hover:bg-[#415B49] text-white text-xs gap-1.5 shadow-subtle">
            <Download className="w-3.5 h-3.5" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Styled Document Sheet */}
      <div className="p-8 sm:p-10 rounded-2xl border border-[#E5E4DE] bg-white shadow-card max-w-4xl mx-auto space-y-8 text-[#232529]">
        {/* Document Header */}
        <div className="border-b border-[#E5E4DE] pb-6 space-y-2">
          <div className="text-[10px] font-mono text-[#4E6B56] font-semibold uppercase tracking-wider">
            MINUTES OF MEETING
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight">
            {meeting.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-xs text-[#666870] pt-2">
            <span>
              <strong>Date:</strong> {new Date(meeting.meeting_date).toLocaleDateString()}
            </span>
            <span>•</span>
            <span>
              <strong>Duration:</strong> {formatSecondsToTime(meeting.duration_seconds)}
            </span>
            <span>•</span>
            <span>
              <strong>Participants:</strong> {participants}
            </span>
          </div>
        </div>

        {/* 1. Executive Summary */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-[#18191B] uppercase tracking-wider">
            1. Executive Summary
          </h2>
          <p className="text-xs text-[#484B52] leading-relaxed">
            {meeting.summary?.executive_summary || 'No summary available.'}
          </p>
        </section>

        {/* 2. Key Decisions */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-[#18191B] uppercase tracking-wider flex items-center gap-1.5">
            <Gavel className="w-3.5 h-3.5 text-[#4E6B56]" /> 2. Decisions Taken
          </h2>
          {meeting.decisions.length === 0 ? (
            <p className="text-xs text-[#8C8E96] italic">No formal decisions recorded during this meeting.</p>
          ) : (
            <div className="space-y-2">
              {meeting.decisions.map((dec, i) => (
                <div key={dec.id} className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] space-y-1 text-xs">
                  <span className="font-semibold text-[#18191B]">{i + 1}. {dec.decision}</span>
                  {dec.source_text && (
                    <p className="text-[11px] text-[#666870] italic">Evidence: &ldquo;{dec.source_text}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Action Items */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-[#18191B] uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4E6B56]" /> 3. Action Items & Commitments
          </h2>
          {meeting.action_items.length === 0 ? (
            <p className="text-xs text-[#8C8E96] italic">No action items assigned during this meeting.</p>
          ) : (
            <div className="space-y-2">
              {meeting.action_items.map((act, i) => (
                <div key={act.id} className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-[#18191B]">{i + 1}. {act.description}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#484B52] shrink-0">
                      {act.priority}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-[#666870]">
                    <span>Owner: <strong>{act.assignee || 'Unassigned'}</strong></span>
                    <span>Deadline: <strong>{act.deadline || 'None specified'}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Document Footer */}
        <div className="pt-6 border-t border-[#E5E4DE] flex justify-between text-[10px] text-[#8C8E96]">
          <span>Generated by Meeting Intelligence System (Local MIS)</span>
          <span>100% Verified Local Reasoning</span>
        </div>
      </div>
    </div>
  );
};
