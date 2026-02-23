
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsageStream, generateDiaryAudio } from '../services/geminiService';
import { playSmartSpeech } from '../services/audioService';
import { renderRuby as rubyUtil, stripRuby } from '../utils/textHelpers'; 
import { v4 as uuidv4 } from 'uuid';

const LOADING_MESSAGES = [
  "正在为你打磨最地道的表达...",
  "正在查阅馆藏辞海...",
  "正在对比母语者的表达习惯...",
  "正在雕琢句子的每一个细节...",
  "正在为你寻找更优雅的措辞...",
  "馆长正在审阅你的珍宝造句...",
  "正在注入地道的语言灵魂..."
];

interface VocabPracticeProps {
  selectedVocabId: string;
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onUpdateMastery: (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => void; 
  onBackToVocabList: () => void;
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  onSaveFragment: (content: string, language: string, type: 'transient' | 'seed', meaning?: string, usage?: string) => Promise<void>;
  isPracticeActive: boolean;
  queueProgress?: { current: number; total: number }; 
  onNextInQueue?: () => void; 
  nextVocabId?: string;
}

const VocabPractice: React.FC<VocabPracticeProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onUpdateMastery,
  onBackToVocabList,
  onViewChange,
  onSaveFragment,
  isPracticeActive: initialIsPracticeActive,
  queueProgress,
  onNextInQueue,
  nextVocabId
}) => {
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<{ 
    isCorrect: boolean; 
    feedback: string; 
    betterVersion?: string;
    keyPhrases?: { phrase: string, explanation: string }[];
  } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [savedPhrases, setSavedPhrases] = useState<Set<string>>(new Set());
  const [loadingMessage, setLoadingMessage] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [partialFeedback, setPartialFeedback] = useState('');
  const [partialBetterVersion, setPartialBetterVersion] = useState('');

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab.find(v => v.id === selectedVocabId || `${v.word}-${v.language}` === selectedVocabId);
  }, [selectedVocabId, allAdvancedVocab]);

  const parentVocab = useMemo(() => {
    if (!currentVocab?.parentId) return null;
    return allAdvancedVocab.find(v => v.id === currentVocab.parentId);
  }, [currentVocab, allAdvancedVocab]);

  useEffect(() => {
    setLastFeedback(null);
    setPracticeInput('');
    setShowSuccessAnimation(false);
    setSavedPhrases(new Set());
    
    // Pre-fetching logic for next item in queue
    if (nextVocabId) {
      const nextVocab = allAdvancedVocab.find(v => v.id === nextVocabId);
      if (nextVocab) {
        console.log(`[Pre-fetch] Preparing next gem: ${nextVocab.word}`);
        // Background Fetching: Pre-warm the audio for the next word
        // This simulates the "API handshake" and reduces perceived latency for the next item
        if (nextVocab.word.length >= 10) {
          generateDiaryAudio(stripRuby(nextVocab.word)).catch(() => {});
        }
      }
    }

    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
    };
  }, [selectedVocabId]);

  if (!currentVocab) return (
    <div className="p-8 text-center text-slate-400 italic">词汇加载中...</div>
  );

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const handlePlayAudio = async (text: string, id: string) => {
    if (!text || isAudioLoading) return;

    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (playingAudioId === id) { 
        setPlayingAudioId(null); 
        return; 
      }
    }

    const cleanText = stripRuby(text); 
    const source = await playSmartSpeech(
      cleanText, 
      currentVocab.language, 
      id,
      () => {
        setPlayingAudioId(id);
        setIsAudioLoading(true);
      },
      () => {
        setPlayingAudioId(null);
        setIsAudioLoading(false);
      }
    );
    
    if (source) {
      audioSourceRef.current = source as AudioBufferSourceNode;
    }
  };

  const handleValidate = async () => {
    if (!practiceInput.trim() || isValidating) return;
    
    const inputToValidate = practiceInput;
    const vocabToValidate = currentVocab;
    
    // 1. Locally mark as "done" or "submitting" and move to next if in queue
    // We don't have a "done" status in AdvancedVocab, but we can trigger the next item
    if (onNextInQueue && queueProgress && queueProgress.current < queueProgress.total) {
      // Move to next item immediately
      onNextInQueue();
    } else {
      // If last item, maybe just show a "Submitting..." state or go back
      setIsValidating(true);
      setLoadingMessage("正在后台评估你的最后一件珍宝...");
    }

    // 2. Run validation in background
    (async () => {
      let accumulatedText = '';
      try {
        const stream = validateVocabUsageStream(
          vocabToValidate.word, 
          vocabToValidate.meaning, 
          inputToValidate, 
          vocabToValidate.language
        );

        for await (const chunk of stream) {
          accumulatedText += chunk;
        }

        const result = JSON.parse(accumulatedText);
        
        let newMastery = vocabToValidate.mastery || 0;
        let status: PracticeRecord['status'] = 'Polished';
        if (result.isCorrect) {
          newMastery = Math.min(newMastery + 1, 5);
          status = 'Perfect';
        } else {
          newMastery = Math.max(newMastery - 1, 0);
        }

        const record: PracticeRecord = {
          id: uuidv4(),
          sentence: vocabToValidate.usage,
          originalAttempt: inputToValidate,
          feedback: result.feedback || "AI 已评估该句子。",
          betterVersion: result.betterVersion,
          timestamp: Date.now(),
          status,
          vocabId: vocabToValidate.id
        };
        
        onUpdateMastery(vocabToValidate.id, vocabToValidate.word, newMastery, record);
        
        // If we were showing the "last item" loading state
        if (!onNextInQueue || (queueProgress && queueProgress.current === queueProgress.total)) {
          setLastFeedback(result);
          setIsValidating(false);
        }
      } catch (e) { 
        console.error("Background validation error:", e);
        if (!onNextInQueue || (queueProgress && queueProgress.current === queueProgress.total)) {
          setIsValidating(false);
          alert("评估失败，请检查网络。");
        }
      }
    })();
  };

  const handleSavePhrase = async (phrase: string, explanation: string) => {
    if (savedPhrases.has(phrase)) return;
    try {
      await onSaveFragment(
        phrase, 
        currentVocab.language, 
        'seed',
        `打磨笔记：${explanation}`, 
        `源自打磨语境：${lastFeedback?.betterVersion || practiceInput}`
      );
      setSavedPhrases(prev => new Set(prev).add(phrase));
    } catch (e) {
      alert("保存碎片失败。");
    }
  };

  const handleNext = () => {
    if (onNextInQueue) {
      onNextInQueue();
    } else {
      onBackToVocabList();
    }
  };

  const handleRetry = () => {
    setLastFeedback(null);
    setPracticeInput('');
    setSavedPhrases(new Set());
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative p-4 md:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 shrink-0">
        <div className="flex flex-col">
          <button onClick={onBackToVocabList} className="text-slate-400 hover:text-indigo-600 text-[10px] font-black uppercase tracking-widest mb-1 flex items-center group">
            <span className="mr-1 group-hover:-translate-x-1 transition-transform">←</span> 返回列表
          </button>
          <div className="flex items-center space-x-3">
            <h2 className="text-xl md:text-3xl font-bold text-slate-900 serif-font">
              珍宝打磨 <span className="text-indigo-600">Refinement</span>
            </h2>
            {queueProgress && (
              <span className="bg-indigo-600 text-white px-2.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-black tracking-tighter shadow-lg shadow-indigo-100">
                {queueProgress.current} / {queueProgress.total}
              </span>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-2xl text-[10px] font-black text-indigo-600 uppercase">
          <span>{currentVocab.language}</span>
          <span>•</span>
          <span>Mastery {currentVocab.mastery || 0}</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:items-start gap-6 md:gap-8 overflow-y-auto no-scrollbar pb-8">
        <div className="shrink-0 lg:flex-1 lg:max-w-[40%] bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/40 space-y-6 md:space-y-8 relative transition-all duration-700">
          {showSuccessAnimation && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/80 rounded-[2rem] md:rounded-[2.5rem] z-20 animate-in fade-in zoom-in duration-500">
              <span className="text-6xl md:text-7xl">✨</span>
            </div>
          )}

          <div className="flex items-center justify-between pb-4 border-b border-slate-50 relative">
            <div className="flex flex-col">
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 serif-font">
                {renderRuby(currentVocab.word)}
              </h3>
              {parentVocab && (
                <div className="mt-1 flex items-center space-x-1.5 opacity-40 hover:opacity-100 transition-opacity cursor-help group/parent" title={`父词汇: ${stripRuby(parentVocab.word)}\n释义: ${stripRuby(parentVocab.meaning)}`}>
                  <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 rounded">PARENT</span>
                  <span className="text-[10px] font-bold text-slate-500 serif-font">{stripRuby(parentVocab.word)}</span>
                  <div className="hidden group-hover/parent:block absolute top-full left-0 mt-2 p-3 bg-slate-900 text-white text-[10px] rounded-xl shadow-xl z-30 w-48 animate-in fade-in slide-in-from-top-1">
                    <p className="font-bold mb-1 text-indigo-300 uppercase tracking-widest text-[8px]">原始定义 ORIGINAL DEFINITION</p>
                    <p className="leading-relaxed opacity-90">{stripRuby(parentVocab.meaning)}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="md:hidden px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-lg text-[8px] font-black uppercase tracking-widest">M{currentVocab.mastery || 0}</span>
              <button 
                onClick={() => handlePlayAudio(currentVocab.word, 'word')} 
                disabled={isAudioLoading && playingAudioId === 'word'}
                className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${playingAudioId === 'word' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
              >
                {isAudioLoading && playingAudioId === 'word' ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : playingAudioId === 'word' ? '⏹' : '🎧'}
              </button>
            </div>
          </div>

          <div className="space-y-5 md:space-y-6">
            <div>
              <span className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">词汇解析 DEFINITION</span>
              <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
                {stripRuby(currentVocab.meaning)}
              </p>
            </div>
            <div>
              <span className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest block mb-2">参考范例 EXAMPLE</span>
              <div className="bg-indigo-50/40 p-4 md:p-6 rounded-2xl italic text-sm md:text-base text-indigo-800 border-l-4 border-indigo-400">
                <p className="leading-relaxed">“ {renderRuby(currentVocab.usage)} ”</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-4 md:space-y-6 min-h-[300px] md:min-h-0">
          <div className={`flex-1 bg-white border border-slate-200 rounded-[2rem] md:rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col focus-within:ring-8 focus-within:ring-indigo-500/5 transition-all ${lastFeedback ? 'opacity-50 pointer-events-none' : ''}`}>
             <textarea
               value={practiceInput}
               onChange={(e) => setPracticeInput(e.target.value)}
               placeholder={`用这个单词造一个句子来打磨它的用法...`}
               className="flex-1 w-full border-none focus:ring-0 p-6 md:p-14 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-200 min-h-[180px] md:min-h-0"
               disabled={isValidating}
             />
          </div>

          {!lastFeedback && !isValidating ? (
            <button
              onClick={handleValidate}
              disabled={!practiceInput.trim() || isValidating}
              className="py-5 md:py-6 rounded-[1.8rem] md:rounded-3xl bg-indigo-600 text-white font-black shadow-2xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center disabled:opacity-50 text-sm md:text-base"
            >
              ✨ 提交打磨评估 SUBMIT
            </button>
          ) : isValidating ? (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 animate-in fade-in duration-500">
               <div className={`flex items-center space-x-3 mb-2 transition-all duration-500 ${partialFeedback ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}>
                 <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></div>
                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">{loadingMessage}</span>
               </div>
               
               <div className="space-y-4">
                 {partialFeedback ? (
                   <p className="text-slate-600 text-xs md:text-sm italic leading-relaxed px-1 animate-in fade-in duration-300">
                     “ {partialFeedback} ”
                   </p>
                 ) : (
                   <div className="space-y-3 px-1">
                     <div className="h-3 bg-slate-100 rounded-full w-full animate-pulse"></div>
                     <div className="h-3 bg-slate-100 rounded-full w-5/6 animate-pulse"></div>
                     <div className="h-3 bg-slate-100 rounded-full w-4/6 animate-pulse"></div>
                   </div>
                 )}
                 
                 <div className="p-4 md:p-5 bg-slate-900 text-white rounded-[1.5rem] md:rounded-3xl relative min-h-[80px]">
                    <span className="text-[8px] font-black uppercase text-indigo-400 block mb-2">AI 优化建议</span>
                    {partialBetterVersion ? (
                      <p className="serif-font italic text-base md:text-lg leading-relaxed animate-in fade-in duration-300">
                        {renderRuby(partialBetterVersion)}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="h-5 bg-white/10 rounded-full w-full animate-pulse"></div>
                        <div className="h-5 bg-white/10 rounded-full w-2/3 animate-pulse"></div>
                      </div>
                    )}
                 </div>
               </div>
            </div>
          ) : (
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-xl space-y-5 animate-in slide-in-from-bottom-4">
               <div className="flex items-center justify-between mb-1">
                 <div className="flex items-center space-x-3">
                   <span className="text-xl md:text-2xl">{lastFeedback.isCorrect ? '✅' : '❌'}</span>
                   <h4 className="text-base md:text-lg font-bold text-slate-900 serif-font">{lastFeedback.isCorrect ? '完美的表达！' : '还需要打磨...'}</h4>
                 </div>
                 <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm border ${lastFeedback.isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                   {lastFeedback.isCorrect ? 'MASTERY +1' : 'MASTERY -1'}
                 </div>
               </div>
               
               <p className="text-slate-600 text-xs md:text-sm italic leading-relaxed px-1">“ {lastFeedback.feedback || "AI 已评估该句子，并给出了优化建议。"} ”</p>
               
               {lastFeedback.betterVersion && (
                 <div className="p-4 md:p-5 bg-slate-900 text-white rounded-[1.5rem] md:rounded-3xl relative">
                   <span className="text-[8px] font-black uppercase text-indigo-400 block mb-2">AI 优化建议</span>
                   <p className="serif-font italic text-base md:text-lg leading-relaxed mb-1">{renderRuby(lastFeedback.betterVersion)}</p>
                   <button 
                    onClick={(e) => { e.stopPropagation(); handlePlayAudio(lastFeedback.betterVersion!, 'better'); }} 
                    disabled={isAudioLoading && playingAudioId === 'better'}
                    className={`absolute bottom-3 right-5 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${playingAudioId === 'better' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/10 text-slate-400 hover:text-indigo-400'}`}
                   >
                     {isAudioLoading && playingAudioId === 'better' ? (
                       <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                     ) : playingAudioId === 'better' ? '⏹' : '🎧'}
                   </button>
                 </div>
               )}

               {lastFeedback.keyPhrases && lastFeedback.keyPhrases.length > 0 && (
                 <div className="pt-2">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className="text-xs">✨</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">入馆推荐 Recommended Gems</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lastFeedback.keyPhrases.map((kp, idx) => {
                        const isSaved = savedPhrases.has(kp.phrase);
                        return (
                          <button 
                            key={idx}
                            onClick={() => handleSavePhrase(kp.phrase, kp.explanation)}
                            disabled={isSaved}
                            className={`group flex items-center space-x-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all active:scale-95 ${
                              isSaved 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                                : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/50'
                            }`}
                          >
                            <span className="serif-font">{renderRuby(kp.phrase)}</span>
                            <span className="opacity-30">|</span>
                            <span className="text-[9px] font-medium opacity-70">{kp.explanation}</span>
                            <span className={`transition-transform ${isSaved ? 'scale-110' : 'group-hover:rotate-12'}`}>
                              {isSaved ? '✓' : '💎'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                 </div>
               )}

               <div className="flex gap-3 md:gap-4 mt-6">
                 <button onClick={handleRetry} className="flex-1 py-3 md:py-4 border border-slate-200 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors">重新尝试 RETRY</button>
                 <button onClick={handleNext} className="flex-1 py-3 md:py-4 bg-indigo-600 text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                    {queueProgress && queueProgress.current < queueProgress.total ? '下一个珍宝 NEXT' : '完成练习 DONE'}
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VocabPractice;
