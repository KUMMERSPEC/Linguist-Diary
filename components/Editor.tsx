
import React, { useState, useEffect, useMemo } from 'react';
import { InspirationFragment } from '../types';
import { generateDailyMuses } from '../services/geminiService';

interface EditorProps {
  onAnalyze: (text: string, language: string, usedFragmentIds: string[]) => void;
  onSaveDraft: (text: string, language: string) => void; 
  isLoading: boolean;
  initialText?: string;
  initialLanguage?: string;
  summaryPrompt?: string;
  fragments: InspirationFragment[];
  onDeleteFragment?: (id: string) => void;
  preferredLanguages: string[];
}

interface MuseCard {
  id: string;
  title: string;
  prompt: string;
  icon: string;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵' },
  { code: 'French', label: 'Français', flag: '🇫🇷' },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸' },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪' },
];

const CURATOR_WISDOM = [
  "正在查阅馆藏辞海，为您寻找更精准的措辞...",
  "正在对比母语者的表达习惯，雕琢句子的灵魂...",
  "你知道吗？优秀的表达往往在于动词的精准选择...",
  "正在扫描语法脉络，确保每一处衔接都自然流畅...",
  "馆长正在审阅您的文稿，请稍候片刻...",
  "正在注入地道的语言风味，让表达更有温度...",
  "正在为您整理进阶词汇，助力表达更上一层楼..."
];

const Editor: React.FC<EditorProps> = ({ onAnalyze, onSaveDraft, isLoading, initialText = '', initialLanguage, summaryPrompt, fragments, onDeleteFragment, preferredLanguages }) => {
  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState(initialLanguage || preferredLanguages[0] || 'English');
  const [isFragmentDrawerOpen, setIsFragmentDrawerOpen] = useState(false);
  const [fragmentSearch, setFragmentSearch] = useState('');
  const [usedFragmentIds, setUsedFragmentIds] = useState<Set<string>>(new Set());
  const [quotedFragment, setQuotedFragment] = useState<InspirationFragment | null>(null);
  
  const [muses, setMuses] = useState<MuseCard[]>([]);
  const [isMusesLoading, setIsMusesLoading] = useState(false);
  const [showMuses, setShowMuses] = useState(false);
  const [wisdomIndex, setWisdomIndex] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setWisdomIndex(prev => (prev + 1) % CURATOR_WISDOM.length);
      }, 4500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    setText(initialText);
    if (initialLanguage) setLanguage(initialLanguage);
  }, [initialText, initialLanguage]);

  useEffect(() => {
    if (showMuses) {
      loadMuses();
    }
  }, [language, showMuses]);

  const loadMuses = async () => {
    if (isMusesLoading) return;
    
    // Check Cache First to save tokens
    const today = new Date().toDateString();
    const cacheKey = `muses_${language}_${today}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        setMuses(JSON.parse(cached));
        return;
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    setIsMusesLoading(true);
    try {
      const data = await generateDailyMuses(language);
      setMuses(data);
      // Cache the result for the rest of the day
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    } finally {
      setIsMusesLoading(false);
    }
  };

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter(l => preferredLanguages.includes(l.code));
  }, [preferredLanguages]);

  const filteredFragments = useMemo(() => {
    let list = fragments.filter(f => 
      f.content.toLowerCase().includes(fragmentSearch.toLowerCase()) || 
      (f.meaning && f.meaning.toLowerCase().includes(fragmentSearch.toLowerCase()))
    );
    
    // Sort: Transient (Muses) first, then Seeds
    return list.sort((a, b) => {
      if (a.fragmentType === 'transient' && b.fragmentType !== 'transient') return -1;
      if (a.fragmentType !== 'transient' && b.fragmentType === 'transient') return 1;
      return b.timestamp - a.timestamp;
    });
  }, [fragments, fragmentSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 10) return;
    onAnalyze(text, language, Array.from(usedFragmentIds));
  };

  const handleInsertFragment = (f: InspirationFragment) => {
    setQuotedFragment(f);
    if (f.fragmentType === 'transient') {
      setUsedFragmentIds(prev => new Set(prev).add(f.id));
    }
  };

  const handleSelectMuse = (musePrompt: string) => {
    setText(musePrompt + '\n\n');
    setShowMuses(false);
  };

  return (
    <div className="h-full overflow-y-auto no-scrollbar pt-6 md:pt-10 px-4 md:px-8 pb-32 flex flex-col relative max-w-4xl mx-auto w-full">
      <header className="mb-6 space-y-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 serif-font">
            {initialText ? '🏛️ 迭代打磨 Refinement' : '✨ 开启撰写 New Artifact'}
          </h2>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => { setShowMuses(!showMuses); if(isFragmentDrawerOpen) setIsFragmentDrawerOpen(false); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${showMuses ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' : 'bg-white border-slate-200 text-slate-400 hover:border-amber-200 hover:text-amber-600'}`}
            >
              <span>💡 今日灵感</span>
            </button>

            <button 
              onClick={() => { setIsFragmentDrawerOpen(!isFragmentDrawerOpen); if(showMuses) setShowMuses(false); }}
              className={`flex items-center space-x-2 px-4 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${isFragmentDrawerOpen ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-200 hover:text-indigo-600'}`}
            >
              <span>✨ 灵感碎片</span>
              {fragments.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${isFragmentDrawerOpen ? 'bg-white' : 'bg-indigo-400'} animate-pulse`}></span>}
            </button>
          </div>
        </div>
        
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {filteredLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLanguage(lang.code)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-bold transition-all border ${
                  language === lang.code 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
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

      {/* Fragments Slider Overlay with Search */}
      {isFragmentDrawerOpen && (
        <div className="mb-6 animate-in slide-in-from-top-4 duration-500 bg-indigo-50/30 backdrop-blur-sm border border-indigo-100/50 rounded-[2rem] p-6 shadow-inner">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
             <div>
               <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">灵感碎片池 Inspiration Shards</h4>
               <p className="text-[8px] text-indigo-300 font-bold uppercase mt-1">📜 随笔类在使用后将自动存入历史并消失</p>
             </div>
             <div className="flex items-center space-x-2">
               <input 
                type="text" 
                value={fragmentSearch}
                onChange={(e) => setFragmentSearch(e.target.value)}
                placeholder="搜索碎片..." 
                className="bg-white/50 border-none rounded-xl px-4 py-1.5 text-[10px] focus:ring-2 focus:ring-indigo-500/20 w-32 md:w-48"
               />
               <button onClick={() => setIsFragmentDrawerOpen(false)} className="text-[10px] text-indigo-300 hover:text-indigo-500 font-bold uppercase">收起 ×</button>
             </div>
          </div>
          <div className="flex space-x-4 overflow-x-auto no-scrollbar pb-2">
            {filteredFragments.length > 0 ? filteredFragments.map(f => (
              <div key={f.id} className={`min-w-[180px] max-w-[220px] p-3 rounded-2xl border shadow-sm relative group transition-all ${usedFragmentIds.has(f.id) ? 'bg-slate-50 opacity-50 grayscale' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">{f.fragmentType === 'transient' ? '📜 随笔' : '🌱 种子'}</span>
                  {usedFragmentIds.has(f.id) && <span className="text-[7px] font-black text-emerald-500 uppercase">已引用</span>}
                </div>
                <p className="text-[10px] text-slate-600 italic line-clamp-2 mb-2 serif-font leading-relaxed">“ {f.content} ”</p>
                <div className="flex items-center justify-between">
                   <button 
                    onClick={() => handleInsertFragment(f)} 
                    disabled={usedFragmentIds.has(f.id)}
                    className="text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline disabled:text-slate-300"
                   >
                     引用 REFERENCE
                   </button>
                   <button onClick={() => onDeleteFragment?.(f.id)} className="text-[8px] text-slate-200 hover:text-rose-400 transition-colors">删除</button>
                </div>
              </div>
            )) : (
              <div className="w-full text-center py-4 text-[10px] font-black text-slate-300 uppercase">暂时没有符合搜索条件的碎片。</div>
            )}
          </div>
        </div>
      )}

      {/* Daily Muse Section */}
      {showMuses && !isLoading && (
        <div className="mb-8 animate-in slide-in-from-top-4 duration-700 bg-amber-50/30 backdrop-blur-sm border border-amber-100/50 rounded-[2.5rem] p-6 shadow-inner">
           <div className="flex items-center justify-between mb-6">
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em]">今日灵感支点 Daily Muse</span>
              <button onClick={() => setShowMuses(false)} className="text-[10px] text-amber-400 hover:text-amber-600 font-bold uppercase">收起 ×</button>
           </div>
           {isMusesLoading ? (
             <div className="flex flex-col items-center justify-center py-6 space-y-3">
                <div className="w-10 h-10 bg-white rounded-2xl shadow-sm flex items-center justify-center text-xl animate-bounce">🖋️</div>
                <p className="text-[10px] font-black text-amber-700/50 uppercase tracking-widest animate-pulse">正在搜寻今日灵感...</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {muses.map(muse => (
                 <button 
                   key={muse.id} 
                   onClick={() => handleSelectMuse(muse.prompt)}
                   className="bg-white p-5 rounded-[2rem] border border-amber-100/50 shadow-sm text-left hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
                 >
                   <div className="flex items-center space-x-2 mb-3">
                     <span className="text-xl group-hover:scale-125 transition-transform duration-500">{muse.icon}</span>
                     <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{muse.title}</span>
                   </div>
                   <p className="text-[11px] text-slate-500 leading-relaxed italic line-clamp-2 serif-font">“ {muse.prompt} ”</p>
                 </button>
               ))}
             </div>
           )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 space-y-4">
        {summaryPrompt && (
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-[2.5rem] animate-in fade-in duration-700 shadow-sm">
             <div className="flex items-center space-x-2 mb-2">
               <span className="text-indigo-400 text-xs">💭</span>
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Iterative Prompt</span>
             </div>
             <p className="text-sm md:text-base text-indigo-800/80 leading-relaxed italic serif-font">“ {summaryPrompt} ”</p>
          </div>
        )}

        <div className="flex-1 bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-hidden focus-within:ring-8 focus-within:ring-indigo-500/5 transition-all flex flex-col min-h-[300px] relative group">
          {isLoading && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] shadow-xl shadow-indigo-200 flex items-center justify-center mb-6 animate-bounce">
                <span className="text-2xl">🖋️</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 serif-font mb-2">馆长正在审阅中...</h3>
              <p className="text-slate-500 text-sm font-medium italic serif-font max-w-xs leading-relaxed">
                “ {CURATOR_WISDOM[wisdomIndex]} ”
              </p>
              <div className="mt-8 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
              </div>
            </div>
          )}

          {quotedFragment && (
            <div className="absolute top-0 left-0 right-0 z-20 bg-slate-50/80 backdrop-blur-md border-b border-slate-100 p-4 md:p-6 animate-in slide-in-from-top-2 duration-500">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest">正在引导创作 WRITING GUIDE</span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{quotedFragment.fragmentType === 'transient' ? '📜 随笔对照' : '🌱 种子参考'}</span>
                </div>
                <button onClick={() => setQuotedFragment(null)} className="text-[10px] text-slate-300 hover:text-rose-400 font-black">移除 ×</button>
              </div>
              <p className="text-sm md:text-base text-slate-600 italic serif-font leading-relaxed">“ {quotedFragment.content} ”</p>
            </div>
          )}
          
          <div className="relative flex-1 flex flex-col">
            {!text && quotedFragment && (
              <div className="absolute inset-0 p-8 md:p-14 text-lg md:text-2xl leading-relaxed serif-font text-slate-200 pointer-events-none z-0 italic">
                {quotedFragment.fragmentType === 'transient' ? '在此开始您的译文或续写...' : `围绕“${quotedFragment.content}”展开您的创作...`}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={quotedFragment ? "" : "在此开启您的撰写之旅..."}
              className={`flex-1 w-full border-none focus:ring-0 p-8 md:p-14 text-lg md:text-2xl leading-relaxed serif-font resize-none bg-transparent placeholder:text-slate-200 z-10 ${quotedFragment ? 'pt-24 md:pt-32' : ''}`}
              disabled={isLoading}
            />
          </div>
        </div>
        
        <footer className="flex items-center justify-end space-x-4 shrink-0 mt-4">
          <button 
            type="button"
            onClick={() => onSaveDraft(text, language)}
            disabled={text.trim().length < 10 || isLoading}
            className="px-8 py-4 rounded-3xl text-[10px] font-black uppercase tracking-widest text-slate-400 border-2 border-slate-100 hover:bg-slate-50 transition-all shadow-sm"
          >
            存入草稿 DRAFT
          </button>
          <button 
            type="submit"
            disabled={text.trim().length < 10 || isLoading}
            className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-lg font-black shadow-2xl hover:bg-indigo-700 hover:shadow-indigo-200 transition-all flex items-center justify-center space-x-3 active:scale-95"
          >
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><span>✨ AI 智能校对</span><span className="text-[10px] opacity-70">ANALYZE</span></>}
          </button>
        </footer>
      </form>
    </div>
  );
};

export default Editor;
