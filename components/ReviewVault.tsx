
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
    fullSentence: string;
    maskedSentence: string;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  // 1. 获取所有出现的语种
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

  // 3. 句子级挑战逻辑
  const startChallenge = () => {
    if (entries.length === 0) return;
    const entriesWithCorrections = entries.filter(e => e.analysis && e.analysis.corrections.length > 0);
    if (entriesWithCorrections.length === 0) return;

    const randomEntry = entriesWithCorrections[Math.floor(Math.random() * entriesWithCorrections.length)];
    const corrections = randomEntry.analysis!.corrections;
    const randomCorrection = corrections[Math.floor(Math.random() * corrections.length)];

    // 尝试在原文中定位包含该错误的完整句子
    const sentences = randomEntry.originalText.split(/[.!?。！？\n]/);
    const fullSentence = sentences.find(s => s.includes(randomCorrection.original)) || randomCorrection.original;

    // 将错误片段替换为 ⓘ 标识符
    const maskedSentence = fullSentence.replace(randomCorrection.original, ' ⓘ ');

    setChallengeData({
      entry: randomEntry,
      correction: randomCorrection,
      fullSentence,
      maskedSentence
    });
    setShowAnswer(false);
  };

  // 解析并渲染注音（Ruby）
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
        <p className="text-slate-500 text-sm">以句为鉴，在语境中重温每一次精准的表达。</p>
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
          ⏳ 句子挑战
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'gems' && (
          <div className="space-y-6">
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
          </div>
        )}

        {activeTab === 'flashback' && (
          <div className="max-w-2xl mx-auto space-y-6 py-4">
            {challengeData ? (
              <div className="bg-white p-8 md:p-14 rounded-[3.5rem] border-2 border-slate-100 shadow-2xl relative overflow-hidden animate-in zoom-in duration-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 -mr-12 -mt-12 rounded-full"></div>
                <div className="absolute -top-4 left-10 bg-slate-900 text-white px-5 py-2 rounded-full text-[10px] font-black tracking-[0.2em] shadow-lg uppercase">
                   Sentence Lab • {challengeData.entry.language}
                </div>
                
                <div className="space-y-10 relative z-10">
                  <div className="space-y-6 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">这段表达在 ⓘ 处可以如何优化？</p>
                    
                    <div className="relative group">
                       <p className="text-2xl md:text-3xl serif-font italic text-slate-800 leading-relaxed px-4">
                        “{challengeData.maskedSentence}”
                      </p>
                      {/* 气泡提示 */}
                      {!showAnswer && (
                        <div className="mt-6 flex justify-center">
                          <div className="inline-flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                            <span className="animate-pulse">💡</span>
                            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">思考一下地道的句式...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {!showAnswer ? (
                    <div className="pt-6">
                      <button 
                        onClick={() => setShowAnswer(true)}
                        className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-sm shadow-xl shadow-indigo-200 active:scale-95 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3"
                      >
                        <span>🔮 揭晓馆长建议</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 bg-red-50/50 rounded-3xl border border-red-100/50">
                          <p className="text-[10px] font-black text-red-300 uppercase mb-2">原始片段 (Original)</p>
                          <p className="text-lg serif-font text-red-700 italic line-through decoration-red-300/50">
                            {challengeData.correction.original}
                          </p>
                        </div>
                        <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-400 uppercase mb-2">进阶表达 (Refined)</p>
                          <p className="text-xl md:text-2xl serif-font font-bold text-slate-900">
                            {renderRuby(challengeData.correction.improved)}
                          </p>
                        </div>
                      </div>

                      <div className="bg-indigo-50/30 p-8 rounded-[2.5rem] border border-indigo-100 relative">
                         <div className="absolute -top-3 left-8 bg-indigo-600 text-white px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest">Professor's Insight</div>
                         <p className="text-sm md:text-base text-indigo-900 leading-relaxed serif-font italic">
                           “{challengeData.correction.explanation}”
                         </p>
                      </div>

                      <div className="flex flex-col md:flex-row gap-4 pt-4">
                        <button 
                          onClick={startChallenge}
                          className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-colors shadow-lg flex items-center justify-center space-x-2"
                        >
                          <span>🔄 下一个挑战</span>
                        </button>
                        <button 
                          onClick={() => onReviewEntry(challengeData.entry)}
                          className="flex-1 py-4 border-2 border-slate-200 text-slate-500 rounded-2xl font-bold text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center space-x-2"
                        >
                          <span>📖 回看完整日记</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 animate-pulse">
                <p className="text-slate-400 font-bold">正在搜寻最具挑战性的句子...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewVault;
