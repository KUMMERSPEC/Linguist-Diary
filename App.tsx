import React, { useState, useEffect } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';

import Layout from './components/Layout';
import AuthView from './components/AuthView';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Review from './components/Review';
import History from './components/History';
import ChatEditor from './components/ChatEditor';
import ReviewVault from './components/ReviewVault';
import Rehearsal from './components/Rehearsal';
import RehearsalReport from './components/RehearsalReport';

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab } from './types';
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
  const [isSandbox, setIsSandbox] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('linguist_user');
    const savedEntries = localStorage.getItem('linguist_entries');

    if (savedEntries) {
      try { setEntries(JSON.parse(savedEntries)); } catch (e) { console.error(e); }
    }

    if (isFirebaseValid && app && db) {
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
          } catch (err) { console.error(err); }
        } else if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        setIsInitializing(false);
      });
      return unsubscribe;
    } else {
      if (savedUser) setUser(JSON.parse(savedUser));
      setIsInitializing(false);
    }
  }, []);

  const syncEntries = async (newEntries: DiaryEntry[]) => {
    localStorage.setItem('linguist_entries', JSON.stringify(newEntries));
    if (user && !isSandbox && isFirebaseValid && db) {
      try { await setDoc(doc(db, 'users', user.uid), { entries: newEntries }, { merge: true }); } catch (e) { console.error(e); }
    }
  };

  const handleAnalyze = async (text: string, language: string) => {
    setIsLoading(true);
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
    setView('history');
    setCurrentEntry(null);
    setRewriteBaseId(null);
  };

  const handleSaveRehearsal = async (language: string, rehearsal: RehearsalEvaluation) => {
    const now = new Date();
    const newEntry: DiaryEntry = {
      id: `rehearsal_${Date.now()}`,
      timestamp: Date.now(),
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      originalText: rehearsal.sourceText || "",
      language,
      type: 'rehearsal',
      rehearsal
    };
    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    await syncEntries(updatedEntries);
  };

  const handleSelectEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    if (entry.type === 'rehearsal') {
      setView('rehearsal_report');
    } else {
      setView('review');
    }
  };

  const handleRewrite = (entry: DiaryEntry) => {
    setRewriteBaseId(entry.id);
    setView('editor');
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("确定要从收藏馆中移除这件艺术品吗？")) return;
    const updatedEntries = entries.filter(e => e.id !== id);
    setEntries(updatedEntries);
    await syncEntries(updatedEntries);
  };

  const handleFinishChat = async (history: ChatMessage[], language: string) => {
    setIsLoading(true);
    setView('editor');
    try {
      const draft = history.filter(m => m.role === 'user').map(m => m.content).join('\n\n');
      const analysis = await analyzeDiaryEntry(draft, language, entries.slice(0, 5));
      const now = new Date();
      const newEntry: DiaryEntry = {
        id: `diary_${Date.now()}`,
        timestamp: Date.now(),
        date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: draft,
        language,
        type: 'diary',
        analysis,
        iterations: []
      };
      setCurrentEntry(newEntry);
      setView('review');
    } catch (e) {
      alert("分析失败，已为您保留草稿。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMastery = async (entryId: string, word: string, newMastery: number, record?: any) => {
    const updatedEntries = entries.map(e => {
      if (e.id === entryId && e.analysis) {
        const updatedVocab = e.analysis.advancedVocab.map(v => {
          if (v.word === word) {
            return { ...v, mastery: newMastery, practices: [...(v.practices || []), record].filter(Boolean) };
          }
          return v;
        });
        return { ...e, analysis: { ...e.analysis, advancedVocab: updatedVocab } };
      }
      return e;
    });
    setEntries(updatedEntries);
    await syncEntries(updatedEntries);
  };

  const handleLogout = () => {
    localStorage.removeItem('linguist_user');
    setUser(null);
    if (isFirebaseValid && app) {
      getAuth(app).signOut();
    }
  };

  const handleLogin = (userData: any, isMock: boolean) => {
    setUser(userData);
    setIsSandbox(isMock);
    localStorage.setItem('linguist_user', JSON.stringify(userData));
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthView auth={isFirebaseValid ? getAuth(app!) : null} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;
  }

  return (
    <Layout activeView={view} onViewChange={setView} user={user} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={() => setView('review_vault')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} initialText={rewriteBaseId ? entries.find(e => e.id === rewriteBaseId)?.originalText : ''} initialLanguage={rewriteBaseId ? entries.find(e => e.id === rewriteBaseId)?.language : 'English'} />}
      {view === 'review' && currentEntry?.analysis && <Review analysis={currentEntry.analysis} language={currentEntry.language} iterations={currentEntry.iterations} onSave={handleSaveEntry} onBack={() => { setCurrentEntry(null); setRewriteBaseId(null); setView('editor'); }} />}
      {view === 'history' && <History entries={entries} onSelect={handleSelectEntry} onDelete={handleDeleteEntry} onRewrite={handleRewrite} />}
      {view === 'chat' && <ChatEditor onFinish={handleFinishChat} allGems={entries.flatMap(e => e.analysis?.advancedVocab.map(v => ({ ...v, language: e.language })) || [])} />}
      {view === 'review_vault' && <ReviewVault entries={entries} onReviewEntry={handleSelectEntry} onUpdateMastery={handleUpdateMastery} />}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={handleSaveRehearsal} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && <RehearsalReport evaluation={currentEntry.rehearsal} language={currentEntry.language} date={currentEntry.date} onBack={() => setView('history')} />}
    </Layout>
  );
};

export default App;
