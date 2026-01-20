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
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  
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
  const [originalAttempt, setOriginalAttempt] = useState<string>(''); 

  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  // 句子挑战
  const [challengeData, setChallengeData] = useState<{
    entry: DiaryEntry;
    correction: Correction;
    fullSentence: string;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (activeTab === 'daily' && dailyPool.length === 0) {
      const allGems: ExtendedVocab[] = [];
      entries.forEach(entry => {
        if (entry.analysis?.advancedVocab) {
          entry.analysis.advancedVocab.forEach(v => {
            allGems.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
          });
        }
      });

      const pool = allGems
        .sort((a, b) => (a.mastery || 0) - (b.mastery || 0))
        .slice(0, 15)
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);
      
      setDailyPool(pool);
    }
  }, [activeTab, entries, dailyPool.length]);

  const filteredGems = useMemo(() => {
    const gems: ExtendedVocab[] = [];
    entries.forEach(entry => {
      if (entry.analysis?.advancedVocab) {
        entry.analysis.advancedVocab.forEach(v => {
          if (selectedLanguage === 'All' || entry.language === selectedLanguage) {
            gems.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
          }
        });
      }
    });
    return gems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries, selectedLanguage]);

  // --- 音频播放核心逻辑 ---
  const handlePlayAudio = async (text: string, id: string) => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }

    setPlayingAudioId(id);
    try {
      const base64Audio = await generateDiaryAudio(text);
      if (!base64Audio) throw new Error("Audio generation failed");
      
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;

      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = audioCtx.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (error) {
      console.error("Audio playback error:", error);
      setPlayingAudioId(null);
    }
  };

  const startChallenge = () => {
    const entriesWithCorrections = entries.filter(e => e.analysis && e.analysis.corrections.length > 0);
    if (entriesWithCorrections.length === 0) return;
    const randomEntry = entriesWithCorrections[Math.floor(Math.random() * entriesWithCorrections.length)];
    const corrections = randomEntry.analysis!.corrections;
    const randomCorrection = corrections[Math.floor(Math.random() * corrections.length)];
    const sentences = randomEntry.originalText.split(/([.!?。！？\n])/);
    let fullSentence = "";
    for (let i = 0; i < sentences.length; i++) {
        if (sentences[i].includes(randomCorrection.original)) {
            fullSentence = (sentences[i] + (sentences[i+1] || "")).trim();
            break;
        }
    }
    if (!fullSentence) fullSentence = randomCorrection.original;
    setChallengeData({ entry: randomEntry, correction: randomCorrection, fullSentence });
    setShowAnswer(false);
  };

  const handleTestSubmit = async (wordObj: ExtendedVocab) => {
    if (!userSentence.trim() || isValidating) return;
    setIsValidating(true);
    if (!originalAttempt) setOriginalAttempt(userSentence);

    try {
      const result = await validateVocabUsage(wordObj.word, wordObj.meaning, userSentence, wordObj.language);
      setTestResult(result);
      if (result.isCorrect) {
        setTimeout(() => finalizeRecord(wordObj, result, 'Perfect'), 1500);
      }
    } catch (e) {
      alert("评审失败，请重试。");
    } finally {
      setIsValidating(false);
    }
  };

  const finalizeRecord = (wordObj: ExtendedVocab, result: any, status: 'Perfect' | 'Polished') => {
    const currentMastery = wordObj.mastery || 0;
    const increment = status === 'Perfect' ? 1 : 0.5;
    const newMastery = Math.min(3, currentMastery + increment);
    
    const record: PracticeRecord = {
      sentence: status === 'Perfect' ? userSentence : (result.betterVersion || userSentence),
      originalAttempt: status === 'Polished' ? originalAttempt : undefined,
      feedback: result.feedback,
      betterVersion: result.betterVersion,
      timestamp: Date.now(),
      status: status
    };
    
    onUpdateMastery(wordObj.entryId, wordObj.word, newMastery, record);
    nextWord();
  };

  const nextWord = () => {
    setTestResult(null);
    setUserSentence('');
    setOriginalAttempt('');
    if (currentIndex < dailyPool.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setShowCompletion(true);
    }
  };

  const renderRuby = (input: string) => {
    const rubyRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = rubyRegex.exec(input)) !== null) {
      if (match.index > lastIndex) parts.push(input.substring(lastIndex, match.index));
      parts.push(
        <ruby key={match.index} className="mx-[1px]">
          {match[1]}<rt className="text-[10px] opacity-60 font-medium text-indigo-500/80">{match[2]}</rt>
        </ruby>
      );
      lastIndex = rubyRegex.lastIndex;
    }
    if (lastIndex < input.length) parts.push(input.substring(lastIndex));
    return parts.length > 0 ? parts : input;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">记录每一次从生疏到精准的跨越。</p>
      </header>

      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit border border-slate-200">
        <button onClick={() => { setActiveTab('daily'); setShowCompletion(false); setDailyPool([]); setCurrentIndex(0); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>✨ 每日特展</button>
        <button onClick={() => setActiveTab('gems')} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'gems' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>💎 词汇总览</button>
        <button onClick={() => { setActiveTab('flashback'); if(!challengeData) startChallenge(); }} className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'flashback' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>⏳ 句子挑战</button>
      </div>

      {activeTab === 'daily' && (
        <div className="max-w-xl mx-auto space-y-6">
          {showCompletion ? (
            <div className="bg-white p-12 rounded-[3rem] border-2 border-slate-100 shadow-2xl text-center space-y-8 animate-in zoom-in">
              <div className="text-7xl">🏆</div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 serif-font">今日策展完成！</h3>
                <p className="text-slate-500 font-bold">错误是进步的阶梯，您的每一次“淬炼”都已录入馆藏。</p>
              </div>
              <div className="pt-8 border-t border-slate-50 flex justify-center space-x-4">
                 <button onClick={() => setActiveTab('gems')} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">查看学习足迹</button>
                 <button onClick={() => { setDailyPool([]); setShowCompletion(false); setCurrentIndex(0); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all">开启新一轮特展</button>
              </div>
            </div>
          ) : dailyPool.length > 0 ? (
            <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-8 relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">Exhibition {currentIndex + 1}/10</span>
                <div className="flex space-x-1">{dailyPool.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-indigo-600 scale-125' : i < currentIndex ? 'bg-emerald-400' : 'bg-slate-100'}`}></div>)}</div>
              </div>

              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-3">
                  <h3 className="text-4xl font-black text-slate-900">{renderRuby(dailyPool[currentIndex].word)}</h3>
                  <button 
                    onClick={() => handlePlayAudio(dailyPool[currentIndex].word, `daily-${currentIndex}`)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === `daily-${currentIndex}` ? 'bg-indigo-600 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    {playingAudioId === `daily-${currentIndex}` ? '🔊' : '🎧'}
                  </button>
                </div>
                <div className="inline-block bg-slate-50 px-4 py-2 rounded-2xl">
                  <p className="text-slate-500 font-bold italic text-sm">{dailyPool[currentIndex].meaning}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2"><span>🖋️</span><span>请尝试为该词造句：</span></p>
                <textarea 
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  placeholder={`在此输入您的表达...`}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-base serif-font italic min-h-[120px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all no-scrollbar"
                  disabled={isValidating || (testResult !== null && testResult.isCorrect)}
                />
                
                {!testResult ? (
                   <button 
                    disabled={!userSentence.trim() || isValidating} 
                    onClick={() => handleTestSubmit(dailyPool[currentIndex])} 
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 disabled:bg-slate-200 transition-all active:scale-95"
                   >
                    {isValidating ? '馆长评审中...' : '提交 AI 评审'}
                  </button>
                ) : (
                  <div className={`p-6 rounded-3xl border animate-in slide-in-from-top-4 ${testResult.isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-amber-50 border-amber-100 text-amber-900'}`}>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-xl">{testResult.isCorrect ? '✨ 表达精准！' : '⚖️ 发现瑕疵'}</span>
                    </div>
                    <p className="text-sm italic mb-4 leading-relaxed">{testResult.feedback}</p>
                    
                    {!testResult.isCorrect && (
                      <div className="space-y-4">
                        <div className="p-4 bg-white/50 rounded-2xl border border-amber-200">
                          <p className="text-[10px] font-black text-amber-600 uppercase mb-2">对比确认 (Contrast)：</p>
                          <div className="space-y-2">
                            <p className="text-xs text-slate-400 line-through">您的原文：{originalAttempt}</p>
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-bold serif-font text-emerald-700 flex-1">修正建议：{testResult.betterVersion}</p>
                              <button 
                                onClick={() => handlePlayAudio(testResult.betterVersion || "", "suggestion")}
                                className="ml-2 text-indigo-500 hover:text-indigo-700"
                              >
                                {playingAudioId === "suggestion" ? '🔊' : '🎧'}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <button 
                            onClick={() => setTestResult(null)} 
                            className="py-4 bg-white text-amber-600 border border-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shadow-sm"
                          >
                            重新尝试
                          </button>
                          <button 
                            onClick={() => finalizeRecord(dailyPool[currentIndex], testResult, 'Polished')} 
                            className="py-4 bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-md"
                          >
                            收录并跳过
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {testResult.isCorrect && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-center p-3 bg-emerald-100/50 rounded-xl">
                          <span className="text-[10px] font-black text-emerald-600 uppercase">一次通过！正在进入下一项...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : <div className="text-center py-20 animate-pulse text-slate-400">正在为您布展...</div>}
        </div>
      )}

      {activeTab === 'gems' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">全部词汇藏品</h3>
            <select 
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/10"
            >
                <option value="All">所有语言</option>
                {Array.from(new Set(entries.map(e => e.language))).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGems.length > 0 ? filteredGems.map((vocab, idx) => (
              <div key={idx} className="flex flex-col">
                <div 
                  className={`bg-white p-5 rounded-[2rem] border transition-all group flex flex-col justify-between h-full ${
                    expandedWord === vocab.word ? 'border-indigo-400 ring-4 ring-indigo-50/50 shadow-lg z-10' : 'border-slate-200 hover:border-indigo-200'
                  }`}
                >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h4 
                          onClick={() => setExpandedWord(expandedWord === vocab.word ? null : vocab.word)}
                          className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors cursor-pointer"
                        >
                          {renderRuby(vocab.word)}
                        </h4>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handlePlayAudio(vocab.word, `gem-${idx}`); }}
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${playingAudioId === `gem-${idx}` ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-500'}`}
                        >
                          {playingAudioId === `gem-${idx}` ? '🔊' : '🎧'}
                        </button>
                      </div>
                      <div className="flex space-x-0.5">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`w-2 h-2 rounded-full ${i <= (vocab.mastery || 0) ? 'bg-indigo-600' : 'bg-slate-100'}`}></div>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 font-medium mb-4 line-clamp-2">{vocab.meaning}</p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{vocab.date}</span>
                        <span 
                          onClick={() => setExpandedWord(expandedWord === vocab.word ? null : vocab.word)}
                          className="text-[9px] font-black text-indigo-500 uppercase flex items-center cursor-pointer"
                        >
                          {vocab.practices?.length || 0} 磨炼记 {expandedWord === vocab.word ? '▴' : '▾'}
                        </span>
                    </div>
                </div>

                {expandedWord === vocab.word && (
                  <div className="mt-2 bg-slate-50 rounded-[2rem] p-5 border border-slate-200 space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                      <span>🏛️</span>
                      <span>历次淬炼记录 (Growth Marks)</span>
                    </h5>
                    
                    {vocab.practices && vocab.practices.length > 0 ? (
                      <div className="space-y-3">
                        {vocab.practices.map((p, pIdx) => (
                          <div key={pIdx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2 relative overflow-hidden">
                            <div className="flex justify-between items-center mb-1">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${p.status === 'Perfect' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                {p.status === 'Perfect' ? 'Perfectly Expressed' : 'Polished & Refined'}
                              </span>
                              <div className="flex items-center space-x-2">
                                <button 
                                  onClick={() => handlePlayAudio(p.sentence, `practice-${idx}-${pIdx}`)}
                                  className={`text-[10px] ${playingAudioId === `practice-${idx}-${pIdx}` ? 'text-indigo-600' : 'text-slate-400'}`}
                                >
                                  {playingAudioId === `practice-${idx}-${pIdx}` ? '🔊' : '🎧'}
                                </button>
                                <span className="text-[8px] text-slate-300 font-bold">{new Date(p.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                            
                            {p.originalAttempt && (
                              <p className="text-xs text-slate-400 line-through italic leading-relaxed">
                                {p.originalAttempt}
                              </p>
                            )}
                            
                            <p className={`text-sm serif-font leading-relaxed ${p.status === 'Perfect' ? 'text-slate-800' : 'text-indigo-700 font-bold'}`}>
                              {renderRuby(p.sentence)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">暂无练习记录</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )) : (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">暂无此语言的词汇藏品...</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'flashback' && challengeData && (
        <div className="max-w-xl mx-auto space-y-8 animate-in zoom-in duration-500">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-2xl space-y-8">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest">Random Flashback</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{challengeData.entry.language}</span>
            </div>

            <div className="space-y-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                    <span>💡</span><span>这是您曾写下的句子，还记得怎么修正吗？</span>
                </h4>
                <div className="p-8 bg-slate-50 rounded-[2.5rem] border-l-4 border-indigo-400 italic serif-font text-xl text-slate-500 leading-relaxed">
                   “ {challengeData.fullSentence.replace(challengeData.correction.improved, ' ______ ')} ”
                </div>
                
                <div className="bg-indigo-50/50 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-indigo-900 leading-relaxed">
                        <span className="opacity-50 mr-2 uppercase">Hint:</span>
                        {challengeData.correction.explanation}
                    </p>
                </div>
            </div>

            {showAnswer ? (
                <div className="space-y-6 animate-in slide-in-from-top-4">
                    <div className="p-8 bg-indigo-600 rounded-[2.5rem] text-white serif-font text-xl leading-relaxed shadow-xl shadow-indigo-200 flex items-start justify-between">
                        <div className="flex-1">{renderRuby(challengeData.correction.improved)}</div>
                        <button 
                          onClick={() => handlePlayAudio(challengeData.correction.improved, "flashback-ans")}
                          className="ml-4 bg-white/20 p-2 rounded-full"
                        >
                          {playingAudioId === "flashback-ans" ? '🔊' : '🎧'}
                        </button>
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={startChallenge} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">换一个挑战</button>
                        <button onClick={() => onReviewEntry(challengeData.entry)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-lg">回顾全文分析</button>
                    </div>
                </div>
            ) : (
                <button 
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm hover:bg-black transition-all shadow-xl active:scale-95"
                >
                    👀 揭晓精准表达
                </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewVault;