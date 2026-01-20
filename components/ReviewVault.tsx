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

  // 切换句子挑战 - 现在支持整句所有错误
  const nextChallenge = () => {
    const entriesWithCorrections = entries.filter(e => e.analysis && e.analysis.corrections.length > 0);
    if (entriesWithCorrections.length === 0) return;
    
    // 随机选一篇带有修正的日记
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

  // 音频播放逻辑
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
    const result = await validateVocabUsage(currentGem.word, currentGem.meaning, userSentence, currentGem.language);
    setTestResult(result);
    setIsValidating(false);

    // 更新熟练度
    const newMastery = result.isCorrect ? Math.min((currentGem.mastery || 0) + 1, 3) : Math.max((currentGem.mastery || 0) - 1, 0);
    onUpdateMastery(currentGem.entryId, currentGem.word, newMastery, {
      sentence: userSentence,
      feedback: result.feedback,
      betterVersion: result.betterVersion,
      timestamp: Date.now(),
      status: result.isCorrect ? 'Perfect' : 'Polished'
    });
  };

  // 动态渲染挑战文本，支持多个错误点
  const renderChallengeText = () => {
    if (!challengeData) return null;
    const { originalText } = challengeData.entry;
    const { corrections } = challengeData;

    // 转义正则特殊字符并按长度降序排序（防止子串覆盖匹配）
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">温故而知新，打磨您的表达艺术。</p>
      </header>

      <div className="flex bg-white p-1 rounded-2xl border border-slate-200 w-fit">
        {[
          { id: 'daily', label: '每日特展', icon: '🚀' },
          { id: 'flashback', label: '句子挑战', icon: '⚡' },
          { id: 'gems', label: '馆藏词汇', icon: '💎' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'daily' && (
        <div className="max-w-2xl mx-auto py-8">
          {showCompletion ? (
            <div className="text-center space-y-6 py-12 animate-in zoom-in duration-500">
              <div className="text-6xl">🏆</div>
              <h3 className="text-2xl font-bold text-slate-900 serif-font">今日特展完成！</h3>
              <p className="text-slate-500">您已成功打磨了 5 个核心表达。坚持就是胜利。</p>
              <button onClick={() => { setShowCompletion(false); setCurrentIndex(0); setDailyPool([]); }} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">再来一组</button>
            </div>
          ) : currentGem ? (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 text-8xl font-serif">“</div>
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">WORD OF THE DAY</span>
                <h3 className="text-4xl font-black text-slate-900 mb-2 serif-font">{currentGem.word}</h3>
                <p className="text-xl text-slate-600 font-medium mb-6 italic">{currentGem.meaning}</p>
                <div className="bg-slate-50 p-4 rounded-2xl border-l-4 border-indigo-400">
                  <p className="text-sm text-slate-500 italic leading-relaxed">“{currentGem.usage}”</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">练习造句 Practice</h4>
                <textarea
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  placeholder={`尝试使用 "${currentGem.word}" 造个句子吧...`}
                  className="w-full bg-white border border-slate-200 rounded-3xl p-6 text-lg serif-font focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none min-h-[120px]"
                />
                
                {testResult ? (
                  <div className={`p-6 rounded-3xl animate-in fade-in zoom-in duration-300 ${testResult.isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-orange-50 border border-orange-100'}`}>
                    <div className="flex items-start space-x-3">
                      <span className="text-2xl">{testResult.isCorrect ? '✅' : '💡'}</span>
                      <div>
                        <p className={`font-bold ${testResult.isCorrect ? 'text-emerald-800' : 'text-orange-800'}`}>{testResult.isCorrect ? '表达精准！' : '可以改进'}</p>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{testResult.feedback}</p>
                        {testResult.betterVersion && (
                          <div className="mt-4 pt-4 border-t border-slate-200/50">
                            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">更地道的说法</p>
                            <p className="text-indigo-600 font-bold serif-font">{testResult.betterVersion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (currentIndex < dailyPool.length - 1) {
                          setCurrentIndex(prev => prev + 1);
                          setUserSentence('');
                          setTestResult(null);
                        } else {
                          setShowCompletion(true);
                        }
                      }}
                      className="w-full mt-6 bg-white border border-slate-200 py-3 rounded-2xl font-bold text-slate-800 hover:bg-slate-50 transition-all"
                    >
                      {currentIndex < dailyPool.length - 1 ? '下一个挑战' : '查看总结'}
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={isValidating || userSentence.trim().length < 3}
                    onClick={handleValidation}
                    className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-indigo-100 disabled:bg-slate-200 transition-all active:scale-[0.98]"
                  >
                    {isValidating ? '馆长审阅中...' : '提交我的造句'}
                  </button>
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
        <div className="max-w-2xl mx-auto py-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
          <div className="text-center space-y-2">
            <span className="text-2xl">💡</span>
            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">这是您曾写下的句子，标记处需要修正。</h3>
          </div>

          <div className="bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden flex flex-col items-center text-center min-h-[250px] justify-center">
             <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500/20"></div>
             
             <div className="text-2xl md:text-3xl leading-[2] md:leading-[2.5] text-slate-700 serif-font italic max-w-lg transition-all duration-700">
                “ {renderChallengeText()} ”
             </div>

             {showAnswer && (
               <div className="mt-10 p-6 bg-slate-50 rounded-3xl border border-slate-100 w-full max-w-md animate-in slide-in-from-top-4 duration-500 text-left">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center">
                   <span className="mr-2">📝</span> 批注备注 HINTS
                 </p>
                 <div className="space-y-4">
                    {challengeData.corrections.map((corr, idx) => (
                      <div key={idx} className="flex space-x-3 group">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 shrink-0 group-hover:bg-indigo-500 transition-colors"></div>
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-600">
                            <span className="text-slate-400 line-through mr-2 font-normal">{corr.original}</span>
                            <span className="text-indigo-600">→ {corr.improved}</span>
                          </p>
                          <p className="text-xs text-slate-500 leading-relaxed italic">{corr.explanation}</p>
                        </div>
                      </div>
                    ))}
                 </div>
                 
                 {/* 整句朗读按钮 */}
                 <div className="mt-6 pt-4 border-t border-slate-200/50 flex justify-end">
                    <button 
                        onClick={() => playAudio(challengeData.entry.analysis?.modifiedText || '', 'flashback-full')}
                        disabled={isAudioLoading}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all text-xs font-bold ${playingAudioId === 'flashback-full' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
                    >
                        {isAudioLoading && playingAudioId === 'flashback-full' ? (
                            <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span className="text-lg">{playingAudioId === 'flashback-full' ? '⏹' : '🎧'}</span>
                        )}
                        <span>{playingAudioId === 'flashback-full' ? '正在播放修正朗读' : '朗读修正后的整句'}</span>
                    </button>
                 </div>
               </div>
             )}
          </div>

          <div className="flex space-x-4">
             <button 
                onClick={nextChallenge}
                className="flex-1 bg-white border border-slate-200 py-4 rounded-3xl font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
              >
                换一个挑战
              </button>
              {!showAnswer ? (
                <button 
                  onClick={() => setShowAnswer(true)}
                  className="flex-1 bg-indigo-600 text-white py-4 rounded-3xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  一键揭晓修正
                </button>
              ) : (
                <button 
                  onClick={() => onReviewEntry(challengeData.entry)}
                  className="flex-1 bg-indigo-100 text-indigo-600 py-4 rounded-3xl font-bold hover:bg-indigo-200 transition-all active:scale-95"
                >
                  查看全文报告
                </button>
              )}
          </div>
        </div>
      )}

      {activeTab === 'gems' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
          {allGems.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">收藏馆内尚无进阶表达</p>
            </div>
          ) : (
            allGems.map((gem, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{gem.language}</span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (gem.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
                </div>
                <h4 className="text-xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{gem.word}</h4>
                <p className="text-sm text-slate-500 mb-4 line-clamp-1 italic">{gem.meaning}</p>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">{gem.date}</span>
                  <button 
                    onClick={() => playAudio(gem.word, gem.word)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === gem.word ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}
                  >
                    {isAudioLoading && playingAudioId === gem.word ? (
                      <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (playingAudioId === gem.word ? '⏹' : '🎧')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewVault;