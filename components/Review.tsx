
import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction } from '../types';
import { generateDiaryAudio } from '../services/geminiService';

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations?: DiaryIteration[];
  onSave: () => void;
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations = [], onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<'artifact' | 'logic' | 'gems'>('artifact');
  const [currentAnalysis, setCurrentAnalysis] = useState<DiaryAnalysis>(analysis);
  const [selectedIdx, setSelectedIdx] = useState<number>(iterations.length);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    setCurrentAnalysis(analysis);
    setSelectedIdx(iterations.length);
  }, [analysis, iterations.length]);

  const handleVersionSelect = (idx: number) => {
    setSelectedIdx(idx);
    if (idx === iterations.length) {
      setCurrentAnalysis(analysis);
    } else {
      setCurrentAnalysis(iterations[idx].analysis);
    }
  };

  const handlePlayAudio = async (text: string, id: string = 'main') => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }
    setPlayingAudioId(id);
    try {
      const base64Audio = await generateDiaryAudio(text);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      audioBuffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768));
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { setPlayingAudioId(null); }
  };

  const renderDiffText = (diff: string) => {
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-[#dcfce7] text-[#166534] px-1 rounded-sm border-b-2 border-[#166534]/10 font-bold mx-0.5">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="bg-[#fee2e2] text-[#991b1b] line-through decoration-[#991b1b]/30 px-1 rounded-sm mx-0.5">$1</span>');
    return <div className="leading-[3] md:leading-[3.5] text-base md:text-2xl text-slate-700 serif-font text-justify" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const allVersions = [...iterations.map((it, i) => ({ ...it, label: `V${i + 1}` })), { timestamp: Date.now(), label: '最新' }];

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Grammar': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'Vocabulary': return 'bg-indigo-50 text-indigo-600 border-indigo-100';
      case 'Style': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Spelling': return 'bg-slate-50 text-slate-600 border-slate-100';
      default: return 'bg-slate-50 text-slate-400';
    }
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <header className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center justify-between mb-6 shrink-0">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center">← 返回编辑器</button>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">审阅报告 Artifact Review</h2>
        </div>
        <div className="flex items-center space-x-2">
           <button onClick={() => handlePlayAudio(currentAnalysis.modifiedText)} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${playingAudioId === 'main' ? 'bg-indigo-600 text-white animate-pulse shadow-lg shadow-indigo-200' : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm'}`}>
             {playingAudioId === 'main' ? '⏹' : '🎧'}
           </button>
           <button onClick={onSave} className="bg-slate-900 text-white px-5 md:px-8 py-2 md:py-3 rounded-xl md:rounded-2xl font-bold shadow-xl hover:bg-indigo-600 transition-all active:scale-95 text-sm md:text-base">🏛️ 保存修改</button>
        </div>
      </header>

      {/* 紧凑版进化时间轴 - 垂直高度大幅压缩 */}
      {iterations.length > 0 && (
        <div className="mb-6 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between space-x-8 overflow-x-auto no-scrollbar py-1">
             <div className="flex-shrink-0 text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center">
                轨迹 <span className="ml-2">→</span>
             </div>
             <div className="flex-1 flex items-center space-x-8 md:space-x-12 px-2">
               {allVersions.map((v, i) => (
                 <button
                   key={i}
                   onClick={() => handleVersionSelect(i)}
                   className={`relative flex flex-col items-center shrink-0 transition-all duration-300 ${selectedIdx === i ? 'scale-105' : 'opacity-50 hover:opacity-100'}`}
                 >
                   <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                     selectedIdx === i 
                       ? 'bg-indigo-600 border-indigo-100 text-white' 
                       : 'bg-white border-slate-100 text-slate-400'
                   }`}>
                     <span className="text-[9px] font-black">{i === allVersions.length - 1 ? '✨' : i + 1}</span>
                   </div>
                   <span className={`mt-1 text-[8px] font-black uppercase tracking-widest ${selectedIdx === i ? 'text-indigo-600' : 'text-slate-400'}`}>
                     {v.label}
                   </span>
                 </button>
               ))}
             </div>
          </div>
        </div>
      )}

      <div className="flex bg-white p-1 rounded-xl border border-slate-200 self-start mb-6 shrink-0">
        {[
          { id: 'artifact', label: '文稿修订', icon: '🖋️' },
          { id: 'logic', label: '衔接逻辑', icon: '🧠' },
          { id: 'gems', label: '表达进阶', icon: '💎' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activeTab === 'artifact' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            {/* 1. 正文对比纸张 - 移除 min-h 限制，允许自适应 */}
            <div className="bg-white p-6 md:p-10 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-start relative overflow-hidden group">
              <div className="w-full flex items-center justify-between mb-6 border-b border-slate-50 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-1 h-5 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[10px] font-black text-slate-800 tracking-widest uppercase">Manuscript: {selectedIdx === iterations.length ? 'Latest Artifact' : 'Iteration V'+(selectedIdx+1)}</h4>
                </div>
              </div>
              <div className="w-full max-w-4xl mx-auto py-2">
                {renderDiffText(currentAnalysis.diffedText)}
              </div>
            </div>

            {/* 2. 修正笔记列表 */}
            <div className="space-y-4">
               <div className="flex items-center space-x-2 px-2 mb-2">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">修正笔记 Curator's Annotations</h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentAnalysis.corrections.length > 0 ? currentAnalysis.corrections.map((corr, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all flex flex-col space-y-3">
                       <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${getCategoryColor(corr.category)}`}>
                             {corr.category}
                          </span>
                          <button 
                            onClick={() => handlePlayAudio(corr.improved, `corr-${idx}`)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === `corr-${idx}` ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-300'}`}
                          >
                            <span className="text-[8px]">🎧</span>
                          </button>
                       </div>
                       <div className="flex items-center space-x-2 text-xs md:text-sm serif-font">
                          <span className="text-rose-400 line-through opacity-70">{corr.original}</span>
                          <span className="text-slate-300">→</span>
                          <span className="text-emerald-600 font-bold">{corr.improved}</span>
                       </div>
                       <div className="pt-2 border-t border-slate-50">
                          <p className="text-[10px] md:text-xs text-slate-500 leading-relaxed italic">
                             <span className="font-bold text-slate-400 mr-1">WHY:</span> {corr.explanation}
                          </p>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-8 text-center bg-white/50 border border-dashed border-slate-200 rounded-2xl text-[10px] font-bold text-slate-400">
                       此版本无需特别修正。
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'logic' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentAnalysis.transitionSuggestions.map((s, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-bold text-indigo-900 serif-font">{s.word}</h4>
                    <button onClick={() => handlePlayAudio(s.word, `logic-${i}`)} className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === `logic-${i}` ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-400'}`}>🎧</button>
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-500 mb-3 italic leading-relaxed">{s.explanation}</p>
                  <div className="bg-indigo-50/50 p-3 rounded-xl italic text-[10px] md:text-xs text-indigo-700">“ {s.example} ”</div>
                </div>
              ))}
            </div>
            <div className="bg-indigo-50/40 p-6 rounded-[2rem] border border-indigo-100">
              <span className="text-[9px] font-black text-indigo-600 uppercase mb-2 block">Curator's Analysis</span>
              <p className="text-indigo-800 italic leading-relaxed text-xs md:text-sm serif-font">{currentAnalysis.overallFeedback}</p>
            </div>
          </div>
        )}

        {activeTab === 'gems' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-right-4 duration-500">
             {currentAnalysis.advancedVocab.map((v, i) => (
               <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group hover:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => handlePlayAudio(v.word, `vocab-${i}`)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-${i}` ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}>🎧</button>
                    <div className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">{v.level}</div>
                  </div>
                  <h4 className="text-xl font-black text-slate-900 serif-font mb-2 group-hover:text-indigo-600 transition-colors">{v.word}</h4>
                  <p className="text-[10px] md:text-xs text-slate-600 font-medium italic mb-4 leading-relaxed">{v.meaning}</p>
                  <div className="pt-4 border-t border-slate-50 text-[10px] text-slate-500 italic leading-relaxed">“ {v.usage} ”</div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
