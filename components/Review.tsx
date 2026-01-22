
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; 
import { renderRuby, stripRuby } from '../utils/textHelpers'; // Import renderRuby and stripRuby

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations: DiaryIteration[]; // All iterations for the current entry, in chronological order
  onSave: () => void;
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations, onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'corrections' | 'vocab' | 'transitions' | 'history'>('overall');
  const [isPlaying, setIsPlaying] = useState<string | null>(null); // State for tracking which audio is playing
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Combine initial analysis and iterations, ensuring the latest is always the main one
  const allAnalyses = [
    ...(iterations || []).map(iter => ({ timestamp: iter.timestamp, analysis: iter.analysis, text: iter.text })),
    { timestamp: Date.now(), analysis: analysis, text: analysis.modifiedText }, // Current analysis, using client timestamp for ordering
  ].sort((a, b) => a.timestamp - b.timestamp);

  const renderDiffText = (diff: string) => {
    // Replace <add> and <rem> tags with styled spans
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-500/20 text-emerald-800 px-1 rounded-md border-b-2 border-emerald-400/30 font-bold mx-0.5 shadow-sm">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="text-slate-500 line-through px-1 opacity-60">$1</span>');
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) { // If clicking the same button, stop playback
        setIsPlaying(null);
        return;
      }
    }
    
    setIsPlaying(id);
    try {
      const cleanText = stripRuby(textToPlay); // Use stripRuby from utils
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
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">AI 审阅报告 AI Review Report</h2>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
          <span>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
          <span className="text-slate-200">|</span>
          <span className="text-indigo-600">{language}</span>
        </div>
      </header>

      <nav className="flex items-center space-x-2 border-b border-slate-100 mb-8 px-2 md:px-0 overflow-x-auto no-scrollbar pb-2 shrink-0">
        <button onClick={() => setActiveTab('overall')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'overall' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          🏛️ 概览 Overall
        </button>
        <button onClick={() => setActiveTab('corrections')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'corrections' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          ✍️ 修正 Corrections
        </button>
        <button onClick={() => setActiveTab('vocab')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'vocab' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          💎 词汇 Vocab
        </button>
        <button onClick={() => setActiveTab('transitions')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'transitions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
          🔗 转场 Transition
        </button>
        {iterations.length > 0 && (
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            🔄 迭代历史 Iterations
          </button>
        )}
      </nav>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 p-2 md:p-0">
        {/* Overall View */}
        {activeTab === 'overall' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl relative group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[4rem] opacity-30 -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-xl font-black text-slate-900 serif-font">修正后的日记 Modified Diary</h3>
                <button
                  onClick={() => handlePlayAudio(analysis.modifiedText, 'modifiedText')}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying === 'modifiedText' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                  title="收听修正后的日记"
                >
                  {isPlaying === 'modifiedText' ? '⏹' : '🎧'}
                </button>
              </div>
              <p className="text-lg md:text-2xl text-slate-700 leading-[2.2] serif-font">
                {renderRuby(analysis.modifiedText)}
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-xl font-black text-slate-900 serif-font mb-6">修改对比 Diff Comparison</h3>
              <p className="text-lg md:text-2xl text-slate-700 leading-[2.2] serif-font">
                {renderDiffText(analysis.diffedText)}
              </p>
            </div>

            <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-200 shadow-xl">
              <h3 className="text-xl font-black text-indigo-800 serif-font mb-6">AI 总结反馈 AI Summary Feedback</h3>
              <p className="text-slate-700 text-base leading-relaxed italic">
                {analysis.overallFeedback}
              </p>
            </div>
          </div>
        )}

        {/* Corrections View */}
        {activeTab === 'corrections' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {analysis.corrections.length > 0 ? (
              analysis.corrections.map((c, index) => (
                <div key={index} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-md">
                  <div className="flex items-center space-x-3 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryColor(c.category)}`}>
                      {c.category}
                    </span>
                    <h4 className="text-xl font-bold text-slate-800 serif-font">
                      {renderRuby(c.original)}
                    </h4>
                    <span className="text-lg text-slate-400">→</span>
                    <h4 className="text-xl font-bold text-emerald-600 serif-font">
                      {renderRuby(c.improved)}
                    </h4>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed italic">
                    {c.explanation}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 text-lg italic">暂无修正建议，干得漂亮！</div>
            )}
          </div>
        )}

        {/* Advanced Vocab View */}
        {activeTab === 'vocab' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {analysis.advancedVocab.length > 0 ? (
              analysis.advancedVocab.map((v, index) => (
                <div key={index} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-md relative group">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-2xl font-black text-slate-900 serif-font">
                      {renderRuby(v.word)}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700`}>
                        {v.level}
                      </span>
                      <button
                        onClick={() => handlePlayAudio(v.word, `vocab-word-${index}`)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlaying === `vocab-word-${index}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                        title="收听单词发音"
                      >
                        {isPlaying === `vocab-word-${index}` ? '⏹' : '🎧'}
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-600 text-base italic leading-relaxed mb-4">
                    {v.meaning}
                  </p>
                  <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
                    <button
                      onClick={() => handlePlayAudio(v.usage, `vocab-usage-${index}`)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlaying === `vocab-usage-${index}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                      title="收听例句发音"
                    >
                      {isPlaying === `vocab-usage-${index}` ? '⏹' : '🎧'}
                    </button>
                    <p className="flex-1">“ {renderRuby(v.usage)} ”</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 text-lg italic">没有发现新的进阶词汇珍宝。</div>
            )}
          </div>
        )}

        {/* Transition Suggestions View */}
        {activeTab === 'transitions' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {analysis.transitionSuggestions.length > 0 ? (
              analysis.transitionSuggestions.map((t, index) => (
                <div key={index} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-md">
                  <div className="flex items-center space-x-3 mb-4">
                    <h4 className="text-2xl font-black text-slate-900 serif-font">
                      {renderRuby(t.word)}
                    </h4>
                    <button
                      onClick={() => handlePlayAudio(t.word, `transition-word-${index}`)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isPlaying === `transition-word-${index}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}
                      title="收听转场词发音"
                    >
                      {isPlaying === `transition-word-${index}` ? '⏹' : '🎧'}
                    </button>
                  </div>
                  <p className="text-slate-600 text-base italic leading-relaxed mb-4">
                    {t.explanation}
                  </p>
                  <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
                    <button
                      onClick={() => handlePlayAudio(t.example, `transition-example-${index}`)}
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${isPlaying === `transition-example-${index}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                      title="收听例句发音"
                    >
                      {isPlaying === `transition-example-${index}` ? '⏹' : '🎧'}
                    </button>
                    <p className="flex-1">“ {renderRuby(t.example)} ”</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 text-lg italic">暂无转场词建议。</div>
            )}
          </div>
        )}

        {/* Iteration History View */}
        {activeTab === 'history' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {allAnalyses.length > 0 ? (
              allAnalyses.map((item, index) => (
                <div key={index} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl relative">
                  <span className="absolute top-6 left-8 px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-slate-200">
                    Iteration {index + 1}
                  </span>
                  <div className="flex items-center justify-end mb-4">
                     <span className="text-[10px] text-slate-400 font-medium">
                       {new Date(item.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                     </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 serif-font mb-4">
                    日记文本 Diary Text
                  </h3>
                  <p className="text-lg md:text-xl text-slate-700 leading-[2.2] serif-font mb-6">
                    {renderRuby(item.text)}
                  </p>

                  <h3 className="text-xl font-black text-slate-900 serif-font mb-4">
                    AI 总结反馈 AI Summary Feedback
                  </h3>
                  <p className="text-slate-700 text-base leading-relaxed italic">
                    {item.analysis?.overallFeedback || "无总结反馈。"}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-16 text-center text-slate-400 text-lg italic">此日记暂无迭代历史。</div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-8 flex justify-end shrink-0 px-2 md:px-0">
        <button
          onClick={onSave}
          className="bg-indigo-600 text-white px-8 py-4 rounded-3xl text-lg font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
        >
          🏛️ 存入收藏馆 Exhibit
        </button>
      </footer>
    </div>
  );
};

export default Review;