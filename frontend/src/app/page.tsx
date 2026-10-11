'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  FileText, 
  CheckCircle2, 
  Play, 
  Bot, 
  Download, 
  Clock, 
  Users, 
  Lock, 
  Search, 
  HardDrive,
  Check,
  ChevronRight,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#232529] selection:bg-[#D0DDD4]">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-[#E5E4DE] bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#4E6B56] text-white flex items-center justify-center font-bold text-sm shadow-subtle group-hover:bg-[#415B49] transition">
              M
            </div>
            <div>
              <span className="font-semibold text-sm text-[#18191B] tracking-tight block leading-tight">
                MIS Intelligence
              </span>
              <span className="text-[10px] text-[#666870] font-medium tracking-wide">
                Local-First Meeting System
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#666870]">
            <a href="#features" className="hover:text-[#18191B] transition">Features</a>
            <a href="#preview" className="hover:text-[#18191B] transition">Product Preview</a>
            <a href="#how-it-works" className="hover:text-[#18191B] transition">How It Works</a>
            <a href="#architecture" className="hover:text-[#18191B] transition">Local Architecture</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="hidden sm:inline-block">
              <Button variant="ghost" size="sm" className="text-xs text-[#484B52] hover:text-[#18191B]">
                Dashboard
              </Button>
            </Link>
            <Link href="/meetings/new">
              <Button variant="primary" size="sm" className="bg-[#4E6B56] hover:bg-[#415B49] text-white text-xs gap-1.5 shadow-subtle">
                Analyze a Meeting
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EBF1EC] border border-[#D0DDD4] text-[#34483A] text-xs font-medium animate-fade-in shadow-subtle">
            <ShieldCheck className="w-4 h-4 text-[#4E6B56]" />
            <span>100% Local Intelligence • Zero Cloud APIs • RTX 4060 GPU Accelerated</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-[#18191B] tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Transform meeting audio into verifiable decisions, action items, and minutes.
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-[#555760] max-w-2xl mx-auto font-normal leading-relaxed">
            A local-first system that transcribes recordings, identifies discussion points, audits decisions against spoken evidence, and provides an isolated AI chatbot without inventing owners or deadlines.
          </p>

          {/* Primary Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/meetings/new" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-[#4E6B56] hover:bg-[#415B49] text-white px-7 py-3 text-sm font-semibold rounded-xl shadow-card gap-2">
                Analyze a Meeting
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <a href="#features" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto border border-[#E5E4DE] bg-white hover:bg-[#F5F4EE] text-[#232529] px-7 py-3 text-sm font-semibold rounded-xl shadow-subtle">
                Explore Features
              </Button>
            </a>
          </div>

          {/* Quick Specs Pill Bar */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[#666870]">
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#4E6B56]" />
              <span>English-only speech focus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#4E6B56]" />
              <span>Grounded evidence verification</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[#4E6B56]" />
              <span>Markdown, JSON & PDF MoM</span>
            </div>
          </div>
        </div>
      </section>

      {/* Illustrative Product Preview Section */}
      <section id="preview" className="pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#E5E4DE] bg-white shadow-card overflow-hidden">
          {/* Mockup Titlebar */}
          <div className="px-5 py-3.5 border-b border-[#E5E4DE] bg-[#FAF9F6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#E5E4DE]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E5E4DE]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#E5E4DE]" />
              </div>
              <span className="text-xs text-[#666870] font-medium pl-2">
                Weekly Student Success Meeting — Local Intelligence Dashboard
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#4E6B56] bg-[#EBF1EC] px-2.5 py-0.5 rounded-full border border-[#D0DDD4]">
              Illustrative Preview
            </span>
          </div>

          {/* Mockup Content Grid */}
          <div className="p-6 lg:p-8 space-y-6 bg-white">
            {/* Top Row: Executive Summary & Audio Player Mock */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-xl border border-[#E5E4DE] bg-[#FBFBF9] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#18191B] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#4E6B56]" /> Executive Summary
                  </span>
                  <span className="text-[11px] text-[#4E6B56] font-medium bg-[#EBF1EC] px-2 py-0.5 rounded">
                    Neutral Tone
                  </span>
                </div>
                <p className="text-xs text-[#484B52] leading-relaxed">
                  The team discussed chronic student absenteeism on Fridays and explored proactive initiatives including a Friday pancake breakfast. The group also reviewed academic assistance for students with family caregiving commitments.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#666870]">
                    Agenda: Friday Attendance
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#666870]">
                    Agenda: Community Support Resources
                  </span>
                </div>
              </div>

              {/* Audio Player & Quick Export Preview */}
              <div className="p-5 rounded-xl border border-[#E5E4DE] bg-[#FBFBF9] flex flex-col justify-between space-y-4">
                <div>
                  <span className="text-xs font-semibold text-[#18191B] block mb-2">
                    Audio & Synchronized Playback
                  </span>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-[#E5E4DE]">
                    <div className="w-8 h-8 rounded-full bg-[#4E6B56] text-white flex items-center justify-center shrink-0">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="h-1.5 w-full bg-[#E5E4DE] rounded-full overflow-hidden">
                        <div className="h-full bg-[#4E6B56] w-1/4 rounded-full" />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#666870] mt-1 font-mono">
                        <span>00:24</span>
                        <span>01:38</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E4DE] space-y-1.5">
                  <span className="text-[11px] font-medium text-[#666870] block">Export Formal Minutes:</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-white border border-[#E5E4DE] text-[#232529]">
                      Markdown
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-white border border-[#E5E4DE] text-[#232529]">
                      JSON
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-white border border-[#E5E4DE] text-[#232529]">
                      PDF
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Verifiable Decisions & Action Items with Strict Grounding */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Grounded Decision Card */}
              <div className="p-5 rounded-xl border border-[#E5E4DE] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#18191B] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#4E6B56]" />
                    Audited Decisions
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#EBF1EC] text-[#34483A]">
                    Evidence Verified
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] space-y-1.5 text-xs">
                  <p className="font-medium text-[#18191B]">
                    Try a pancake breakfast initiative to incentivize Friday student attendance.
                  </p>
                  <p className="text-[11px] text-[#666870] italic">
                    Evidence [00:00:21 - 00:00:26]: &ldquo;It might be good if we did something like a pancake breakfast to encourage them to come.&rdquo;
                  </p>
                </div>
              </div>

              {/* Action Item Card with Honest Owner Distinction */}
              <div className="p-5 rounded-xl border border-[#E5E4DE] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#18191B] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#4E6B56]" />
                    Action Items (Zero Fabrication)
                  </span>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#F5F4EE] text-[#484B52]">
                    1 Pending
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E5E4DE] space-y-2 text-xs">
                  <p className="font-medium text-[#18191B]">
                    Research community support resources to share with students facing childcare needs.
                  </p>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#666870]">
                      Owner: <strong className="text-[#8C8E96] font-normal">Unassigned</strong> (Not spoken)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white border border-[#E5E4DE] text-[#666870]">
                      Deadline: <strong className="text-[#8C8E96] font-normal">None stated</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Deep Dive Section */}
      <section id="features" className="py-20 border-t border-[#E5E4DE] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold text-[#4E6B56] uppercase tracking-wider">
              System Capabilities
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#18191B] tracking-tight">
              Engineered for precision and transparent meeting intelligence.
            </h2>
            <p className="text-sm text-[#666870]">
              Every output links back to verified timestamps in the spoken recording.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                GPU-Accelerated Transcription
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Uses faster-whisper with float16 compute on your local NVIDIA RTX 4060. Delivers word-level timestamps in seconds without cloud latency.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Transparent Speaker Attribution
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Distinguishes detected speakers and reports honest fallback status. If model authorization fails, it labels Unknown Speaker without fabricating identities.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Grounded Extraction & Auditing
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Decisions and action items are verified against canonical transcript segments. Claims without direct textual entailment are rejected.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <Search className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Searchable Meeting Archive
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Filter by processing state, search transcript keywords across historical sessions, and keep records stored safely in an external data directory.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Meeting-Scoped AI Chatbot
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Floating assistant scoped strictly to the selected meeting. Cites fine-grained 4-second spans with speaker tags, and clearly abstains on absent information.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1EC] text-[#4E6B56] flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Formal Minutes of Meeting (MoM)
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Assembles professional, formatted MoM documents with executive summary, discussion topics, and action registers. Export to Markdown, JSON, or PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 border-t border-[#E5E4DE] bg-[#FAF9F6]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-semibold text-[#4E6B56] uppercase tracking-wider">
              Simple Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#18191B] tracking-tight">
              From raw audio to verified minutes in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#18191B] text-white flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Upload or Record
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Drag and drop MP3, MP4, WAV, M4A, WebM, or FLAC files up to 500MB, or record directly using the browser microphone.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#4E6B56] text-white flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Local GPU Processing
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                The background worker normalizes audio, transcribes segments with Whisper, extracts structured insights with Ollama, and indexes vector embeddings.
              </p>
            </div>

            <div className="space-y-3">
              <div className="w-8 h-8 rounded-lg bg-[#18191B] text-white flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="text-sm font-semibold text-[#18191B]">
                Review, Query & Export
              </h3>
              <p className="text-xs text-[#666870] leading-relaxed">
                Inspect transcript segments synchronized to audio, chat with the evidence-grounded chatbot, and download formal Minutes of Meeting.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Local Architecture & Data Safety Section */}
      <section id="architecture" className="py-20 border-t border-[#E5E4DE] bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EBF1EC] text-[#34483A] text-xs font-medium">
              <HardDrive className="w-3.5 h-3.5 text-[#4E6B56]" />
              External Storage Architecture
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#18191B] tracking-tight">
              Zero repository clutter. 100% workstation privacy.
            </h2>
            <p className="text-xs sm:text-sm text-[#666870] max-w-xl mx-auto leading-relaxed">
              All recordings, intermediate files, databases, and vector indexes are stored in a centralized, Git-ignored runtime directory (<code className="font-mono text-[#18191B]">backend/instance/</code>).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-1">
              <span className="font-semibold text-[#18191B] block">Clean Source Repository</span>
              <p className="text-[#666870]">
                Zero temporary WAV files or database artifacts stored in source control.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[#E5E4DE] bg-[#FAF9F6] space-y-1">
              <span className="font-semibold text-[#18191B] block">Local LLM Reasoning</span>
              <p className="text-[#666870]">
                Powered by Ollama with local open-weights models. No meeting transcripts leave your machine.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-[#F4F7F5] border-t border-[#E5E4DE]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#18191B] tracking-tight">
            Ready to analyze your next meeting?
          </h2>
          <p className="text-xs sm:text-sm text-[#555760] max-w-lg mx-auto">
            Upload an audio or video file to generate timestamped transcripts, grounded action items, and complete minutes.
          </p>
          <div className="pt-2">
            <Link href="/meetings/new">
              <Button size="lg" className="bg-[#4E6B56] hover:bg-[#415B49] text-white px-8 py-3 text-sm font-semibold rounded-xl shadow-card gap-2">
                Analyze a Meeting
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="border-t border-[#E5E4DE] bg-white py-10 text-xs text-[#8C8E96]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[#4E6B56] text-white flex items-center justify-center font-bold text-[10px]">
              M
            </div>
            <span className="font-semibold text-[#18191B]">Meeting Intelligence System</span>
            <span>— 100% Local-First SaaS</span>
          </div>

          <div className="flex items-center gap-6 text-[#666870]">
            <Link href="/dashboard" className="hover:text-[#18191B] transition">Dashboard</Link>
            <Link href="/meetings" className="hover:text-[#18191B] transition">Meetings</Link>
            <Link href="/meetings/new" className="hover:text-[#18191B] transition">Analyze</Link>
            <Link href="/settings" className="hover:text-[#18191B] transition">System Health</Link>
          </div>

          <div>
            <span>English speech transcription • Local inference</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
