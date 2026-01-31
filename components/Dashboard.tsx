
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DiaryEntry, AdvancedVocab } from '../types';
import { renderRuby } from '../utils/textHelpers';

interface DashboardProps {
  onNewEntry: () => void;
  onStartReview: () => void; 
  entries: DiaryEntry[];
  allAdvancedVocab: AdvancedVocab[]; 
  recommendedIteration?: DiaryEntry | null;
  onStartIteration?: (entry: DiaryEntry) => void;
  onSaveFragment: (content: string, language: string, type: 'transient' | 'seed') => Promise<void>;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNewEntry, 
  onStartReview, 
  entries, 
  allAdvancedVocab,
  recommendedIteration,
  onStartIteration,
  onSaveFragment
}) => {
  const [fragmentText, setFragmentText] = useState('');
  const [fragmentType, setFragmentType] = useState<'transient' | 'seed'>('transient');
  const [isSavingFragment, setIsSavingFragment] = useState(false);

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

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    const startOfGrid = new Date(startDate);
    startOfGrid.setDate(startDate.getDate() - startDate.getDay());

    const cols: { date: Date; count: number }[][] = [];
    const labels: { text: string; index: number }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < 53; w++) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startOfGrid);
        currentDate.setDate(startOfGrid.getDate() + (w * 7) + d);
        week.push({ date: currentDate, count: counts[currentDate.toDateString()] || 0 });
        
        if (d === 0) {
          const currentMonth = currentDate.getMonth();
          if (currentMonth !== lastMonth) {
            if (w < 49) {
              labels.push({ 
                text: currentDate.toLocaleDateString('zh-CN', { month: 'short' }), 
                index: w 
              });
            }
            lastMonth = currentMonth;
          }
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
      await onSaveFragment(fragmentText, 'English', fragmentType); 
      setFragmentText('');
    } finally {
      setIsSavingFragment(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-24 md:pb-12 animate-in fade-in duration-700 space-y-8">
      <section className="space-y-6">
        <header className="px-2 space-y-1">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 serif-font tracking-tight">馆长，欢迎回来。</h2>
          <p className="text-slate-500 text-sm md:text-base italic">云端同步已就绪，今天想记录些什么？</p>
        </header>

        {/* Daily Spotlight Component */}
        {spotlight && (
          <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <span className="text-8xl serif-font font-black italic select-none">“</span>
            </div>
            <div className="relative z-10 space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-amber-500">✨</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">今日展映 Curator's Spotlight</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 serif-font leading-relaxed">
                “ {renderRuby(spotlight.sentence)} ”
              </h3>
              <div className="flex items-center space-x-3 pt-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-lg uppercase tracking-widest">{spotlight.language}</span>
                <span className="text-slate-300">/</span>
                <span className="text-sm font-bold text-slate-800 serif-font">{renderRuby(spotlight.word)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onNewEntry}
            className="group relative bg-indigo-600 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>
            <div className="text-left relative z-10">
              <h5 className="text-xl font-bold serif-font">开启今日撰写</h5>
              <p className="text-indigo-100 text-[10px] mt-1 opacity-70 uppercase tracking-widest font-black">Daily Language Entry</p>
            </div>
            <span className="text-3xl group-hover:translate-x-2 transition-transform relative z-10">→</span>
          </button>
          
          <button 
            onClick={onStartReview} 
            className="group relative bg-slate-900 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>
            <div className="text-left relative z-10">
              <h5 className="text-xl font-bold serif-font">打磨馆藏珍宝</h5>
              <p className="text-slate-400 text-[10px] mt-1 opacity-70 uppercase tracking-widest font-black">Review & Refine</p>
            </div>
            <span className="text-3xl group-hover:translate-x-2 transition-transform relative z-10">→</span>
          </button>
        </div>
      </section>

      <section className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[4rem] -mr-8 -mt-8 opacity-40 pointer-events-none"></div>
        <div className="flex items-center justify-between mb-4 relative z-10">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">灵感碎片快捕 Fragment Capture</h4>
          <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={(e) => { e.stopPropagation(); setFragmentType('transient'); }}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${fragmentType === 'transient' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               📜 随笔 (引子)
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); setFragmentType('seed'); }}
               className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all cursor-pointer ${fragmentType === 'seed' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
             >
               🌱 种子 (AI解析)
             </button>
          </div>
        </div>
        <div className="flex items-center space-x-3 relative z-10">
          <input 
            type="text" 
            value={fragmentText}
            onChange={(e) => setFragmentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCaptureFragment()}
            placeholder={fragmentType === 'transient' ? "捕捉一个想写但还没写的引子..." : "捕捉一个生词或表达种子..."} 
            className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm serif-font text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
            disabled={isSavingFragment}
          />
          <button 
            onClick={handleCaptureFragment}
            disabled={!fragmentText.trim() || isSavingFragment}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 transition-all ${isSavingFragment ? 'bg-indigo-400' : 'bg-indigo-600 text-white'}`}
          >
            {isSavingFragment ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span className="text-xl">✨</span>
            )}
          </button>
        </div>
      </section>

      {recommendedIteration && (
        <section className="animate-in slide-in-from-top-4 duration-1000">
          <div className="relative group bg-amber-50 border border-amber-200 p-6 md:p-10 rounded-[2.5rem] shadow-2xl shadow-amber-100/50 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-100/50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110 duration-1000 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">🕰️</span>
                  <h3 className="text-[10px] font-black text-amber-800 uppercase tracking-[0.3em]">时光回响 Time's Echo</h3>
                </div>
                <h4 className="text-xl md:text-2xl font-bold text-slate-900 serif-font">馆长，这件往昔作品正待您的新笔触。</h4>
                <p className="text-amber-900/60 text-xs md:text-sm italic leading-relaxed max-w-2xl">
                  “ 您在 {recommendedIteration.date} 留下的记录已尘封。现在的您，是否能用更精进的语言，赋予它新的生命？ ”
                </p>
              </div>
              <button 
                onClick={() => onStartIteration?.(recommendedIteration)}
                className="bg-amber-800 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-amber-900/20 hover:bg-amber-900 transition-all active:scale-95 shrink-0"
              >
                开启迭代 REWRITE →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Stats Cards Section - Updated */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors relative group overflow-hidden">
          <div className="flex justify-between items-start mb-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆藏记录 Total</p>
             <div className="flex items-center space-x-1.5 text-[8px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>ONLINE</span>
             </div>
          </div>
          <h3 className="text-3xl font-black text-slate-900 serif-font mt-1">{stats.total}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-amber-200 transition-colors">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">演练记录 Rehearsals</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-3xl font-black text-slate-900 serif-font mt-1">{stats.rehearsalCount}</h3>
            <span className="text-amber-500 text-xs">✨</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors flex flex-col justify-between">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆藏珍宝 Gems</p>
          <h3 className="text-3xl font-black text-indigo-600 serif-font mt-1">{stats.vocabCount}</h3>
        </div>
      </div>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">馆长年度足迹 Annual Footprint</h4>
        </div>
        
        <div className="overflow-x-auto no-scrollbar pb-2">
          <div className="relative h-5 mb-1 ml-8 w-full min-w-max">
            {monthLabels.map((label, i) => (
              <span 
                key={i} 
                className="absolute text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap"
                style={{ left: `${label.index * 14}px` }}
              >
                {label.text}
              </span>
            ))}
          </div>

          <div className="flex min-w-max">
            <div className="flex flex-col gap-[3px] pr-3 justify-between py-[2px] h-[95px] w-8 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Mon</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Wed</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Fri</span>
            </div>

            <div className="flex gap-[3px]">
              {columns.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      title={`${day.date.toLocaleDateString('zh-CN')}: ${day.count} 篇`}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-all ${getColor(day.count)} cursor-crosshair`}
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm mb-12">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">馆藏珍宝磨炼进度 Gems Polish Levels</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={masteryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#cbd5e1'}} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                {masteryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={BAR_COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-6 flex justify-center">
           <p className="text-[10px] text-slate-400 italic">基于当前库中 {stats.vocabCount} 件词汇珍宝的掌握情况分布</p>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
