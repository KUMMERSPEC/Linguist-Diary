
import React, { useState } from 'react';
import { DiaryAnalysis, DiaryEntry } from '../types';

interface ReviewProps {
  entry: DiaryEntry;
  onSave: () => void;
}

const Review: React.FC<ReviewProps> = ({ entry, onSave }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'corrections' | 'vocab'>('text');
  
  if (!entry.analysis) return null;
  const { analysis } = entry;

  const renderDiffedText = (text: string) => {
    const parts = text.split(/(<rem>.*?<\/rem>|<add>.*?<\/add>)/g);
    return (
      <div className="leading-relaxed serif-font text-base md:text-2xl space-y-3">
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
              <span key={i} className="bg-emerald-50 text-emerald-700 font-semibold px-1 rounded-md mx-0.5 border-b border-emerald-300">
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
    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-500 pb-10">
      <header className="flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-lg md:text-3xl font-bold text-slate-900 serif-font truncate">评估报告</h2>
          <p className="text-[10px] md:text-sm text-slate-500 truncate mt-0.5">记录生命力的精雕细琢。</p>
        </div>
        <button 
          onClick={onSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs md:text-base font-bold shadow-md transition-all active:scale-95 flex-shrink-0"
        >
          🏛️ 存入博物馆
        </button>
      </header>

      {/* Tab Switcher: Reduced size */}
      <div className="flex space-x-1 bg-slate-200/40 p-1 rounded-xl w-full md:w-fit border border-slate-200/50">
        {[
          { id: 'text', label: '修订', icon: '🖋️' },
          { id: 'corrections', label: '逻辑', icon: '🧠' },
          { id: 'vocab', label: '进阶', icon: '💎' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <div className="bg-white p-5 md:p-14 rounded-2xl md:rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-6 md:mb-10">
                <h4 className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">Analysis</h4>
                <div className="flex items-center space-x-4 text-[8px] md:text-[10px] font-bold text-slate-400">
                  <span className="flex items-center"><span className="w-2 h-2 bg-red-100 rounded-full mr-1.5"></span>DEL</span>
                  <span className="flex items-center"><span className="w-2 h-2 bg-emerald-100 rounded-full mr-1.5"></span>ADD</span>
                </div>
              </div>
              
              <div className="relative z-10">
                {renderDiffedText(analysis.diffedText)}
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="bg-indigo-50/40 rounded-xl p-4 border border-indigo-100/50">
                  <p className="text-indigo-900 font-bold text-xs mb-1">💡 馆长寄语</p>
                  <p className="text-indigo-800 italic leading-relaxed text-sm md:text-lg serif-font">
                    {analysis.overallFeedback}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-5 rounded-xl text-slate-300 border border-slate-800">
              <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Final Masterpiece</h4>
              <p className="text-sm md:text-xl serif-font italic leading-relaxed text-white">
                "{analysis.modifiedText}"
              </p>
            </div>
          </div>
        )}
        
        {/* ... (Corrections and Vocab sections already fit reasonably well as they use grid/scroll) ... */}
        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 gap-3">
            {analysis.corrections.map((corr, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                   <div className="text-sm">⚖️</div>
                   <span className="text-[10px] font-bold text-indigo-400 uppercase">{corr.category}</span>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 line-through italic">{corr.original}</p>
                  <p className="text-sm font-bold text-indigo-600">{corr.improved}</p>
                  <p className="text-[11px] text-slate-600 bg-slate-50 p-3 rounded-lg border-l-2 border-indigo-500">{corr.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 gap-4">
            {analysis.advancedVocab.map((vocab, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-lg font-black text-indigo-600">{vocab.word}</h5>
                  <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase">{vocab.level}</span>
                </div>
                <p className="text-slate-800 font-bold text-sm mb-2">{vocab.meaning}</p>
                <p className="text-slate-500 italic text-[11px] border-l-2 border-indigo-100 pl-3">" {vocab.usage} "</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
