
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

  // Function to parse <rem> and <add> tags into styled React elements
  const renderDiffedText = (text: string) => {
    const parts = text.split(/(<rem>.*?<\/rem>|<add>.*?<\/add>)/g);
    
    return (
      <div className="leading-relaxed serif-font text-lg md:text-xl">
        {parts.map((part, i) => {
          if (part.startsWith('<rem>')) {
            const content = part.replace('<rem>', '').replace('</rem>', '');
            return (
              <span key={i} className="bg-red-100 text-red-700 line-through px-1 rounded mx-0.5 decoration-red-400">
                {content}
              </span>
            );
          } else if (part.startsWith('<add>')) {
            const content = part.replace('<add>', '').replace('</add>', '');
            return (
              <span key={i} className="bg-emerald-100 text-emerald-800 font-bold px-1 rounded mx-0.5 border-b-2 border-emerald-400">
                {content}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-12">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">分析馆</h2>
          <p className="text-slate-500">查看 AI 的实时修订标记与进阶建议。</p>
        </div>
        <button 
          onClick={onSave}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-medium shadow-lg shadow-emerald-100 transition-all flex items-center space-x-2"
        >
          <span>💾 保存到收藏馆</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-2xl w-fit">
        {[
          { id: 'text', label: '修订对比', icon: '🎨' },
          { id: 'corrections', label: '修改原因', icon: '🔍' },
          { id: 'vocab', label: '进阶词汇', icon: '💎' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'text' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">批注视图 (Annotated View)</h4>
                <div className="flex items-center space-x-4 text-xs font-bold">
                  <span className="flex items-center"><span className="w-3 h-3 bg-red-200 rounded-sm mr-1.5"></span>删除/错误</span>
                  <span className="flex items-center"><span className="w-3 h-3 bg-emerald-200 rounded-sm mr-1.5"></span>新增/修正</span>
                </div>
              </div>
              
              {renderDiffedText(analysis.diffedText)}
              
              <div className="mt-10 pt-8 border-t border-slate-100">
                <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                  <p className="text-indigo-900 font-semibold mb-2 flex items-center">
                    <span className="mr-2">💡</span> 馆长评语
                  </p>
                  <p className="text-indigo-800 italic leading-relaxed">
                    {analysis.overallFeedback}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-8 rounded-3xl border border-slate-200">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">最终定稿 (Final Version)</h4>
              <p className="text-lg text-slate-600 serif-font italic">
                "{analysis.modifiedText}"
              </p>
            </div>
          </div>
        )}

        {activeTab === 'corrections' && (
          <div className="space-y-4">
            {analysis.corrections.map((corr, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all">
                <div className="flex items-start justify-between mb-4">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                    corr.category === 'Grammar' ? 'bg-orange-50 text-orange-600' :
                    corr.category === 'Vocabulary' ? 'bg-blue-50 text-blue-600' :
                    corr.category === 'Style' ? 'bg-purple-50 text-purple-600' :
                    'bg-slate-50 text-slate-600'
                  }`}>
                    {corr.category}
                  </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-8">
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1 line-through">{corr.original}</p>
                    <p className="text-lg font-bold text-indigo-600">{corr.improved}</p>
                  </div>
                  <div className="flex-[2] bg-slate-50 p-4 rounded-xl text-sm text-slate-600 leading-relaxed border-l-4 border-indigo-200">
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
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-indigo-300 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-2xl font-bold text-indigo-600">{vocab.word}</h5>
                    <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-1 rounded-full font-bold">{vocab.level}</span>
                  </div>
                  <p className="text-slate-800 font-medium mb-4">{vocab.meaning}</p>
                  <div className="bg-slate-50 p-4 rounded-2xl italic text-slate-600 text-sm border border-transparent group-hover:border-indigo-100 transition-all">
                    " {vocab.usage} "
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
