
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseAuthUser, updateProfile, signOut } from 'firebase/auth';
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

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab, PracticeRecord, InspirationFragment } from './types';
import { analyzeDiaryEntry, enrichFragment } from './services/geminiService';
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

const DEFAULT_LANGS = ['English', 'Japanese', 'French', 'Spanish', 'German'];

const App: React.FC = () => {
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string, isMock: boolean, iterationDay?: number, preferredLanguages?: string[] } | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true); 
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [fragments, setFragments] = useState<InspirationFragment[]>([]);
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

  const preferredLanguages = useMemo(() => user?.preferredLanguages || DEFAULT_LANGS, [user]);

  const loadUserData = useCallback(async (userId: string, isMock: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!db || isMock) {
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));
        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));
        const localFragments = localStorage.getItem(`linguist_fragments_${userId}`);
        if (localFragments) setFragments(JSON.parse(localFragments));
        const localProfile = localStorage.getItem(`linguist_profile_${userId}`);
        if (localProfile) {
          const profile = JSON.parse(localProfile);
          setUser(prev => prev ? { iterationDay: 0, preferredLanguages: DEFAULT_LANGS, ...prev, ...profile } : null);
        }
      } else {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.profile) {
             setUser(prev => prev ? { iterationDay: 0, preferredLanguages: DEFAULT_LANGS, ...prev, ...data.profile } : null);
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

        const fragmentsColRef = collection(db, 'users', userId, 'fragments');
        const fragmentsQuery = query(fragmentsColRef, orderBy('timestamp', 'desc'));
        const fragmentsSnapshot = await getDocs(fragmentsQuery);
        setFragments(fragmentsSnapshot.docs.map(d => ({
            ...d.data(),
            id: d.id,
            timestamp: (d.data().timestamp as Timestamp).toMillis(),
            fragmentType: d.data().fragmentType || 'transient'
        })) as InspirationFragment[]);

        const advancedVocabColRef = collection(db, 'users', userId, 'advancedVocab');
        const vocabSnapshot = await getDocs(advancedVocabColRef);
        const vocabWithPractices = await Promise.all(vocabSnapshot.docs.map(async (vDoc) => {
          const vocabData = vDoc.data() as AdvancedVocab;
          const practicesColRef = collection(vDoc.ref, 'practices');
          const practicesSnapshot = await getDocs(query(practicesColRef, orderBy('timestamp', 'desc')));
          const practices = practicesSnapshot.docs.map(pDoc => ({ ...pDoc.data(), id: pDoc.id })) as PracticeRecord[];
          return { ...vocabData, id: vDoc.id, practices, timestamp: (vDoc.data().timestamp as Timestamp)?.toMillis() || Date.now() };
        }));
        setAllAdvancedVocab(vocabWithPractices);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setIsAuthInitializing(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userPhotoURL = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`;
        const userData = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: userPhotoURL,
          isMock: false,
          iterationDay: 0,
          preferredLanguages: DEFAULT_LANGS
        };
        setUser(userData);
        loadUserData(firebaseUser.uid, false);
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
        setFragments([]);
      }
      setIsAuthInitializing(false);
    });
    return () => unsubscribe();
  }, [loadUserData]);

  const handleSaveFragment = async (content: string, language: string, type: 'transient' | 'seed', predefinedMeaning?: string, predefinedUsage?: string) => {
    if (!user || !content.trim()) return;
    
    let meaning = predefinedMeaning || "";
    let usage = predefinedUsage || "";

    if (type === 'seed' && !predefinedMeaning && !predefinedUsage) {
      try {
        const enriched = await enrichFragment(content, language);
        meaning = enriched.meaning;
        usage = enriched.usage;
      } catch (e) { console.error("Failed to enrich", e); }
    }

    const newFragment: InspirationFragment = {
      id: uuidv4(),
      content,
      meaning,
      usage,
      language,
      fragmentType: type,
      timestamp: Date.now()
    };

    setFragments(prev => [newFragment, ...prev]);
    if (!db || user.isMock) {
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify([newFragment, ...local]));
    } else {
      await addDoc(collection(db, 'users', user.uid, 'fragments'), { ...newFragment, timestamp: serverTimestamp() });
    }
  };

  const handlePromoteToSeed = async (id: string) => {
    if (!user) return;
    setFragments(prev => prev.map(f => f.id === id ? { ...f, fragmentType: 'seed' } : f));
    if (!db || user.isMock) {
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify(local.map((f: any) => f.id === id ? { ...f, fragmentType: 'seed' } : f)));
    } else {
      const fragmentsColRef = collection(db, 'users', user.uid, 'fragments');
      const q = query(fragmentsColRef, where('id', '==', id));
      const snap = await getDocs(q);
      snap.forEach(async (d) => await updateDoc(d.ref, { fragmentType: 'seed' }));
    }
  };

  const handleDeleteFragment = async (id: string) => {
    if (!user) return;
    setFragments(prev => prev.filter(f => f.id !== id));
    if (!db || user.isMock) {
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify(local.filter((f: any) => f.id !== id)));
    } else {
      const fragmentsColRef = collection(db, 'users', user.uid, 'fragments');
      const q = query(fragmentsColRef, where('id', '==', id));
      const snap = await getDocs(q);
      snap.forEach(async (doc) => await deleteDoc(doc.ref));
    }
  };

  const handlePromoteFragment = async (fragmentId: string) => {
    if (!user) return;
    const fragment = fragments.find(f => f.id === fragmentId);
    if (!fragment) return;

    const vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'> = {
      word: fragment.content,
      meaning: fragment.meaning || "未命名珍宝",
      usage: fragment.usage || "暂无例句",
      level: 'Intermediate',
      language: fragment.language,
      timestamp: Date.now()
    };

    await handleSaveManualVocab(vocab);
    await handleDeleteFragment(fragmentId);
  };

  const handleAnalyze = async (text: string, language: string, usedFragmentIds: string[]) => {
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
      }).map(v => ({ ...v, id: uuidv4(), mastery: 0, language, practices: [], timestamp: Date.now() }));

      if (vocabItemsToSave.length > 0) {
        if (!db || user.isMock) {
          const updated = [...vocabItemsToSave, ...allAdvancedVocab];
          setAllAdvancedVocab(updated);
          localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
        } else {
          const vocabCol = collection(db, 'users', user.uid, 'advancedVocab');
          for (const item of vocabItemsToSave) {
            const { id, practices, ...data } = item;
            await addDoc(vocabCol, { ...data, timestamp: serverTimestamp() });
          }
          loadUserData(user.uid, user.isMock);
        }
      }

      if (usedFragmentIds.length > 0) {
        for (const fId of usedFragmentIds) {
          await handleDeleteFragment(fId);
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
      practices: [],
      timestamp: Date.now()
    };

    setAllAdvancedVocab(prev => [newVocab, ...prev]);

    if (!db || user.isMock) {
      const currentVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify([newVocab, ...currentVocab]));
    } else {
      const { id, practices, ...data } = newVocab;
      await addDoc(collection(db, 'users', user.uid, 'advancedVocab'), { ...data, timestamp: serverTimestamp() });
    }
  };

  const handleSaveDraft = async (text: string, language: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const draft: Omit<DiaryEntry, 'id'> = {
        timestamp: Date.now(),
        date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: text,
        language,
        type: 'diary',
        iterationCount: 0
      };

      if (!db || user.isMock) {
        const finalDraft = { ...draft, id: uuidv4() } as DiaryEntry;
        const updatedEntries = [finalDraft, ...entries];
        setEntries(updatedEntries);
        localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), { ...draft, timestamp: serverTimestamp() });
        const finalDraft = { ...draft, id: docRef.id } as DiaryEntry;
        setEntries(prev => [finalDraft, ...prev]);
      }
      setView('history');
    } catch (e) {
      setError("保存草稿失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzeExistingEntry = async (entry: DiaryEntry) => {
    if (!user) return;
    setAnalyzingId(entry.id);
    try {
      const historyContext = entries.filter(e => e.language === entry.language && e.analysis && e.id !== entry.id).slice(0, 5);
      const analysis = await analyzeDiaryEntry(entry.originalText, entry.language, historyContext);
      
      const updatedEntry = { ...entry, analysis };
      
      if (!db || user.isMock) {
        const updatedEntries = entries.map(e => e.id === entry.id ? updatedEntry : e);
        setEntries(updatedEntries);
        localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'diaryEntries', entry.id), { analysis });
        setEntries(prev => prev.map(e => e.id === entry.id ? updatedEntry : e));
      }
      setCurrentEntry(updatedEntry);
      setIsReviewingExisting(true);
      setView('review');
    } catch (e) {
      setError("分析失败。");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleUpdateEntryLanguage = async (id: string, language: string) => {
    if (!user) return;
    const updatedEntries = entries.map(e => e.id === id ? { ...e, language } : e);
    setEntries(updatedEntries);
    if (!db || user.isMock) {
      localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'diaryEntries', id), { language });
    }
  };

  const handleStartIteration = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    setCurrentEntryIterations([]); 
    setPrefilledEditorText(entry.analysis?.modifiedText || entry.originalText);
    setChatLanguage(entry.language);
    setView('editor');
  };

  const recommendedIteration = useMemo(() => {
    if (!entries.length || user?.iterationDay === undefined) return null;
    const today = new Date();
    if (today.getDay() !== user.iterationDay) return null;
    
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const candidate = entries.find(e => e.timestamp < weekAgo && (e.iterationCount || 0) < 3);
    return candidate || null;
  }, [entries, user]);

  const handleStartSmartReview = () => {
    const needingReview = allAdvancedVocab.filter(v => (v.mastery || 0) < 4);
    if (needingReview.length === 0) {
      alert("所有馆藏珍宝均已达到巅峰。");
      return;
    }
    const queue = needingReview.sort(() => 0.5 - Math.random()).slice(0, 10).map(v => v.id);
    setPracticeQueue(queue);
    setQueueIndex(0);
    setSelectedVocabForPracticeId(queue[0]);
    setIsPracticeActive(true);
    setView('vocab_practice');
  };

  const handleUpdateMastery = async (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!user) return;
    
    setAllAdvancedVocab(prev => prev.map(v => v.id === vocabId ? { ...v, mastery: newMastery, practices: record ? [record, ...(v.practices || [])] : v.practices } : v));

    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => v.id === vocabId ? { ...v, mastery: newMastery, practices: record ? [record, ...(v.practices || [])] : v.practices } : v);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      const vocabDocRef = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      await updateDoc(vocabDocRef, { mastery: newMastery });
      if (record) {
        await addDoc(collection(vocabDocRef, 'practices'), { ...record, timestamp: serverTimestamp() });
      }
    }
  };

  const handleDeleteVocab = async (vocabId: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.filter(v => v.id !== vocabId));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(localVocab.filter((v: any) => v.id !== vocabId)));
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId));
    }
  };

  const handleDeletePractice = async (vocabId: string, practiceId: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => v.id === vocabId ? { ...v, practices: v.practices?.filter(p => p.id !== practiceId) } : v));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => v.id === vocabId ? { ...v, practices: v.practices?.filter((p: any) => p.id !== practiceId) } : v);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId, 'practices', practiceId));
    }
  };

  const handleBatchDeletePractices = async (vocabId: string, practiceIds: string[]) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => v.id === vocabId ? { ...v, practices: v.practices?.filter(p => !practiceIds.includes(p.id)) } : v));
    if (!db || user.isMock) {
       const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
       const updated = localVocab.map((v: any) => v.id === vocabId ? { ...v, practices: v.practices?.filter((p: any) => !practiceIds.includes(p.id)) } : v);
       localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
       const batch = writeBatch(db);
       practiceIds.forEach(pId => {
         batch.delete(doc(db!, 'users', user.uid, 'advancedVocab', vocabId, 'practices', pId));
       });
       await batch.commit();
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const profile = { displayName: editName, photoURL: editPhoto };
      if (!db || user.isMock) {
        localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify(profile));
        setUser(prev => prev ? { ...prev, ...profile } : null);
      } else {
        await updateProfile(auth.currentUser!, profile);
        await updateDoc(doc(db, 'users', user.uid), { profile });
        setUser(prev => prev ? { ...prev, ...profile } : null);
      }
    } catch (e) {
      setError("更新档案失败。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetIterationDay = async (day: number) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, iterationDay: day } : null);
    if (!db || user.isMock) {
       const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
       localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, iterationDay: day }));
    } else {
       await updateDoc(doc(db, 'users', user.uid), { 'profile.iterationDay': day });
    }
  };

  const handleSetPreferredLanguages = async (langs: string[]) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, preferredLanguages: langs } : null);
    if (!db || user.isMock) {
       const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
       localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, preferredLanguages: langs }));
    } else {
       await updateDoc(doc(db, 'users', user.uid), { 'profile.preferredLanguages': langs });
    }
  };

  const handleViewChange = (v: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(v);
    if (vocabId) setSelectedVocabForPracticeId(vocabId);
    if (isPracticeActive !== undefined) setIsPracticeActive(isPracticeActive);
    if (v !== 'editor') {
      setPrefilledEditorText('');
      setSummaryPrompt('');
    }
  };

  const handleLogout = async () => {
    if (auth && !user?.isMock) {
      await signOut(auth);
    }
    setUser(null);
    setView('dashboard');
  };

  const handleSaveDraftUpdate = async (text: string, language: string) => {
    handleSaveDraft(text, language);
  };

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    const fullUser = { ...userData, isMock, iterationDay: 0, preferredLanguages: DEFAULT_LANGS };
    setUser(fullUser);
    loadUserData(userData.uid, isMock);
  };

  if (isAuthInitializing) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-6">
       <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl animate-bounce shadow-xl">🖋️</div>
       <div className="text-center">
         <h2 className="text-xl font-black text-slate-900 serif-font">Linguist Diary</h2>
         <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">载入收藏馆中...</p>
       </div>
    </div>
  );

  if (!user) return <AuthView auth={auth} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;

  return (
    <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={handleStartSmartReview} entries={entries} allAdvancedVocab={allAdvancedVocab} recommendedIteration={recommendedIteration} onStartIteration={handleStartIteration} onSaveFragment={handleSaveFragment} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} onSaveDraft={handleSaveDraftUpdate} isLoading={isLoading} initialText={prefilledEditorText} initialLanguage={chatLanguage} summaryPrompt={summaryPrompt} fragments={fragments} onDeleteFragment={handleDeleteFragment} preferredLanguages={preferredLanguages} />}
      {view === 'review' && currentEntry && <Review analysis={currentEntry.analysis!} language={currentEntry.language} iterations={currentEntryIterations} onSave={() => setView('history')} onBack={() => setView('history')} onSaveManualVocab={handleSaveManualVocab} isReviewingExisting={isReviewingExisting} />}
      {view === 'history' && <History entries={entries} isAnalyzingId={analyzingId} onAnalyzeDraft={handleAnalyzeExistingEntry} onUpdateLanguage={handleUpdateEntryLanguage} onSelect={(e) => { setCurrentEntry(e); setIsReviewingExisting(true); setView(e.type === 'rehearsal' ? 'rehearsal_report' : 'review'); }} onDelete={(id) => { 
        if (!user.isMock && db) deleteDoc(doc(db, 'users', user.uid, 'diaryEntries', id)); 
        setEntries(prev => prev.filter(e => e.id !== id));
      }} onRewrite={(e) => { handleStartIteration(e); }} preferredLanguages={preferredLanguages} />}
      {view === 'chat' && <ChatEditor onFinish={(msgs, lang, summary) => { 
        setChatLanguage(lang); 
        setPrefilledEditorText(''); 
        setSummaryPrompt(summary);
        setView('editor'); 
      }} allGems={allAdvancedVocab} preferredLanguages={preferredLanguages} />}
      {view === 'vocab_list' && <VocabListView allAdvancedVocab={allAdvancedVocab} fragments={fragments} onViewChange={handleViewChange} onUpdateMastery={handleUpdateMastery} onDeleteVocab={handleDeleteVocab} onDeleteFragment={handleDeleteFragment} onPromoteFragment={handlePromoteFragment} onPromoteToSeed={handlePromoteToSeed} />}
      {view === 'vocab_practice' && selectedVocabForPracticeId && (
        <VocabPractice 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onUpdateMastery={handleUpdateMastery} 
          onBackToVocabList={() => setView('vocab_list')} 
          onViewChange={handleViewChange} 
          onSaveFragment={handleSaveFragment}
          isPracticeActive={isPracticeActive}
          queueProgress={practiceQueue.length > 0 ? { current: queueIndex + 1, total: practiceQueue.length } : undefined}
          onNextInQueue={() => {
            if (queueIndex < practiceQueue.length - 1) {
              setQueueIndex(queueIndex + 1);
              setSelectedVocabForPracticeId(practiceQueue[queueIndex + 1]);
            } else { setView('vocab_list'); }
          }}
        />
      )}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && (
        <VocabPracticeDetailView selectedVocabId={selectedVocabForPracticeId} allAdvancedVocab={allAdvancedVocab} onBackToPracticeHistory={() => setView('vocab_list')} onDeletePractice={handleDeletePractice} onBatchDeletePractices={handleBatchDeletePractices} />
      )}
      {view === 'rehearsal' && <Rehearsal allAdvancedVocab={allAdvancedVocab} onSaveToMuseum={(lang, reh) => { /* logic... */ }} preferredLanguages={preferredLanguages} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && <RehearsalReport evaluation={currentEntry.rehearsal} language={currentEntry.language} date={currentEntry.date} onBack={() => setView('history')} />}
      {view === 'profile' && <ProfileView user={user} editName={editName} setEditName={setEditName} editPhoto={editPhoto} setEditPhoto={setEditPhoto} isAvatarPickerOpen={isAvatarPickerOpen} setIsAvatarPickerOpen={setIsAvatarPickerOpen} avatarSeeds={AVATAR_SEEDS} onSaveProfile={handleSaveProfile} isLoading={isLoading} iterationDay={user.iterationDay ?? 0} onSetIterationDay={handleSetIterationDay} preferredLanguages={preferredLanguages} onSetPreferredLanguages={handleSetPreferredLanguages} />}
    </Layout>
  );
};

export default App;
