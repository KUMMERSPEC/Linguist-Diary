import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DiaryEntry, AdvancedVocab, PracticeRecord } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface ReviewVaultProps {
  entries: DiaryEntry[];
  onReviewEntry: (entry: DiaryEntry) => void;
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
}

type ExtendedVocab = AdvancedVocab & { date: string, entryId: string, language: string };

const ReviewVault: React.FC<ReviewVaultProps> = ({ entries, onReviewEntry, onUpdateMastery }) => {
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  
  // State for selected word
  const [selectedWord, setSelectedWord] = useState<ExtendedVocab | null>(null);
  // State for mobile view: true when practice detail is shown, false for list
  const [showPracticeDetail, setShowPracticeDetail] = useState(false); 

  // States for practice mode
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const listRef = useRef<HTMLDivElement>(null); // Ref to scroll the list into view

  const [filterLanguage, setFilterLanguage] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'mastery'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');


  const allVocab = useMemo(() => {
    const list: ExtendedVocab[] = [];
    entries.forEach(entry => {
      if (entry.analysis) {
        entry.analysis.advancedVocab.forEach(v => {
          list.push({ ...v, date: entry.date, entryId: entry.id, language: entry.language });
        });
      }
    });

    // Deduplicate and prioritize most recent entries, also handle mastery
    const unique = new Map<string, ExtendedVocab>();
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach(v => {
      const key = `${v.word}-${v.language}`; // Unique key combining word and language
      if (!unique.has(key)) {
        unique.set(key, v);
      } else {
        // If already exists, but the new one has higher mastery or practices, update it.
        const existing = unique.get(key)!;
        if ((v.mastery || 0) > (existing.mastery || 0) || (v.practices?.length || 0) > (existing.practices?.length || 0)) {
          unique.set(key, v);
        }
      }
    });
    return Array.from(unique.values());
  }, [entries]);

  const filteredAndSortedVocab = useMemo(() => {
    let filtered = allVocab;

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
        v.usage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'mastery') {
        comparison = (a.mastery || 0) - (b.mastery || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allVocab, filterLanguage, filterLevel, sortBy, sortOrder, searchQuery]);

  const availableLanguages = useMemo(() => ['All', ...Array.from(new Set(allVocab.map(v => v.language)))], [allVocab]);
  const availableLevels = useMemo(() => ['All', ...Array.from(new Set(allVocab.map(v => v.level)))], [allVocab]);

  // Reset practice input and feedback when selected word changes
  useEffect(() => {
    setLastFeedback(null);
    setPracticeInput('');
  }, [selectedWord]);

  // Effect for practice mode to update selected word
  useEffect(() => {
    if (isPracticeMode && filteredAndSortedVocab.length > 0) {
      const newIndex = Math.max(0, Math.min(currentPracticeIndex, filteredAndSortedVocab.length - 1));
      setSelectedWord(filteredAndSortedVocab[newIndex]);
      setCurrentPracticeIndex(newIndex); // Ensure index is within bounds
      setShowPracticeDetail(true); // Always show detail in practice mode
    } else if (!isPracticeMode && selectedWord && !showPracticeDetail) {
      // If practice mode ends and detail is not explicitly shown, clear selected word
      setSelectedWord(null);
    }
  }, [isPracticeMode, currentPracticeIndex, filteredAndSortedVocab, showPracticeDetail]);

  // Scroll selected word into view if in practice mode or manually selected
  useEffect(() => {
    if (listRef.current && selectedWord) {
      const element = listRef.current.querySelector(`[data-vocab-id="${selectedWord.word}-${selectedWord.date}-${selectedWord.entryId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedWord]);


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
      if (playingAudioId === id) { // Toggling off the current audio
        setPlayingAudioId(null);
        return;
      }
    }
    
    setPlayingAudioId(id);
    try {
      const cleanText = stripRuby(text); // Remove ruby tags for speech synthesis
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

  const handleSelectWord = (vocab: ExtendedVocab) => {
    setSelectedWord(vocab);
    setShowPracticeDetail(true); // Show detail on mobile click
    if (!isPracticeMode) {
      // If not in practice mode, find the index of the selected word
      const index = filteredAndSortedVocab.findIndex(v => 
        v.word === vocab.word && v.date === vocab.date && v.entryId === vocab.entryId
      );
      if (index !== -1) {
        setCurrentPracticeIndex(index);
      }
    }
  };

  const handleBackToList = () => {
    setShowPracticeDetail(false);
    setSelectedWord(null);
    setIsPracticeMode(false); // Exit practice mode when going back to list
    setLastFeedback(null);
    setPracticeInput('');
  };

  const handleNextWord = useCallback(() => {
    setLastFeedback(null);
    setPracticeInput('');
    if (currentPracticeIndex < filteredAndSortedVocab.length - 1) {
      setCurrentPracticeIndex(prev => prev + 1);
    } else {
      // Optionally loop or end practice
      alert("恭喜您完成了所有单词练习！");
      setIsPracticeMode(false);
      setSelectedWord(null);
      setShowPracticeDetail(false);
    }
  }, [currentPracticeIndex, filteredAndSortedVocab.length]);

  const handlePrevWord = useCallback(() => {
    setLastFeedback(null);
    setPracticeInput('');
    if (currentPracticeIndex > 0) {
      setCurrentPracticeIndex(prev => prev - 1);
    } else {
      alert("已经是第一个单词了。");
    }
  }, [currentPracticeIndex]);

  const handleStartPractice = () => {
    if (filteredAndSortedVocab.length === 0) {
      alert("没有词汇可以练习。");
      return;
    }
    setIsPracticeMode(true);
    setCurrentPracticeIndex(0);
    // setSelectedWord will be updated by useEffect
    // setShowPracticeDetail will be updated by useEffect
  };

  const handleExitPracticeMode = () => {
    setIsPracticeMode(false);
    setSelectedWord(null);
    setShowPracticeDetail(false);
    setLastFeedback(null);
    setPracticeInput('');
  };

  const handleValidatePractice = async () => {
    if (!selectedWord || !practiceInput.trim() || isValidating) return;
    setIsValidating(true);
    setLastFeedback(null);
    try {
      const feedback = await validateVocabUsage(
        stripRuby(selectedWord.word), // Send plain text word to AI
        selectedWord.meaning,
        practiceInput,
        selectedWord.language
      );
      setLastFeedback(feedback);

      const newMastery = feedback.isCorrect ? Math.min((selectedWord.mastery || 0) + 1, 5) : Math.max((selectedWord.mastery || 0) - 1, 0);
      const newPracticeRecord: PracticeRecord = {
        sentence: practiceInput,
        originalAttempt: practiceInput, // Store the user's attempt
        feedback: feedback.feedback,
        betterVersion: feedback.betterVersion,
        timestamp: Date.now(),
        status: feedback.isCorrect ? 'Perfect' : 'Polished', // Differentiate perfect from polished
      };
      onUpdateMastery(selectedWord.entryId, selectedWord.word, newMastery, newPracticeRecord);

      // Auto-advance if in practice mode and correct
      if (isPracticeMode && feedback.isCorrect) {
        setTimeout(() => {
          handleNextWord();
        }, 1500); // Give user a moment to see feedback
      }

    } catch (e) {
      console.error("Validation failed:", e);
      setLastFeedback({ isCorrect: false, feedback: "验证失败，请稍后重试。" });
    } finally {
      setIsValidating(false);
    }
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

  if (allVocab.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in zoom-in duration-700">
      <div className="w-28 h-28 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-5xl mb-4 border border-slate-100">💎</div>
      <div>
        <h3 className="text-2xl font-black text-slate-900 serif-font">珍宝库空空如也</h3>
        <p className="text-slate-400 mt-2 text-sm italic">撰写更多日记以发现新的词汇珍宝...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full animate-in fade-in duration-500 overflow-hidden w-full relative">
      {/* 左侧：词汇列表 - Conditionally hidden on mobile when detail is shown */}
      <aside className={`flex-shrink-0 bg-white border-r border-slate-100 p-6 flex flex-col transition-all duration-300 ${showPracticeDetail ? 'hidden md:flex w-1/2 lg:w-1/3 max-w-lg' : 'w-full md:w-1/2 lg:w-1/3 max-w-lg'}`}>
        <header className="mb-6 space-y-4 shrink-0">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font">珍宝复习 Review Vault</h2>
          <p className="text-slate-500 text-sm italic">在这里，重温并强化您所学到的宝贵词汇。</p>

          <div className="flex flex-col sm:flex-row gap-2">
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
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="搜索词汇..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="p-2.5 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium w-full shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all outline-none" 
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>排序:</span>
            <button 
              onClick={() => { setSortBy('date'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
              className={`px-3 py-1 rounded-full transition-all ${sortBy === 'date' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              日期 {sortBy === 'date' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
            <button 
              onClick={() => { setSortBy('mastery'); setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc'); }}
              className={`px-3 py-1 rounded-full transition-all ${sortBy === 'mastery' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              掌握度 {sortBy === 'mastery' && (sortOrder === 'desc' ? '↓' : '↑')}
            </button>
          </div>
          
          {/* Start Practice Button */}
          {!isPracticeMode ? (
            <button
              onClick={handleStartPractice}
              disabled={filteredAndSortedVocab.length === 0}
              className="w-full bg-indigo-600 text-white py-3 rounded-2xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95 mt-4"
            >
              🚀 开始练习 Start Practice
            </button>
          ) : (
            <button
              onClick={handleExitPracticeMode}
              className="w-full bg-slate-200 text-slate-700 py-3 rounded-2xl text-sm font-bold shadow-md hover:bg-slate-300 transition-all active:scale-95 mt-4"
            >
              🔚 退出练习 Exit Practice
            </button>
          )}

        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-20">
          {filteredAndSortedVocab.length > 0 ? filteredAndSortedVocab.map((vocab, idx) => (
            <button
              key={vocab.word + vocab.date + vocab.entryId + idx} // Unique key including index to prevent issues with duplicate words/dates
              data-vocab-id={`${vocab.word}-${vocab.date}-${vocab.entryId}`} // Data attribute for scrolling
              onClick={() => handleSelectWord(vocab)}
              className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 relative group/vocab ${
                selectedWord?.word === vocab.word && selectedWord?.date === vocab.date && selectedWord?.entryId === vocab.entryId
                  ? 'bg-indigo-50 border-indigo-200 shadow-lg scale-[1.01]'
                  : 'bg-white border-slate-200 hover:border-indigo-100'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-xl font-black serif-font ${selectedWord?.word === vocab.word ? 'text-indigo-800' : 'text-slate-900'}`}>
                  {renderRuby(vocab.word)}
                </h3>
                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${getMasteryColor(vocab.mastery)}`}>
                  {getMasteryIcon(vocab.mastery)} Mastery {vocab.mastery || 0}
                </span>
              </div>
              <p className="text-xs text-slate-500 italic line-clamp-2">{vocab.meaning}</p>
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <span>{vocab.date}</span>
                <span className="text-indigo-500">{vocab.language}</span>
              </div>
              <div className="absolute top-2 right-2 text-xl opacity-0 group-hover/vocab:opacity-100 transition-opacity">
                {selectedWord?.word === vocab.word ? '▶️' : '▶️'}
              </div>
            </button>
          )) : (
            <div className="py-16 text-center text-slate-400 text-sm italic">没有找到匹配的词汇珍宝。</div>
          )}
        </div>
      </aside>

      {/* 右侧：实践与详情 - Conditionally shown on mobile when detail is shown */}
      {selectedWord && (
        <main className={`flex-1 flex flex-col p-6 bg-slate-50 animate-in fade-in slide-in-from-right-4 duration-300 overflow-y-auto no-scrollbar pb-24 ${!showPracticeDetail ? 'hidden md:flex' : 'fixed inset-0 z-50 bg-slate-50 md:relative'}`}>
          <div className="max-w-3xl mx-auto w-full space-y-8">
            {/* Mobile Back Button */}
            {showPracticeDetail && (
              <div className="md:hidden flex items-center justify-between mb-6 pt-4 px-2">
                <button 
                  onClick={handleBackToList} 
                  className="flex items-center space-x-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                >
                  ← 返回列表
                </button>
                {isPracticeMode && (
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    练习模式 {currentPracticeIndex + 1} / {filteredAndSortedVocab.length}
                  </span>
                )}
              </div>
            )}

            <header className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className={`text-3xl ${getMasteryColor(selectedWord.mastery).replace(/bg-.*?-/, 'text-')}`}>{getMasteryIcon(selectedWord.mastery)}</span>
                  <h3 className="text-3xl font-black text-slate-900 serif-font">
                    {renderRuby(selectedWord.word)}
                  </h3>
                  <button 
                    onClick={() => handlePlayAudio(selectedWord.word, `vocab-word-${selectedWord.word}`)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${selectedWord.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                    title="收听单词发音"
                  >
                    {playingAudioId === `vocab-word-${selectedWord.word}` ? '⏹' : '🎧'}
                  </button>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedWord.language}</span>
              </div>
              <p className="text-slate-600 text-base italic leading-relaxed">{selectedWord.meaning}</p>
              <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
                <button 
                  onClick={() => handlePlayAudio(selectedWord.usage, `vocab-usage-${selectedWord.word}`)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-usage-${selectedWord.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                  title="收听例句发音"
                >
                  {playingAudioId === `vocab-usage-${selectedWord.word}` ? '⏹' : '🎧'}
                </button>
                <p className="flex-1">“ {renderRuby(selectedWord.usage)} ”</p>
              </div>
              <button 
                onClick={() => onReviewEntry(entries.find(e => e.id === selectedWord.entryId)!)}
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline mt-4 block"
              >
                查看原始日记 ➤
              </button>
            </header>

            {/* 实践区 */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
              <h4 className="text-xl font-black text-slate-900 serif-font">实践您的理解 Practice</h4>
              <p className="text-slate-500 text-sm">尝试用所选词汇造句。</p>

              <textarea
                value={practiceInput}
                onChange={(e) => setPracticeInput(e.target.value)}
                placeholder={`用 "${stripRuby(selectedWord.word)}" 造句...`}
                className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl resize-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all outline-none text-sm serif-font"
                disabled={isValidating}
              />
              <button
                onClick={handleValidatePractice}
                disabled={!practiceInput.trim() || isValidating}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all active:scale-[0.98] ${
                  isValidating
                    ? 'bg-slate-100 text-slate-300'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                }`}
              >
                {isValidating ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
                ) : (
                  <span className="text-sm">提交并验证 Submit & Validate</span>
                )}
              </button>

              {lastFeedback && (
                <div className={`p-5 rounded-2xl border ${lastFeedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in slide-in-from-bottom-2`}>
                  <p className={`font-bold text-sm mb-2 ${lastFeedback.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {lastFeedback.isCorrect ? '✅ 完美！' : '⚠️ 需打磨：'}
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed">{lastFeedback.feedback}</p>
                  {lastFeedback.betterVersion && !lastFeedback.isCorrect && (
                    <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                      <p className="text-xs text-slate-600 italic">
                        <span className="font-bold mr-1">建议版本:</span> {renderRuby(lastFeedback.betterVersion)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Practice Mode Navigation */}
            {isPracticeMode && (
              <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <button
                  onClick={handlePrevWord}
                  disabled={currentPracticeIndex === 0}
                  className="flex items-center space-x-2 text-[10px] font-black text-slate-500 uppercase hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← 上一词
                </button>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {currentPracticeIndex + 1} / {filteredAndSortedVocab.length}
                </span>
                <button
                  onClick={handleNextWord}
                  disabled={currentPracticeIndex === filteredAndSortedVocab.length - 1 && lastFeedback?.isCorrect} // Can't go next if last word and not correct
                  className="flex items-center space-x-2 text-[10px] font-black text-indigo-600 uppercase hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一词 →
                </button>
              </div>
            )}

            {/* 练习历史 */}
            {selectedWord.practices && selectedWord.practices.length > 0 && (
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
                <h4 className="text-xl font-black text-slate-900 serif-font">练习历史 Practice History</h4>
                <div className="space-y-4">
                  {selectedWord.practices.sort((a,b) => b.timestamp - a.timestamp).map((practice, idx) => (
                    <div key={idx} className={`p-4 rounded-xl border ${practice.status === 'Perfect' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'} flex items-start space-x-3`}>
                      <span className="text-lg">{practice.status === 'Perfect' ? '🟢' : '🟡'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-700 mb-1 leading-relaxed">{renderRuby(practice.originalAttempt || practice.sentence)}</p>
                        {practice.betterVersion && (
                          <p className="text-xs text-slate-500 italic leading-relaxed">
                            <span className="font-semibold">AI 建议:</span> {renderRuby(practice.betterVersion)}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-2">{new Date(practice.timestamp).toLocaleDateString('zh-CN', {year: 'numeric', month: 'short', day: 'numeric'})}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
};

export default ReviewVault;