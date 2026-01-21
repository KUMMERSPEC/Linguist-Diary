import React, { useState, useEffect, useRef } from 'react';
import { RehearsalEvaluation } from '../types';
import { generatePracticeArtifact, evaluateRetelling, generateDiaryAudio } from '../services/geminiService';

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
  const [sourceText, setSourceText] = useState('');
  const [userRetelling, setUserRetelling] = useState('');
  const [keywords, setKeywords] = useState('');
  const [evaluation, setEvaluation] = useState<RehearsalEvaluation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const sanitizeText = (text: string) => {
    return text
      .replace(/^\*\*.*?\*\*:\s*/gim, '')
      .replace(/\*\*.*?\*\*:\s*/gim, '')
      .trim();
  };

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const startNewSession = async () => {
    setIsGenerating(true);
    setSourceText('');
    setUserRetelling('');
    setEvaluation(null);
    setShowSource(true);
    setHasSaved(false);
    try {
      const text = await generatePracticeArtifact(language.code, keywords.trim(), difficulty.id, topic.id);
      setSourceText(sanitizeText(text));
    } catch (e) {
      alert("无法生成演练材料，请重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEvaluate = async () => {
    if (!userRetelling.trim() || isEvaluating) return;
    setIsEvaluating(true);
    try {
      const result = await evaluateRetelling(sourceText, userRetelling, language.code);
      setEvaluation({
        ...result,
        sourceText,
        userRetelling
      });
      setShowSource(false);
    } catch (e) {
      alert("评估失败，请稍后重试。");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSave = () => {
    if (evaluation && onSaveToMuseum) {
      onSaveToMuseum(language.code, evaluation);
      setHasSaved(true);
    }
  };

  const handlePlayAudio = async (textToPlay: string) => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    try {
      const base64Audio = await generateDiaryAudio(textToPlay);
      if (!base64Audio) return;
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      buffer.getChannelData(0).set(Array.from(dataInt16).map(v => v / 32768.0));
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
      audioSourceRef.current = source;
      setIsPlaying(true);
    } catch (e) { console.error(e); }
  };

  const getGrade = (score: number) => {
    const s = Math.round(score);
    if (s >= 90) return { label: 'S', color: 'text-indigo-400' };
    if (s >= 80) return { label: 'A', color: 'text-emerald-400' };
    if (s >= 70) return { label: 'B', color: 'text-orange-400' };
    return { label: 'C', color: 'text-slate-400' };
  };

  const isSessionActive = sourceText && !isGenerating;

  return (
    <div className="flex flex-col animate-in fade-in duration-500 pb-40 md:pb-12 p-0 md:p-2">
      <header className={`flex items-center justify-between px-4 md:px-0 transition-all duration-500 ${isSessionActive ? 'mb-4' : 'mb-6 md:mb-10'}`}>
        <div className="flex flex-col">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 serif-font">展厅演练 Rehearsal</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">Refine your presentation skills</p>
        </div>
        {isSessionActive && (
          <button 
            onClick={() => { setSourceText(''); setEvaluation(null); }}
            className="px-5 py-2.5 bg-white border border-slate-200 rounded-2xl text-[11px] font-black text-slate-500 uppercase shadow-sm flex items-center gap-2 active:scale-95 transition-all"
          >
            ⚙️ 重新配置
          </button>
        )}
      </header>

      {!isSessionActive && (
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl space-y-8 animate-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">选择语言 LANGUAGE</span>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        language.code === lang.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-transparent text-slate-500'
                      }`}
                    >
                      {lang.flag} {lang.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">难度等级 DIFFICULTY</span>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDifficulty(d)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                        difficulty.id === d.id ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-slate-50 border-transparent text-slate-400'
                      }`}
                    >
                      {d.icon} {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">场景主题 TOPIC</span>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTopic(t)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                      topic.id === t.id ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-transparent text-slate-400'
                    }`}
                  >
                    <span className="text-xl mb-1">{t.icon}</span>
                    <span className="text-[10px] font-black uppercase">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">指定关键词 KEYWORDS (可选)</span>
                <input 
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="例如: coffee, morning..."
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                />
              </div>
              <button 
                onClick={startNewSession}
                disabled={isGenerating}
                className="w-full bg-indigo-600 text-white py-5 rounded-3xl text-sm font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3"
              >
                {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                  <span className="tracking-widest uppercase">✨ 开启演练 START</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSessionActive && (
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:gap-8 px-2 md:px-0 animate-in fade-in slide-in-from-bottom-6">
          <div className="flex flex-col space-y-4 mb-6 lg:mb-0">
             <div className="flex items-center justify-between px-3">
                <div className="flex items-center space-x-3">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Original Artifact 原文</span>
                </div>
                <div className="flex items-center space-x-4">
                   <button onClick={() => setShowSource(!showSource)} className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                      {showSource ? '🙈 隐藏' : '👁️ 显示'}
                   </button>
                   <button onClick={() => handlePlayAudio(sourceText)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isPlaying ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`}>
                      {isPlaying ? '⏹' : '🎧'}
                   </button>
                </div>
             </div>
             <div className={`bg-white p-8 md:p-14 rounded-[2.5rem] md:rounded-[3rem] border border-slate-200 shadow-xl relative min-h-[300px] flex items-center justify-center text-center transition-all duration-700 overflow-hidden ${!showSource ? 'blur-3xl grayscale' : ''}`}>
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
                <div className="max-w-2xl mx-auto relative z-10">
                  <p className="text-lg md:text-2xl text-slate-700 leading-[2.2] serif-font italic">
                    “ {renderRuby(sourceText)} ”
                  </p>
                </div>
                {!showSource && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black text-xs shadow-2xl tracking-[0.2em] uppercase">Memory Mode Active</div>
                  </div>
                )}
             </div>
          </div>

          <div className="flex flex-col space-y-4">
             <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest px-3">Your Retelling 复述</span>
             <div className="bg-white border border-slate-200 rounded-[2.5rem] md:rounded-[3rem] shadow-xl overflow-hidden focus-within:ring-8 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 transition-all flex flex-col min-h-[300px]">
                <textarea 
                  value={userRetelling}
                  onChange={(e) => setUserRetelling(e.target.value)}
                  placeholder="凭记忆，尝试复述刚才的内容..."
                  className="flex-1 w-full border-none focus:ring-0 p-8 md:p-14 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-300"
                />
                <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Retelling Analysis</span>
                  <span className="text-[10px] font-black text-slate-300">{userRetelling.length} chars</span>
                </div>
             </div>
             
             {/* 电脑端按钮：仅在大屏幕且还没有评估结果时显示 */}
             {!evaluation && (
               <button 
                  onClick={handleEvaluate}
                  disabled={!userRetelling.trim() || isEvaluating}
                  className="hidden lg:flex w-full bg-slate-900 text-white py-6 rounded-3xl font-black shadow-2xl transition-all active:scale-[0.98] items-center justify-center space-x-4 hover:bg-indigo-600 mt-4"
                >
                  {isEvaluating ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-lg uppercase tracking-[0.2em]">🏛️ 提交评估报告 SUBMIT</span>
                  )}
               </button>
             )}
          </div>
        </div>
      )}

      {/* 移动端悬浮提交按钮：仅在演练激活、未生成评估且是小屏幕时显示 */}
      {isSessionActive && !evaluation && (
        <div className="lg:hidden fixed bottom-20 left-0 right-0 px-6 py-4 z-[110] pointer-events-none">
          <button
            onClick={handleEvaluate}
            disabled={!userRetelling.trim() || isEvaluating}
            className={`w-full py-4 rounded-3xl font-black transition-all active:scale-[0.98] flex items-center justify-center space-x-4 shadow-[0_15px_30px_-5px_rgba(0,0,0,0.3)] pointer-events-auto ${
              isEvaluating ? 'bg-slate-100 text-slate-300 shadow-none' : 'bg-slate-900 text-white'
            }`}
          >
            {isEvaluating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
            ) : (
              <span className="text-sm tracking-[0.2em] uppercase">🏛️ 提交评估报告 SUBMIT</span>
            )}
          </button>
        </div>
      )}

      {evaluation && (
        <div className="mt-8 md:mt-12 animate-in slide-in-from-bottom-6">
           <div className="bg-slate-900 rounded-[2.5rem] md:rounded-[4rem] p-8 md:p-14 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -mr-40 -mb-40"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 relative z-10">
                <div className="flex items-center space-x-4">
                   <div className="w-3 h-10 bg-indigo-500 rounded-full"></div>
                   <h3 className="text-xl md:text-3xl font-bold serif-font tracking-tight">评估报告 REPORT</h3>
                </div>
                {!hasSaved ? (
                  <button 
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95"
                  >
                    🏛️ 存入收藏馆 Exhibit
                  </button>
                ) : (
                  <span className="text-emerald-400 text-xs font-black flex items-center space-x-2 bg-emerald-400/10 px-6 py-3 rounded-2xl border border-emerald-400/20">
                    <span className="text-xl">✓</span>
                    <span className="uppercase tracking-[0.2em]">已存入收藏馆</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative z-10">
                <div className="lg:col-span-4 space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-2">还原度 Accuracy</span>
                        <div className={`text-4xl font-black serif-font ${getGrade(evaluation.accuracyScore).color}`}>{getGrade(evaluation.accuracyScore).label}</div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2 block">{Math.round(evaluation.accuracyScore)}/100</span>
                      </div>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/10 text-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase block mb-2">表现力 Quality</span>
                        <div className={`text-4xl font-black serif-font ${getGrade(evaluation.qualityScore).color}`}>{getGrade(evaluation.qualityScore).label}</div>
                        <span className="text-[10px] font-bold text-slate-400 mt-2 block">{Math.round(evaluation.qualityScore)}/100</span>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <div className="bg-white/5 p-5 rounded-2xl">
                         <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-2">内容评价</h4>
                         <p className="text-xs text-slate-300 leading-relaxed italic">{evaluation.contentFeedback}</p>
                      </div>
                      <div className="bg-white/5 p-5 rounded-2xl">
                         <h4 className="text-[10px] font-black text-emerald-400 uppercase mb-2">语言评析</h4>
                         <p className="text-xs text-slate-300 leading-relaxed italic">{evaluation.languageFeedback}</p>
                      </div>
                   </div>
                </div>

                <div className="lg:col-span-8 space-y-8">
                   <div className="bg-white/5 p-8 md:p-10 rounded-[2rem] border border-white/5">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 block">源文物 Archive Source</h4>
                      <p className="text-lg md:text-2xl text-slate-400 leading-[1.8] serif-font italic">
                        {renderRuby(sourceText)}
                      </p>
                   </div>
                   <div className="bg-white/5 p-8 md:p-12 rounded-[2.5rem] border border-white/10">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 block">馆长示范 Masterpiece Suggestion</h4>
                      <p className="text-lg md:text-2xl text-indigo-100 leading-[1.8] serif-font italic">
                        “ {renderRuby(evaluation.suggestedVersion)} ”
                      </p>
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