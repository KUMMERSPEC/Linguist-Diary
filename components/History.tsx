
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DiaryEntry } from '../types';
import { renderRuby } from '../utils/textHelpers'; 

interface HistoryProps {
  entries: DiaryEntry[];
  onSelect: (entry: DiaryEntry) => void;
  onDelete: (id: string) => void;
  onRewrite: (entry: DiaryEntry) => void;
  onAnalyzeDraft?: (entry: DiaryEntry) => void; 
  onUpdateLanguage?: (id: string, language: string) => void; 
  isAnalyzingId?: string | null; 
  preferredLanguages: string[];
  isMenuOpen?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const History: React.FC<HistoryProps> = ({ entries, onSelect, onDelete, onRewrite, onAnalyzeDraft, onUpdateLanguage, isAnalyzingId, preferredLanguages, isMenuOpen, hasMore, onLoadMore, isLoadingMore }) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [fixingEntryId, setFixingEntryId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoadingMore || viewMode !== 'list') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore?.();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore, viewMode]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop > 10);
  };

  // Calendar States
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(new Date().toDateString());

  const filteredEntriesWithIndex = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp); // Sort ascending to assign indices
    const dateGroups: Record<string, number> = {};
    
    const withIndex = sorted.map(entry => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString('zh-CN', { year: '2-digit', month: 'numeric', day: 'numeric' });
      dateGroups[dateStr] = (dateGroups[dateStr] || 0) + 1;
      return {
        ...entry,
        displayTitle: `${dateStr}-${dateGroups[dateStr]}`
      };
    });

    // Now filter and sort descending for display
    return withIndex.filter(e => {
      const latestText = e.originalText;
      const matchesSearch = (latestText && latestText.toLowerCase().includes(searchQuery.toLowerCase())) || (e.date && e.date.includes(searchQuery));
      const matchesLanguage = selectedLanguage === 'All' || e.language === selectedLanguage;
      return matchesSearch && matchesLanguage;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, searchQuery, selectedLanguage]);

  const filteredEntries = filteredEntriesWithIndex;

  // Calendar specific grouping
  const calendarEntryMap = useMemo(() => {
    const map: Record<string, DiaryEntry[]> = {};
    filteredEntries.forEach(entry => {
      const d = new Date(entry.timestamp).toDateString();
      if (!map[d]) map[d] = [];
      map[d].push(entry);
    });
    return map;
  }, [filteredEntries]);

  const groupedEntries = useMemo(() => {
    const groups: { [key: string]: (DiaryEntry & { displayTitle?: string })[] } = {};
    filteredEntries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const monthYear = date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
      if (!groups[monthYear]) groups[monthYear] = [];
      groups[monthYear].push(entry);
    });
    return groups;
  }, [filteredEntries]);

  const filterLanguages = useMemo(() => {
    const existingLangs = Array.from(new Set(entries.map(e => e.language).filter(Boolean)));
    const combined = Array.from(new Set([...existingLangs, ...preferredLanguages]));
    return ['All', ...combined];
  }, [entries, preferredLanguages]);

  const fixLanguages = useMemo(() => {
    return LANGUAGES.filter(l => preferredLanguages.includes(l.code));
  }, [preferredLanguages]);

  // Calendar Grid Generation
  const calendarGrid = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) days.push(null);
    // Real days
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    
    return days;
  }, [calendarDate]);

  const changeMonth = (offset: number) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1));
  };

  const renderNotionRow = (entry: DiaryEntry & { displayTitle?: string }) => {
    const iterCount = entry.iterationCount || 0;
    const isRehearsal = entry.type === 'rehearsal';
    const isDraft = !isRehearsal && !entry.analysis;
    const isAnalyzing = isAnalyzingId === entry.id;

    return (
      <div 
        key={entry.id} 
        onClick={() => onSelect(entry)}
        className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all cursor-pointer border-b border-slate-50 last:border-0"
      >
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <span className="text-xl grayscale group-hover:grayscale-0 transition-all">
            {isDraft ? '📄' : isRehearsal ? '🎭' : '💎'}
          </span>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 overflow-hidden">
            <span className="text-sm font-bold text-slate-700 serif-font truncate">
              {entry.displayTitle || entry.date}
            </span>
            <div className="flex items-center space-x-2">
              {entry.language && (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[8px] font-black rounded uppercase tracking-widest">
                  {entry.language}
                </span>
              )}
              <span className={`text-[8px] font-black uppercase tracking-widest ${isDraft ? 'text-slate-400' : 'text-indigo-500'}`}>
                {isDraft ? 'Draft' : (isRehearsal ? 'Rehearsal' : (iterCount > 0 ? `Refined ${iterCount}x` : 'Archived'))}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 shrink-0">
          <span className="hidden md:block text-[10px] font-medium text-slate-400">
            {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {!isRehearsal && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRewrite(entry); }} 
                className="p-2 hover:bg-indigo-50 text-indigo-400 rounded-lg transition-colors"
              >
                🖋️
              </button>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }} 
              className="p-2 hover:bg-rose-50 text-rose-300 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderEntryCard = (entry: DiaryEntry) => {
    const iterCount = entry.iterationCount || 0;
    const isRehearsal = entry.type === 'rehearsal';
    const isDraft = !isRehearsal && !entry.analysis;
    const isAnalyzing = isAnalyzingId === entry.id;
    const isFixing = fixingEntryId === entry.id;

    return (
      <div key={entry.id} className="relative group perspective-1000 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
             <div className="relative">
                {entry.language ? (
                  <span className="px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-xl uppercase tracking-widest shadow-lg shadow-slate-200">
                    {entry.language}
                  </span>
                ) : (
                  isFixing ? (
                    <div className="absolute top-0 left-0 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 flex flex-col space-y-1 animate-in zoom-in duration-300 min-w-[120px]">
                      <p className="text-[8px] font-black text-slate-400 uppercase p-1">补全语言修复</p>
                      {fixLanguages.map(lang => (
                        <button 
                          key={lang.code} 
                          onClick={(e) => {
                            e.stopPropagation();
                            onUpdateLanguage?.(entry.id, lang.code);
                            setFixingEntryId(null);
                          }}
                          className="text-[10px] font-bold text-slate-700 hover:bg-indigo-50 p-2 rounded-lg text-left"
                        >
                          {lang.flag} {lang.label}
                        </button>
                      ))}
                      <button onClick={(e) => { e.stopPropagation(); setFixingEntryId(null); }} className="text-[8px] font-black text-rose-400 p-1 text-center">取消</button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFixingEntryId(entry.id); }}
                      className="px-3 py-1 bg-amber-50 text-amber-600 text-[9px] font-black rounded-xl uppercase tracking-widest border border-amber-200 animate-pulse shadow-lg shadow-amber-100 hover:bg-amber-100 transition-colors"
                    >
                      ⚠️ 补全标签
                    </button>
                  )
                )}
             </div>
             <div className="flex items-center space-x-1">
                {!isRehearsal && (
                  <button onClick={() => onRewrite(entry)} className="p-2.5 rounded-2xl hover:bg-indigo-50 text-indigo-400 transition-colors" title="精进重写">🖋️</button>
                )}
                <button onClick={() => onDelete(entry.id)} className="p-2.5 rounded-2xl hover:bg-rose-50 text-rose-300 transition-colors">✕</button>
             </div>
           </div>

           <div className="flex-1 cursor-pointer" onClick={() => onSelect(entry)}>
             <p 
               className={`line-clamp-5 serif-font mb-8 italic text-base md:text-lg leading-[2.2] transition-colors ${isDraft ? 'text-slate-400' : 'text-slate-600 group-hover:text-slate-900'}`}
               dangerouslySetInnerHTML={{ __html: `“ ${renderRuby(entry.originalText)} ”` }}
             />
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
  };

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
    <div 
      onScroll={handleScroll}
      className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8"
    >
      <header className="space-y-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font">馆藏精品 Collection Exhibit</h2>
          <p className="text-slate-500 mt-2 text-sm md:text-base italic">在这里，每一行文字都见证了您的语言演化之路。</p>
        </div>
        
        <div className={`sticky top-0 transition-all duration-300 py-4 -mx-4 px-4 md:-mx-8 md:px-8 border-b ${
          isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-slate-200/80' : 'bg-transparent border-transparent'
        } ${isMenuOpen ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative group w-full sm:w-auto">
                <select 
                  value={selectedLanguage} 
                  onChange={(e) => setSelectedLanguage(e.target.value)} 
                  className="appearance-none w-full sm:w-auto p-3.5 pl-5 pr-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none"
                >
                  {filterLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '🎨 全部语言' : l}</option>)}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
              </div>
              <div className="relative w-full sm:flex-1 sm:max-w-xs">
                <input 
                  type="text" 
                  placeholder="搜寻馆藏记忆..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="p-3.5 pl-10 pr-5 bg-white border border-slate-200 rounded-2xl text-xs font-medium w-full shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none" 
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
              </div>
            </div>

            <div className="flex justify-start">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  列表
                </button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  日历
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {viewMode === 'list' ? (
        <div className="space-y-16 animate-in fade-in duration-500">
          {(Object.entries(groupedEntries) as [string, DiaryEntry[]][]).map(([monthYear, monthEntries]) => (
            <section key={monthYear} className="space-y-10">
              <div className="flex items-center space-x-4">
                <h3 className="text-xl font-black text-slate-800 serif-font tracking-tight">{monthYear}</h3>
                <div className="flex-1 h-[1px] bg-slate-200/60"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthEntries.length} ITEMS</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {monthEntries.map(entry => renderNotionRow(entry))}
              </div>
            </section>
          ))}
          
          {hasMore && (
            <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                正在从馆藏深处调取更多记录...
              </p>
            </div>
          )}
          
          {!hasMore && entries.length > 0 && (
            <div className="py-12 text-center">
              <div className="inline-block px-6 py-2 bg-slate-50 rounded-full border border-slate-100">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  已经到达馆藏尽头 END OF EXHIBIT
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto lg:grid lg:grid-cols-12 lg:gap-10 lg:items-start space-y-10 lg:space-y-0">
           {/* Calendar UI */}
           <div className="lg:col-span-5 bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
              
              <div className="flex flex-col items-center justify-between mb-8 relative z-10 gap-4">
                <div className="flex flex-col items-center space-y-4 w-full">
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 serif-font tracking-tight">
                      {calendarDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm text-xs">←</button>
                      <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm text-xs">→</button>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setCalendarDate(new Date()); setSelectedDateStr(new Date().toDateString()); }}
                    className="w-full text-[9px] font-black uppercase text-indigo-600 tracking-widest bg-indigo-50 px-4 py-2 rounded-xl text-center"
                  >
                    回到今天 TODAY
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 md:gap-2 relative z-10">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center py-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {d}
                  </div>
                ))}
                {calendarGrid.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  
                  const dStr = day.toDateString();
                  const hasEntries = calendarEntryMap[dStr]?.length > 0;
                  const isSelected = selectedDateStr === dStr;
                  const isToday = dStr === new Date().toDateString();

                  return (
                    <button
                      key={dStr}
                      onClick={() => setSelectedDateStr(dStr)}
                      className={`
                        aspect-square rounded-[1rem] md:rounded-[1.5rem] flex flex-col items-center justify-center transition-all relative
                        ${isSelected ? 'bg-slate-900 text-white shadow-xl scale-105' : 'bg-slate-50/50 hover:bg-indigo-50'}
                      `}
                    >
                      <span className={`text-sm md:text-base font-bold ${isToday && !isSelected ? 'text-indigo-600 underline underline-offset-4' : ''}`}>
                        {day.getDate()}
                      </span>
                      {hasEntries && (
                        <div className={`mt-0.5 flex gap-0.5`}>
                           {calendarEntryMap[dStr].slice(0, 3).map((_, i) => (
                             <span key={i} className={`w-0.5 h-0.5 md:w-1 md:h-1 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-indigo-600'}`}></span>
                           ))}
                           {calendarEntryMap[dStr].length > 3 && <span className="text-[6px] font-black opacity-60">+</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
           </div>

           {/* Entries for selected day */}
           <div className="lg:col-span-7">
             <section className="space-y-8">
                <div className="flex items-center space-x-4">
                  <h3 className="text-xl font-black text-slate-800 serif-font tracking-tight">
                    {selectedDateStr ? new Date(selectedDateStr).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) : '选中记录'}
                  </h3>
                  <div className="flex-1 h-[1px] bg-slate-200/60"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedDateStr ? (calendarEntryMap[selectedDateStr]?.length || 0) : 0} ITEMS
                  </span>
                </div>

                {selectedDateStr && calendarEntryMap[selectedDateStr] && calendarEntryMap[selectedDateStr].length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {calendarEntryMap[selectedDateStr].map(entry => renderEntryCard(entry))}
                  </div>
                ) : (
                  <div className="bg-white p-12 md:p-16 rounded-[2.5rem] md:rounded-[3rem] border border-dashed border-slate-200 text-center">
                     <span className="text-4xl mb-4 block grayscale opacity-30">🕳️</span>
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">当天下暂无馆藏记录</p>
                     <p className="text-slate-300 text-[10px] mt-2 italic">NO RECORDS FOUND FOR THIS DATE</p>
                  </div>
                )}
             </section>
           </div>
        </div>
      )}
    </div>
  );
};

export default History;
