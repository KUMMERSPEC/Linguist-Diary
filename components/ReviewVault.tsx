
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

  // 引用 textarea 以调整高度
  const practiceTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // 监听输入，动态调整 textarea 高度
  useEffect(() => {
    if (practiceTextareaRef.current) {
      practiceTextareaRef.current.style.height = 'auto';
      practiceTextareaRef.current.style.height = `${practiceTextareaRef.current.scrollHeight}px`;
    }
  }, [userSentence, testResult]);

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
    setPlayingAudioId(id);
    try {
      const base64Audio = await generateDiaryAudio(text);
      if (!base64Audio) {
        setPlayingAudioId(null);
        return;
      }
      const binaryString = atob(base64Audio);
      if (binaryString.length === 0) {
        setPlayingAudioId(null);
        return;
      }
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      const dataInt16 = new Int16Array(bytes.buffer);
      if (dataInt16.length === 0) {
        setPlayingAudioId(null);
        return;
      }
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) {
      console.error(e);
      setPlayingAudioId(null);
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
      
      // 核心修改：只有在完全正确 (Perfect) 时才创建练习记录 record，不再保存 Polished 句子
      const recordToSave: PracticeRecord | undefined = result.isCorrect ? {
        sentence: userSentence,
        originalAttempt: userSentence,
        feedback: result.feedback,
        timestamp: Date.now(),
        status: 'Perfect'
      } : undefined;

      onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, recordToSave);
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
        <div className="max-w-6xl mx-auto">
          {showCompletion ? (
            <div className="text-center space-y-6 py-12 animate-in zoom-in duration-500">
              <div className="text-6xl">🏆</div>
              <h3 className="text-2xl font-bold text-slate-900 serif-font">今日特展完成！</h3>
              <p className="text-slate-500">您已成功打磨了 5 个核心表达。坚持就是胜利。</p>
              <button onClick={() => { setShowCompletion(false); setCurrentIndex(0); setDailyPool([]); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">再来一组</button>
            </div>
          ) : currentGem ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch animate-in slide-in-from-right-4 duration-500">
              {/* 词汇信息区 - 居左展示 (PC端) */}
              <div className="bg-white p-5 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col items-center justify-center text-center h-full">
                <div className="absolute top-4 right-8 opacity-5 text-7xl font-serif">“</div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 md:mb-4">
                  PROGRESS {currentIndex + 1}/5
                </div>
                <div className="flex flex-col items-center">
                   <h3 className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900 mb-1 md:mb-2 serif-font">{currentGem.word}</h3>
                   <button 
                     onClick={() => playAudio(currentGem.word, `daily-${currentIndex}`)}
                     className={`mb-2 md:mb-4 w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === `daily-${currentIndex}` ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                   >
                     {playingAudioId === `daily-${currentIndex}` ? '⏹' : '🎧'}
                   </button>
                </div>
                <p className="text-sm md:text-lg lg:text-xl text-slate-600 font-medium italic mb-4 md:mb-6 leading-snug">{currentGem.meaning}</p>
                <div className="bg-slate-50/80 p-3 md:p-5 rounded-2xl border-l-4 border-indigo-400 max-w-full w-full">
                  <p className="text-[11px] md:text-sm text-slate-500 italic leading-relaxed text-left">“{currentGem.usage}”</p>
                </div>
              </div>

              {/* 交互练习区 - 居右展示 (PC端) */}
              <div className="flex flex-col h-full space-y-4">
                <div className="flex items-center justify-between px-2 shrink-0">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">练习造句 Practice</h4>
                  {testResult && (
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${testResult.isCorrect ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100' : 'bg-indigo-600 text-white shadow-md shadow-indigo-100'}`}>
                      {testResult.isCorrect ? '✦ PERFECT' : '✦ POLISHED'}
                    </span>
                  )}
                </div>
                
                {!testResult ? (
                  <div className="flex flex-col space-y-4 h-fit md:flex-1 md:h-full">
                    <textarea
                      ref={practiceTextareaRef}
                      rows={1}
                      value={userSentence}
                      onChange={(e) => setUserSentence(e.target.value)}
                      disabled={isValidating}
                      placeholder={`在此尝试使用 "${currentGem.word}" ...`}
                      className={`w-full bg-white border border-slate-200 rounded-[2.5rem] p-5 md:p-8 text-base md:text-lg serif-font focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none min-h-[56px] md:min-h-0 md:flex-1 ${isValidating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <button
                      disabled={isValidating || userSentence.trim().length < 2}
                      onClick={handleValidation}
                      className="w-full shrink-0 bg-indigo-600 text-white py-3 md:py-4 rounded-3xl font-bold shadow-xl shadow-indigo-100 disabled:bg-slate-100 disabled:text-slate-300 transition-all active:scale-[0.97] flex items-center justify-center space-x-2"
                    >
                      {isValidating ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : <span>✦ 提交并审阅造句</span>}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-4 animate-in slide-in-from-top-4 duration-500 h-full">
                    <div className="bg-slate-50 p-4 md:p-6 rounded-[2.5rem] border border-slate-200 shrink-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">您的尝试 Attempt</p>
                      <p className="text-sm md:text-lg text-slate-800 serif-font italic leading-relaxed">“ {userSentence} ”</p>
                    </div>

                    <div className="flex-1 bg-white p-5 md:p-8 rounded-[2.5rem] border border-indigo-100 shadow-xl shadow-indigo-200/20 space-y-4 overflow-y-auto no-scrollbar">
                       <div className="flex items-start space-x-4">
                          <span className="text-2xl shrink-0">🏛️</span>
                          <div className="space-y-1">
                             <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">馆长评价 Appraisal</p>
                             <div className="text-xs md:text-sm text-slate-700 leading-relaxed italic font-medium">
                               {testResult.feedback}
                             </div>
                          </div>
                       </div>
                       
                       {testResult.betterVersion && !testResult.isCorrect && (
                         <div className="bg-indigo-50/50 p-4 md:p-5 rounded-[2rem] border border-indigo-100">
                           <div className="flex items-center justify-between mb-2">
                             <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">精进推荐:</p>
                             <button 
                               onClick={() => playAudio(testResult.betterVersion!, 'better-version')}
                               className={`w-6 h-6 rounded-full flex items-center justify-center ${playingAudioId === 'better-version' ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-100 text-indigo-500'}`}
                             >
                               <span className="text-[10px]">🎧</span>
                             </button>
                           </div>
                           <p className="text-sm md:text-base font-bold text-indigo-700 serif-font leading-relaxed">{testResult.betterVersion}</p>
                         </div>
                       )}
                    </div>

                    <div className="flex gap-3 shrink-0">
                      {!testResult.isCorrect && (
                        <button onClick={handleRetry} className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-3 rounded-2xl text-[11px] font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm">🖋️ 重新挑战</button>
                      )}
                      <button onClick={handleNextWord} className="flex-[2] bg-indigo-600 text-white py-3 rounded-2xl text-[11px] font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                        {currentIndex < dailyPool.length - 1 ? '下一个' : '完成特展'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">目前没有可供复习的词汇珍宝</p>
            </div>
          )}
        </div>
      )}

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
                      <div key={idx} className="flex space-x-2 items-start justify-between group">
                        <div className="flex space-x-2 items-start">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></div>
                           <p className="text-xs text-slate-600 italic">
                             <span className="text-slate-400 line-through mr-2">{corr.original}</span>
                             <span className="text-indigo-600 font-bold">→ {corr.improved}</span>
                           </p>
                        </div>
                        <button 
                          onClick={() => playAudio(corr.improved, `challenge-corr-${idx}`)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all ${playingAudioId === `challenge-corr-${idx}` ? 'bg-indigo-600 text-white opacity-100' : 'bg-indigo-100 text-indigo-400'}`}
                        >
                          <span className="text-[10px]">🎧</span>
                        </button>
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
                  className={`bg-white rounded-[2.2rem] border transition-all duration-300 cursor-pointer overflow-hidden group flex flex-col ${
                    isExpanded 
                      ? 'border-indigo-400 shadow-xl ring-4 ring-indigo-500/5' 
                      : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                  }`}
                  onClick={() => setExpandedWordKey(isExpanded ? null : wordKey)}
                >
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{gem.language}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); playAudio(gem.word, wordKey); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === wordKey ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-400 opacity-60 hover:opacity-100'}`}
                        >
                          <span className="text-[10px]">{playingAudioId === wordKey ? '⏹' : '🎧'}</span>
                        </button>
                      </div>
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
                    
                    {!isExpanded && gem.practices && gem.practices.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-1.5">
                        {gem.practices.map((p, pIdx) => (
                          <div key={pIdx} className={`w-1.5 h-1.5 rounded-full ${p.status === 'Perfect' ? 'bg-emerald-400' : 'bg-indigo-300'}`}></div>
                        ))}
                        <span className="text-[8px] font-bold text-slate-300 uppercase ml-auto">查看轨迹 →</span>
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                         <div className="flex items-center justify-between">
                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">历史练习足迹 Logs</h5>
                         </div>
                         
                         {gem.practices && gem.practices.length > 0 ? (
                           <div className="space-y-3 max-h-[200px] overflow-y-auto no-scrollbar pr-1">
                              {gem.practices.map((p, pIdx) => (
                                <div key={pIdx} className="bg-slate-50/80 p-3 rounded-2xl border-l-2 border-indigo-400 relative group/log flex items-start justify-between">
                                   <div className="flex-1">
                                      <p className="text-[11px] text-slate-600 serif-font italic leading-relaxed">“ {p.sentence} ”</p>
                                      <div className="flex justify-between items-center mt-2 opacity-60">
                                         <span className="text-[8px] font-bold text-slate-400">{new Date(p.timestamp).toLocaleDateString()}</span>
                                         <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${p.status === 'Perfect' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                            {p.status}
                                         </span>
                                      </div>
                                   </div>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); playAudio(p.sentence, `log-${wordKey}-${pIdx}`); }}
                                     className={`ml-2 shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === `log-${wordKey}-${pIdx}` ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-400 opacity-40 hover:opacity-100'}`}
                                   >
                                      <span className="text-[8px]">🎧</span>
                                   </button>
                                </div>
                              ))}
                           </div>
                         ) : (
                           <p className="text-[10px] text-slate-400 italic py-4 text-center">尚未在特展中练习过此词</p>
                         )}

                         <div className="bg-slate-50 p-3 rounded-2xl flex items-start justify-between">
                            <div className="flex-1">
                               <p className="text-[8px] font-black text-slate-400 uppercase mb-1">典藏例句 Masterwork</p>
                               <p className="text-[10px] text-slate-500 italic leading-relaxed">“ {gem.usage} ”</p>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); playAudio(gem.usage, `usage-${wordKey}`); }}
                              className={`ml-2 shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === `usage-${wordKey}` ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-400 opacity-40 hover:opacity-100'}`}
                            >
                               <span className="text-[8px]">🎧</span>
                            </button>
                         </div>
                      </div>
                    )}
                  </div>
                  
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
