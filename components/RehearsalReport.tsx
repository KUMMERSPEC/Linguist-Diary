
import React, { useState, useRef } from 'react';
import { RehearsalEvaluation, AdvancedVocab } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface RehearsalReportProps {
  evaluation: RehearsalEvaluation;
  language: string;
  date: string;
  onBack: () => void;
  onSaveVocab: (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => Promise<void>;
  onRetryFailed?: (failedItems: { word: string; meaning: string; usage: string; }[]) => void;
}

const RehearsalReport: React.FC<RehearsalReportProps> = ({ evaluation, language, date, onBack, onSaveVocab, onRetryFailed }) => {
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'diff' | 'final'>('diff');
  const [savedGems, setSavedGems] = useState<Set<string>>(new Set());
  const [isGemModalOpen, setIsGemModalOpen] = useState(false);
  const [selectedGemsInModal, setSelectedGemsInModal] = useState<Set<string>>(new Set());
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
      .replace(/<add>(.*?)<\/add>/g, '<span class="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded mx-0.5">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="text-rose-400 line-through opacity-60 mx-0.5">$1</span>');
    return <div className="leading-[2.5] text-lg md:text-xl text-slate-100 serif-font italic" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) { setIsPlaying(null); return; }
    }
    setIsPlaying(id);
    try {
      const cleanText = textToPlay.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      const base64Audio = await generateDiaryAudio(cleanText);
      if (!base64Audio) { setIsPlaying(null); return; }
      const bytes = decode(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { setIsPlaying(null); }
  };

  const getGrade = (score: number) => {
    const s = Math.round(score || 0);
    if (s >= 90) return { label: 'S', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    if (s >= 80) return { label: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (s >= 70) return { label: 'B', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    return { label: 'C', color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  if (!evaluation) return null;

  const failedGems = (evaluation.recommendedGems || []).filter(gem => !gem.meaning || !gem.usage);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
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

      <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden mb-12 flex-1 flex flex-col min-h-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10 overflow-y-auto flex-1 pr-4 -mr-4">
          {/* Detailed Content Column */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 relative group">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">源文物对照 SOURCE ARTIFACT</h4>
                <button onClick={() => handlePlayAudio(evaluation.sourceText || "", 'source')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'source' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}>{isPlaying === 'source' ? '⏹' : '🎧'}</button>
              </div>
              <p className="text-base md:text-lg text-slate-400 leading-[1.8] serif-font italic opacity-60">“ {renderRuby(evaluation.sourceText || "")} ”</p>
            </div>

            <div className="bg-white/10 p-8 md:p-12 rounded-[3rem] border border-white/10 shadow-inner relative group flex-1">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">复述打磨记录 RESTORED VERSION</h4>
                <div className="flex items-center space-x-4">
                  <div className="flex bg-white/5 p-1 rounded-xl">
                    <button onClick={() => setViewMode('diff')} className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'diff' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>对比</button>
                    <button onClick={() => setViewMode('final')} className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'final' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>最终</button>
                  </div>
                  <button onClick={() => handlePlayAudio(evaluation.suggestedVersion || "", 'suggested')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'suggested' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}>{isPlaying === 'suggested' ? '⏹' : '🎧'}</button>
                </div>
              </div>
              <div className="italic min-h-[150px]">
                {viewMode === 'diff' ? renderDiffText(evaluation.diffedRetelling) : <p className="text-lg md:text-xl leading-[2.5] text-slate-100 serif-font italic">{renderRuby(evaluation.suggestedVersion)}</p>}
              </div>
              
              {evaluation.recommendedGems && evaluation.recommendedGems.length > 0 && !isGemModalOpen && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-4">入馆推荐 RECOMMENDED GEMS</h4>
                  <button 
                    onClick={() => {
                      setIsGemModalOpen(true);
                      const allGemWords = new Set(evaluation.recommendedGems.map(g => g.word));
                      setSelectedGemsInModal(allGemWords);
                    }}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold py-3 rounded-2xl transition-all shadow-lg"
                  >
                    查看建议表达 ({evaluation.recommendedGems.length})
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stats Column */}
          <div className="lg:col-span-4 space-y-8">
            {failedGems.length > 0 && onRetryFailed && (
              <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                <p className="text-xs text-rose-300 mb-3">有 {failedGems.length} 个词条评估失败，可尝试重新处理。</p>
                <button 
                  onClick={() => onRetryFailed(failedGems)}
                  className="w-full bg-rose-400/20 hover:bg-rose-400/40 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors"
                >
                  重新评估失败项
                </button>
              </div>
            )}            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center flex flex-col items-center">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-3">还原度 Accuracy</span>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black serif-font ${getGrade(evaluation.accuracyScore).bg} ${getGrade(evaluation.accuracyScore).color} border border-white/5`}>
                  {getGrade(evaluation.accuracyScore).label}
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-3 block">{Math.round(evaluation.accuracyScore)}/100</span>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center flex flex-col items-center">
                <span className="text-[8px] font-black text-slate-500 uppercase block mb-3">表现力 Quality</span>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black serif-font ${getGrade(evaluation.qualityScore).bg} ${getGrade(evaluation.qualityScore).color} border border-white/5`}>
                  {getGrade(evaluation.qualityScore).label}
                </div>
                <span className="text-[10px] font-bold text-slate-400 mt-3 block">{Math.round(evaluation.qualityScore)}/100</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">内容评价 CONTENT</h4>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed italic">{evaluation.contentFeedback || "暂无反馈"}</p>
              </div>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">语言评析 LANGUAGE</h4>
                <p className="text-xs md:text-sm text-slate-300 leading-relaxed italic">{evaluation.languageFeedback || "暂无评析"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isGemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
            <h3 className="text-xl font-black text-slate-900 serif-font mb-2">收藏建议表达</h3>
            <p className="text-xs text-slate-400 mb-6">请选择您希望加入珍宝馆的词汇：</p>
            
            <div className="flex-1 overflow-y-auto -mr-4 pr-4 space-y-3">
              {(evaluation.recommendedGems || []).map((gem, index) => (
                <label key={index} className={`flex items-start space-x-4 p-4 rounded-2xl cursor-pointer transition-all border ${selectedGemsInModal.has(gem.word) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}>
                  <input 
                    type="checkbox" 
                    checked={selectedGemsInModal.has(gem.word)}
                    onChange={() => {
                      setSelectedGemsInModal(prev => {
                        const next = new Set(prev);
                        if (next.has(gem.word)) next.delete(gem.word);
                        else next.add(gem.word);
                        return next;
                      });
                    }}
                    className="w-5 h-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500/50 mt-1"
                  />
                  <div className="flex-1">
                    <h5 className="font-bold text-slate-800">{gem.word}</h5>
                    <p className="text-xs text-slate-500">{gem.meaning}</p>
                    <p className="text-xs text-slate-400 italic mt-1">e.g., "{gem.usage}"</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-4">
              <button 
                onClick={() => setIsGemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest"
              >
                取消
              </button>
              <button 
                onClick={async () => {
                  const gemsToSave = (evaluation.recommendedGems || []).filter(g => selectedGemsInModal.has(g.word));
                  for (const gem of gemsToSave) {
                    await onSaveVocab({ word: gem.word, meaning: gem.meaning, usage: gem.usage, language, level: 'Intermediate', timestamp: Date.now() });
                    setSavedGems(prev => new Set(prev).add(gem.word));
                  }
                  setIsGemModalOpen(false);
                }}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all"
              >
                批量收藏 ({selectedGemsInModal.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RehearsalReport;
