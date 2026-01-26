
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction, AdvancedVocab } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; 
import { renderRuby, stripRuby } from '../utils/textHelpers';

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations: DiaryIteration[]; 
  onSave: () => void;
  onBack: () => void;
  onSaveManualVocab?: (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => void;
  isExistingEntry?: boolean; // New prop to identify context
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations, onSave, onBack, onSaveManualVocab, isExistingEntry }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'corrections' | 'vocab' | 'transitions' | 'history'>('overall');
  const [isPlaying, setIsPlaying] = useState<string | null>(null); 
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const allAnalyses = [
    ...(iterations || []).map(iter => ({ timestamp: iter.timestamp, analysis: iter.analysis, text: iter.text })),
    { timestamp: Date.now(), analysis: analysis, text: analysis.modifiedText }, 
  ].sort((a, b) => a.timestamp - b.timestamp);

  const renderDiffText = (diff: string) => {
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-100 text-emerald-900 px-1 border-b-2 border-emerald-400 font-bold mx-0.5 inline">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="bg-rose-50 text-rose-300 line-through px-1 mx-0.5 inline">$1</span>');
    return <span className="leading-[3rem]" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay || isAudioLoading) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) {
        setIsPlaying(null);
        return;
      }
    }
    
    setIsPlaying(id);
    setIsAudioLoading(true);
    try {
      const cleanText = stripRuby(textToPlay);
      const base64Audio = await generateDiaryAudio(cleanText);
      setIsAudioLoading(false);

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
      setIsAudioLoading(false);
      setIsPlaying(null);
    }
  };

  const handleManualSave = (id: string, vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => {
    if (savedIds.has(id)) return;
    onSaveManualVocab?.(vocab);
    setSavedIds(prev => new Set(prev).add(id));
  };

  const getCategoryColor = (category: Correction['category']) => {
    switch (category) {
      case 'Grammar': return 'bg-blue-100 text-blue-700';
      case 'Vocabulary': return 'bg-purple-100 text-purple-700';
      case 'Style': return 'bg-amber-100 text-amber-700';
      case 'Spelling': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative pb-10 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-2 md:px-0 gap-4">
        <div className="flex-1">
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回收藏馆 BACK TO EXHIBITS
          </button>
          <div className="flex items-center justify-between md:block">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 serif-font tracking-tight">AI 审阅报告 <span className="text-indigo-600">AI Review</span></h2>
            
            {!isExistingEntry && (
              <button
                onClick={onSave}
                className="md:hidden bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg active:scale-95 transition-all"
              >
                存入收藏 EXHIBIT
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100">
          <span className="text-slate-900">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span className="text-slate-200">|</span>
          <span className="text-indigo-600">{language}</span>
        </div>
      </header>

      <nav className="flex items-center space-x-2 border-b border-slate-100 mb-8 px-2 md:px-0 overflow-x-auto no-scrollbar pb-3 shrink-0">
        {[
          { id: 'overall', label: '文稿修订', icon: '🖋️' },
          { id: 'corrections', label: '衔接逻辑', icon: '🔗' },
          { id: 'vocab', label: '表达进阶', icon: '💎' },
          { id: 'history', label: '迭代历史', icon: '🔄' },
        ].filter(t => t.id !== 'history' || iterations.length > 0).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 p-2 md:p-0">
        {activeTab === 'overall' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white p-6 md:p-14 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
              <header className="flex items-center justify-between mb-10 border-b border-slate-50 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Original Manuscript Diff</h3>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3 text-[9px] font-bold">
                    <div className="flex items-center space-x-1.5"><span className="w-3 h-3 bg-rose-50 border border-rose-100 rounded"></span> <span className="text-slate-400">删除</span></div>
                    <div className="flex items-center space-x-1.5"><span className="w-3 h-3 bg-emerald-100 border border-emerald-200 rounded"></span> <span className="text-slate-400">修正</span></div>
                  </div>
                  <button
                    onClick={() => handlePlayAudio(analysis.modifiedText, 'modifiedText')}
                    disabled={isAudioLoading && isPlaying === 'modifiedText'}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'modifiedText' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                  >
                    {isAudioLoading && isPlaying === 'modifiedText' ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : isPlaying === 'modifiedText' ? '⏹' : '🎧'}
                  </button>
                </div>
              </header>

              <div className="manuscript-grid relative">
                <p className="text-xl md:text-2xl text-slate-800 leading-[3rem] serif-font selection:bg-indigo-100">
                  {renderDiffText(analysis.diffedText)}
                </p>
              </div>

              <div className="mt-12 pt-6 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                <span>Museum Archive Digitized</span>
                <span>Ref: AI-CURATOR-{allAnalyses.length}</span>
              </div>
            </div>

            <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100 shadow-sm">
              <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center space-x-2">
                <span>💡</span>
                <span>馆长点评 Curator's Feedback</span>
              </h3>
              <p className="text-indigo-800/80 text-base md:text-lg leading-relaxed serif-font italic">
                “ {analysis.overallFeedback} ”
              </p>
            </div>
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {analysis.corrections.map((c, index) => {
              const sid = `correction-${index}`;
              const isSaved = savedIds.has(sid);
              const isItemPlaying = isPlaying === `improved-${index}`;
              const isItemLoading = isAudioLoading && isItemPlaying;

              return (
                <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all relative group/card">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getCategoryColor(c.category)}`}>
                      {c.category}
                    </span>
                    <div className="flex items-center space-x-1">
                       <button 
                         onClick={() => handleManualSave(sid, { word: c.improved, meaning: c.explanation, usage: analysis.modifiedText, level: 'Intermediate', language: language })}
                         className={`text-lg p-2 rounded-full transition-all opacity-0 group-hover/card:opacity-100 ${isSaved ? 'text-amber-500 bg-amber-50 opacity-100' : 'text-slate-200 hover:text-indigo-600 hover:bg-slate-50'}`}
                         title={isSaved ? "已入珍宝阁" : "加入珍宝阁"}
                       >
                         💎
                       </button>
                       <button 
                         onClick={() => handlePlayAudio(c.improved, `improved-${index}`)} 
                         disabled={isItemLoading}
                         className={`p-2 rounded-xl transition-all ${isItemPlaying ? 'bg-indigo-50 text-indigo-600' : 'text-indigo-400 hover:bg-indigo-50'}`}
                       >
                         {isItemLoading ? (
                           <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                         ) : isItemPlaying ? '⏹' : '🎧'}
                       </button>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    <p className="text-slate-400 line-through text-base serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(c.original) }}></p>
                    <p className="text-slate-900 font-bold text-lg serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(c.improved) }}></p>
                  </div>
                  <p className="text-slate-500 text-xs italic border-t border-slate-50 pt-3">{c.explanation}</p>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {analysis.advancedVocab.map((v, index) => {
              const isItemPlaying = isPlaying === `vocab-audio-${index}`;
              const isItemLoading = isAudioLoading && isItemPlaying;

              return (
                <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-indigo-200 transition-colors flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-black text-slate-900 serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(v.word) }}></h4>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">{v.level}</span>
                  </div>
                  <p className="text-slate-600 text-xs mb-4 flex-1">{v.meaning}</p>
                  <div className="bg-slate-50 p-4 rounded-xl relative group">
                     <p className="text-[11px] text-slate-500 italic serif-font" dangerouslySetInnerHTML={{ __html: `“ ${renderRuby(v.usage)} ”` }}></p>
                     <button 
                       onClick={() => handlePlayAudio(v.usage, `vocab-audio-${index}`)} 
                       disabled={isItemLoading}
                       className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${isItemPlaying ? 'bg-indigo-100 text-indigo-600 opacity-100' : 'text-indigo-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50'}`}
                     >
                       {isItemLoading ? (
                         <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                       ) : isItemPlaying ? '⏹' : '🎧'}
                     </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {allAnalyses.map((item, index) => (
              <div key={index} className="relative">
                <div className="absolute left-8 -top-4 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl z-10">
                  Exhibit Iteration {index + 1}
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-lg opacity-90 hover:opacity-100 transition-opacity">
                  <div className="flex justify-end mb-6 text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <p className="text-lg md:text-xl text-slate-700 leading-[2.8] serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(item.text) }}>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isExistingEntry && (
        <footer className="hidden md:flex mt-12 justify-end shrink-0 px-2 md:px-0">
          <button
            onClick={onSave}
            className="bg-slate-900 text-white px-10 py-4 rounded-2xl text-base font-black shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 flex items-center space-x-3"
          >
            <span>🏛️ 存入收藏馆 Exhibit</span>
            <span className="text-xl">→</span>
          </button>
        </footer>
      )}
    </div>
  );
};

export default Review;
