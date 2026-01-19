
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">新篇章</h2>
          <p className="text-slate-500">记录你的生活，让 AI 协助你表达更完美。</p>
        </div>
        <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                language === lang.code 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天发生了什么？有什么想表达的吗..."
            className="w-full h-full resize-none border-none focus:ring-0 text-slate-700 text-lg leading-relaxed serif-font"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-slate-400 text-sm">
            {text.length} 字符
          </div>
          <button
            type="submit"
            disabled={isLoading || text.length < 10}
            className={`px-8 py-4 rounded-2xl font-bold flex items-center space-x-3 transition-all ${
              isLoading 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
            }`}
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400 border-t-white" />
                <span>AI 馆长正在审阅...</span>
              </>
            ) : (
              <>
                <span>✨ 提交修改</span>
                <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded">Enter</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Editor;
