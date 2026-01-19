
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
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

// 使用用户提供的真实 Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyAVr3IGO2kdjAhV2ZWnnfUmtlSCtqVDtGk",
  authDomain: "gen-lang-client-0745356711.firebaseapp.com",
  projectId: "gen-lang-client-0745356711",
  storageBucket: "gen-lang-client-0745356711.firebasestorage.app",
  messagingSenderId: "941377483687",
  appId: "1:941377483687:web:e29b53fbd2f8625ccd7c82",
  measurementId: "G-GZF5CJ41Y0"
};

// 初始化 Firebase 实例
let db: any = null;
let auth: any = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn("Firebase 初始化失败，请检查配置是否正确", e);
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 1. 监听 Firebase Auth 状态变化
  useEffect(() => {
    if (!auth) {
      setAuthChecking(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 实时同步当前登录用户的日记藏品
  useEffect(() => {
    if (db && user) {
      // 通过 userId 过滤数据，确保私密性
      const q = query(
        collection(db, "entries"), 
        where("userId", "==", user.uid),
        orderBy("timestamp", "desc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const cloudEntries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DiaryEntry[];
        setEntries(cloudEntries);
      }, (error) => {
        console.error("Firestore 同步错误 (请检查数据库 Rules 设置):", error);
      });
      return () => unsubscribe();
    } else if (!user) {
      setEntries([]);
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
    } catch (error) {
      alert("AI 分析失败，请确认您的 Gemini API Key 是否有效。");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishChat = async (transcript: ChatMessage[], language: string) => {
    setIsLoading(true);
    try {
      const synthesizedText = await synthesizeDiary(transcript, language);
      await handleAnalyze(synthesizedText, language);
    } catch (error) {
      alert("对话整理失败，请重试。");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (currentEntry && user && db) {
      setIsLoading(true);
      try {
        // 保存时携带当前用户的 UID
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
        console.error("Save Error:", e);
        alert("保存到云端失败。请确保您已在 Firebase Console 中创建了 Firestore 数据库，并设置了正确的安全规则。");
      } finally {
        setIsLoading(false);
      }
    } else if (!user) {
      alert("请先登录以同步您的学习进度。");
    }
  };

  const handleSelectEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    setView('review');
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mb-4 flex items-center justify-center text-white text-2xl">🖋️</div>
          <p className="text-slate-400 font-medium">正在开启藏馆大门...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，展示登录/注册入口
  if (!user) {
    return <AuthView auth={auth} />;
  }

  return (
    <Layout activeView={view} onViewChange={setView} user={user} auth={auth}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} />}
      {view === 'chat' && <ChatEditor onFinish={handleFinishChat} />}
      {view === 'review' && currentEntry && (
        <Review entry={currentEntry} onSave={handleSave} />
      )}
      {view === 'history' && (
        <History entries={entries} onSelect={handleSelectEntry} />
      )}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-md z-[100] flex flex-col items-center justify-center space-y-6">
          <div className="relative">
             <div className="w-20 h-20 border-4 border-indigo-100 rounded-full"></div>
             <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800 serif-font">正在镌刻记忆...</p>
            <p className="text-sm text-slate-500 mt-2">AI 馆长正在为您整理云端藏品</p>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
