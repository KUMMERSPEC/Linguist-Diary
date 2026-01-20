
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

interface RehearsalProps {
  onSaveToMuseum?: (language: string, result: RehearsalEvaluation) => void;
}

const Rehearsal: React.FC<RehearsalProps> = ({ onSaveToMuseum }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
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

  const startNewSession = async () => {
    setIsGenerating(true);
    setSourceText('');
    setUserRetelling('');
    setEvaluation(null);
    setShowSource(true);
    setHasSaved(false);
    try {
      const text = await generatePracticeArtifact(language.code, keywords.trim());
      setSourceText(text);
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
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioCtx.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 max-w-4xl mx-auto">
      <header className="flex flex-col space-y-2">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">展厅演练 Rehearsal</h2>
        <p className="text-slate-500 text-sm">通过复述“短小精悍”的文物描述，轻松开启今日练习。</p>
      </header>

      {/* 控制面板：语言选择与词汇指令 */}
      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setLanguage(lang); setSourceText(''); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  language.code === lang.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-slate-50 border-transparent text-slate-500'
                }`}
              >
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
          
          <button 
            onClick={startNewSession}
            disabled={isGenerating}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2 active:scale-95 disabled:bg-slate-200"
          >
            {isGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
              <>
                <span>{keywords.trim() ? '🪄 定制演练材料' : '✨ 获取 50 字素材'}</span>
              </>
            )}
          </button>
        </div>

        {/* 词汇指定输入框 */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 text-xs">
             🏷️ <span className="ml-2 font-bold uppercase tracking-wider opacity-50">指定词汇:</span>
          </div>
          <input 
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="输入想练习的词汇（如：故郷, 懐かしい）..."
            className="w-full pl-28 pr-4 py-3 bg-slate-50 border-2 border-slate-50 rounded-2xl text-xs font-medium focus:bg-white focus:border-indigo-100 transition-all outline-none"
          />
          {keywords && (
            <button 
              onClick={() => setKeywords('')}
              className="absolute inset-y-0 right-4 flex items-center text-slate-300 hover:text-slate-500 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!sourceText && !isGenerating ? (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
          <div className="text-5xl mb-4 opacity-20">🎭</div>
          <p className="text-slate-400 font-bold">在上方输入词汇或直接点击获取素材。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：原始素材 */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Artifact</span>
                <div className="flex items-center space-x-2">
                   <button onClick={() => setShowSource(!showSource)} className="text-[10px] font-bold text-indigo-600 hover:underline">
                      {showSource ? '🙈 隐藏原文' : '👁️ 显示原文'}
                   </button>
                   <button onClick={handlePlayAudio} className={`text-sm ${isPlaying ? 'text-indigo-600 scale-125' : 'text-slate-400'} transition-all`}>
                      {isPlaying ? '⏹' : '🎧'}
                   </button>
                </div>
             </div>
             <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative min-h-[200px] flex items-center justify-center text-center transition-all duration-700 ${!showSource ? 'blur-xl grayscale select-none' : ''}`}>
                <p className="text-lg md:text-xl text-slate-700 leading-relaxed serif-font italic">
                  “ {sourceText} ”
                </p>
                {!showSource && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-slate-900/10 backdrop-blur-md px-6 py-2 rounded-full font-bold text-slate-800 text-sm">帘幕已拉下</div>
                  </div>
                )}
             </div>
          </div>

          {/* 右侧：用户复述 */}
          <div className="space-y-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Your Retelling</span>
             <div className="flex flex-col h-full space-y-4">
                <textarea 
                  value={userRetelling}
                  onChange={(e) => setUserRetelling(e.target.value)}
                  placeholder="凭记忆，用几句话复述刚才的内容..."
                  className="flex-1 w-full bg-white border border-slate-200 rounded-[2.5rem] p-8 text-lg md:text-xl leading-relaxed serif-font focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none min-h-[200px]"
                />
                <button 
                  onClick={handleEvaluate}
                  disabled={!userRetelling.trim() || isEvaluating}
                  className="w-full bg-slate-900 text-white py-4 rounded-3xl font-bold shadow-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {isEvaluating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>🏛️ 提交演练报告</span>}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* 评估结果显示 (保持原样) */}
      {evaluation && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-700">
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5 text-9xl font-serif">A</div>
              
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold serif-font flex items-center space-x-3">
                   <span className="p-2 bg-indigo-50 rounded-xl text-xl">📊</span>
                   <span>演练评估报告 Evaluation</span>
                </h3>
                {!hasSaved ? (
                  <button 
                    onClick={handleSave}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95"
                  >
                    🏛️ 存入收藏馆
                  </button>
                ) : (
                  <span className="text-emerald-400 text-xs font-bold flex items-center space-x-2 bg-emerald-400/10 px-4 py-2 rounded-xl border border-emerald-400/20">
                    <span>✅ 已作为馆藏入库</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 {/* 评分仪表盘 */}
                 <div className="space-y-8">
                    <div className="flex items-center justify-around">
                       <div className="text-center group">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">内容还原度</p>
                          <div className={`text-6xl font-black serif-font ${getGrade(evaluation.accuracyScore).color} transition-all duration-500 group-hover:scale-110`}>
                             {getGrade(evaluation.accuracyScore).label}
                          </div>
                          <p className="text-sm font-bold text-slate-400 mt-2">{evaluation.accuracyScore}%</p>
                       </div>
                       <div className="w-[1px] h-16 bg-slate-800"></div>
                       <div className="text-center group">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">语言表现力</p>
                          <div className={`text-6xl font-black serif-font ${getGrade(evaluation.qualityScore).color} transition-all duration-500 group-hover:scale-110`}>
                             {getGrade(evaluation.qualityScore).label}
                          </div>
                          <p className="text-sm font-bold text-slate-400 mt-2">{evaluation.qualityScore}%</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center">
                             <span className="mr-2">🧩</span> 内容建议 Content
                          </h4>
                          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.contentFeedback}</p>
                       </div>
                       <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                          <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center">
                             <span className="mr-2">🖋️</span> 表达建议 Language
                          </h4>
                          <p className="text-sm text-slate-300 leading-relaxed">{evaluation.languageFeedback}</p>
                       </div>
                    </div>
                 </div>

                 {/* 专家示范 */}
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">馆长推荐复述 Masterwork Retelling</h4>
                    </div>
                    <div className="bg-indigo-600/20 p-8 rounded-[2.5rem] border border-indigo-500/30 text-indigo-100 italic serif-font text-lg leading-relaxed relative">
                       <span className="absolute -top-4 -left-2 text-6xl text-indigo-500/20">“</span>
                       {evaluation.suggestedVersion}
                    </div>
                    <div className="flex justify-center mt-6">
                       <button 
                         onClick={startNewSession}
                         className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all active:scale-95 shadow-lg"
                       >
                         挑战下一个素材 Next Challenge
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
