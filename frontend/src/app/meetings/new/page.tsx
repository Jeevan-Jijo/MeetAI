'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, UploadCloud, ArrowLeft, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { FileUploader } from '@/components/meetings/FileUploader';
import { AudioRecorder } from '@/components/meetings/AudioRecorder';
import { api } from '@/lib/api';

export default function NewMeetingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentJob, setCurrentJob] = useState<{ id: number; meeting_id: number; progress: number; step: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadSubmit = async (file: File, title: string, description?: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      if (description) formData.append('description', description);

      const res = await api.uploadMeeting(formData);
      setCurrentJob({
        id: res.job_id,
        meeting_id: res.meeting_id,
        progress: 10,
        step: 'Initializing pipeline...',
      });

      // Poll job progress or redirect to meeting view
      pollJobAndRedirect(res.job_id, res.meeting_id);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setIsSubmitting(false);
    }
  };

  const pollJobAndRedirect = (jobId: number, meetingId: number) => {
    const interval = setInterval(async () => {
      try {
        const job = await api.getJob(jobId);
        setCurrentJob({
          id: jobId,
          meeting_id: meetingId,
          progress: job.progress_percent,
          step: job.current_step,
        });

        if (job.status === 'COMPLETED' || job.progress_percent >= 100) {
          clearInterval(interval);
          router.push(`/meetings/${meetingId}`);
        } else if (job.status === 'FAILED') {
          clearInterval(interval);
          setError(job.error_message || 'Processing failed');
          setIsSubmitting(false);
        }
      } catch (err) {
        clearInterval(interval);
        router.push(`/meetings/${meetingId}`);
      }
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#8C8E96]">
        <Link href="/meetings" className="hover:text-[#18191B] transition flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Meetings
        </Link>
      </div>

      <div className="space-y-1 pb-2 border-b border-[#E5E4DE]">
        <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight">
          Analyze New Meeting
        </h1>
        <p className="text-xs sm:text-sm text-[#666870]">
          Upload an audio or video file or record directly through your browser microphone.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Mode Tabs */}
      {!isSubmitting && (
        <div className="flex rounded-xl p-1 bg-[#F5F4EE] border border-[#E5E4DE]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'upload'
                ? 'bg-white text-[#34483A] shadow-subtle'
                : 'text-[#666870] hover:text-[#18191B]'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-[#4E6B56]" /> Upload Recording File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'record'
                ? 'bg-white text-[#34483A] shadow-subtle'
                : 'text-[#666870] hover:text-[#18191B]'
            }`}
          >
            <Mic className="w-4 h-4 text-[#4E6B56]" /> Record Browser Mic
          </button>
        </div>
      )}

      {/* Processing Live Overlay */}
      {isSubmitting && currentJob && (
        <div className="p-8 rounded-2xl border border-[#D0DDD4] bg-white text-center space-y-6 animate-fade-in shadow-card">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#EBF1EC] border border-[#D0DDD4] flex items-center justify-center text-[#4E6B56]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#18191B]">
              Processing Meeting on Local AI Pipeline
            </h3>
            <p className="text-xs text-[#666870]">
              Executing faster-whisper speech transcription, diarization alignment, and grounded structured reasoning.
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-xs font-medium text-[#18191B]">
              <span>{currentJob.step}</span>
              <span className="font-mono text-[#4E6B56]">{Math.round(currentJob.progress)}%</span>
            </div>
            <div className="h-2 bg-[#F5F4EE] border border-[#E5E4DE] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#4E6B56] transition-all duration-300"
                style={{ width: `${Math.max(5, currentJob.progress)}%` }}
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E5E4DE] max-w-sm mx-auto flex items-center justify-center gap-2 text-[11px] text-[#666870]">
            <ShieldCheck className="w-4 h-4 text-[#4E6B56]" />
            <span>100% Offline execution • Saved locally to backend/instance</span>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      {!isSubmitting && (
        <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle">
          {activeTab === 'upload' ? (
            <FileUploader onUploadSubmit={handleUploadSubmit} isSubmitting={isSubmitting} />
          ) : (
            <AudioRecorder
              onRecordingComplete={(file, title) => handleUploadSubmit(file, title)}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      )}
    </div>
  );
}
