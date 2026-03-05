
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, LayoutGrid, List, ChevronDown, ChevronUp, Filter, ArrowUpDown } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import { AdvancedVocab, PracticeRecord, ViewState, InspirationFragment } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { getAudioWithCache } from '../services/audioService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import { renderRuby, stripRuby } from '../utils/textHelpers';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface VocabListViewProps {
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  fragments: InspirationFragment[];
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onUpdateMastery: (vocabId: string, word: string, newMastery: number, record?: PracticeRecord, aiSummary?: string) => void;
  onDeleteVocab?: (vocabId: string) => void;
  onDeleteFragment?: (id: string) => void;
  onPromoteFragment?: (id: string) => void;
  onPromoteToSeed?: (id: string) => void;
  onBulkPromoteFragments?: (ids: string[]) => void;
  isMenuOpen?: boolean;
  onBulkUpdateLanguage?: (vocabIds: string[], language: string) => void;
  onLinkVocab?: (vocabIds: string[], parentId: string | null) => void;
  onMarkAsMastered?: (vocabId: string) => void;
  promotingFragmentId?: string | null;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  'English': '🇬🇧',
  'Japanese': '🇯🇵',
  'French': '🇫🇷',
  'Spanish': '🇪🇸',
  'German': '🇩🇪',
};

const ShardItem = React.memo(({ 
  f, 
  selectedShardIds, 
  toggleShardSelection, 
  onDeleteFragment, 
  onPromoteToSeed, 
  onPromoteFragment, 
  onViewChange,
  promotingFragmentId,
  handlePlayAudio,
  playingAudioId
}: { 
  f: InspirationFragment, 
  selectedShardIds: Set<string>, 
  toggleShardSelection: (id: string) => void, 
  onDeleteFragment?: (id: string) => void, 
  onPromoteToSeed?: (id: string) => void, 
  onPromoteFragment?: (id: string) => void, 
  onViewChange?: (view: ViewState, vocabId?: string, isPracticeActive?: boolean, prefill?: string) => void,
  promotingFragmentId?: string | null,
  handlePlayAudio: (e: React.MouseEvent, text: string, id: string) => void,
  playingAudioId: string | null
}) => (
  <div key={f.id} className={`bg-white p-6 rounded-[2rem] border shadow-sm relative group flex flex-col h-full hover:shadow-xl transition-all ${selectedShardIds.has(f.id) ? 'border-indigo-200 ring-2 ring-indigo-500/10 bg-indigo-50/10' : 'border-slate-200'}`}>
     <div className="flex items-center justify-between mb-4">
       <div className="flex items-center space-x-2">
         <div onClick={(e) => e.stopPropagation()} className="mr-1">
           <input 
             type="checkbox" 
             checked={selectedShardIds.has(f.id)}
             onChange={() => toggleShardSelection(f.id)}
             className="w-4 h-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500/20"
           />
         </div>
         <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${f.fragmentType === 'seed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-400'}`}>
           {f.fragmentType === 'seed' ? '🌱 种子' : '📜 随笔'}
         </span>
         <span className="text-[7px] font-black text-slate-300 uppercase">{f.language}</span>
       </div>
       <button onClick={() => onDeleteFragment?.(f.id)} className="p-1 text-slate-200 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">✕</button>
     </div>
     
     <div className="flex-1 space-y-3">
       <p 
        className="text-base font-bold text-slate-800 leading-relaxed serif-font"
        dangerouslySetInnerHTML={{ __html: `“ ${renderRuby(f.content)} ”` }}
      />
       {f.meaning && f.meaning.trim() !== '' && (
         <p className="text-[11px] text-slate-500 font-medium bg-slate-50 p-2 rounded-xl">意思：{stripRuby(f.meaning)}</p>
       )}
       {f.usage && f.usage.trim() !== '' && (
         <div className="relative group/usage">
           <p className="text-[10px] text-slate-400 italic leading-relaxed border-l-2 border-slate-100 pl-3 serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(f.usage) }}></p>
           <button onClick={(e) => handlePlayAudio(e, f.usage || "", `frag-usage-${f.id}`)} className={`absolute top-0 right-0 p-1 rounded-lg transition-all ${playingAudioId === `frag-usage-${f.id}` ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 opacity-0 group-hover/usage:opacity-100'}`}>{playingAudioId === `frag-usage-${f.id}` ? '⏹' : '🎧'}</button>
         </div>
       )}
     </div>

     <div className="mt-6 pt-4 border-t border-slate-50 flex flex-col space-y-3">
       <div className="flex items-center justify-between">
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Captured {new Date(f.timestamp).toLocaleDateString()}</span>
          <button onClick={(e) => handlePlayAudio(e, f.content, `frag-content-${f.id}`)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${playingAudioId === `frag-content-${f.id}` ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}>{playingAudioId === `frag-content-${f.id}` ? '⏹' : '🎧'}</button>
       </div>
       
       <div className="flex flex-col space-y-1.5">
         {f.fragmentType === 'transient' && (
           <button 
             onClick={() => onViewChange?.('editor', undefined, undefined, f.content)}
             className="w-full text-[9px] font-black text-indigo-600 bg-indigo-50 py-2 rounded-xl uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100"
           >
             🖋️ 去记录，去书写
           </button>
         )}
         {f.fragmentType === 'seed' && (
           <button 
             onClick={() => onPromoteFragment?.(f.id)}
             disabled={promotingFragmentId === f.id}
             className="w-full text-[9px] font-black text-indigo-600 bg-indigo-50 py-2 rounded-xl uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {promotingFragmentId === f.id ? '转化中...' : '💎 升级为珍宝'}
           </button>
         )}
       </div>
     </div>
  </div>
));

const GemGridItem = React.memo(({
  gem,
  onViewChange,
  onDeleteVocab,
  handlePlayAudio,
  playingAudioId,
  getMasteryTextStyle,
  onMarkAsMastered
}: {
  gem: AdvancedVocab & { language: string },
  onViewChange: (view: ViewState, vocabId?: string) => void,
  onDeleteVocab?: (id: string) => void,
  handlePlayAudio: (e: React.MouseEvent, text: string, id: string) => void,
  playingAudioId: string | null,
  getMasteryTextStyle: (mastery: number | undefined) => string,
  onMarkAsMastered?: (id: string) => void
}) => (
  <div 
    onClick={() => onViewChange('vocab_practice_detail', gem.id)}
    className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative cursor-pointer flex flex-col min-h-[220px]"
  >
     <div className="absolute top-6 left-8">
       <span className="text-[8px] font-black text-slate-200 uppercase tracking-[0.2em]">{gem.language}</span>
     </div>
     <div className="absolute top-6 right-8 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
       {(gem.mastery || 0) < 5 && (
         <button 
           onClick={(e) => { e.stopPropagation(); onMarkAsMastered?.(gem.id); }} 
           className="p-2 text-indigo-400 hover:text-indigo-600 transition-colors"
           title="一键满级"
         >
           🎓
         </button>
       )}
       <button onClick={(e) => { e.stopPropagation(); onDeleteVocab?.(gem.id); }} className="p-2 text-slate-100 hover:text-rose-400 transition-colors">✕</button>
     </div>
     <div className="flex-1 flex flex-col justify-center mt-2">
       <h4 className="text-3xl font-black text-slate-900 serif-font mb-2 tracking-tight leading-relaxed" dangerouslySetInnerHTML={{ __html: renderRuby(gem.word) }}></h4>
       {gem.phonetic && (
         <p className="text-[10px] text-slate-400 font-mono tracking-widest mb-2 opacity-60">{gem.phonetic}</p>
       )}
       <p className="text-sm text-slate-500 italic leading-relaxed font-medium">
         {stripRuby(gem.meaning)}
       </p>
     </div>
     <div className="pt-6 flex items-center justify-between mt-auto">
        <div className={`text-[10px] font-black uppercase tracking-[0.1em] ${getMasteryTextStyle(gem.mastery)}`}>
          MASTERY {Number(gem.mastery || 0).toFixed(1)}
        </div>
        <button onClick={(e) => handlePlayAudio(e, gem.word, gem.id)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === gem.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md'}`}>{playingAudioId === gem.id ? '⏹' : '🎧'}</button>
     </div>
  </div>
));

const GemRowItem = React.memo(({
  gem,
  isExpanded,
  children,
  selectedVocabIds,
  toggleVocabSelection,
  toggleGemExpansion,
  onViewChange,
  handlePlayAudio,
  playingAudioId,
  getMasteryTextStyle,
  loadingPractices,
  gemPractices,
  onDeleteVocab,
  onMarkAsMastered
}: {
  gem: AdvancedVocab & { language: string },
  isExpanded: boolean,
  children: (AdvancedVocab & { language: string })[],
  selectedVocabIds: Set<string>,
  toggleVocabSelection: (id: string) => void,
  toggleGemExpansion: (id: string) => void,
  onViewChange: (view: ViewState, vocabId?: string) => void,
  handlePlayAudio: (e: React.MouseEvent, text: string, id: string) => void,
  playingAudioId: string | null,
  getMasteryTextStyle: (mastery: number | undefined) => string,
  loadingPractices: Set<string>,
  gemPractices: Record<string, PracticeRecord[]>,
  onDeleteVocab?: (id: string) => void,
  onMarkAsMastered?: (id: string) => void
}) => (
  <div key={gem.id} className="group transition-colors hover:bg-slate-50/50">
    <div 
      onClick={() => toggleGemExpansion(gem.id)}
      className="flex items-center px-6 md:px-10 py-5 cursor-pointer"
    >
      <div className="mr-4 md:mr-6 shrink-0" onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={selectedVocabIds.has(gem.id)}
          onChange={() => toggleVocabSelection(gem.id)}
          className="w-4 h-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500/20"
        />
      </div>
      <div className="flex-1 flex items-center space-x-4 md:space-x-8">
        <div className="w-12 md:w-16 shrink-0 flex items-center space-x-2">
          <span className="text-base">{LANGUAGE_FLAGS[gem.language] || '🌐'}</span>
          {children.length > 0 && (
            <span className="bg-indigo-50 text-indigo-600 text-[8px] font-black px-1.5 py-0.5 rounded-full">+{children.length}</span>
          )}
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-8 items-center">
          <div className="flex items-center space-x-3">
            <div className="flex flex-col">
              <h4
              className="text-lg font-black text-slate-900 serif-font tracking-tight leading-tight"
              dangerouslySetInnerHTML={{
                __html: renderRuby(gem.word),
              }}
              data-tooltip-id="vocab-tooltip"
              data-tooltip-html={renderRuby(gem.word)}
            ></h4>
              {gem.phonetic && (
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">{gem.phonetic}</span>
              )}
            </div>
            <button onClick={(e) => handlePlayAudio(e, gem.word, gem.id)} className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${playingAudioId === gem.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-200 hover:text-indigo-600'}`}>
              {playingAudioId === gem.id ? <span className="text-[8px]">⏹</span> : <span className="text-[10px]">🎧</span>}
            </button>
          </div>
          <div className="text-sm text-slate-500 font-medium truncate">
            {stripRuby(gem.meaning)}
          </div>
          <div className="flex items-center justify-between md:justify-end space-x-4">
            <div className="flex space-x-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <div key={star} className={`w-1.5 h-1.5 rounded-full ${star <= (gem.mastery || 0) ? 'bg-indigo-500' : 'bg-slate-100'}`}></div>
              ))}
            </div>
            <div className={`text-[9px] font-black uppercase tracking-widest ${getMasteryTextStyle(gem.mastery)}`}>
              LV.{Number(gem.mastery || 0).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
      <div className="ml-4 md:ml-8 flex items-center space-x-4">
        <button 
          onClick={(e) => { e.stopPropagation(); onViewChange('vocab_practice_detail', gem.id); }}
          className="hidden md:block text-[9px] font-black text-slate-300 uppercase tracking-widest hover:text-indigo-600 transition-colors"
        >
          详情
        </button>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </div>
    </div>

    {/* Expanded Content: Children & Sentence Gems */}
    {isExpanded && (
      <div className="px-6 md:px-10 pb-8 pt-2 animate-in slide-in-from-top-2 duration-300">
        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/50 space-y-6">
          {/* Children Section */}
          {children.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.2em]">关联短语/用法 LINKED PHRASES</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children.map(child => (
                  <div 
                    key={child.id}
                    onClick={(e) => { e.stopPropagation(); onViewChange('vocab_practice_detail', child.id); }}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group/child"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h6 className="text-sm font-bold text-slate-800 serif-font" dangerouslySetInnerHTML={{ __html: renderRuby(child.word) }}></h6>
                      <span className="text-[8px] font-black text-indigo-400">LV.{Number(child.mastery || 0).toFixed(1)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-1 italic">{stripRuby(child.meaning)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">造句精华 SENTENCE GEMS</h5>
              <button 
                onClick={() => onViewChange('vocab_practice', gem.id)}
                className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
              >
                去练习 →
              </button>
            </div>
            
            {loadingPractices.has(gem.id) ? (
              <div className="flex items-center space-x-2 py-2">
                <div className="w-3 h-3 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">正在调取足迹...</span>
              </div>
            ) : (gemPractices[gem.id] || gem.practices) && (gemPractices[gem.id] || gem.practices)!.length > 0 ? (
              <div className="space-y-3">
                {(gemPractices[gem.id] || gem.practices)!.slice(0, 3).map((p, idx) => (
                  <div key={p.id || idx} className="flex items-start space-x-3 group/sentence">
                    <span className="text-indigo-300 text-xs mt-1">✦</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 leading-relaxed serif-font">
                        <div dangerouslySetInnerHTML={{ __html: renderRuby(p.betterVersion || p.sentence) }} />
                      </p>
                      {p.originalAttempt && p.originalAttempt !== (p.betterVersion || p.sentence) && (
                        <p className="text-[10px] text-slate-400 mt-1 line-through opacity-50 italic">
                          {p.originalAttempt}
                        </p>
                      )}
                    </div>
                    <button onClick={(e) => handlePlayAudio(e, p.betterVersion || p.sentence, `practice-${p.id}`)} className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover/sentence:opacity-100 ${playingAudioId === `practice-${p.id}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-300 hover:text-indigo-600 shadow-sm'}`}>
                      {playingAudioId === `practice-${p.id}` ? <span className="text-[8px]">⏹</span> : <span className="text-[10px]">🎧</span>}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">尚无造句记录，快去开启第一次磨炼吧。</p>
            )}
          </div>
          
          <div className="pt-4 flex items-center justify-between border-t border-slate-100/50">
             <div className="flex items-center space-x-4">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">入库日期: {new Date(gem.timestamp).toLocaleDateString()}</span>
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">语种: {gem.language}</span>
             </div>
             <div className="flex items-center space-x-4">
               {(gem.mastery || 0) < 5 && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); onMarkAsMastered?.(gem.id); }} 
                   className="text-[9px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700 transition-colors"
                 >
                   🎓 一键满级
                 </button>
               )}
               <button onClick={(e) => { e.stopPropagation(); onDeleteVocab?.(gem.id); }} className="text-[9px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-600 transition-colors">
                 删除记录
               </button>
             </div>
          </div>
        </div>
      </div>
    )}
  </div>
));

const VocabListView: React.FC<VocabListViewProps> = ({ 
  allAdvancedVocab, 
  fragments, 
  onViewChange, 
  onDeleteVocab, 
  onDeleteFragment, 
  onPromoteFragment, 
  onPromoteToSeed,
  onBulkPromoteFragments,
  isMenuOpen,
  onBulkUpdateLanguage,
  onLinkVocab,
  onMarkAsMastered,
  promotingFragmentId
}) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'shards'>('gems');
  const [shardFilter, setShardFilter] = useState<'all' | 'seed' | 'transient'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'dictionary'>('dictionary');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [sortMode, setSortMode] = useState<'date' | 'mastery_desc' | 'mastery_asc' | 'language'>('date');
  const [expandedGems, setExpandedGems] = useState<Set<string>>(new Set());
  const [gemPractices, setGemPractices] = useState<Record<string, PracticeRecord[]>>({});
  const [loadingPractices, setLoadingPractices] = useState<Set<string>>(new Set());
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]); // Empty means 'All'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  
  const [selectedVocabIds, setSelectedVocabIds] = useState<Set<string>>(new Set());
  const [selectedShardIds, setSelectedShardIds] = useState<Set<string>>(new Set());
  const [isBulkLanguageModalOpen, setIsBulkLanguageModalOpen] = useState(false);
  const [isBulkLinkModalOpen, setIsBulkLinkModalOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search Debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setVisibleCount(20); // Reset pagination on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination on tab/filter change
  useEffect(() => {
    setVisibleCount(20);
  }, [activeTab, shardFilter, selectedLangs, sortMode]);

  // Dynamically extract all unique languages
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    allAdvancedVocab.forEach(v => {
      if (v.language) langs.add(v.language);
    });
    fragments.forEach(f => {
      if (f.language) langs.add(f.language);
    });
    const sorted = Array.from(langs).sort();
    return ['Unknown', ...sorted];
  }, [allAdvancedVocab, fragments]);

  const toggleLanguage = (lang: string) => {
    setSelectedLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const selectAll = () => setSelectedLangs([]);

  const toggleGemExpansion = async (id: string) => {
    const isExpanding = !expandedGems.has(id);
    
    setExpandedGems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (isExpanding && !gemPractices[id] && db) {
      setLoadingPractices(prev => new Set(prev).add(id));
      try {
        const userId = localStorage.getItem('last_user_id');
        if (userId) {
          const practicesColRef = collection(db, 'users', userId, 'advancedVocab', id, 'practices');
          const practicesSnapshot = await getDocs(query(practicesColRef, orderBy('timestamp', 'desc')));
          const practices = practicesSnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id })) as PracticeRecord[];
          setGemPractices(prev => ({ ...prev, [id]: practices }));
        }
      } catch (e) {
        console.error("Failed to fetch practices for gem:", id, e);
      } finally {
        setLoadingPractices(prev => {
          const nextLoading = new Set(prev);
          nextLoading.delete(id);
          return nextLoading;
        });
      }
    }
  };

  const filteredGems = useMemo(() => {
    let list = [...allAdvancedVocab];
    
    // Search filter
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      list = list.filter(g => 
        stripRuby(g.word).toLowerCase().includes(q) ||
        stripRuby(g.meaning).toLowerCase().includes(q) ||
        g.practices?.some(p => p.originalAttempt?.toLowerCase().includes(q) || p.sentence.toLowerCase().includes(q))
      );
    }

    // Language filter
    if (selectedLangs.length > 0) {
      list = list.filter(g => {
        if (selectedLangs.includes('Unknown')) {
          return !g.language || g.language === 'Unknown' || selectedLangs.includes(g.language);
        }
        return selectedLangs.includes(g.language);
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortMode === 'mastery_desc') return (b.mastery || 0) - (a.mastery || 0);
      if (sortMode === 'mastery_asc') return (a.mastery || 0) - (b.mastery || 0);
      if (sortMode === 'language') return a.language.localeCompare(b.language);
      return b.timestamp - a.timestamp;
    });

    // Hierarchical Grouping: Only show parents at top level if in dictionary view
    if (viewMode === 'dictionary' && !debouncedSearchQuery) {
      const parents = list.filter(g => !g.parentId);
      return parents;
    }

    return list;
  }, [allAdvancedVocab, selectedLangs, debouncedSearchQuery, sortMode, viewMode]);

  const getChildren = (parentId: string) => {
    return allAdvancedVocab.filter(g => g.parentId === parentId);
  };

  const filteredShards = useMemo(() => {
    let list = [...fragments];
    
    // Search filter
    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      list = list.filter(f => 
        stripRuby(f.content).toLowerCase().includes(q) ||
        (f.meaning && stripRuby(f.meaning).toLowerCase().includes(q)) ||
        (f.usage && stripRuby(f.usage).toLowerCase().includes(q))
      );
    }

    if (selectedLangs.length > 0) {
      list = list.filter(f => selectedLangs.includes(f.language));
    }

    // Shard type filter
    if (shardFilter === 'seed') {
      list = list.filter(f => f.fragmentType === 'seed');
    } else if (shardFilter === 'transient') {
      list = list.filter(f => f.fragmentType === 'transient');
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [fragments, selectedLangs, debouncedSearchQuery, shardFilter]);

  // Infinite Scroll Observer
  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => prev + 20);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, [activeTab]); // Only re-run when tab changes, visibleCount updates internally

  const handlePlayAudio = async (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    if (!text) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (playingAudioId === id) { setPlayingAudioId(null); return; }
    }
    setPlayingAudioId(id);
    try {
      const cleanText = stripRuby(text);
      const base64Audio = await getAudioWithCache(cleanText);
      if (!base64Audio) { setPlayingAudioId(null); return; }
      const bytes = decode(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { setPlayingAudioId(null); }
  };

  const toggleVocabSelection = (id: string) => {
    setSelectedVocabIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleShardSelection = (id: string) => {
    setSelectedShardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkLanguageChange = (lang: string) => {
    if (onBulkUpdateLanguage) {
      onBulkUpdateLanguage(Array.from(selectedVocabIds), lang);
      setSelectedVocabIds(new Set());
      setIsBulkLanguageModalOpen(false);
    }
  };

  const handleBulkLinkChange = (parentId: string | null) => {
    if (onLinkVocab) {
      onLinkVocab(Array.from(selectedVocabIds), parentId);
      setSelectedVocabIds(new Set());
      setIsBulkLinkModalOpen(false);
    }
  };

  const getMasteryTextStyle = (mastery: number | undefined) => {
    const m = mastery || 0;
    if (m >= 4) return 'text-indigo-600';
    return 'text-slate-400';
  };

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto no-scrollbar pb-32 relative"
    >
      <header className="mb-8 text-left px-4 md:px-8 pt-6 md:pt-10">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font tracking-tight">馆藏珍宝 <span className="text-indigo-600">Gems & Shards</span></h2>
        <p className="text-slate-400 text-sm md:text-base mt-2 italic">在这里查看每一件被打磨出的语言珍宝。</p>
      </header>

      {/* Sticky Search & Controls Bar */}
      <div className={`sticky top-0 z-50 bg-white/80 backdrop-blur-md transition-all duration-300 py-4 border-b border-slate-200 shadow-sm ${isMenuOpen ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4 px-4 md:px-8">
          <div className={`w-full sm:flex-1 flex items-center space-x-3 px-4 py-2.5 rounded-2xl border transition-all duration-200 ${
            isFilterOpen 
              ? 'bg-slate-100 border-transparent opacity-50 pointer-events-none shadow-none' 
              : 'bg-white border-slate-100 shadow-sm focus-within:ring-4 focus-within:ring-indigo-500/5'
          }`}>
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索单词、释义或造句..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 placeholder:text-slate-300"
              disabled={isFilterOpen}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Tab Switcher */}
            <div className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm flex shrink-0">
              <button 
                onClick={() => setActiveTab('gems')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'gems' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                GEMS ({filteredGems.length})
              </button>
              <button 
                onClick={() => setActiveTab('shards')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'shards' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                SHARDS ({filteredShards.length})
              </button>
            </div>

            {/* Shard Sub-filter */}
            {activeTab === 'shards' && (
              <div className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm flex shrink-0">
                <button 
                  onClick={() => setShardFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shardFilter === 'all' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  全部
                </button>
                <button 
                  onClick={() => setShardFilter('seed')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shardFilter === 'seed' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-emerald-600'}`}
                >
                  种子
                </button>
                <button 
                  onClick={() => setShardFilter('transient')}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${shardFilter === 'transient' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-indigo-600'}`}
                >
                  随笔
                </button>
              </div>
            )}

            {/* View Mode Switcher (Only for Gems) */}
            {activeTab === 'gems' && (
              <div className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm flex shrink-0">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
                  title="网格视图"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('dictionary')}
                  className={`p-1.5 rounded-lg transition-all ${viewMode === 'dictionary' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-300 hover:text-slate-500'}`}
                  title="词典视图"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <select 
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as any)}
                className="appearance-none bg-white border border-slate-100 rounded-xl px-4 py-2 pr-10 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm focus:ring-4 focus:ring-indigo-500/5 outline-none cursor-pointer"
              >
                <option value="date">按日期排序</option>
                <option value="mastery_desc">熟练度：高 → 低</option>
                <option value="mastery_asc">熟练度：低 → 高</option>
                <option value="language">按语种</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-slate-300 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Language Filter Popover Trigger */}
            <div className="relative shrink-0" ref={filterRef}>
              <button 
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all ${
                  isFilterOpen || selectedLangs.length > 0 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                    : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 shadow-sm'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                  {selectedLangs.length === 0 ? '语言' : `${selectedLangs.length} 种`}
                </span>
              </button>

              {isFilterOpen && (
                <div className="fixed sm:absolute top-[20vh] sm:top-full mt-3 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 w-[90vw] sm:w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 z-[100] animate-in zoom-in-95 slide-in-from-top-2 duration-200 mx-auto">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">语言档案库</span>
                    <button onClick={selectAll} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">重置</button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
                    {availableLanguages.length > 0 ? availableLanguages.map(lang => (
                      <label 
                        key={lang} 
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                          selectedLangs.includes(lang) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-base">{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                          <span className="text-xs font-bold text-slate-700">{lang}</span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={selectedLangs.includes(lang)}
                          onChange={() => toggleLanguage(lang)}
                          className="w-4 h-4 rounded border-slate-200 text-indigo-600 focus:ring-indigo-500/20"
                        />
                      </label>
                    )) : (
                      <p className="text-[10px] text-center text-slate-300 py-4 font-bold uppercase">暂无记录语言</p>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-50">
                    <button 
                      onClick={() => setIsFilterOpen(false)}
                      className="w-full bg-slate-900 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg"
                    >
                      确 定
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Items List/Grid */}
      <div key={`${activeTab}-${selectedLangs.join('-')}-${viewMode}-${debouncedSearchQuery}-${sortMode}`} className="mt-8 px-4 md:px-8">
        {activeTab === 'gems' ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGems.length > 0 ? filteredGems.slice(0, visibleCount).map((gem) => (
                <GemGridItem 
                  key={gem.id}
                  gem={gem}
                  onViewChange={onViewChange}
                  onDeleteVocab={onDeleteVocab}
                  handlePlayAudio={handlePlayAudio}
                  playingAudioId={playingAudioId}
                  getMasteryTextStyle={getMasteryTextStyle}
                  onMarkAsMastered={onMarkAsMastered}
                />
              )) : (
                <EmptyState message="此视角下尚无珍宝" />
              )}
            </div>
          ) : (
            /* Dictionary View (Row Layout) */
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {filteredGems.length > 0 ? filteredGems.slice(0, visibleCount).map((gem) => {
                const isExpanded = expandedGems.has(gem.id);
                const children = getChildren(gem.id);
                return (
                  <GemRowItem 
                    key={gem.id}
                    gem={gem}
                    isExpanded={isExpanded}
                    children={children}
                    selectedVocabIds={selectedVocabIds}
                    toggleVocabSelection={toggleVocabSelection}
                    toggleGemExpansion={toggleGemExpansion}
                    onViewChange={onViewChange}
                    handlePlayAudio={handlePlayAudio}
                    playingAudioId={playingAudioId}
                    getMasteryTextStyle={getMasteryTextStyle}
                    loadingPractices={loadingPractices}
                    gemPractices={gemPractices}
                    onDeleteVocab={onDeleteVocab}
                    onMarkAsMastered={onMarkAsMastered}
                  />
                );
              }) : (
                <EmptyState message="此视角下尚无珍宝" />
              )}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredShards.length > 0 ? filteredShards.slice(0, visibleCount).map((f) => (
              <ShardItem 
                key={f.id}
                f={f}
                selectedShardIds={selectedShardIds}
                toggleShardSelection={toggleShardSelection}
                onDeleteFragment={onDeleteFragment}
                onPromoteToSeed={onPromoteToSeed}
                onPromoteFragment={onPromoteFragment}
                onViewChange={onViewChange}
                promotingFragmentId={promotingFragmentId}
                handlePlayAudio={handlePlayAudio}
                playingAudioId={playingAudioId}
              />
            )) : (
              <div className="col-span-full py-24 text-center flex flex-col items-center space-y-6">
                <span className="text-6xl opacity-20">🍂</span>
                <div className="text-center">
                  <p className="text-slate-900 font-bold serif-font text-xl">无相关碎片</p>
                  <p className="text-slate-400 text-xs mt-1 font-medium italic">请尝试更换筛选条件，或去主页捕捉新的灵感吧。</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Load More Trigger */}
      {((activeTab === 'gems' && filteredGems.length > visibleCount) || 
        (activeTab === 'shards' && filteredShards.length > visibleCount)) && (
        <div ref={loadMoreRef} className="py-12 flex justify-center">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-6 h-6 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">正在载入更多灵感...</span>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedVocabIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center space-x-8 z-[60] animate-in slide-in-from-bottom-10">
           <div className="flex flex-col">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SELECTED</span>
             <span className="text-lg font-bold">{selectedVocabIds.size} 项珍宝</span>
           </div>
           <div className="flex items-center space-x-3">
             <button 
               onClick={() => setIsBulkLinkModalOpen(true)}
               className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95"
             >
               🔗 关联至父级
             </button>
             <button 
               onClick={() => setIsBulkLanguageModalOpen(true)}
               className="bg-slate-800 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-slate-800/20 active:scale-95"
             >
               修改语种
             </button>
             <button 
               onClick={() => setSelectedVocabIds(new Set())}
               className="text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-widest px-4"
             >
               取消
             </button>
           </div>
        </div>
      )}

      {selectedShardIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center space-x-8 z-[60] animate-in slide-in-from-bottom-10">
           <div className="flex flex-col">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SELECTED</span>
             <span className="text-lg font-bold">{selectedShardIds.size} 项碎片</span>
           </div>
           <div className="flex items-center space-x-3">
             {Array.from(selectedShardIds).every(id => fragments.find(f => f.id === id)?.fragmentType === 'seed') && (
               <button 
                 onClick={async () => {
                   const ids = Array.from(selectedShardIds);
                   if (onBulkPromoteFragments) {
                     await onBulkPromoteFragments(ids);
                   } else {
                     for (const id of ids) {
                       await onPromoteFragment?.(id);
                     }
                   }
                   setSelectedShardIds(new Set());
                 }}
                 disabled={promotingFragmentId !== null}
                 className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
               >
                 {promotingFragmentId ? '升级中...' : '💎 批量升级为珍宝'}
               </button>
             )}
             <button 
               onClick={() => setSelectedShardIds(new Set())}
               className="text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-widest px-4"
             >
               取消
             </button>
           </div>
        </div>
      )}

      {/* Bulk Link Modal */}
      {isBulkLinkModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkLinkModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-xl font-black text-slate-900 serif-font">建立关联 Link to Parent</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">选择一个词汇作为这 {selectedVocabIds.size} 个条目的父级</p>
              
              <div className="mt-6 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text"
                  placeholder="搜索目标父级词汇..."
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/5"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar">
              <button 
                onClick={() => handleBulkLinkChange(null)}
                className="w-full text-left p-4 rounded-2xl hover:bg-rose-50 text-rose-600 transition-colors flex items-center justify-between group"
              >
                <span className="text-xs font-bold uppercase tracking-widest">解除所有关联 UNLINK ALL</span>
                <span className="opacity-0 group-hover:opacity-100">✕</span>
              </button>
              
              <div className="h-[1px] bg-slate-50 my-2"></div>
              
              {allAdvancedVocab
                .filter(v => !selectedVocabIds.has(v.id) && !v.parentId) // 不能关联到自己或已是子级的词
                .filter(v => stripRuby(v.word).toLowerCase().includes(linkSearchQuery.toLowerCase()))
                .slice(0, 50)
                .map(v => (
                  <button 
                    key={v.id}
                    onClick={() => handleBulkLinkChange(v.id)}
                    className="w-full text-left p-4 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-bold text-slate-700 serif-font">{stripRuby(v.word)}</span>
                      <span className="text-[8px] font-black text-slate-300 uppercase">{v.language}</span>
                    </div>
                    <span className="text-[10px] font-black text-indigo-600 opacity-0 group-hover:opacity-100">设为父级 SET AS PARENT</span>
                  </button>
                ))}
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setIsBulkLinkModalOpen(false)}
                className="w-full py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600"
              >
                取 消 CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Language Modal */}
      <Tooltip id="vocab-tooltip" className="z-[100] !bg-slate-900 !text-white !text-base !px-4 !py-2 !rounded-xl !shadow-lg" />
      {isBulkLanguageModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsBulkLanguageModalOpen(false)}></div>
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-slate-900 serif-font mb-6">批量修改语种</h3>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {availableLanguages.filter(l => l !== 'Unknown').map(lang => (
                <button
                  key={lang}
                  onClick={() => handleBulkLanguageChange(lang)}
                  className="flex items-center space-x-3 p-4 rounded-2xl border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all group"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">{LANGUAGE_FLAGS[lang] || '🌐'}</span>
                  <span className="text-xs font-bold text-slate-700">{lang}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsBulkLanguageModalOpen(false)}
              className="w-full py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600"
            >
              取 消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="col-span-full py-24 text-center flex flex-col items-center space-y-6">
    <span className="text-6xl grayscale opacity-20">🕯️</span>
    <div className="text-center">
      <p className="text-slate-900 font-bold serif-font text-xl">{message}</p>
      <p className="text-slate-400 text-xs mt-1 font-medium italic">请尝试更换筛选条件，或开启新的撰写。</p>
    </div>
  </div>
);

export default VocabListView;
