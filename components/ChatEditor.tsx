
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../types';
import { getChatFollowUp } from '../services/geminiService';

interface ChatEditorProps {
  onFinish: (transcript: ChatMessage[], language: string) => void;
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
      morning: "おはようございます！今日の目標は何ですか？",
      day: "今日はどんな一日を過ごしていますか？",
      evening: "こんばんは。一日が終わろうとしていますが、今何を考えていますか？",
      night: "夜も更けてきましたね。今日はどんな夢を見たいですか？"
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

const ChatEditor: React.FC<ChatEditorProps> = ({ onFinish }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [themeLabel, setThemeLabel] = useState('初始化...');
  const scrollRef = useRef<HTMLDivElement>(null);

  const getStarter = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { text: language.starters.morning, theme: '🌅 清晨启程' };
    if (hour >= 11 && hour < 17) return { text: language.starters.day, theme: '☀️ 午后时光' };
    if (hour >= 17 && hour < 21) return { text: language.starters.evening, theme: '🌆 傍晚沉思' };
    return { text: language.starters.night, theme: '🌙 静谧深夜' };
  }, [language]);

  useEffect(() => {
    const start = getStarter();
    setMessages([{ role: 'ai', content: start.text }]);
    setThemeLabel(start.theme);
  }, [language, getStarter]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    if (lang.code === language.code) return;
    
    // Only ask for confirmation if there is actual user conversation
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

    const userMsg: ChatMessage = { role: 'user', content: inputValue.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    try {
      const followUp = await getChatFollowUp(newMessages, language.code);
      setMessages(prev => [...prev, { role: 'ai', content: followUp }]);
      if (newMessages.length > 4) setThemeLabel('🔮 深度探索');
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', content: "Interesting! Tell me more?" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">启发聊天馆</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest transition-all duration-500">{themeLabel}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                language.code === lang.code 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%">
            <pattern id="pattern-circles" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="currentColor" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#pattern-circles)" />
          </svg>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-5 relative z-10"
        >
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-100 shadow-indigo-50/30'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 flex space-x-1.5 shadow-sm">
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50/90 backdrop-blur-md border-t border-slate-100 flex items-center space-x-3 z-20">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`${language.label} 回答中...`}
            className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-inner"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-300 transition-all shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95"
          >
            <span className="text-2xl">✦</span>
          </button>
        </div>
      </div>

      <div className="flex justify-center pb-2">
        <button 
          onClick={() => onFinish(messages, language.code)}
          disabled={messages.length < 3 || isTyping}
          className="group bg-emerald-600 hover:bg-emerald-700 text-white px-12 py-4 rounded-2xl font-bold shadow-2xl shadow-emerald-200 transition-all flex items-center space-x-3 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none hover:scale-[1.02] active:scale-95"
        >
          <span className="text-2xl group-hover:rotate-12 transition-transform">✍️</span>
          <span>结束对话并生成馆藏</span>
        </button>
      </div>
    </div>
  );
};

export default ChatEditor;
