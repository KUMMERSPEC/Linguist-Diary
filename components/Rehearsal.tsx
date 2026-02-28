
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RehearsalEvaluation, AdvancedVocab } from '../types';
import { generatePracticeArtifact, evaluateRetelling, generateDiaryAudio, generateWeavedArtifact, retryEvaluationForGems } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';
import RehearsalReport from './RehearsalReport';

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const DIFFICULTIES = [
  { id: 'Beginner', label: '初级', icon: '🌱' },
  { id: 'Intermediate', label: '中级', icon: '🌿' },
  { id: 'Advanced', label: '高级', icon: '🌳' },
];

const TOPICS = [
  { id: 'Random', label: '随机', icon: '🎲' },
  { id: 'Daily', label: '生活', icon: '🏠' },
  { id: 'Travel', label: '旅行', icon: '✈️' },
  { id: 'Work', label: '职场', icon: '💼' },
  { id: 'Culture', label: '文化', icon: '🎨' },
  { id: 'News', label: '新闻', icon: '🌍' },
];

interface RehearsalProps {
  onSaveRehearsal: (evaluation: RehearsalEvaluation) => void;
  onSaveVocab: (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => void;
  setView: (view: ViewState) => void;
  allAdvancedVocab?: AdvancedVocab[];
  preferredLanguages: string[];
}

const Rehearsal: React.FC<RehearsalProps> = ({ onSaveRehearsal, onSaveVocab, setView, allAdvancedVocab = [], preferredLanguages = [] }) => {
  const filteredLangs = useMemo(() => LANGUAGES.filter(l => (preferredLanguages ?? []).includes(l.code)), [preferredLanguages]);
  const [mode, setMode] = useState<'normal' | 'weave'>('normal');
  const [language, setLanguage] = useState(filteredLangs[0] || LANGUAGES[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [keywords, setKeywords] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [userRetelling, setUserRetelling] = useState('');
  const [evaluation, setEvaluation] = useState<RehearsalEvaluation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'final'>('diff');

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const weavingGems = useMemo(() => {
    if (mode !== 'weave') return [];
    return allAdvancedVocab
      .filter(v => v.language === language.code)
      .sort((a, b) => (b.mastery || 0) - (a.mastery || 0)) 
      .slice(0, 3);
  }, [mode, allAdvancedVocab, language]);

  // Utility to clean Markdown if AI doesn't follow instructions
  const cleanMarkdown = (text: string) => {
    return text
      .replace(/[#*`~]/g, '') // Remove simple markdown symbols
      .replace(/\n\n+/g, '\n') // Remove excessive newlines
      .trim();
  };

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderDiffText = (diff?: string) => {
    if (!diff) return null;
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="text-emerald-400 font-bold bg-emerald-500/10 px-1 rounded mx-0.5">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="text-rose-400 line-through opacity-60 mx-0.5">$1</span>');
    return <div className="leading-[2.5] text-lg md:text-xl text-slate-100 serif-font italic" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const getGrade = (score: number) => {
    const s = Math.round(score || 0);
    if (s >= 90) return { label: 'S', color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    if (s >= 80) return { label: 'A', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (s >= 70) return { label: 'B', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    return { label: 'C', color: 'text-slate-400', bg: 'bg-slate-500/10' };
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setEvaluation(null);
    setUserRetelling('');
    try {
      let art = "";
      if (mode === 'weave') {
        if (weavingGems.length === 0) {
          alert("当前语言暂无入库珍宝，请先去打磨词汇或切换到普通模式。");
          setIsGenerating(false);
          return;
        }
        art = await generateWeavedArtifact(language.code, weavingGems);
      } else {
        art = await generatePracticeArtifact(language.code, keywords, difficulty.id, topic.label);
      }
      setSourceText(cleanMarkdown(art));
      setShowSource(true);
    } catch (e) {
      alert("生成失败，请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetryFailed = async (failedItems: { word: string; meaning: string; usage: string; }[]) => {
    if (!evaluation) return;

    setIsEvaluating(true);
    try {
      const newGems = await retryEvaluationForGems(failedItems, language.code);
      
      const updatedGems = (evaluation.recommendedGems || []).map(originalGem => {
        const newlyEvaluated = newGems.find(ng => ng.word === originalGem.word);
        return newlyEvaluated || originalGem;
      });

      const newEvaluation = { ...evaluation, recommendedGems: updatedGems };
      setEvaluation(newEvaluation);

    } catch (e) {
      alert("重试失败，请稍后再次尝试。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleEvaluate = async () => {
    if (userRetelling.length < 10) return alert("请写下更完整的复述内容。");
    setIsEvaluating(true);
    try {
      const result = await evaluateRetelling(sourceText, userRetelling, language.code);
      const fullResult: RehearsalEvaluation = {
        ...result,
        id: `temp-${Date.now()}`,
        timestamp: Date.now(),
        sourceText,
        userRetelling,
        language: language.code,
        mode: mode
      };
      setEvaluation(fullResult);
      onSaveRehearsal(fullResult);
    } catch (e) {
      alert("评估失败。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handlePlayAudio = async (textToPlay: string, id: string) => {
    if (!textToPlay || isAudioLoading) return;
    
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying === id) { setIsPlaying(null); return; }
    }

    setIsPlaying(id);
    setIsAudioLoading(true);

    try {
      const cleanText = textToPlay.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      const base64Audio = await generateDiaryAudio(cleanText);
      setIsAudioLoading(false);

      if (!base64Audio) {
        setIsPlaying(null);
        return;
      }

      const bytes = decode(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setIsPlaying(null);
        setIsAudioLoading(false);
      };
      source.start();
      audioSourceRef.current = source;
    } catch (e) { 
      setIsAudioLoading(false);
      setIsPlaying(null); 
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pt-6 md:pt-10 px-4 md:px-8 pb-32 animate-in fade-in duration-500">
      <header className="mb-10 max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="text-center md:text-left">
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font tracking-tight">展厅演练 Rehearsal</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-70">Refine Your Presentation Skills</p>
        </div>
        
        {!sourceText && (
          <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex items-center self-center md:self-auto">
            <button 
              onClick={() => setMode('normal')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'normal' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              普通模式
            </button>
            <button 
              onClick={() => setMode('weave')}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'weave' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              馆藏织网模式 ✨
            </button>
          </div>
        )}
      </header>

      {!sourceText ? (
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
          <div className={`bg-white p-6 md:p-10 rounded-[2.5rem] border shadow-2xl transition-all ${mode === 'weave' ? 'border-indigo-100 shadow-indigo-100/50' : 'border-slate-200 shadow-slate-100/50'}`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              <div className="lg:col-span-3 space-y-8">
                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">选择语言 LANGUAGE</label>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredLangs.map(l => (
                      <button key={l.code} onClick={() => setLanguage(l)} className={`flex items-center space-x-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-bold ${language.code === l.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                        <span>{l.flag}</span>
                        <span className="truncate">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
                {mode === 'normal' && (
                  <section>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">难度等级 DIFFICULTY</label>
                    <div className="flex gap-2">
                      {DIFFICULTIES.map(d => (
                        <button key={d.id} onClick={() => setDifficulty(d)} className={`flex-1 py-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-1 ${difficulty.id === d.id ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                          <span className="text-base">{d.icon}</span>
                          <span className="text-[10px] font-black uppercase tracking-tighter">{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              
              <div className="lg:col-span-9 flex flex-col">
                {mode === 'weave' ? (
                  <div className="flex-1 flex flex-col">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6">即将编织的馆藏珍宝 WEAVING GEMS</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      {weavingGems.length > 0 ? weavingGems.map((gem, idx) => (
                        <div key={idx} className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 flex flex-col items-center text-center space-y-2">
                           <span className="text-2xl">💎</span>
                           <h4 className="text-lg font-black text-slate-900 serif-font">
                             {renderRuby(gem.word)}
                           </h4>
                           <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Mastery {gem.mastery || 0}</p>
                        </div>
                      )) : (
                        <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                          <p className="text-slate-400 text-xs italic">当前语言下没有可编织的珍宝。</p>
                        </div>
                      )}
                    </div>
                    <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-start space-x-4">
                      <span className="text-2xl">🕸️</span>
                      <p className="text-sm text-indigo-800 leading-relaxed italic">
                        “ 织网模式会将您最近高熟练度的词汇交给 AI，由其编造成一段逻辑通顺的文本。这能帮助您将孤立的词汇转化为成系统的表达能力。 ”
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                    <section>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">场景主题 TOPIC</label>
                      <div className="grid grid-cols-3 gap-3">
                        {TOPICS.map(t => (
                          <button key={t.id} onClick={() => setTopic(t)} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${topic.id === t.id ? 'bg-indigo-50 border-indigo-600 shadow-inner' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'}`}>
                            <span className="text-2xl mb-2">{t.icon}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${topic.id === t.id ? 'text-indigo-600' : 'text-slate-500'}`}>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                    <section className="flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">指定关键词 KEYWORDS</label>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                          <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="指定一个或多个词汇..." className="w-full bg-transparent border-none focus:ring-0 text-sm italic serif-font text-slate-700 resize-none h-20" />
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || (mode === 'weave' && weavingGems.length === 0)} 
                  className={`w-full mt-10 py-6 rounded-3xl font-black text-lg shadow-2xl transition-all flex items-center justify-center space-x-3 active:scale-95 group ${mode === 'weave' ? 'bg-indigo-600 shadow-indigo-100' : 'bg-slate-900 shadow-slate-200'} text-white`}
                >
                  {isGenerating ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span className="text-xl">{mode === 'weave' ? '🕸️' : '✨'}</span><span>{mode === 'weave' ? '开始织网演练' : '开启常规演练'} START</span></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !evaluation ? (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
           <div className="bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden min-h-[220px]">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center space-x-3">
                 <span className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">{mode === 'weave' ? '🕸️' : '📖'}</span>
                 <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">{mode === 'weave' ? '织网演练成果 WEAVED ARTIFACT' : '源文物内容 ARCHIVE ARTIFACT'}</h3>
               </div>
               <div className="flex items-center space-x-4">
                 <button onClick={() => setShowSource(!showSource)} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline flex items-center space-x-1.5">
                    <span>{showSource ? '👁️' : '👁️‍🗨️'}</span>
                    <span>{showSource ? '隐藏内容' : '显示内容'}</span>
                 </button>
                 <button 
                  onClick={() => handlePlayAudio(sourceText, 'source')} 
                  disabled={isAudioLoading && isPlaying === 'source'}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isPlaying === 'source' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                 >
                   {isAudioLoading && isPlaying === 'source' ? (
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                   ) : isPlaying === 'source' ? '⏹' : '🎧'}
                 </button>
               </div>
             </div>
             
             <div className="relative">
                <div className={`transition-all duration-700 ease-in-out ${showSource ? 'blur-0 opacity-100 pointer-events-auto' : 'blur-[14px] opacity-30 select-none pointer-events-none grayscale-[0.3]'}`}>
                  <p className="text-lg md:text-xl text-slate-800 leading-[2.2] serif-font italic">“ {renderRuby(sourceText)} ”</p>
                </div>
                {!showSource && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] opacity-50">Content Encrypted for Rehearsal</span>
                  </div>
                )}
             </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-[3rem] shadow-xl overflow-hidden focus-within:ring-8 focus-within:ring-indigo-500/5 transition-all">
             <div className="bg-slate-50 px-10 py-5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">您的复述内容 YOUR RETELLING</span>
                <span className="text-[10px] font-black text-slate-300 tracking-widest">{userRetelling.length} CHARS</span>
             </div>
             <textarea value={userRetelling} onChange={(e) => setUserRetelling(e.target.value)} placeholder="请尽可能准确地复述刚才看到的内容..." className="w-full h-80 border-none focus:ring-0 p-10 md:p-14 text-lg md:text-xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-200 no-scrollbar" />
           </div>

           <div className="flex flex-col sm:flex-row gap-4">
             <button onClick={() => setSourceText('')} className="flex-1 py-6 border-2 border-slate-200 rounded-3xl text-[12px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">放弃这次演练 DISCARD</button>
             <button onClick={handleEvaluate} disabled={isEvaluating || userRetelling.length < 10} className="flex-[2] bg-indigo-600 text-white py-6 rounded-3xl font-black text-base shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50">
               {isEvaluating ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>📊 评估表现 EVALUATE PERFORMANCE</span><span className="text-2xl">→</span></>}
             </button>
           </div>
        </div>
      ) : (
        <RehearsalReport 
            evaluation={evaluation} 
            language={language.code} 
            date={new Date().toLocaleDateString()} 
            onBack={() => {
              onSaveRehearsal(evaluation);
              setView('history');
            }}
            onSaveVocab={onSaveVocab}
            onRetryFailed={handleRetryFailed}
          />
      )}
    </div>
  );
};

export default Rehearsal;
