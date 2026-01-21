
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
      <div className="animate-in fade-in duration-500 space-y-3 p-1 max-w-6xl mx-auto pb-20 h-full overflow-y-auto no-scrollbar">
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
    <div className="flex flex-col animate-in fade-in duration-500 pb-20 md:pb-4 p-0 md:p-1 lg:h-[calc(100vh-140px)] max-w-6xl mx-auto overflow-hidden">
      <header className="flex items-center justify-between mb-4 md:mb-6 shrink-0 px-4 md:px-0">
        <div className="flex flex-col">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 serif-font tracking-tight">珍宝复习馆</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Refine your linguistic artifacts</p>
        </div>
        <button 
          onClick={() => setActiveTab('all')}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase shadow-sm flex items-center gap-2 active:scale-95 transition-all hover:bg-slate-50"
        >
          📜 浏览档案
        </button>
      </header>

      {!currentGem ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="text-6xl grayscale opacity-10 mb-6">💎</div>
          <p className="text-slate-400 text-lg font-bold serif-font italic">您的珍宝库目前虚位以待</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 px-2 md:px-0 min-h-0">
          {/* 左侧：单词展示卡 (占据 5/12) */}
          <div className="lg:col-span-5 flex flex-col min-h-0 mb-6 lg:mb-0">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full relative group">
              <div className="p-6 md:p-10 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-6 shrink-0">
                  <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-full uppercase tracking-widest border border-indigo-100">{currentGem.language} · {currentGem.level}</div>
                  <div className="text-[10px] font-black text-slate-300 tracking-[0.2em]">{currentIndex + 1} / {featuredGems.length}</div>
                </div>

                <div className="flex-1 flex flex-col justify-center text-center min-h-0">
                  <h3 className="text-3xl md:text-5xl lg:text-4xl xl:text-5xl font-black text-slate-900 serif-font mb-4 transition-all">
                    {renderRuby(currentGem.word)}
                  </h3>
                  <p className="text-lg md:text-xl text-indigo-900/60 font-bold italic serif-font leading-relaxed mb-6 line-clamp-2">{currentGem.meaning}</p>
                  
                  <button 
                    onClick={() => handlePlayAudio(currentGem.word)}
                    className={`self-center w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all shrink-0 ${playingAudio ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 shadow-inner'}`}
                  >
                    <span className="text-xl md:text-2xl">🎧</span>
                  </button>
                </div>

                <div className="mt-6 space-y-4 shrink-0">
                  <div className="bg-slate-50/70 p-5 rounded-[1.5rem] border border-slate-100 relative italic">
                    <span className="absolute -top-3 left-6 bg-white px-2 py-0.5 border border-slate-100 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest">In Context</span>
                    <p className="text-sm md:text-base text-slate-500 serif-font leading-relaxed line-clamp-3">
                        {renderRuby(currentGem.usage)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/50 px-8 py-4 flex items-center justify-between border-t border-slate-100 shrink-0">
                <button 
                  disabled={currentIndex === 0}
                  onClick={() => { setCurrentIndex(i => i - 1); setLastFeedback(null); setPracticeInput(''); }}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div className="flex space-x-1.5">
                  {[...Array(featuredGems.length)].map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-6 bg-indigo-600 shadow-md shadow-indigo-100' : 'w-1 bg-slate-300'}`}></div>
                  ))}
                </div>
                <button 
                  disabled={currentIndex === featuredGems.length - 1}
                  onClick={() => { setCurrentIndex(i => i + 1); setLastFeedback(null); setPracticeInput(''); }}
                  className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：工作台 & 履历列表 (占据 7/12) */}
          <div className="lg:col-span-7 flex flex-col min-h-0">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-6 md:p-8 flex-1 flex flex-col min-h-0 space-y-5">
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                    <h4 className="text-[10px] font-black text-slate-800 tracking-[0.2em] uppercase">修复实验室 RESTORATION LAB</h4>
                  </div>
                  <div className="flex space-x-2">
                    {[1, 2, 3].map(step => (
                      <div key={step} className={`w-6 h-1 rounded-full transition-all duration-1000 ${step <= (currentGem.mastery || 0) ? 'bg-indigo-600 shadow-lg' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative">
                  <textarea
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder={`撰写一段包含“${currentGem.word.replace(/\[(.*?)\]\(.*?\)/g, '$1')}”的句子...`}
                    className="w-full flex-1 bg-slate-50/40 border-2 border-slate-50 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-100 rounded-[2rem] p-6 text-base md:text-xl lg:text-lg serif-font placeholder:text-slate-200 resize-none transition-all"
                    disabled={isValidating}
                  />
                  
                  {/* 反馈浮层：如果有反馈，展示在输入框上方或下方，不再增加整体高度 */}
                  {lastFeedback && (
                    <div className="absolute inset-x-0 bottom-full mb-4 animate-in slide-in-from-bottom-2 duration-300 z-10">
                      <div className={`p-4 rounded-2xl border-2 shadow-2xl ${lastFeedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{lastFeedback.isCorrect ? '✨' : '🧐'}</span>
                          <p className="text-xs font-bold text-slate-700 leading-relaxed">{lastFeedback.feedback}</p>
                          <button onClick={() => setLastFeedback(null)} className="ml-auto text-slate-400">✕</button>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handlePracticeSubmit}
                    disabled={!practiceInput.trim() || isValidating}
                    className={`mt-4 w-full py-4 rounded-2xl font-black transition-all active:scale-[0.98] flex items-center justify-center space-x-4 shrink-0 ${
                      isValidating ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white shadow-xl hover:bg-indigo-600'
                    }`}
                  >
                    {isValidating ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
                    ) : (
                      <span className="text-sm tracking-[0.2em] uppercase">✨ 提交审阅 SUBMIT</span>
                    )}
                  </button>
                </div>

                {/* 履历内嵌区：在右侧卡片底部直接展示，不再需要页面滚动 */}
                <div className="flex flex-col min-h-0 max-h-[180px] lg:max-h-[220px]">
                  <div className="flex items-center space-x-3 mb-3 shrink-0">
                    <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">修复履历 LEDGER ({gemPractices.length})</h3>
                    <div className="h-[1px] flex-1 bg-slate-100"></div>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2 no-scrollbar">
                    {gemPractices.map((record, idx) => (
                      <div key={idx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 flex items-center gap-3 transition-colors hover:bg-white group">
                        <div className="flex flex-col shrink-0 w-10 text-center">
                          <span className="text-[8px] font-black text-slate-300 uppercase leading-none mb-1">{new Date(record.timestamp).toLocaleDateString('zh-CN', {month:'short', day:'numeric'})}</span>
                          <span className={`text-[7px] font-black uppercase px-1 rounded ${record.status === 'Perfect' ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}>{record.status[0]}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-500 serif-font italic truncate">{record.sentence}</p>
                          {record.betterVersion && <p className="text-[11px] text-indigo-600 font-bold serif-font truncate">✨ {record.betterVersion}</p>}
                        </div>
                        <button 
                          onClick={() => handlePlayAudio(record.betterVersion || record.sentence)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-100 text-slate-300 hover:text-indigo-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                        >
                          🎧
                        </button>
                      </div>
                    ))}
                    {gemPractices.length === 0 && (
                      <div className="py-4 text-center border border-dashed border-slate-100 rounded-xl">
                        <p className="text-[9px] text-slate-300 font-black uppercase tracking-widest italic">暂无记录 No Archive</p>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
