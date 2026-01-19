
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry } from '../types';

interface DashboardProps {
  onNewEntry: () => void;
  entries: DiaryEntry[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNewEntry, entries }) => {
  // --- 数据处理逻辑 ---

  // 1. 生成最近7天的趋势图数据
  const chartData = React.useMemo(() => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return { 
        name: d.toLocaleDateString('zh-CN', { weekday: 'short' }),
        dateStr: d.toDateString(),
        entries: 0 
      };
    }).reverse();

    entries.forEach(entry => {
      const entryDate = new Date(entry.timestamp).toDateString();
      const day = last7Days.find(d => d.dateStr === entryDate);
      if (day) day.entries += 1;
    });

    return last7Days;
  }, [entries]);

  // 2. 生成热力图数据 (过去 365 天)
  const heatmapData = React.useMemo(() => {
    const today = new Date();
    const data: { [key: string]: number } = {};
    
    // 初始化过去一年的数据
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      data[d.toDateString()] = 0;
    }

    // 填充数据
    entries.forEach(entry => {
      const dateStr = new Date(entry.timestamp).toDateString();
      if (data[dateStr] !== undefined) {
        data[dateStr] += 1;
      }
    });

    // 转换为按周排列的数组，方便渲染
    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364); // 往前数 364 天凑齐 365
    
    // 补齐起始日到周一的空缺 (假设周日为一周开始)
    const firstDayOfWeek = startDate.getDay();
    for(let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push({ date: new Date(0), count: -1 }); // 占位符
    }

    for (let i = 0; i < 365; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      currentWeek.push({ date: d, count: data[d.toDateString()] || 0 });
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    
    return weeks;
  }, [entries]);

  // 3. 计算连续打卡
  const stats = React.useMemo(() => {
    const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    let streak = 0;
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    const entryDates = new Set(entries.map(e => {
        const d = new Date(e.timestamp);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }));

    let checkDate = new Date(today);
    // 如果今天没写，检查昨天
    if (!entryDates.has(checkDate.getTime())) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (entryDates.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      total: entries.length,
      streak: streak,
      corrections: entries.reduce((acc, curr) => acc + (curr.analysis?.corrections.length || 0), 0),
      vocab: entries.reduce((acc, curr) => acc + (curr.analysis?.advancedVocab.length || 0), 0)
    };
  }, [entries]);

  const getColorClass = (count: number) => {
    if (count === -1) return 'bg-transparent opacity-0';
    if (count === 0) return 'bg-slate-100';
    if (count === 1) return 'bg-indigo-200';
    if (count === 2) return 'bg-indigo-400';
    return 'bg-indigo-600';
  };

  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 serif-font">馆长，欢迎回来。</h2>
          <p className="text-slate-500 mt-1">云端同步已就绪，今天想记录些什么？</p>
        </div>
        <button 
          onClick={onNewEntry}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center space-x-2 w-fit active:scale-95"
        >
          <span>✍️ 开启新藏品</span>
        </button>
      </header>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">🔥</div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">连续打卡</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-slate-900">{stats.streak}</span>
            <span className="text-orange-500 text-xs font-bold italic">DAYS</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">📚</div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">馆藏总量</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-slate-900">{stats.total}</span>
            <span className="text-emerald-500 text-xs font-bold">Cloud</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">🔍</div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">累计修正</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-slate-900">{stats.corrections}</span>
            <span className="text-indigo-400 text-xs font-bold">Points</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">💎</div>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">进阶词库</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-bold text-slate-900">{stats.vocab}</span>
            <span className="text-slate-400 text-xs font-bold">Items</span>
          </div>
        </div>
      </div>

      {/* 核心：年度热力图 */}
      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span className="p-2 bg-indigo-50 rounded-lg">🗓️</span>
                <span>年度学习足迹</span>
            </h3>
            <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-slate-100"></div>
                <div className="w-3 h-3 rounded-sm bg-indigo-200"></div>
                <div className="w-3 h-3 rounded-sm bg-indigo-400"></div>
                <div className="w-3 h-3 rounded-sm bg-indigo-600"></div>
                <span>More</span>
            </div>
        </div>

        <div className="overflow-x-auto no-scrollbar pb-2">
            <div className="flex flex-col min-w-[700px]">
                {/* 月份标识 */}
                <div className="flex mb-2 ml-8">
                    {Array.from({length: 12}).map((_, i) => (
                        <div key={i} className="flex-1 text-[10px] text-slate-400 font-medium">
                            {monthNames[(new Date().getMonth() + i + 1) % 12]}
                        </div>
                    ))}
                </div>
                
                <div className="flex space-x-1">
                    {/* 周几标识 */}
                    <div className="flex flex-col justify-between py-1 pr-2 text-[8px] text-slate-300 font-bold h-24 uppercase">
                        <span>Mon</span>
                        <span>Wed</span>
                        <span>Fri</span>
                        <span>Sun</span>
                    </div>
                    {/* 热力格 */}
                    <div className="flex flex-1 space-x-1">
                        {heatmapData.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col space-y-1">
                                {week.map((day, dIdx) => (
                                    <div 
                                        key={dIdx}
                                        title={day.count >= 0 ? `${day.date.toLocaleDateString()}: ${day.count} 篇日记` : ''}
                                        className={`w-3 h-3 rounded-sm transition-all duration-300 ${getColorClass(day.count)} hover:ring-2 hover:ring-indigo-300 hover:scale-110`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center space-x-2">
          <span className="p-2 bg-indigo-50 rounded-lg">📈</span>
          <span>近期学习频率</span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 600}} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontSize: '12px' }}
                cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="entries" 
                stroke="#6366f1" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorEntries)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
