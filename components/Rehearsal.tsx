
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

  const handlePlayAudio = async () => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }
    try {
      const base64Audio = await generateDiaryAudio(sourceText);
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
    if (score >= 90) return { label: 'S', color: 'text-indigo-400' };
    if (score >= 80) return { label: 'A', color: 'text-emerald-400' };
    if (score >= 70) return { label: 'B', color: 'text-orange-400' };
    return { label: 'C', color: 'text-slate-400' };
  };

  return (
    <div className="space-y-3 md:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-4xl mx-auto px-1 md:px-0">
      <header className="flex flex-col px-1 md:px-2">
        <h2 className="text-xl md:text-3xl font-bold text-slate-900 serif-font">展厅演练 Rehearsal</h2>
        <p className="text-slate-400 text-[9px] md:text-sm">通过复述专家描述，打磨您的语言表现力。</p>
      </header>

      {/* 增强版控制面板 - 移动端适配 */}
      <div className="bg-white p-2.5 md:p-6 rounded-[1.8rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm space-y-2 md:space-y-4">
        <div className="space-y-2 md:space-y-3">
          {/* 1. 语言选择 */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0">Lang:</span>
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang); setSourceText(''); }}
                className={`px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold transition-all border whitespace-nowrap ${
                  language.code === lang.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-transparent text-slate-500'
                }`}
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>

          {/* 2. 难度选择 */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0">Level:</span>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                onClick={() => setDifficulty(d)}
                className={`px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold transition-all border whitespace-nowrap ${
                  difficulty.id === d.id ? 'bg-amber-500 border-amber-500 text-white shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'
                }`}
              >
                {d.icon} {d.label}
              </button>
            ))}
          </div>

          {/* 3. 主题选择 */}
          <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[8px] md:text-[9px] font-black text-slate-300 uppercase tracking-widest shrink-0">Topic:</span>
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTopic(t)}
                className={`px-2.5 py-0.5 md:px-3 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold transition-all border whitespace-nowrap ${
                  topic.id === t.id ? 'bg-cyan-600 border-cyan-600 text-white shadow-sm' : 'bg-slate-50 border-transparent text-slate-400'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-50 flex flex-col md:flex-row gap-2 md:gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400 text-[9px]">
               🏷️ <span className="ml-1 font-bold uppercase tracking-wider opacity-50">指定词:</span>
            </div>
            <input 
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="可选..."
              className="w-full pl-14 pr-3 py-2 md:py-2.5 bg-slate-50 border-none rounded-xl text-[9px] md:text-xs font-medium focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
            />
          </div>
          
          <button 
            onClick={startNewSession}
            disabled={isGenerating}
            className="bg-indigo-600 text-white px-6 py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center space-x-2 active:scale-[0.98] disabled:bg-slate-200"
          >
            {isGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
              <span>✨ 开启 {difficulty.label}·{topic.label} 演练</span>
            )}
          </button>
        </div>
      </div>

      {!sourceText && !isGenerating ? (
        <div className="py-12 md:py-24 text-center bg-white rounded-[1.8rem] md:rounded-[2.5rem] border border-dashed border-slate-200">
          <div className="text-3xl md:text-4xl mb-3 opacity-20">🎭</div>
          <p className="text-slate-400 font-bold text-[11px] md:text-sm">选择难度与主题，点击按钮开始演练。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
          <div className="space-y-1.5 md:space-y-4">
             <div className="flex items-center justify-between px-2">
                <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Original Artifact</span>
                <div className="flex items-center space-x-3">
                   <button onClick={() => setShowSource(!showSource)} className="text-[9px] md:text-[10px] font-bold text-indigo-500 hover:underline">
                      {showSource ? '🙈 隐藏' : '👁️ 显示'}
                   </button>
                   <button onClick={handlePlayAudio} className={`text-xs md:text-sm ${isPlaying ? 'text-indigo-600 scale-125' : 'text-slate-300'} transition-all`}>
                      {isPlaying ? '⏹' : '🎧'}
                   </button>
                </div>
             </div>
             <div className={`bg-white p-4 md:p-10 rounded-[1.8rem] md:rounded-[2rem] border border-slate-200 shadow-sm relative min-h-[140px] md:min-h-[240px] flex items-center justify-center text-center transition-all duration-700 ${!showSource ? 'blur-xl grayscale select-none' : ''}`}>
                <p className="text-sm md:text-xl text-slate-700 leading-[2] md:leading-[2.2] serif-font italic">
                  “ {renderRuby(sourceText)} ”
                </p>
                {!showSource && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-slate-900/5 backdrop-blur-md px-4 py-1.5 rounded-full font-bold text-slate-700 text-[10px]">记忆模式</div>
                  </div>
                )}
             </div>
          </div>

          <div className="space-y-1.5 md:space-y-4">
             <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest px-2">Your Retelling</span>
             <div className="flex flex-col h-full space-y-3">
                <textarea 
                  value={userRetelling}
                  onChange={(e) => setUserRetelling(e.target.value)}
                  placeholder="凭记忆，尝试复述刚才的内容..."
                  className="flex-1 w-full bg-white border border-slate-200 rounded-[1.8rem] md:rounded-[2rem] p-4 md:p-10 text-sm md:text-xl leading-relaxed serif-font focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all resize-none min-h-[140px] md:min-h-[240px]"
                />
                <button 
                  onClick={handleEvaluate}
                  disabled={!userRetelling.trim() || isEvaluating}
                  className="w-full bg-slate-900 text-white py-3 md:py-4 rounded-2xl md:rounded-3xl font-bold shadow-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {isEvaluating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span className="text-xs md:text-base">🏛️ 提交演练报告</span>}
                </button>
             </div>
          </div>
        </div>
      )}

      {evaluation && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700 mt-4">
           <div className="bg-slate-900 rounded-[2rem] md:rounded-[3rem] p-5 md:p-12 text-white shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 gap-3">
                <h3 className="text-lg md:text-2xl font-bold serif-font flex items-center space-x-2">
                   <span className="p-1.5 bg-indigo-500/20 rounded-lg text-base">📊</span>
                   <span>演练评估报告</span>
                </h3>
                {!hasSaved ? (
                  <button 
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-lg active:scale-95"
                  >
                    🏛️ 存入收藏馆
                  </button>
                ) : (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center space-x-1.5 bg-emerald-400/10 px-3 py-1.5 rounded-xl border border-emerald-400/20">
                    <span>✅ 已入库</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                 <div className="space-y-4 md:space-y-8">
                    <div className="flex items-center justify-around">
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">还原度</p>
                          <div className={`text-3xl md:text-6xl font-black serif-font ${getGrade(evaluation.accuracyScore).color}`}>
                             {getGrade(evaluation.accuracyScore).label}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{evaluation.accuracyScore}%</p>
                       </div>
                       <div className="w-[1px] h-8 md:h-12 bg-slate-800"></div>
                       <div className="text-center">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-0.5">表现力</p>
                          <div className={`text-3xl md:text-6xl font-black serif-font ${getGrade(evaluation.qualityScore).color}`}>
                             {getGrade(evaluation.qualityScore).label}
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5">{evaluation.qualityScore}%</p>
                       </div>
                    </div>

                    <div className="space-y-2.5">
                       <div className="bg-white/5 p-3 md:p-4 rounded-xl border border-white/10">
                          <h4 className="text-[8px] font-black text-indigo-400 uppercase mb-0.5">内容 Content</h4>
                          <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed">{evaluation.contentFeedback}</p>
                       </div>
                       <div className="bg-white/5 p-3 md:p-4 rounded-xl border border-white/10">
                          <h4 className="text-[8px] font-black text-emerald-400 uppercase mb-0.5">语言 Language</h4>
                          <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed">{evaluation.languageFeedback}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest">馆长示范 Masterwork</h4>
                    <div className="bg-indigo-600/20 p-5 md:p-6 rounded-[1.5rem] md:rounded-[1.8rem] border border-indigo-500/30 text-indigo-100 italic serif-font text-sm md:text-lg leading-relaxed relative">
                       {renderRuby(evaluation.suggestedVersion)}
                    </div>
                    <div className="flex justify-center mt-3">
                       <button 
                         onClick={startNewSession}
                         className="px-6 py-2 bg-white text-slate-900 rounded-xl font-bold text-[10px] hover:bg-slate-50 transition-all active:scale-95 shadow-lg"
                       >
                         挑战下一个素材 Next
                       </button>
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
