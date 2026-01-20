
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Editor from './components/Editor';
import Review from './components/Review';
import History from './components/History';
import ChatEditor from './components/ChatEditor';
import AuthView from './components/AuthView';
import ReviewVault from './components/ReviewVault';
import Rehearsal from './components/Rehearsal';
import { ViewState, DiaryEntry, ChatMessage, PracticeRecord, RehearsalEvaluation } from './types';
import { analyzeDiaryEntry, synthesizeDiary } from './services/geminiService';

// Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, query, where, doc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
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
} catch (e) { console.warn("Firebase Init Failed", e); }

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
    return onAuthStateChanged(auth, (u) => { setUser(u); setAuthChecking(false); });
  }, []);

  useEffect(() => {
    if (db && user) {
      const q = query(collection(db, "entries"), where("userId", "==", user.uid));
      return onSnapshot(q, (snapshot) => {
        const cloudEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DiaryEntry[];
        setEntries(cloudEntries.sort((a, b) => b.timestamp - a.timestamp));
      });
    }
  }, [user]);

  const handleAnalyze = async (text: string, language: string) => {
    setIsLoading(true);
    setLoadingText('语言教授正在审阅您的手稿...');
    try {
      const analysis = await analyzeDiaryEntry(text, language);
      const now = new Date();
      setCurrentEntry({
        id: `temp_${Date.now()}`, // 使用临时ID
        timestamp: Date.now(),
        date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: text,
        language,
        type: 'diary',
        analysis
      });
      setView('review');
    } catch (error: any) { alert(`⚠️ 分析失败：${error.message}`); }
    finally { setIsLoading(false); }
  };

  const handleSaveRehearsal = async (language: string, evalResult: RehearsalEvaluation) => {
    if (!user) { alert("请先登录馆长账号。"); return; }
    if (!db) { alert("博物馆数据库尚未连接，请检查网络。"); return; }
    
    setIsLoading(true);
    setLoadingText('正在将演练成果存入收藏馆...');
    try {
      const now = new Date();
      const docData: any = {
        userId: user.uid,
        timestamp: Date.now(),
        date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: evalResult.userRetelling || "",
        language,
        type: 'rehearsal',
        rehearsal: evalResult
      };
      await addDoc(collection(db, "entries"), docData);
      setView('history');
    } catch (e: any) { alert(`保存失败：${e.message}`); }
    finally { setIsLoading(false); }
  };

  const handleSave = async () => {
    if (!currentEntry) return;
    if (!user) { alert("请先登录馆长账号。"); return; }
    if (!db) { alert("博物馆数据库连接失败，请刷新页面。"); return; }

    setIsLoading(true);
    setLoadingText('正在正式收录入馆...');
    try {
      // 关键修复：动态构建对象，移除 undefined 字段，Firestore 不接受 undefined
      const docData: any = {
        userId: user.uid,
        timestamp: currentEntry.timestamp,
        date: currentEntry.date,
        originalText: currentEntry.originalText,
        language: currentEntry.language,
        type: currentEntry.type
      };

      if (currentEntry.analysis) docData.analysis = currentEntry.analysis;
      if (currentEntry.rehearsal) docData.rehearsal = currentEntry.rehearsal;

      await addDoc(collection(db, "entries"), docData);
      
      setView('history');
      setCurrentEntry(null);
    } catch (e: any) { 
      console.error("Save Error:", e);
      alert(`入馆失败：${e.message || "未知原因"}`); 
    }
    finally { setIsLoading(false); }
  };

  const handleDelete = async (entryId: string) => {
    if (!db || !user) return;
    if (window.confirm("确定要销毁这件馆藏吗？")) {
      setIsLoading(true);
      try {
        await deleteDoc(doc(db, "entries", entryId));
        if (currentEntry?.id === entryId) { setCurrentEntry(null); setView('history'); }
      } catch (e) { alert("删除失败"); }
      finally { setIsLoading(false); }
    }
  };

  const handleUpdateMastery = async (entryId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!db || !user) return;
    const entry = entries.find(e => e.id === entryId);
    if (!entry || !entry.analysis) return;
    
    const updatedVocab = entry.analysis.advancedVocab.map(v => {
      if (v.word === word) {
        const currentPractices = v.practices || [];
        return { 
          ...v, 
          mastery: newMastery, 
          practices: record ? [...currentPractices, record] : currentPractices 
        };
      }
      return v;
    });

    try {
      const entryRef = doc(db, "entries", entryId);
      await updateDoc(entryRef, { "analysis.advancedVocab": updatedVocab });
    } catch (e) { console.error("Update failed", e); }
  };

  if (authChecking) return <div className="h-screen w-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div></div>;
  if (!user) return <AuthView auth={auth} />;

  return (
    <Layout activeView={view} onViewChange={setView} user={user} auth={auth}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={() => setView('review_vault')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} />}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={handleSaveRehearsal} />}
      {view === 'chat' && <ChatEditor onFinish={async (t, l) => {
        setIsLoading(true);
        const text = await synthesizeDiary(t, l);
        await handleAnalyze(text, l);
      }} />}
      {view === 'review' && currentEntry && <Review entry={currentEntry} onSave={handleSave} onDelete={handleDelete} />}
      {view === 'history' && <History entries={entries} onSelect={(e) => { setCurrentEntry(e); setView('review'); }} onDelete={handleDelete} />}
      {view === 'review_vault' && <ReviewVault entries={entries} onReviewEntry={(e) => { setCurrentEntry(e); setView('review'); }} onUpdateMastery={handleUpdateMastery} />}
      
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-xl z-[100] flex flex-col items-center justify-center space-y-10 animate-in fade-in duration-500">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-[6px] border-indigo-100 rounded-full"></div>
            <div className="absolute inset-0 border-[6px] border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-3xl">🖋️</div>
          </div>
          <p className="text-2xl font-bold text-slate-800 serif-font">{loadingText}</p>
        </div>
      )}
    </Layout>
  );
};

export default App;
