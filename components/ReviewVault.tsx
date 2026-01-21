
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
  
  const allVocab = useMemo(() => {
    const list: ExtendedVocab[] = [];
    entries.forEach(entry => {
      if (entry.analysis) {
        entry.analysis.advancedVocab.forEach(v => {
          list.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
        });
      }
    });
    return list.sort((a, b) => (b.mastery || 0) - (a.mastery || 0));
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

  const stripRuby = (text: string) => {
    if (!text) return '';
    return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  };

  const highlightSentence = (sentence: string, wordWithRuby: string) => {
    const keyword = stripRuby(wordWithRuby);
    if (!keyword) return sentence;
    const regex = new RegExp(`(${keyword})`, 'gi');
    const parts = sentence.split(regex);
    return parts.map((part, i) => 
      part.toLowerCase() === keyword.toLowerCase() 
        ? <span key={i} className="text-indigo-600 font-black border-b-2 border-indigo-100 px-0.5">{part}</span> 
        : part
    );
  };

  const handlePracticeSubmit = async () => {
    if (!practiceInput.trim() || !currentGem || isValidating) return;
    setIsValidating(true);
    try {
      const result = await validateVocabUsage(currentGem.word, currentGem.meaning, practiceInput, currentGem.language);
      const record: PracticeRecord = {
        sentence: practiceInput,
        feedback: result.feedback,
        betterVersion: result.betterVersion,
        timestamp: Date.now(),
        status: result.isCorrect ? 'Perfect' : 'Polished'
      };
      
      const newMastery = Math.min((currentGem.mastery || 0) + (result.isCorrect ? 1 : 0), 3);
      onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, record);
      
      if (result.isCorrect) {
        setPracticeInput('');
        alert("✨ 太棒了！用法非常准确。");
      } else {
        alert(`💡 建议优化：${result.feedback}`);
      }
    } catch (e) {
      alert("验证失败，请重试。");
    } finally {
      setIsValidating(false);
    }
  };

  const playAudio = async (text: string) => {
    if (playingAudio) return;
    setPlayingAudio(true);
    try {
      const base64 = await generateDiaryAudio(text);
      if (!base64) return;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">珍宝复习馆</h2>
          <p className="text-slate-500 mt-2 text-sm italic">打磨表达，将每一个词汇化为馆藏级记忆。</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm self-start">
          <button onClick={() => setActiveTab('gems')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'gems' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span>🚀 特展</span>
          </button>
          <button onClick={() => setActiveTab('all')} className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}>
            <span>💎 全集</span>
          </button>
        </div>
      </header>

      {activeTab === 'gems' && (
        currentGem ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
            
            {/* 移动端吸顶条：改为全白、增强投影，消除穿透感 */}
            <div className="md:hidden sticky top-[-1px] left-0 right-0 z-[60] bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between -mx-4 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] transition-all animate-in slide-in-from-top-full">
               <div className="flex items-center space-x-4 overflow-hidden">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full shrink-0"></div>
                  <div className="min-w-0">
                    <h4 className="text-xl font-black text-slate-900 serif-font truncate tracking-tight">{renderRuby(currentGem.word)}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase truncate tracking-widest">{currentGem.meaning}</p>
                  </div>
               </div>
               <button onClick={() => playAudio(currentGem.word)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-500 shadow-sm'}`}>🎧</button>
            </div>

            {/* PC端：左侧标本展柜 (Sticky 粘性固定) */}
            <div className="lg:col-span-5 lg:sticky lg:top-8 z-10">
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl p-8 md:p-10 flex flex-col items-center text-center relative overflow-hidden h-fit transition-all hover:shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-9xl font-serif">“</div>
                <div className="mb-8 flex flex-col items-center w-full">
                  <div className="flex items-center justify-between w-full mb-8">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      Specimen {currentIndex + 1}/{featuredGems.length}
                    </span>
                    <div className="flex items-center space-x-1">
                       <button 
                        disabled={currentIndex === 0}
                        onClick={() => {setCurrentIndex(prev => prev - 1); setPracticeInput(''); window.scrollTo({top: 0, behavior: 'smooth'});}}
                        className="p-2.5 hover:bg-slate-50 rounded-full disabled:opacity-20 transition-colors"
                       >←</button>
                       <button 
                        disabled={currentIndex === featuredGems.length - 1}
                        onClick={() => {setCurrentIndex(prev => prev + 1); setPracticeInput(''); window.scrollTo({top: 0, behavior: 'smooth'});}}
                        className="p-2.5 hover:bg-slate-50 rounded-full disabled:opacity-20 transition-colors"
                       >→</button>
                    </div>
                  </div>
                  
                  <h3 className="text-5xl md:text-6xl font-black text-slate-900 serif-font mb-6 leading-tight">
                    {renderRuby(currentGem.word)}
                  </h3>
                  <button onClick={() => playAudio(currentGem.word)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100 shadow-sm hover:scale-110'}`}>🎧</button>
                </div>

                <p className="text-xl md:text-2xl text-slate-500 italic mb-12 serif-font leading-relaxed max-w-[80%]">
                  {currentGem.meaning}
                </p>

                <div className="mt-auto w-full space-y-6">
                  <div className="text-left">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-3 block">典藏例句 Masterwork</span>
                    <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 relative">
                      <div className="absolute top-0 left-8 w-1 h-full bg-indigo-200 rounded-full opacity-30"></div>
                      <p className="text-base text-slate-600 italic leading-relaxed pl-6">
                        “ {stripRuby(currentGem.usage)} ”
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PC端：右侧工作台与历史足迹 (随页面滚动) */}
            <div className="lg:col-span-7 space-y-10 flex flex-col">
               {/* 练习工作台 */}
               <div id="practice-workbench" className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-8 md:p-12 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">工作台 Workbench</h4>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full">Level: {currentGem.level}</span>
                  </div>
                  <textarea 
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder={`在此尝试使用 "${stripRuby(currentGem.word)}" ...`}
                    className="w-full text-2xl md:text-3xl text-slate-700 serif-font italic leading-relaxed border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-100 min-h-[180px]"
                  />
                  <div className="mt-8">
                    <button 
                      onClick={handlePracticeSubmit}
                      disabled={!practiceInput.trim() || isValidating}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-bold text-xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {isValidating ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>✦ 提交并审阅造句</span>}
                    </button>
                  </div>
               </div>
               
               {/* 历史记录足迹 */}
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-8 md:p-12 flex flex-col">
                  <div className="flex items-center justify-between mb-10 shrink-0">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">历史练习足迹 Logs</h4>
                    <span className="text-[10px] font-black text-slate-300 bg-slate-50 px-3 py-1 rounded-lg">{(currentGem.practices?.length || 0)} RECORDS</span>
                  </div>

                  <div className="space-y-12">
                    {currentGem.practices && currentGem.practices.length > 0 ? (
                      currentGem.practices.map((log, li) => (
                        <div key={li} className="group/log relative pl-10">
                          {/* 轴线装饰 */}
                          <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-slate-100 group-hover/log:bg-indigo-200 transition-colors"></div>
                          <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-white border-2 border-slate-200 group-hover/log:border-indigo-400 transition-all flex items-center justify-center">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover/log:bg-indigo-400"></div>
                          </div>
                          
                          <div className="space-y-4">
                            <p className="text-xl text-slate-700 serif-font italic leading-relaxed group-hover/log:text-indigo-900 transition-colors">
                              “ {highlightSentence(stripRuby(log.sentence), currentGem.word)} ”
                            </p>
                            <div className="flex items-center space-x-4">
                              <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest ${log.status === 'Perfect' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                {log.status}
                              </span>
                              <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">{new Date(log.timestamp).toLocaleDateString()}</span>
                            </div>
                            {log.betterVersion && log.betterVersion !== log.sentence && (
                              <div className="bg-indigo-50/20 p-6 rounded-[2rem] border border-indigo-100/30 mt-4 relative overflow-hidden group-hover/log:bg-indigo-50/40 transition-colors">
                                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-400/30"></div>
                                <p className="text-[13px] text-indigo-800 leading-relaxed font-medium">
                                  <span className="text-indigo-400 mr-2 font-black">✦ 馆长建议:</span>
                                  {highlightSentence(stripRuby(log.betterVersion), currentGem.word)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-24 flex flex-col items-center justify-center opacity-30 text-center">
                        <div className="text-5xl mb-6 grayscale">📜</div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">暂无档案，期待您的第一个练习</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="py-32 text-center bg-white rounded-[4rem] border border-dashed border-slate-200">
             <div className="text-7xl mb-8">🥂</div>
             <h3 className="text-2xl font-black text-slate-900 serif-font">所有珍宝均已点亮</h3>
             <p className="text-slate-400 mt-3 text-base">您的词汇库已达到馆藏级别，请开启新的篇章。</p>
          </div>
        )
      )}

      {activeTab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4">
           {allVocab.map((gem, i) => (
             <div key={i} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-300 hover:shadow-xl transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-bl-[2rem] -mr-8 -mt-8 transition-transform group-hover:scale-150"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100/50">{gem.language}</span>
                  <div className="flex space-x-1">
                    {[1, 2, 3].map(step => (
                      <div key={step} className={`w-2 h-2 rounded-full ${step <= (gem.mastery || 0) ? 'bg-amber-400 shadow-sm' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
                </div>
                <h4 className="text-3xl font-black text-slate-900 serif-font mb-3 group-hover:text-indigo-600 transition-colors relative z-10">
                  {renderRuby(gem.word)}
                </h4>
                <p className="text-sm text-slate-400 italic mb-6 line-clamp-2 leading-relaxed">{gem.meaning}</p>
                <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between relative z-10">
                   <span className="text-[11px] font-bold text-slate-300 uppercase tracking-tighter">{gem.date}</span>
                   <button onClick={() => onReviewEntry(entries.find(e => e.id === gem.entryId)!)} className="text-[11px] font-black text-indigo-600 uppercase hover:underline tracking-widest">溯源 Artifact →</button>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
