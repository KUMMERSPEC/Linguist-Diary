
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

import Layout from './components/Layout';
import AuthView from './components/AuthView';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Review from './components/Review';
import History from './components/History';
import ChatEditor from './components/ChatEditor';
import VocabListView from './components/VocabListView';
import VocabPractice from './components/VocabPractice';
import VocabPracticeDetailView from './components/VocabPracticeDetailView';
import Rehearsal from './components/Rehearsal';
import RehearsalReport from './components/RehearsalReport';

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab, PracticeRecord } from './types';
import { analyzeDiaryEntry } from './services/geminiService';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || ""
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: any = null;
let isFirebaseValid = false;

console.group("🏛️ 馆藏馆系统初始化诊断");
if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
  try {
    const existingApps = getApps();
    app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseValid = true;
    console.info("✅ Firebase 配置识别成功。真实登录功能已激活。");
  } catch (e) {
    console.error("❌ Firebase 初始化失败:", e);
  }
} else {
  console.warn("⚠️ 未检测到有效的 Firebase API Key。");
}
console.groupEnd();

const AVATAR_SEEDS = [
  { seed: 'Felix', label: '沉稳博学者' },
  { seed: 'Aneka', label: '先锋艺术家' },
  { seed: 'Oliver', label: '好奇探险家' },
  { seed: 'Willow', label: '灵感诗人' },
  { seed: 'Toby', label: '严谨学者' },
  { seed: 'Milo', label: '活力博主' },
  { seed: 'Sasha', label: '深邃哲人' },
  { seed: 'Buster', label: '极简主义者' },
];

const App: React.FC = () => {
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string, isMock: boolean } | null>(null);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [rewriteBaseId, setRewriteBaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatLanguage, setChatLanguage] = useState('');
  const [prefilledEditorText, setPrefilledEditorText] = useState('');

  const [allAdvancedVocab, setAllAdvancedVocab] = useState<(AdvancedVocab & { language: string })[]>([]);
  const [selectedVocabForPracticeId, setSelectedVocabForPracticeId] = useState<string | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);

  // 个人资料编辑状态
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
          isMock: false
        });
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = useCallback(async (userId: string, isMock: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!db || isMock) {
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));
        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));
        
        const localProfile = localStorage.getItem(`linguist_profile_${userId}`);
        if (localProfile) {
          const { displayName, photoURL } = JSON.parse(localProfile);
          setUser(prev => prev ? { ...prev, displayName, photoURL } : null);
        }
      } else {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.entries) setEntries(data.entries);
          if (data.advancedVocab) setAllAdvancedVocab(data.advancedVocab);
          if (data.profile) {
             setUser(prev => prev ? { ...prev, ...data.profile } : null);
          }
        }
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveUserData = useCallback(async (userId: string, isMock: boolean, currentEntries: DiaryEntry[], currentVocab: (AdvancedVocab & { language: string })[]) => {
    try {
      if (!db || isMock) {
        localStorage.setItem(`linguist_entries_${userId}`, JSON.stringify(currentEntries));
        localStorage.setItem(`linguist_vocab_${userId}`, JSON.stringify(currentVocab));
      } else {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { entries: currentEntries, advancedVocab: currentVocab }, { merge: true });
      }
    } catch (e) {
      console.error("Error saving user data:", e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadUserData(user.uid, user.isMock);
    }
  }, [user?.uid, user?.isMock, loadUserData]);

  useEffect(() => {
    if (user) {
      saveUserData(user.uid, user.isMock, entries, allAdvancedVocab);
    }
  }, [entries, allAdvancedVocab, user?.uid, saveUserData]);

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    setUser({ ...userData, isMock });
    setView('dashboard');
  };

  const handleLogout = async () => {
    if (user?.isMock) {
      setUser(null);
      setEntries([]);
      setAllAdvancedVocab([]);
    } else if (auth) {
      await auth.signOut();
    }
    setView('dashboard');
  };

  const handleViewChange = (newView: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(newView);
    setError(null);
    setSelectedVocabForPracticeId(vocabId || null);
    setIsPracticeActive(!!isPracticeActive);
    if (newView !== 'editor') {
      setPrefilledEditorText('');
      setChatLanguage('');
    }
    if (newView === 'profile' && user) {
      setEditName(user.displayName);
      setEditPhoto(user.photoURL);
      setIsAvatarPickerOpen(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    const updatedUser = { ...user, displayName: editName, photoURL: editPhoto };
    setUser(updatedUser);
    
    try {
      if (!db || user.isMock) {
        localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ displayName: editName, photoURL: editPhoto }));
      } else {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { profile: { displayName: editName, photoURL: editPhoto } }, { merge: true });
      }
      alert("馆长档案已云端同步！");
    } catch (e) {
      console.error("Error saving profile:", e);
      setError("保存个人配置失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async (text: string, language: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const historyContext = entries.filter(e => e.language === language && e.analysis).slice(-5);
      const analysis = await analyzeDiaryEntry(text, language, historyContext);

      const timestamp = Date.now();
      const date = new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

      if (rewriteBaseId && currentEntry) {
        const baseEntryIndex = entries.findIndex(e => e.id === rewriteBaseId);
        if (baseEntryIndex !== -1) {
          const updatedEntries = [...entries];
          const baseEntry = { ...updatedEntries[baseEntryIndex] };
          if (!baseEntry.iterations) baseEntry.iterations = [];
          if (baseEntry.analysis && baseEntry.iterations.length === 0) {
              baseEntry.iterations.push({
                  text: baseEntry.originalText,
                  timestamp: baseEntry.timestamp,
                  analysis: baseEntry.analysis
              });
          }
          baseEntry.iterations.push({
            text: text,
            timestamp: timestamp,
            analysis: analysis
          });
          updatedEntries[baseEntryIndex] = baseEntry;
          setEntries(updatedEntries);
          setCurrentEntry(baseEntry);
          setRewriteBaseId(null);
        }
      } else {
        const newEntry: DiaryEntry = {
          id: uuidv4(),
          timestamp: timestamp,
          date: date,
          originalText: text,
          language: language,
          type: 'diary',
          analysis: analysis,
          iterations: []
        };
        setEntries(prev => [newEntry, ...prev]);
        setCurrentEntry(newEntry);
      }

      setAllAdvancedVocab(prevVocab => {
        const vocabMap = new Map<string, AdvancedVocab & { language: string }>();
        prevVocab.forEach(v => vocabMap.set(`${v.word.toLowerCase()}-${v.language.toLowerCase()}`, v));
        analysis.advancedVocab.forEach(newV => {
          const key = `${newV.word.toLowerCase()}-${language.toLowerCase()}`;
          const existing = vocabMap.get(key);
          if (existing) {
            vocabMap.set(key, { 
              ...existing, 
              meaning: newV.meaning,
              usage: newV.usage,
              level: newV.level
            });
          } else {
            vocabMap.set(key, { ...newV, language, mastery: 0, practices: [] });
          }
        });
        return Array.from(vocabMap.values());
      });

      setPrefilledEditorText('');
      setView('review');
    } catch (e: any) {
      setError(e.message || "AI 分析失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatFinish = (transcript: ChatMessage[], language: string) => {
    const draft = transcript
      .filter(m => m.role === 'user')
      .map(m => m.content.trim())
      .join('\n\n');
    setPrefilledEditorText(draft);
    setChatLanguage(language);
    setView('editor');
  };

  const handleSaveEntry = () => {
    setView('history');
    setCurrentEntry(null);
    setRewriteBaseId(null);
  };

  const handleSelectEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    if (entry.type === 'rehearsal' && entry.rehearsal) {
      setView('rehearsal_report');
    } else {
      setView('review');
    }
  };

  const handleRewriteEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    setRewriteBaseId(entry.id);
    setView('editor');
  };

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("确定要删除这篇馆藏吗？")) {
      setEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const handleSaveRehearsalToMuseum = (language: string, evaluation: RehearsalEvaluation) => {
    const newEntry: DiaryEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      originalText: evaluation.userRetelling || evaluation.sourceText || '',
      language: language,
      type: 'rehearsal',
      rehearsal: evaluation,
      iterations: []
    };
    setEntries(prev => [newEntry, ...prev]);
    alert("演练报告已存入！");
    setView('history');
  };

  const handleUpdateMastery = useCallback((entryId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    setAllAdvancedVocab(prev => {
      return prev.map(vocab => {
        if (vocab.word === word) {
          const updatedVocab = { ...vocab, mastery: newMastery };
          if (record && record.status === 'Perfect') {
            if (!updatedVocab.practices) updatedVocab.practices = [];
            updatedVocab.practices = [...updatedVocab.practices, record];
          }
          return updatedVocab;
        }
        return vocab;
      });
    });
  }, []);

  const getCombinedAllGems = useCallback(() => {
    const vocabMap = new Map<string, AdvancedVocab & { language: string }>();
    allAdvancedVocab.forEach(v => vocabMap.set(`${v.word.toLowerCase()}-${v.language.toLowerCase()}`, v));
    return Array.from(vocabMap.values());
  }, [allAdvancedVocab]);

  const handleStartReviewFromDashboard = () => {
    if (allAdvancedVocab.length > 0) {
      const randomIndex = Math.floor(Math.random() * allAdvancedVocab.length);
      const selectedVocab = allAdvancedVocab[randomIndex];
      const vocabId = `${selectedVocab.word}-${selectedVocab.language}`;
      handleViewChange('vocab_practice', vocabId, true);
    } else {
      alert("珍宝库中没有词汇可供练习。");
      handleViewChange('vocab_list');
    }
  };

  if (!user) {
    return (
      <AuthView
        auth={auth || null}
        isFirebaseValid={isFirebaseValid}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout}>
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="flex flex-col items-center space-y-4 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100 text-slate-700">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-lg font-semibold">AI 馆长正在处理中...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-right-8 fade-in duration-500">
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl shadow-lg flex items-center space-x-3 max-w-sm">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold mb-1">操作失败</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">✕</button>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <Dashboard
          onNewEntry={() => handleViewChange('editor')}
          onStartReview={handleStartReviewFromDashboard}
          entries={entries}
        />
      )}
      {view === 'editor' && (
        <Editor
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          initialText={prefilledEditorText || (rewriteBaseId && currentEntry ? (currentEntry.iterations && currentEntry.iterations.length > 0 ? currentEntry.iterations[currentEntry.iterations.length-1].text : currentEntry.originalText) : '')}
          initialLanguage={chatLanguage || currentEntry?.language || 'English'}
        />
      )}
      {view === 'review' && currentEntry && currentEntry.analysis && (
        <Review
          analysis={currentEntry.analysis}
          language={currentEntry.language}
          iterations={currentEntry.iterations}
          onSave={handleSaveEntry}
          onBack={() => handleViewChange('dashboard')}
        />
      )}
      {view === 'history' && (
        <History
          entries={entries}
          onSelect={handleSelectEntry}
          onDelete={handleDeleteEntry}
          onRewrite={handleRewriteEntry}
        />
      )}
      {view === 'chat' && (
        <ChatEditor
          onFinish={handleChatFinish}
          allGems={getCombinedAllGems()}
        />
      )}
      {view === 'vocab_list' && (
        <VocabListView
          allAdvancedVocab={allAdvancedVocab}
          onViewChange={handleViewChange}
          onUpdateMastery={handleUpdateMastery}
        />
      )}
      {view === 'vocab_practice' && selectedVocabForPracticeId && (
        <VocabPractice
          selectedVocabId={selectedVocabForPracticeId}
          allAdvancedVocab={allAdvancedVocab}
          onUpdateMastery={handleUpdateMastery}
          onBackToVocabList={() => handleViewChange('vocab_list')}
          onViewChange={handleViewChange}
          isPracticeActive={isPracticeActive}
        />
      )}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && (
        <VocabPracticeDetailView
          selectedVocabId={selectedVocabForPracticeId}
          allAdvancedVocab={allAdvancedVocab}
          onBackToPracticeHistory={() => handleViewChange('vocab_list')}
        />
      )}
      {view === 'rehearsal' && (
        <Rehearsal
          onSaveToMuseum={handleSaveRehearsalToMuseum}
        />
      )}
      {view === 'rehearsal_report' && currentEntry && currentEntry.rehearsal && (
        <RehearsalReport
          evaluation={currentEntry.rehearsal}
          language={currentEntry.language}
          date={currentEntry.date}
          onBack={() => handleViewChange('history')}
        />
      )}
      {view === 'profile' && (
        <div className="flex flex-col animate-in fade-in duration-700 py-6 max-w-4xl mx-auto space-y-10 px-4">
          <header className="flex flex-col items-center text-center space-y-2 border-b border-slate-100 pb-8">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font">馆长办公室 Curator's Office</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em]">定义您的馆藏意志与馆长身份</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* 左侧：核心名片与寄语 */}
            <div className="lg:col-span-8 space-y-8">
              <section className="bg-white rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-10 md:p-14 space-y-10">
                  {/* 身份区 */}
                  <div className="flex flex-col md:flex-row items-center gap-10">
                    <div className="relative group cursor-pointer" onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}>
                      <img src={editPhoto} className="w-40 h-40 md:w-52 md:h-52 rounded-[3.5rem] border-8 border-slate-50 shadow-2xl transition-all duration-500 group-hover:scale-105" alt="Curator" />
                      <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white group-hover:rotate-12 transition-transform">
                        <span className="text-xl">✨</span>
                      </div>
                      <div className="absolute inset-0 bg-black/20 rounded-[3.5rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <span className="text-white text-[10px] font-black uppercase tracking-widest">更换形象</span>
                      </div>
                    </div>

                    <div className="flex-1 space-y-6 text-center md:text-left">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">当前名号 CURATOR TITLE</label>
                        <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white p-6 rounded-3xl text-3xl font-black serif-font outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 寄语区 (从下方挪到这里) */}
                  <div className="bg-indigo-600 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl font-serif -mr-10 -mt-10 transition-transform group-hover:scale-110">“</div>
                    <div className="relative z-10 space-y-4">
                      <div className="text-[10px] font-black uppercase tracking-widest opacity-60">馆长寄语 Curator's Wisdom</div>
                      <p className="text-indigo-50 italic leading-[1.8] text-lg md:text-xl serif-font pr-10">
                        “语言不是一种工具，它是你灵魂的居所，每一篇记录都是你在那里种下的花。”
                      </p>
                    </div>
                  </div>

                  {/* 头像选择入口 (由确认键触发，逻辑独立) */}
                  {isAvatarPickerOpen && (
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 animate-in slide-in-from-top-4 duration-500 space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">形象画廊 Avatar Gallery</h4>
                        <button onClick={() => setIsAvatarPickerOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">✕</button>
                      </div>
                      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                        {AVATAR_SEEDS.map((item) => {
                          const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`;
                          const isSelected = editPhoto === url;
                          return (
                            <button 
                              key={item.seed}
                              onClick={() => { setEditPhoto(url); setIsAvatarPickerOpen(false); }}
                              className={`relative transition-all duration-300 ${isSelected ? 'scale-110' : 'hover:scale-105 opacity-60 hover:opacity-100'}`}
                            >
                              <img src={url} className={`w-full aspect-square rounded-2xl border-4 transition-all ${isSelected ? 'border-indigo-600 shadow-xl' : 'border-white shadow-sm'}`} alt={item.label} />
                              {isSelected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px]">✓</div>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* 保存按钮 (挪到页面底部) */}
                  <div className="pt-4">
                    <button 
                      onClick={handleSaveProfile} 
                      className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 text-base uppercase tracking-[0.2em] flex items-center justify-center space-x-3"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>🏛️ 同步馆长档案 SYNC</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>

              <div className="bg-rose-50 p-8 rounded-[3rem] border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6">
                 <div className="text-center md:text-left">
                   <h4 className="text-rose-900 font-bold">撤离收藏馆 Security</h4>
                   <p className="text-rose-400 text-xs mt-1">退出当前登录，所有本地缓存将安全保留。</p>
                 </div>
                 <button onClick={handleLogout} className="bg-rose-600 text-white px-8 py-3 rounded-2xl font-bold text-sm hover:bg-rose-700 transition-all shadow-lg active:scale-95 uppercase tracking-widest">
                    登出 LOGOUT
                 </button>
              </div>
            </div>

            {/* 右侧：概览 */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-8 rounded-[3.5rem] border border-slate-200 shadow-xl space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">馆藏概览 Archives</h4>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 transition-colors hover:border-indigo-200 group">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆藏总数 ITEMS</span>
                    <p className="text-4xl font-black text-slate-900 serif-font mt-1 group-hover:text-indigo-600">{entries.length}</p>
                  </div>
                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100 transition-colors hover:border-indigo-400 group">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">已点亮珍宝 LIT GEMS</span>
                    <p className="text-4xl font-black text-indigo-600 serif-font mt-1">{allAdvancedVocab.filter(v => (v.mastery || 0) >= 3).length}</p>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                   <button 
                    onClick={() => handleViewChange('history')}
                    className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-700">进入展厅 Browse Exhibits</span>
                    <span className="text-slate-300 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button 
                    onClick={() => handleViewChange('vocab_list')}
                    className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-700">清点珍宝 Audit Gems</span>
                    <span className="text-slate-300 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
