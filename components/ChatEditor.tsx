
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
      morning: "おはようございます！今日の目标は何ですか？",
      day: "今日はどんな一日を過ごしていますか？",
      evening: "こんばんは。一日が終わろうとしていますが、今何を考えていますか？",
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

const ChatEditor: React.FC<ChatEditorProps> = ({ onFinish }) => {
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [themeLabel, setThemeLabel] = useState('初始化...');
  const scrollRef = useRef<HTMLDivElement>(null);

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
  }, [language, getStarter]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    if (lang.code === language.code) return;
    const hasStarted = messages.some(m => m.role === 'user');
    if (hasStarted) {
      if (window.confirm("切换语言将清空当前对话，确定吗？")) setLanguage(lang);
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
      if (newMessages.length > 4) setThemeLabel('🔮 探索');
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: "Tell me more?" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
      <header className="flex flex-col space-y-1.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-base md:text-lg font-bold text-slate-900">启发聊天</h2>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{themeLabel}</span>
          </div>
          {/* 生成按钮固定在顶部，省空间且单手易操作 */}
          <button 
            onClick={() => onFinish(messages, language.code)}
            disabled={messages.length < 3 || isTyping}
            className="text-[10px] md:text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg disabled:bg-slate-200 transition-all active:scale-95 shadow-sm"
          >
            ✍️ 生成馆藏
          </button>
        </div>
        
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-0.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang)}
              className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-semibold whitespace-nowrap border ${
                language.code === lang.code ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              <span className="mr-1">{lang.flag}</span>{lang.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 relative z-10 no-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in`}>
              <div className={`max-w-[88%] p-3 rounded-xl text-xs md:text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-slate-50 p-2 rounded-xl rounded-tl-none border border-slate-100 flex space-x-1">
                <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
        </div>

        {/* 紧凑型输入框 */}
        <div className="p-2.5 bg-slate-50/90 backdrop-blur-md border-t border-slate-100 flex items-center space-x-2 shrink-0">
          <input 
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="在此输入内容回复..."
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:bg-slate-300 transition-all active:scale-95 shadow-sm"
          >
            ✦
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatEditor;
