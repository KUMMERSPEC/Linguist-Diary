
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry } from '../types';

interface DashboardProps {
  onNewEntry: () => void;
  onStartReview: () => void; 
  entries: DiaryEntry[];
  recommendedIteration?: DiaryEntry | null;
  onStartIteration?: (entry: DiaryEntry) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  onNewEntry, 
  onStartReview, 
  entries, 
  recommendedIteration,
  onStartIteration 
}) => {
  // --- 近 7 天趋势图数据 ---
  const chartData = React.useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return { 
        name: d.toLocaleDateString('zh-CN', { weekday: 'short' }),
        dateStr: d.toDateString(),
        entries: 0 
      };
    }).reverse();

    entries.forEach(entry => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      const day = last7Days.find(d => d.dateStr === entryDate.toDateString());
      if (day) day.entries += 1;
    });

    return last7Days;
  }, [entries]);

  // --- 热力图数据 ---
  const { columns, monthLabels } = React.useMemo(() => {
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

  const stats = React.useMemo(() => {
    const total = entries.length;
    const rehearsalCount = entries.filter(e => e.type === 'rehearsal').length;
    return { total, rehearsalCount };
  }, [entries]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    return 'bg-indigo-600';
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-24 md:pb-12 animate-in fade-in duration-700 space-y-8">
      {/* 时光回响推荐卡片 (Time's Echo) */}
      {recommendedIteration && (
        <section className="animate-in slide-in-from-top-4 duration-1000">
          <div className="relative group bg-amber-50 border border-amber-200 p-6 md:p-10 rounded-[2.5rem] shadow-2xl shadow-amber-100/50 overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-100/50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110 duration-1000"></div>
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
                <div className="pt-2 text-[9px] font-bold text-amber-800/40 uppercase tracking-widest">
                  Original: {recommendedIteration.originalText.substring(0, 40)}...
                </div>
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

      {/* 1. 馆长欢迎区 & 核心动作按钮 */}
      <section className="space-y-6">
        <header className="px-2 space-y-1">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 serif-font tracking-tight">馆长，欢迎回来。</h2>
          <p className="text-slate-500 text-sm md:text-base italic">云端同步已就绪，今天想记录些什么？</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button 
            onClick={onNewEntry}
            className="group relative bg-indigo-600 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
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
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            <div className="text-left relative z-10">
              <h5 className="text-xl font-bold serif-font">打磨馆藏珍宝</h5>
              <p className="text-slate-400 text-[10px] mt-1 opacity-70 uppercase tracking-widest font-black">Review & Refine</p>
            </div>
            <span className="text-3xl group-hover:translate-x-2 transition-transform relative z-10">→</span>
          </button>
        </div>
      </section>

      {/* 2. 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆藏总数 Total</p>
          <h3 className="text-3xl font-black text-slate-900 serif-font mt-1">{stats.total}</h3>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:border-indigo-100 transition-colors">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">演练次数 Rehearsals</p>
          <h3 className="text-3xl font-black text-slate-900 serif-font mt-1">{stats.rehearsalCount}</h3>
        </div>
        <div className="hidden md:block bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">博物馆状态 Status</p>
          <div className="flex items-center space-x-2 mt-3 text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full w-fit">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
            </span>
            <span>已同步云端 Online</span>
          </div>
        </div>
      </div>

      {/* 3. 年度足迹 */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">馆长年度足迹 Annual Footprint</h4>
          <div className="flex space-x-1 items-center">
            <span className="text-[9px] text-slate-400 mr-1 font-bold">LESS</span>
            {[0, 1, 2, 3].map(v => <div key={v} className={`w-2.5 h-2.5 rounded-sm ${getColor(v)}`}></div>)}
            <span className="text-[9px] text-slate-400 ml-1 font-bold">MORE</span>
          </div>
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
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Mon</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Wed</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Fri</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
            </div>

            <div className="flex gap-[3px]">
              {columns.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      title={`${day.date.toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric'})}: ${day.count} 篇藏品`}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-all hover:ring-2 hover:ring-indigo-300 ${getColor(day.count)} cursor-crosshair`}
                    ></div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. 活跃趋势图 */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm mb-12">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-8">馆藏增长趋势 Growth Trend</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} dy={10} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                cursor={{ stroke: '#4f46e5', strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="entries" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorEntries)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
