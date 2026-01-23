
import React, { useState, useEffect, useRef } from 'react';
import { RehearsalEvaluation } from '../types';
import { generatePracticeArtifact, evaluateRetelling, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

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
  onSaveToMuseum?: (language: string, result: RehearsalEvaluation) => void;
}

const Rehearsal: React.FC<RehearsalProps> = ({ onSaveToMuseum }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [topic, setTopic] = useState(TOPICS[0]);
  const [keywords, setKeywords] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [userRetelling, setUserRetelling] = useState('');
  const [evaluation, setEvaluation] = useState<RehearsalEvaluation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'diff' | 'final'>('diff');

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const renderDiffText = (diff?: string) => {
    if (!diff) return null;
    let processed = diff.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    processed = processed
      .replace(/<add>(.*?)<\/add>/g, '<span class="bg-emerald-500/20 text-emerald-200 px-1 rounded-md border-b-2 border-emerald-400/30 font-bold mx-0.5">$1</span>')
      .replace(/<rem>(.*?)<\/rem>/g, '<span class="text-slate-500 line-through px-1 opacity-60">$1</span>');
    return <div className="leading-[2.2] text-lg md:text-2xl text-slate-100 serif-font" dangerouslySetInnerHTML={{ __html: processed }} />;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setEvaluation(null);
    setUserRetelling('');
    try {
      const art = await generatePracticeArtifact(language.code, keywords, difficulty.id, topic.label);
      setSourceText(art);
      setShowSource(true);
    } catch (e) {
      alert("生成失败，请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (userRetelling.length < 10) return alert("请写下更完整的复述内容。");
    setIsEvaluating(true);
    try {
      const result = await evaluateRetelling(sourceText, userRetelling, language.code);
      const fullResult = { ...result, sourceText, userRetelling };
      setEvaluation(fullResult);
      onSaveToMuseum?.(language.code, fullResult);
    } catch (e) {
      alert("评估失败。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handlePlayAudio = async (textToPlay: string) => {
    if (!textToPlay) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
      if (isPlaying) { setIsPlaying(false); return; }
    }
    setIsPlaying(true);
    try {
      const cleanText = textToPlay.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      const base64Audio = await generateDiaryAudio(cleanText);
      const bytes = decode(base64Audio);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
      audioSourceRef.current = source;
    } catch (e) { setIsPlaying(false); }
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 animate-in fade-in duration-500">
      <header className="mb-6 max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 serif-font tracking-tight">展厅演练 Rehearsal</h2>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1 opacity-70">Refine Your Presentation Skills</p>
      </header>

      {!sourceText ? (
        <div className="max-w-6xl mx-auto animate-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-100/50">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              
              {/* Column 1: Language & Difficulty */}
              <div className="lg:col-span-3 space-y-8">
                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">选择语言 LANGUAGE</label>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGES.map(l => (
                      <button 
                        key={l.code} 
                        onClick={() => setLanguage(l)} 
                        className={`flex items-center space-x-2 px-3 py-2 rounded-xl border-2 transition-all text-xs font-bold ${
                          language.code === l.code 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span>{l.flag}</span>
                        <span className="truncate">{l.label}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">难度等级 DIFFICULTY</label>
                  <div className="flex gap-2">
                    {DIFFICULTIES.map(d => (
                      <button 
                        key={d.id} 
                        onClick={() => setDifficulty(d)} 
                        className={`flex-1 py-2 rounded-xl border-2 transition-all flex flex-col items-center justify-center space-y-1 ${
                          difficulty.id === d.id 
                          ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' 
                          : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-base">{d.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{d.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Column 2: Topic Grid */}
              <div className="lg:col-span-5">
                <section>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">场景主题 TOPIC</label>
                  <div className="grid grid-cols-3 gap-3">
                    {TOPICS.map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setTopic(t)} 
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                          topic.id === t.id 
                          ? 'bg-indigo-50 border-indigo-600 shadow-inner' 
                          : 'bg-slate-50 border-transparent text-slate-500 hover:bg-white hover:border-slate-200'
                        }`}
                      >
                        <span className="text-2xl mb-2">{t.icon}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${topic.id === t.id ? 'text-indigo-600' : 'text-slate-500'}`}>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              {/* Column 3: Keywords & Start Action */}
              <div className="lg:col-span-4 flex flex-col justify-between">
                <section className="mb-6 lg:mb-0">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">指定关键词 KEYWORDS (可选)</label>
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                    <textarea 
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="例如: coffee, morning, city..."
                      className="w-full bg-transparent border-none focus:ring-0 text-sm italic serif-font text-slate-700 resize-none h-20"
                    />
                  </div>
                </section>

                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating} 
                  className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-lg shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 active:scale-95 group"
                >
                  {isGenerating ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="text-xl">✨</span>
                      <span>开启演练 START</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : !evaluation ? (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-700">
           <div className="bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center space-x-3">
                 <span className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">📖</span>
                 <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">源文物内容 ARCHIVE ARTIFACT</h3>
               </div>
               <div className="flex items-center space-x-4">
                 <button onClick={() => setShowSource(!showSource)} className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:underline">{showSource ? '🙈 隐藏内容' : '👁️ 显示内容'}</button>
                 <button onClick={() => handlePlayAudio(sourceText)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}>{isPlaying ? '⏹' : '🎧'}</button>
               </div>
             </div>
             <div className={`transition-all duration-700 ${showSource ? 'blur-0 opacity-100' : 'blur-2xl opacity-10 select-none'}`}>
               <p className="text-2xl md:text-3xl text-slate-800 leading-[2.5] serif-font italic">“ {renderRuby(sourceText)} ”</p>
             </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-[3rem] shadow-xl overflow-hidden focus-within:ring-8 focus-within:ring-indigo-500/5 transition-all">
             <div className="bg-slate-50 px-10 py-5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">您的复述内容 YOUR RETELLING</span>
                <span className="text-[10px] font-black text-slate-300 tracking-widest">{userRetelling.length} CHARS</span>
             </div>
             <textarea 
               value={userRetelling} 
               onChange={(e) => setUserRetelling(e.target.value)} 
               placeholder="请尽可能准确地复述刚才看到的内容..." 
               className="w-full h-80 border-none focus:ring-0 p-10 md:p-14 text-xl md:text-3xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-200 no-scrollbar" 
             />
           </div>

           <div className="flex flex-col sm:flex-row gap-4">
             <button onClick={() => setSourceText('')} className="flex-1 py-6 border-2 border-slate-200 rounded-3xl text-[12px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-colors">放弃这次演练 DISCARD</button>
             <button onClick={handleEvaluate} disabled={isEvaluating || userRetelling.length < 10} className="flex-[2] bg-indigo-600 text-white py-6 rounded-3xl font-black text-xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50">
               {isEvaluating ? <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>📊 评估表现 EVALUATE PERFORMANCE</span><span className="text-2xl">→</span></>}
             </button>
           </div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[4rem] p-10 md:p-16 text-white shadow-2xl animate-in zoom-in duration-700 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
           
           <div className="flex items-center justify-between mb-16 relative z-10">
             <h3 className="text-3xl font-black serif-font">演练评估结果 REVIEW</h3>
             <button onClick={() => setSourceText('')} className="bg-white/10 px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-white/20 transition-all border border-white/5">重新开始 NEW SESSION</button>
           </div>
           
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 relative z-10">
              <div className="space-y-12">
                <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 flex items-center justify-around shadow-inner">
                   <div className="text-center">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">还原度 ACCURACY</span>
                     <div className="text-6xl font-black text-indigo-400 serif-font tracking-tighter">{evaluation.accuracyScore}</div>
                   </div>
                   <div className="w-[1px] h-16 bg-white/10"></div>
                   <div className="text-center">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">表现力 QUALITY</span>
                     <div className="text-6xl font-black text-emerald-400 serif-font tracking-tighter">{evaluation.qualityScore}</div>
                   </div>
                </div>
                
                <div className="space-y-6">
                   <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 hover:bg-white/10 transition-colors">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">内容反馈 CONTENT FEEDBACK</h4>
                      <p className="text-base text-slate-300 italic leading-relaxed">{evaluation.contentFeedback}</p>
                   </div>
                   <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 hover:bg-white/10 transition-colors">
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-4">语言评析 LANGUAGE NOTES</h4>
                      <p className="text-base text-slate-300 italic leading-relaxed">{evaluation.languageFeedback}</p>
                   </div>
                </div>
              </div>
              
              <div className="space-y-8">
                <div className="bg-white/10 p-10 md:p-14 rounded-[3.5rem] border border-white/10 shadow-2xl">
                   <div className="flex items-center justify-between mb-8">
                     <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.2em]">打磨建议 RESTORED VERSION</h4>
                     <div className="flex bg-white/5 p-1.5 rounded-2xl">
                        <button onClick={() => setViewMode('diff')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'diff' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>对比</button>
                        <button onClick={() => setViewMode('final')} className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'final' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>最终</button>
                     </div>
                   </div>
                   <div className="min-h-[200px]">
                     {viewMode === 'diff' ? renderDiffText(evaluation.diffedRetelling) : <p className="text-2xl md:text-3xl leading-[2.5] italic serif-font text-slate-100">{renderRuby(evaluation.suggestedVersion)}</p>}
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Rehearsal;
