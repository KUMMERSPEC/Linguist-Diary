
import React, { useState, useMemo } from 'react';
import { DiaryEntry, AdvancedVocab, Correction } from '../types';
import { validateVocabUsage } from '../services/geminiService';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number) => void;
}

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry, onUpdateMastery }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'flashback'>('gems');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('All');
  
  // 造句挑战状态
  const [testingWord, setTestingWord] = useState<(AdvancedVocab & { entryId: string, language: string }) | null>(null);
  const [userSentence, setUserSentence] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [testResult, setTestResult] = useState<{ isCorrect: boolean, feedback: string, betterVersion?: string } | null>(null);

  const [challengeData, setChallengeData] = useState<{
    entry: DiaryEntry;
    correction: Correction;
    fullSentence: string;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  const availableLanguages = useMemo(() => {
    const langs = new Set(entries.map(e => e.language));
    return ['All', ...Array.from(langs)];
  }, [entries]);

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

  const handleVocabTest = async () => {
    if (!testingWord || !userSentence.trim() || isValidating) return;
    setIsValidating(true);
    setTestResult(null);

    const result = await validateVocabUsage(testingWord.word, testingWord.meaning, userSentence, testingWord.language);
    setTestResult(result);
    setIsValidating(false);

    if (result.isCorrect) {
      const currentMastery = testingWord.mastery || 0;
      if (currentMastery < 3) {
        onUpdateMastery(testingWord.entryId, testingWord.word, currentMastery + 1);
      }
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
    return <div className="py-20 text-center">🧪 珍宝阁空空如也</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 pb-20">
      <header className="space-y-1">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">珍宝复习馆</h2>
        <p className="text-slate-500 text-sm">在这里，知识将被凝固为永恒的馆藏。</p>
      </header>

      <div className="flex p-1 bg-slate-200/50 rounded-2xl w-full md:w-fit border border-slate-200">
        <button 
          onClick={() => { setActiveTab('gems'); setTestingWord(null); }}
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

      {activeTab === 'gems' && !testingWord && (
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGems.map((gem, idx) => (
              <div key={idx} className={`bg-white p-5 rounded-[2rem] border transition-all group relative overflow-hidden ${gem.mastery === 3 ? 'border-amber-200 shadow-amber-50 shadow-md' : 'border-slate-200 shadow-sm'}`}>
                {gem.mastery === 3 && <div className="absolute -top-1 -right-1 bg-amber-400 text-white px-3 py-1 rounded-bl-2xl text-[8px] font-black">MASTERED 🏆</div>}
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-black text-slate-900">{renderRuby(gem.word)}</h4>
                    <div className="flex space-x-1">
                      {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (gem.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 font-bold mb-3">{gem.meaning}</p>
                  
                  <button 
                    onClick={() => { setTestingWord(gem); setUserSentence(''); setTestResult(null); }}
                    className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black hover:bg-indigo-600 hover:text-white transition-all mb-3"
                  >
                    🚀 挑战造句提高熟练度
                  </button>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{gem.date}</span>
                    <button onClick={() => { const entry = entries.find(e => e.id === gem.entryId); if(entry) onReviewEntry(entry); }} className="text-[9px] font-black text-indigo-400 hover:underline">回看原文 →</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'gems' && testingWord && (
        <div className="max-w-xl mx-auto space-y-6 animate-in zoom-in duration-300">
           <div className="bg-white p-8 rounded-[3rem] border-2 border-slate-100 shadow-xl space-y-8">
              <div className="flex items-center justify-between">
                <button onClick={() => setTestingWord(null)} className="text-slate-400 hover:text-slate-900">← 返回阁内</button>
                <span className="text-[10px] font-black bg-indigo-600 text-white px-3 py-1 rounded-full uppercase">Mastery Test</span>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-3xl font-black text-slate-900">{renderRuby(testingWord.word)}</h3>
                <p className="text-slate-500 font-bold italic">{testingWord.meaning}</p>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">请输入包含此词语的句子：</p>
                <textarea 
                  value={userSentence}
                  onChange={(e) => setUserSentence(e.target.value)}
                  placeholder={`用 "${testingWord.word.replace(/\[(.*?)\]\(.*?\)/g, '$1')}" 造个句吧...`}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm serif-font italic min-h-[100px] focus:ring-2 focus:ring-indigo-500/20"
                />
                
                {!testResult && (
                   <button 
                    disabled={!userSentence.trim() || isValidating}
                    onClick={handleVocabTest}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 disabled:bg-slate-200"
                  >
                    {isValidating ? '馆长正在评审...' : '提交 AI 评审'}
                  </button>
                )}
              </div>

              {testResult && (
                <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-top-4 ${testResult.isCorrect ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-red-50 border-red-100 text-red-900'}`}>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{testResult.isCorrect ? '✅ 完美！熟练度提升' : '❌ 还需要打磨'}</span>
                  </div>
                  <p className="text-sm italic mb-3">“{testResult.feedback}”</p>
                  {testResult.betterVersion && (
                    <div className="pt-3 border-t border-black/5">
                      <p className="text-[10px] font-black uppercase mb-1 opacity-50">更地道的建议：</p>
                      <p className="text-sm font-bold">{testResult.betterVersion}</p>
                    </div>
                  )}
                  <button onClick={() => { setTestResult(null); setUserSentence(''); if(testResult.isCorrect) setTestingWord(null); }} className="mt-4 w-full py-2 bg-white/50 hover:bg-white rounded-xl text-xs font-black transition-all">
                    {testResult.isCorrect ? '太棒了，继续学习' : '再试一次'}
                  </button>
                </div>
              )}
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
