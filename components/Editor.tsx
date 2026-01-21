
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
        {/* 输入框容器：通过 overflow-hidden 确保内部元素不溢出大圆角 */}
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all focus-within:ring-4 focus-within:ring-indigo-500/5 focus-within:border-indigo-200 min-h-[200px] mb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={initialText ? "打磨当前的语言藏品，追求表达之美..." : "记录您的语言点滴，开启馆藏之旅..."}
            className="w-full flex-1 resize-none border-none focus:ring-0 p-6 md:p-10 text-slate-700 text-base md:text-xl leading-relaxed serif-font placeholder:text-slate-300 bg-transparent"
            disabled={isLoading}
          />
          
          <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
               <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{language} — {initialText ? 'REFINE MODE' : 'COLLECTION DRAFT'}</span>
            </div>
            <span className={`text-[9px] font-black tracking-tighter ${text.length < 10 ? 'text-slate-300' : 'text-indigo-600'}`}>
              {text.length} <span className="opacity-30">/ MIN 10</span>
            </span>
          </div>
        </div>

        <div className="shrink-0">
          <button 
            type="submit" 
            disabled={isLoading || text.length < 10} 
            className={`w-full py-4 md:py-5 rounded-[1.5rem] font-bold flex items-center justify-center space-x-3 transition-all active:scale-[0.98] ${
              isLoading 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700'
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-indigo-500" />
            ) : (
              <span className="text-sm md:text-lg">
                {initialText ? '✨ 提交并分析迭代版本' : '✨ 提交并开启 AI 审阅'}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Editor;
