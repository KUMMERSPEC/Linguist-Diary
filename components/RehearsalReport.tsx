

import React, { useState, useRef } from 'react';
import { RehearsalEvaluation } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; // Import new helpers

interface RehearsalReportProps {
  evaluation: RehearsalEvaluation;
  language: string;
  date: string;
  onBack: () => void;
}

const RehearsalReport: React.FC<RehearsalReportProps> = ({ evaluation, language, date, onBack }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diff' | 'final'>('diff');
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const renderRuby = (text?: string) => {
    if (!text || typeof text !== 'string') return null;
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderDiffText = (diff?: string) => {
    if (!diff || typeof diff !== 'string') return null;
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-500/20 text-emerald-200 px-1 rounded-md border-b-2 border-emerald-400/30 font-bold mx-0.5">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="text-slate-500 line-through px-1 opacity-60">$1</span>');
    return <div className="leading-[2.2] text-lg md:text-2xl text-slate-100 serif-font" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) { // Toggling off the current audio
        setIsPlaying(null);
        return;
      }
    }
    
    setIsPlaying(id);
    try {
      const cleanText = textToPlay.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      const base64Audio = await generateDiaryAudio(cleanText);
      if (!base64Audio) {
        setIsPlaying(null);
        return;
      }
      const bytes = decode(base64Audio);
      if (bytes.length === 0) {
        setIsPlaying(null);
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) {
      console.error("Error playing audio:", e);
      setIsPlaying(null);
    }
  };

  const getGrade = (score: number) => {
    const s = Math.round(score || 0);
    if (s >= 90) return { label: 'S', color: 'text-indigo-400' };
    if (s >= 80) return { label: 'A', color: 'text-emerald-400' };
    if (s >= 70) return { label: 'B', color: 'text-orange-400' };
    return { label: 'C', color: 'text-slate-400' };
  };

  if (!evaluation) return null;

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 px-2">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回收藏馆 BACK TO EXHIBITS
          </button>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">演练评估报告 Rehearsal Review</h2>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
          <span>{date}</span>
          <span className="text-slate-200">|</span>
          <span className="text-indigo-600">{language}</span>
        </div>
      </header>

      <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
          <div className="lg:col-span-4 space-y-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center hover:bg-white/10 transition-colors">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-2">还原度 Accuracy</span>
                <div className={`text-4xl font-black serif-font ${getGrade(evaluation.accuracyScore).color}`}>{getGrade(evaluation.accuracyScore).label}</div>
                <span className="text-[10px] font-bold text-slate-400 mt-2 block">{Math.round(evaluation.accuracyScore || 0)}/100</span>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center hover:bg-white/10 transition-colors">
                <span className="text-[9px] font-black text-slate-500 uppercase block mb-2">表现力 Quality</span>
                <div className={`text-4xl font-black serif-font ${getGrade(evaluation.qualityScore).color}`}>{getGrade(evaluation.qualityScore).label}</div>
                <span className="text-[10px] font-bold text-slate-400 mt-2 block">{Math.round(evaluation.qualityScore || 0)}/100</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">内容评价 Content</h4>
                <p className="text-sm text-slate-300 leading-relaxed italic">{evaluation.contentFeedback || "暂无反馈"}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">语言评析 Language</h4>
                <p className="text-sm text-slate-300 leading-relaxed italic">{evaluation.languageFeedback || "暂无评析"}</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/5 p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative group">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">源文物 Archive Source</h4>
                <button 
                  onClick={() => handlePlayAudio(evaluation.sourceText || "", 'source')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'source' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                >
                  {isPlaying === 'source' ? '⏹' : '🎧'}
                </button>
              </div>
              <p className="text-lg md:text-2xl text-slate-400 leading-[1.8] serif-font italic">
                “ {renderRuby(evaluation.sourceText || "")} ”
              </p>
            </div>

            <div className="bg-white/10 p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-inner relative group">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">修复后的复述 Restored Version</h4>
                <div className="flex items-center space-x-4">
                  <div className="flex bg-white/5 p-1 rounded-xl">
                    <button onClick={() => setViewMode('diff')} className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'diff' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>对比</button>
                    <button onClick={() => setViewMode('final')} className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'final' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>最终</button>
                  </div>
                  <button 
                    onClick={() => handlePlayAudio(evaluation.suggestedVersion || "", 'suggested')}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'suggested' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                  >
                    {isPlaying === 'suggested' ? '⏹' : '🎧'}
                  </button>
                </div>
              </div>
              <div className="italic">
                {viewMode === 'diff' ? renderDiffText(evaluation.diffedRetelling) : renderRuby(evaluation.suggestedVersion)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RehearsalReport;