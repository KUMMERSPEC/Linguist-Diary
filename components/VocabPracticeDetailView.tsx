
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord } from '../types';
import { generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
// Fix: Import renderRuby from textHelpers as rubyUtil for dangerouslySetInnerHTML usage
import { renderRuby as rubyUtil } from '../utils/textHelpers';

interface VocabPracticeDetailViewProps {
  selectedVocabId: string; // ID of the vocab to show details for (e.g., 'word-language')
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onBackToPracticeHistory: () => void;
  onDeletePractice?: (vocabId: string, practiceId: string) => void;
}

const VocabPracticeDetailView: React.FC<VocabPracticeDetailViewProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onBackToPracticeHistory,
  onDeletePractice,
}) => {
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab.find(v => `${v.word}-${v.language}` === selectedVocabId);
  }, [selectedVocabId, allAdvancedVocab]);

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

  const handleDelete = (practiceId: string) => {
    if (window.confirm("确定要移除这条打磨记录吗？此操作无法撤销。")) {
      onDeletePractice?.(currentVocab.id, practiceId);
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
    // Ensure practices are always sorted by timestamp, newest first
    return currentVocab.practices ? [...currentVocab.practices].sort((a, b) => b.timestamp - a.timestamp) : [];
  }, [currentVocab.practices]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0">
        <div>
          <button
            onClick={onBackToPracticeHistory}
            className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group"
          >
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回练习足迹 BACK TO PRACTICE HISTORY
          </button>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">词汇练习详情 Vocab Practice Details</h2>
        </div>
        <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${getMasteryColor(currentVocab.mastery)}`}>
            <span>{getMasteryIcon(currentVocab.mastery)} Mastery {currentVocab.mastery || 0}</span>
            <span>|</span>
            <span>{currentVocab.language}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-4">
        {/* Vocab Core Info */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-black text-slate-900 serif-font">
              {renderRuby(currentVocab.word)}
            </h3>
            <button
              onClick={() => handlePlayAudio(currentVocab.word, `vocab-word-${currentVocab.word}`)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${currentVocab.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
              title="收听单词发音"
            >
              {playingAudioId === `vocab-word-${currentVocab.word}` ? '⏹' : '🎧'}
            </button>
          </div>
          <p className="text-slate-600 text-base italic leading-relaxed" dangerouslySetInnerHTML={{ __html: rubyUtil(currentVocab.meaning) }} />
          <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
            <button
              onClick={() => handlePlayAudio(currentVocab.usage, `vocab-usage-${currentVocab.word}`)}
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-usage-${currentVocab.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
              title="收听例句发音"
            >
              {playingAudioId === `vocab-usage-${currentVocab.word}` ? '⏹' : '🎧'}
            </button>
            <p className="flex-1">“ {renderRuby(currentVocab.usage)} ”</p>
          </div>
        </div>

        {/* Practice Records List */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 serif-font">所有练习记录 All Practice Records ({sortedPractices.length})</h3>
          {sortedPractices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedPractices.map((practice, pIdx) => (
                <div key={practice.id || pIdx} className={`p-6 rounded-2xl border transition-all duration-300 relative group/pitem ${
                  practice.status === 'Perfect' ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-50/10' : 'bg-rose-50 border-rose-200 shadow-sm shadow-rose-50/10'
                }`}>
                  {/* Delete Button */}
                  <button 
                    onClick={() => handleDelete(practice.id)}
                    className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/pitem:opacity-100 p-1"
                    title="移除记录"
                  >
                    ✕
                  </button>

                  <div className="flex items-center justify-between mb-3 pr-6">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                      practice.status === 'Perfect' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {practice.status === 'Perfect' ? '✨ 完美' : '📝 打磨'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(practice.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed mb-4">
                    <span className="font-semibold text-slate-500 mr-1">你的尝试:</span>
                    “{renderRuby(practice.originalAttempt || practice.sentence)}”
                    <button
                      onClick={() => handlePlayAudio(practice.originalAttempt || practice.sentence, `user-attempt-${pIdx}`)}
                      className={`ml-2 w-6 h-6 rounded-full inline-flex items-center justify-center transition-all ${playingAudioId === `user-attempt-${pIdx}` ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                      title="收听你的尝试"
                    >
                      {playingAudioId === `user-attempt-${pIdx}` ? '⏹' : '🎧'}
                    </button>
                  </p>
                  
                  {practice.feedback && (
                    <div className="mt-2 text-xs text-slate-600 italic leading-relaxed">
                      <span className="font-semibold text-slate-500 mr-1">AI 反馈:</span> {practice.feedback}
                    </div>
                  )}

                  {practice.betterVersion && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 italic leading-relaxed">
                        <span className="font-semibold text-slate-500 mr-1">AI 建议版本:</span>
                        “{renderRuby(practice.betterVersion)}”
                        <button
                          onClick={() => handlePlayAudio(practice.betterVersion!, `ai-better-${pIdx}`)}
                          className={`ml-2 w-6 h-6 rounded-full inline-flex items-center justify-center transition-all ${playingAudioId === `ai-better-${pIdx}` ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                          title="收听AI建议"
                        >
                          {playingAudioId === `ai-better-${pIdx}` ? '⏹' : '🎧'}
                        </button>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center bg-white/50 border-2 border-dashed border-slate-200 rounded-3xl">
              <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">此词汇暂无练习记录。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabPracticeDetailView;
