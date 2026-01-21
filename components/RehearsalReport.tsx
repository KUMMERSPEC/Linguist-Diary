import React, { useState, useRef } from 'react';
import { RehearsalEvaluation } from '../types';
import { generateDiaryAudio } from '../services/geminiService';

interface RehearsalReportProps {
  evaluation: RehearsalEvaluation;
  language: string;
  date: string;
  onBack: () => void;
}

const RehearsalReport: React.FC<RehearsalReportProps> = ({ evaluation, language, date, onBack }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (isPlaying === id) {
      audioSourceRef.current?.stop();
      setIsPlaying(null);
      return;
    }
    setIsPlaying(id);
    try {
      const base64Audio = await generateDiaryAudio(textToPlay || "");
      if (!base64Audio) {
        setIsPlaying(null);
        return;
      }
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { setIsPlaying(null); }
  };

  const getGrade = (score: number) => {
    const s = Math.round(score);
    if (s >= 90) return { label: 'S', color: 'text-indigo-400' };
    if (s >= 80) return { label: 'A', color: 'text-emerald-400' };
    if (s >= 70) return { label: 'B', color: 'text-orange-400' };
    return { label: 'C', color: 'text-slate-400' };
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <header className="mb-8 flex items-center justify-between px-2">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回馆藏 BACK TO COLLECTION
          </button>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">演练回顾 Rehearsal Review</h2>
          <p className="text-slate-400 text-xs md:text-sm mt-1">{date} · {language} Exhibit</p>
        </div>
      </header>

      <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-40 -mb-40"></div>

        <div className="flex items-center space-x-4 mb-10">
          <div className="w-3 h-10 bg-indigo-500 rounded-full"></div>
          <h3 className="text-xl md:text-3xl font-bold serif-font tracking-tight">历史评估报告 Archive Report</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
          {/* 左侧：分数与指标 */}
          <div className="lg:col-span-4 space-y-10">
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">还原度 Accuracy</p>
                <div className={`text-5xl md:text-7xl font-black serif-font ${getGrade(evaluation.accuracyScore).color}`}>
                  {getGrade(evaluation.accuracyScore).label}
                </div>
                <p className="text-xs font-bold text-slate-400 mt-3">{Math.round(evaluation.accuracyScore)}/100</p>
              </div>
              <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 text-center">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">表现力 Quality</p>
                <div className={`text-5xl md:text-7xl font-black serif-font ${getGrade(evaluation.qualityScore).color}`}>
                  {getGrade(evaluation.qualityScore).label}
                </div>
                <p className="text-xs font-bold text-slate-400 mt-3">{Math.round(evaluation.qualityScore)}/100</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="bg-indigo-500/5 p-6 rounded-3xl border border-indigo-500/10">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
                  <span className="mr-3">📝</span> 内容反馈 Content
                </h4>
                <p className="text-sm md:text-lg text-indigo-50/80 leading-relaxed italic">{evaluation.contentFeedback}</p>
              </div>
              <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/10">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center">
                  <span className="mr-3">✨</span> 语言反馈 Language
                </h4>
                <p className="text-sm md:text-lg text-emerald-50/80 leading-relaxed italic">{evaluation.languageFeedback}</p>
              </div>
            </div>
          </div>

          {/* 右侧：演进过程 (原文 -> 复述 -> 示范) */}
          <div className="lg:col-span-8 flex flex-col space-y-8">
            {/* 1. 溯源原文 */}
            <div className="flex flex-col opacity-50">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-3"></span>
                    源文物 Archive Source
                  </h4>
                  <button 
                    onClick={() => handlePlayAudio(evaluation.sourceText || "", 'source')}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'source' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400'}`}
                  >
                    {isPlaying === 'source' ? '⏹' : '🎧'}
                  </button>
               </div>
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-dashed border-white/10 text-slate-400 italic serif-font text-base md:text-xl leading-relaxed">
                  “ {renderRuby(evaluation.sourceText || "")} ”
               </div>
            </div>

            {/* 2. 您的复述 */}
            <div className="flex flex-col">
               <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center">
                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-3"></span>
                 您的复述 Your Retelling
               </h4>
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 text-slate-300 italic serif-font text-base md:text-xl leading-relaxed">
                  “ {evaluation.userRetelling} ”
               </div>
            </div>

            {/* 3. 馆长示范 */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 mr-3"></span>
                  馆长示范 Masterwork Suggestion
                </h4>
                <button 
                  onClick={() => handlePlayAudio(evaluation.suggestedVersion || "", 'suggest')}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'suggest' ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}
                >
                  {isPlaying === 'suggest' ? '⏹' : '🎧'}
                </button>
              </div>
              <div className="bg-indigo-600/10 p-10 md:p-14 rounded-[3rem] md:rounded-[4rem] border border-indigo-500/20 text-indigo-100 italic serif-font text-lg md:text-2xl lg:text-3xl leading-[2.2] relative">
                <div className="absolute top-6 right-8 text-6xl opacity-10 font-serif">”</div>
                {renderRuby(evaluation.suggestedVersion)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RehearsalReport;