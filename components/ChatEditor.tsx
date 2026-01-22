
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessage, AdvancedVocab } from '../types';
import { getChatFollowUp } from '../services/geminiService';

interface ChatEditorProps {
  onFinish: (transcript: ChatMessage[], language: string) => void;
  allGems: (AdvancedVocab & { language: string })[];
}

const LANGUAGES = [
  { 
    code: 'English', label: 'English', flag: '🇬🇧', 
    starters: {
      morning: "Good morning! What's your main goal for today?",
      day: "How's your day going so far?",
      evening: "Good evening. As the day winds down, what's on your mind?",
      night: "It's late. Are you thinking about your dreams or just enjoying the silence?"
    }
  },
  { 
    code: 'Japanese', label: '日本語', flag: '🇯🇵', 
    starters: {
      morning: "おはようございます！今日の目标は何ですか？",
      day: "今日はどんな一日を过ごしていますか？",
      evening: "こんばんは。一日が终わろうとしていますが、今何を考えていますか？",
      night: "夜も更けてきましたね。今日はどんな梦を見たいですか？"
    }
  },
  { 
    code: 'French', label: 'Français', flag: '🇫🇷', 
    starters: {
      morning: "Bonjour ! Quel est votre objectif pour aujourd'hui ?",
      day: "Comment se passe votre journée ?",
      evening: "Bonsoir. Alors que la journée se termine, à quoi pensez-vous ?",
      night: "Il est tard. Profitez-vous du silence de la nuit ?"
    }
  },
  { 
    code: 'Spanish', label: 'Español', flag: '🇪🇸', 
    starters: {
      morning: "¡Buenos días! ¿Cuál es tu objetivo para hoy?",
      day: "¿Cómo va tu día?",
      evening: "Buenas noches. Ahora que el día termina, ¿en qué piensas?",
      night: "¿Estás disfrutando de la paz de la noche?"
    }
  },
  { 
    code: 'German', label: 'Deutsch', flag: '🇩🇪', 
    starters: {
      morning: "Guten Morgen! Was ist dein Ziel für heute?",
      day: "Wie läuft dein Tag bisher?",
      evening: "Guten Abend. Was beschäftigt dich am Ende des Tages?",
      night: "Es ist spät. Genießt du die nächtliche Stille?"
    }
  },
];

const ChatEditor: React.FC<ChatEditorProps> = ({ onFinish, allGems }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [themeLabel, setThemeLabel] = useState('初始化...');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const targetGems = useMemo(() => {
    const uniqueMap = new Map<string, AdvancedVocab>();
    allGems
      .filter(g => g.language === language.code && (g.mastery || 0) < 3)
      .forEach(g => {
        if (!uniqueMap.has(g.word)) uniqueMap.set(g.word, g);
      });
    return Array.from(uniqueMap.values()).slice(0, 5);
  }, [allGems, language]);

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

  const getStarter = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { text: language.starters.morning, theme: '🌅 清晨' };
    if (hour >= 11 && hour < 17) return { text: language.starters.day, theme: '☀️ 午后' };
    if (hour >= 17 && hour < 21) return { text: language.starters.evening, theme: '🌆 傍晚' };
    return { text: language.starters.night, theme: '🌙 深夜' };
  }, [language]);

  useEffect(() => {
    const start = getStarter();
    setMessages([{ role: 'ai', content: start.text }]);
    setThemeLabel(start.theme);
    setUsedGems(new Set());
  }, [language, getStarter]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    if (lang.code === language.code) return;
    const hasStarted = messages.some(m => m.role === 'user');
    if (hasStarted) {
      if (window.confirm("切换语言将清空当前对话，确定吗？")) {
        setLanguage(lang);
      }
    } else {
      setLanguage(lang);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    const content = inputValue.trim();
    
    const newlyDetected = targetGems.filter(gem => 
      !usedGems.has(gem.word) && 
      content.toLowerCase().includes(stripRuby(gem.word).toLowerCase())
    );

    if (newlyDetected.length > 0) {
      const nextUsed = new Set(usedGems);
      newlyDetected.forEach(gem => nextUsed.add(gem.word));
      setUsedGems(nextUsed);
    }

    const userMsg: ChatMessage = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);
    
    try {
      const followUp = await getChatFollowUp(newMessages, language.code);
      setMessages(prev => [...prev, { role: 'ai', content: followUp }]);
      if (newMessages.length > 4) setThemeLabel('🔮 探索');
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "能再跟我多说一点吗？" }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFinish = () => {
    if (messages.filter(m => m.role === 'user').length === 0) {
      alert("请先开始对话。");
      return;
    }
    onFinish(messages, language.code);
  };

  return (
    <div className="flex h-full animate-in fade-in duration-500 overflow-hidden w-full bg-slate-50 relative">
      <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-slate-100 p-6 space-y-6 shrink-0 z-10">
        <div className="flex items-center space-x-2">
           <span className="text-xl">💎</span>
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest serif-font">点亮计划</h3>
        </div>
        <div className="space-y-4">
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
            在对话中成功调用以下馆藏词汇，即可点亮它们。
          </p>
          <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] no-scrollbar">
             {targetGems.length > 0 ? targetGems.map((gem, idx) => {
               const isLit = usedGems.has(gem.word);
               return (
                 <div 
                   key={idx} 
                   className={`p-4 rounded-2xl border transition-all duration-500 relative overflow-hidden group ${
                     isLit 
                      ? 'bg-amber-50 border-amber-200 shadow-md shadow-amber-100 scale-[1.02]' 
                      : 'bg-white border-dashed border-slate-200 opacity-60'
                   }`}
                 >
                   {isLit && (
                     <div className="absolute top-0 right-0 p-1 animate-pulse">
                        <span className="text-[10px]">✨</span>
                     </div>
                   )}
                   <h4 className={`text-base font-black serif-font ${isLit ? 'text-amber-700' : 'text-slate-600'}`}>
                     {renderRuby(gem.word)}
                   </h4>
                   <p className="text-[10px] text-slate-400 mt-1 italic line-clamp-2">{gem.meaning}</p>
                 </div>
               );
             }) : (
               <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl">
                 <p className="text-[10px] text-slate-300 font-bold">暂无待强化的珍宝</p>
               </div>
             )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full min-w-0 bg-white md:bg-slate-50">
        <header className="flex flex-col shrink-0 border-b border-slate-100 bg-white/90 backdrop-blur-md z-20">
          <div className="flex items-center justify-between px-4 md:px-8 py-3">
            <div className="flex items-center space-x-3 min-w-0">
               <div className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md shrink-0">
                 {themeLabel}
               </div>
               <h2 className="text-base font-bold text-slate-800 serif-font truncate">启发聊天</h2>
            </div>
            <button 
              onClick={handleFinish}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shrink-0"
            >
              试试总结记录吧 ✨
            </button>
          </div>

          <div className="px-4 md:px-8 pb-3 space-y-3">
             <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar pb-1">
               {LANGUAGES.map((lang) => (
                 <button
                   key={lang.code}
                   onClick={() => handleLanguageChange(lang)}
                   className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${
                     language.code === lang.code 
                       ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                       : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
                   }`}
                 >
                   {lang.flag} {lang.label}
                 </button>
               ))}
             </div>
             
             <div className="lg:hidden flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">待点亮:</span>
                {targetGems.map((gem, i) => {
                  const isLit = usedGems.has(gem.word);
                  return (
                    <div 
                      key={i} 
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl border text-[10px] font-black serif-font transition-all duration-500 flex items-center space-x-1.5 ${
                        isLit 
                          ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm shadow-amber-100 scale-105 ring-2 ring-amber-400/20' 
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span>{renderRuby(gem.word)}</span>
                      {isLit && <span className="animate-pulse">✨</span>}
                    </div>
                  );
                })}
             </div>
          </div>
        </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-8 space-y-6 no-scrollbar py-6 md:py-8"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => {
              const containedGems = targetGems.filter(gem => 
                msg.role === 'user' && msg.content.toLowerCase().includes(stripRuby(gem.word).toLowerCase())
              );
              
              return (
                <div 
                  key={idx} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                >
                  <div className={`relative max-w-[85%] md:max-w-[70%] p-4 md:p-6 rounded-[1.8rem] shadow-sm border ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none shadow-xl shadow-indigo-100/50' 
                      : 'bg-white text-slate-700 border-slate-100 rounded-tl-none shadow-sm'
                  }`}>
                    <p className="text-[15px] md:text-base leading-[2.2] serif-font whitespace-pre-wrap">
                      {renderRuby(msg.content)}
                    </p>
                    
                    {containedGems.length > 0 && (
                      <div className="absolute -top-3 -right-3 flex -space-x-1">
                        {containedGems.map((_, gi) => (
                          <div key={gi} className="w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md animate-bounce" style={{ animationDelay: `${gi * 0.1}s` }}>
                             <span className="text-[10px]">💎</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl border border-slate-100 flex space-x-1 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-audio-bar-1"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-audio-bar-2"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-audio-bar-3"></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="shrink-0 bg-white border-t border-slate-100 px-4 pt-3 pb-4 md:pb-8 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.05)]">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-white rounded-[1.8rem] border border-slate-200 shadow-xl focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 transition-all p-1 flex items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`用 ${language.label} 回复...`}
                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 text-sm md:text-base py-3 px-5 resize-none no-scrollbar serif-font min-h-[44px] md:min-h-[56px] flex items-center"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
                className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all shrink-0 mb-0.5 mr-0.5 ${
                  inputValue.trim() && !isTyping 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-100' 
                    : 'bg-slate-50 text-slate-300'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ChatEditor;