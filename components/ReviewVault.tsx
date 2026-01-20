
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DiaryEntry, AdvancedVocab, Correction, PracticeRecord } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
}

type ExtendedVocab = AdvancedVocab & { date: string, entryId: string, language: string };

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry, onUpdateMastery }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'flashback' | 'daily'>('daily');
  
  // 馆藏词汇展开状态
  const [expandedWordKey, setExpandedWordKey] = useState<string | null>(null);

  // 音频状态
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 每日特展池
  const [dailyPool, setDailyPool] = useState<ExtendedVocab[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  // 练习过程状态
  const [userSentence, setUserSentence] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ isCorrect: boolean, feedback: string, betterVersion?: string } | null>(null);

  // 句子挑战
  const [challengeData, setChallengeData] = useState<{
    entry: DiaryEntry;
    corrections: Correction[];
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  // 提取所有词汇
  const allGems = useMemo(() => {
    const gems: ExtendedVocab[] = [];
    entries.forEach(entry => {
      entry.analysis?.advancedVocab.forEach(v => {
        gems.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
      });
    });
    return gems;
  }, [entries]);

  // 初始化每日池
  useEffect(() => {
    if (activeTab === 'daily' && dailyPool.length === 0 && allGems.length > 0) {
      const shuffled = [...allGems].sort(() => 0.5 - Math.random());
      setDailyPool(shuffled.slice(0, 5));
    }
  }, [activeTab, allGems, dailyPool.length]);

  const nextChallenge = () => {
    const entriesWithCorrections = entries.filter(e => e.analysis && e.analysis.corrections.length > 0);
    if (entriesWithCorrections.length === 0) return;
    const randomEntry = entriesWithCorrections[Math.floor(Math.random() * entriesWithCorrections.length)];
    setChallengeData({ 
      entry: randomEntry, 
      corrections: randomEntry.analysis!.corrections 
    });
    setShowAnswer(false);
    setTestResult(null);
  };

  useEffect(() => {
    if (activeTab === 'flashback' && !challengeData) nextChallenge();
  }, [activeTab, challengeData]);

  const playAudio = async (text: string, id: string) => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }
    setIsAudioLoading(true);
    try {
      const base64Audio = await generateDiaryAudio(text);
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
      setPlayingAudioId(id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const handleValidation = async () => {
    const currentGem = dailyPool[currentIndex];
    if (!userSentence.trim() || isValidating || !currentGem) return;
    setIsValidating(true);
    try {
      const result = await validateVocabUsage(currentGem.word, currentGem.meaning, userSentence, currentGem.language);
      setTestResult(result);
      
      const newMastery = result.isCorrect ? Math.min((currentGem.mastery || 0) + 1, 3) : Math.max((currentGem.mastery || 0) - 1, 0);
      
      onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, {
        sentence: result.isCorrect ? userSentence : (result.betterVersion || userSentence),
        feedback: result.feedback,
        timestamp: Date.now(),
        status: result.isCorrect ? 'Perfect' : 'Polished'
      });
    } catch (e) {
      setTestResult({ isCorrect: false, feedback: "馆长似乎走神了，请再试一次。" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleNextWord = () => {
    if (currentIndex < dailyPool.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setUserSentence('');
      setTestResult(null);
    } else {
      setShowCompletion(true);
    }
  };

  const handleRetry = () => {
    setTestResult(null);
  };

  const renderChallengeText = () => {
    if (!challengeData) return null;
    const { originalText } = challengeData.entry;
    const { corrections } = challengeData;
    const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sortedOriginals = [...corrections].sort((a, b) => b.original.length - a.original.length);
    const pattern = sortedOriginals.map(c => escapeRegExp(c.original)).join('|');
    if (!pattern) return originalText;
    const regex = new RegExp(`(${pattern})`, 'g');
    const parts = originalText.split(regex);
    return parts.map((part, i) => {
      const matchingCorr = corrections.find(c => c.original === part);
      if (matchingCorr) {
        return (
          <span key={i} className="inline-block align-middle transform transition-all duration-500">
            {showAnswer ? (
              <span className="flex items-center bg-indigo-600 text-white px-3 py-1 rounded-xl shadow-lg shadow-indigo-200 font-bold not-italic text-sm md:text-lg mx-1 animate-in zoom-in duration-300">
                {matchingCorr.improved}
              </span>
            ) : (
              <span className="bg-orange-50 border-b-4 border-dashed border-orange-400 px-1 py-0.5 text-orange-600 not-italic mx-0.5">
                {part}
              </span>
            )}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  const currentGem = dailyPool[currentIndex];

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
          <p className="text-slate-500 text-[10px] md:text-sm">温故而知新，打磨您的表达艺术。</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shrink-0">
          {[
            { id: 'daily', label: '特展', icon: '🚀' },
            { id: 'flashback', label: '挑战', icon: '⚡' },
            { id: 'gems', label: '全集', icon: '💎' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 md:px-5 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'daily' && (
        <div className="max-w-4xl mx-auto">
          {showCompletion ? (
            <div className="text-center space-y-6 py-12 animate-in zoom-in duration-500">
              <div className="text-6xl">🏆</div>
              <h3 className="text-2xl font-bold text-slate-900 serif-font">今日特展完成！</h3>
              <p className="text-slate-500">您已成功打磨了 5 个核心表达。坚持就是胜利。</p>
              <button onClick={() => { setShowCompletion(false); setCurrentIndex(0); setDailyPool([]); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">再来一组</button>
            </div>
          ) : currentGem ? (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 items-start animate-in slide-in-from-right-4 duration-500">
              {/* 词汇信息区 */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden h-full flex flex-col justify-center min-h-[160px] md:min-h-[200px]">
                  <div className="absolute top-2 right-4 opacity-5 text-6xl font-serif">“</div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest">PROGRESS {currentIndex + 1}/5</span>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-slate-900 mb-1 serif-font">{currentGem.word}</h3>
                  <p className="text-base md:text-lg text-slate-600 font-medium italic mb-4 leading-snug">{currentGem.meaning}</p>
                  <div className="bg-slate-50/80 p-3 rounded-xl border-l-4 border-indigo-400">
                    <p className="text-[11px] md:text-xs text-slate-500 italic leading-relaxed">“{currentGem.usage}”</p>
                  </div>
                </div>
              </div>

              {/* 输入与反馈区 */}
              <div className="lg:col-span-3 space-y-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">练习造句 Practice</h4>
                    {testResult && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${testResult.isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                        {testResult.isCorrect ? 'PERFECT' : 'POLISHED'}
                      </span>
                    )}
                  </div>
                  
                  <div className="relative group">
                    <textarea
                      value={userSentence}
                      onChange={(e) => setUserSentence(e.target.value)}
                      disabled={testResult !== null || isValidating}
                      placeholder={`在此尝试使用 "${currentGem.word}" ...`}
                      className={`w-full bg-white border border-slate-200 rounded-[2rem] p-5 text-sm md:text-base md:p-6 serif-font focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none min-h-[100px] md:min-h-[140px] ${testResult ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    
                    {testResult && (
                      <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] rounded-[2rem] flex items-center justify-center p-4">
                        <div className="w-full bg-white/95 p-4 rounded-2xl border border-slate-100 shadow-xl space-y-2 animate-in zoom-in duration-300">
                           <p className="text-[11px] text-slate-600 leading-relaxed italic line-clamp-2">“ {testResult.feedback} ”</p>
                           {testResult.betterVersion && !testResult.isCorrect && (
                             <div className="pt-2 border-t border-slate-50">
                               <p className="text-[8px] font-black text-slate-400 uppercase mb-1">精进版本:</p>
                               <p className="text-xs font-bold text-indigo-600 serif-font">{testResult.betterVersion}</p>
                             </div>
                           )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {testResult ? (
                      <>
                        {!testResult.isCorrect && (
                          <button onClick={handleRetry} className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all active:scale-95">🖋️ 重新挑战</button>
                        )}
                        <button onClick={handleNextWord} className="flex-1 bg-indigo-600 text-white py-3 rounded-2xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                          {currentIndex < dailyPool.length - 1 ? '下一个' : '完成特展'}
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={isValidating || userSentence.trim().length < 2}
                        onClick={handleValidation}
                        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 disabled:bg-slate-100 disabled:text-slate-300 transition-all active:scale-95 flex items-center justify-center space-x-2"
                      >
                        {isValidating ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <span>✦ 提交并审阅造句</span>}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">目前没有可供复习的词汇珍宝</p>
            </div>
          )}
        </div>
      )}

      {/* 句子挑战 */}
      {activeTab === 'flashback' && challengeData && (
        <div className="max-w-2xl mx-auto py-4 space-y-6 animate-in slide-in-from-right-4 duration-500">
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden text-center min-h-[220px] flex flex-col justify-center">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500/20"></div>
             <div className="text-xl md:text-2xl leading-[1.8] text-slate-700 serif-font italic transition-all duration-700">
                “ {renderChallengeText()} ”
             </div>
             {showAnswer && (
               <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-100 w-full text-left animate-in slide-in-from-top-4 duration-500">
                 <div className="space-y-3">
                    {challengeData.corrections.map((corr, idx) => (
                      <div key={idx} className="flex space-x-2 items-start">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                        <p className="text-xs text-slate-600 italic">
                          <span className="text-slate-400 line-through mr-2">{corr.original}</span>
                          <span className="text-indigo-600 font-bold">→ {corr.improved}</span>
                        </p>
                      </div>
                    ))}
                 </div>
               </div>
             )}
          </div>

          <div className="flex gap-3">
             <button onClick={nextChallenge} className="flex-1 bg-white border border-slate-200 py-3.5 rounded-2xl font-bold text-xs text-slate-600 hover:bg-slate-50 transition-all">换一个</button>
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)} className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-100 transition-all">揭晓修正</button>
              ) : (
                <button onClick={() => onReviewEntry(challengeData.entry)} className="flex-1 bg-indigo-50 text-indigo-600 py-3.5 rounded-2xl font-bold text-xs transition-all">查看全文</button>
              )}
          </div>
        </div>
      )}

      {/* 词汇全集 - 优化后的收集回顾模式 */}
      {activeTab === 'gems' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 animate-in fade-in duration-500 items-start">
          {allGems.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">收藏馆内尚无进阶表达</p>
            </div>
          ) : (
            allGems.map((gem, idx) => {
              const wordKey = `${gem.word}-${gem.entryId}`;
              const isExpanded = expandedWordKey === wordKey;
              
              return (
                <div 
                  key={idx} 
                  onClick={() => setExpandedWordKey(isExpanded ? null : wordKey)}
                  className={`bg-white rounded-[2.2rem] border transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col ${
                    isExpanded 
                      ? 'border-indigo-400 shadow-xl ring-4 ring-indigo-500/5' 
                      : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{gem.language}</span>
                      <div className="flex space-x-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (gem.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
                        ))}
                      </div>
                    </div>
                    
                    <h4 className={`text-lg font-black transition-colors ${isExpanded ? 'text-indigo-600' : 'text-slate-900 group-hover:text-indigo-600'}`}>
                      {gem.word}
                    </h4>
                    <p className="text-[11px] text-slate-500 italic mt-1 line-clamp-1">{gem.meaning}</p>
                    
                    {/* 状态提示圆点 - 保持精简预览 */}
                    {!isExpanded && gem.practices && gem.practices.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {gem.practices.map((p, pIdx) => (
                          <div key={pIdx} className={`w-1.5 h-1.5 rounded-full ${p.status === 'Perfect' ? 'bg-emerald-400' : 'bg-indigo-300'}`}></div>
                        ))}
                        <span className="text-[8px] font-bold text-slate-300 uppercase ml-auto">查看轨迹 →</span>
                      </div>
                    )}

                    {/* 展开后的记录区域 */}
                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <div className="flex items-center justify-between">
                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">历史练习足迹 Logs</h5>
                            <button 
                              onClick={(e) => { e.stopPropagation(); playAudio(gem.word, gem.word); }}
                              className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all"
                            >
                              <span className="text-[10px]">🎧</span>
                            </button>
                         </div>
                         
                         {gem.practices && gem.practices.length > 0 ? (
                           <div className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar pr-1">
                              {gem.practices.map((p, pIdx) => (
                                <div key={pIdx} className="bg-slate-50/80 p-3 rounded-2xl border-l-2 border-indigo-400 relative group/log">
                                   <p className="text-[11px] text-slate-600 serif-font italic leading-relaxed">“ {p.sentence} ”</p>
                                   <div className="flex justify-between items-center mt-2 opacity-60">
                                      <span className="text-[8px] font-bold text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</span>
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${p.status === 'Perfect' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                         {p.status}
                                      </span>
                                   </div>
                                </div>
                              ))}
                           </div>
                         ) : (
                           <p className="text-[10px] text-slate-400 italic py-4 text-center">尚未在特展中练习过此词</p>
                         )}

                         <div className="bg-slate-50 p-3 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">典藏例句 Masterwork</p>
                            <p className="text-[10px] text-slate-500 italic leading-relaxed">“ {gem.usage} ”</p>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {/* 页脚日期 */}
                  {!isExpanded && (
                    <div className="px-6 py-3 bg-slate-50/50 mt-auto border-t border-slate-50 flex items-center justify-between">
                       <span className="text-[8px] font-bold text-slate-400 uppercase">{gem.date} 入馆</span>
                       <span className="text-[8px] font-black text-indigo-400">DETAIL</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
