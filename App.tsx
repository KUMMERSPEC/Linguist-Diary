
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

// Firebase 初始化
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
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
  console.warn("Firebase Init Failed", e);
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('正在镌刻记忆...');

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
      // 核心改动：移除 orderBy 以避免“需要索引 (Requires Index)”报错
      const q = query(collection(db, "entries"), where("userId", "==", user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiaryEntry[];
        // 在前端进行排序：按时间戳倒序
        const sortedEntries = cloudEntries.sort((a, b) => b.timestamp - a.timestamp);
        setEntries(sortedEntries);
      }, (err) => {
        console.error("Firestore 同步错误 (请检查数据库 Rules 设置):", err);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleAnalyze = async (text: string, language: string) => {
    setIsLoading(true);
    setLoadingText('语言教授正在审阅您的手稿...');
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
      console.error(error);
      alert(`⚠️ 分析失败：\n${error.message}\n\n请确保已在设置中正确配置 API_KEY。`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishChat = async (transcript: ChatMessage[], language: string) => {
    setIsLoading(true);
    setLoadingText('正在将对话片段整理成册...');
    try {
      const synthesizedText = await synthesizeDiary(transcript, language);
      if (synthesizedText === "Synthesis failed.") throw new Error("对话整理失败");
      await handleAnalyze(synthesizedText, language);
    } catch (error: any) {
      alert("对话整理失败：" + error.message);
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (currentEntry && user && db) {
      setIsLoading(true);
      setLoadingText('正在存入云端博物馆...');
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
      } catch (e: any) {
        console.error("Save Error:", e);
        alert(`保存失败！可能是权限不足。\n请确保 Firebase Rules 已设为: allow read, write: if request.auth != null;`);
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
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center space-y-10 animate-in fade-in duration-500">
          <div className="relative">
             <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full scale-150 animate-pulse"></div>
             <div className="relative w-24 h-24">
                <div className="absolute inset-0 border-[6px] border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 border-[6px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
             <div className="absolute inset-0 flex items-center justify-center text-3xl">🖋️</div>
          </div>
          <div className="text-center space-y-3">
            <p className="text-2xl font-bold text-slate-800 serif-font tracking-tight">{loadingText}</p>
            <p className="text-slate-400 text-sm font-medium animate-pulse">AI 正在进行跨时空的语法重塑...</p>
          </div>
          <div className="w-64 h-1.5 bg-slate-100 rounded-full overflow-hidden">
             <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
