
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabListViewProps {
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
}

const VocabListView: React.FC<VocabListViewProps> = ({ allAdvancedVocab, onViewChange }) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [filterLanguage, setFilterLanguage] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [sortBy, setSortBy] = useState<'mastery' | 'word'>('mastery'); // Changed default sort to mastery
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAndSortedVocab = useMemo(() => {
    let filtered = allAdvancedVocab;

    if (filterLanguage !== 'All') {
      filtered = filtered.filter(v => v.language === filterLanguage);
    }
    if (filterLevel !== 'All') {
      filtered = filtered.filter(v => v.level === filterLevel);
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

    return filtered;
  }, [allAdvancedVocab, filterLanguage, filterLevel, sortBy, sortOrder, searchQuery]);

  const availableLanguages = useMemo(() => ['All', ...Array.from(new Set(allAdvancedVocab.map(v => v.language)))], [allAdvancedVocab]);
  const availableLevels = useMemo(() => ['All', ...Array.from(new Set(allAdvancedVocab.map(v => v.level)))], [allAdvancedVocab]);

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
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">珍宝与足迹 Vocab & Practice History</h2>
        <p className="text-slate-500 text-sm italic">重温您的语言珍宝，追踪每一次练习的足迹。</p>

        {/* Combined filters and search into a single responsive row */}
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative group flex-1">
            <select
              value={filterLanguage}
              onChange={(e) => setFilterLanguage(e.target.value)}
              className="appearance-none p-2.5 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none w-full"
            >
              {availableLanguages.map(l => <option key={l} value={l}>{l === 'All' ? '🌐 所有语言' : l}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
          </div>
          <div className="relative group flex-1">
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="appearance-none p-2.5 pl-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none w-full"
            >
              {availableLevels.map(l => <option key={l} value={l}>{l === 'All' ? '🌟 所有等级' : l}</option>)}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索词汇..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="p-2.5 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-full shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
          <span>排序:</span>
          <button
            onClick={() => { setSortBy('mastery'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
            className={`px-3 py-1 rounded-full transition-all ${sortBy === 'mastery' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            掌握度 {sortBy === 'mastery' && (sortOrder === 'desc' ? '↓' : '↑')}
          </button>
          <button
            onClick={() => { setSortBy('word'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
            className={`px-3 py-1 rounded-full transition-all ${sortBy === 'word' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100'}`}
          >
            词汇 {sortBy === 'word' && (sortOrder === 'desc' ? '↓' : '↑')}
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
                className="text-left w-full bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-indigo-100/50 hover:border-indigo-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-black text-slate-900 serif-font">
                      {renderRuby(vocab.word)}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${getMasteryColor(vocab.mastery)}`}>
                      {getMasteryIcon(vocab.mastery)} Mastery {vocab.mastery || 0}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                    {vocab.language}
                  </span>
                </div>
                <p className="text-sm text-slate-600 italic mb-4 line-clamp-2">
                  {renderRuby(vocab.meaning)}
                </p>

                <div className="mt-4 pt-3 border-t border-dashed border-slate-100 flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-700">
                    {vocab.practices && vocab.practices.length > 0
                      ? `查看 ${vocab.practices.length} 条练习记录 →`
                      : '暂无练习记录，点击开始练习 →'}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlayAudio(vocab.word, `vocab-word-${vocab.word}-${vocab.language}`); }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${vocab.word}-${vocab.language}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                    title="收听单词发音"
                  >
                    {playingAudioId === `vocab-word-${vocab.word}-${vocab.language}` ? '⏹' : '🎧'}
                  </button>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 text-sm italic">没有找到匹配的词汇珍宝。</div>
        )}
      </div>
    </div>
  );
};

export default VocabListView;
