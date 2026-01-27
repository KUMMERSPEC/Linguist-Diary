
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabListViewProps {
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
  onDeleteVocab?: (vocabId: string) => void;
}

const VocabListView: React.FC<VocabListViewProps> = ({ allAdvancedVocab, onViewChange, onDeleteVocab }) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [filterLanguage, setFilterLanguage] = useState('All');
  const [sortBy, setSortBy] = useState<'mastery' | 'word'>('mastery');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedVocab = useMemo(() => {
    let filtered = allAdvancedVocab;

    if (filterLanguage !== 'All') {
      filtered = filtered.filter(v => v.language === filterLanguage);
    }
    if (searchQuery) {
      filtered = filtered.filter(v =>
        v.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.meaning.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.usage && v.usage.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'mastery') {
        comparison = (a.mastery || 0) - (b.mastery || 0);
      } else if (sortBy === 'word') {
        comparison = a.word.localeCompare(b.word);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return [...filtered];
  }, [allAdvancedVocab, filterLanguage, sortBy, sortOrder, searchQuery]);

  const availableLanguages = useMemo(() => ['All', ...Array.from(new Set(allAdvancedVocab.map(v => v.language)))], [allAdvancedVocab]);

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const stripRuby = (text: string) => {
    if (!text) return '';
    return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  };

  const handlePlayAudio = async (text: string, id: string) => {
    if (!text) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (playingAudioId === id) {
        setPlayingAudioId(null);
        return;
      }
    }

    setPlayingAudioId(id);
    try {
      const cleanText = stripRuby(text);
      const base64Audio = await generateDiaryAudio(cleanText);
      if (!base64Audio) {
        setPlayingAudioId(null);
        return;
      }
      const bytes = decode(base64Audio);
      if (bytes.length === 0) {
        setPlayingAudioId(null);
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) {
      console.error("Error playing audio:", e);
      setPlayingAudioId(null);
    }
  };

  const handleCardClick = (vocab: AdvancedVocab & { language: string }) => {
    const vocabId = `${vocab.word}-${vocab.language}`;
    onViewChange('vocab_practice_detail', vocabId);
  };

  const getMasteryColor = (mastery: number | undefined) => {
    const m = mastery || 0;
    if (m >= 4) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    if (m >= 2) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-slate-100 text-slate-500 border-slate-300';
  };

  const getMasteryIcon = (mastery: number | undefined) => {
    const m = mastery || 0;
    if (m === 0) return '🥚';
    if (m === 1) return '🐣';
    if (m === 2) return '🐥';
    if (m === 3) return '🐔';
    if (m >= 4) return '✨';
  };

  if (allAdvancedVocab.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in zoom-in duration-700">
      <div className="w-28 h-28 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-5xl mb-4 border border-slate-100">💎</div>
      <div>
        <h3 className="text-2xl font-black text-slate-900 serif-font">珍宝库空空如也</h3>
        <p className="text-slate-400 mt-2 text-sm italic">撰写更多日记以发现新的词汇珍宝...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="mb-6 space-y-4 shrink-0">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">珍宝与足迹 Vocab & History</h2>
        <p className="text-slate-500 text-sm italic">重温您的语言珍宝，追踪每一次练习的足迹。</p>

        {/* Improved layout: Dual columns for Language and Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative group md:w-64">
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="appearance-none p-3 pl-5 pr-12 bg-white border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none w-full cursor-pointer"
            >
              {availableLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '🌐 全部语言' : l}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="在馆藏中搜寻词汇..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="p-3 pl-10 pr-5 bg-white border border-slate-200 rounded-2xl text-xs font-medium w-full shadow-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
          <span>排序方式:</span>
          <button
            onClick={() => { setSortBy('mastery'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
            className={`px-4 py-1.5 rounded-full transition-all border ${sortBy === 'mastery' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
          >
            掌握度 {sortBy === 'mastery' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => { setSortBy('word'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
            className={`px-4 py-1.5 rounded-full transition-all border ${sortBy === 'word' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-transparent border-transparent hover:bg-slate-100'}`}
          >
            字母 A-Z {sortBy === 'word' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-4">
        {filteredAndSortedVocab.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedVocab.map((vocab, idx) => (
              <button
                key={`${vocab.word}-${vocab.language}-${idx}`}
                onClick={() => handleCardClick(vocab)}
                className="group/vcard text-left w-full bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-indigo-200 hover:-translate-y-1 relative"
              >
                {/* Delete Button (De-accessioning) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVocab?.(vocab.id);
                  }}
                  className="absolute top-6 right-6 w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-slate-300 hover:bg-rose-50 hover:text-rose-400 transition-all opacity-0 group-hover/vcard:opacity-100"
                  title="移出珍宝阁"
                >
                  ✕
                </button>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col space-y-1">
                    <h3 className="text-xl font-black text-slate-900 serif-font">
                      {renderRuby(vocab.word)}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${getMasteryColor(vocab.mastery)}`}>
                        {getMasteryIcon(vocab.mastery)} {vocab.mastery || 0}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-indigo-500/40 group-hover/vcard:text-indigo-600 uppercase tracking-widest transition-colors mr-6">
                    {vocab.language}
                  </span>
                </div>
                <p className="text-xs text-slate-500 italic mb-6 line-clamp-2 leading-relaxed serif-font">
                  {renderRuby(vocab.meaning)}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/vcard:text-indigo-500 transition-colors">
                    {vocab.practices && vocab.practices.length > 0
                      ? `查看 ${vocab.practices.length} 条足迹 →`
                      : '开始打磨 →'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlayAudio(vocab.word, `vocab-word-${vocab.word}-${vocab.language}`); }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${vocab.word}-${vocab.language}` ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}
                  >
                    {playingAudioId === `vocab-word-${vocab.word}-${vocab.language}` ? '⏹' : '🎧'}
                  </button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-24 text-center bg-white border border-dashed border-slate-200 rounded-[3rem]">
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">没有找到匹配的珍宝。</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VocabListView;
