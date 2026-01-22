
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseAuthUser, updateProfile } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  Firestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
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
import ProfileView from './components/ProfileView';

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab, PracticeRecord } from './types';
import { analyzeDiaryEntry } from './services/geminiService';
import { stripRuby } from './utils/textHelpers';

const firebaseConfig = {
  // 这里使用的 process.env.FIREBASE_... 必须由 vite.config.ts 的 define 注入
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
  console.warn("⚠️ 未检测到有效的 Firebase 配置。请检查 GitHub Secrets 名称是否匹配。");
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
  const [currentEntryIterations, setCurrentEntryIterations] = useState<DiaryIteration[]>([]); 
  const [rewriteBaseEntryId, setRewriteBaseEntryId] = useState<string | null>(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatLanguage, setChatLanguage] = useState('');
  const [prefilledEditorText, setPrefilledEditorText] = useState('');

  const [allAdvancedVocab, setAllAdvancedVocab] = useState<AdvancedVocab[]>([]); 
  const [selectedVocabForPracticeId, setSelectedVocabForPracticeId] = useState<string | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userPhotoURL = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`;
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: userPhotoURL,
          isMock: false
        });
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
        setCurrentEntry(null);
        setCurrentEntryIterations([]);
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
      } else {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.profile) {
             setUser(prev => prev ? { ...prev, ...data.profile } : null);
          }
        }

        const diaryEntriesColRef = collection(db, 'users', userId, 'diaryEntries');
        const diaryEntriesQuery = query(diaryEntriesColRef, orderBy('timestamp', 'desc'));
        const diaryEntriesSnapshot = await getDocs(diaryEntriesQuery);
        const loadedEntries = diaryEntriesSnapshot.docs.map(d => ({ 
            ...d.data(), 
            id: d.id, 
            timestamp: (d.data().timestamp as Timestamp).toMillis() 
        })) as DiaryEntry[];
        setEntries(loadedEntries);

        const advancedVocabColRef = collection(db, 'users', userId, 'advancedVocab');
        const advancedVocabSnapshot = await getDocs(advancedVocabColRef);
        const loadedVocab = advancedVocabSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as AdvancedVocab[];
        setAllAdvancedVocab(loadedVocab);
      }
    } catch (e) {
      console.error("[DEBUG] Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const saveProfileData = useCallback(async (userId: string, isMock: boolean, updatedProfile: { displayName: string, photoURL: string }) => {
    try {
      if (!db || isMock) {
        localStorage.setItem(`linguist_profile_${userId}`, JSON.stringify(updatedProfile));
      } else {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { profile: updatedProfile }, { merge: true });
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, updatedProfile);
        }
      }
    } catch (e) {
      console.error("[DEBUG] Error saving profile data:", e);
    }
  }, [db]);

  useEffect(() => {
    if (user) loadUserData(user.uid, user.isMock);
  }, [user?.uid, user?.isMock, loadUserData]);

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    setUser({ ...userData, isMock });
    setView('dashboard');
  };

  const handleLogout = async () => {
    if (!user?.isMock && auth) await auth.signOut();
    setUser(null);
    setView('dashboard');
  };

  const handleViewChange = (newView: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(newView);
    setSelectedVocabForPracticeId(vocabId || null);
    setIsPracticeActive(!!isPracticeActive);
    if (newView !== 'editor') {
      setPrefilledEditorText('');
      setRewriteBaseEntryId(null); 
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    const updatedProfile = { displayName: editName, photoURL: editPhoto };
    try {
      await saveProfileData(user.uid, user.isMock, updatedProfile);
      setUser(prev => prev ? { ...prev, ...updatedProfile } : null);
      alert("馆长档案已云端同步！");
    } catch (e) {
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
      const historyContext = entries.filter(e => e.language === language && e.analysis).slice(0, 5);
      const analysis = await analyzeDiaryEntry(text, language, historyContext);
      const clientTimestamp = Date.now();
      const serverTS = serverTimestamp();

      if (rewriteBaseEntryId && currentEntry && db) {
        const baseDoc = doc(db, 'users', user.uid, 'diaryEntries', rewriteBaseEntryId);
        await addDoc(collection(baseDoc, 'iterations'), { text, timestamp: serverTS, analysis });
        await updateDoc(baseDoc, { 
          originalText: text, analysis, timestamp: serverTS, 
          iterationCount: (currentEntry.iterationCount || 0) + 1 
        });
        const updated = { ...currentEntry, originalText: text, analysis, timestamp: clientTimestamp, iterationCount: (currentEntry.iterationCount || 0) + 1 } as DiaryEntry;
        setEntries(prev => prev.map(e => e.id === rewriteBaseEntryId ? updated : e));
        setCurrentEntry(updated);
      } else if (db) {
        const newEntryData = {
          timestamp: serverTS, date: new Date(clientTimestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          originalText: text, language, type: 'diary', analysis, iterationCount: 0
        };
        const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), newEntryData);
        const finalEntry = { ...newEntryData, id: docRef.id, timestamp: clientTimestamp } as DiaryEntry;
        setEntries(prev => [finalEntry, ...prev]);
        setCurrentEntry(finalEntry);
      }
      setView('review');
    } catch (error: any) {
      setError("AI 分析失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateMastery = async (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!user || !db) return;
    try {
      const vDoc = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      await updateDoc(vDoc, { mastery: newMastery });
      if (record) await addDoc(collection(vDoc, 'practices'), record);
      setAllAdvancedVocab(prev => prev.map(v => v.id === vocabId ? { ...v, mastery: newMastery } : v));
    } catch (e) { console.error(e); }
  };

  const handleSaveToMuseum = async (language: string, rehearsal: RehearsalEvaluation) => {
    if (!user || !db) return;
    const clientTS = Date.now();
    const data = {
      timestamp: serverTimestamp(),
      date: new Date(clientTS).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      originalText: rehearsal.userRetelling || "",
      language, type: 'rehearsal', rehearsal, iterationCount: 0
    };
    const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), data);
    setEntries(prev => [{ ...data, id: docRef.id, timestamp: clientTS } as DiaryEntry, ...prev]);
  };

  if (!user) return <AuthView auth={auth} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;

  return (
    <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={() => setView('vocab_list')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} initialText={prefilledEditorText} initialLanguage={chatLanguage} />}
      {view === 'review' && currentEntry && <Review analysis={currentEntry.analysis!} language={currentEntry.language} iterations={currentEntryIterations} onSave={() => setView('history')} onBack={() => setView('history')} />}
      {view === 'history' && <History entries={entries} onSelect={(e) => { setCurrentEntry(e); setView(e.type === 'rehearsal' ? 'rehearsal_report' : 'review'); }} onDelete={(id) => { if (db && user) deleteDoc(doc(db, 'users', user.uid, 'diaryEntries', id)); setEntries(prev => prev.filter(e => e.id !== id)); }} onRewrite={(e) => { setRewriteBaseEntryId(e.id); setPrefilledEditorText(e.originalText); setView('editor'); }} />}
      {view === 'chat' && <ChatEditor onFinish={(msgs, lang) => { setChatLanguage(lang); setPrefilledEditorText(msgs.map(m => m.content).join('\n\n')); setView('editor'); }} allGems={allAdvancedVocab.map(v => ({ ...v, language: v.language || 'English' }))} />}
      {view === 'vocab_list' && <VocabListView allAdvancedVocab={allAdvancedVocab} onViewChange={handleViewChange} onUpdateMastery={handleUpdateMastery} />}
      {view === 'vocab_practice' && selectedVocabForPracticeId && <VocabPractice selectedVocabId={selectedVocabForPracticeId} allAdvancedVocab={allAdvancedVocab} onUpdateMastery={handleUpdateMastery} onBackToVocabList={() => setView('vocab_list')} onViewChange={handleViewChange} isPracticeActive={isPracticeActive} />}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && <VocabPracticeDetailView selectedVocabId={selectedVocabForPracticeId} allAdvancedVocab={allAdvancedVocab} onBackToPracticeHistory={() => setView('vocab_list')} />}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={handleSaveToMuseum} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && <RehearsalReport evaluation={currentEntry.rehearsal} language={currentEntry.language} date={currentEntry.date} onBack={() => setView('history')} />}
      {view === 'profile' && <ProfileView user={user} editName={editName} setEditName={setEditName} editPhoto={editPhoto} setEditPhoto={setEditPhoto} isAvatarPickerOpen={isAvatarPickerOpen} setIsAvatarPickerOpen={setIsAvatarPickerOpen} avatarSeeds={AVATAR_SEEDS} onSaveProfile={handleSaveProfile} isLoading={isLoading} />}
    </Layout>
  );
};

export default App;
