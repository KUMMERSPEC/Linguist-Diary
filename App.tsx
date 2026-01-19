
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Review from './components/Review';
import History from './components/History';
import ChatEditor from './components/ChatEditor';
import AuthView from './components/AuthView';
import { ViewState, DiaryEntry, ChatMessage } from './types';
import { analyzeDiaryEntry, synthesizeDiary } from './services/geminiService';

// Firebase 初始化 (保持用户提供的配置)
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAVr3IGO2kdjAhV2ZWnnfUmtlSCtqVDtGk",
  authDomain: "gen-lang-client-0745356711.firebaseapp.com",
  projectId: "gen-lang-client-0745356711",
  storageBucket: "gen-lang-client-0745356711.firebasestorage.app",
  messagingSenderId: "941377483687",
  appId: "1:941377483687:web:e29b53fbd2f8625ccd7c82",
  measurementId: "G-GZF5CJ41Y0"
};

let db: any = null;
let auth: any = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase 初始化失败", e);
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!auth) { setAuthChecking(false); return; }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (db && user) {
      const q = query(collection(db, "entries"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiaryEntry[];
        setEntries(cloudEntries);
      }, (err) => console.error("Firestore Error:", err));
      return () => unsubscribe();
    }
  }, [user]);

  const handleAnalyze = async (text: string, language: string) => {
    setIsLoading(true);
    try {
      const analysis = await analyzeDiaryEntry(text, language);
      const now = new Date();
      const newEntry: DiaryEntry = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: text,
        language,
        analysis
      };
      setCurrentEntry(newEntry);
      setView('review');
    } catch (error: any) {
      // 展示更详细的错误
      alert(`⚠️ 馆藏分析失败：\n${error.message}\n\n建议：检查 API Key 权限或绑定结算信息。`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishChat = async (transcript: ChatMessage[], language: string) => {
    setIsLoading(true);
    try {
      const synthesizedText = await synthesizeDiary(transcript, language);
      await handleAnalyze(synthesizedText, language);
    } catch (error: any) {
      alert("对话整理失败：" + error.message);
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (currentEntry && user && db) {
      setIsLoading(true);
      try {
        await addDoc(collection(db, "entries"), {
          userId: user.uid,
          timestamp: currentEntry.timestamp,
          date: currentEntry.date,
          originalText: currentEntry.originalText,
          language: currentEntry.language,
          analysis: currentEntry.analysis
        });
        setView('history');
        setCurrentEntry(null);
      } catch (e) {
        alert("保存失败，请检查数据库规则设置。");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (authChecking) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div></div>;
  if (!user) return <AuthView auth={auth} />;

  return (
    <Layout activeView={view} onViewChange={setView} user={user} auth={auth}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} />}
      {view === 'chat' && <ChatEditor onFinish={handleFinishChat} />}
      {view === 'review' && currentEntry && <Review entry={currentEntry} onSave={handleSave} />}
      {view === 'history' && <History entries={entries} onSelect={(e) => { setCurrentEntry(e); setView('review'); }} />}
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center space-y-6">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
             <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-xl font-bold text-slate-800 serif-font">正在镌刻记忆...</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
