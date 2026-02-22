
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import { renderRuby as rubyUtil } from '../utils/textHelpers';

interface VocabPracticeDetailViewProps {
  selectedVocabId: string; 
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onBackToPracticeHistory: () => void;
  onDeletePractice?: (vocabId: string, practiceId: string) => void;
  onBatchDeletePractices?: (vocabId: string, practiceIds: string[]) => void;
}

const VocabPracticeDetailView: React.FC<VocabPracticeDetailViewProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onBackToPracticeHistory,
  onDeletePractice,
  onBatchDeletePractices
}) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localPractices, setLocalPractices] = useState<PracticeRecord[]>([]);
  const [isLoadingPractices, setIsLoadingPractices] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab.find(v => `${v.word}-${v.language}` === selectedVocabId || v.id === selectedVocabId);
  }, [selectedVocabId, allAdvancedVocab]);

  useEffect(() => {
    const fetchPractices = async () => {
      if (!currentVocab || !db) return;
      
      if (currentVocab.practices && currentVocab.practices.length > 0) {
        setLocalPractices(currentVocab.practices);
        return;
      }

      setIsLoadingPractices(true);
      try {
        const userId = localStorage.getItem('last_user_id'); 
        if (!userId) return;

        const practicesColRef = collection(db, 'users', userId, 'advancedVocab', currentVocab.id, 'practices');
        const practicesSnapshot = await getDocs(query(practicesColRef, orderBy('timestamp', 'desc')));
        const practices = practicesSnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id })) as PracticeRecord[];
        setLocalPractices(practices);
      } catch (e) {
        console.error("Failed to fetch practices:", e);
      } finally {
        setIsLoadingPractices(false);
      }
    };

    fetchPractices();
  }, [currentVocab]);

  if (!currentVocab) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-in fade-in zoom-in duration-700">
        <p className="text-xl text-slate-500">词汇详情未找到，请返回。</p>
        <button onClick={onBackToPracticeHistory} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
          返回练习足迹
        </button>
      </div>
    );
  }

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

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSingle = (practiceId: string) => {
    if (window.confirm("确定要移除这条打磨记录吗？")) {
      onDeletePractice?.(currentVocab.id, practiceId);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`确定要批量移除选中的 ${selectedIds.size} 条打磨记录吗？`)) {
      onBatchDeletePractices?.(currentVocab.id, Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsManageMode(false);
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

  const sortedPractices = useMemo(() => {
    if (localPractices.length > 0) return [...localPractices].sort((a, b) => b.timestamp - a.timestamp);
    return currentVocab?.practices ? [...currentVocab.practices].sort((a, b) => b.timestamp - a.timestamp) : [];
  }, [localPractices, currentVocab?.practices]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0">
        <div>
          <button
            onClick={onBackToPracticeHistory}
            className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group"
          >
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回列表
          </button>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font tracking-tight">打磨记录 Details</h2>
        </div>
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
           {sortedPractices.length > 0 && (
              <button 
                onClick={() => { setIsManageMode(!isManageMode); setSelectedIds(new Set()); }}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isManageMode ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-100 text-slate-500 hover:text-indigo-500 shadow-sm'}`}
              >
                {isManageMode ? '退出管理' : '批量管理'}
              </button>
            )}
           <div className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center space-x-2 border shadow-sm ${getMasteryColor(currentVocab.mastery)}`}>
               <span>{getMasteryIcon(currentVocab.mastery)} Mastery {currentVocab.mastery || 0}</span>
               <span>|</span>
               <span>{currentVocab.language}</span>
           </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-10 pb-32">
        {/* Vocab Header Card */}
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full opacity-30 -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="flex items-center justify-between mb-4 relative z-10">
            <h3 className="text-3xl font-black text-slate-900 serif-font">
              {renderRuby(currentVocab.word)}
            </h3>
            <button
              onClick={() => handlePlayAudio(currentVocab.word, `vocab-word-${currentVocab.word}`)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${currentVocab.word}` ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}
            >
              {playingAudioId === `vocab-word-${currentVocab.word}` ? '⏹' : '🎧'}
            </button>
          </div>
          <p className="text-slate-500 text-base italic leading-relaxed serif-font relative z-10" dangerouslySetInnerHTML={{ __html: rubyUtil(currentVocab.meaning) }} />
          
          <div className="mt-6 pt-6 border-t border-slate-50 text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <span>💡 提示：</span>
            <span>独立精准造句 (Perfect) 提升掌握度，否则视为仍需磨练。</span>
          </div>
        </div>

        {/* Practice Timeline */}
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="flex items-center space-x-4 px-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Timeline</h3>
            <div className="flex-1 h-[1px] bg-slate-100"></div>
          </div>

          {isLoadingPractices ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">正在调取打磨足迹...</p>
            </div>
          ) : sortedPractices.length > 0 ? (
            <div className="space-y-6 relative">
              <div className="absolute left-5 top-2 bottom-2 w-[1px] bg-slate-100 hidden md:block"></div>

              {sortedPractices.map((practice, pIdx) => {
                const isSelected = selectedIds.has(practice.id);

                return (
                  <div 
                    key={practice.id || pIdx} 
                    onClick={() => isManageMode && toggleSelect(practice.id)}
                    className="relative group/pitem animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${pIdx * 30}ms` }}
                  >
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 z-10 transition-transform group-hover/pitem:scale-110">
                          <span className="text-[9px] font-black text-slate-400">{new Date(practice.timestamp).getDate()}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">
                          {new Date(practice.timestamp).toLocaleDateString('zh-CN', { month: 'short' })}
                        </span>
                      </div>
                      {isManageMode && (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-md' : 'bg-white border-slate-200'}`}>
                          {isSelected && <span className="text-white text-[8px]">✓</span>}
                        </div>
                      )}
                    </div>

                    <div className={`ml-4 md:ml-14 p-5 md:py-6 md:px-8 rounded-[2rem] border transition-all duration-300 relative flex flex-col ${
                      isManageMode ? (isSelected ? 'bg-indigo-50 border-indigo-200 shadow-lg' : 'bg-white border-slate-100 shadow-sm') : 
                      'bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/30 hover:-translate-y-0.5'
                    }`}>
                      {!isManageMode && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteSingle(practice.id); }}
                          className="absolute top-5 right-6 text-slate-100 hover:text-rose-400 transition-colors p-1 opacity-0 group-hover/pitem:opacity-100"
                        >
                          ✕
                        </button>
                      )}

                      <p className="text-slate-400 italic text-sm mb-3 leading-relaxed serif-font opacity-60">
                        “ {renderRuby(practice.originalAttempt || practice.sentence)} ”
                      </p>
                      
                      {practice.betterVersion && (
                        <div className="pt-3 border-t border-slate-50 flex items-center justify-between space-x-4">
                          <p className="text-base md:text-lg text-slate-800 leading-snug serif-font font-medium flex-1">
                            “ {renderRuby(practice.betterVersion)} ”
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePlayAudio(practice.betterVersion!, `refined-${pIdx}`); }}
                            className={`flex-shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center transition-all ${playingAudioId === `refined-${pIdx}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-300 hover:text-indigo-600'}`}
                          >
                            {playingAudioId === `refined-${pIdx}` ? '⏹' : '🎧'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center bg-white border border-dashed border-slate-100 rounded-[2.5rem]">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">暂无打磨足迹。</p>
            </div>
          )}
        </div>
      </div>

      {isManageMode && selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl flex items-center space-x-8 z-50 animate-in slide-in-from-bottom-10">
           <div className="flex flex-col">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">SELECTED</span>
             <span className="text-lg font-bold">{selectedIds.size} 项记录</span>
           </div>
           <button onClick={handleBatchDelete} className="bg-rose-500 text-white px-8 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95">确认删除</button>
        </div>
      )}
    </div>
  );
};

export default VocabPracticeDetailView;
