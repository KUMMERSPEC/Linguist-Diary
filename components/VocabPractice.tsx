
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabPracticeProps {
  selectedVocabId: string;
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onUpdateMastery: (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => void;
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
    return allAdvancedVocab.findIndex(v => `${v.word}-${v.language}` === selectedVocabId);
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
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setPlayingAudioId(null);
      source.start();
      audioSourceRef.current = source;
    } catch (e) {
      setPlayingAudioId(null);
    }
  };

  const goToNextWord = useCallback(() => {
    if (currentVocabIndex < allAdvancedVocab.length - 1) {
      const nextVocab = allAdvancedVocab[currentVocabIndex + 1];
      onViewChange('vocab_practice', `${nextVocab.word}-${nextVocab.language}`, isPracticeActive);
    } else {
      alert("恭喜您完成了所有词汇的练习！");
      onBackToVocabList();
    }
  }, [currentVocabIndex, allAdvancedVocab, onViewChange, onBackToVocabList, isPracticeActive]);

  const handleValidatePractice = async () => {
    if (!currentVocab || !practiceInput.trim() || isValidating || showSuccessAnimation) return;
    setIsValidating(true);
    setLastFeedback(null);

    try {
      const feedbackResult = await validateVocabUsage(
        stripRuby(currentVocab.word),
        currentVocab.meaning,
        practiceInput,
        currentVocab.language
      );
      setLastFeedback(feedbackResult);

      const newMastery = feedbackResult.isCorrect 
        ? Math.min((currentVocab.mastery || 0) + 1, 5) 
        : Math.max((currentVocab.mastery || 0) - 1, 0);

      const newPracticeRecord: PracticeRecord = {
        sentence: practiceInput,
        originalAttempt: practiceInput,
        feedback: feedbackResult.feedback,
        betterVersion: feedbackResult.betterVersion,
        timestamp: Date.now(),
        status: feedbackResult.isCorrect ? 'Perfect' : 'Polished',
      };

      // 关键修正：只有 Perfect 的记录才会传递 record，App.tsx 的 handleUpdateMastery 也会进行过滤
      onUpdateMastery('consolidated_vocab', currentVocab.word, newMastery, feedbackResult.isCorrect ? newPracticeRecord : undefined);

      if (feedbackResult.isCorrect) {
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          setPracticeInput('');
          setLastFeedback(null);
          setIsValidating(false);
          goToNextWord();
        }, 2000);
      } else {
        setIsValidating(false);
      }
    } catch (e) {
      setLastFeedback({ isCorrect: false, feedback: "验证失败，请稍后重试。" });
      setIsValidating(false);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <div className="flex items-center justify-between mb-6 pt-2 px-2 shrink-0">
        <button
          onClick={onBackToVocabList}
          className="flex items-center space-x-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> 返回珍宝复习
        </button>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          当前词汇 {currentVocabIndex + 1} / {allAdvancedVocab.length}
        </span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row lg:space-x-8 w-full max-w-6xl mx-auto pb-8"> 
        <div className="flex flex-col lg:flex-1 overflow-y-auto no-scrollbar lg:pr-4 mb-4 lg:mb-0">
          <header className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-5 lg:mb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">💎</span>
                <h3 className="text-3xl font-black text-slate-900 serif-font">
                  {renderRuby(currentVocab.word)}
                </h3>
                <button
                  onClick={() => handlePlayAudio(currentVocab.word, `vocab-word-${currentVocab.word}`)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-word-${currentVocab.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                >
                  {playingAudioId === `vocab-word-${currentVocab.word}` ? '⏹' : '🎧'}
                </button>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentVocab.language}</span>
            </div>
            <p className="text-slate-600 text-base italic leading-relaxed">{currentVocab.meaning}</p>
            <div className="bg-indigo-50/40 p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
              <p className="flex-1">“ {renderRuby(currentVocab.usage)} ”</p>
            </div>
          </header>
        </div>

        <div className="flex flex-col lg:flex-1 overflow-y-auto no-scrollbar lg:pl-4 mt-4 lg:mt-0 relative">
          {isPracticeActive ? (
            <div className={`bg-white p-8 rounded-[2.5rem] border transition-all duration-700 shadow-xl space-y-6 lg:mb-0 relative overflow-hidden ${showSuccessAnimation ? 'border-emerald-300 shadow-emerald-100/50 ring-4 ring-emerald-500/10 scale-[1.02]' : 'border-slate-200 shadow-xl'}`}>
              {showSuccessAnimation && (
                <div className="absolute inset-0 bg-emerald-50/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-10 animate-in fade-in duration-500">
                  <div className="flex flex-col items-center animate-in zoom-in slide-in-from-bottom-4 duration-500">
                    <span className="text-5xl mb-2">✨</span>
                    <span className="text-xl font-black text-emerald-600 serif-font tracking-widest uppercase">Perfect Mastery</span>
                  </div>
                </div>
              )}
              <h4 className="text-xl font-black text-slate-900 serif-font">实践您的理解 Practice</h4>
              <textarea
                value={practiceInput}
                onChange={(e) => setPracticeInput(e.target.value)}
                placeholder={`用 "${stripRuby(currentVocab.word)}" 造句...`}
                className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl resize-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all outline-none text-sm serif-font"
                disabled={isValidating || showSuccessAnimation}
              />
              <button
                onClick={handleValidatePractice}
                disabled={!practiceInput.trim() || isValidating || showSuccessAnimation}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all active:scale-[0.98] ${
                  isValidating || showSuccessAnimation
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
              {lastFeedback && !showSuccessAnimation && (
                <div className={`p-5 rounded-2xl border ${lastFeedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in`}>
                  <p className={`font-bold text-sm mb-2 ${lastFeedback.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{lastFeedback.isCorrect ? '✨ 完美！' : '🤔 仍需打磨'}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{lastFeedback.feedback}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 lg:mb-0">
              <h4 className="text-xl font-black text-slate-900 serif-font">词汇详情 Vocab Details</h4>
              <button
                onClick={() => setIsPracticeActive(true)}
                className="w-full py-4 rounded-2xl font-bold bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all"
              >
                开始练习 Start Practice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabPractice;
