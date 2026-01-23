
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import { renderRuby as rubyUtil, stripRuby } from '../utils/textHelpers'; 
import { v4 as uuidv4 } from 'uuid';

interface VocabPracticeProps {
  selectedVocabId: string;
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onUpdateMastery: (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => void; 
  onBackToVocabList: () => void;
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  isPracticeActive: boolean;
  queueProgress?: { current: number; total: number }; 
  onNextInQueue?: () => void; 
}

const VocabPractice: React.FC<VocabPracticeProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onUpdateMastery,
  onBackToVocabList,
  onViewChange,
  isPracticeActive: initialIsPracticeActive,
  queueProgress,
  onNextInQueue
}) => {
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isPracticeActive, setIsPracticeActive] = useState(initialIsPracticeActive);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab.find(v => v.id === selectedVocabId);
  }, [selectedVocabId, allAdvancedVocab]);

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
        newMastery = Math.min(newMastery + 1, 5); 
        practiceStatus = 'Perfect';
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 1500);
      } else {
        newMastery = Math.max(newMastery - 1, 0); 
      }

      const record: PracticeRecord = {
        id: uuidv4(), 
        sentence: currentVocab.usage,
        originalAttempt: practiceInput,
        feedback: result.feedback,
        betterVersion: result.betterVersion,
        timestamp: Date.now(),
        status: practiceStatus,
        vocabId: currentVocab.id,
      };

      onUpdateMastery(currentVocab.id, currentVocab.word, newMastery, record); 

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
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 lg:mb-8 shrink-0">
        <div className="flex flex-col">
          {queueProgress ? (
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center">
              🏛️ 珍宝打磨序列打卡 SESSION PROGRESS: <span className="text-indigo-600 ml-2">{queueProgress.current} / {queueProgress.total}</span>
            </div>
          ) : (
            <button
              onClick={onBackToVocabList}
              className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group"
            >
              <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回珍宝列表 BACK TO VOCAB LIST
            </button>
          )}
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 serif-font">
            {queueProgress ? '今日珍宝打磨' : '词汇精炼室'} <span className="text-indigo-600">Refinement</span>
          </h2>
        </div>
        <div className={`mt-3 md:mt-0 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center space-x-2 w-fit ${getMasteryColor(currentVocab.mastery)}`}>
            <span>{getMasteryIcon(currentVocab.mastery)} Mastery {currentVocab.mastery || 0}</span>
            <span>|</span>
            <span>{currentVocab.language}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-8 overflow-y-auto no-scrollbar pb-8">
        {/* Left Column: Dynamic Panel (Vocab Info vs. AI Evaluation) */}
        <div className="flex-1 lg:max-w-[50%] bg-white p-6 md:p-8 lg:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 relative group transition-all duration-500 overflow-hidden">
          {showSuccessAnimation && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 rounded-[2.5rem] z-20 animate-in fade-in zoom-in duration-500">
              <span className="text-7xl">✨</span>
            </div>
          )}
          
          {/* Header always visible */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-50">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 serif-font">
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

          {/* Conditional Content with Animation */}
          {!lastFeedback ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">词汇解析 DEFINITION</span>
                <p className="text-slate-600 text-sm md:text-base italic leading-relaxed" dangerouslySetInnerHTML={{ __html: rubyUtil(currentVocab.meaning) }} />
              </div>
              
              <div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">参考范例 EXAMPLE</span>
                <div className="bg-indigo-50/40 p-4 md:p-5 rounded-2xl italic text-xs text-indigo-800 border-l-4 border-indigo-400 flex items-start space-x-2">
                  <button
                    onClick={() => handlePlayAudio(currentVocab.usage, `vocab-usage-${currentVocab.word}`)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${playingAudioId === `vocab-usage-${currentVocab.word}` ? 'bg-indigo-600 text-white shadow-md' : 'bg-indigo-100 text-indigo-500 hover:bg-indigo-600 hover:text-white'}`}
                    title="收听例句发音"
                  >
                    {playingAudioId === `vocab-usage-${currentVocab.word}` ? '⏹' : '🎧'}
                  </button>
                  <p className="flex-1 text-sm md:text-base leading-relaxed">“ {renderRuby(currentVocab.usage)} ”</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Level: {currentVocab.level}
                </span>
                <button
                  onClick={() => onViewChange('vocab_practice_detail', currentVocab.id)} 
                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                >
                  练习足迹 →
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Feedback Badge & Header */}
              <div className={`p-4 rounded-2xl flex items-center justify-between ${lastFeedback.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{lastFeedback.isCorrect ? '✅' : '📝'}</span>
                  <span className="font-black uppercase tracking-widest text-xs">
                    {lastFeedback.isCorrect ? '鉴定通过 PERFECT' : '需要打磨 POLISHED'}
                  </span>
                </div>
                <button 
                  onClick={() => setLastFeedback(null)} 
                  className="text-[10px] font-black underline opacity-50 hover:opacity-100 transition-opacity"
                >
                  查看原文定义
                </button>
              </div>

              {/* Feedback Text */}
              <div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">馆长鉴定结果 FEEDBACK</span>
                <p className="text-sm md:text-base text-slate-700 leading-relaxed italic">
                  “ {lastFeedback.feedback} ”
                </p>
              </div>

              {/* Better Version Card */}
              {lastFeedback.betterVersion && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">AI 修复建议 SUGGESTION</span>
                  <div className="bg-slate-900 text-white p-5 md:p-7 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group/feedback">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-[3rem] -mr-8 -mt-8"></div>
                    <p className="relative z-10 text-base md:text-xl serif-font leading-relaxed italic">
                       {renderRuby(lastFeedback.betterVersion)}
                    </p>
                    <button
                      onClick={() => handlePlayAudio(lastFeedback.betterVersion!, `feedback-better-${currentVocab.word}`)}
                      className={`absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${playingAudioId === `feedback-better-${currentVocab.word}` ? 'bg-indigo-500 text-white' : 'bg-white/10 text-indigo-400 hover:bg-indigo-600 hover:text-white'}`}
                    >
                      {playingAudioId === `feedback-better-${currentVocab.word}` ? '⏹' : '🎧'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Practice Input Area */}
        <div className="flex-1 lg:max-w-[50%] flex flex-col space-y-6">
          <div className={`flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 transition-all ${lastFeedback ? 'opacity-50 pointer-events-none grayscale-[0.5]' : ''}`}>
            <textarea
              value={practiceInput}
              onChange={(e) => setPracticeInput(e.target.value)}
              placeholder={`用 ${currentVocab.language} 造句，运用词汇 "${stripRuby(currentVocab.word)}"...`}
              className="flex-1 w-full border-none focus:ring-0 p-8 md:p-10 lg:p-12 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-300"
              disabled={isValidating || !!lastFeedback}
            />
            <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Your Work In Progress</span>
              <span className="text-[10px] font-black text-slate-300">{practiceInput.length} chars</span>
            </div>
          </div>

          <div className="flex gap-4 shrink-0">
            {!lastFeedback ? (
              <button
                onClick={handleValidate}
                disabled={!practiceInput.trim() || isValidating}
                className={`flex-1 py-5 rounded-3xl font-black shadow-2xl transition-all active:scale-[0.98] ${
                  !practiceInput.trim() || isValidating
                    ? 'bg-slate-100 text-slate-300'
                    : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                }`}
              >
                {isValidating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  <span className="text-sm md:text-lg">✨ 提交评估 SUBMIT</span>
                )}
              </button>
            ) : (
              <div className="flex-1 flex gap-4">
                 <button
                    onClick={() => { setLastFeedback(null); setPracticeInput(''); }}
                    className="flex-1 py-5 bg-white border border-slate-200 text-slate-400 rounded-3xl font-black hover:bg-slate-50 transition-all active:scale-95 text-xs uppercase tracking-widest"
                  >
                    再次尝试 RETRY
                  </button>
                  {onNextInQueue && (
                    <button
                      onClick={onNextInQueue}
                      className="flex-[2] py-5 bg-slate-900 text-white rounded-3xl font-black shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all active:scale-95 text-sm md:text-lg uppercase tracking-widest"
                    >
                      下一个珍宝 NEXT →
                    </button>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VocabPractice;
