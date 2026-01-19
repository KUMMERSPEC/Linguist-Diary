
import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';

interface HistoryProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
}

const History: React.FC<HistoryProps> = ({ entries, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter entries based on search query
  const filteredEntries = useMemo(() => {
    return entries.filter(e => 
      e.originalText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.date.includes(searchQuery)
    ).sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, searchQuery]);

  // 2. Group entries by Month Year
  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: DiaryEntry[] } = {};
    filteredEntries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const monthYear = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4">🏛️</div>
        <h3 className="text-xl font-bold text-slate-900">收藏馆还是空的</h3>
        <p className="text-slate-500 max-w-xs">您的语言学习博物馆正等待第一件藏品入驻。</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">日记收藏馆</h2>
          <p className="text-slate-500">按时间线浏览您的成长轨迹。</p>
        </div>
        
        {/* Search Bar */}
        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">🔍</span>
          <input 
            type="text"
            placeholder="搜寻记忆或语言..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
          />
        </div>
      </header>

      {Object.keys(groupedEntries).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
          <p className="text-slate-400">没有找到符合条件的馆藏...</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Fix: Cast Object.entries to ensure monthEntries is correctly typed as DiaryEntry[] instead of unknown */}
          {(Object.entries(groupedEntries) as [string, DiaryEntry[]][]).map(([monthYear, monthEntries]) => (
            <section key={monthYear} className="space-y-6">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-bold text-slate-800 whitespace-nowrap">{monthYear}</h3>
                <div className="h-[1px] w-full bg-slate-200"></div>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full">{monthEntries.length} 篇</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className="group relative text-left bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300"
                  >
                    {/* Floating Date Tag */}
                    <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg shadow-lg shadow-indigo-100">
                      {new Date(entry.timestamp).getDate()}日
                    </div>

                    <div className="flex items-center justify-between mb-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase tracking-wider">{entry.language}</span>
                      </div>
                    </div>

                    <p className="text-slate-600 line-clamp-4 leading-relaxed serif-font mb-6 min-h-[6rem]">
                      {entry.originalText}
                    </p>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between group-hover:text-indigo-600 transition-colors">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-indigo-600">回顾此篇章</span>
                      <span className="transform group-hover:translate-x-1 transition-transform text-indigo-400">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;
