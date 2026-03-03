
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DiaryEntry, AdvancedVocab, InspirationFragment } from '../types';
import { renderRuby, detectLanguage } from '../utils/textHelpers';

interface DashboardProps {
  onNewEntry: () => void;
  onStartReview: (mode: 'single' | 'combo') => void; 
  entries: DiaryEntry[];
  allAdvancedVocab: AdvancedVocab[]; 
  recommendedIteration?: DiaryEntry | null;
  onStartIteration?: (entry: DiaryEntry) => void;
  onSaveFragment: (content: string, language: string, type: 'transient' | 'seed') => Promise<void>;
  onPromoteFragment?: (id: string) => Promise<void>;
  fragments?: InspirationFragment[];
  preferredLanguages?: string[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNewEntry, 
  onStartReview, 
  entries, 
  allAdvancedVocab,
  recommendedIteration,
  onStartIteration,
  onSaveFragment,
  onPromoteFragment,
  fragments = [],
  preferredLanguages = ['English']
}) => {
  const [fragmentText, setFragmentText] = useState('');
  const [fragmentType, setFragmentType] = useState<'transient' | 'seed'>('transient');
  const [isSavingFragment, setIsSavingFragment] = useState(false);
  const [isReviewMenuOpen, setIsReviewMenuOpen] = useState(false);

  // Daily Spotlight: Choose a high-mastery gem or a polished sentence from history
  const spotlight = useMemo(() => {
    const polishedGems = allAdvancedVocab.filter(v => (v.mastery || 0) >= 3 && v.practices && v.practices.length > 0);
    if (polishedGems.length === 0) return null;
    
    // Use date as seed for daily consistency
    const daySeed = new Date().toDateString();
    let hash = 0;
    for (let i = 0; i < daySeed.length; i++) {
      hash = daySeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % polishedGems.length;
    const gem = polishedGems[index];
    
    // Prefer a practice version if available
    const practice = gem.practices?.find(p => p.status === 'Perfect' || p.betterVersion);
    return {
      word: gem.word,
      sentence: practice?.betterVersion || practice?.originalAttempt || gem.usage,
      language: gem.language
    };
  }, [allAdvancedVocab]);

  const masteryData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]; 
    allAdvancedVocab.forEach(v => {
      const m = Math.min(Math.max(v.mastery || 0, 0), 5);
      counts[m]++;
    });

    const labels = ['🥚 初见', '🐣 启蒙', '🐥 熟悉', '🐔 掌握', '✨ 熟稔', '🏆 巅峰'];
    return counts.map((count, i) => ({
      name: labels[i],
      level: i,
      count: count
    }));
  }, [allAdvancedVocab]);

  const { columns, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const counts: { [key: string]: number } = {};
    entries.forEach(entry => {
      const d = new Date(entry.timestamp);
      d.setHours(0, 0, 0, 0);
      counts[d.toDateString()] = (counts[d.toDateString()] || 0) + 1;
    });

    // Calculate the start date (364 days ago)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    // Align start date to the beginning of that week (Sunday)
    const startOfGrid = new Date(startDate);
    startOfGrid.setDate(startDate.getDate() - startDate.getDay());

    const cols: { date: Date; count: number }[][] = [];
    const labels: { text: string; index: number }[] = [];
    let lastMonth = -1;

    // 53 weeks to cover 365+ days
    for (let w = 0; w < 53; w++) {
      const week: { date: Date; count: number }[] = [];
      let weekContainsMonthStart = false;
      let monthName = '';

      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startOfGrid);
        currentDate.setDate(startOfGrid.getDate() + (w * 7) + d);
        
        week.push({ 
          date: currentDate, 
          count: counts[currentDate.toDateString()] || 0 
        });
        
        if (currentDate.getDate() === 1) {
          weekContainsMonthStart = true;
          monthName = currentDate.toLocaleDateString('en-US', { month: 'short' });
        }
      }

      if (weekContainsMonthStart && monthName) {
        // Only add if it's not too close to the previous label (at least 2 weeks gap)
        const lastLabel = labels[labels.length - 1];
        if (!lastLabel || (w - lastLabel.index) >= 2) {
          labels.push({ text: monthName, index: w });
        }
      }
      cols.push(week);
    }
    return { columns: cols, monthLabels: labels };
  }, [entries]);

  const stats = useMemo(() => {
    const total = entries.length;
    const rehearsalCount = entries.filter(e => e.type === 'rehearsal').length;
    const vocabCount = allAdvancedVocab.length;
    return { total, rehearsalCount, vocabCount };
  }, [entries, allAdvancedVocab]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    return 'bg-indigo-600';
  };

  const BAR_COLORS = ['#f1f5f9', '#e0e7ff', '#818cf8', '#4f46e5', '#3730a3', '#f59e0b'];

  const handleCaptureFragment = async () => {
    if (!fragmentText.trim() || isSavingFragment) return;
    setIsSavingFragment(true);
    try {
      // Auto-detect language
      const lang = detectLanguage(fragmentText);
      await onSaveFragment(fragmentText, lang, fragmentType); 
      setFragmentText('');
    } finally {
      setIsSavingFragment(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-8 px-4 md:px-8 pb-12 md:pb-8 animate-in fade-in duration-700 space-y-4 md:space-y-6">
      <section className="space-y-4">
        <header className="px-1 space-y-0.5">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font tracking-tight">馆长，欢迎回来。</h2>
          <p className="text-slate-500 text-xs md:text-sm italic">云端同步已就绪，今天想记录些什么？</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <button 
            onClick={onNewEntry}
            className="group relative bg-indigo-600 p-5 md:p-6 rounded-[1.8rem] md:rounded-[2.2rem] text-white flex items-center justify-between shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>
            <div className="text-left relative z-10">
              <h5 className="text-lg font-bold serif-font">开启今日撰写</h5>
              <p className="text-indigo-100 text-[9px] mt-0.5 opacity-70 uppercase tracking-widest font-black">Daily Language Entry</p>
            </div>
            <span className="text-2xl group-hover:translate-x-1.5 transition-transform relative z-10">→</span>
          </button>
          
          <div className="relative group">
            <button 
              onClick={() => setIsReviewMenuOpen(!isReviewMenuOpen)} 
              className={`w-full group relative p-5 md:p-6 rounded-[1.8rem] md:rounded-[2.2rem] text-white flex items-center justify-between shadow-xl transition-all active:scale-[0.98] overflow-hidden ${isReviewMenuOpen ? 'bg-slate-800 ring-4 ring-slate-200' : 'bg-slate-900 shadow-slate-200 hover:bg-slate-800'}`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 pointer-events-none"></div>
              <div className="text-left relative z-10">
                <h5 className="text-lg font-bold serif-font">打磨馆藏珍宝</h5>
                <p className="text-slate-400 text-[9px] mt-0.5 opacity-70 uppercase tracking-widest font-black">Review & Refine</p>
              </div>
              <span className={`text-2xl transition-transform relative z-10 ${isReviewMenuOpen ? 'rotate-90' : 'group-hover:translate-x-1.5'}`}>
                {isReviewMenuOpen ? '✕' : '→'}
              </span>
            </button>

            {isReviewMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[1.8rem] shadow-2xl border border-slate-100 p-2 z-50 animate-in slide-in-from-top-2 flex flex-col space-y-1">
                <button 
                  onClick={() => { onStartReview('single'); setIsReviewMenuOpen(false); }}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors group/opt"
                >
                  <div className="text-left">
                    <span className="block text-sm font-bold text-slate-900 serif-font">单词造句 Normal Mode</span>
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Focus on one gem at a time</span>
                  </div>
                  <span className="text-xl opacity-0 group-hover/opt:opacity-100 transition-opacity">🖋️</span>
                </button>
                <div className="h-[1px] bg-slate-50 mx-4"></div>
                <button 
                  onClick={() => { onStartReview('combo'); setIsReviewMenuOpen(false); }}
                  className="flex items-center justify-between p-4 rounded-2xl hover:bg-indigo-50 transition-colors group/opt"
                >
                  <div className="text-left">
                    <span className="block text-sm font-bold text-indigo-600 serif-font">多词造句 Combo Challenge</span>
                    <span className="block text-[8px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">Weave multiple gems together</span>
                  </div>
                  <span className="text-xl opacity-0 group-hover/opt:opacity-100 transition-opacity">✨</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Daily Spotlight Component - Minimized Height */}
        {spotlight && (
          <div className="bg-white border border-slate-100 py-3 px-5 md:py-4 md:px-6 rounded-[1.8rem] md:rounded-[2rem] shadow-lg shadow-slate-200/40 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
            <div className="absolute top-0 right-0 p-3 md:p-4 opacity-5">
              <span className="text-4xl md:text-5xl serif-font font-black italic select-none">“</span>
            </div>
            <div className="relative z-10 space-y-1.5 md:space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-amber-500 text-[10px]">✨</span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em]">今日展映 CURATOR'S SPOTLIGHT</span>
              </div>
              <h3 
                className="text-sm md:text-base font-black text-slate-900 serif-font leading-snug"
                dangerouslySetInnerHTML={{ __html: `“ ${renderRuby(spotlight.sentence)} ”` }}
              />
              <div className="flex items-center space-x-2.5 pt-0.5">
                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[7px] font-black rounded-md uppercase tracking-widest">{spotlight.language}</span>
                <span className="text-slate-200">/</span>
                <span 
                  className="text-[10px] font-bold text-slate-800 serif-font"
                  dangerouslySetInnerHTML={{ __html: renderRuby(spotlight.word) }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white p-5 md:p-6 rounded-[1.8rem] md:rounded-[2.2rem] border border-slate-200 shadow-sm relative group overflow-hidden h-auto">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-bl-[3rem] -mr-6 -mt-6 opacity-30 pointer-events-none"></div>
        <div className="flex items-center justify-between mb-3 relative z-10">
          <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">灵感碎片快捕 FRAGMENT CAPTURE</h4>
          <div className="flex bg-slate-100 p-0.5 rounded-lg">
             <button 
               onClick={(e) => { e.stopPropagation(); setFragmentType('transient'); }}
               className={`px-2 py-1 rounded-md text-[8px] font-black transition-all cursor-pointer ${fragmentType === 'transient' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               📜 随笔
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); setFragmentType('seed'); }}
               className={`px-2 py-1 rounded-md text-[8px] font-black transition-all cursor-pointer ${fragmentType === 'seed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               🌱 种子
             </button>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative z-10">
          <input 
            type="text" 
            value={fragmentText}
            onChange={(e) => setFragmentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCaptureFragment()}
            placeholder={fragmentType === 'transient' ? "捕捉一个引子..." : "捕捉一个生词种子..."} 
            className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs serif-font text-slate-700 focus:ring-2 focus:ring-indigo-500/10"
            disabled={isSavingFragment}
          />
          <button 
            onClick={handleCaptureFragment}
            disabled={!fragmentText.trim() || isSavingFragment}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md active:scale-95 disabled:opacity-50 transition-all ${isSavingFragment ? 'bg-indigo-400' : 'bg-indigo-600 text-white'}`}
          >
            {isSavingFragment ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span className="text-lg">✨</span>
            )}
          </button>
        </div>
      </section>
      
      {/* Seed Fragments Section */}
      {fragments.filter(f => f.fragmentType === 'seed').length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">待磨炼种子 SEED GEMS</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {fragments.filter(f => f.fragmentType === 'seed').slice(0, 6).map((seed) => (
              <div key={seed.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded uppercase tracking-widest">{seed.language}</span>
                  <button 
                    onClick={() => onPromoteFragment?.(seed.id)}
                    className="text-[10px] text-slate-400 hover:text-indigo-600 font-bold flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span>入馆</span>
                    <span>✨</span>
                  </button>
                </div>
                <h5 
                  className="text-sm font-bold text-slate-800 serif-font line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: renderRuby(seed.content) }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {recommendedIteration && (
        <section className="animate-in slide-in-from-top-4 duration-1000">
          <div className="relative group bg-amber-50 border border-amber-200 p-5 md:p-8 rounded-[1.8rem] md:rounded-[2.2rem] shadow-xl shadow-amber-100/50 overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100/50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">🕰️</span>
                  <h3 className="text-[9px] font-black text-amber-800 uppercase tracking-[0.2em]">时光回响 TIME'S ECHO</h3>
                </div>
                <h4 className="text-lg font-bold text-slate-900 serif-font">往昔作品正待新笔触。</h4>
                <p className="text-amber-900/60 text-[10px] italic leading-snug max-w-xl">
                  “ {recommendedIteration.date} 的记录。现在的您，能赋予它新的生命吗？ ”
                </p>
              </div>
              <button 
                onClick={() => onStartIteration?.(recommendedIteration)}
                className="bg-amber-800 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/10 hover:bg-amber-900 transition-all active:scale-95 shrink-0"
              >
                开启迭代 →
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
          <div className="flex justify-between items-start mb-0.5">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">馆藏记录</p>
             <div className="flex items-center space-x-1.5 text-[7px] font-black text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                <span className="relative flex h-1 w-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                </span>
                <span>ONLINE</span>
             </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 serif-font mt-0.5">{stats.total}</h3>
        </div>
        
        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">演练记录</p>
          <div className="flex items-baseline space-x-1.5">
            <h3 className="text-2xl font-black text-slate-900 serif-font mt-0.5">{stats.rehearsalCount}</h3>
            <span className="text-amber-500 text-[10px]">✨</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col justify-between md:col-span-1 col-span-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">馆藏珍宝</p>
          <h3 className="text-2xl font-black text-indigo-600 serif-font mt-0.5">{stats.vocabCount}</h3>
        </div>
      </div>

      <section className="bg-white p-6 rounded-[1.8rem] md:rounded-[2.2rem] border border-slate-200 shadow-sm overflow-hidden h-auto">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">年度足迹 ANNUAL FOOTPRINT</h4>
        </div>
        
        <div className="w-full overflow-x-auto no-scrollbar pb-2">
          <div className="min-w-max flex flex-col">
            {/* Month Labels Row */}
            <div className="flex ml-8 mb-2 relative h-4">
              {monthLabels.map((label, i) => (
                <span 
                  key={i} 
                  className="absolute text-[8px] font-bold text-slate-400 uppercase whitespace-nowrap"
                  style={{ left: `${label.index * 13}px` }}
                >
                  {label.text}
                </span>
              ))}
            </div>

            <div className="flex">
              {/* Day Labels Column - Perfectly aligned with grid rows */}
              <div className="flex flex-col gap-[3px] pr-2 py-[2px] h-[88px] w-8 shrink-0">
                <div className="h-[10px]"></div> {/* Sun */}
                <span className="h-[10px] text-[8px] font-bold text-slate-400 uppercase opacity-60 flex items-center">Mon</span>
                <div className="h-[10px]"></div> {/* Tue */}
                <span className="h-[10px] text-[8px] font-bold text-slate-400 uppercase opacity-60 flex items-center">Wed</span>
                <div className="h-[10px]"></div> {/* Thu */}
                <span className="h-[10px] text-[8px] font-bold text-slate-400 uppercase opacity-60 flex items-center">Fri</span>
                <div className="h-[10px]"></div> {/* Sat */}
              </div>

              {/* Grid Columns */}
              <div className="flex gap-[3px] flex-grow">
                {columns.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                    {week.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        title={`${day.date.toLocaleDateString('zh-CN')}: ${day.count} 篇`}
                        className={`w-[10px] h-[10px] rounded-[1.5px] transition-all ${getColor(day.count)} cursor-crosshair`}
                      ></div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-6 rounded-[1.8rem] md:rounded-[2.2rem] border border-slate-200 shadow-sm mb-4 h-auto">
        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6">珍宝磨炼进度 POLISH LEVELS</h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={masteryData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fill: '#cbd5e1'}} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                {masteryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
