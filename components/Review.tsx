
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction, AdvancedVocab } from '../types';
import { playSmartSpeech } from '../services/audioService';
import { renderRuby, stripRuby, weaveRuby } from '../utils/textHelpers';

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations: DiaryIteration[]; 
  allAdvancedVocab?: AdvancedVocab[];
  onSave: () => void;
  onBack: () => void;
  onSaveManualVocab?: (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => void;
  isExistingEntry?: boolean;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations, allAdvancedVocab, onSave, onBack, onSaveManualVocab, isExistingEntry }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'corrections' | 'vocab' | 'history'>('overall');
  const [viewMode, setViewMode] = useState<'diff' | 'final'>('diff');
  const [isPlaying, setIsPlaying] = useState<string | null>(null); 
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showFurigana, setShowFurigana] = useState(language === 'Japanese');
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const renderTextContent = () => {
    if (viewMode === 'final') {
      const text = weaveRuby(analysis.modifiedText, analysis.readingPairs || [], language);
      return <span className="leading-[3.5rem] text-slate-900" dangerouslySetInnerHTML={{ __html: text }} />;
    }

    let processed = analysis.diffedText;
    
    if (showFurigana && language === 'Japanese' && analysis.readingPairs) {
      const parts = processed.split(/(<add>.*?<\/add>|<rem>.*?<\/rem>)/g);
      processed = parts.map(part => {
        if (part.startsWith('<add>')) {
          const inner = part.replace(/<\/?add>/g, '');
          return `<add>${weaveRuby(inner, analysis.readingPairs || [], language)}</add>`;
        } else if (part.startsWith('<rem>')) {
          const inner = part.replace(/<\/?rem>/g, '');
          return `<rem>${weaveRuby(inner, analysis.readingPairs || [], language)}</rem>`;
        }
        return weaveRuby(part, analysis.readingPairs || [], language);
      }).join('');
    } else {
      processed = processed.replace(/\[(.*?)\]\((.*?)\)/g, '$1');
    }

    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="diff-add">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="diff-rem">$1</span>');
      
    return <span className="leading-[3.5rem]" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay || isAudioLoading) return;
    
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) { setIsPlaying(null); return; }
    }

    const cleanText = stripRuby(textToPlay);
    const source = await playSmartSpeech(
      cleanText,
      language,
      id,
      () => {
        setIsPlaying(id);
        setIsAudioLoading(true);
      },
      () => {
        setIsPlaying(null);
        setIsAudioLoading(false);
      },
      true 
    );

    if (source) {
      audioSourceRef.current = source as AudioBufferSourceNode;
    }
  };

  const findParentForVocab = (word: string) => {
    if (!allAdvancedVocab) return null;
    const cleanWord = stripRuby(word).toLowerCase().trim();
    return allAdvancedVocab.find(v => {
      if (v.language !== language) return false;
      const cleanExisting = stripRuby(v.word).toLowerCase().trim();
      // Simple "semantic overlap" logic: if one is a substring of another
      return cleanWord.includes(cleanExisting) && cleanWord !== cleanExisting;
    });
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
          <div className="bg-slate-100 p-1 rounded-xl flex items-center shadow-inner">
            <button 
              onClick={() => setViewMode('diff')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'diff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              修改对比
            </button>
            <button 
              onClick={() => setViewMode('final')}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'final' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              定稿全文
            </button>
          </div>
          {language === 'Japanese' && (
            <button 
              onClick={() => setShowFurigana(!showFurigana)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all ${showFurigana ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-100 text-slate-400'}`}
            >
              <span>{showFurigana ? 'あ ON' : 'あ OFF'}</span>
            </button>
          )}
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
                <div className="flex items-center space-x-4">
                  <div className="w-1 h-6 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">
                    {viewMode === 'diff' ? 'MANUSCRIPT DIFF' : 'FINAL ARTIFACT'}
                  </h3>
                  {viewMode === 'diff' && (
                    <div className="flex items-center space-x-3 ml-2">
                       <div className="flex items-center space-x-1">
                          <span className="w-3 h-3 bg-red-100 border border-red-200 rounded"></span>
                          <span className="text-[8px] font-black text-slate-400">删除</span>
                       </div>
                       <div className="flex items-center space-x-1">
                          <span className="w-3 h-3 bg-green-100 border border-green-200 rounded"></span>
                          <span className="text-[8px] font-black text-slate-400">修正</span>
                       </div>
                    </div>
                  )}
                </div>
                <button onClick={() => handlePlayAudio(analysis.modifiedText, 'modifiedText')} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying === 'modifiedText' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                  {isAudioLoading && isPlaying === 'modifiedText' ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : isPlaying === 'modifiedText' ? '⏹' : '🎧'}
                </button>
              </header>
              <div className="manuscript-grid relative">
                <p className="text-xl md:text-2xl text-slate-800 leading-[3.5rem] serif-font">
                  {renderTextContent()}
                </p>
              </div>
            </div>
            <div className="bg-indigo-50/50 p-8 rounded-[2rem] border border-indigo-100 max-h-96 overflow-y-auto">
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
                  <button onClick={() => setSavedIds(prev => new Set(prev).add(`corr-${index}`))} className={`text-lg transition-all ${savedIds.has(`corr-${index}`) ? 'text-amber-500' : 'text-slate-200 hover:text-indigo-600'}`}>💎</button>
                </div>
                <div className="space-y-3 mb-4">
                  <p className="text-slate-400 line-through text-base serif-font" dangerouslySetInnerHTML={{ __html: weaveRuby(c.original, analysis.readingPairs || [], language) }}></p>
                  <p className="text-slate-900 font-bold text-lg serif-font" dangerouslySetInnerHTML={{ __html: weaveRuby(c.improved, analysis.readingPairs || [], language) }}></p>
                </div>
                <p className="text-slate-500 text-xs italic border-t border-slate-50 pt-3">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {analysis.advancedVocab.map((v, index) => {
              const parent = findParentForVocab(v.word);
              return (
                <div key={index} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full relative group">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-black text-slate-900 serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(v.word) }}></h4>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">{v.level}</span>
                  </div>
                  <p className="text-slate-600 text-xs mb-4 flex-1">{stripRuby(v.meaning)}</p>
                  
                  {parent && (
                    <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center">
                        <span className="mr-1">✨</span> 智能关联 SMART LINK
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium leading-relaxed">
                        该短语建议作为「<span className="font-bold">{stripRuby(parent.word)}</span>」的进阶用法存入。
                      </p>
                    </div>
                  )}

                  <div className="bg-slate-50 p-4 rounded-xl">
                     <p className="text-[11px] text-slate-500 italic serif-font" dangerouslySetInnerHTML={{ __html: `“ ${renderRuby(v.usage)} ”` }}></p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
