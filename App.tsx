
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

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isFirebaseValid = false;
let auth;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    const existingApps = getApps();
    app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseValid = true;
  }
} catch (e) {
  console.warn("Firebase config is present but invalid, falling back to local mode.");
}

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
  }, [isFirebaseValid]);

  const loadUserData = useCallback(async (userId: string, isMock: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!db || isMock) {
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));
        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));
        
        // 加载自定义资料
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
  }, [db]);

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
  }, [db]);

  useEffect(() => {
    if (user) {
      loadUserData(user.uid, user.isMock);
    }
  }, [user?.uid, user?.isMock]); // 仅在核心身份变化时加载

  useEffect(() => {
    if (user) {
      saveUserData(user.uid, user.isMock, entries, allAdvancedVocab);
    }
  }, [entries, allAdvancedVocab, user?.uid]);

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
    // 进入 Profile 时初始化编辑状态
    if (newView === 'profile' && user) {
      setEditName(user.displayName);
      setEditPhoto(user.photoURL);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const updatedUser = { ...user, displayName: editName, photoURL: editPhoto };
    setUser(updatedUser);
    
    try {
      if (!db || user.isMock) {
        localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ displayName: editName, photoURL: editPhoto }));
      } else {
        const docRef = doc(db, 'users', user.uid);
        await setDoc(docRef, { profile: { displayName: editName, photoURL: editPhoto } }, { merge: true });
      }
      alert("馆长档案已更新！");
    } catch (e) {
      console.error("Error saving profile:", e);
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
          <header className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 serif-font">馆长办公室 Curator's Office</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">在这里定义您的馆藏意志</p>
            </div>
            <div className="flex space-x-3">
              <button onClick={handleSaveProfile} className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 text-sm uppercase tracking-widest">
                保存馆长配置 SAVE
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* 左侧：形象管理 */}
            <div className="lg:col-span-8 space-y-8">
              <section className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">形象馆藏 Avatar Gallery</h4>
                </div>

                <div className="flex flex-col md:flex-row items-center space-x-0 md:space-x-10 space-y-8 md:space-y-0">
                  <div className="relative shrink-0">
                    <img src={editPhoto} className="w-32 h-32 md:w-48 md:h-48 rounded-[3rem] border-8 border-slate-50 shadow-2xl transition-all duration-500" alt="Selected Curator" />
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-lg">Current</div>
                  </div>
                  <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">馆长名号 Curator Title</label>
                       <input 
                         type="text" 
                         value={editName}
                         onChange={(e) => setEditName(e.target.value)}
                         className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-400 focus:bg-white p-5 rounded-2xl text-xl font-black serif-font outline-none transition-all shadow-inner"
                       />
                    </div>
                    <p className="text-xs text-slate-400 italic leading-relaxed">
                      该名号将显示在所有馆藏报告、侧边栏及启发对话中。
                    </p>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">形象预览预览 Persona Selection</label>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                    {AVATAR_SEEDS.map((item) => {
                      const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.seed}`;
                      const isSelected = editPhoto === url;
                      return (
                        <button 
                          key={item.seed}
                          onClick={() => setEditPhoto(url)}
                          title={item.label}
                          className={`relative group transition-all duration-500 ${isSelected ? 'scale-110' : 'hover:scale-105'}`}
                        >
                          <img src={url} className={`w-full aspect-square rounded-2xl border-4 transition-all ${isSelected ? 'border-indigo-600 shadow-xl shadow-indigo-100' : 'border-transparent grayscale opacity-50 hover:grayscale-0 hover:opacity-100'}`} />
                          {isSelected && <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[8px]">✓</div>}
                        </button>
                      );
                    })}
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

            {/* 右侧：统计概览 */}
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center space-x-3">
                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                  <h4 className="text-[11px] font-black text-slate-800 tracking-[0.2em] uppercase">馆藏概览 Archives Overview</h4>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">馆藏总数 Items</span>
                    <p className="text-3xl font-black text-slate-900 serif-font mt-1">{entries.length}</p>
                  </div>
                  <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">已点亮珍宝 Lit Gems</span>
                    <p className="text-3xl font-black text-indigo-600 serif-font mt-1">{allAdvancedVocab.filter(v => (v.mastery || 0) >= 3).length}</p>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                   <button 
                    onClick={() => handleViewChange('history')}
                    className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-700">进入展厅 Browse Exhibits</span>
                    <span className="text-slate-300 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                  <button 
                    onClick={() => handleViewChange('vocab_list')}
                    className="w-full flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all group"
                  >
                    <span className="text-xs font-bold text-slate-700">清点珍宝 Audit Gems</span>
                    <span className="text-slate-300 group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </section>
              
              <div className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-10 opacity-10 text-9xl font-serif -mr-10 -mt-10 transition-transform group-hover:scale-110">“</div>
                <p className="text-indigo-100 italic leading-[1.8] text-sm serif-font relative z-10">
                  “语言不是一种工具，它是你灵魂的居所，每一篇记录都是你在那里种下的花。”
                </p>
                <div className="mt-6 text-[10px] font-black uppercase tracking-widest opacity-60">Curator's Wisdom</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
