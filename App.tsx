
import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, Firestore } from 'firebase/firestore';

import Layout from './components/Layout';
import AuthView from './components/AuthView';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Review from './components/Review';
import History from './components/History';
import ChatEditor from './components/ChatEditor';
import ReviewVault from './components/ReviewVault';
import Rehearsal from './components/Rehearsal';

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration } from './types';
import { analyzeDiaryEntry, synthesizeDiary } from './services/geminiService';

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
let isFirebaseValid = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    const existingApps = getApps();
    app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];
    db = getFirestore(app);
    isFirebaseValid = true;
  }
} catch (e) {
  console.warn("Firebase config is present but invalid, falling back to local mode.");
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string } | null>(null);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [rewriteBaseId, setRewriteBaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('加载中...');
  const [isSandbox, setIsSandbox] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // 检查本地是否有已登录的用户
    const savedUser = localStorage.getItem('linguist_user');
    const savedEntries = localStorage.getItem('linguist_entries');

    if (savedEntries) {
      try {
        setEntries(JSON.parse(savedEntries));
      } catch (e) {
        console.error("Failed to parse local entries");
      }
    }

    if (isFirebaseValid && app) {
      const auth = getAuth(app);
      const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const userData = {
            uid: fbUser.uid,
            displayName: fbUser.displayName || "馆长",
            photoURL: fbUser.photoURL || ""
          };
          setUser(userData);
          setIsSandbox(false);
          try {
            const docRef = doc(db!, 'users', fbUser.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const cloudEntries = docSnap.data().entries || [];
              if (cloudEntries.length > 0) setEntries(cloudEntries);
            }
          } catch (err) {
            console.warn("Cloud sync failed, staying in local-first mode.");
          }
        } else if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        setIsInitializing(false);
      });
      return unsubscribe;
    } else {
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsInitializing(false);
    }
  }, []);

  const syncEntries = async (newEntries: DiaryEntry[]) => {
    localStorage.setItem('linguist_entries', JSON.stringify(newEntries));
    if (user && !isSandbox && isFirebaseValid && db) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { entries: newEntries });
      } catch (e) {
        console.warn("Firebase update failed");
      }
    }
  };

  const handleAnalyze = async (text: string, language: string) => {
    setIsLoading(true);
    setLoadingText(rewriteBaseId ? '正在打磨新的版本...' : '正在为您审阅初稿...');
    try {
      const analysis = await analyzeDiaryEntry(text, language, entries.slice(0, 5));
      const now = new Date();
      
      if (rewriteBaseId) {
        const baseEntry = entries.find(e => e.id === rewriteBaseId);
        if (baseEntry) {
          const newIteration: DiaryIteration = {
            text: baseEntry.originalText,
            timestamp: baseEntry.timestamp,
            analysis: baseEntry.analysis!
          };
          const updatedEntry: DiaryEntry = {
            ...baseEntry,
            timestamp: now.getTime(),
            originalText: text,
            analysis: analysis,
            iterations: [...(baseEntry.iterations || []), newIteration]
          };
          setCurrentEntry(updatedEntry);
        }
      } else {
        const newEntry: DiaryEntry = {
          id: `diary_${Date.now()}`,
          timestamp: Date.now(),
          date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          originalText: text,
          language,
          type: 'diary',
          analysis,
          iterations: []
        };
        setCurrentEntry(newEntry);
      }
      setView('review');
    } catch (error: any) {
      alert(`⚠️ 分析失败：${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!currentEntry) return;
    const updatedEntries = rewriteBaseId 
      ? entries.map(e => e.id === rewriteBaseId ? currentEntry : e)
      : [currentEntry, ...entries];
    
    setEntries(updatedEntries);
    await syncEntries(updatedEntries);
    setView('dashboard');
    setCurrentEntry(null);
    setRewriteBaseId(null);
  };

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock = false) => {
    setUser(userData);
    setIsSandbox(isMock);
    localStorage.setItem('linguist_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    if (isFirebaseValid && !isSandbox && app) {
      await getAuth(app).signOut();
    }
    localStorage.removeItem('linguist_user');
    setUser(null);
    setView('dashboard');
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 text-sm font-medium animate-pulse">正在进入收藏馆...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView 
        auth={app ? getAuth(app) : null} 
        isFirebaseValid={isFirebaseValid}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Layout activeView={view} onViewChange={setView} user={user} onLogout={handleLogout}>
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center space-y-6">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center text-2xl">🖋️</div>
          </div>
          <p className="text-slate-600 font-bold animate-pulse serif-font">{loadingText}</p>
        </div>
      )}
      {view === 'dashboard' && <Dashboard entries={entries} onNewEntry={() => { setRewriteBaseId(null); setView('editor'); }} onStartReview={() => setView('review_vault')} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} initialText={rewriteBaseId ? entries.find(e => e.id === rewriteBaseId)?.originalText : ''} initialLanguage={rewriteBaseId ? entries.find(e => e.id === rewriteBaseId)?.language : 'English'} />}
      {view === 'review' && currentEntry?.analysis && <Review analysis={currentEntry.analysis} language={currentEntry.language} iterations={currentEntry.iterations} onSave={handleSaveEntry} onBack={() => setView('editor')} />}
      {view === 'history' && <History entries={entries} onSelect={(e) => { if(e.type==='diary') {setCurrentEntry(e); setView('review');} }} onDelete={async (id) => { if(!window.confirm("移除吗？")) return; const updated = entries.filter(e => e.id !== id); setEntries(updated); await syncEntries(updated); }} onRewrite={(e) => { setRewriteBaseId(e.id); setView('editor'); }} />}
      {view === 'chat' && <ChatEditor onFinish={async (t, l) => { setIsLoading(true); try { const text = await synthesizeDiary(t, l); await handleAnalyze(text, l); } finally { setIsLoading(false); } }} />}
      {view === 'review_vault' && <ReviewVault entries={entries} onUpdateMastery={async (eid, w, m, r) => { const updated = entries.map(entry => { if (entry.id === eid && entry.analysis) { const uv = entry.analysis.advancedVocab.map(v => v.word === w ? { ...v, mastery: m, practices: r ? [r, ...(v.practices || [])] : v.practices } : v); return { ...entry, analysis: { ...entry.analysis, advancedVocab: uv } }; } return entry; }); setEntries(updated); await syncEntries(updated); }} onReviewEntry={(e) => { setCurrentEntry(e); setView('review'); }} />}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={async (l, r) => { const newEntry: DiaryEntry = { id: `reh_${Date.now()}`, timestamp: Date.now(), date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }), originalText: r.userRetelling || "", language: l, type: 'rehearsal', rehearsal: r }; const updated = [newEntry, ...entries]; setEntries(updated); await syncEntries(updated); }} />}
    </Layout>
  );
};

export default App;
