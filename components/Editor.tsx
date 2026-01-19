
import React, { useState } from 'react';

interface EditorProps {
  onAnalyze: (text: string, language: string) => void;
  isLoading: boolean;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const Editor: React.FC<EditorProps> = ({ onAnalyze, isLoading }) => {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('English');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) return;
    onAnalyze(text, language);
  };

  return (
    <div className="flex flex-col h-full max-h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 极简页眉 */}
      <header className="mb-1.5 space-y-1 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base md:text-2xl font-bold text-slate-900 serif-font">新藏品</h2>
          <span className="text-[9px] font-bold text-slate-400 tracking-tighter uppercase">Standard</span>
        </div>
        
        {/* 语言选择器：缩小高度 */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-0.5 -mx-3 px-3 md:mx-0 md:px-0">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`flex-shrink-0 flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-bold transition-all border ${
                language === lang.code 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-500'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* 文本区域：自适应高度 */}
        <div className="flex-1 bg-white rounded-xl md:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all min-h-[150px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天发生了什么？..."
            className="w-full flex-1 resize-none border-none focus:ring-0 p-3 md:p-8 text-slate-700 text-sm md:text-lg leading-relaxed serif-font placeholder:text-slate-300 bg-transparent"
            disabled={isLoading}
          />
          
          <div className="px-3 py-1 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${text.length >= 10 ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{language}</span>
            </div>
            <span className={`text-[9px] font-black tracking-tighter ${text.length < 10 ? 'text-slate-300' : 'text-indigo-600'}`}>
              {text.length} <span className="opacity-50">/ MIN 10</span>
            </span>
          </div>
        </div>

        {/* 提交按钮：紧凑型 */}
        <div className="mt-2 shrink-0">
          <button
            type="submit"
            disabled={isLoading || text.length < 10}
            className={`w-full py-2.5 md:py-3.5 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-[0.97] ${
              isLoading 
                ? 'bg-slate-100 text-slate-300' 
                : 'bg-indigo-600 text-white shadow-md'
            }`}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-indigo-500" />
            ) : (
              <span className="text-sm md:text-base">✨ 提交分析内容</span>
            )}
          </button>
          
          {text.length > 0 && text.length < 10 && (
            <p className="text-center text-[8px] text-orange-400 font-bold mt-1 uppercase">
              还需要至少 {10 - text.length} 个字符
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default Editor;
