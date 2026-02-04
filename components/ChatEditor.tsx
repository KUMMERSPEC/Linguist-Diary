
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChatMessage, AdvancedVocab } from '../types';
import { getChatFollowUp, generateChatSummaryPrompt, generateDailyMuses } from '../services/geminiService';

interface ChatEditorProps {
  onFinish: (transcript: ChatMessage[], language: string, summaryPrompt: string) => void;
  allGems: (AdvancedVocab & { language: string })[];
  preferredLanguages: string[];
}

interface GemMission {
  word: string;
  mission?: { label: string, icon: string };
  isLoading: boolean;
}

interface MuseCard {
  id: string;
  title: string;
  prompt: string;
  icon: string;
}

const LANGUAGES = [
  { code: 'English', label: 'English', flag: '🇬🇧', starters: { morning: "Good morning! What's your goal?", day: "How's your day?", evening: "Good evening. Thoughts?", night: "Quiet night, isn't it?" } },
  { code: 'Japanese', label: '日本語', flag: '🇯🇵', starters: { morning: "おはようございます！", day: "こんにちは！", evening: "こんばんは。", night: "おやすみなさい。" } },
  { code: 'French', label: 'Français', flag: '🇫🇷', starters: { morning: "Bonjour !", day: "Salut !", evening: "Bonsoir.", night: "Bonne nuit." } },
  { code: 'Spanish', label: 'Español', flag: '🇪🇸', starters: { morning: "¡Buenos días!", day: "¡Hola!", evening: "Buenas noches.", night: "Buenas noches." } },
  { code: 'German', label: 'Deutsch', flag: '🇩🇪', starters: { morning: "Guten Morgen!", day: "Hallo!", evening: "Guten Abend.", night: "Gute Nacht." } },
];

const ChatEditor: React.FC<ChatEditorProps> = ({ onFinish, allGems, preferredLanguages }) => {
  const filteredLangs = useMemo(() => LANGUAGES.filter(l => preferredLanguages.includes(l.code)), [preferredLanguages]);
  const [language, setLanguage] = useState(filteredLangs[0] || LANGUAGES[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [themeLabel, setThemeLabel] = useState('初始化...');
  const [isMobileGemsOpen, setIsMobileGemsOpen] = useState(false); 
  const [muses, setMuses] = useState<MuseCard[]>([]);
  const [isMusesLoading, setIsMusesLoading] = useState(false);
  const [showMuses, setShowMuses] = useState(false); 
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [sessionGems, setSessionGems] = useState<AdvancedVocab[]>([]);
  const [gemMissions, setGemMissions] = useState<Record<string, GemMission>>({});
  const [usedGems, setUsedGems] = useState<Set<string>>(new Set());

  const stripRuby = (text: string) => {
    if (!text) return '';
    return text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  };

  const loadMuses = useCallback(async () => {
    if (!showMuses) return;
    
    const today = new Date().toDateString();
    const cacheKey = `muses_${language.code}_${today}`;
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
      const dailyMuses = await generateDailyMuses(language.label);
      setMuses(dailyMuses);
      localStorage.setItem(cacheKey, JSON.stringify(dailyMuses));
    } catch (e) { console.error(e); } finally { setIsMusesLoading(false); }
  }, [language, showMuses]);

  const refreshSessionGems = useCallback(async () => {
    if (!allGems) return;
    const available = allGems.filter(g => g.language.toLowerCase().trim() === language.code.toLowerCase().trim());
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
    selected.forEach(g => { initialMissions[g.word] = { word: g.word, isLoading: false }; });
    setGemMissions(initialMissions);
  }, [allGems, language]);

  useEffect(() => {
    const start = getStarter();
    setMessages([{ role: 'ai', content: start.text }]);
    setThemeLabel(start.theme);
    refreshSessionGems();
    setMuses([]);
    setShowMuses(false);
  }, [language]);

  useEffect(() => {
    if (showMuses) loadMuses();
  }, [showMuses, loadMuses]);

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

  const handleLanguageChange = (lang: typeof LANGUAGES[0]) => {
    setLanguage(lang);
  };

  const handleSelectMuse = (muse: MuseCard) => {
    setMessages([{ 
      role: 'ai', 
      content: `馆长，很有意思的主题！${muse.prompt} 请用 ${language.label} 跟我分享一下你的想法。` 
    }]);
    setThemeLabel(`✨ ${muse.title}`);
    setShowMuses(false);
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isTyping) return;
    
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

  const handleFinish = async () => {
    if (messages.filter(m => m.role === 'user').length === 0) return alert("请先开始对话。");
    setIsFinishing(true);
    try {
      const summary = await generateChatSummaryPrompt(messages, language.code);
      onFinish(messages, language.code, summary);
    } catch (e) {
      onFinish(messages, language.code, "试着把刚才聊的内容整理成一篇正式的日记吧。");
    } finally {
      setIsFinishing(false);
    }
  };

  const renderRuby = (text: string) => {
    if (!text) return '';
    const html = text.replace(/\[(.*?)\]\((.*?)\)/g, '<ruby>$1<rt>$2</rt></ruby>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const GemsContent = () => (
    <div className="flex flex-col space-y-4 h-full">
      <div className="flex items-center justify-between shrink-0 mb-2">
         <div className="flex items-center space-x-2">
           <span className="text-xl">💎</span>
           <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest serif-font">点亮计划</h3>
         </div>
         <button onClick={refreshSessionGems} className="text-[10px] text-indigo-500 font-bold hover:underline">换一批</button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-10">
         {sessionGems.length > 0 ? sessionGems.map((gem, idx) => {
           const isLit = usedGems.has(gem.word);
           return (
             <div key={idx} className={`p-4 rounded-[1.8rem] border transition-all duration-200 ${isLit ? 'bg-amber-50 border-amber-200 shadow-md' : 'bg-white border-slate-100'}`}>
               <div className="flex items-center justify-between mb-2">
                 <h4 className={`text-base font-black serif-font ${isLit ? 'text-amber-700' : 'text-slate-800'}`}>{renderRuby(gem.word)}</h4>
                 {isLit && <span className="text-amber-500 text-sm animate-bounce">✨</span>}
               </div>
               {!isLit && (
                 <div className="mt-2">
                    <p className="text-[10px] text-slate-400 leading-relaxed italic">{stripRuby(gem.meaning)}</p>
                 </div>
               )}
             </div>
           );
         }) : (
           <div className="py-10 text-center text-slate-400 text-xs italic">
             当前语言暂无入库珍宝。<br/>去日记中发掘吧！
           </div>
         )}
      </div>
    </div>
  );

  const isUserStarted = messages.some(m => m.role === 'user');

  return (
    <div className="flex h-full animate-in fade-in duration-700 overflow-hidden w-full bg-slate-50 relative">
      <aside className="hidden lg:flex w-80 bg-white border-r border-slate-100 flex-col p-8 shrink-0">
        <header className="mb-8">
           <h2 className="text-2xl font-black text-slate-900 serif-font tracking-tight">启发对话 <span className="text-indigo-600">Guided Chat</span></h2>
           <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Curator's Dialogue Room</p>
        </header>
        <GemsContent />
      </aside>

      {isMobileGemsOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setIsMobileGemsOpen(false)}></div>
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-2xl z-[70] lg:hidden p-8 pt-4 animate-in slide-in-from-bottom-10 duration-300 max-h-[80vh] flex flex-col">
            <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto mb-6 shrink-0" onClick={() => setIsMobileGemsOpen(false)}></div>
            <GemsContent />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-0 bg-slate-50 relative">
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-50 shrink-0">
          <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar py-1">
             {filteredLangs.map(lang => (
               <button
                 key={lang.code}
                 onClick={() => handleLanguageChange(lang)}
                 className={`flex-shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border ${language.code === lang.code ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100'}`}
               >
                 <span>{lang.flag}</span>
                 <span className="uppercase tracking-widest">{lang.label}</span>
               </button>
             ))}
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setIsMobileGemsOpen(true)}
              className="lg:hidden flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl text-amber-600 font-black shadow-sm"
            >
              <span className={`text-xs ${usedGems.size > 0 ? 'animate-bounce' : ''}`}>💎</span>
              <span className="text-[10px] uppercase tracking-tighter">{usedGems.size}/{sessionGems.length || 0}</span>
            </button>
            <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hidden sm:block">
              {themeLabel}
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 space-y-6 pb-40">
           {messages.map((msg, idx) => (
             <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in ${msg.role === 'user' ? 'slide-in-from-right-4' : 'slide-in-from-left-4'} fade-in duration-500`}>
               <div className={`max-w-[85%] md:max-w-[70%] p-5 md:p-6 rounded-[2rem] shadow-sm relative ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
                  <p className="text-sm md:text-base leading-relaxed serif-font">{msg.content}</p>
               </div>
             </div>
           ))}
           
           {!isUserStarted && (
             <div className="pt-8 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {!showMuses ? (
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setShowMuses(true)}
                      className="flex items-center space-x-2 px-6 py-2.5 rounded-2xl bg-white border border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                    >
                      <span>💡</span>
                      <span>寻求灵感支点？ Get Muses</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3 px-2">
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                      <div className="flex items-center space-x-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆长灵感 Daily Muse</span>
                        <button onClick={() => setShowMuses(false)} className="text-[10px] text-slate-300 hover:text-rose-400 font-bold">收起 ×</button>
                      </div>
                      <div className="h-[1px] flex-1 bg-slate-200"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {isMusesLoading ? (
                        [1,2,3].map(i => <div key={i} className="bg-white/50 border border-slate-100 h-24 rounded-3xl animate-pulse"></div>)
                      ) : (
                        muses.map(muse => (
                          <button 
                            key={muse.id} 
                            onClick={() => handleSelectMuse(muse)}
                            className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-left hover:border-indigo-400 hover:shadow-xl transition-all group"
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-xl group-hover:scale-110 transition-transform">{muse.icon}</span>
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{muse.title}</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed italic line-clamp-2">{muse.prompt}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
             </div>
           )}

           {isTyping && (
             <div className="flex justify-start animate-in fade-in duration-300">
               <div className="bg-white p-5 rounded-[2rem] rounded-tl-none border border-slate-100 flex space-x-1 items-center">
                 <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce"></div>
                 <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                 <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
               </div>
             </div>
           )}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-2xl bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] shadow-2xl p-3 flex flex-col space-y-3 z-50">
           <div className="flex items-end space-x-2">
             <textarea
               ref={textareaRef}
               rows={1}
               value={inputValue}
               onChange={(e) => setInputValue(e.target.value)}
               onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
               placeholder="在此进行交流..."
               className="flex-1 bg-slate-50 border-none rounded-3xl py-3 px-6 text-sm md:text-base text-slate-700 resize-none focus:ring-2 focus:ring-indigo-500/20 transition-all no-scrollbar max-h-40 min-h-[48px]"
             />
             <button 
               onClick={() => handleSend()}
               disabled={!inputValue.trim() || isTyping}
               className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50 transition-all shrink-0"
             >
               <span className="text-xl">↑</span>
             </button>
           </div>
           
           <div className="flex items-center justify-between px-2 pb-1">
              <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Shift+Enter 换行</div>
              <button 
                onClick={handleFinish}
                disabled={isFinishing || messages.filter(m => m.role === 'user').length === 0}
                className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center space-x-1"
              >
                {isFinishing ? <div className="w-3 h-3 border border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div> : <><span>✅ 整理成日记稿</span><span>→</span></>}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ChatEditor;
