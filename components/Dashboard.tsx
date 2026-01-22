
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry } from '../types';

interface DashboardProps {
  onNewEntry: () => void;
  // FIX: Update onStartReview to be a simple function call
  onStartReview: () => void; 
  entries: DiaryEntry[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNewEntry, onStartReview, entries }) => {
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
    
    // 找到对齐的那周的周日
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
        
        // 逻辑修正：如果这周的第一天是新的一月
        if (d === 0) {
          const currentMonth = currentDate.getMonth();
          if (currentMonth !== lastMonth) {
            // 核心修复：如果当前周 index 距离末尾太近（少于4周），则不显示标签，防止首尾重复
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
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
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
            onClick={onStartReview} // FIX: Directly call onStartReview
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

      {/* 3. 年度足迹 (Heatmap with Optimized Labels) */}
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
          {/* 月份横轴：使用绝对定位确保对齐 */}
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
            {/* 星期纵轴 */}
            <div className="flex flex-col gap-[3px] pr-3 justify-between py-[2px] h-[95px] w-8 shrink-0">
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Mon</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Wed</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
              <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60">Fri</span>
              <span className="text-[9px] font-bold text-slate-300"></span>
            </div>

            {/* 网格网格 */}
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
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
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
    