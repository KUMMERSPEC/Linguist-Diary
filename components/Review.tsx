
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; 
import { renderRuby, stripRuby } from '../utils/textHelpers';

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations: DiaryIteration[]; 
  onSave: () => void;
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations, onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'corrections' | 'vocab' | 'transitions' | 'history'>('overall');
  const [isPlaying, setIsPlaying] = useState<string | null>(null); 
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const allAnalyses = [
    ...(iterations || []).map(iter => ({ timestamp: iter.timestamp, analysis: iter.analysis, text: iter.text })),
    { timestamp: Date.now(), analysis: analysis, text: analysis.modifiedText }, 
  ].sort((a, b) => a.timestamp - b.timestamp);

  const renderDiffText = (diff: string) => {
    // Replace <add> and <rem> tags with vibrant, styled spans matching the requested aesthetic
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt class="opacity-40">$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-lg border-b-2 border-emerald-400 font-bold mx-1 shadow-sm inline-block transition-transform hover:scale-105">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="bg-rose-50 text-rose-300 line-through px-2 py-0.5 rounded-lg mx-1 opacity-70 inline-block">$1</span>');
    return <span className="leading-[2.8]" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) {
        setIsPlaying(null);
        return;
      }
    }
    
    setIsPlaying(id);
    try {
      const cleanText = stripRuby(textToPlay);
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
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-2 md:px-0 gap-4">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回收藏馆 BACK TO EXHIBITS
          </button>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font tracking-tight">AI 审阅报告 <span className="text-indigo-600">AI Review</span></h2>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-slate-900">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span className="text-slate-200">|</span>
          <span className="text-indigo-600 font-black">{language}</span>
        </div>
      </header>

      <nav className="flex items-center space-x-3 border-b border-slate-100 mb-8 px-2 md:px-0 overflow-x-auto no-scrollbar pb-3 shrink-0">
        {[
          { id: 'overall', label: '文稿修订', icon: '🖋️' },
          { id: 'corrections', label: '修正细节', icon: '🧠' },
          { id: 'vocab', label: '词汇进阶', icon: '💎' },
          { id: 'transitions', label: '衔接逻辑', icon: '🔗' },
          { id: 'history', label: '迭代历史', icon: '🔄' },
        ].filter(t => t.id !== 'history' || iterations.length > 0).map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-105' 
                : 'bg-white text-slate-500 border border-slate-100 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 p-2 md:p-0">
        {/* Overall View: The Main Manuscript View */}
        {activeTab === 'overall' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* MANUSCRIPT CARD */}
            <div className="bg-white p-10 md:p-16 rounded-[3.5rem] border border-slate-100 shadow-2xl relative group overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600/10"></div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-bl-full opacity-30 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000"></div>
              
              <header className="flex items-center justify-between mb-12 relative z-10 border-b border-slate-50 pb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-1 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">Original Manuscript Diff</h3>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-4 text-[10px] font-bold">
                    <div className="flex items-center space-x-1"><span className="w-3 h-3 bg-rose-50 rounded"></span> <span className="text-slate-400">删除</span></div>
                    <div className="flex items-center space-x-1"><span className="w-3 h-3 bg-emerald-100 rounded"></span> <span className="text-slate-400">修正</span></div>
                  </div>
                  <button
                    onClick={() => handlePlayAudio(analysis.modifiedText, 'modifiedText')}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isPlaying === 'modifiedText' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-indigo-600 hover:text-white'}`}
                    title="收听修正后的文稿"
                  >
                    {isPlaying === 'modifiedText' ? '⏹' : '🎧'}
                  </button>
                </div>
              </header>

              <div className="relative z-10">
                <p className="text-2xl md:text-4xl text-slate-800 leading-[2.6] serif-font selection:bg-indigo-100">
                  {renderDiffText(analysis.diffedText)}
                </p>
              </div>

              <div className="mt-12 pt-8 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest">
                <span>Refined by Linguist AI Curator</span>
                <span>Archive No. {allAnalyses.length}</span>
              </div>
            </div>

            {/* AI FEEDBACK CARD */}
            <div className="bg-indigo-50/80 p-10 rounded-[3rem] border border-indigo-100 shadow-xl relative overflow-hidden group">
              <div className="absolute -right-10 -bottom-10 text-9xl text-indigo-100/50 serif-font italic select-none">Notes</div>
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-6 flex items-center space-x-2">
                <span className="text-xl">💡</span>
                <span>馆长点评 Curator's Feedback</span>
              </h3>
              <p className="text-indigo-800/80 text-lg md:text-xl leading-relaxed serif-font italic relative z-10">
                “ {analysis.overallFeedback} ”
              </p>
            </div>
          </div>
        )}

        {/* Corrections Detail View */}
        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {analysis.corrections.length > 0 ? (
              analysis.corrections.map((c, index) => (
                <div key={index} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl hover:shadow-2xl transition-all group">
                  <div className="flex items-center justify-between mb-6">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getCategoryColor(c.category)} shadow-sm`}>
                      {c.category}
                    </span>
                    <span className="text-slate-200 text-xs font-black">DET_0{index + 1}</span>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div className="p-4 bg-rose-50/50 rounded-2xl border-l-4 border-rose-200">
                      <p className="text-slate-400 line-through text-lg serif-font">{renderRuby(c.original)}</p>
                    </div>
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border-l-4 border-emerald-400 flex items-center justify-between">
                      <p className="text-emerald-900 font-bold text-xl serif-font">{renderRuby(c.improved)}</p>
                      <button onClick={() => handlePlayAudio(c.improved, `improved-${index}`)} className="text-emerald-400 hover:text-emerald-600">🎧</button>
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed italic border-t border-slate-50 pt-4">
                    {c.explanation}
                  </p>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center text-slate-300 text-xl serif-font italic">文稿完美无瑕，暂无修正建议。</div>
            )}
          </div>
        )}

        {/* Advanced Vocab View */}
        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            {analysis.advancedVocab.length > 0 ? (
              analysis.advancedVocab.map((v, index) => (
                <div key={index} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4">
                     <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest">{v.level}</span>
                  </div>
                  <h4 className="text-3xl font-black text-slate-900 serif-font mb-4 mt-2">
                    {renderRuby(v.word)}
                  </h4>
                  <p className="text-slate-600 text-sm italic mb-6 flex-1">{v.meaning}</p>
                  
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group-hover:bg-indigo-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Usage 例句</span>
                      <button onClick={() => handlePlayAudio(v.usage, `vocab-usage-${index}`)} className="text-indigo-400">🎧</button>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed serif-font italic">
                      “ {renderRuby(v.usage)} ”
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center text-slate-300 text-xl serif-font italic">未发现新的词汇珍宝。</div>
            )}
          </div>
        )}

        {/* Transition Suggestions View */}
        {activeTab === 'transitions' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {analysis.transitionSuggestions.length > 0 ? (
              analysis.transitionSuggestions.map((t, index) => (
                <div key={index} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl flex flex-col md:flex-row gap-8 items-center">
                   <div className="bg-indigo-600 text-white w-20 h-20 md:w-32 md:h-32 rounded-[2.5rem] flex items-center justify-center shrink-0 shadow-2xl shadow-indigo-100">
                      <span className="text-2xl md:text-4xl font-black serif-font">{renderRuby(t.word)}</span>
                   </div>
                   <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">逻辑衔接建议 Logic Transition</h4>
                        <button onClick={() => handlePlayAudio(t.word, `trans-word-${index}`)} className="text-indigo-600">🎧</button>
                      </div>
                      <p className="text-slate-700 text-lg leading-relaxed">{t.explanation}</p>
                      <div className="bg-slate-50 p-4 rounded-2xl border-l-4 border-indigo-400">
                        <p className="text-sm italic text-slate-600">“ {renderRuby(t.example)} ”</p>
                      </div>
                   </div>
                </div>
              ))
            ) : (
              <div className="py-24 text-center text-slate-300 text-xl serif-font italic">衔接逻辑自然流畅。</div>
            )}
          </div>
        )}

        {/* Iteration History View */}
        {activeTab === 'history' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            {allAnalyses.map((item, index) => (
              <div key={index} className="relative">
                <div className="absolute left-1/2 -top-6 -translate-x-1/2 bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl z-10">
                  Exhibit Iteration {index + 1}
                </div>
                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-xl opacity-80 scale-[0.98] grayscale-[0.5] hover:grayscale-0 hover:scale-100 hover:opacity-100 transition-all duration-700">
                  <div className="flex justify-end mb-8 text-[10px] font-black text-slate-300">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                  <p className="text-xl md:text-2xl text-slate-700 leading-[2.4] serif-font mb-8">
                    {renderRuby(item.text)}
                  </p>
                  <div className="border-t border-slate-50 pt-6">
                    <p className="text-sm text-slate-400 italic">“ {item.analysis?.overallFeedback} ”</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-12 flex justify-end shrink-0 px-2 md:px-0">
        <button
          onClick={onSave}
          className="bg-slate-900 text-white px-12 py-5 rounded-[2.5rem] text-xl font-black shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-[0.98] flex items-center space-x-4"
        >
          <span>🏛️ 存入收藏馆 Exhibit</span>
          <span className="text-2xl">→</span>
        </button>
      </footer>
    </div>
  );
};

export default Review;
