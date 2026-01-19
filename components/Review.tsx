
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
    // Regular expression to catch <rem> and <add> tags
    const parts = text.split(/(<rem>.*?<\/rem>|<add>.*?<\/add>)/g);
    
    return (
      <div className="leading-relaxed serif-font text-lg md:text-2xl space-y-4">
        {parts.map((part, i) => {
          if (part.startsWith('<rem>')) {
            const content = part.replace('<rem>', '').replace('</rem>', '');
            return (
              <span key={i} className="bg-red-50 text-red-500 line-through px-1.5 py-0.5 rounded-md mx-0.5 decoration-red-300 decoration-2 transition-all hover:bg-red-100">
                {content}
              </span>
            );
          } else if (part.startsWith('<add>')) {
            const content = part.replace('<add>', '').replace('</add>', '');
            return (
              <span key={i} className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-md mx-0.5 border-b-2 border-emerald-300 transition-all hover:bg-emerald-100">
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
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 serif-font">藏品评估报告</h2>
          <p className="text-slate-500 mt-1">语言艺术的精雕细琢，让每一句记录都更具生命力。</p>
        </div>
        <button 
          onClick={onSave}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all flex items-center space-x-2 active:scale-95 w-full md:w-auto justify-center"
        >
          <span className="text-xl">🏛️</span>
          <span>存入博物馆</span>
        </button>
      </header>

      {/* Modern Tab Switcher */}
      <div className="flex space-x-1 bg-slate-200/40 p-1.5 rounded-[1.5rem] w-full md:w-fit border border-slate-200/50">
        {[
          { id: 'text', label: '修订对比', icon: '🖋️' },
          { id: 'corrections', label: '逻辑溯源', icon: '🧠' },
          { id: 'vocab', label: '辞藻进阶', icon: '💎' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'text' && (
          <div className="space-y-6">
            <div className="bg-white p-8 md:p-14 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              {/* Subtle background texture */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/30 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex items-center justify-between mb-10">
                <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Provenance Analysis</h4>
                <div className="flex items-center space-x-6 text-[10px] font-bold text-slate-400">
                  <span className="flex items-center"><span className="w-2.5 h-2.5 bg-red-100 rounded-full mr-2"></span>DELETED</span>
                  <span className="flex items-center"><span className="w-2.5 h-2.5 bg-emerald-100 rounded-full mr-2"></span>ENHANCED</span>
                </div>
              </div>
              
              <div className="relative z-10">
                {renderDiffedText(analysis.diffedText)}
              </div>
              
              <div className="mt-12 pt-10 border-t border-slate-100">
                <div className="bg-indigo-50/40 rounded-3xl p-8 border border-indigo-100/50">
                  <p className="text-indigo-900 font-bold mb-3 flex items-center">
                    <span className="mr-2 text-xl">💡</span> 馆长寄语 (Feedback)
                  </p>
                  <p className="text-indigo-800 italic leading-relaxed text-base md:text-lg serif-font">
                    {analysis.overallFeedback}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2rem] text-slate-300 border border-slate-800 shadow-2xl">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Final Masterpiece</h4>
              <p className="text-lg md:text-xl serif-font italic leading-relaxed text-white">
                "{analysis.modifiedText}"
              </p>
            </div>
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="grid grid-cols-1 gap-4">
            {analysis.corrections.map((corr, idx) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all flex flex-col md:flex-row gap-6">
                <div className="shrink-0">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                    corr.category === 'Grammar' ? 'bg-orange-50 text-orange-500' :
                    corr.category === 'Vocabulary' ? 'bg-blue-50 text-blue-500' :
                    corr.category === 'Style' ? 'bg-purple-50 text-purple-500' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {corr.category === 'Grammar' ? '⚖️' : corr.category === 'Vocabulary' ? '📖' : corr.category === 'Style' ? '🎭' : '✏️'}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                    <p className="text-sm text-slate-400 line-through italic">{corr.original}</p>
                    <span className="hidden sm:inline text-slate-300">→</span>
                    <p className="text-lg font-bold text-indigo-600">{corr.improved}</p>
                  </div>
                  <div className="bg-slate-50/80 p-5 rounded-2xl text-sm text-slate-600 leading-relaxed border-l-4 border-indigo-500/30">
                    {corr.explanation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {analysis.advancedVocab.map((vocab, idx) => (
              <div key={idx} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ring-1 ring-black/5">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h5 className="text-2xl font-black text-indigo-600 tracking-tight">{vocab.word}</h5>
                    <span className="text-[10px] bg-indigo-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">{vocab.level}</span>
                  </div>
                  <div className="space-y-4">
                    <p className="text-slate-800 font-bold text-lg leading-snug">{vocab.meaning}</p>
                    <div className="relative">
                       <div className="absolute left-0 top-0 w-1 h-full bg-indigo-100 rounded-full"></div>
                       <p className="pl-6 text-slate-500 italic text-sm leading-relaxed serif-font">
                         " {vocab.usage} "
                       </p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-4 border-t border-slate-50 flex justify-end">
                   <span className="text-[10px] font-bold text-slate-300 group-hover:text-indigo-400 transition-colors uppercase tracking-widest">Mastery Tip</span>
                </div>
              </div>
            ))}
            {analysis.advancedVocab.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">当前篇章词汇已达巅峰，暂无建议。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Review;
