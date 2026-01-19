
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DiaryEntry } from '../types';

interface DashboardProps {
  onNewEntry: () => void;
  entries: DiaryEntry[];
}

const Dashboard: React.FC<DashboardProps> = ({ onNewEntry, entries }) => {
  // 生成最近7天的数据统计
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

  const totalCorrections = entries.reduce((acc, curr) => acc + (curr.analysis?.corrections.length || 0), 0);
  const totalVocab = entries.reduce((acc, curr) => acc + (curr.analysis?.advancedVocab.length || 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">📚</div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">馆藏总量</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-5xl font-bold text-slate-900">{entries.length}</span>
            <span className="text-emerald-500 text-sm font-bold">Cloud</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">🔍</div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">累计修正</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-5xl font-bold text-slate-900">{totalCorrections}</span>
            <span className="text-indigo-400 text-sm font-bold">Points</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl group-hover:scale-110 transition-transform">💎</div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">进阶词库</p>
          <div className="flex items-baseline space-x-2">
            <span className="text-5xl font-bold text-slate-900">{totalVocab}</span>
            <span className="text-slate-400 text-sm font-bold">Items</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center space-x-2">
          <span className="p-2 bg-indigo-50 rounded-lg">📈</span>
          <span>本周学习频率</span>
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
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
              />
              <Area 
                type="monotone" 
                dataKey="entries" 
                stroke="#6366f1" 
                strokeWidth={4}
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
