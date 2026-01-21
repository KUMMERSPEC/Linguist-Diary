import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage } from '../types';
import { getChatFollowUp, synthesizeDiary } from '../services/geminiService';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleFinish = async () => {
    if (messages.filter(m => m.role === 'user').length === 0) {
      alert("请先开始对话，馆长需要一些素材来为你生成日记。");
      return;
    }
    onFinish(messages, language.code);
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden max-w-4xl mx-auto w-full">
      {/* 顶部状态栏 */}
      <header className="flex flex-col space-y-3 shrink-0 mb-4 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100">
               {themeLabel}
             </div>
             <h2 className="text-xl font-bold text-slate-800 serif-font">启发聊天 Guided Chat</h2>
          </div>
          <button 
            onClick={handleFinish}
            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600 transition-all active:scale-95 shadow-lg"
          >
            🏛️ 合成日记并入馆
          </button>
        </div>

        {/* 语言选择 */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar pb-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                language.code === lang.code 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                  : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
              }`}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>
      </header>

      {/* 消息展示区 */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 space-y-6 no-scrollbar pb-4"
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}
          >
            <div className={`max-w-[85%] md:max-w-[70%] p-4 md:p-6 rounded-[2rem] shadow-sm border ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' 
                : 'bg-white text-slate-700 border-slate-100 rounded-tl-none'
            }`}>
              <p className="text-sm md:text-base leading-relaxed serif-font whitespace-pre-wrap">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white p-4 rounded-3xl border border-slate-100 flex space-x-1 items-center">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-audio-bar-1"></div>
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-audio-bar-2"></div>
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-audio-bar-3"></div>
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="p-2 pt-4 shrink-0">
        <div className="relative bg-white rounded-[2.5rem] border border-slate-200 shadow-xl focus-within:ring-4 focus-within:ring-indigo-500/10 focus-within:border-indigo-400 transition-all p-2 flex items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`用 ${language.label} 回复馆长...`}
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 text-base py-3 px-4 resize-none no-scrollbar serif-font"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 ${
              inputValue.trim() && !isTyping 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-100' 
                : 'bg-slate-100 text-slate-300 scale-90'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-center text-[8px] font-black text-slate-300 uppercase tracking-widest mt-2">
          Shift + Enter 换行 | 随时点击顶部按钮合成日记
        </p>
      </div>
    </div>
  );
};

export default ChatEditor;
