import React, { useState, useRef, useEffect } from 'react';
import { DiaryAnalysis, DiaryIteration, Correction } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers'; // Import new helpers

interface ReviewProps {
  analysis: DiaryAnalysis;
  language: string;
  iterations?: DiaryIteration[];
  onSave: () => void;
  onBack: () => void;
}

const Review: React.FC<ReviewProps> = ({ analysis, language, iterations = [], onSave, onBack }) => {
  const [activeTab, setActiveTab] = useState<'artifact' | 'logic' | 'gems'>('artifact');
  const [viewMode, setViewMode] = useState<'diff' | 'original' | 'final'>('diff');
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
    } else if (iterations[idx]) {
      setCurrentAnalysis(iterations[idx].analysis);
    }
  };

  const handlePlayAudio = async (text: string, id: string = 'main') => {
    if (!text) return;

    // Stop current audio if playing and it's the same ID or trying to play new audio
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (playingAudioId === id) { // Toggling off the current audio
        setPlayingAudioId(null);
        return;
      }
    }
    
    setPlayingAudioId(id);
    try {
      const base64Audio = await generateDiaryAudio(text);
      if (!base64Audio) {
        setPlayingAudioId(null);
        return;
      }
      
      const bytes = decode(base64Audio);
      if (bytes.length === 0) {
        setPlayingAudioId(null);
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { 
      console.error("Error playing audio:", e);
      setPlayingAudioId(null); 
    }
  };

  const renderDiffText = (diff?: string) => {
    if (!diff || typeof diff !== 'string') return null;
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-50 text-emerald-700 px-1 rounded-md border-b-2 border-emerald-500/30 font-bold mx-0.5 shadow-sm">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="bg-rose-50 text-rose-500 line-through decoration-rose-500/40 px-1 rounded-md mx-0.5 opacity-80">$1</span>');
    return <div className="leading-[2.5] md:leading-[3.2] text-lg md:text-2xl text-slate-800 serif-font text-justify" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const renderCleanText = (text?: string) => {
    if (!text || typeof text !== 'string') return null;
    let processed = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <div className="leading-[2.5] md:leading-[3.2] text-lg md:text-2xl text-slate-800 serif-font text-justify" dangerouslySetInnerHTML={{ __html: processed }} />;
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
      <header className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:items-center justify-between mb-8 shrink-0">
        <div>
          <button onClick={onBack} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回工作室 BACK TO STUDIO
          </button>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">文物修复报告 Restoration Report</h2>
        </div>
        <div className="flex items-center space-x-3">
           <button 
             onClick={() => handlePlayAudio(currentAnalysis?.modifiedText || '')} 
             className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${playingAudioId === 'main' ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 shadow-sm hover:border-indigo-100'}`}
             title="收听修复后的版本"
           >
             {playingAudioId === 'main' ? '⏹' : '🎧'}
           </button>
           <button onClick={onSave} className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-bold shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 text-sm md:text-base border border-slate-800">
             🏛️ 入馆存藏 EXHIBIT
           </button>
        </div>
      </header>

      {/* 进化轨迹时间轴 */}
      {iterations.length > 0 && (
        <div className="mb-8 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-6 overflow-x-auto no-scrollbar">
           <div className="flex-shrink-0 flex items-center space-x-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest border-r border-slate-100 pr-6">
              <span>Restoration Path</span>
              <span className="animate-pulse">→</span>
           </div>
           <div className="flex items-center space-x-6 md:space-x-10 px-2">
             {allVersions.map((v, i) => (
               <button
                 key={i}
                 onClick={() => handleVersionSelect(i)}
                 className={`relative flex flex-col items-center shrink-0 transition-all duration-300 ${selectedIdx === i ? 'scale-110' : 'opacity-40 hover:opacity-100'}`}
               >
                 <div className={`w-9 h-9 md:w-10 md:h-10 rounded-2xl flex items-center justify-center border-2 transition-all ${
                   selectedIdx === i 
                     ? 'bg-indigo-600 border-indigo-100 text-white shadow-lg' 
                     : 'bg-white border-slate-100 text-slate-400'
                 }`}>
                   <span className="text-[10px] font-black">{i === allVersions.length - 1 ? '✦' : i + 1}</span>
                 </div>
                 <span className={`mt-1.5 text-[8px] font-black uppercase tracking-widest ${selectedIdx === i ? 'text-indigo-600' : 'text-slate-400'}`}>
                   {v.label}
                 </span>
               </button>
             ))}
           </div>
        </div>
      )}

      {/* 选项卡导航 */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 self-start mb-8 shrink-0 shadow-sm">
        {[
          { id: 'artifact', label: '原稿修正', icon: '🖋️' },
          { id: 'logic', label: '馆长评注', icon: '🧠' },
          { id: 'gems', label: '辞藻进阶', icon: '💎' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-2.5 rounded-xl text-[11px] md:text-xs font-bold transition-all flex items-center space-x-2.5 ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activeTab === 'artifact' && (
          <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
            {/* 核心修正展示区 */}
            <div className="bg-white p-8 md:p-14 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              {/* 背景装饰：网格线 */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                    <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">Manuscript Restoration: {selectedIdx === iterations.length ? 'Latest Artifact' : 'Iteration V'+(selectedIdx+1)}</h4>
                  </div>
                  
                  {/* 视图切换按钮 */}
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {[
                      { id: 'diff', label: '对比标记', icon: '⚖️' },
                      { id: 'final', label: '完美成文', icon: '✨' }
                    ].map(mode => (
                      <button 
                        key={mode.id} 
                        onClick={() => setViewMode(mode.id as any)} 
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center space-x-2 ${viewMode === mode.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <span>{mode.icon}</span><span>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-4xl mx-auto min-h-[160px]">
                  {viewMode === 'diff' ? renderDiffText(currentAnalysis?.diffedText) : renderCleanText(currentAnalysis?.modifiedText)}
                </div>
              </div>

              {/* 页脚装饰 */}
              <div className="mt-12 pt-8 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest">
                <span>Verified by AI Curator</span>
                <span>Language Museum Archive — {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* 修正笔记列表 */}
            <div className="space-y-6">
               <div className="flex items-center space-x-2 px-2">
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center">
                    <span className="w-2 h-2 bg-rose-500 rounded-full mr-3 animate-pulse"></span>
                    修正详情 Annotations
                  </h3>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {currentAnalysis?.corrections && currentAnalysis.corrections.length > 0 ? currentAnalysis.corrections.map((corr, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all flex flex-col group/card">
                       <div className="flex items-center justify-between mb-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getCategoryColor(corr.category)}`}>
                             {corr.category}
                          </span>
                          <button 
                            onClick={() => handlePlayAudio(corr.improved, `corr-${idx}`)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${playingAudioId === `corr-${idx}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-300 hover:text-indigo-600 group-hover/card:bg-indigo-50'}`}
                          >
                            <span className="text-xs">🎧</span>
                          </button>
                       </div>
                       <div className="flex flex-wrap items-center gap-2 mb-4 serif-font">
                          <span className="text-rose-400 line-through opacity-60 text-sm md:text-base">{corr.original || ''}</span>
                          <span className="text-slate-300 text-xs">➤</span>
                          <span className="text-emerald-600 font-black text-base md:text-lg">{corr.improved || ''}</span>
                       </div>
                       <div className="pt-4 border-t border-dashed border-slate-100 mt-auto">
                          <p className="text-[11px] text-slate-500 leading-relaxed italic">
                             <span className="font-black text-slate-400 mr-2 uppercase tracking-tighter">Analysis:</span> {corr.explanation || ''}
                          </p>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-full py-16 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl">
                       <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">此版本堪称完美，无需修复。</p>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'logic' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {currentAnalysis?.transitionSuggestions && currentAnalysis.transitionSuggestions.map((s, i) => (
                <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-indigo-100 transition-all group/logic">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-xl font-black text-indigo-900 serif-font underline decoration-indigo-200 decoration-4 underline-offset-4">{s.word}</h4>
                    <button onClick={() => handlePlayAudio(s.word, `logic-${i}`)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${playingAudioId === `logic-${i}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-400 group-hover/logic:bg-indigo-600 group-hover/logic:text-white'}`}>🎧</button>
                  </div>
                  <p className="text-xs text-slate-600 mb-5 italic font-medium leading-relaxed">{s.explanation}</p>
                  <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400">
                    “ {s.example} ”
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-900 p-8 md:p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5 text-9xl font-serif">“</div>
              <span className="text-[10px] font-black text-indigo-400 uppercase mb-4 block tracking-widest">Curator's Master Review</span>
              <p className="text-indigo-50 italic leading-[1.8] text-sm md:text-lg serif-font">{currentAnalysis?.overallFeedback}</p>
            </div>
          </div>
        )}

        {activeTab === 'gems' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-right-4 duration-500">
             {currentAnalysis?.advancedVocab && currentAnalysis.advancedVocab.map((v, i) => (
               <div key={i} className="bg-white p-8 rounded-[2.8rem] border border-slate-200 shadow-sm relative group hover:border-indigo-300 transition-all flex flex-col hover:-translate-y-1">
                  <div className="flex items-center justify-between mb-6">
                    <button onClick={() => handlePlayAudio(v.word, `vocab-${i}`)} className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all ${playingAudioId === `vocab-${i}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}>🎧</button>
                    <div className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-xl">{v.level}</div>
                  </div>
                  <h4 className="text-2xl font-black text-slate-900 serif-font mb-3 group-hover:text-indigo-600 transition-colors">{v.word}</h4>
                  <p className="text-xs text-slate-600 font-bold italic mb-6 leading-relaxed bg-slate-50 p-4 rounded-2xl border-l-2 border-slate-200">{v.meaning}</p>
                  <div className="mt-auto pt-6 border-t border-slate-100 text-xs text-slate-500 italic leading-relaxed">
                    “ {v.usage} ”
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