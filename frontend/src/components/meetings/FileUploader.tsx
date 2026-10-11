'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileAudio, FileVideo, X, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatFileSize } from '@/lib/utils';

interface FileUploaderProps {
  onUploadSubmit: (file: File, title: string, description?: string) => void;
  isSubmitting?: boolean;
}

const SUPPORTED_EXTS = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.flac', '.mkv', '.aac'];

export const FileUploader: React.FC<FileUploaderProps> = ({
  onUploadSubmit,
  isSubmitting = false,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!SUPPORTED_EXTS.includes(ext)) {
      setError(`Unsupported format "${ext}". Supported formats: ${SUPPORTED_EXTS.join(', ')}`);
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File size exceeds the 500 MB limit.');
      return;
    }

    setSelectedFile(file);
    if (!title) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submission
    if (!selectedFile) {
      setError('Please select an audio or video recording file.');
      return;
    }
    onUploadSubmit(selectedFile, title.trim() || selectedFile.name, description.trim() || undefined);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* English-Only Limitation Banner */}
      <div className="p-3.5 rounded-xl border border-[#D0DDD4] bg-[#F4F7F5] flex items-center gap-2.5 text-xs text-[#34483A]">
        <ShieldCheck className="w-4 h-4 text-[#4E6B56] shrink-0" />
        <div>
          <span className="font-semibold">English-Only Transcription:</span> MIS is calibrated for English speech models. Recordings in other languages are not supported.
        </div>
      </div>

      {/* Drop Area */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-[#4E6B56] bg-[#EBF1EC]'
              : 'border-[#D8D7CF] hover:border-[#4E6B56] bg-white'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORTED_EXTS.join(',')}
            onChange={handleChange}
            className="hidden"
          />

          <div className="w-14 h-14 mx-auto rounded-full bg-[#EBF1EC] border border-[#D0DDD4] flex items-center justify-center text-[#4E6B56] mb-3">
            <UploadCloud className="w-7 h-7" />
          </div>

          <h3 className="text-sm font-semibold text-[#18191B]">
            Click to upload or drag & drop meeting recording
          </h3>
          <p className="text-xs text-[#666870] mt-1">
            Supports MP3, MP4, WAV, M4A, WebM, FLAC, OGG, MKV up to 500 MB
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {['MP3', 'WAV', 'M4A', 'MP4', 'WEBM', 'FLAC', 'OGG', 'MKV'].map((ext) => (
              <span
                key={ext}
                className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[#F5F4EE] text-[#484B52] border border-[#E5E4DE]"
              >
                .{ext.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      ) : (
        /* Selected File Card */
        <div className="p-4 rounded-xl border border-[#D0DDD4] bg-[#F9FBF9] flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center shrink-0">
              {selectedFile.type.includes('video') ? (
                <FileVideo className="w-5 h-5" />
              ) : (
                <FileAudio className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#18191B] truncate max-w-md">
                {selectedFile.name}
              </p>
              <p className="text-[11px] text-[#666870]">
                {formatFileSize(selectedFile.size)} • Ready for processing
              </p>
            </div>
          </div>

          {!isSubmitting && (
            <button
              type="button"
              onClick={() => setSelectedFile(null)}
              className="p-1 rounded-md text-[#8C8E96] hover:text-[#18191B] hover:bg-[#E5E4DE]/50 transition"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Metadata Form */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#18191B] mb-1">
            Meeting Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Q4 Product Architecture Sync"
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-white border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56] transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#18191B] mb-1">
            Description or Agenda Context <span className="text-[#8C8E96] font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            placeholder="Add context about participants, meeting goals, or key topics discussed..."
            className="w-full px-3.5 py-2 rounded-xl text-xs bg-white border border-[#E5E4DE] text-[#18191B] placeholder-[#8C8E96] focus:outline-none focus:ring-2 focus:ring-[#4E6B56] transition resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-700 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={!selectedFile || isSubmitting}
          className="w-full bg-[#4E6B56] hover:bg-[#415B49] text-white text-xs font-semibold py-3 rounded-xl shadow-subtle gap-2"
        >
          {isSubmitting ? (
            <>Uploading & Queuing Background Pipeline...</>
          ) : (
            <>
              Start Local Processing Pipeline
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
};
