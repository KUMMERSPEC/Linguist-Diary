
import React, { useState, useMemo, useRef } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState, InspirationFragment } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabListViewProps {
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  fragments: InspirationFragment[];
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
  onDeleteVocab?: (vocabId: string) => void;
  onDeleteFragment?: (id: string) => void;
}

const VocabListView: React.FC<VocabListViewProps> = ({ allAdvancedVocab, fragments, onViewChange, onDeleteVocab, onDeleteFragment }) => {
  const [activeTab, setActiveTab] = useState<'gems' | 'shards'>('gems');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [filterLanguage, setFilterLanguage] = useState('All');
  const [sortBy, setSortBy] = useState<'mastery' | 'word'>('mastery');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedVocab = useMemo(() => {
    let filtered = allAdvancedVocab;
    if (filterLanguage !== 'All') filtered = filtered.filter(v => v.language === filterLanguage);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(v => v.word.toLowerCase().includes(q) || v.meaning.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      let comparison = sortBy === 'mastery' ? (a.mastery || 0) - (b.mastery || 0) : a.word.localeCompare(b.word);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [allAdvancedVocab, filterLanguage, sortBy, sortOrder, searchQuery]);

  const filteredFragments = useMemo(() => {
    return fragments.filter(f => searchQuery === '' || f.content.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [fragments, searchQuery]);

  const availableLanguages = useMemo(() => ['All', ...Array.from(new Set(allAdvancedVocab.map(v => v.language)))], [allAdvancedVocab]);

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handlePlayAudio = async (text: string, id: string) => {
    if (!text) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (playingAudioId === id) { setPlayingAudioId(null); return; }
    }
    setPlayingAudioId(id);
    try {
      const cleanText = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="mb-6 space-y-4 shrink-0">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">馆藏珍宝 Gems & Shards</h2>
        <div className="flex items-center space-x-2 border-b border-slate-100">
          <button onClick={() => setActiveTab('gems')} className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'gems' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>入库珍宝 Gems</button>
          <button onClick={() => setActiveTab('shards')} className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'shards' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>灵感碎片 Shards</button>
        </div>

        <div className="flex flex-col md:flex-row gap-3 pt-4">
          <div className="relative group md:w-64">
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="appearance-none p-3 pl-5 pr-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm outline-none w-full"
            >
              {availableLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '🌐 全部语言' : l}</option>)}
            </select>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜寻您的馆藏..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="p-3 pl-10 pr-5 bg-white border border-slate-200 rounded-2xl text-xs font-medium w-full shadow-sm outline-none"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-12">
        {activeTab === 'gems' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedVocab.map((vocab, idx) => (
              <button
                key={`${vocab.id}-${idx}`}
                onClick={() => onViewChange('vocab_practice_detail', vocab.id)}
                className="group text-left bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-2xl hover:border-indigo-200 relative"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl md:text-2xl font-black text-slate-900 serif-font leading-[2.5]">{renderRuby(vocab.word)}</h3>
                  <button onClick={(e) => { e.stopPropagation(); onDeleteVocab?.(vocab.id); }} className="text-slate-200 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                </div>
                <p className="text-xs text-slate-500 italic mb-4 line-clamp-2 serif-font leading-relaxed">{renderRuby(vocab.meaning)}</p>
                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                   <span className="text-[9px] font-black uppercase text-indigo-500">Mastery {vocab.mastery || 0}</span>
                   <button onClick={(e) => { e.stopPropagation(); handlePlayAudio(vocab.word, vocab.id); }} className={`w-8 h-8 rounded-xl flex items-center justify-center ${playingAudioId === vocab.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}>🎧</button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredFragments.map(shard => (
              <div key={shard.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative group">
                <p className="text-sm text-slate-700 italic leading-relaxed serif-font mb-4">“ {shard.content} ”</p>
                <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase">{new Date(shard.timestamp).toLocaleDateString()}</span>
                  <button onClick={() => onDeleteFragment?.(shard.id)} className="text-[9px] font-black text-rose-300 hover:text-rose-500 uppercase">删除 SHARD</button>
                </div>
              </div>
            ))}
            {filteredFragments.length === 0 && (
              <div className="col-span-full py-24 text-center bg-white border border-dashed border-slate-200 rounded-[3rem]">
                <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">暂时没有待磨炼的灵感碎片。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabListView;
