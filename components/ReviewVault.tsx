
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DiaryEntry, AdvancedVocab, PracticeRecord } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
}

type ExtendedVocab = AdvancedVocab & { date: string, entryId: string, language: string };

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry, onUpdateMastery }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'all'>('gems');
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  
  const allVocab = useMemo(() => {
    const list: ExtendedVocab[] = [];
    entries.forEach(entry => {
      if (entry.analysis) {
        entry.analysis.advancedVocab.forEach(v => {
          list.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
        });
      }
    });
    return list.sort((a, b) => (a.mastery || 0) - (b.mastery || 0));
  }, [entries]);

  const featuredGems = useMemo(() => {
    return allVocab.filter(v => (v.mastery || 0) < 3).slice(0, 5);
  }, [allVocab]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentGem = featuredGems[currentIndex];

  const gemPractices = useMemo(() => {
    if (!currentGem) return [];
    const entry = entries.find(e => e.id === currentGem.entryId);
    const vocab = entry?.analysis?.advancedVocab.find(v => v.word === currentGem.word);
    return (vocab?.practices || []).sort((a, b) => b.timestamp - a.timestamp);
  }, [currentGem, entries]);

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handlePlayAudio = async (text: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      const base64 = await generateDiaryAudio(text);
      if (!base64) {
        setPlayingAudio(false);
        return;
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768));
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudio(false);
      source.start();
    } catch (e) { setPlayingAudio(false); }
  };

  const handlePracticeSubmit = async () => {
    if (!practiceInput.trim() || isValidating || !currentGem) return;
    setIsValidating(true);
    setLastFeedback(null);
    try {
      const result = await validateVocabUsage(currentGem.word, currentGem.meaning, practiceInput, currentGem.language);
      setLastFeedback(result);
      
      const newMastery = result.isCorrect 
        ? Math.min((currentGem.mastery || 0) + 1, 3) 
        : (currentGem.mastery || 0);

      const record: PracticeRecord = {
        sentence: practiceInput,
        feedback: result.feedback,
        betterVersion: result.betterVersion,
        timestamp: Date.now(),
        status: result.betterVersion ? 'Polished' : 'Perfect'
      };
      
      onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, record);
      
      if (result.isCorrect) {
        setPracticeInput('');
      }
    } finally {
      setIsValidating(false);
    }
  };

  if (activeTab === 'all') {
    return (
      <div className="animate-in fade-in duration-500 space-y-3 p-1 max-w-6xl mx-auto pb-20">
        <header className="flex items-center justify-between shrink-0 mb-4 px-2">
          <h2 className="text-xl font-bold text-slate-900 serif-font">珍宝档案 Archive</h2>
          <button onClick={() => setActiveTab('gems')} className="text-[11px] font-black text-indigo-600 uppercase bg-indigo-50 px-4 py-2 rounded-xl">返回 BACK</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allVocab.map((v, i) => (
            <div key={i} className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col group hover:border-indigo-200 transition-all">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">{v.language}</span>
                <div className="flex space-x-0.5">
                   {[1,2,3].map(s => <div key={s} className={`w-1.5 h-1.5 rounded-full ${s <= (v.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>)}
                </div>
              </div>
              <h3 className="text-base font-bold serif-font mb-1">{renderRuby(v.word)}</h3>
              <p className="text-[11px] text-slate-400 italic line-clamp-1 mb-3">{v.meaning}</p>
              <div className="mt-auto pt-3 border-t border-slate-50 flex justify-between items-center">
                 <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{v.date}</span>
                 <button onClick={() => onReviewEntry(entries.find(e => e.id === v.entryId)!)} className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600">VIEW EXHIBIT</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500 pb-40 md:pb-12 p-0 md:p-2 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-8 shrink-0 px-4 md:px-0">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 serif-font tracking-tight">珍宝复习馆</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Refine your linguistic artifacts</p>
        </div>
        <button 
          onClick={() => setActiveTab('all')}
          className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-500 uppercase shadow-sm flex items-center gap-2 active:scale-95 transition-all hover:bg-slate-50"
        >
          📜 浏览档案
        </button>
      </header>

      {!currentGem ? (
        <div className="flex-1 flex flex-col items-center justify-center py-32 text-center">
          <div className="text-6xl grayscale opacity-10 mb-6">💎</div>
          <p className="text-slate-400 text-lg font-bold serif-font italic">您的珍宝库目前虚位以待</p>
          <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mt-2">Go to Standard writing to collect gems</p>
        </div>
      ) : (
        <div className="space-y-10">
          <div className="flex flex-col lg:grid lg:grid-cols-12 lg:gap-8 px-2 md:px-0 items-stretch">
            <div className="lg:col-span-5 flex flex-col">
              <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full relative group">
                <div className="p-8 md:p-12 lg:p-10 relative flex-1 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase tracking-widest border border-indigo-100">{currentGem.level}</div>
                    <div className="text-[10px] font-black text-slate-300 tracking-[0.2em]">{currentIndex + 1} / {featuredGems.length}</div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center text-center">
                    <h3 className="text-4xl md:text-6xl lg:text-5xl font-black text-slate-900 serif-font mb-4">
                      {renderRuby(currentGem.word)}
                    </h3>
                    <p className="text-xl md:text-2xl lg:text-xl text-indigo-900/60 font-bold italic serif-font leading-relaxed mb-8">{currentGem.meaning}</p>
                    
                    <button 
                      onClick={() => handlePlayAudio(currentGem.word)}
                      className={`self-center w-12 h-12 md:w-16 md:h-16 lg:w-14 lg:h-14 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 shadow-inner'}`}
                    >
                      <span className="text-xl md:text-3xl lg:text-2xl">🎧</span>
                    </button>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="bg-slate-50/70 p-6 md:p-8 rounded-[2rem] border border-slate-100 relative italic">
                      <span className="absolute -top-3 left-6 bg-white px-3 py-1 border border-slate-100 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest">In Context</span>
                      <p className="text-base md:text-lg lg:text-base text-slate-500 serif-font leading-relaxed">
                          {renderRuby(currentGem.usage)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/50 px-8 py-5 flex items-center justify-between border-t border-slate-100">
                  <button 
                    disabled={currentIndex === 0}
                    onClick={() => { setCurrentIndex(i => i - 1); setLastFeedback(null); setPracticeInput(''); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <div className="flex space-x-1.5">
                    {[...Array(featuredGems.length)].map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-indigo-600 shadow-md shadow-indigo-100' : 'w-1.5 bg-slate-300'}`}></div>
                    ))}
                  </div>
                  <button 
                    disabled={currentIndex === featuredGems.length - 1}
                    onClick={() => { setCurrentIndex(i => i + 1); setLastFeedback(null); setPracticeInput(''); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col">
              <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl p-8 md:p-12 lg:p-10 relative flex-1 flex flex-col space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                      <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">修复实验室 RESTORATION LAB</h4>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col relative">
                    <textarea
                      value={practiceInput}
                      onChange={(e) => setPracticeInput(e.target.value)}
                      placeholder={`撰写一段包含“${currentGem.word.replace(/\[(.*?)\]\(.*?\)/g, '$1')}”的句子...`}
                      className="w-full flex-1 bg-slate-50/40 border-2 border-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-100 rounded-[2.5rem] p-8 md:p-10 text-lg md:text-2xl lg:text-xl serif-font placeholder:text-slate-200 resize-none min-h-[250px] transition-all"
                      disabled={isValidating}
                    />
                    
                    <button
                      onClick={handlePracticeSubmit}
                      disabled={!practiceInput.trim() || isValidating}
                      className={`mt-6 w-full py-5 md:py-6 rounded-[2rem] font-black transition-all active:scale-[0.98] flex items-center justify-center space-x-4 shadow-2xl ${
                        isValidating ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white shadow-indigo-100/50 hover:bg-indigo-600'
                      }`}
                    >
                      {isValidating ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-indigo-500" />
                      ) : (
                        <span className="text-base tracking-[0.2em] uppercase">✨ 提交审阅 SUBMIT FOR REVIEW</span>
                      )}
                    </button>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Exhibit Mastery</span>
                    <div className="flex space-x-2">
                      {[1, 2, 3].map(step => (
                        <div key={step} className={`w-12 h-2 rounded-full transition-all duration-1000 ${step <= (currentGem.mastery || 0) ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-100'}`}></div>
                      ))}
                    </div>
                  </div>
              </div>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="flex items-center space-x-4 mb-6 px-4 md:px-0">
                <h3 className="text-lg md:text-xl font-black text-slate-900 serif-font">修复履历 Artifact Ledger</h3>
                <div className="h-[1px] flex-1 bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{gemPractices.length} 次记录</span>
             </div>

             <div className="space-y-6">
                {lastFeedback && (
                  <div className="bg-indigo-600 p-8 md:p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group mb-8 animate-in zoom-in-95">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl font-serif pointer-events-none">✨</div>
                    <div className="relative z-10 flex flex-col md:flex-row gap-8">
                       <div className="flex-1 space-y-4">
                          <h4 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">最新审阅结果 LATEST INSIGHT</h4>
                          <p className="text-xl md:text-2xl font-bold serif-font italic leading-relaxed">“{lastFeedback.betterVersion || practiceInput}”</p>
                          <p className="text-sm text-indigo-100/80 italic">{lastFeedback.feedback}</p>
                       </div>
                       {lastFeedback.betterVersion && (
                         <div className="shrink-0 flex items-center">
                            <div className="px-6 py-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur-sm">
                               <span className="text-[9px] font-black uppercase text-white/60 block mb-1">Status</span>
                               <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">✨ 精进完成</span>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {gemPractices.length > 0 ? gemPractices.map((record, idx) => (
                    <div key={idx} className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row md:items-center gap-6">
                      <div className="shrink-0 flex md:flex-col items-center justify-between md:justify-center w-full md:w-20 space-y-1">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">{new Date(record.timestamp).toLocaleDateString('zh-CN', {month:'short', day:'numeric'})}</span>
                        <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${record.status === 'Perfect' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {record.status}
                        </div>
                      </div>
                      
                      <div className="flex-1 space-y-3">
                        <p className="text-base md:text-xl text-slate-500 serif-font italic leading-relaxed">
                          {record.sentence}
                        </p>
                        {record.betterVersion && (
                          <div className="flex items-start gap-3 bg-slate-50 p-4 md:p-6 rounded-2xl border-l-4 border-indigo-400">
                            <span className="text-indigo-400 font-black text-sm pt-0.5">修复:</span>
                            <p className="text-base md:text-lg text-indigo-900 font-bold serif-font leading-relaxed">
                              {record.betterVersion}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex md:flex-col items-center gap-2">
                        <button 
                          onClick={() => handlePlayAudio(record.betterVersion || record.sentence)}
                          className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center shadow-sm"
                        >
                          🎧
                        </button>
                      </div>
                    </div>
                  )) : !lastFeedback && (
                    <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
                      <p className="text-slate-300 text-sm font-bold serif-font italic">此文物尚未有修复记录</p>
                      <p className="text-[9px] text-slate-200 font-black uppercase tracking-widest mt-1">Start writing above to catalog your progress</p>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
