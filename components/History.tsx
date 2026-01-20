
import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';

interface HistoryProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
}

const History: React.FC<HistoryProps> = ({ entries, onSelect, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  const availableLanguages = useMemo(() => {
    const langs = new Set(entries.map(e => e.language));
    return ['All', ...Array.from(langs)];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = e.originalText.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           e.date.includes(searchQuery);
      const matchesLanguage = selectedLanguage === 'All' || e.language === selectedLanguage;
      return matchesSearch && matchesLanguage;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, searchQuery, selectedLanguage]);

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

  const getScoreBadge = (score: number) => {
    if (score >= 90) return 'S';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    return 'C';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">馆藏展示 Collection</h2>
          <p className="text-slate-500 text-sm">在这里珍藏着您的每一次练习与感悟。</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-col">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">语言筛选 Language</label>
            <div className="relative">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full sm:w-32 cursor-pointer shadow-sm"
              >
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>{lang === 'All' ? '全部语言' : lang}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px] opacity-70">
                ▼
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">检索内容 Search</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors text-sm">
                🔍
              </span>
              <input 
                type="text"
                placeholder="搜寻记忆或日期..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full sm:w-64 shadow-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {Object.keys(groupedEntries).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 animate-in fade-in duration-500">
          <div className="text-4xl mb-4">🕵️‍♂️</div>
          <p className="text-slate-400 font-bold">没有找到符合条件的馆藏...</p>
          <button 
            onClick={() => { setSearchQuery(''); setSelectedLanguage('All'); }}
            className="mt-4 text-xs font-black text-indigo-600 uppercase hover:underline"
          >
            重置筛选条件
          </button>
        </div>
      ) : (
        <div className="space-y-12">
          {(Object.entries(groupedEntries) as [string, DiaryEntry[]][]).map(([monthYear, monthEntries]) => (
            <section key={monthYear} className="space-y-6">
              <div className="flex items-center space-x-4">
                <h3 className="text-lg font-bold text-slate-800 whitespace-nowrap serif-font">{monthYear}</h3>
                <div className="h-[1px] w-full bg-slate-200"></div>
                <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-100 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">{monthEntries.length} 藏品</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {monthEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className="group relative text-left bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 transition-all duration-500 overflow-hidden"
                  >
                    <div className="absolute -top-3 left-8 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl shadow-lg shadow-indigo-100 uppercase tracking-widest z-10">
                      {new Date(entry.timestamp).getDate()}nd {monthYear.split('年')[1]}
                    </div>

                    {/* Type Badge */}
                    <div className={`absolute top-0 right-0 p-2 text-[8px] font-black uppercase tracking-tighter ${entry.type === 'rehearsal' ? 'bg-orange-500 text-white' : 'bg-indigo-500 text-white'}`}>
                      {entry.type === 'rehearsal' ? 'Rehearsal 演练' : 'Diary 日记'}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(entry.id);
                      }}
                      className="absolute top-8 right-12 w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all active:scale-90 z-20"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>

                    <div className="flex items-center justify-between mb-4 mt-6">
                      <div className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-lg uppercase tracking-widest">{entry.language}</span>
                      </div>
                      
                      {entry.type === 'rehearsal' && entry.rehearsal && (
                        <div className="flex items-center space-x-1">
                           <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">
                             {getScoreBadge(entry.rehearsal.accuracyScore)}/{getScoreBadge(entry.rehearsal.qualityScore)}
                           </span>
                        </div>
                      )}
                    </div>

                    <p className="text-slate-600 line-clamp-4 leading-relaxed serif-font mb-6 min-h-[6rem] italic text-sm md:text-base">
                      {entry.originalText}
                    </p>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between group-hover:text-indigo-600 transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600">
                        {entry.type === 'rehearsal' ? '查看报告 Review Report' : '回顾篇章 View Artifact'}
                      </span>
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
