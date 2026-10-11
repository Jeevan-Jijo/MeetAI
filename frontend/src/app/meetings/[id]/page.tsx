'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCw, 
  Trash2, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  CheckSquare, 
  Gavel, 
  Lightbulb, 
  HelpCircle, 
  BarChart3, 
  FileCheck2, 
  Sparkles,
  Loader2,
  AlertCircle,
  Download
} from 'lucide-react';
import { api } from '@/lib/api';
import { MeetingDetail, ProcessingJob, Speaker } from '@/lib/types';
import { formatSecondsToTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

import { TranscriptView } from '@/components/meetings/TranscriptView';
import { ExtractionsList } from '@/components/meetings/ExtractionsList';
import { MinutesView } from '@/components/meetings/MinutesView';
import { AnalyticsCharts } from '@/components/meetings/AnalyticsCharts';
import { ChatPane } from '@/components/meetings/ChatPane';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'transcript', label: 'Transcript', icon: FileText },
  { id: 'key_points', label: 'Key Points', icon: Lightbulb },
  { id: 'decisions', label: 'Decisions', icon: Gavel },
  { id: 'action_items', label: 'Action Items', icon: CheckSquare },
  { id: 'dates', label: 'Dates & Events', icon: Calendar },
  { id: 'takeaways', label: 'Takeaways', icon: Lightbulb },
  { id: 'questions', label: 'Questions', icon: HelpCircle },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'minutes', label: 'Minutes (MoM)', icon: FileCheck2 },
];

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = Number(params?.id);

  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeJob, setActiveJob] = useState<ProcessingJob | null>(null);

  // Media Player State
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [hasDetectedVideo, setHasDetectedVideo] = useState<boolean>(false);

  // Synchronize audio vs video detection
  useEffect(() => {
    if (!meeting?.recording) {
      setHasDetectedVideo(false);
      return;
    }

    const rec = meeting.recording;
    const isExplicitAudio = Boolean(
      rec.is_video === false ||
      rec.mime_type?.toLowerCase().startsWith('audio/') ||
      rec.original_filename?.toLowerCase().startsWith('meeting_recording_') ||
      ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wma'].some((ext) =>
        rec.original_filename?.toLowerCase().endsWith(ext)
      )
    );

    if (isExplicitAudio) {
      setHasDetectedVideo(false);
    } else if (rec.is_video !== undefined) {
      setHasDetectedVideo(Boolean(rec.is_video));
    } else {
      const isVideoMime = rec.mime_type?.toLowerCase().startsWith('video/');
      const hasVideoExt = ['.mp4', '.mov', '.mkv', '.avi'].some((ext) =>
        rec.original_filename?.toLowerCase().endsWith(ext)
      );
      setHasDetectedVideo(Boolean(isVideoMime || hasVideoExt));
    }
  }, [meeting?.recording?.is_video, meeting?.recording?.mime_type, meeting?.recording?.original_filename]);

  useEffect(() => {
    if (meetingId) {
      loadMeeting();
    }
  }, [meetingId]);

  // Poll job if not completed
  useEffect(() => {
    if (meeting && meeting.status !== 'COMPLETED' && meeting.status !== 'FAILED') {
      const interval = setInterval(async () => {
        try {
          const job = await api.getLatestJobForMeeting(meetingId);
          setActiveJob(job);
          if (job?.status === 'COMPLETED') {
            loadMeeting();
          }
        } catch (err) {
          // ignore
        }
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [meeting?.status, meetingId]);

  const loadMeeting = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMeeting(meetingId);
      setMeeting(data);
      setDuration(data.duration_seconds || 0);

      const latestJob = await api.getLatestJobForMeeting(meetingId);
      setActiveJob(latestJob);
    } catch (err: any) {
      console.error('Failed to load meeting:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = async (seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;

    setPlaybackError(null);

    // If media metadata is not loaded yet (readyState < HAVE_METADATA)
    if (el.readyState < 1) {
      pendingSeekRef.current = seconds;
      setCurrentTime(seconds);
      try {
        const p = el.play();
        if (p !== undefined) {
          await p;
          setIsPlaying(true);
        }
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setPlaybackError('Playback blocked by browser. Click Play directly.');
        }
      }
      return;
    }

    try {
      el.currentTime = seconds;
      setCurrentTime(seconds);
      const p = el.play();
      if (p !== undefined) {
        await p;
      }
      setIsPlaying(true);
    } catch (err: any) {
      console.warn('Playback request error:', err);
      if (err.name === 'NotAllowedError') {
        setPlaybackError('Playback blocked by browser. Click Play directly to start media.');
      } else {
        setPlaybackError(`Playback failed: ${err.message || 'Media stream error'}`);
      }
    }
  };

  const togglePlayPause = async () => {
    const el = mediaRef.current;
    if (!el) return;
    setPlaybackError(null);

    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      try {
        const p = el.play();
        if (p !== undefined) {
          await p;
        }
        setIsPlaying(true);
      } catch (err: any) {
        console.warn('Play error:', err);
        if (err.name === 'NotAllowedError') {
          setPlaybackError('Autoplay blocked. Click Play again to confirm.');
        } else {
          setPlaybackError(`Cannot play media: ${err.message || 'Check recording file'}`);
        }
      }
    }
  };

  const handleSkip = (seconds: number) => {
    const el = mediaRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(duration, el.currentTime + seconds));
    el.currentTime = target;
    setCurrentTime(target);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
    }
  };

  const handleSpeakerRenamed = (updatedSpeaker: Speaker) => {
    if (!meeting) return;
    const updatedSpeakers = meeting.speakers.map((s) =>
      s.id === updatedSpeaker.id ? updatedSpeaker : s
    );
    const updatedSegments = meeting.transcript_segments.map((seg) =>
      seg.speaker_id === updatedSpeaker.id
        ? { ...seg, speaker_label: updatedSpeaker.display_name }
        : seg
    );
    setMeeting({
      ...meeting,
      speakers: updatedSpeakers,
      transcript_segments: updatedSegments,
    });
  };

  const handleDeleteMeeting = async () => {
    if (!confirm('Are you sure you want to delete this meeting, its recording, and its vector store?')) return;
    try {
      await api.deleteMeeting(meetingId);
      router.push('/meetings');
    } catch (err: any) {
      alert(`Delete error: ${err.message || 'Unknown error'}`);
    }
  };

  const handleReprocess = async () => {
    try {
      await api.reprocessMeeting(meetingId);
      loadMeeting();
    } catch (err: any) {
      alert(`Reprocess error: ${err.message || 'Unknown error'}`);
    }
  };

  if (isLoading && !meeting) {
    return (
      <div className="py-24 text-center flex flex-col items-center justify-center gap-3 text-[#8C8E96]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4E6B56]" />
        <span className="text-xs">Loading meeting details...</span>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-sm text-[#666870]">Meeting not found or deleted.</p>
        <Link href="/meetings">
          <Button variant="outline" className="border-[#E5E4DE] text-xs">Return to Meetings</Button>
        </Link>
      </div>
    );
  }

  const audioUrl = api.getAudioUrl(meeting.id);
  const hasRecording = Boolean(meeting.recording);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-16">
      {/* Breadcrumb & Top Actions */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/meetings" className="text-xs text-[#8C8E96] hover:text-[#18191B] transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Meetings
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReprocess} className="border-[#E5E4DE] text-xs" title="Reprocess Pipeline">
            <RotateCw className="w-3.5 h-3.5 text-[#4E6B56]" /> Reprocess
          </Button>
          <Button variant="outline" size="sm" onClick={handleDeleteMeeting} className="border-[#E5E4DE] text-rose-600 hover:bg-rose-50 text-xs" title="Delete Meeting">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Meeting Header Card */}
      <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight">
                {meeting.title}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold uppercase ${
                meeting.status === 'COMPLETED'
                  ? 'bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4]'
                  : meeting.status === 'FAILED'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-[#F5F4EE] text-[#484B52] border border-[#E5E4DE]'
              }`}>
                {meeting.status}
              </span>
            </div>
            {meeting.description && (
              <p className="text-xs text-[#666870]">{meeting.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-[#666870]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#8C8E96]" />
              {new Date(meeting.meeting_date).toLocaleDateString()}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-[#8C8E96]" />
              {formatSecondsToTime(meeting.duration_seconds)}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#8C8E96]" />
              {meeting.speakers.length} Speaker{meeting.speakers.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Playback Error Alert if present */}
        {playbackError && (
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{playbackError}</span>
            </div>
            <button
              type="button"
              onClick={() => setPlaybackError(null)}
              className="text-amber-700 hover:text-amber-900 text-xs font-semibold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Media Player Section for Video or Seeded */}
        {!hasRecording ? (
          <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5E4DE] text-xs text-[#666870] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8C8E96]" />
            <span>No original audio or video recording file is attached to this meeting (seeded transcript mode).</span>
          </div>
        ) : hasDetectedVideo ? (
          /* VIDEO PLAYER EXPERIENCE */
          <div className="space-y-3">
            <div className="rounded-xl border border-[#E5E4DE] bg-black overflow-hidden shadow-subtle aspect-video max-h-[480px] flex items-center justify-center">
              <video
                ref={(el) => { mediaRef.current = el; }}
                src={audioUrl}
                controls
                playsInline
                preload="metadata"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  setDuration(e.currentTarget.duration || meeting.duration_seconds);
                  if (e.currentTarget.videoWidth === 0 && e.currentTarget.videoHeight === 0) {
                    setHasDetectedVideo(false);
                  }
                  if (pendingSeekRef.current !== null) {
                    e.currentTarget.currentTime = pendingSeekRef.current;
                    e.currentTarget.play().catch(() => {});
                    pendingSeekRef.current = null;
                  }
                }}
                onCanPlay={(e) => {
                  if (pendingSeekRef.current !== null) {
                    e.currentTarget.currentTime = pendingSeekRef.current;
                    e.currentTarget.play().catch(() => {});
                    pendingSeekRef.current = null;
                  }
                }}
                onPlay={() => { setIsPlaying(true); setPlaybackError(null); }}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setPlaybackError('Video stream could not be loaded from server.')}
                className="w-full h-full object-contain mx-auto"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#666870] px-1">
              <span className="font-mono">{meeting.recording?.original_filename}</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8C8E96]">Speed:</span>
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => handleSpeedChange(rate)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-[#4E6B56] text-white font-semibold'
                        : 'bg-[#F0EFEA] text-[#666870] hover:bg-[#E5E4DE]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* Live Processing Indicator if running */}
        {meeting.status !== 'COMPLETED' && meeting.status !== 'FAILED' && activeJob && (
          <div className="p-3.5 rounded-xl border border-[#D0DDD4] bg-[#F4F7F5] space-y-2 animate-pulse-fast">
            <div className="flex justify-between text-xs font-semibold text-[#34483A]">
              <span>Current Stage: {activeJob.current_step}</span>
              <span className="font-mono">{Math.round(activeJob.progress_percent)}%</span>
            </div>
            <div className="h-1.5 bg-[#E5E4DE] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#4E6B56] transition-all"
                style={{ width: `${activeJob.progress_percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Failure Banner */}
        {meeting.status === 'FAILED' && (
          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-between gap-3 text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{activeJob?.error_message || 'Audio processing encountered an issue.'}</span>
            </div>
            <Button size="sm" onClick={handleReprocess} className="bg-white border border-rose-200 text-rose-700 text-xs shrink-0">
              Retry Processing
            </Button>
          </div>
        )}
      </div>

      {/* COMPACT STICKY AUDIO PLAYER (Accessible when reading transcript) */}
      {hasRecording && !hasDetectedVideo && (
        <div className="sticky top-0 z-20 p-3.5 rounded-xl bg-white/95 backdrop-blur-md border border-[#E5E4DE] shadow-subtle space-y-2.5 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-9 h-9 rounded-full bg-[#4E6B56] hover:bg-[#415B49] text-white flex items-center justify-center shadow-subtle transition shrink-0 cursor-pointer"
                title={isPlaying ? 'Pause recording' : 'Play recording'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current pl-0.5" />}
              </button>

              <button
                type="button"
                onClick={() => handleSkip(-10)}
                className="px-2.5 py-1 rounded-lg text-[#666870] hover:text-[#18191B] hover:bg-[#EBEAE5] transition text-xs font-mono font-medium border border-[#E5E4DE] bg-white cursor-pointer"
                title="Rewind 10 seconds"
              >
                -10s
              </button>
              <button
                type="button"
                onClick={() => handleSkip(10)}
                className="px-2.5 py-1 rounded-lg text-[#666870] hover:text-[#18191B] hover:bg-[#EBEAE5] transition text-xs font-mono font-medium border border-[#E5E4DE] bg-white cursor-pointer"
                title="Forward 10 seconds"
              >
                +10s
              </button>

              <span className="font-mono text-xs font-semibold text-[#18191B] ml-2">
                {formatSecondsToTime(currentTime)} / {formatSecondsToTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <span className="text-[11px] text-[#8C8E96] font-medium mr-1">Speed:</span>
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => handleSpeedChange(rate)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                    playbackRate === rate
                      ? 'bg-[#4E6B56] text-white font-semibold'
                      : 'bg-[#F0EFEA] text-[#666870] hover:bg-[#E5E4DE]'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Range Slider for Seeking */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration > 0 ? duration : 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[#E5E4DE] rounded-lg appearance-none cursor-pointer accent-[#4E6B56]"
              title="Seek audio position"
            />
          </div>

          {/* Headless HTML5 Audio Engine for the Custom Controls Above */}
          <audio
            ref={(el) => { mediaRef.current = el; }}
            src={audioUrl}
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || meeting.duration_seconds);
              if (pendingSeekRef.current !== null) {
                e.currentTarget.currentTime = pendingSeekRef.current;
                e.currentTarget.play().catch(() => {});
                pendingSeekRef.current = null;
              }
            }}
            onCanPlay={(e) => {
              if (pendingSeekRef.current !== null) {
                e.currentTarget.currentTime = pendingSeekRef.current;
                e.currentTarget.play().catch(() => {});
                pendingSeekRef.current = null;
              }
            }}
            onPlay={() => { setIsPlaying(true); setPlaybackError(null); }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() => setPlaybackError('Audio stream could not be loaded from server.')}
            className="hidden"
          />
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#E5E4DE]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4] shadow-subtle'
                  : 'text-[#666870] hover:bg-[#F5F4EE] hover:text-[#18191B]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#4E6B56]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-[#18191B] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4E6B56]" /> Executive Summary
                </h2>
                {meeting.summary?.overall_sentiment_estimate && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4]">
                    Sentiment: {meeting.summary.overall_sentiment_estimate}
                  </span>
                )}
              </div>

              <p className="text-xs text-[#232529] leading-relaxed">
                {meeting.summary?.executive_summary || 'Executive summary has not been generated.'}
              </p>

              {meeting.summary?.agenda_topics && meeting.summary.agenda_topics.length > 0 && (
                <div className="pt-2 border-t border-[#E5E4DE] space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#666870] block">Agenda Topics Covered:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {meeting.summary.agenda_topics.map((t, idx) => (
                      <span key={idx} className="text-[11px] px-2.5 py-1 rounded bg-[#FAF9F6] border border-[#E5E4DE] text-[#484B52]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl border border-[#E5E4DE] bg-white space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-[#18191B]">
                  <span className="flex items-center gap-1.5">
                    <Gavel className="w-3.5 h-3.5 text-[#4E6B56]" /> Key Decisions
                  </span>
                  <span className="font-mono text-[#4E6B56]">{meeting.decisions.length}</span>
                </div>
                <p className="text-xs text-[#666870]">
                  {meeting.decisions.length > 0
                    ? `${meeting.decisions.length} decision(s) verified against spoken evidence.`
                    : 'No formal decisions identified in the transcript.'}
                </p>
              </div>

              <div className="p-5 rounded-xl border border-[#E5E4DE] bg-white space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-[#18191B]">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-[#4E6B56]" /> Action Items
                  </span>
                  <span className="font-mono text-[#4E6B56]">{meeting.action_items.length}</span>
                </div>
                <p className="text-xs text-[#666870]">
                  {meeting.action_items.length > 0
                    ? `${meeting.action_items.length} action item(s) tracked without invented owners.`
                    : 'No commitments or action items identified.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TRANSCRIPT TAB */}
        {activeTab === 'transcript' && (
          <TranscriptView
            meetingId={meeting.id}
            segments={meeting.transcript_segments}
            speakers={meeting.speakers}
            currentTime={currentTime}
            onSeek={handleSeek}
            onSpeakerRenamed={handleSpeakerRenamed}
          />
        )}

        {/* KEY POINTS TAB */}
        {activeTab === 'key_points' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="key_points"
            keyPoints={meeting.key_points}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* DECISIONS TAB */}
        {activeTab === 'decisions' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="decisions"
            decisions={meeting.decisions}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* ACTION ITEMS TAB */}
        {activeTab === 'action_items' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="action_items"
            actionItems={meeting.action_items}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* DATES TAB */}
        {activeTab === 'dates' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="dates"
            importantDates={meeting.important_dates}
            scheduledEvents={meeting.scheduled_events}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* TAKEAWAYS TAB */}
        {activeTab === 'takeaways' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="takeaways"
            takeaways={meeting.takeaways}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* QUESTIONS TAB */}
        {activeTab === 'questions' && (
          <ExtractionsList
            meetingId={meeting.id}
            type="questions"
            questions={meeting.unresolved_questions}
            onSeek={handleSeek}
            onRefresh={loadMeeting}
          />
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <AnalyticsCharts
            speakers={meeting.speakers}
            durationSeconds={meeting.duration_seconds}
            summary={meeting.summary}
          />
        )}

        {/* MINUTES TAB */}
        {activeTab === 'minutes' && <MinutesView meeting={meeting} />}
      </div>

      {/* Floating Bottom-Right RAG Chatbot Widget with Inspectable Citations */}
      <ChatPane
        meetingId={meeting.id}
        meetingTitle={meeting.title}
        onSeek={handleSeek}
      />
    </div>
  );
}
