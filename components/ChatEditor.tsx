
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage, AdvancedVocab } from '../types';
import { getChatFollowUp, generatePracticeTasks } from '../services/geminiService';

interface ChatEditorProps {
  onFinish: (transcript: ChatMessage[], language: string) => void;
  allGems: (AdvancedVocab & { language: string })[];
}

interface GemMission {
  word: string;
  mission?: { label: string, icon: string };
  isLoading: boolean;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧', starters: { morning: "Good morning! What's your goal?", day: "How's your day?", evening: "Good evening. Thoughts?", night: "Quiet night, isn't it?" } },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵', starters: { morning: "おはようございます！", day: "こんにちは！", evening: "こんばんは。", night: "おやすみなさい。" } },
  { code: 'French', label: 'Français', flag: '🇫🇷', starters: { morning: "Bonjour !", day: "Salut !", evening: "Bonsoir.", night: "Bonne nuit." } },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸', starters: { morning: "¡Buenos días!", day: "¡Hola!", evening: "Buenas noches.", night: "Buenas noches." } },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪', starters: { morning: "Guten Morgen!", day: "Hallo!", evening: "Guten Abend.", night: "Gute Nacht." } },
];

const ChatEditor: React.FC<ChatEditorProps> = ({ onFinish, allGems }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [themeLabel, setThemeLabel] = useState('初始化...');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessionGems, setSessionGems] = useState<AdvancedVocab[]>([]);
  const [gemMissions, setGemMissions] = useState<Record<string, GemMission>>({});
  const [usedGems, setUsedGems] = useState<Set<string>>(new Set());

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const stripRuby = (text: string) => {
    if (!text) return '';
    return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  };

  const refreshSessionGems = useCallback(async () => {
    if (!allGems) return;
    
    // 增强匹配：确保语言代码和待点亮状态正确
    const available = allGems.filter(g => 
      g.language.toLowerCase().trim() === language.code.toLowerCase().trim()
    );
    
    // 如果该语言没有词汇，给个提示或者留空
    if (available.length === 0) {
      setSessionGems([]);
      setGemMissions({});
      return;
    }

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 5);
    setSessionGems(selected);
    setUsedGems(new Set());
    
    const initialMissions: Record<string, GemMission> = {};
    selected.forEach(g => { initialMissions[g.word] = { word: g.word, isLoading: true }; });
    setGemMissions(initialMissions);

    selected.forEach(async (gem) => {
      try {
        const tasks = await generatePracticeTasks(gem.word, gem.meaning, language.code);
        setGemMissions(prev => ({
          ...prev,
          [gem.word]: { word: gem.word, mission: tasks[0], isLoading: false }
        }));
      } catch (e) {
        setGemMissions(prev => ({ ...prev, [gem.word]: { word: gem.word, isLoading: false } }));
      }
    });
  }, [allGems, language]);

  useEffect(() => {
    const start = getStarter();
    setMessages([{ role: 'ai', content: start.text }]);
    setThemeLabel(start.theme);
    refreshSessionGems();
  }, [language]); // 当语言切换时刷新

  const getStarter = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { text: language.starters.morning, theme: '🌅 清晨' };
    if (hour >= 11 && hour < 17) return { text: language.starters.day, theme: '☀️ 午后' };
    if (hour >= 17 && hour < 21) return { text: language.starters.evening, theme: '🌆 傍晚' };
    return { text: language.starters.night, theme: '🌙 深夜' };
  }, [language]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    if (lang.code === language.code) return;
    if (messages.some(m => m.role === 'user')) {
      if (window.confirm("切换语言将清空当前对话，确定吗？")) setLanguage(lang);
    } else {
      setLanguage(lang);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    const content = inputValue.trim();
    
    // 优化点亮逻辑：关键词匹配去除假名干扰
    const newlyDetected = sessionGems.filter(gem => {
      if (usedGems.has(gem.word)) return false;
      const cleanWord = stripRuby(gem.word).toLowerCase().trim();
      return content.toLowerCase().includes(cleanWord);
    });

    if (newlyDetected.length > 0) {
      const nextUsed = new Set(usedGems);
      newlyDetected.forEach(gem => nextUsed.add(gem.word));
      setUsedGems(nextUsed);
    }

    const newMessages = [...messages, { role: 'user', content } as ChatMessage];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);
    
    try {
      const followUp = await getChatFollowUp(newMessages, language.code);
      setMessages(prev => [...prev, { role: 'ai', content: followUp }]);
      if (newMessages.length > 4) setThemeLabel('🔮 探索');
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "能再跟我多说一点吗？" }]);
    } finally { setIsTyping(false); }
  };

  const handleFinish = () => {
    if (messages.filter(m => m.role === 'user').length === 0) return alert("请先开始对话。");
    onFinish(messages, language.code);
  };

  return (
    <div className="flex h-full animate-in fade-in duration-500 overflow-hidden w-full bg-slate-50 relative">
      <aside className="hidden md:flex w-80 flex-col bg-white border-r border-slate-100 p-6 space-y-6 shrink-0 z-10">
        <div className="flex items-center justify-between">
           <div className="flex items-center space-x-2">
             <span className="text-xl">💎</span>
             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest serif-font">点亮计划</h3>
           </div>
           <button onClick={refreshSessionGems} className="text-[10px] text-indigo-500 font-bold hover:underline">换一批</button>
        </div>
        <div className="space-y-4 overflow-y-auto no-scrollbar">
           {sessionGems.length > 0 ? sessionGems.map((gem, idx) => {
             const isLit = usedGems.has(gem.word);
             const mission = gemMissions[gem.word];
             return (
               <div key={idx} className={`p-4 rounded-[1.8rem] border transition-all duration-500 ${isLit ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-slate-100'}`}>
                 <div className="flex items-center justify-between mb-2">
                   <h4 className={`text-base font-black serif-font ${isLit ? 'text-amber-700' : 'text-slate-800'}`}>{renderRuby(gem.word)}</h4>
                   {isLit && <span className="text-amber-500 text-sm">✨</span>}
                 </div>
                 {!isLit && (
                   <div className="mt-2 p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      {mission?.isLoading ? <div className="animate-pulse h-3 w-20 bg-slate-200 rounded"></div> : (
                        <div className="flex items-start space-x-2">
                           <span className="text-xs">{mission?.mission?.icon || '💬'}</span>
                           <p className="text-[10px] text-slate-500 font-bold">{mission?.mission?.label || '尝试在对话中运用这个词'}</p>
                        </div>
                      )}
                   </div>
                 )}
                 <p className="text-[10px] text-slate-400 mt-2 italic px-1">{gem.meaning}</p>
               </div>
             );
           }) : (
             <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
               <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">该语言暂无馆藏珍宝</p>
               <p className="text-[9px] text-slate-400 mt-1 px-4">去撰写几篇日记来填充收藏馆吧！</p>
             </div>
           )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full bg-white md:bg-slate-50 min-w-0">
        <header className="flex flex-col shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-md z-20 px-4 md:px-8 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
               <div className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md">{themeLabel}</div>
               <h2 className="text-base font-bold text-slate-800 serif-font">启发聊天</h2>
            </div>
            <button onClick={handleFinish} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold shadow-lg">试试总结记录 ✨</button>
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
            {LANGUAGES.map((lang) => (
              <button key={lang.code} onClick={() => handleLanguageChange(lang)} className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[9px] font-bold border transition-all ${language.code === lang.code ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>
                {lang.flag} {lang.label}
              </button>
            ))}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-8 space-y-6 no-scrollbar py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4`}>
                <div className={`max-w-[85%] md:max-w-[70%] p-4 md:p-6 rounded-[1.8rem] shadow-sm border ${msg.role === 'user' ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none shadow-xl shadow-indigo-100/50' : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'}`}>
                  <p className="text-[15px] md:text-base leading-[2.2] serif-font whitespace-pre-wrap">{renderRuby(msg.content)}</p>
                </div>
              </div>
            ))}
            {isTyping && <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl border border-slate-100 flex space-x-1 items-center"><div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-audio-bar-1"></div><div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-audio-bar-2"></div><div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-audio-bar-3"></div></div></div>}
          </div>
        </div>

        <footer className="shrink-0 bg-white border-t border-slate-100 px-4 pt-3 pb-4 md:pb-8">
          <div className="max-w-4xl mx-auto flex items-end bg-white rounded-[1.8rem] border border-slate-200 shadow-xl p-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={`用 ${language.label} 回复...`}
              className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 text-sm md:text-base py-3 px-5 resize-none no-scrollbar serif-font min-h-[44px]"
            />
            <button onClick={handleSend} disabled={!inputValue.trim() || isTyping} className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 mr-0.5 ${inputValue.trim() && !isTyping ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatEditor;
