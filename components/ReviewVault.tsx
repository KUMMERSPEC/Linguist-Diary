
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
          <button onClick={() => setActiveTab('gems')} className="text-[10px] font-black text-indigo-600 uppercase">返回 BACK</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {allVocab.map((v, i) => (
            <div key={i} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-1">
                <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-widest">{v.language}</span>
                <span className="text-[8px] font-black text-slate-400">{v.mastery || 0}/3</span>
              </div>
              <h3 className="text-sm font-bold serif-font">{renderRuby(v.word)}</h3>
              <p className="text-[9px] text-slate-500 italic line-clamp-1 mb-2">{v.meaning}</p>
              <div className="mt-auto pt-2 border-t border-slate-50 flex justify-between items-center">
                 <span className="text-[7px] font-bold text-slate-300 uppercase">{v.date}</span>
                 <button onClick={() => onReviewEntry(entries.find(e => e.id === v.entryId)!)} className="text-[8px] font-bold text-indigo-400">VIEW</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 max-h-screen overflow-hidden p-0 md:p-2">
      <header className="flex items-center justify-between mb-1.5 shrink-0 px-2 md:px-0">
        <h2 className="text-lg md:text-2xl font-black text-slate-900 serif-font">珍宝练习</h2>
        <button 
          onClick={() => setActiveTab('all')}
          className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-500 uppercase shadow-sm"
        >
          📜 档案
        </button>
      </header>

      {!currentGem ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <div className="text-4xl grayscale opacity-20 mb-4">💎</div>
          <p className="text-slate-400 text-sm font-bold serif-font">暂无待练习单词</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 lg:gap-4 min-h-0">
          {/* 上方：单词卡片 - 移动端高度压缩 */}
          <div className="shrink-0 lg:shrink mb-2 lg:mb-0">
            <div className="bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-lg overflow-hidden flex flex-col">
              <div className="p-3 md:p-8 relative">
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                   <div className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase">{currentGem.level}</div>
                   <div className="text-[8px] font-black text-slate-300">{currentIndex + 1}/{featuredGems.length}</div>
                </div>

                <div className="mt-1 mb-2 md:mb-6">
                  <h3 className="text-xl md:text-5xl font-black text-slate-900 serif-font flex items-center gap-2">
                    {renderRuby(currentGem.word)}
                    <button 
                      onClick={() => handlePlayAudio(currentGem.word)}
                      className={`w-6 h-6 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400'}`}
                    >
                      <span className="text-xs md:text-lg">🎧</span>
                    </button>
                  </h3>
                  <p className="text-[11px] md:text-base text-indigo-800 font-bold italic mt-1 leading-tight">{currentGem.meaning}</p>
                </div>

                <div className="hidden md:block lg:block space-y-2">
                   <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Example</h4>
                   <p className="text-slate-600 italic serif-font text-xs md:text-lg leading-relaxed bg-slate-50 p-3 md:p-6 rounded-xl border border-slate-100">
                     “ {renderRuby(currentGem.usage)} ”
                   </p>
                </div>
                {/* 移动端紧凑型例句 */}
                <div className="md:hidden block">
                   <p className="text-[10px] text-slate-500 italic serif-font bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                     “ {renderRuby(currentGem.usage)} ”
                   </p>
                </div>
              </div>

              <div className="bg-slate-50 px-3 py-1.5 flex items-center justify-between border-t border-slate-100 shrink-0">
                 <button 
                   disabled={currentIndex === 0}
                   onClick={() => { setCurrentIndex(i => i - 1); setFeedback(null); setPracticeInput(''); }}
                   className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 disabled:opacity-30 text-[10px]"
                 >
                   ←
                 </button>
                 <div className="flex space-x-1">
                   {[...Array(featuredGems.length)].map((_, i) => (
                     <div key={i} className={`h-1 rounded-full transition-all ${i === currentIndex ? 'w-3 bg-indigo-600' : 'w-1 bg-slate-200'}`}></div>
                   ))}
                 </div>
                 <button 
                   disabled={currentIndex === featuredGems.length - 1}
                   onClick={() => { setCurrentIndex(i => i + 1); setFeedback(null); setPracticeInput(''); }}
                   className="p-1.5 bg-white border border-slate-200 rounded-md text-slate-400 disabled:opacity-30 text-[10px]"
                 >
                   →
                 </button>
              </div>
            </div>
          </div>

          {/* 下方：练习区域 - 移动端高度控制 */}
          <div className="flex flex-col min-h-0 flex-1 lg:flex-initial">
             <div className="flex flex-col bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm p-3 md:p-8 flex-1 overflow-hidden">
                <div className="flex items-center space-x-2 mb-2 md:mb-4 shrink-0">
                  <div className="w-1 h-3 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[9px] md:text-[11px] font-black text-slate-800 tracking-wider uppercase">撰写造句 PRACTICE</h4>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar">
                   <textarea
                     value={practiceInput}
                     onChange={(e) => setPracticeInput(e.target.value)}
                     placeholder={`使用“${currentGem.word.replace(/\[(.*?)\]\(.*?\)/g, '$1')}”造句...`}
                     className="w-full bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500/10 rounded-xl p-3 text-sm md:text-xl serif-font placeholder:text-slate-300 resize-none mb-2 min-h-[60px] md:min-h-[120px] shrink-0"
                     disabled={isValidating}
                   />
                   
                   <button
                     onClick={handlePracticeSubmit}
                     disabled={!practiceInput.trim() || isValidating}
                     className={`w-full py-2.5 md:py-4 rounded-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center space-x-2 shadow-md shrink-0 ${
                       isValidating ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white'
                     }`}
                   >
                     {isValidating ? (
                       <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-300 border-t-indigo-500" />
                     ) : (
                       <span className="text-[11px] md:text-base font-black">✨ 提交 AI 审阅</span>
                     )}
                   </button>

                    {feedback && (
                      <div className="mt-2 animate-in slide-in-from-bottom-2 shrink-0">
                        <div className={`p-3 rounded-xl border ${feedback.isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                           <p className="text-[10px] md:text-sm text-slate-700 leading-tight mb-1">
                             <span className="mr-1">{feedback.isCorrect ? '✅' : '🧐'}</span>
                             {feedback.feedback}
                           </p>
                           {feedback.betterVersion && (
                             <div className="bg-white/60 p-2 rounded-lg border border-white/50 mt-1">
                                <h5 className="text-[7px] font-black text-slate-400 uppercase">Better:</h5>
                                <p className="text-[11px] md:text-base font-bold text-indigo-900 serif-font italic leading-tight">“{feedback.betterVersion}”</p>
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                </div>
             </div>

             <div className="hidden md:flex bg-white/50 border border-slate-100 rounded-2xl p-4 mt-2 items-center justify-between shrink-0">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">掌握进度</span>
               <div className="flex space-x-1">
                 {[1, 2, 3].map(step => (
                   <div key={step} className={`w-6 h-1 rounded-full ${step <= (currentGem.mastery || 0) ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                 ))}
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
