import React, { useState, useMemo, useRef } from 'react';
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
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  
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
    setFeedback(null);
    try {
      const result = await validateVocabUsage(currentGem.word, currentGem.meaning, practiceInput, currentGem.language);
      setFeedback(result);
      if (result.isCorrect) {
        const newMastery = Math.min((currentGem.mastery || 0) + 1, 3);
        const record: PracticeRecord = {
          sentence: practiceInput,
          feedback: result.feedback,
          betterVersion: result.betterVersion,
          timestamp: Date.now(),
          status: result.betterVersion ? 'Polished' : 'Perfect'
        };
        onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, record);
      }
    } finally {
      setIsValidating(false);
    }
  };

  if (activeTab === 'all') {
    return (
      <div className="animate-in fade-in duration-500 space-y-3 p-1">
        <header className="flex items-center justify-between shrink-0 mb-2">
          <h2 className="text-lg font-bold text-slate-900 serif-font">珍宝档案 Archive</h2>
          <button onClick={() => setActiveTab('gems')} className="text-[11px] font-black text-indigo-600 uppercase">返回 BACK</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {allVocab.map((v, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-widest">{v.language}</span>
                <span className="text-[9px] font-black text-slate-400">{v.mastery || 0}/3</span>
              </div>
              <h3 className="text-sm font-bold serif-font">{renderRuby(v.word)}</h3>
              <p className="text-[10px] text-slate-500 italic line-clamp-1 mb-2">{v.meaning}</p>
              <div className="mt-auto pt-2 border-t border-slate-50 flex justify-between items-center">
                 <span className="text-[8px] font-bold text-slate-300 uppercase">{v.date}</span>
                 <button onClick={() => onReviewEntry(entries.find(e => e.id === v.entryId)!)} className="text-[9px] font-bold text-indigo-400">VIEW</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-500 pb-40 md:pb-8 p-0 md:p-2">
      <header className="flex items-center justify-between mb-6 shrink-0 px-4 md:px-0">
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 serif-font">珍宝复习馆</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Refine your linguistic gems</p>
        </div>
        <button 
          onClick={() => setActiveTab('all')}
          className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-500 uppercase shadow-sm flex items-center gap-2 active:scale-95 transition-all"
        >
          📜 档案
        </button>
      </header>

      {!currentGem ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl grayscale opacity-20 mb-4">💎</div>
          <p className="text-slate-400 text-sm font-bold serif-font">暂无待练习单词</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8 px-2 md:px-0">
            <div className="mb-6 lg:mb-0">
              <div className="bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-full">
                <div className="p-7 md:p-12 relative flex-1 flex flex-col">
                  <div className="absolute top-7 right-7 flex items-center space-x-3">
                    <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-widest">{currentGem.level}</div>
                    <div className="text-[11px] font-black text-slate-300 tracking-[0.2em]">{currentIndex + 1}/{featuredGems.length}</div>
                  </div>

                  <div className="mt-4 mb-5 md:mb-10">
                    <div className="flex items-center gap-4 flex-wrap mb-2 md:mb-4">
                      <h3 className="text-3xl md:text-6xl font-black text-slate-900 serif-font">
                        {renderRuby(currentGem.word)}
                      </h3>
                      <button 
                        onClick={() => handlePlayAudio(currentGem.word)}
                        className={`w-9 h-9 md:w-14 md:h-14 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                      >
                        <span className="text-base md:text-2xl">🎧</span>
                      </button>
                    </div>
                    <p className="text-lg md:text-2xl text-indigo-900/70 font-bold italic serif-font leading-relaxed">{currentGem.meaning}</p>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Contextual Usage</span>
                      <div className="h-[1px] flex-1 bg-slate-100"></div>
                    </div>
                    <div className="bg-slate-50/70 p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 relative group transition-colors hover:bg-white">
                      <span className="absolute top-3 left-5 text-3xl opacity-10 serif-font text-indigo-600">“</span>
                      <p className="text-lg md:text-2xl text-slate-600 italic serif-font leading-[1.8] relative z-10">
                          {renderRuby(currentGem.usage)}
                      </p>
                      <span className="absolute bottom-3 right-5 text-3xl opacity-10 serif-font text-indigo-600 rotate-180">“</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100 shrink-0">
                  <button 
                    disabled={currentIndex === 0}
                    onClick={() => { setCurrentIndex(i => i - 1); setFeedback(null); setPracticeInput(''); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                  </button>
                  <div className="flex space-x-2">
                    {[...Array(featuredGems.length)].map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-8 bg-indigo-600' : 'w-1.5 bg-slate-300'}`}></div>
                    ))}
                  </div>
                  <button 
                    disabled={currentIndex === featuredGems.length - 1}
                    onClick={() => { setCurrentIndex(i => i + 1); setFeedback(null); setPracticeInput(''); }}
                    className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 disabled:opacity-20 transition-all hover:bg-slate-50 shadow-sm active:scale-90"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex flex-col bg-white rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl p-7 md:p-12 relative min-h-[300px]">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></div>
                      <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">撰写造句 PRACTICE</h4>
                    </div>
                    {feedback && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${feedback.isCorrect ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50'}`}>
                        {feedback.isCorrect ? 'Excellent' : 'Refine'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col space-y-5">
                    <textarea
                      value={practiceInput}
                      onChange={(e) => setPracticeInput(e.target.value)}
                      placeholder={`使用“${currentGem.word.replace(/\[(.*?)\]\(.*?\)/g, '$1')}”造句...`}
                      className="w-full bg-slate-50/40 border border-slate-100 focus:bg-white focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-200 rounded-[2rem] p-6 md:p-10 text-lg md:text-2xl serif-font placeholder:text-slate-300 resize-none min-h-[160px] md:min-h-[220px] transition-all"
                      disabled={isValidating}
                    />
                    
                    {/* 电脑端提交按钮：仅大屏幕显示 */}
                    <button
                      onClick={handlePracticeSubmit}
                      disabled={!practiceInput.trim() || isValidating}
                      className={`hidden lg:flex w-full py-5 md:py-6 rounded-3xl font-black transition-all active:scale-[0.98] items-center justify-center space-x-4 shadow-2xl ${
                        isValidating ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white shadow-indigo-100/50 hover:bg-indigo-600'
                      }`}
                    >
                      {isValidating ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-300 border-t-indigo-500" />
                      ) : (
                        <span className="text-sm md:text-lg tracking-[0.2em] uppercase">✨ 提交 AI 审阅 SUBMIT</span>
                      )}
                    </button>

                    {feedback && (
                      <div className="mt-4 animate-in slide-in-from-bottom-5">
                        <div className={`p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border-2 shadow-sm ${feedback.isCorrect ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100'}`}>
                          <div className="flex items-start gap-4 mb-4">
                            <div className={`w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg md:text-xl ${feedback.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                              {feedback.isCorrect ? '✨' : '🧐'}
                            </div>
                            <p className="text-base md:text-lg text-slate-700 leading-relaxed font-medium pt-1">
                              {feedback.feedback}
                            </p>
                          </div>
                          {feedback.betterVersion && (
                            <div className="bg-white/90 p-6 md:p-10 rounded-[1.5rem] md:rounded-[2rem] border border-white/50 shadow-inner relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 rounded-bl-[2rem] opacity-30"></div>
                                <h5 className="text-[10px] md:text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center">
                                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full mr-2"></span> Masterful Revision
                                </h5>
                                <p className="text-lg md:text-2xl font-bold text-indigo-950 serif-font italic leading-relaxed">“{feedback.betterVersion}”</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
              </div>

              <div className="hidden lg:flex bg-white/50 border border-slate-100 rounded-[1.5rem] p-6 mt-6 items-center justify-between shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mastery Progress</span>
                <div className="flex space-x-3">
                  {[1, 2, 3].map(step => (
                    <div key={step} className={`w-10 h-2 rounded-full transition-all duration-700 ${step <= (currentGem.mastery || 0) ? 'bg-indigo-600 shadow-lg shadow-indigo-100' : 'bg-slate-200'}`}></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 移动端悬浮提交按钮：仅小屏幕显示 */}
          <div className="lg:hidden fixed bottom-20 left-0 right-0 px-6 py-4 z-[110] pointer-events-none">
            <button
              onClick={handlePracticeSubmit}
              disabled={!practiceInput.trim() || isValidating}
              className={`w-full py-4 rounded-3xl font-black transition-all active:scale-[0.98] flex items-center justify-center space-x-4 shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] pointer-events-auto ${
                isValidating ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white'
              }`}
            >
              {isValidating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
              ) : (
                <span className="text-sm tracking-[0.2em] uppercase">✨ 提交 AI 审阅 SUBMIT</span>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ReviewVault;