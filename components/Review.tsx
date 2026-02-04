
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction, AdvancedVocab } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; 
import { renderRuby, stripRuby, weaveRuby } from '../utils/textHelpers';

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations: DiaryIteration[]; 
  onSave: () => void;
  onBack: () => void;
  onSaveManualVocab?: (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => void;
  isExistingEntry?: boolean;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations, onSave, onBack, onSaveManualVocab, isExistingEntry }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'corrections' | 'vocab' | 'history'>('overall');
  const [isPlaying, setIsPlaying] = useState<string | null>(null); 
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showFurigana, setShowFurigana] = useState(language === 'Japanese');
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const allAnalyses = [
    ...(iterations || []).map(iter => ({ timestamp: iter.timestamp, analysis: iter.analysis, text: iter.text })),
    { timestamp: Date.now(), analysis: analysis, text: analysis.modifiedText }, 
  ].sort((a, b) => a.timestamp - b.timestamp);

  const renderDiffText = (diff: string) => {
    let processed = diff;
    
    if (showFurigana && language === 'Japanese' && analysis.readingPairs) {
      const parts = diff.split(/(<add>.*?<\/add>|<rem>.*?<\/rem>)/g);
      processed = parts.map(part => {
        if (part.startsWith('<add>')) {
          const inner = part.replace(/<\/?add>/g, '');
          return `<add>${weaveRuby(inner, analysis.readingPairs, language)}</add>`;
        } else if (part.startsWith('<rem>')) {
          const inner = part.replace(/<\/?rem>/g, '');
          return `<rem>${weaveRuby(inner, analysis.readingPairs, language)}</rem>`;
        }
        return weaveRuby(part, analysis.readingPairs, language);
      }).join('');
    } else {
      processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '$1');
    }

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
      if (isPlaying === id) { setIsPlaying(null); return; }
    }
    setIsPlaying(id);
    setIsAudioLoading(true);
    try {
      const cleanText = stripRuby(textToPlay);
      const base64Audio = await generateDiaryAudio(cleanText);
      setIsAudioLoading(false);
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
    } catch (e) {
      setIsAudioLoading(false);
      setIsPlaying(null);
    }
  };

  const handleManualSave = (id: string, vocab: Omit<AdvancedVocab, 'id' | 'mastery'>) => {
    if (savedIds.has(id)) return;
    onSaveManualVocab?.(vocab);
    setSavedIds(prev => new Set(prev).add(id));
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative pb-10 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-2 md:px-0 gap-4">
        <div className="flex-1">
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回收藏馆 BACK
          </button>
          <div className="flex items-center justify-between md:block">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 serif-font tracking-tight">AI 审阅报告 <span className="text-indigo-600">AI Review</span></h2>
            {!isExistingEntry && (
              <button onClick={onSave} className="md:hidden bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black shadow-lg active:scale-95 transition-all">存入收藏 EXHIBIT</button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {language === 'Japanese' && (
            <button 
              onClick={() => setShowFurigana(!showFurigana)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${showFurigana ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}
            >
              <span>{showFurigana ? 'あ ON' : 'あ OFF'}</span>
            </button>
          )}
          <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
            <span className="text-slate-900">{new Date().toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>
            <span className="text-slate-200">|</span>
            <span className="text-indigo-600">{language}</span>
          </div>
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
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'}`}
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
                <button onClick={() => handlePlayAudio(analysis.modifiedText, 'modifiedText')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'modifiedText' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {isPlaying === 'modifiedText' ? '⏹' : '🎧'}
                </button>
              </header>
              <div className="manuscript-grid relative">
                <p className="text-xl md:text-2xl text-slate-800 leading-[3rem] serif-font">
                  {renderDiffText(analysis.diffedText)}
                </p>
              </div>
            </div>
            <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100">
              <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center space-x-2"><span>💡</span><span>馆长点评</span></h3>
              <p className="text-indigo-800/80 text-base md:text-lg leading-relaxed serif-font italic">“ {analysis.overallFeedback} ”</p>
            </div>
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {analysis.corrections.map((c, index) => (
              <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative group/card">
                <div className="flex items-center justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${c.category === 'Grammar' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100'}`}>{c.category}</span>
                  <button onClick={() => handleManualSave(`corr-${index}`, { word: c.improved, meaning: c.explanation, usage: analysis.modifiedText, level: 'Intermediate', language, timestamp: Date.now() })} className={`text-lg transition-all ${savedIds.has(`corr-${index}`) ? 'text-amber-500' : 'text-slate-200 hover:text-indigo-600'}`}>💎</button>
                </div>
                <div className="space-y-3 mb-4">
                  <p className="text-slate-400 line-through text-base serif-font" dangerouslySetInnerHTML={{ __html: weaveRuby(c.original, analysis.readingPairs, language) }}></p>
                  <p className="text-slate-900 font-bold text-lg serif-font" dangerouslySetInnerHTML={{ __html: weaveRuby(c.improved, analysis.readingPairs, language) }}></p>
                </div>
                <p className="text-slate-500 text-xs italic border-t border-slate-50 pt-3">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {analysis.advancedVocab.map((v, index) => (
              <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xl font-black text-slate-900 serif-font" dangerouslySetInnerHTML={{ __html: weaveRuby(v.word, analysis.readingPairs, language) }}></h4>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">{v.level}</span>
                </div>
                <p className="text-slate-600 text-xs mb-4 flex-1">{v.meaning}</p>
                <div className="bg-slate-50 p-4 rounded-xl">
                   <p className="text-[11px] text-slate-500 italic serif-font" dangerouslySetInnerHTML={{ __html: `“ ${weaveRuby(v.usage, analysis.readingPairs, language)} ”` }}></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
