
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabPracticeProps {
  selectedVocabId: string; // ID of the vocab to practice (e.g., 'word-language')
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

  // Find the currently selected vocab
  const currentVocabIndex = useMemo(() => {
    return allAdvancedVocab.findIndex(v => `${v.word}-${v.language}` === selectedVocabId);
  }, [selectedVocabId, allAdvancedVocab]);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab[currentVocabIndex];
  }, [allAdvancedVocab, currentVocabIndex]);

  // Reset practice input and feedback when selected word changes
  useEffect(() => {
    setLastFeedback(null);
    setPracticeInput('');
    setIsPracticeActive(initialIsPracticeActive); // Reset active mode when vocab changes
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

  // Navigation handlers
  const goToPrevWord = useCallback(() => {
    if (currentVocabIndex > 0) {
      const prevVocab = allAdvancedVocab[currentVocabIndex - 1];
      const prevVocabId = `${prevVocab.word}-${prevVocab.language}`;
      onViewChange('vocab_practice', prevVocabId, isPracticeActive); // Keep current practice mode
    }
  }, [currentVocabIndex, allAdvancedVocab, onViewChange, isPracticeActive]);

  const goToNextWord = useCallback(() => {
    if (currentVocabIndex < allAdvancedVocab.length - 1) {
      const nextVocab = allAdvancedVocab[currentVocabIndex + 1];
      const nextVocabId = `${nextVocab.word}-${nextVocab.language}`;
      onViewChange('vocab_practice', nextVocabId, isPracticeActive); // Keep current practice mode
    } else {
      // If no more words, go back to vocab list
      alert("恭喜您完成了所有词汇的练习！");
      onBackToVocabList();
    }
  }, [currentVocabIndex, allAdvancedVocab, onViewChange, onBackToVocabList, isPracticeActive]);

  const handleValidatePractice = async () => {
    if (!currentVocab || !practiceInput.trim() || isValidating || showSuccessAnimation) return;
    setIsValidating(true);
    setLastFeedback(null);

    let feedbackResult: { isCorrect: boolean; feedback: string; betterVersion?: string } | null = null;

    try {
      feedbackResult = await validateVocabUsage(
        stripRuby(currentVocab.word),
        currentVocab.meaning,
        practiceInput,
        currentVocab.language
      );
      setLastFeedback(feedbackResult);

      const newMastery = feedbackResult.isCorrect ? Math.min((currentVocab.mastery || 0) + 1, 5) : Math.max((currentVocab.mastery || 0) - 1, 0);
      const newPracticeRecord: PracticeRecord = {
        sentence: practiceInput,
        originalAttempt: practiceInput,
        feedback: feedbackResult.feedback,
        betterVersion: feedbackResult.betterVersion,
        timestamp: Date.now(),
        status: feedbackResult.isCorrect ? 'Perfect' : 'Polished',
      };
      onUpdateMastery('consolidated_vocab', currentVocab.word, newMastery, newPracticeRecord);

      if (feedbackResult.isCorrect) {
        setShowSuccessAnimation(true);
        setTimeout(() => {
          setShowSuccessAnimation(false);
          setPracticeInput(''); // Clear input for next word
          setLastFeedback(null); // Clear feedback for next word
          setIsValidating(false); // Reset isValidating after successful animation flow
          goToNextWord();
        }, 1500); // Show animation for 1.5 seconds
      }

    } catch (e) {
      console.error("Validation failed:", e);
      setLastFeedback({ isCorrect: false, feedback: "验证失败，请稍后重试。" });
      setIsValidating(false);
    } finally {
      if (!feedbackResult?.isCorrect) {
        setIsValidating(false);
      }
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
      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-50 animate-in fade-in zoom-in duration-300">
          <div className="flex flex-col items-center space-y-4 p-12 bg-white rounded-full shadow-2xl border-4 border-emerald-300 text-emerald-700 animate-out fade-out zoom-out duration-500 delay-1000">
            <span className="text-7xl">👍</span>
            <p className="text-3xl font-black serif-font">完美！</p>
          </div>
        </div>
      )}

      {/* Mobile Back Button */}
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

      {/* Main content area: Flexible for two columns on large screens */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row lg:space-x-8 w-full max-w-6xl mx-auto pb-8"> 

        {/* Left Column: Word details */}
        <div className="flex flex-col lg:flex-1 overflow-y-auto no-scrollbar lg:pr-4 mb-4 lg:mb-0"> {/* lg:pr-4 for spacing, mb-4 for mobile spacing */}
          {/* Removed: <div className="lg:flex-grow hidden lg:block"></div> */}
          <header className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-5 lg:mb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className={`text-3xl ${getMasteryColor(currentVocab.mastery).replace(/bg-.*?-/, 'text-')}`}>{getMasteryIcon(currentVocab.mastery)}</span>
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentVocab.language}</span>
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
          </header>
        </div>

        {/* Right Column: Practice Input/Controls */}
        <div className="flex flex-col lg:flex-1 overflow-y-auto no-scrollbar lg:pl-4 mt-4 lg:mt-0">
          {/* Removed: <div className="lg:flex-grow hidden lg:block"></div> */}
          {isPracticeActive ? (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 lg:mb-0">
              <h4 className="text-xl font-black text-slate-900 serif-font">实践您的理解 Practice</h4>
              <p className="text-slate-500 text-sm">尝试用所选词汇造句。</p>

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
                {isValidating || showSuccessAnimation ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
                ) : (
                  <span className="text-sm">提交并验证 Submit & Validate</span>
                )}
              </button>

              {!showSuccessAnimation && lastFeedback && (
                <div className={`p-5 rounded-2xl border ${lastFeedback.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in slide-in-from-bottom-2`}>
                  <p className={`font-bold text-sm mb-2 ${lastFeedback.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{lastFeedback.isCorrect ? '👍 完美！' : '🤔 仍需打磨'}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{lastFeedback.feedback}</p>
                  {lastFeedback.betterVersion && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 italic leading-relaxed">
                        <span className="font-semibold">AI 建议:</span> {renderRuby(lastFeedback.betterVersion)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 lg:mb-0">
              <h4 className="text-xl font-black text-slate-900 serif-font">词汇详情 Vocab Details</h4>
              <p className="text-slate-500 text-sm">此模式下仅可查看词汇详情。</p>
              <button
                onClick={() => setIsPracticeActive(true)}
                className="w-full py-4 rounded-2xl font-bold flex items-center justify-center space-x-3 bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]"
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
    