
import React, { useState, useEffect } from 'react';

interface EditorProps {
  onAnalyze: (text: string, language: string) => void;
  onSaveDraft: (text: string, language: string) => void; // New: Save raw text
  isLoading: boolean;
  initialText?: string;
  initialLanguage?: string;
  summaryPrompt?: string;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const Editor: React.FC<EditorProps> = ({ onAnalyze, onSaveDraft, isLoading, initialText = '', initialLanguage = 'English', summaryPrompt }) => {
  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState(initialLanguage);

  useEffect(() => {
    setText(initialText);
    setLanguage(initialLanguage);
  }, [initialText, initialLanguage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) return;
    onAnalyze(text, language);
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="mb-4 space-y-3 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">
            {initialText ? '🏛️ 迭代打磨 Refinement' : '✨ 开启撰写 New Artifact'}
          </h2>
          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase opacity-60">Curator's Studio</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold transition-all border ${
                  language === lang.code 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
        {summaryPrompt && (
          <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-[2rem] animate-in fade-in slide-in-from-top-2 duration-700">
             <div className="flex items-center space-x-2 mb-2">
               <span className="text-lg">💡</span>
               <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">馆长灵感 Curator's Muse</h4>
             </div>
             <p className="text-sm text-indigo-800/80 leading-relaxed italic serif-font">“ {summaryPrompt} ”</p>
          </div>
        )}

        <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 transition-all flex flex-col min-h-[300px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天您想用语言记录些什么？"
            className="flex-1 w-full border-none focus:ring-0 p-8 md:p-14 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-300"
            disabled={isLoading}
          />
          <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Editor's Canvas</span>
            <span className="text-[10px] font-black text-slate-300">{text.length} chars</span>
          </div>
        </div>
        
        <footer className="flex items-center justify-end space-x-4 shrink-0 mt-4">
          <button 
            type="button"
            onClick={() => onSaveDraft(text, language)}
            disabled={text.trim().length < 10 || isLoading}
            className="px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 border-2 border-slate-100 hover:bg-slate-50 transition-all"
          >
            存入草稿 DRAFT
          </button>
          <button 
            type="submit"
            disabled={text.trim().length < 10 || isLoading}
            className="bg-indigo-600 text-white px-8 py-4 rounded-3xl text-lg font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              '✨ AI 智能校对 ANALYZE'
            )}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default Editor;
