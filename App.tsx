
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

if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
  try {
    const existingApps = getApps();
    app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseValid = true;
  } catch (e) {
    console.error("Firebase Auth initialization failed:", e);
  }
}

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
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string, isMock: boolean, iterationDay?: number } | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true); 
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null); 
  const [currentEntryIterations, setCurrentEntryIterations] = useState<DiaryIteration[]>([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatLanguage, setChatLanguage] = useState('');
  const [prefilledEditorText, setPrefilledEditorText] = useState('');
  const [summaryPrompt, setSummaryPrompt] = useState<string>('');
  const [isReviewingExisting, setIsReviewingExisting] = useState(false); 

  const [allAdvancedVocab, setAllAdvancedVocab] = useState<AdvancedVocab[]>([]); 
  const [selectedVocabForPracticeId, setSelectedVocabForPracticeId] = useState<string | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);

  const [practiceQueue, setPracticeQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  useEffect(() => {
    if (!auth) {
      setIsAuthInitializing(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userPhotoURL = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`;
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: userPhotoURL,
          isMock: false,
          iterationDay: 0 // Default Sunday
        });
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
      }
      setIsAuthInitializing(false);
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
          const profile = JSON.parse(localProfile);
          setUser(prev => prev ? { ...prev, ...profile } : null);
        }
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
        setEntries(diaryEntriesSnapshot.docs.map(d => ({ 
            ...d.data(), 
            id: d.id, 
            timestamp: (d.data().timestamp as Timestamp).toMillis() 
        })) as DiaryEntry[]);
        const advancedVocabColRef = collection(db, 'users', userId, 'advancedVocab');
        const vocabSnapshot = await getDocs(advancedVocabColRef);
        const vocabWithPractices = await Promise.all(vocabSnapshot.docs.map(async (vDoc) => {
          const vocabData = vDoc.data() as AdvancedVocab;
          const practicesColRef = collection(vDoc.ref, 'practices');
          const practicesSnapshot = await getDocs(query(practicesColRef, orderBy('timestamp', 'desc')));
          const practices = practicesSnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id })) as PracticeRecord[];
          return { ...vocabData, id: vDoc.id, practices };
        }));
        setAllAdvancedVocab(vocabWithPractices);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const saveProfileData = useCallback(async (userId: string, isMock: boolean, updatedProfile: { displayName: string, photoURL: string, iterationDay?: number }) => {
    try {
      if (!db || isMock) {
        const existing = JSON.parse(localStorage.getItem(`linguist_profile_${userId}`) || '{}');
        localStorage.setItem(`linguist_profile_${userId}`, JSON.stringify({ ...existing, ...updatedProfile }));
      } else {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { profile: updatedProfile }, { merge: true });
        if (auth.currentUser) {
          if (updatedProfile.displayName !== auth.currentUser.displayName || updatedProfile.photoURL !== auth.currentUser.photoURL) {
            await updateProfile(auth.currentUser, { displayName: updatedProfile.displayName, photoURL: updatedProfile.photoURL });
          }
        }
      }
    } catch (e) { console.error(e); }
  }, [db]);

  useEffect(() => {
    if (user) loadUserData(user.uid, user.isMock);
  }, [user?.uid, user?.isMock, loadUserData]);

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    setUser({ ...userData, isMock, iterationDay: 0 });
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
    if (newView !== 'editor') setSummaryPrompt(''); 
    if (newView === 'profile' && user) {
      setEditName(user.displayName);
      setEditPhoto(user.photoURL);
    }
  };

  const handleUpdateEntryLanguage = async (entryId: string, newLanguage: string) => {
    if (!user) return;
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, language: newLanguage } : e));
    if (!db || user.isMock) {
      const currentEntries = JSON.parse(localStorage.getItem(`linguist_entries_${user.uid}`) || '[]');
      const updated = currentEntries.map((e: any) => e.id === entryId ? { ...e, language: newLanguage } : e);
      localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updated));
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'diaryEntries', entryId), { language: newLanguage });
    }
  };

  const handleUpdateMastery = async (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => {
      if (v.id === vocabId) {
        const updatedPractices = record ? [record, ...(v.practices || [])] : (v.practices || []);
        return { ...v, mastery: newMastery, practices: updatedPractices };
      }
      return v;
    }));
    if (!db || user.isMock) {
      const currentVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updatedVocab = currentVocab.map((v: any) => {
        if (v.id === vocabId) {
          const updatedPractices = record ? [record, ...(v.practices || [])] : (v.practices || []);
          return { ...v, mastery: newMastery, practices: updatedPractices };
        }
        return v;
      });
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updatedVocab));
      return;
    }
    try {
      const vDoc = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      await updateDoc(vDoc, { mastery: newMastery });
      if (record) {
        const { id, ...recordData } = record;
        await addDoc(collection(vDoc, 'practices'), recordData);
      }
    } catch (e) { console.error("Update mastery error:", e); }
  };

  const handleDeleteVocab = async (vocabId: string) => {
    if (!user) return;
    if (!window.confirm("确定要将这件珍宝移出珍宝阁吗？")) return;
    
    setAllAdvancedVocab(prev => prev.filter(v => v.id !== vocabId));
    
    if (!db || user.isMock) {
      const currentVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updatedVocab = currentVocab.filter((v: any) => v.id !== vocabId);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updatedVocab));
    } else {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId));
      } catch (e) {
        console.error("Delete vocab error:", e);
      }
    }
  };

  const handleDeletePractice = async (vocabId: string, practiceId: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => {
      if (v.id === vocabId) {
        return { ...v, practices: (v.practices || []).filter(p => p.id !== practiceId) };
      }
      return v;
    }));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => {
        if (v.id === vocabId) {
          return { ...v, practices: (v.practices || []).filter((p: any) => p.id !== practiceId) };
        }
        return v;
      });
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId, 'practices', practiceId));
    } catch (e) { console.error("Delete practice error:", e); }
  };

  const handleBatchDeletePractices = async (vocabId: string, practiceIds: string[]) => {
    if (!user || practiceIds.length === 0) return;
    setAllAdvancedVocab(prev => prev.map(v => {
      if (v.id === vocabId) {
        return { ...v, practices: (v.practices || []).filter(p => !practiceIds.includes(p.id)) };
      }
      return v;
    }));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => {
        if (v.id === vocabId) {
          return { ...v, practices: (v.practices || []).filter((p: any) => !practiceIds.includes(p.id)) };
        }
        return v;
      });
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
      return;
    }
    try {
      const batch = writeBatch(db);
      practiceIds.forEach(pId => {
        const pDoc = doc(db, 'users', user!.uid, 'advancedVocab', vocabId, 'practices', pId);
        batch.delete(pDoc);
      });
      await batch.commit();
    } catch (e) { console.error("Batch delete error:", e); }
  };

  const handleSaveDraft = async (text: string, language: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const clientTimestamp = Date.now();
      const newEntrySkeleton: Omit<DiaryEntry, 'id'> = {
        timestamp: clientTimestamp,
        date: new Date(clientTimestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: text,
        language,
        type: 'diary',
        iterationCount: 0
      };

      if (!db || user.isMock) {
        const finalEntry = { ...newEntrySkeleton, id: uuidv4() } as DiaryEntry;
        const updatedEntries = [finalEntry, ...entries];
        setEntries(updatedEntries);
        localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), { ...newEntrySkeleton, timestamp: serverTimestamp() });
        const finalEntry = { ...newEntrySkeleton, id: docRef.id } as DiaryEntry;
        setEntries(prev => [finalEntry, ...prev]);
      }
      setView('history');
    } catch (e) {
      alert("保存草稿失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeExistingEntry = async (entry: DiaryEntry) => {
    if (!user || !entry.originalText) return;
    setAnalyzingId(entry.id);
    try {
      const historyContext = entries.filter(e => e.language === entry.language && e.analysis && e.id !== entry.id).slice(0, 5);
      const analysis = await analyzeDiaryEntry(entry.originalText, entry.language, historyContext);
      
      const updatedEntry = { ...entry, analysis };
      
      // Handle Vocab saving
      const vocabItemsToSave = analysis.advancedVocab.filter(v => {
        const normalizedNewWord = stripRuby(v.word).trim().toLowerCase();
        return !allAdvancedVocab.some(existing => {
          const normalizedExistingWord = stripRuby(existing.word).trim().toLowerCase();
          return normalizedExistingWord === normalizedNewWord && existing.language === entry.language;
        });
      }).map(v => ({ ...v, id: uuidv4(), mastery: 0, language: entry.language, practices: [] }));

      if (vocabItemsToSave.length > 0) {
        if (!db || user.isMock) {
          const updated = [...vocabItemsToSave, ...allAdvancedVocab];
          setAllAdvancedVocab(updated);
          localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
        } else {
          const vocabCol = collection(db, 'users', user.uid, 'advancedVocab');
          for (const item of vocabItemsToSave) {
            const { id, practices, ...data } = item;
            await addDoc(vocabCol, data);
          }
        }
      }

      setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e));

      if (!db || user.isMock) {
        const currentEntries = JSON.parse(localStorage.getItem(`linguist_entries_${user.uid}`) || '[]');
        const updatedEntries = currentEntries.map((e: any) => e.id === entry.id ? updatedEntry : e);
        localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
      } else {
        const docRef = doc(db, 'users', user.uid, 'diaryEntries', entry.id);
        await updateDoc(docRef, { analysis });
      }

      alert("分析完成！您可以查看报告了。");
      setCurrentEntry(updatedEntry);
      setIsReviewingExisting(false); 
      setView('review');
    } catch (error) {
      console.error(error);
      alert("分析失败，请检查网络。");
    } finally {
      setAnalyzingId(null);
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
      const newEntrySkeleton: Omit<DiaryEntry, 'id'> = {
        timestamp: clientTimestamp,
        date: new Date(clientTimestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: text,
        language,
        type: 'diary',
        analysis,
        iterationCount: 0
      };

      const vocabItemsToSave = analysis.advancedVocab.filter(v => {
        const normalizedNewWord = stripRuby(v.word).trim().toLowerCase();
        return !allAdvancedVocab.some(existing => {
          const normalizedExistingWord = stripRuby(existing.word).trim().toLowerCase();
          return normalizedExistingWord === normalizedNewWord && existing.language === language;
        });
      }).map(v => ({ ...v, id: uuidv4(), mastery: 0, language, practices: [] }));

      if (vocabItemsToSave.length > 0) {
        if (!db || user.isMock) {
          const updated = [...vocabItemsToSave, ...allAdvancedVocab];
          setAllAdvancedVocab(updated);
          localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
        } else {
          const vocabCol = collection(db, 'users', user.uid, 'advancedVocab');
          for (const item of vocabItemsToSave) {
            const { id, practices, ...data } = item;
            await addDoc(vocabCol, data);
          }
          loadUserData(user.uid, user.isMock);
        }
      }

      if (!db || user.isMock) {
        const finalEntry = { ...newEntrySkeleton, id: uuidv4() } as DiaryEntry;
        const updatedEntries = [finalEntry, ...entries];
        setEntries(updatedEntries);
        setCurrentEntry(finalEntry);
        localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), { ...newEntrySkeleton, timestamp: serverTimestamp() });
        const finalEntry = { ...newEntrySkeleton, id: docRef.id } as DiaryEntry;
        setEntries(prev => [finalEntry, ...prev]);
        setCurrentEntry(finalEntry);
      }
      setIsReviewingExisting(false);
      setView('review');
    } catch (error: any) {
      if (window.confirm("AI 分析失败。是否要将该内容作为草稿暂存到收藏馆？")) {
        handleSaveDraft(text, language);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveManualVocab = async (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => {
    if (!user) return;
    const normalizedNewWord = stripRuby(vocab.word).trim().toLowerCase();
    const isExisting = allAdvancedVocab.some(v => 
      stripRuby(v.word).trim().toLowerCase() === normalizedNewWord && v.language === vocab.language
    );
    if (isExisting) {
      alert("该词汇已在馆藏中。");
      return;
    }

    const newVocab: AdvancedVocab = {
      ...vocab,
      id: uuidv4(),
      mastery: 0,
      practices: []
    };

    setAllAdvancedVocab(prev => [newVocab, ...prev]);

    if (!db || user.isMock) {
      const currentVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify([newVocab, ...currentVocab]));
    } else {
      const { id, practices, ...data } = newVocab;
      await addDoc(collection(db, 'users', user.uid, 'advancedVocab'), data);
    }
    alert(`“${stripRuby(vocab.word)}” 已入馆！`);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    const updatedProfile = { displayName: editName, photoURL: editPhoto };
    try {
      await saveProfileData(user.uid, user.isMock, updatedProfile);
      setUser(prev => prev ? { ...prev, ...updatedProfile } : null);
    } catch (e) { setError("保存失败。"); } finally { setIsLoading(false); }
  };

  const handleStartSmartReview = () => {
    if (allAdvancedVocab.length === 0) {
      alert("馆长，您的珍宝馆还是空的。请先撰写日记以发现词汇！");
      return;
    }
    const eligibleGems = allAdvancedVocab.filter(v => (v.mastery || 0) < 5);
    if (eligibleGems.length === 0) {
      alert("馆长，所有珍宝都已打磨至巅峰！请开启新的撰写以发掘更多珍宝。");
      return;
    }
    const sortedGems = [...eligibleGems].sort((a, b) => {
      const mA = a.mastery || 0;
      const mB = b.mastery || 0;
      if (mA !== mB) return mA - mB;
      const pA = a.practices?.length || 0;
      const pB = b.practices?.length || 0;
      return pA - pB;
    });
    const topCandidates = sortedGems.slice(0, 15);
    const selectedGems = topCandidates
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);
    const selectedIds = selectedGems.map(v => v.id);
    setPracticeQueue(selectedIds);
    setQueueIndex(0);
    setSelectedVocabForPracticeId(selectedIds[0]);
    setIsPracticeActive(true);
    setView('vocab_practice');
  };

  // --- 时光回响推荐逻辑 (Echo Recommendation) ---
  const recommendedIteration = useMemo(() => {
    if (!user || entries.length === 0) return null;
    const today = new Date();
    const iterDay = user.iterationDay ?? 0; // Default Sunday
    if (today.getDay() !== iterDay) return null;

    // 筛选规则：日记类型、已分析、非草稿、距今超过7天、尚未进行大量迭代
    const candidates = entries.filter(e => {
      if (e.type !== 'diary' || !e.analysis) return false;
      const diffDays = (today.getTime() - e.timestamp) / (1000 * 60 * 60 * 24);
      return diffDays > 7 && (e.iterationCount || 0) < 2;
    });

    if (candidates.length === 0) return null;
    // 选取最早的一篇
    return [...candidates].sort((a, b) => a.timestamp - b.timestamp)[0];
  }, [entries, user]);

  const handleStartIteration = (entry: DiaryEntry) => {
    setPrefilledEditorText(entry.originalText);
    setChatLanguage(entry.language);
    setSummaryPrompt(`这是您在 ${entry.date} 的记录。现在的您，语言能力已有长足进步，试着用更地道的表达进行迭代重写。`);
    setView('editor');
  };

  if (isAuthInitializing) return (
    <div className="h-screen w-full bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50 -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -ml-20 -mb-20"></div>
      
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in duration-1000">
        <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-4xl mb-8 border border-slate-100 animate-bounce transition-all duration-1000">
          🖋️
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900 serif-font tracking-tight">语言日记收藏馆</h1>
          <div className="flex items-center justify-center space-x-3">
             <div className="h-[1px] w-8 bg-slate-200"></div>
             <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.4em]">Linguist Diary Museum</p>
             <div className="h-[1px] w-8 bg-slate-200"></div>
          </div>
        </div>
        
        <div className="mt-12 flex space-x-2">
          <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></div>
          <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping [animation-delay:150ms]"></div>
          <div className="w-1.5 h-1.5 bg-indigo-200 rounded-full animate-ping [animation-delay:300ms]"></div>
        </div>
      </div>
    </div>
  );

  if (!user) return <AuthView auth={auth} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;

  return (
    <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={handleStartSmartReview} entries={entries} recommendedIteration={recommendedIteration} onStartIteration={handleStartIteration} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} onSaveDraft={handleSaveDraft} isLoading={isLoading} initialText={prefilledEditorText} initialLanguage={chatLanguage} summaryPrompt={summaryPrompt} />}
      {view === 'review' && currentEntry && <Review analysis={currentEntry.analysis!} language={currentEntry.language} iterations={currentEntryIterations} onSave={() => setView('history')} onBack={() => setView('history')} onSaveManualVocab={handleSaveManualVocab} isReviewingExisting={isReviewingExisting} />}
      {view === 'history' && <History entries={entries} isAnalyzingId={analyzingId} onAnalyzeDraft={handleAnalyzeExistingEntry} onUpdateLanguage={handleUpdateEntryLanguage} onSelect={(e) => { setCurrentEntry(e); setIsReviewingExisting(true); setView(e.type === 'rehearsal' ? 'rehearsal_report' : 'review'); }} onDelete={(id) => { 
        if (!user.isMock && db) deleteDoc(doc(db, 'users', user.uid, 'diaryEntries', id)); 
        setEntries(prev => prev.filter(e => e.id !== id));
      }} onRewrite={(e) => { handleStartIteration(e); }} />}
      {view === 'chat' && <ChatEditor onFinish={(msgs, lang, summary) => { 
        setChatLanguage(lang); 
        setPrefilledEditorText(''); 
        setSummaryPrompt(summary);
        setView('editor'); 
      }} allGems={allAdvancedVocab} />}
      {view === 'vocab_list' && <VocabListView allAdvancedVocab={allAdvancedVocab} onViewChange={handleViewChange} onUpdateMastery={handleUpdateMastery} onDeleteVocab={handleDeleteVocab} />}
      {view === 'vocab_practice' && selectedVocabForPracticeId && (
        <VocabPractice 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onUpdateMastery={handleUpdateMastery} 
          onBackToVocabList={() => setView('vocab_list')} 
          onViewChange={handleViewChange} 
          isPracticeActive={isPracticeActive}
          queueProgress={practiceQueue.length > 0 ? { current: queueIndex + 1, total: practiceQueue.length } : undefined}
          onNextInQueue={() => {
            if (queueIndex < practiceQueue.length - 1) {
              setQueueIndex(queueIndex + 1);
              setSelectedVocabForPracticeId(practiceQueue[queueIndex + 1]);
            } else {
              setView('vocab_list');
            }
          }}
        />
      )}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && (
        <VocabPracticeDetailView 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onBackToPracticeHistory={() => setView('vocab_list')} 
          onDeletePractice={handleDeletePractice}
          onBatchDeletePractices={handleBatchDeletePractices}
        />
      )}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={(lang, reh) => {
         const dataSkeleton: Omit<DiaryEntry, 'id'> = { timestamp: Date.now(), date: new Date().toLocaleDateString('zh-CN'), originalText: reh.userRetelling || "", language: lang, type: 'rehearsal', rehearsal: reh, iterationCount: 0 };
         if (!db || user.isMock) setEntries(prev => [{ ...dataSkeleton, id: uuidv4() } as DiaryEntry, ...prev]);
         else addDoc(collection(db, 'users', user.uid, 'diaryEntries'), { ...dataSkeleton, timestamp: serverTimestamp() }).then(d => setEntries(prev => [{ ...dataSkeleton, id: d.id } as DiaryEntry, ...prev]));
      }} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && <RehearsalReport evaluation={currentEntry.rehearsal} language={currentEntry.language} date={currentEntry.date} onBack={() => setView('history')} />}
      {view === 'profile' && <ProfileView user={user} editName={editName} setEditName={setEditName} editPhoto={editPhoto} setEditPhoto={setEditPhoto} isAvatarPickerOpen={isAvatarPickerOpen} setIsAvatarPickerOpen={setIsAvatarPickerOpen} avatarSeeds={AVATAR_SEEDS} onSaveProfile={handleSaveProfile} isLoading={isLoading} iterationDay={user.iterationDay ?? 0} onSetIterationDay={(day) => setUser(prev => prev ? { ...prev, iterationDay: day } : null)} />}
    </Layout>
  );
};

export default App;
