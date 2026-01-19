
import React, { useState, useMemo } from 'react';
import { DiaryEntry, AdvancedVocab, Correction } from '../types';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
}

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'flashback'>('gems');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  
  // 挑战相关状态
  const [challengeData, setChallengeData] = useState<{
    entry: DiaryEntry;
    correction: Correction;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showFullContext, setShowFullContext] = useState(false);

  // 1. 获取所有出现的语种用于过滤
  const availableLanguages = useMemo(() => {
    const langs = new Set(entries.map(e => e.language));
    return ['All', ...Array.from(langs)];
  }, [entries]);

  // 2. 聚合并过滤进阶词汇
  const filteredGems = useMemo(() => {
    const gems: (AdvancedVocab & { date: string, entryId: string, language: string })[] = [];
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

  // 3. 碎片化挑战逻辑：抽取一个具体的修正点
  const startChallenge = () => {
    if (entries.length === 0) return;
    const entriesWithCorrections = entries.filter(e => e.analysis && e.analysis.corrections.length > 0);
    if (entriesWithCorrections.length === 0) return;

    const randomEntry = entriesWithCorrections[Math.floor(Math.random() * entriesWithCorrections.length)];
    const corrections = randomEntry.analysis!.corrections;
    const randomCorrection = corrections[Math.floor(Math.random() * corrections.length)];

    setChallengeData({
      entry: randomEntry,
      correction: randomCorrection
    });
    setShowAnswer(false);
    setShowFullContext(false);
  };

  // 解析并渲染注音（Ruby）适配函数
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
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="text-6xl mb-4">🧪</div>
        <h3 className="text-xl font-bold text-slate-900">珍宝阁空空如也</h3>
        <p className="text-slate-500 max-w-xs">至少完成一篇带有 AI 批注的日记后，才能开启复习功能。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">碎片化复习，让每一个修正过的细节都化为肌肉记忆。</p>
      </header>

      {/* 模式选择 */}
      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit border border-slate-200">
        <button 
          onClick={() => setActiveTab('gems')}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'gems' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          💎 词汇珍宝阁
        </button>
        <button 
          onClick={() => { setActiveTab('flashback'); if(!challengeData) startChallenge(); }}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'flashback' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          ⏳ 碎片挑战模式
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'gems' && (
          <div className="space-y-6">
            {/* 语种过滤器 */}
            <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2">
              {availableLanguages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border-2 ${
                    selectedLanguage === lang 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                      : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                  }`}
                >
                  {lang === 'All' ? '🌐 全部语种' : lang}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGems.map((gem, idx) => (
                <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-black text-slate-900">{renderRuby(gem.word)}</h4>
                      <span className="text-[8px] bg-slate-900 text-white px-2 py-0.5 rounded-full font-bold uppercase">{gem.language}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold mb-3">{gem.meaning}</p>
                    <p className="text-[10px] text-slate-400 italic leading-relaxed mb-4 border-l-2 border-indigo-100 pl-3">
                      {renderRuby(gem.usage)}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{gem.date}</span>
                      <button 
                        onClick={() => {
                          const entry = entries.find(e => e.id === gem.entryId);
                          if(entry) onReviewEntry(entry);
                        }}
                        className="text-[9px] font-black text-indigo-500 hover:text-indigo-700 underline underline-offset-4"
                      >
                        回看原文 →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {filteredGems.length === 0 && <p className="text-center py-20 text-slate-400 italic">该语种下尚未收集到词汇...</p>}
          </div>
        )}

        {activeTab === 'flashback' && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            {challengeData ? (
              <div className="space-y-6">
                <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border-2 border-slate-100 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/5 -mr-8 -mt-8 rounded-full"></div>
                  <div className="absolute -top-4 left-10 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-lg uppercase">
                    Challenge: {challengeData.entry.language}
                  </div>
                  
                  <div className="space-y-8 relative z-10">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">待优化片段 (Original)</h4>
                        <span className="text-[9px] bg-red-50 text-red-500 px-2 py-0.5 rounded-md font-bold uppercase">{challengeData.correction.category}</span>
                      </div>
                      <p className="text-xl md:text-3xl serif-font italic text-slate-700 leading-relaxed bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                        “{challengeData.correction.original}”
                      </p>
                    </div>

                    {!showAnswer ? (
                      <div className="pt-4 space-y-4">
                        <div className="flex flex-col items-center space-y-4">
                          <p className="text-sm text-slate-500 font-medium">你能回想起教授建议的“更地道”表达吗？</p>
                          <button 
                            onClick={() => setShowAnswer(true)}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                          >
                            🔮 揭晓地道表达
                          </button>
                          <button 
                            onClick={() => setShowFullContext(!showFullContext)}
                            className="text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition-colors"
                          >
                            {showFullContext ? '🔼 隐藏上下文' : '🔽 查看日记原文背景'}
                          </button>
                        </div>
                        
                        {showFullContext && (
                          <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                             <p className="text-xs text-slate-400 font-bold uppercase mb-2">Full Context:</p>
                             <p className="text-sm text-slate-600 italic leading-relaxed">...{challengeData.entry.originalText}...</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-8 border-t-2 border-dashed border-indigo-100 animate-in fade-in zoom-in duration-500 space-y-6">
                         <div>
                          <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">地道表达 (Masterpiece Fragment)</h4>
                          <p className="text-xl md:text-3xl serif-font font-bold text-indigo-900 leading-relaxed">
                            {renderRuby(challengeData.correction.improved)}
                          </p>
                        </div>

                        <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100">
                           <p className="text-[10px] font-black text-indigo-300 uppercase mb-2">Professor's Advice</p>
                           <p className="text-sm text-indigo-700 leading-relaxed font-medium">{challengeData.correction.explanation}</p>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 pt-4">
                          <button 
                            onClick={startChallenge}
                            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg"
                          >
                            🔄 下一个碎片
                          </button>
                          <button 
                            onClick={() => onReviewEntry(challengeData.entry)}
                            className="flex-1 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
                          >
                            🧐 回看全篇批注
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20">
                <button onClick={startChallenge} className="text-indigo-600 font-bold underline">开启挑战</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewVault;
