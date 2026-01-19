
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
    <div className="flex flex-col h-full max-h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 精简版页眉 */}
      <header className="mb-3 space-y-2 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg md:text-2xl font-bold text-slate-900 serif-font">新藏品</h2>
          <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase">Standard Mode</span>
        </div>
        
        {/* 紧凑型语言选择器 */}
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                language === lang.code 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
              }`}
            >
              <span className="scale-110">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* 沉浸式写信容器 */}
        <div className="flex-1 bg-white rounded-2xl md:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-indigo-500/5 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天发生了什么？..."
            className="w-full flex-1 resize-none border-none focus:ring-0 p-4 md:p-8 text-slate-700 text-base md:text-lg leading-relaxed serif-font placeholder:text-slate-300 bg-transparent"
            disabled={isLoading}
          />
          
          {/* 内嵌式状态条 */}
          <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${text.length >= 10 ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'}`}></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{language}</span>
            </div>
            <div className="flex items-center space-x-2">
               <span className={`text-[10px] font-black tracking-tighter ${text.length < 10 ? 'text-slate-300' : 'text-indigo-600'}`}>
                 {text.length} <span className="opacity-50">/ 500+</span>
               </span>
            </div>
          </div>
        </div>

        {/* 底部按钮：移动端更贴合手势 */}
        <div className="mt-3 shrink-0 pb-1">
          <button
            type="submit"
            disabled={isLoading || text.length < 10}
            className={`w-full py-3.5 md:py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all active:scale-[0.98] ${
              isLoading 
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-indigo-500" />
                <span className="text-sm">正在整理馆藏...</span>
              </>
            ) : (
              <>
                <span className="text-lg">✨</span>
                <span className="text-sm md:text-base">提交分析内容</span>
              </>
            )}
          </button>
          
          {text.length > 0 && text.length < 10 && (
            <p className="text-center text-[9px] text-orange-400 font-bold mt-1.5 uppercase tracking-tighter">
              还需要至少 {10 - text.length} 个字符即可入馆
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default Editor;
