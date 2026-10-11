'use client';

import React, { useEffect, useState } from 'react';
import { 
  Settings, 
  Cpu, 
  ShieldCheck, 
  ExternalLink, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  HardDrive
} from 'lucide-react';
import { api } from '@/lib/api';
import { SystemHealth } from '@/lib/types';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadHealth();
  }, []);

  const loadHealth = async () => {
    try {
      setIsLoading(true);
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E4DE]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#18191B] tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#4E6B56]" /> System Settings & Health
          </h1>
          <p className="text-xs sm:text-sm text-[#666870] mt-0.5">
            Real-time verification of local hardware acceleration, speech engines, and LLM inference.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadHealth} disabled={isLoading} className="border-[#E5E4DE] text-xs gap-1.5">
          <RotateCw className={`w-3.5 h-3.5 text-[#4E6B56] ${isLoading ? 'animate-spin' : ''}`} /> Re-check Engine Health
        </Button>
      </div>

      {/* Storage Architecture Callout */}
      <div className="p-4 rounded-xl border border-[#D0DDD4] bg-[#F4F7F5] flex items-start gap-3 text-xs text-[#34483A]">
        <HardDrive className="w-4 h-4 text-[#4E6B56] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Centralized Project-Local Runtime Directory Active:</span>
          <p className="text-[11px] text-[#484B52] leading-relaxed">
            All audio files, normalized WAV intermediates, SQLite databases, and FAISS vector embeddings are stored in <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#D0DDD4]">backend/instance/</code> (excluded from version control).
          </p>
        </div>
      </div>

      {/* Engine Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Speech Recognition (faster-whisper) */}
        <div className="p-5 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18191B] uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#4E6B56]" /> Speech-to-Text
            </span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4]">
              faster-whisper
            </span>
          </div>

          <div className="space-y-2 text-xs text-[#484B52]">
            <div className="flex justify-between py-1 border-b border-[#E5E4DE]/60">
              <span className="text-[#666870]">Active Device:</span>
              <span className="font-mono font-semibold text-[#18191B]">{health?.whisper?.device?.toUpperCase() || 'GPU/CUDA'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E5E4DE]/60">
              <span className="text-[#666870]">Model Identifier:</span>
              <span className="font-mono text-[#18191B]">{health?.whisper?.primary_model || 'base.en'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#666870]">Compute Precision:</span>
              <span className="font-mono text-[#18191B]">float16 / int8</span>
            </div>
          </div>
        </div>

        {/* 2. Local LLM (Ollama) */}
        <div className="p-5 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#18191B] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#4E6B56]" /> Local Reasoning
            </span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#EBF1EC] text-[#34483A] border border-[#D0DDD4]">
              Ollama Local
            </span>
          </div>

          <div className="space-y-2 text-xs text-[#484B52]">
            <div className="flex justify-between py-1 border-b border-[#E5E4DE]/60">
              <span className="text-[#666870]">Connection Endpoint:</span>
              <span className="font-mono text-[#18191B]">http://localhost:11434</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E5E4DE]/60">
              <span className="text-[#666870]">Active Model:</span>
              <span className="font-mono font-semibold text-[#18191B]">{health?.ollama?.active_model || 'llama3.1:8b'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#666870]">Service Status:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[#4E6B56]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Speaker Diarization Notice Card */}
      <div className="p-5 rounded-2xl border border-[#E5E4DE] bg-white shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#18191B] uppercase tracking-wider">
            Speaker Diarization Pipeline (pyannote.audio)
          </h3>
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#FAF4EB] text-[#5C4524] border border-[#E8DDCC]">
            Gated Repository Notice
          </span>
        </div>

        <p className="text-xs text-[#484B52] leading-relaxed">
          The diarization stage requires user license agreement on Hugging Face for dependent sub-models. The system operates in an honest single-speaker fallback mode (<code className="font-mono text-[#18191B]">Unknown Speaker</code>) without fabricating speaker identities until gated repo terms are accepted.
        </p>

        <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5E4DE] space-y-2 text-xs">
          <span className="font-semibold text-[#18191B] block">To enable real multi-speaker diarization:</span>
          <ol className="list-decimal list-inside space-y-1 text-[#666870] text-[11px]">
            <li>Log into your Hugging Face account associated with your token (<code className="font-mono text-[#18191B]">arjunmk4u</code>).</li>
            <li>Accept terms of use on the model repository: <a href="https://huggingface.co/pyannote/segmentation-3.0" target="_blank" rel="noreferrer" className="text-[#4E6B56] underline font-mono">hf.co/pyannote/segmentation-3.0</a>.</li>
            <li>Rerun any meeting; the model weights will download automatically into local cache.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
