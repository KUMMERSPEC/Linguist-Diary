
import React, { useState, useMemo } from 'react';
import { DiaryEntry, AdvancedVocab } from '../types';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
}

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'flashback'>('gems');
  const [randomEntry, setRandomEntry] = useState<DiaryEntry | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // 1. 聚合所有进阶词汇
  const allGems = useMemo(() => {
    const gems: (AdvancedVocab & { date: string, entryId: string })[] = [];
    entries.forEach(entry => {
      if (entry.analysis?.advancedVocab) {
        entry.analysis.advancedVocab.forEach(v => {
          gems.push({ ...v, date: entry.date, entryId: entry.id });
        });
      }
    });
    return gems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [entries]);

  // 2. 随机挑战逻辑
  const startChallenge = () => {
    if (entries.length === 0) return;
    const filtered = entries.filter(e => e.analysis);
    const random = filtered[Math.floor(Math.random() * filtered.length)];
    setRandomEntry(random);
    setShowAnswer(false);
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="text-6xl mb-4">🧪</div>
        <h3 className="text-xl font-bold text-slate-900">珍宝阁空空如也</h3>
        <p className="text-slate-500 max-w-xs">至少完成一篇日记并入馆后，才能开启复习功能。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">温故而知新，让碎片化的记忆凝结成永恒的语言能力。</p>
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
          onClick={() => { setActiveTab('flashback'); if(!randomEntry) startChallenge(); }}
          className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'flashback' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
        >
          ⏳ 时空复刻挑战
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'gems' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allGems.map((gem, idx) => (
                <div key={idx} className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50/50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-lg font-black text-slate-900">{gem.word}</h4>
                      <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold uppercase">{gem.level}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold mb-3">{gem.meaning}</p>
                    <p className="text-[10px] text-slate-400 italic leading-relaxed mb-4 border-l-2 border-indigo-100 pl-3">
                      {gem.usage}
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
            {allGems.length === 0 && <p className="text-center py-20 text-slate-400 italic">尚未收集到进阶词汇...</p>}
          </div>
        )}

        {activeTab === 'flashback' && (
          <div className="max-w-2xl mx-auto space-y-8 py-4">
            {randomEntry ? (
              <div className="space-y-6">
                <div className="bg-white p-8 md:p-12 rounded-[3rem] border-2 border-slate-100 shadow-xl relative">
                  <div className="absolute -top-4 left-10 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest shadow-lg">
                    MEMOIR FLASHBACK: {randomEntry.date}
                  </div>
                  
                  <div className="space-y-8">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">你的原文 (Original)</h4>
                      <p className="text-xl md:text-2xl serif-font italic text-slate-700 leading-relaxed">
                        "{randomEntry.originalText}"
                      </p>
                    </div>

                    {!showAnswer ? (
                      <div className="pt-8 border-t border-slate-50 space-y-4 text-center">
                        <p className="text-sm text-slate-500">试着运用你学过的单词和衔接词，在脑海中优化它。</p>
                        <button 
                          onClick={() => setShowAnswer(true)}
                          className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                        >
                          🔮 揭晓馆长笔记
                        </button>
                      </div>
                    ) : (
                      <div className="pt-8 border-t border-indigo-50 animate-in fade-in slide-in-from-top-4 duration-700 space-y-6">
                         <div>
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">馆藏成品 (Masterpiece)</h4>
                          <p className="text-xl md:text-2xl serif-font font-bold text-indigo-900 leading-relaxed">
                            {randomEntry.analysis?.modifiedText}
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                              <p className="text-[10px] font-black text-indigo-300 uppercase mb-2">Key Gem</p>
                              <p className="text-sm font-bold text-indigo-700">{randomEntry.analysis?.advancedVocab[0]?.word || "N/A"}</p>
                           </div>
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <p className="text-[10px] font-black text-slate-300 uppercase mb-2">Transition</p>
                              <p className="text-sm font-bold text-slate-700">{randomEntry.analysis?.transitionSuggestions[0]?.word || "N/A"}</p>
                           </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3">
                          <button 
                            onClick={startChallenge}
                            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-colors"
                          >
                            🔄 换一个片段
                          </button>
                          <button 
                            onClick={() => onReviewEntry(randomEntry)}
                            className="flex-1 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
                          >
                            🧐 查看详细批注
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
