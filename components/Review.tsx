import React, { useState, useRef } from 'react';
import { DiaryAnalysis, DiaryEntry, RehearsalEvaluation } from '../types';
import { generateDiaryAudio } from '../services/geminiService';

interface ReviewProps {
  entry: DiaryEntry;
  onSave: () => void;
  onDelete: (id: string) => void;
}

const Review: React.FC<ReviewProps> = ({ entry, onSave, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'logic' | 'vocab'>('text');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  
  const isSaved = !entry.id.startsWith('temp_'); 

  const handlePlayAudio = async (text: string) => {
    if (isPlaying) {
      audioSourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    setIsAudioLoading(true);
    try {
      const base64Audio = await generateDiaryAudio(text);
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
    } catch (error) {
      console.error(error);
      alert("音频生成失败。");
    } finally {
      setIsAudioLoading(false);
    }
  };

  const renderRuby = (input: string) => {
    if (!input) return "";
    const rubyRegex = /\[(.*?)\]\((.*?)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = rubyRegex.exec(input)) !== null) {
      if (match.index > lastIndex) parts.push(input.substring(lastIndex, match.index));
      parts.push(
        <ruby key={match.index} className="mx-[1px]">
          {match[1]}<rt className="text-[10px] md:text-[11px] opacity-60 font-medium select-none text-indigo-500/80">{match[2]}</rt>
        </ruby>
      );
      lastIndex = rubyRegex.lastIndex;
    }
    if (lastIndex < input.length) parts.push(input.substring(lastIndex));
    return parts.length > 0 ? parts : input;
  };

  const renderDiffedText = (text: string) => {
    if (!text) return null;
    let healedText = text.replace(/-?\[?([^-[\]{}]+)-\]?/g, '<rem>$1</rem>').replace(/\{\+?\s?([^\}]+)\+?\}/g, '<add>$1</add>').replace(/\]\{/g, '');
    const parts = healedText.split(/(<rem>.*?<\/rem>|<add>.*?<\/add>)/gs);
    return (
      <div className="leading-[2.5] md:leading-[3] serif-font text-base md:text-xl space-y-4">
        {parts.map((part, i) => {
          if (part.startsWith('<rem>')) {
            const content = part.replace('<rem>', '').replace('</rem>', '');
            return <span key={i} className="bg-red-50 text-red-500 line-through px-1 rounded-md mx-0.5 decoration-red-300">{renderRuby(content)}</span>;
          } else if (part.startsWith('<add>')) {
            const content = part.replace('<add>', '').replace('</add>', '');
            return <span key={i} className="bg-emerald-50 text-emerald-700 font-semibold px-1 rounded-md mx-0.5 border-b-2 border-emerald-300">{renderRuby(content)}</span>;
          }
          return <span key={i} className="text-slate-700">{renderRuby(part)}</span>;
        })}
      </div>
    );
  };

  if (entry.type === 'rehearsal' && entry.rehearsal) {
    const rev = entry.rehearsal;
    const getGrade = (score: number) => {
      if (score >= 90) return { label: 'S', color: 'text-indigo-400' };
      if (score >= 80) return { label: 'A', color: 'text-emerald-400' };
      if (score >= 70) return { label: 'B', color: 'text-orange-400' };
      return { label: 'C', color: 'text-slate-400' };
    };

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-500 pb-24 max-w-4xl mx-auto">
        <header className="flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl md:text-3xl font-bold text-slate-900 serif-font truncate tracking-tight">演练评估报告</h2>
            <p className="text-[10px] md:text-sm text-slate-500 truncate mt-0.5">{entry.date} · {entry.language}</p>
          </div>
          <button 
            onClick={() => onDelete(entry.id)}
            className="bg-white border-2 border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 p-2.5 rounded-xl transition-all active:scale-95"
          >
            🗑️
          </button>
        </header>

        <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="flex items-center justify-around">
                   <div className="text-center group">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">内容还原度</p>
                      <div className={`text-6xl font-black serif-font ${getGrade(rev.accuracyScore).color}`}>
                         {getGrade(rev.accuracyScore).label}
                      </div>
                      <p className="text-sm font-bold text-slate-400 mt-2">{rev.accuracyScore}%</p>
                   </div>
                   <div className="w-[1px] h-16 bg-slate-800"></div>
                   <div className="text-center group">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">语言表现力</p>
                      <div className={`text-6xl font-black serif-font ${getGrade(rev.qualityScore).color}`}>
                         {getGrade(rev.qualityScore).label}
                      </div>
                      <p className="text-sm font-bold text-slate-400 mt-2">{rev.qualityScore}%</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                      <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">🧩 内容建议</h4>
                      <p className="text-sm text-slate-300 leading-relaxed">{rev.contentFeedback}</p>
                   </div>
                   <div className="bg-white/5 p-5 rounded-2xl border border-white/10">
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">🖋️ 表达建议</h4>
                      <p className="text-sm text-slate-300 leading-relaxed">{rev.languageFeedback}</p>
                   </div>
                </div>
              </div>

              <div className="space-y-6">
                 <div>
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">原始素材 Original</h4>
                   <p className="text-sm text-slate-400 italic bg-white/5 p-4 rounded-xl border border-white/5 leading-relaxed">{rev.sourceText}</p>
                 </div>
                 <div>
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">您的复述 Retelling</h4>
                   <p className="text-sm text-slate-100 bg-white/10 p-4 rounded-xl border border-white/10 leading-relaxed">{rev.userRetelling}</p>
                 </div>
                 <div>
                   <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">馆长建议示范 Masterwork</h4>
                   <div className="bg-indigo-600/20 p-6 rounded-2xl border border-indigo-500/30 text-indigo-100 italic serif-font leading-relaxed">
                      {rev.suggestedVersion}
                   </div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (!entry.analysis) return null;
  const { analysis } = entry;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-500 pb-24">
      <header className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-xl md:text-3xl font-bold text-slate-900 serif-font truncate tracking-tight">馆藏分析报告</h2>
          <p className="text-[10px] md:text-sm text-slate-500 truncate mt-0.5">记录生命的每一次精准表达。</p>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          {isSaved ? (
            <button 
              onClick={() => onDelete(entry.id)}
              className="bg-white border-2 border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 p-2.5 md:px-4 rounded-xl text-xs md:text-base font-bold transition-all active:scale-95 flex items-center space-x-1"
            >
              <span>🗑️</span>
              <span className="hidden md:inline">销毁</span>
            </button>
          ) : (
            <button 
              onClick={onSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs md:text-base font-bold shadow-md transition-all active:scale-95"
            >
              🏛️ 确认入馆
            </button>
          )}
        </div>
      </header>

      <div className="flex space-x-1 bg-slate-200/40 p-1 rounded-2xl w-full md:w-fit border border-slate-200/50">
        {[
          { id: 'text', label: '文稿修订', icon: '🖋️' },
          { id: 'logic', label: '衔接逻辑', icon: '🧠' },
          { id: 'vocab', label: '表达进阶', icon: '💎' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === 'text' && (
          <div className="space-y-12 mt-8">
            <div className="bg-white p-6 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-2">
                  <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Original Manuscript Diff</h4>
                </div>
                <div className="flex items-center space-x-4 text-[9px] font-bold text-slate-400">
                  <span className="flex items-center"><span className="w-2.5 h-2.5 bg-red-100 rounded-sm mr-1.5"></span>删除</span>
                  <span className="flex items-center"><span className="w-2.5 h-2.5 bg-emerald-100 rounded-sm mr-1.5"></span>修正</span>
                </div>
              </div>
              
              <div className="relative z-10 border-l-2 border-slate-100 pl-6 md:pl-10">
                {renderDiffedText(analysis.diffedText)}
              </div>
            </div>

            <div className="bg-slate-900 p-8 md:p-12 rounded-[2.5rem] text-slate-300 border border-slate-800 shadow-2xl relative">
              <div className="absolute top-0 right-10 transform -translate-y-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg z-20">
                Integrated Masterpiece
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 mt-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center space-x-2">
                  <span>✨</span>
                  <span>馆藏成品（附假名注音）</span>
                </h4>
                
                <button
                  onClick={() => handlePlayAudio(analysis.modifiedText)}
                  disabled={isAudioLoading}
                  className={`flex items-center space-x-3 px-5 py-2.5 rounded-2xl transition-all font-bold text-xs shadow-lg ${
                    isPlaying 
                    ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20' 
                    : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isAudioLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <span className="text-lg">{isPlaying ? '⏹️' : '🎧'}</span>
                  )}
                  <span>{isPlaying ? '正在朗读...' : '有声朗读'}</span>
                </button>
              </div>

              <div className="text-base md:text-2xl serif-font italic leading-[2.5] md:leading-[3] text-white">
                {renderRuby(analysis.modifiedText)}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'logic' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 flex items-center space-x-2">
                <span>🧠</span>
                <span>逻辑衔接建议 (Transitions)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.transitionSuggestions?.map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-black text-indigo-600 group-hover:scale-110 transition-transform origin-left">{renderRuby(item.word)}</span>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">CONNECTIVE</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-3 leading-relaxed">{item.explanation}</p>
                    <div className="bg-slate-50 p-3 rounded-xl border-l-2 border-indigo-200">
                      <p className="text-[11px] text-slate-500 italic">“ {renderRuby(item.example)} ”</p>
                    </div>
                  </div>
                ))}
                {(!analysis.transitionSuggestions || analysis.transitionSuggestions.length === 0) && (
                   <p className="col-span-full text-center py-10 text-slate-400 text-xs italic">馆长认为本篇逻辑通顺，无需额外衔接词。</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 flex items-center space-x-2">
                <span>⚖️</span>
                <span>语言点深度批注</span>
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {analysis.corrections?.map((corr, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-start gap-4">
                    <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase text-center shrink-0 min-w-[70px] ${
                      corr.category === 'Grammar' ? 'bg-red-50 text-red-600' :
                      corr.category === 'Vocabulary' ? 'bg-blue-50 text-blue-600' :
                      'bg-slate-50 text-slate-600'
                    }`}>
                      {corr.category}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col md:flex-row md:items-center gap-2">
                        <span className="text-xs text-slate-400 line-through truncate">{renderRuby(corr.original)}</span>
                        <span className="hidden md:block text-slate-300">→</span>
                        <span className="text-sm font-bold text-indigo-600">{renderRuby(corr.improved)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{corr.explanation}</p>
                    </div>
                  </div>
                ))}
                {(!analysis.corrections || analysis.corrections.length === 0) && (
                   <p className="text-center py-10 text-slate-400 text-xs italic">无明显语言瑕疵，表现完美。</p>
                )}
              </div>
            </div>

            {/* 改进：馆长总评区域 - 增加“记忆共鸣”视觉效果 */}
            <div className="relative overflow-hidden bg-white p-1 rounded-[2.5rem] border border-indigo-100 shadow-sm">
              <div className="bg-indigo-50/40 p-8 rounded-[2.4rem] flex flex-col md:flex-row items-start space-y-4 md:space-y-0 md:space-x-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm text-3xl shrink-0 border border-indigo-50">🔗</div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-bold text-indigo-900 text-sm">馆长观察：记忆共鸣 (Memory Resonance)</h5>
                    <span className="animate-pulse bg-indigo-500 w-2 h-2 rounded-full"></span>
                  </div>
                  <p className="text-indigo-800 italic leading-relaxed text-sm md:text-base serif-font">
                    {analysis.overallFeedback}
                  </p>
                </div>
              </div>
              {/* 背景装饰 */}
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-200/20 rounded-full blur-3xl"></div>
            </div>
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.advancedVocab?.map((vocab, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-indigo-300 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{renderRuby(vocab.word)}</h5>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-bold tracking-widest ${
                    vocab.level === 'Native' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
                  }`}>{vocab.level}</span>
                </div>
                <div className="space-y-3">
                  <p className="text-slate-800 font-bold text-sm bg-slate-50 px-3 py-2 rounded-xl">{vocab.meaning}</p>
                  <div className="relative">
                    <span className="absolute -left-2 top-0 text-indigo-200 text-2xl font-serif">“</span>
                    <p className="text-slate-500 italic text-[11px] pl-4 leading-relaxed">
                      {renderRuby(vocab.usage)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {(!analysis.advancedVocab || analysis.advancedVocab.length === 0) && (
              <p className="col-span-full text-center py-20 text-slate-400 text-xs italic">本篇未提取出进阶词汇，可以尝试写得更复杂一些。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;