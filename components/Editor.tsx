
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
    <div className="flex flex-col h-full max-h-[calc(100vh-160px)] md:max-h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-4 flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">新篇章</h2>
          <p className="text-xs md:text-sm text-slate-500">记录生活，让 AI 完善你的表达。</p>
        </div>
        
        {/* 语言选择器：手机端横向滚动 */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1 md:pb-0 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                language === lang.code 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* 输入区域：自适应高度 */}
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-5 md:p-8 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex flex-col">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天发生了什么？有什么想表达的吗..."
            className="w-full flex-1 resize-none border-none focus:ring-0 text-slate-700 text-base md:text-lg leading-relaxed serif-font"
            disabled={isLoading}
          />
        </div>

        {/* 底部操作栏：手机端更紧凑 */}
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col">
            <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Character Count</span>
            <span className={`text-sm font-bold ${text.length < 10 ? 'text-slate-300' : 'text-indigo-600'}`}>
              {text.length} <span className="text-[10px] opacity-60">CHARS</span>
            </span>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || text.length < 10}
            className={`relative group px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold flex items-center space-x-2 transition-all active:scale-95 ${
              isLoading 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-white" />
                <span className="text-sm">审阅中...</span>
              </>
            ) : (
              <>
                <span className="text-sm md:text-base">✨ 提交修改</span>
                <span className="hidden md:inline-block text-[10px] bg-indigo-500 px-1.5 py-0.5 rounded ml-2">Enter</span>
              </>
            )}
            
            {/* 提示信息：如果字数不够 */}
            {text.length > 0 && text.length < 10 && (
              <div className="absolute -top-10 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                需至少 10 个字符
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Editor;
