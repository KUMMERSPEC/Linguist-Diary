
import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types';
import { renderRuby } from '../utils/textHelpers'; 

interface HistoryProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onRewrite: (entry: DiaryEntry) => void;
  onAnalyzeDraft?: (entry: DiaryEntry) => void; // New: Trigger analysis for drafts
  isAnalyzingId?: string | null; // New: Track which draft is being analyzed
}

const History: React.FC<HistoryProps> = ({ entries, onSelect, onDelete, onRewrite, onAnalyzeDraft, isAnalyzingId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');

  const getLatestText = (entry: DiaryEntry) => {
    return entry.originalText;
  };

  const getIterationCountDisplay = (entry: DiaryEntry) => {
    return entry.iterationCount || 0;
  }

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const latestText = getLatestText(e);
      const matchesSearch = (latestText && latestText.toLowerCase().includes(searchQuery.toLowerCase())) || (e.date && e.date.includes(searchQuery));
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
    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in zoom-in duration-700">
      <div className="w-28 h-28 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-5xl mb-4 border border-slate-100">🏛️</div>
      <div>
        <h3 className="text-2xl font-black text-slate-900 serif-font">馆藏空空如也</h3>
        <p className="text-slate-400 mt-2 text-sm italic">等待您的第一件语言艺术品入馆...</p>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-slate-200 pb-10">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font">馆藏精品 Collection Exhibit</h2>
          <p className="text-slate-500 mt-3 text-sm md:text-base italic">在这里，每一行文字都见证了您的语言演化之路。</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative group">
            <select 
              value={selectedLanguage} 
              onChange={(e) => setSelectedLanguage(e.target.value)} 
              className="appearance-none p-3.5 pl-5 pr-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none"
            >
              {availableLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '🎨 全部语言' : l}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="搜寻馆藏记忆..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="p-3.5 pl-10 pr-5 bg-white border border-slate-200 rounded-2xl text-xs font-medium w-full sm:w-64 shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none" 
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
          </div>
        </div>
      </header>

      <div className="space-y-16">
        {(Object.entries(groupedEntries) as [string, DiaryEntry[]][]).map(([monthYear, monthEntries]) => (
          <section key={monthYear} className="space-y-10">
            <div className="flex items-center space-x-4">
              <h3 className="text-xl font-black text-slate-800 serif-font tracking-tight">{monthYear}</h3>
              <div className="flex-1 h-[1px] bg-slate-200/60"></div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthEntries.length} ITEMS</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {monthEntries.map((entry) => {
                const iterCount = getIterationCountDisplay(entry);
                const isRehearsal = entry.type === 'rehearsal';
                const isDraft = !isRehearsal && !entry.analysis;
                const displayText = getLatestText(entry);
                const isAnalyzing = isAnalyzingId === entry.id;
                
                return (
                  <div key={entry.id} className="relative group perspective-1000">
                    {(iterCount > 0 || isDraft) && (
                      <div className={`absolute inset-0 rounded-[3rem] translate-x-3 translate-y-3 -z-10 transition-transform group-hover:translate-x-4 group-hover:translate-y-4 ${isDraft ? 'bg-slate-100 border border-slate-200' : 'bg-indigo-50/50 border border-indigo-100/50'}`}></div>
                    )}
                    
                    <div className="bg-white p-8 pt-12 rounded-[3rem] border border-slate-200 shadow-sm hover:shadow-2xl transition-all duration-500 relative flex flex-col h-full overflow-hidden group-hover:-translate-y-2">
                       <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[4rem] opacity-30 -mr-10 -mt-10 group-hover:scale-110 transition-transform ${isDraft ? 'bg-slate-100' : 'bg-indigo-50'}`}></div>
                       
                       <div className="absolute top-6 left-8 flex items-center space-x-2">
                         <div className={`w-1.5 h-1.5 rounded-full ${isDraft ? 'bg-slate-300' : 'bg-indigo-600 animate-pulse'}`}></div>
                         <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{new Date(entry.timestamp).getDate()}nd Exhibit</span>
                       </div>

                       <div className="flex justify-between items-center mb-6">
                         <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-slate-200">
                           {entry.language}
                         </span>
                         <div className="flex items-center space-x-1">
                            {!isRehearsal && (
                              <button onClick={() => onRewrite(entry)} className="p-2.5 rounded-2xl hover:bg-indigo-50 text-indigo-400 transition-colors" title="精进重写">🖋️</button>
                            )}
                            <button onClick={() => onDelete(entry.id)} className="p-2.5 rounded-2xl hover:bg-rose-50 text-rose-300 transition-colors">✕</button>
                         </div>
                       </div>

                       <div className="flex-1 cursor-pointer" onClick={() => !isDraft && onSelect(entry)}>
                         <p className={`line-clamp-5 serif-font mb-8 italic text-base md:text-lg leading-[2.2] transition-colors ${isDraft ? 'text-slate-400' : 'text-slate-600 group-hover:text-slate-900'}`}>
                           “ {renderRuby(displayText)} ”
                         </p>
                       </div>

                       <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Status:</span>
                             <span className={`text-[10px] font-bold uppercase tracking-widest ${isDraft ? 'text-slate-400' : (iterCount > 0 ? 'text-amber-500' : 'text-emerald-500')}`}>
                               {isDraft ? '📜 待打磨草稿' : (iterCount > 0 ? `Refined ${iterCount + 1}x` : (isRehearsal ? 'Rehearsal' : 'Archived'))}
                             </span>
                          </div>
                          
                          {isDraft ? (
                            <button 
                              onClick={() => onAnalyzeDraft?.(entry)} 
                              disabled={isAnalyzing}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2"
                            >
                              {isAnalyzing ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>✨ 立即分析</span>}
                            </button>
                          ) : (
                            <button onClick={() => onSelect(entry)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all">
                               查看报告 VIEW
                            </button>
                          )}
                       </div>
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
