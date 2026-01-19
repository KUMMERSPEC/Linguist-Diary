
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
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
      {/* 头部区域：在手机端更紧凑 */}
      <header className="mb-4 space-y-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 serif-font">新篇章</h2>
          <p className="text-[10px] md:text-sm text-slate-500 uppercase tracking-wider font-semibold">Standard Entry</p>
        </div>
        
        {/* 语言选择器：手机端横向滚动，不换行 */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all border ${
                language === lang.code 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
        {/* 输入框主容器：自适应剩余高度 */}
        <div className="flex-1 bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm p-5 md:p-10 flex flex-col focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天发生了什么？有什么想表达的吗..."
            className="w-full flex-1 resize-none border-none focus:ring-0 text-slate-700 text-base md:text-xl leading-relaxed serif-font placeholder:text-slate-300"
            disabled={isLoading}
          />
          
          {/* 辅助信息内嵌 */}
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {language} Mode
              </span>
            </div>
            <span className={`text-[10px] font-bold ${text.length < 10 ? 'text-slate-300' : 'text-indigo-400'}`}>
              {text.length} CHARS
            </span>
          </div>
        </div>

        {/* 底部按钮栏：居中并优化手机点击 */}
        <div className="mt-4 pb-2">
          <button
            type="submit"
            disabled={isLoading || text.length < 10}
            className={`w-full relative overflow-hidden group py-4 md:py-5 rounded-2xl font-bold flex items-center justify-center space-x-3 transition-all active:scale-95 ${
              isLoading 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-100'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-white" />
                <span>分析馆藏中...</span>
              </>
            ) : (
              <>
                <span className="text-xl">✨</span>
                <span className="tracking-wide">提交并开始分析</span>
                <span className="hidden md:inline-block text-[10px] bg-indigo-500 px-2 py-0.5 rounded opacity-80 uppercase">Enter</span>
              </>
            )}
            
            {/* 极简进度条背景 */}
            {!isLoading && text.length >= 10 && (
                <div className="absolute bottom-0 left-0 h-1 bg-white/20 transition-all duration-300" style={{ width: `${Math.min(100, (text.length / 500) * 100)}%` }}></div>
            )}
          </button>
          
          {text.length > 0 && text.length < 10 && (
            <p className="text-center text-[10px] text-orange-400 font-bold mt-2 animate-bounce">
              还需要至少 {10 - text.length} 个字符才能开始分析
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default Editor;