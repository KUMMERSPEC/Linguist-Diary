
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState, InspirationFragment } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import { renderRuby, stripRuby } from '../utils/textHelpers';

interface VocabListViewProps {
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  fragments: InspirationFragment[];
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
  onDeleteVocab?: (vocabId: string) => void;
  onDeleteFragment?: (id: string) => void;
  onPromoteFragment?: (id: string) => void;
  onPromoteToSeed?: (id: string) => void;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  'English': '🇬🇧',
  'Japanese': '🇯🇵',
  'French': '🇫🇷',
  'Spanish': '🇪🇸',
  'German': '🇩🇪',
};

const VocabListView: React.FC<VocabListViewProps> = ({ allAdvancedVocab, fragments, onViewChange, onDeleteVocab, onDeleteFragment, onPromoteFragment, onPromoteToSeed }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'shards'>('gems');
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]); // Empty means 'All'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);

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

  // Dynamically extract all unique languages
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    allAdvancedVocab.forEach(v => langs.add(v.language));
    fragments.forEach(f => langs.add(f.language));
    return Array.from(langs).sort();
  }, [allAdvancedVocab, fragments]);

  const toggleLanguage = (lang: string) => {
    setSelectedLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const selectAll = () => setSelectedLangs([]);

  const filteredGems = useMemo(() => {
    let list = [...allAdvancedVocab];
    if (selectedLangs.length > 0) {
      list = list.filter(g => selectedLangs.includes(g.language));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [allAdvancedVocab, selectedLangs]);

  const filteredShards = useMemo(() => {
    let list = [...fragments];
    if (selectedLangs.length > 0) {
      list = list.filter(f => selectedLangs.includes(f.language));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [fragments, selectedLangs]);

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
      const base64Audio = await generateDiaryAudio(cleanText);
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

  const getMasteryTextStyle = (mastery: number | undefined) => {
    const m = mastery || 0;
    if (m >= 4) return 'text-indigo-600';
    return 'text-slate-400';
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 animate-in fade-in duration-700">
      <header className="mb-10 text-left">
        <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font tracking-tight">馆藏珍宝 <span className="text-indigo-600">Gems & Shards</span></h2>
        <p className="text-slate-400 text-sm md:text-base mt-2 italic">在这里查看每一件被打磨出的语言珍宝。</p>
      </header>

      {/* Primary Navigation: Left-aligned Tabs and Filter */}
      <div className="flex flex-col items-start mb-10 space-y-4">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex items-center">
          <button 
            onClick={() => setActiveTab('gems')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'gems' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            入库珍宝 GEMS ({filteredGems.length})
          </button>
          <button 
            onClick={() => setActiveTab('shards')}
            className={`px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'shards' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}
          >
            灵感碎片 SHARDS ({filteredShards.length})
          </button>
        </div>

        {/* Language Filter Popover */}
        <div className="relative" ref={filterRef}>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`flex items-center space-x-3 px-6 py-2 rounded-2xl border transition-all ${
              isFilterOpen || selectedLangs.length > 0 
                ? 'bg-slate-900 border-slate-900 text-white shadow-xl' 
                : 'bg-white border-slate-100 text-slate-500 hover:border-indigo-200 shadow-sm'
            }`}
          >
            <span className="text-sm">🔍</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
              {selectedLangs.length === 0 ? '筛选馆藏语言' : `已筛选 ${selectedLangs.length} 种语言`}
            </span>
            <span className={`text-[8px] transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {isFilterOpen && (
            <div className="absolute top-full mt-3 left-0 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-6 z-[100] animate-in zoom-in-95 slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">语言档案库</span>
                <button onClick={selectAll} className="text-[9px] font-black text-indigo-600 uppercase hover:underline">重置全部</button>
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

      {/* Items Grid */}
      <div key={`${activeTab}-${selectedLangs.join('-')}`} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        {activeTab === 'gems' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGems.length > 0 ? filteredGems.map((gem) => (
              <div 
                key={gem.id} 
                onClick={() => onViewChange('vocab_practice_detail', gem.id)}
                className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative cursor-pointer flex flex-col min-h-[220px]"
              >
                 <div className="absolute top-6 left-8">
                   <span className="text-[8px] font-black text-slate-200 uppercase tracking-[0.2em]">{gem.language}</span>
                 </div>
                 <button onClick={(e) => { e.stopPropagation(); onDeleteVocab?.(gem.id); }} className="absolute top-6 right-8 p-2 text-slate-100 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                 <div className="flex-1 flex flex-col justify-center mt-2">
                   <h4 className="text-3xl font-black text-slate-900 serif-font mb-2 tracking-tight leading-relaxed" dangerouslySetInnerHTML={{ __html: renderRuby(gem.word) }}></h4>
                   <p className="text-sm text-slate-500 italic leading-relaxed font-medium">
                     {stripRuby(gem.meaning)}
                   </p>
                 </div>
                 <div className="pt-6 flex items-center justify-between mt-auto">
                    <div className={`text-[10px] font-black uppercase tracking-[0.1em] ${getMasteryTextStyle(gem.mastery)}`}>
                      MASTERY {gem.mastery || 0}
                    </div>
                    <button onClick={(e) => handlePlayAudio(e, gem.word, gem.id)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === gem.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-md'}`}>{playingAudioId === gem.id ? '⏹' : '🎧'}</button>
                 </div>
              </div>
            )) : (
              <div className="col-span-full py-24 text-center flex flex-col items-center space-y-6">
                <span className="text-6xl grayscale opacity-20">🕯️</span>
                <div className="text-center">
                  <p className="text-slate-900 font-bold serif-font text-xl">此视角下尚无珍宝</p>
                  <p className="text-slate-400 text-xs mt-1 font-medium italic">请尝试更换筛选条件，或开启新的撰写。</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredShards.length > 0 ? filteredShards.map((f) => (
              <div key={f.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group flex flex-col h-full hover:shadow-xl transition-all">
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center space-x-2">
                     <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${f.fragmentType === 'seed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-400'}`}>
                       {f.fragmentType === 'seed' ? '🌱 种子' : '📜 随笔'}
                     </span>
                     <span className="text-[7px] font-black text-slate-300 uppercase">{f.language}</span>
                   </div>
                   <button onClick={() => onDeleteFragment?.(f.id)} className="p-1 text-slate-200 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                 </div>
                 
                 <div className="flex-1 space-y-3">
                   <p className="text-base font-bold text-slate-800 leading-relaxed serif-font">“ {renderRuby(f.content)} ”</p>
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
                         onClick={() => onPromoteToSeed?.(f.id)}
                         className="w-full text-[9px] font-black text-emerald-600 bg-emerald-50 py-2 rounded-xl uppercase tracking-widest hover:bg-emerald-100 transition-colors border border-emerald-100"
                       >
                         🌱 转化为种子
                       </button>
                     )}
                     {f.fragmentType === 'seed' && (
                       <button 
                         onClick={() => onPromoteFragment?.(f.id)}
                         className="w-full text-[9px] font-black text-indigo-600 bg-indigo-50 py-2 rounded-xl uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100"
                       >
                         💎 升级为珍宝
                       </button>
                     )}
                   </div>
                 </div>
              </div>
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
    </div>
  );
};

export default VocabListView;
