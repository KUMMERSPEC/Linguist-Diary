
import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';

interface HistoryProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onRewrite: (entry: DiaryEntry) => void;
}

const History: React.FC<HistoryProps> = ({ entries, onSelect, onDelete, onRewrite }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = e.originalText.toLowerCase().includes(searchQuery.toLowerCase()) || e.date.includes(searchQuery);
      const matchesLanguage = selectedLanguage === 'All' || e.language === selectedLanguage;
      return matchesSearch && matchesLanguage;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, searchQuery, selectedLanguage]);

  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: DiaryEntry[] } = {};
    filteredEntries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const monthYear = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const availableLanguages = useMemo(() => ['All', ...Array.from(new Set(entries.map(e => e.language)))], [entries]);

  if (entries.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in zoom-in">
      <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4">🏛️</div>
      <h3 className="text-xl font-bold text-slate-900">收藏馆还是空的</h3>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 serif-font">馆藏展示 Collection</h2>
          <p className="text-slate-500 text-sm">在这里珍藏着您的每一次练习与感悟。</p>
        </div>
        <div className="flex gap-3">
          <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold">
            {availableLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '全部语言' : l}</option>)}
          </select>
          <input type="text" placeholder="搜寻记忆..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="p-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium" />
        </div>
      </header>

      <div className="space-y-12">
        {/* Fix: Explicitly cast Object.entries result to allow mapping over monthEntries with correct types */}
        {(Object.entries(groupedEntries) as [string, DiaryEntry[]][]).map(([monthYear, monthEntries]) => (
          <section key={monthYear} className="space-y-8">
            <h3 className="text-lg font-bold text-slate-800 serif-font border-b border-slate-100 pb-2">{monthYear}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {monthEntries.map((entry) => {
                const iterCount = entry.iterations?.length || 0;
                return (
                  <div key={entry.id} className="relative group">
                    {/* 堆叠背景阴影效果 */}
                    {iterCount > 0 && (
                      <>
                        <div className="absolute inset-0 bg-white border border-slate-100 rounded-[2.5rem] translate-x-2 translate-y-2 -z-10 shadow-sm opacity-50"></div>
                        <div className="absolute inset-0 bg-white border border-slate-100 rounded-[2.5rem] translate-x-1 translate-y-1 -z-10 shadow-sm opacity-80"></div>
                      </>
                    )}
                    
                    <div className="bg-white p-6 pt-10 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
                       <div className="absolute -top-3 left-6 px-3 py-1 bg-indigo-600 text-white text-[9px] font-black rounded-xl shadow-lg">
                         {new Date(entry.timestamp).getDate()}nd
                       </div>
                       
                       {iterCount > 0 && (
                         <div className="absolute -top-3 right-6 px-3 py-1 bg-amber-500 text-white text-[8px] font-black rounded-xl shadow-md uppercase">
                           Refined {iterCount + 1}x
                         </div>
                       )}

                       <div className="flex justify-between items-center mb-4">
                         <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-md uppercase tracking-widest">{entry.language}</span>
                         <div className="flex space-x-1">
                            <button onClick={() => onRewrite(entry)} className="p-1.5 rounded-full hover:bg-indigo-50 text-indigo-400" title="重写/迭代">🖋️</button>
                            <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-full hover:bg-red-50 text-red-300">✕</button>
                         </div>
                       </div>

                       <p onClick={() => onSelect(entry)} className="text-slate-600 line-clamp-4 serif-font mb-6 cursor-pointer italic text-sm leading-relaxed">
                         {entry.originalText}
                       </p>

                       <button onClick={() => onSelect(entry)} className="w-full text-center text-[10px] font-black uppercase text-indigo-600 py-2 border-t border-slate-50 hover:bg-slate-50 rounded-b-2xl transition-colors">
                         查看详情 View Report
                       </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default History;
