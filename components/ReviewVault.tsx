
import React, { useState, useMemo, useEffect } from 'react';
import { DiaryEntry, AdvancedVocab, Correction, PracticeRecord } from '../types';
import { validateVocabUsage } from '../services/geminiService';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
}

type ExtendedVocab = AdvancedVocab & { date: string, entryId: string, language: string };

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry, onUpdateMastery }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'flashback' | 'daily'>('daily');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  
  // 每日特展状态
  const [dailyPool, setDailyPool] = useState<ExtendedVocab[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCompletion, setShowCompletion] = useState(false);

  // 单词测试状态
  const [userSentence, setUserSentence] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ isCorrect: boolean, feedback: string, betterVersion?: string } | null>(null);

  // 展开词汇详情
  const [expandedWord, setExpandedWord] = useState<string | null>(null);

  // 句子挑战状态 (旧功能)
  const [challengeData, setChallengeData] = useState<{
    entry: DiaryEntry;
    correction: Correction;
    fullSentence: string;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // 初始化每日特展池
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

  const availableLanguages = useMemo(() => {
    const langs = new Set(entries.map(e => e.language));
    return ['All', ...Array.from(langs)];
  }, [entries]);

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
    setTestResult(null);

    const result = await validateVocabUsage(wordObj.word, wordObj.meaning, userSentence, wordObj.language);
    setTestResult(result);
    setIsValidating(false);

    if (result.isCorrect) {
      const currentMastery = wordObj.mastery || 0;
      const newMastery = Math.min(3, currentMastery + 1);
      
      const record: PracticeRecord = {
        sentence: userSentence,
        feedback: result.feedback,
        betterVersion: result.betterVersion,
        timestamp: Date.now()
      };
      
      onUpdateMastery(wordObj.entryId, wordObj.word, newMastery, record);
    }
  };

  const nextWord = () => {
    setTestResult(null);
    setUserSentence('');
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

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <div className="text-6xl grayscale opacity-50">🏛️</div>
        <h3 className="text-xl font-bold text-slate-900">珍宝阁尚未开启</h3>
        <p className="text-slate-500 max-w-xs text-sm">记录第一篇日记后，系统将为您自动收录词汇珍宝。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">在这里，知识将被凝固为永恒的馆藏。</p>
      </header>

      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit border border-slate-200">
        <button 
          onClick={() => { setActiveTab('daily'); setShowCompletion(false); setDailyPool([]); setCurrentIndex(0); }}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'daily' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          ✨ 每日特展
        </button>
        <button 
          onClick={() => setActiveTab('gems')}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'gems' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          💎 词汇总览
        </button>
        <button 
          onClick={() => { setActiveTab('flashback'); if(!challengeData) startChallenge(); }}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'flashback' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          ⏳ 句子挑战
        </button>
      </div>

      {activeTab === 'daily' && (
        <div className="max-w-xl mx-auto space-y-6">
          {showCompletion ? (
            <div className="bg-white p-12 rounded-[3rem] border-2 border-slate-100 shadow-2xl text-center space-y-8 animate-in zoom-in">
              <div className="text-7xl">🏆</div>
              <div className="space-y-2">
                <h3 className="text-3xl font-black text-slate-900 serif-font">今日策展完成！</h3>
                <p className="text-slate-500 font-bold">您已完成了今日 10 个核心词汇的深度练习。</p>
              </div>
              <div className="pt-8 border-t border-slate-50 flex justify-center space-x-4">
                 <button onClick={() => { setActiveTab('gems'); }} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all">返回词库</button>
                 <button onClick={() => { setDailyPool([]); setShowCompletion(false); setCurrentIndex(0); }} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all">再练 10 个</button>
              </div>
            </div>
          ) : dailyPool.length > 0 ? (
            <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-8 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">Exhibition {currentIndex + 1}/10</span>
                </div>
                <div className="flex space-x-1">
                  {dailyPool.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? 'bg-indigo-600 scale-125' : i < currentIndex ? 'bg-emerald-400' : 'bg-slate-100'}`}></div>
                  ))}
                </div>
              </div>

              <div className="text-center space-y-4">
                <h3 className="text-4xl font-black text-slate-900">{renderRuby(dailyPool[currentIndex].word)}</h3>
                <div className="inline-block bg-slate-50 px-4 py-2 rounded-2xl">
                  <p className="text-slate-500 font-bold italic text-sm">{dailyPool[currentIndex].meaning}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                  <span>🖋️</span>
                  <span>请尝试为该词造句：</span>
                </p>
                <textarea 
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  placeholder={`写下你的句子...`}
                  className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-base serif-font italic min-h-[120px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all no-scrollbar"
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
                  <div className={`p-6 rounded-3xl border animate-in slide-in-from-top-4 ${testResult.isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-900'}`}>
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-xl">{testResult.isCorrect ? '✨ 表达精准！' : '🔬 建议优化'}</span>
                    </div>
                    <p className="text-sm italic mb-4 leading-relaxed">{testResult.feedback}</p>
                    {testResult.betterVersion && (
                      <div className="pt-4 border-t border-black/5 mb-4">
                        <p className="text-[10px] font-black uppercase mb-1.5 opacity-40">更地道的方案 (Native Suggestion)：</p>
                        <p className="text-sm font-bold serif-font">{testResult.betterVersion}</p>
                      </div>
                    )}
                    <button onClick={testResult.isCorrect ? nextWord : () => setTestResult(null)} className="w-full py-4 bg-white/60 hover:bg-white rounded-2xl text-xs font-black transition-all shadow-sm">
                      {testResult.isCorrect ? (currentIndex === dailyPool.length - 1 ? '完成今日特展' : '进入下一个') : '重新修改'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 animate-pulse text-slate-400">馆长正在为您筹备特展...</div>
          )}
        </div>
      )}

      {activeTab === 'gems' && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2">
            {availableLanguages.map(lang => (
              <button
                key={lang}
                onClick={() => setSelectedLanguage(lang)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                  selectedLanguage === lang ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-400'
                }`}
              >
                {lang === 'All' ? '🌐 全部' : lang}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGems.map((gem, idx) => {
              const isExpanded = expandedWord === `${gem.word}-${gem.entryId}`;
              return (
                <div 
                  key={idx} 
                  onClick={() => setExpandedWord(isExpanded ? null : `${gem.word}-${gem.entryId}`)}
                  className={`bg-white p-6 rounded-[2.5rem] border transition-all group relative cursor-pointer ${isExpanded ? 'ring-2 ring-indigo-500 shadow-2xl col-span-1 md:col-span-2' : 'hover:border-indigo-300 shadow-sm'}`}
                >
                  {gem.mastery === 3 && <div className="absolute top-4 right-6 text-xl">🏆</div>}
                  
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-black text-slate-900">{renderRuby(gem.word)}</h4>
                      <div className="flex space-x-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`w-2 h-2 rounded-full ${i <= (gem.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 font-bold">{gem.meaning}</p>
                    
                    {isExpanded && (
                      <div className="pt-6 border-t border-slate-100 space-y-6 animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-3">
                          <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                            <span>📜</span>
                            <span>珍宝磨炼志 (Practice Records)</span>
                          </h5>
                          {(!gem.practices || gem.practices.length === 0) ? (
                            <p className="text-xs text-slate-400 italic">尚未在每日特展中进行磨炼。</p>
                          ) : (
                            <div className="space-y-4">
                              {gem.practices.map((rec, pIdx) => (
                                <div key={pIdx} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 relative">
                                  <span className="absolute top-3 right-4 text-[8px] font-bold text-slate-300">#{pIdx + 1}</span>
                                  <p className="text-sm font-medium text-slate-800 serif-font italic leading-relaxed">“{rec.sentence}”</p>
                                  {rec.betterVersion && (
                                    <div className="pt-2 mt-2 border-t border-slate-200">
                                      <p className="text-[9px] font-black text-indigo-500 uppercase mb-1">地道表达建议：</p>
                                      <p className="text-xs text-indigo-900 font-bold">{renderRuby(rec.betterVersion)}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                           <button onClick={(e) => { e.stopPropagation(); const entry = entries.find(e => e.id === gem.entryId); if(entry) onReviewEntry(entry); }} className="text-[10px] font-black text-indigo-600 hover:underline">查看初次记录原文 →</button>
                           <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{gem.date}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'flashback' && (
        <div className="max-w-2xl mx-auto space-y-6 py-4">
          {challengeData ? (
            <div className="bg-white p-8 md:p-14 md:pt-24 rounded-[3.5rem] border-2 border-slate-100 shadow-2xl relative animate-in zoom-in duration-500">
              <div className="absolute top-8 left-10 bg-slate-900 text-white px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] shadow-lg uppercase z-30">
                 Sentence Lab • {challengeData.entry.language}
              </div>
              <div className="space-y-10 relative z-10">
                <div className="space-y-6 text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">这段表达可以如何优化？</p>
                  <p className="text-2xl md:text-3xl serif-font italic text-slate-800 leading-relaxed px-4">“{challengeData.fullSentence}”</p>
                  {!showAnswer && (
                    <button onClick={() => setShowAnswer(true)} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-xl hover:bg-indigo-700 transition-all">揭晓馆长建议</button>
                  )}
                </div>
                {showAnswer && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                    <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-black text-emerald-400 uppercase mb-2">进阶表达 (Refined)</p>
                      <p className="text-xl md:text-2xl serif-font font-bold text-slate-900">{renderRuby(challengeData.correction.improved)}</p>
                    </div>
                    <p className="text-sm md:text-base text-indigo-900 italic">“{challengeData.correction.explanation}”</p>
                    <button onClick={startChallenge} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs">下一个挑战</button>
                  </div>
                )}
              </div>
            </div>
          ) : <div className="text-center py-20 animate-pulse text-slate-400">正在寻找挑战...</div>}
        </div>
      )}
    </div>
  );
};

export default ReviewVault;
