'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  PlusCircle, 
  ArrowRight, 
  Play, 
  Trash2, 
  Loader2, 
  ShieldCheck, 
  Cpu, 
  Activity,
  AlertCircle,
  FileText
} from 'lucide-react';
import { api } from '@/lib/api';
import { MeetingListItem, ProcessingJob, SystemHealth } from '@/lib/types';
import { formatSecondsToTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Meetings' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'QUEUED', label: 'Queued' },
  { id: 'ANALYZING', label: 'Processing' },
  { id: 'FAILED', label: 'Failed' },
];

export default function DashboardPage() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 3500); // Live poll for active jobs
    return () => clearInterval(interval);
  }, [search, statusFilter]);

  const loadDashboardData = async () => {
    try {
      const [meetingsData, jobsData, healthData] = await Promise.allSettled([
        api.listMeetings(search || undefined, statusFilter),
        api.listJobs(),
        api.getHealth(),
      ]);

      if (meetingsData.status === 'fulfilled') setMeetings(meetingsData.value);
      if (jobsData.status === 'fulfilled') setJobs(jobsData.value);
      if (healthData.status === 'fulfilled') setHealth(healthData.value);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeeting = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting, its audio, and its vector index?')) return;

    try {
      setDeletingId(id);
      await api.deleteMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      alert(`Failed to delete meeting: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const activeJobs = jobs.filter((j) => !['COMPLETED', 'FAILED'].includes(j.status));

  // Compute real statistics from actual database records (no fake data)
  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter((m) => m.status === 'COMPLETED').length;
  const activeProcessing = activeJobs.length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E4DE]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight">
            Meeting Intelligence Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#666870] mt-0.5">
            Overview of local recordings, processing pipeline, and evidence-grounded transcripts.
          </p>
        </div>

        <Link href="/meetings/new">
          <Button size="md" className="bg-[#4E6B56] hover:bg-[#415B49] text-white rounded-xl shadow-subtle gap-2 text-xs font-semibold">
            <PlusCircle className="w-4 h-4" />
            Analyze Meeting
          </Button>
        </Link>
      </div>

      {/* Real Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle space-y-1">
          <span className="text-[11px] font-medium text-[#666870] uppercase tracking-wider block">
            Total Sessions
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#18191B]">{totalMeetings}</span>
            <FolderKanban className="w-4 h-4 text-[#8C8E96]" />
          </div>
          <span className="text-[10px] text-[#8C8E96]">Stored in project backend/instance</span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle space-y-1">
          <span className="text-[11px] font-medium text-[#666870] uppercase tracking-wider block">
            Completed & Audited
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#34483A]">{completedMeetings}</span>
            <CheckCircle2 className="w-4 h-4 text-[#4E6B56]" />
          </div>
          <span className="text-[10px] text-[#8C8E96]">Ready for RAG and export</span>
        </div>

        <div className="p-4 rounded-xl border border-[#E5E4DE] bg-white shadow-subtle space-y-1">
          <span className="text-[11px] font-medium text-[#666870] uppercase tracking-wider block">
            Active Processing
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#18191B]">{activeProcessing}</span>
            <Activity className="w-4 h-4 text-[#4E6B56]" />
          </div>
          <span className="text-[10px] text-[#8C8E96]">
            {activeProcessing > 0 ? 'Worker currently active' : 'Worker idle and ready'}
          </span>
        </div>
      </div>

      {/* Active Pipeline Banner if jobs are currently executing */}
      {activeJobs.length > 0 && (
        <div className="p-4 rounded-xl border border-[#D0DDD4] bg-[#F4F7F5] space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#34483A]">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-[#4E6B56] animate-spin" />
              <span>Background Pipeline Active ({activeJobs.length} Job{activeJobs.length > 1 ? 's' : ''})</span>
            </div>
            <span className="text-[10px] text-[#666870] font-normal">Auto-refreshing</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeJobs.map((job) => (
              <div key={job.id} className="p-3 rounded-lg bg-white border border-[#E5E4DE] space-y-1.5 text-xs">
                <div className="flex justify-between font-medium text-[#18191B]">
                  <span className="truncate max-w-[200px]">{job.meeting_title || `Meeting #${job.meeting_id}`}</span>
                  <span className="text-[#4E6B56] font-mono">{Math.round(job.progress_percent)}%</span>
                </div>
                <div className="h-1.5 bg-[#FAF9F6] border border-[#E5E4DE] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#4E6B56] transition-all duration-300"
                    style={{ width: `${Math.max(5, job.progress_percent)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-[#666870]">
                  <span>{job.current_step}</span>
                  <span className="font-mono text-[10px] uppercase text-[#4E6B56]">{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8E96] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search meetings by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56] focus:border-transparent transition shadow-subtle"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition ${
                statusFilter === f.id
                  ? 'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4] shadow-subtle'
                  : 'bg-white text-[#666870] border-[#E5E4DE] hover:bg-[#FAF9F6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meetings Catalog */}
      {isLoading ? (
        <div className="p-12 text-center rounded-2xl border border-[#E5E4DE] bg-white space-y-3">
          <Loader2 className="w-6 h-6 text-[#4E6B56] animate-spin mx-auto" />
          <p className="text-xs text-[#666870]">Loading meetings from local database...</p>
        </div>
      ) : meetings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[#E5E4DE] bg-white space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center mx-auto">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div className="max-w-sm mx-auto space-y-1">
            <h3 className="text-sm font-semibold text-[#18191B]">No meetings found</h3>
            <p className="text-xs text-[#666870] leading-relaxed">
              {search || statusFilter !== 'ALL'
                ? 'No meetings match your current search or status filter criteria.'
                : 'Get started by uploading an audio or video recording to extract grounded minutes.'}
            </p>
          </div>
          {(!search && statusFilter === 'ALL') && (
            <Link href="/meetings/new" className="inline-block pt-1">
              <Button size="sm" className="bg-[#4E6B56] hover:bg-[#415B49] text-white text-xs gap-1.5 shadow-subtle">
                <PlusCircle className="w-4 h-4" />
                Upload Your First Meeting
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
