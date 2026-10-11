'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Edit2, User, Copy, Check, Volume2, RotateCcw } from 'lucide-react';
import { TranscriptSegment, Speaker } from '@/lib/types';
import { formatSecondsToTime, cn } from '@/lib/utils';
import { SpeakerRenameModal } from './SpeakerRenameModal';

interface TranscriptViewProps {
  meetingId: number;
  segments: TranscriptSegment[];
  speakers: Speaker[];
  currentTime: number;
  onSeek: (seconds: number) => void;
  onSpeakerRenamed: (speaker: Speaker) => void;
}

const SPEAKER_PALETTES = [
  'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4]',
  'bg-[#EEF2F6] text-[#2C4258] border-[#D4DFE8]',
  'bg-[#FAF4EB] text-[#5C4524] border-[#E8DDCC]',
  'bg-[#F5EFF7] text-[#4F3356] border-[#DFD3E3]',
  'bg-[#F7EEEE] text-[#593030] border-[#E3CCCC]',
];

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  meetingId,
  segments,
  speakers,
  currentTime,
  onSeek,
  onSpeakerRenamed,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [followPlayback, setFollowPlayback] = useState<boolean>(false);
  const [isPausedByUserScroll, setIsPausedByUserScroll] = useState<boolean>(false);

  const lastScrolledSegIdRef = useRef<number | null>(null);
  const isProgrammaticScrollRef = useRef<boolean>(false);

  // Detect manual user scrolling to suspend auto-follow
  useEffect(() => {
    const handleUserScroll = () => {
      if (isProgrammaticScrollRef.current) {
        return;
      }
      if (followPlayback) {
        setFollowPlayback(false);
        setIsPausedByUserScroll(true);
      }
    };

    window.addEventListener('wheel', handleUserScroll, { passive: true });
    window.addEventListener('touchmove', handleUserScroll, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleUserScroll);
      window.removeEventListener('touchmove', handleUserScroll);
    };
  }, [followPlayback]);

  // Only scroll when active segment changes AND is not already comfortably visible
  useEffect(() => {
    if (!followPlayback) return;

    const activeSeg = segments.find(
      (s) => currentTime >= s.start_time && currentTime <= s.end_time
    );

    if (!activeSeg) return;

    // NEVER scroll continuously on every timeupdate: only when changing segments
    if (activeSeg.id === lastScrolledSegIdRef.current) {
      return;
    }

    lastScrolledSegIdRef.current = activeSeg.id;

    const el = document.getElementById(`seg-${activeSeg.id}`);
    if (!el) return;

    // Check if element is already comfortably in view
    const rect = el.getBoundingClientRect();
    const isVisible = rect.top >= 140 && rect.bottom <= (window.innerHeight - 80);

    if (!isVisible) {
      isProgrammaticScrollRef.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const timer = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [currentTime, followPlayback, segments]);

  const handleToggleAutoFollow = () => {
    const nextState = !followPlayback;
    setFollowPlayback(nextState);
    setIsPausedByUserScroll(false);

    if (nextState) {
      const activeSeg = segments.find(
        (s) => currentTime >= s.start_time && currentTime <= s.end_time
      );
      if (activeSeg) {
        lastScrolledSegIdRef.current = activeSeg.id;
        const el = document.getElementById(`seg-${activeSeg.id}`);
        if (el) {
          isProgrammaticScrollRef.current = true;
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          setTimeout(() => {
            isProgrammaticScrollRef.current = false;
          }, 600);
        }
      }
    }
  };

  const handleSeekAndFollow = (seg: TranscriptSegment) => {
    lastScrolledSegIdRef.current = seg.id;
    onSeek(seg.start_time);
  };

  const filteredSegments = segments.filter((seg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      seg.cleaned_text.toLowerCase().includes(q) ||
      seg.speaker_label.toLowerCase().includes(q)
    );
  });

  const getSpeakerStyle = (label: string) => {
    if (label.toLowerCase().includes('unknown')) {
      return 'bg-[#F5F4EE] text-[#666870] border-[#E5E4DE]';
    }
    let hash = 0;
    for (let i = 0; i < label.length; i++) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % SPEAKER_PALETTES.length;
    return SPEAKER_PALETTES[idx];
  };

  const handleCopyText = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-white border border-[#E5E4DE] shadow-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#8C8E96] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search transcript text or speaker name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-[#FAF9F6] border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56]"
          />
        </div>
        <div className="flex items-center gap-3 self-end sm:self-center flex-wrap">
          {isPausedByUserScroll && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
              <span>Auto-follow paused</span>
              <button
                type="button"
                onClick={handleToggleAutoFollow}
                className="font-semibold text-[#4E6B56] hover:text-[#34483A] underline flex items-center gap-0.5 cursor-pointer ml-1"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Resume
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleToggleAutoFollow}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition cursor-pointer',
              followPlayback
                ? 'bg-[#EBF1EC] text-[#34483A] border-[#D0DDD4]'
                : 'bg-white text-[#666870] border-[#E5E4DE] hover:bg-[#F5F4EE]'
            )}
            title="Automatically scroll to follow the currently playing segment (pauses on manual scroll)"
          >
            <Volume2 className={cn('w-3 h-3', followPlayback ? 'text-[#4E6B56]' : 'text-[#8C8E96]')} />
            {followPlayback ? 'Auto-follow active' : 'Auto-follow off'}
          </button>

          <div className="text-xs text-[#666870]">
            Showing {filteredSegments.length} of {segments.length} segments
          </div>
        </div>
      </div>

      {/* Segments List */}
      <div className="space-y-3">
        {filteredSegments.length === 0 ? (
          <div className="p-12 text-center text-[#8C8E96] text-xs bg-white rounded-xl border border-[#E5E4DE]">
            No matching transcript segments found.
          </div>
        ) : (
          filteredSegments.map((seg) => {
            const isActive = currentTime >= seg.start_time && currentTime <= seg.end_time;
            const speakerObj = speakers.find((s) => s.id === seg.speaker_id) || null;
            const isUnknown = seg.speaker_label.toLowerCase().includes('unknown');

            return (
              <div
                key={seg.id}
                id={`seg-${seg.id}`}
                className={cn(
                  'p-4 rounded-xl border transition-all text-xs group',
                  isActive
                    ? 'border-[#4E6B56] bg-[#EBF1EC]/70 shadow-subtle ring-1 ring-[#4E6B56]/50'
                    : 'border-[#E5E4DE] bg-white hover:border-[#D0DDD4]'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Timestamp button (click to seek & play) */}
                    <button
                      type="button"
                      onClick={() => handleSeekAndFollow(seg)}
                      className={cn(
                        'inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md transition cursor-pointer font-medium',
                        isActive
                          ? 'bg-[#4E6B56] text-white shadow-2xs'
                          : 'bg-[#F5F4EE] hover:bg-[#4E6B56] hover:text-white text-[#484B52] border border-[#E5E4DE]'
                      )}
                      title={`Click to jump to ${formatSecondsToTime(seg.start_time)} and start playback`}
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      {formatSecondsToTime(seg.start_time)}
                    </button>

                    {/* Active playing indicator */}
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#4E6B56]/15 text-[#34483A]">
                        <Volume2 className="w-3 h-3 text-[#4E6B56] animate-pulse" /> Playing
                      </span>
                    )}

                    {/* Speaker Badge */}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border',
                        getSpeakerStyle(seg.speaker_label)
                      )}
                    >
                      <User className="w-3 h-3" />
                      {seg.speaker_label}
                      {isUnknown && (
                        <span className="text-[10px] text-[#8C8E96] font-normal">(Single fallback)</span>
                      )}
                    </span>

                    {/* Edit speaker name quick button */}
                    {speakerObj && (
                      <button
                        type="button"
                        onClick={() => setEditingSpeaker(speakerObj)}
                        className="opacity-0 group-hover:opacity-100 text-[#8C8E96] hover:text-[#4E6B56] p-1 rounded transition cursor-pointer"
                        title={`Rename ${seg.speaker_label}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#8C8E96] font-mono">
                      to {formatSecondsToTime(seg.end_time)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(seg.id, seg.cleaned_text)}
                      className="opacity-0 group-hover:opacity-100 text-[#8C8E96] hover:text-[#18191B] p-1 transition cursor-pointer"
                      title="Copy segment text"
                    >
                      {copiedId === seg.id ? (
                        <Check className="w-3 h-3 text-[#4E6B56]" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-[#232529] leading-relaxed select-text font-normal text-xs">
                  {seg.cleaned_text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Speaker Rename Modal */}
      {editingSpeaker && (
        <SpeakerRenameModal
          isOpen={!!editingSpeaker}
          meetingId={meetingId}
          speaker={editingSpeaker}
          onClose={() => setEditingSpeaker(null)}
          onSpeakerUpdated={(updated) => {
            onSpeakerRenamed(updated);
            setEditingSpeaker(null);
          }}
        />
      )}
    </div>
  );
};
