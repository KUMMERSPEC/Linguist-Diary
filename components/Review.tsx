
import React, { useState } from 'react';
import { DiaryAnalysis, DiaryEntry } from '../types';

interface ReviewProps {
  entry: DiaryEntry;
  onSave: () => void;
  onDelete: (id: string) => void;
}

const Review: React.FC<ReviewProps> = ({ entry, onSave, onDelete }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'logic' | 'vocab'>('text');
  
  if (!entry.analysis) return null;
  const { analysis } = entry;

  const isSaved = entry.id.length > 15; 

  const renderDiffedText = (text: string) => {
    const parts = text.split(/(<rem>.*?<\/rem>|<add>.*?<\/add>)/g);
    return (
      <div className="leading-relaxed serif-font text-base md:text-xl space-y-4">
        {parts.map((part, i) => {
          if (part.startsWith('<rem>')) {
            const content = part.replace('<rem>', '').replace('</rem>', '');
            return (
              <span key={i} className="bg-red-50 text-red-500 line-through px-1 rounded-md mx-0.5 decoration-red-300">
                {content}
              </span>
            );
          } else if (part.startsWith('<add>')) {
            const content = part.replace('<add>', '').replace('</add>', '');
            return (
              <span key={i} className="bg-emerald-50 text-emerald-700 font-semibold px-1 rounded-md mx-0.5 border-b-2 border-emerald-300">
                {content}
              </span>
            );
          }
          return <span key={i} className="text-slate-700">{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-500 pb-24">
      <header className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-xl md:text-3xl font-bold text-slate-900 serif-font truncate tracking-tight">馆藏分析报告</h2>
          <p className="text-[10px] md:text-sm text-slate-500 truncate mt-0.5">从手稿片段到完整篇章的蜕变。</p>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          {isSaved && (
            <button 
              onClick={() => onDelete(entry.id)}
              className="bg-white border-2 border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 p-2.5 md:px-4 rounded-xl text-xs md:text-base font-bold transition-all active:scale-95 flex items-center space-x-1"
            >
              <span>🗑️</span>
              <span className="hidden md:inline">销毁</span>
            </button>
          )}
          
          {!isSaved && (
            <button 
              onClick={onSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs md:text-base font-bold shadow-md transition-all active:scale-95"
            >
              🏛️ 确认入馆
            </button>
          )}
        </div>
      </header>

      {/* 选项卡导航 */}
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
          <div className="space-y-6">
            {/* 1. 手稿修订区 */}
            <div className="bg-white p-6 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
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

            {/* 2. 最终整合成品区 */}
            <div className="bg-slate-900 p-8 md:p-12 rounded-[2.5rem] text-slate-300 border border-slate-800 shadow-2xl relative">
              <div className="absolute top-0 right-10 transform -translate-y-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Integrated Masterpiece
              </div>
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center space-x-2">
                <span>✨</span>
                <span>馆藏成品（合成后）</span>
              </h4>
              <p className="text-base md:text-2xl serif-font italic leading-relaxed text-white first-letter:text-4xl first-letter:font-bold first-letter:mr-1 first-letter:float-left">
                {analysis.modifiedText}
              </p>
              
              <div className="mt-8 pt-8 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="text-[10px] font-bold text-slate-500">逻辑已优化</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 serif-font italic">— Linguist Curator</span>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'logic' && (
          <div className="space-y-8">
            {/* 衔接建议区块 */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 flex items-center space-x-2">
                <span>🧠</span>
                <span>逻辑衔接建议 (Transitions)</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.transitionSuggestions.map((item, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-shadow group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-black text-indigo-600 group-hover:scale-110 transition-transform origin-left">{item.word}</span>
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">CONNECTIVE</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-3 leading-relaxed">{item.explanation}</p>
                    <div className="bg-slate-50 p-3 rounded-xl border-l-2 border-indigo-200">
                      <p className="text-[11px] text-slate-500 italic">“ {item.example} ”</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 批注明细区块 */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 flex items-center space-x-2">
                <span>⚖️</span>
                <span>语言点深度批注</span>
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {analysis.corrections.map((corr, idx) => (
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
                        <span className="text-xs text-slate-400 line-through truncate">{corr.original}</span>
                        <span className="hidden md:block text-slate-300">→</span>
                        <span className="text-sm font-bold text-indigo-600">{corr.improved}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{corr.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 总结反馈 */}
            <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 flex items-start space-x-4">
              <div className="text-3xl">💡</div>
              <div>
                <h5 className="font-bold text-indigo-900 text-sm mb-1">馆长总评 (Overall)</h5>
                <p className="text-indigo-800 italic leading-relaxed text-sm md:text-base serif-font">
                  {analysis.overallFeedback}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis.advancedVocab.map((vocab, idx) => (
              <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm hover:border-indigo-300 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{vocab.word}</h5>
                  <span className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-bold tracking-widest ${
                    vocab.level === 'Native' ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
                  }`}>{vocab.level}</span>
                </div>
                <div className="space-y-3">
                  <p className="text-slate-800 font-bold text-sm bg-slate-50 px-3 py-2 rounded-xl">{vocab.meaning}</p>
                  <div className="relative">
                    <span className="absolute -left-2 top-0 text-indigo-200 text-2xl font-serif">“</span>
                    <p className="text-slate-500 italic text-[11px] pl-4 leading-relaxed">
                      {vocab.usage}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
