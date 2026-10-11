'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  FolderKanban, 
  Clock, 
  Trash2, 
  ArrowRight,
  Loader2,
  PlusCircle,
  RotateCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { MeetingListItem } from '@/lib/types';
import { formatSecondsToTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const STATUS_FILTERS = [
  'ALL',
  'COMPLETED',
  'TRANSCRIBING',
  'DIARIZING',
  'ANALYZING',
  'QUEUED',
  'FAILED',
];

export default function MeetingsListPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadMeetings();
  }, [search, statusFilter]);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      const data = await api.listMeetings(search || undefined, statusFilter);
      setMeetings(data);
    } catch (err) {
      console.error('Failed to load meetings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeeting = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting and its local audio/data?')) return;

    try {
      setDeletingId(id);
      await api.deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleReprocessMeeting = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.reprocessMeeting(id);
      alert('Reprocessing initiated in background.');
      loadMeetings();
    } catch (err: any) {
      alert(`Reprocess failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E4DE]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight">
            Meetings Library
          </h1>
          <p className="text-xs sm:text-sm text-[#666870] mt-0.5">
            Search, inspect, and manage all your processed recordings stored in local storage.
          </p>
        </div>

        <Link href="/meetings/new">
          <Button size="md" className="bg-[#4E6B56] hover:bg-[#415B49] text-white rounded-xl shadow-subtle gap-2 text-xs font-semibold">
            <PlusCircle className="w-4 h-4" />
            Analyze Meeting
          </Button>
        </Link>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8E96] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search meetings by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56] transition"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                statusFilter === st
                  ? 'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4] shadow-subtle'
                  : 'bg-white text-[#666870] border-[#E5E4DE] hover:bg-[#FAF9F6]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-[#8C8E96] bg-white rounded-xl border border-[#E5E4DE]">
            <Loader2 className="w-6 h-6 animate-spin text-[#4E6B56]" />
            <span className="text-xs">Loading meetings...</span>
          </div>
        ) : meetings.length === 0 ? (
          <div className="text-center py-16 p-6 rounded-xl border border-[#E5E4DE] bg-white space-y-3">
            <div className="w-12 h-12 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center mx-auto">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-[#18191B]">
              No meetings found
            </h3>
            <p className="text-xs text-[#666870] max-w-sm mx-auto">
              {search || statusFilter !== 'ALL'
                ? 'Try adjusting your search terms or status filters.'
                : 'Upload or record a meeting to get started with local transcription and analysis.'}
            </p>
            <div className="pt-2">
              <Link href="/meetings/new">
                <Button size="sm" className="bg-[#4E6B56] hover:bg-[#415B49] text-white text-xs gap-1.5 shadow-subtle">
                  <PlusCircle className="w-4 h-4" />
                  Analyze New Meeting
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/meetings/${meeting.id}`}
              className="group block p-4 rounded-xl border border-[#E5E4DE] bg-white hover:border-[#D0DDD4] hover:shadow-card transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[#18191B] group-hover:text-[#4E6B56] transition truncate">
                      {meeting.title}
                    </h3>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                      meeting.status === 'COMPLETED'
                        ? 'bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4]'
                        : meeting.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-[#F5F4EE] text-[#484B52] border border-[#E5E4DE]'
                    }`}>
                      {meeting.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#666870]">
                    <span>
                      {new Date(meeting.meeting_date).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-[#8C8E96]" />
                      {formatSecondsToTime(meeting.duration_seconds || 0)}
                    </span>
                    <span>•</span>
                    <span>{meeting.speaker_count || 1} Speaker{(meeting.speaker_count || 1) > 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{meeting.action_item_count || 0} Action item{(meeting.action_item_count || 0) === 1 ? '' : 's'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {meeting.status === 'FAILED' && (
                    <button
                      type="button"
                      onClick={(e) => handleReprocessMeeting(meeting.id, e)}
                      className="p-1.5 rounded-lg text-[#8C8E96] hover:text-[#4E6B56] hover:bg-[#EBF1EC] transition"
                      title="Reprocess meeting"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteMeeting(meeting.id, e)}
                    disabled={deletingId === meeting.id}
                    className="p-1.5 rounded-lg text-[#8C8E96] hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete meeting and local data"
                  >
                    {deletingId === meeting.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>

                  <div className="text-xs text-[#4E6B56] font-medium flex items-center gap-1 pl-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
