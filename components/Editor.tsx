
import React, { useState, useEffect } from 'react';

interface EditorProps {
  onAnalyze: (text: string, language: string) => void;
  isLoading: boolean;
  initialText?: string;
  initialLanguage?: string;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const Editor: React.FC<EditorProps> = ({ onAnalyze, isLoading, initialText = '', initialLanguage = 'English' }) => {
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
    <div className="flex flex-col h-full max-h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="mb-4 space-y-3 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">
            {initialText ? '🏛️ 迭代打磨 Refinement' : '✨ 开启撰写 New Artifact'}
          </h2>
          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase opacity-60">Curator's Studio</span>
        </div>
        
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-0.5 -mx-3 px-3 md:mx-0 md:px-0">
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
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* 输入框容器 */}
        <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 transition-all flex flex-col">
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
        
        <footer className="mt-6 flex justify-end shrink-0">
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
