
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
        // 成功后不立即切走，让用户看一眼反馈
      }
      alert(result.isCorrect ? "✨ 太棒了！用法非常准确。" : `💡 建议优化：${result.feedback}`);
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
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">珍宝复习馆</h2>
          <p className="text-slate-500 mt-2 text-sm italic">温故而知新，打磨您的表达艺术。</p>
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
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* 左侧：标本展柜 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl p-10 flex flex-col items-center text-center relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-9xl font-serif">“</div>
                <div className="mb-8 flex flex-col items-center w-full">
                  <div className="flex items-center justify-between w-full mb-6">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                      Specimen {currentIndex + 1}/{featuredGems.length}
                    </span>
                    <div className="flex items-center space-x-1">
                       <button 
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex(prev => prev - 1)}
                        className="p-2 hover:bg-slate-50 rounded-full disabled:opacity-20"
                       >←</button>
                       <button 
                        disabled={currentIndex === featuredGems.length - 1}
                        onClick={() => setCurrentIndex(prev => prev + 1)}
                        className="p-2 hover:bg-slate-50 rounded-full disabled:opacity-20"
                       >→</button>
                    </div>
                  </div>
                  
                  <h3 className="text-5xl font-black text-slate-900 serif-font mb-4 leading-relaxed">
                    {renderRuby(currentGem.word)}
                  </h3>
                  <button onClick={() => playAudio(currentGem.word)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${playingAudio ? 'bg-indigo-600 text-white animate-pulse shadow-lg' : 'bg-indigo-50 text-indigo-400 hover:bg-indigo-100 shadow-sm'}`}>🎧</button>
                </div>

                <p className="text-xl text-slate-500 italic mb-10 serif-font leading-relaxed">
                  {currentGem.meaning}
                </p>

                <div className="mt-auto w-full space-y-4">
                  <div className="text-left">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 block">典藏例句 Masterwork</span>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 relative">
                      <div className="absolute top-0 left-6 w-1 h-full bg-indigo-200 rounded-full opacity-50"></div>
                      <p className="text-sm text-slate-600 italic leading-relaxed pl-4">
                        “ {stripRuby(currentGem.usage)} ”
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右侧：工作台与历史足迹 */}
            <div className="lg:col-span-3 space-y-6 flex flex-col h-full min-h-[600px]">
               {/* 练习区域 */}
               <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 flex flex-col shrink-0">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">工作台 Workbench</h4>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Level: {currentGem.level}</span>
                  </div>
                  <textarea 
                    value={practiceInput}
                    onChange={(e) => setPracticeInput(e.target.value)}
                    placeholder={`在此尝试使用 "${stripRuby(currentGem.word)}" ...`}
                    className="w-full text-xl md:text-2xl text-slate-700 serif-font italic leading-relaxed border-none focus:ring-0 resize-none bg-transparent placeholder:text-slate-200 min-h-[120px]"
                  />
                  <div className="mt-6">
                    <button 
                      onClick={handlePracticeSubmit}
                      disabled={!practiceInput.trim() || isValidating}
                      className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-bold text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 disabled:bg-slate-200"
                    >
                      {isValidating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>✦ 提交并审阅造句</span>}
                    </button>
                  </div>
               </div>
               
               {/* 历史记录：增加了固定高度和滚动条 */}
               <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-sm p-10 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between mb-6 shrink-0">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">历史练习足迹 Logs</h4>
                    <span className="text-[10px] font-black text-slate-300">{(currentGem.practices?.length || 0)} RECORDS</span>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-2">
                    {currentGem.practices && currentGem.practices.length > 0 ? (
                      currentGem.practices.map((log, li) => (
                        <div key={li} className="group/log relative pl-6">
                          <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-slate-100 group-hover/log:bg-indigo-200 transition-colors"></div>
                          <div className="absolute left-[-3px] top-2 w-2 h-2 rounded-full bg-white border-2 border-slate-200 group-hover/log:border-indigo-400 transition-colors"></div>
                          
                          <div className="space-y-2">
                            <p className="text-base text-slate-700 serif-font italic leading-relaxed group-hover/log:text-indigo-900 transition-colors">
                              “ {stripRuby(log.sentence)} ”
                            </p>
                            <div className="flex items-center space-x-3">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${log.status === 'Perfect' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {log.status}
                              </span>
                              <span className="text-[9px] text-slate-300 font-bold">{new Date(log.timestamp).toLocaleDateString()}</span>
                            </div>
                            {log.betterVersion && log.betterVersion !== log.sentence && (
                              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 mt-2">
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                  <span className="text-indigo-400 mr-2">✦</span>
                                  {stripRuby(log.betterVersion)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-30 py-10">
                        <div className="text-4xl mb-4">📜</div>
                        <p className="text-[10px] font-black uppercase tracking-widest">暂无档案记录</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
             <div className="text-6xl mb-6">🥂</div>
             <h3 className="text-xl font-bold text-slate-900 serif-font">所有珍宝均已点亮</h3>
             <p className="text-slate-400 mt-2 text-sm">您的词汇库已达到馆藏级别。</p>
          </div>
        )
      )}

      {activeTab === 'all' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
           {allVocab.map((gem, i) => (
             <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col hover:border-indigo-300 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-lg">{gem.language}</span>
                  <div className="flex space-x-0.5">
                    {[1, 2, 3].map(step => (
                      <div key={step} className={`w-1.5 h-1.5 rounded-full ${step <= (gem.mastery || 0) ? 'bg-amber-400' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
                </div>
                <h4 className="text-2xl font-black text-slate-900 serif-font mb-2 group-hover:text-indigo-600 transition-colors">
                  {renderRuby(gem.word)}
                </h4>
                <p className="text-xs text-slate-400 italic mb-4 line-clamp-2">{gem.meaning}</p>
                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-300">{gem.date}</span>
                   <button onClick={() => onReviewEntry(entries.find(e => e.id === gem.entryId)!)} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">溯源 Artifact →</button>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
