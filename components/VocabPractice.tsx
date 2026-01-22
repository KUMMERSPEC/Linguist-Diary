
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import { renderRuby, stripRuby } from '../utils/textHelpers'; // Import renderRuby and stripRuby
// Add uuidv4 import
import { v4 as uuidv4 } from 'uuid';

interface VocabPracticeProps {
  selectedVocabId: string;
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onUpdateMastery: (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => void; // Updated first param to vocabId
  onBackToVocabList: () => void;
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  isPracticeActive: boolean;
}

const VocabPractice: React.FC<VocabPracticeProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onUpdateMastery,
  onBackToVocabList,
  onViewChange,
  isPracticeActive: initialIsPracticeActive,
}) => {
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isPracticeActive, setIsPracticeActive] = useState(initialIsPracticeActive);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocabIndex = useMemo(() => {
    return allAdvancedVocab.findIndex(v => v.id === selectedVocabId); // Use id for finding
  }, [selectedVocabId, allAdvancedVocab]);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab[currentVocabIndex];
  }, [allAdvancedVocab, currentVocabIndex]);

  useEffect(() => {
    setLastFeedback(null);
    setPracticeInput('');
    setIsPracticeActive(initialIsPracticeActive);
  }, [selectedVocabId, initialIsPracticeActive]);

  if (!currentVocab) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
        <p className="text-xl text-slate-500">词汇未找到，请返回列表。</p>
        <button onClick={onBackToVocabList} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
          返回珍宝复习
        </button>
      </div>
    );
  }

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
      const cleanText = stripRuby(text); // Use stripRuby from utils
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

  const handleValidate = async () => {
    if (!practiceInput.trim() || isValidating) return;
    setIsValidating(true);
    setLastFeedback(null);

    try {
      const result = await validateVocabUsage(currentVocab.word, currentVocab.meaning, practiceInput, currentVocab.language);
      setLastFeedback(result);

      let newMastery = currentVocab.mastery || 0;
      let practiceStatus: PracticeRecord['status'] = 'Polished';

      if (result.isCorrect) {
        newMastery = Math.min(newMastery + 1, 5); // Max mastery of 5
        practiceStatus = 'Perfect';
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 1500);
      } else {
        newMastery = Math.max(newMastery - 1, 0); // Min mastery of 0
      }

      const record: PracticeRecord = {
        id: uuidv4(), // Client-generated ID
        sentence: currentVocab.usage,
        originalAttempt: practiceInput,
        feedback: result.feedback,
        betterVersion: result.betterVersion,
        timestamp: Date.now(),
        status: practiceStatus,
        vocabId: currentVocab.id,
      };

      onUpdateMastery(currentVocab.id, currentVocab.word, newMastery, record); // Pass vocabId

    } catch (e) {
      alert("词汇验证失败，请重试。");
      console.error(e);
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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 shrink-0">
        <div>
          <button
            onClick={() => onViewChange('vocab_list')}
            className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group"
          >
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回珍宝列表 BACK TO VOCAB LIST
          </button>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">词汇精炼室 Vocab Refinement Room</h2>
        </div>
        <div className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 ${getMasteryColor(currentVocab.mastery)}`}>
            <span>{getMasteryIcon(currentVocab.mastery)} Mastery {currentVocab.mastery || 0}</span>
            <span>|</span>
            <span>{currentVocab.language}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-8 overflow-y-auto no-scrollbar pb-8">
        {/* Vocab Info Panel */}
        <div className="lg:w-1/2 shrink-0 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 relative group">
          {showSuccessAnimation && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 rounded-[2.5rem] z-10 animate-in fade-in zoom-in duration-500">
              <span className="text-7xl">✨</span>
            </div>
          )}
          
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
          <p className="text-slate-600 text-base italic leading-relaxed">{currentVocab.meaning}</p>
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
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Level: {currentVocab.level}
            </span>
            <button
              onClick={() => onViewChange('vocab_practice_detail', currentVocab.id)} // Pass vocab ID
              className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
            >
              练习足迹 →
            </button>
          </div>
        </div>

        {/* Practice Input & Feedback */}
        <div className="lg:w-1/2 flex flex-col space-y-6">
          <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 transition-all">
            <textarea
              value={practiceInput}
              onChange={(e) => setPracticeInput(e.target.value)}
              placeholder={`用 ${currentVocab.language} 造句，运用词汇 "${stripRuby(currentVocab.word)}"...`}
              className="flex-1 w-full border-none focus:ring-0 p-8 md:p-14 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-300"
              disabled={isValidating}
            />
            <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Your Practice</span>
              <span className="text-[10px] font-black text-slate-300">{practiceInput.length} chars</span>
            </div>
          </div>

          <button
            onClick={handleValidate}
            disabled={!practiceInput.trim() || isValidating}
            className={`w-full py-5 rounded-3xl font-black shadow-2xl transition-all active:scale-[0.98] ${
              !practiceInput.trim() || isValidating
                ? 'bg-slate-100 text-slate-300'
                : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {isValidating ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span className="text-sm md:text-lg">✨ 提交并评估 SUBMIT</span>
            )}
          </button>

          {lastFeedback && (
            <div className={`p-6 rounded-2xl border ${lastFeedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} shadow-md animate-in slide-in-from-bottom-4 duration-500`}>
              <div className="flex items-center space-x-2 mb-3">
                <span className={`text-xl ${lastFeedback.isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {lastFeedback.isCorrect ? '✅' : '❌'}
                </span>
                <span className={`font-black uppercase tracking-widest text-[11px] ${lastFeedback.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {lastFeedback.isCorrect ? '完美 Perfect!' : '需要打磨 Polished'}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">
                <span className="font-semibold text-slate-500 mr-1">AI 反馈:</span> {lastFeedback.feedback}
              </p>
              {lastFeedback.betterVersion && (
                <div className="bg-white p-3 rounded-xl border border-slate-100 italic text-xs text-slate-600 flex items-start space-x-2">
                  <button
                    onClick={() => handlePlayAudio(lastFeedback.betterVersion!, `feedback-better-${currentVocab.word}`)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center transition-all ${playingAudioId === `feedback-better-${currentVocab.word}` ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                    title="收听AI建议"
                  >
                    {playingAudioId === `feedback-better-${currentVocab.word}` ? '⏹' : '🎧'}
                  </button>
                  <p className="flex-1">
                    <span className="font-semibold text-slate-500 mr-1">AI 建议版本:</span>
                    “{renderRuby(lastFeedback.betterVersion)}”
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabPractice;