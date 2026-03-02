
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { app, db, auth, isFirebaseValid } from './firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
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
  limit,
  startAfter,
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseAuthUser, updateProfile, signOut } from 'firebase/auth';
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

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab, PracticeRecord, InspirationFragment, UserProfile } from './types';
import { analyzeDiaryEntry, analyzeDiaryEntryStream, enrichFragment } from './services/geminiService';
import { stripRuby, weaveRubyMarkdown } from './utils/textHelpers';
import { calculateDiff } from './utils/diffHelper';
import { Toaster, toast } from 'react-hot-toast';

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
const FREE_DAILY_LIMIT = 2; // Non-pro daily limit for diary analysis

const App: React.FC = () => {
  const [user, setUser] = useState<{ uid: string, isMock: boolean } & UserProfile | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true); 
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [lastEntryDoc, setLastEntryDoc] = useState<any>(null);
  const [hasMoreEntries, setHasMoreEntries] = useState(true);
  const [isFetchingMoreEntries, setIsFetchingMoreEntries] = useState(false);
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
  const [showProModal, setShowProModal] = useState(false);


  const [allAdvancedVocab, setAllAdvancedVocab] = useState<AdvancedVocab[]>([]); 
  const [selectedVocabForPracticeId, setSelectedVocabForPracticeId] = useState<string | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [promotingFragmentId, setPromotingFragmentId] = useState<string | null>(null);

  const [practiceQueue, setPracticeQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const preferredLanguages = useMemo(() => user?.preferredLanguages || DEFAULT_LANGS, [user]);

  const fetchEntries = useCallback(async (userId: string, isFirstPage: boolean = false) => {
    if (!db || isFetchingMoreEntries || (!isFirstPage && !hasMoreEntries)) return;

    setIsFetchingMoreEntries(true);
    try {
      const diaryEntriesColRef = collection(db, 'users', userId, 'diaryEntries');
      let diaryEntriesQuery = query(
        diaryEntriesColRef, 
        orderBy('timestamp', 'desc'), 
        limit(12)
      );

      if (!isFirstPage && lastEntryDoc) {
        diaryEntriesQuery = query(
          diaryEntriesColRef, 
          orderBy('timestamp', 'desc'), 
          startAfter(lastEntryDoc),
          limit(12)
        );
      }

      const diaryEntriesSnapshot = await getDocs(diaryEntriesQuery);
      const newEntries = diaryEntriesSnapshot.docs.map(d => ({ 
        ...d.data(), 
        id: d.id, 
        timestamp: (d.data().timestamp as Timestamp).toMillis() 
      })) as DiaryEntry[];

      if (isFirstPage) {
        setEntries(newEntries);
      } else {
        setEntries(prev => [...prev, ...newEntries]);
      }

      setLastEntryDoc(diaryEntriesSnapshot.docs[diaryEntriesSnapshot.docs.length - 1] || null);
      setHasMoreEntries(diaryEntriesSnapshot.docs.length === 12);
    } catch (e) {
      console.error("Error fetching entries:", e);
    } finally {
      setIsFetchingMoreEntries(false);
    }
  }, [lastEntryDoc, hasMoreEntries, isFetchingMoreEntries]);

  const loadUserData = useCallback(async (userId: string, isMock: boolean) => {
    // Avoid re-loading if already loading or if we already have data for this user
    // (Optional: you might want to force reload sometimes, but for now let's stabilize)
    setIsLoading(true);
    setError(null);
    try {
      if (!db || isMock) {
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));
        setHasMoreEntries(false); 
        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));
        const localFragments = localStorage.getItem(`linguist_fragments_${userId}`);
        if (localFragments) setFragments(JSON.parse(localFragments));
        const localProfile = localStorage.getItem(`linguist_profile_${userId}`);
        if (localProfile) {
          const profile = JSON.parse(localProfile);
          setUser(prev => prev ? { iterationDay: 0, preferredLanguages: DEFAULT_LANGS, isPro: false, dailyUsageCount: 0, ...prev, ...profile } : null);
        }
      } else {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.profile) {
             setUser(prev => prev ? { iterationDay: 0, preferredLanguages: DEFAULT_LANGS, isPro: false, dailyUsageCount: 0, ...prev, ...data.profile } : null);
          }
        }
        
        // Initial fetch of entries - we use a direct call here instead of the memoized fetchEntries 
        // to avoid dependency loops if fetchEntries is unstable
        const diaryEntriesColRef = collection(db, 'users', userId, 'diaryEntries');
        const diaryEntriesQuery = query(diaryEntriesColRef, orderBy('timestamp', 'desc'), limit(12));
        const diaryEntriesSnapshot = await getDocs(diaryEntriesQuery);
        const initialEntries = diaryEntriesSnapshot.docs.map(d => ({ 
            ...d.data(), 
            id: d.id, 
            timestamp: (d.data().timestamp as Timestamp).toMillis() 
        })) as DiaryEntry[];
        
        setEntries(initialEntries);
        setLastEntryDoc(diaryEntriesSnapshot.docs[diaryEntriesSnapshot.docs.length - 1] || null);
        setHasMoreEntries(diaryEntriesSnapshot.docs.length === 12);

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
        const vocabItems = vocabSnapshot.docs.map(vDoc => ({
          ...vDoc.data(),
          id: vDoc.id,
          timestamp: (vDoc.data().timestamp as Timestamp)?.toMillis() || Date.now()
        })) as AdvancedVocab[];
        setAllAdvancedVocab(vocabItems);
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty deps to keep it stable

  useEffect(() => {
    if (!auth) {
      setIsAuthInitializing(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userPhotoURL = firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`;
        const userData: UserProfile & { uid: string, isMock: boolean } = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: userPhotoURL,
          isMock: false,
          iterationDay: 0,
          preferredLanguages: DEFAULT_LANGS,
          isPro: false,
          dailyUsageCount: 0
        };
        setUser(userData);
        localStorage.setItem('last_user_id', firebaseUser.uid);
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
        setFragments([]);
      }
      setIsAuthInitializing(false);
    });
    return () => unsubscribe();
  }, []); // Stable auth listener

  // Separate effect for loading data when user changes
  useEffect(() => {
    if (user?.uid) {
      loadUserData(user.uid, user.isMock);
    }
  }, [user?.uid, user?.isMock, loadUserData]);

  const handleLoadMoreEntries = useCallback(() => {
    if (user) {
      fetchEntries(user.uid);
    }
  }, [user, fetchEntries]);

  const updateUserQuota = useCallback(async (count: number, date: string) => {
    if (!user) return;
    const update = { dailyUsageCount: count, lastUsageDate: date };
    setUser(prev => prev ? { ...prev, ...update } : null);
    if (!db || user.isMock) {
       const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
       localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, ...update }));
    } else {
       await updateDoc(doc(db, 'users', user.uid), { profile: { ...user, ...update } });
    }
  }, [user]);

  const checkQuota = useCallback(() => {
    if (!user) return false;
    if (user.isPro) return true;
    
    const today = new Date().toDateString();
    if (user.lastUsageDate !== today) {
      // Reset count for new day
      updateUserQuota(0, today);
      return true;
    }
    
    if ((user.dailyUsageCount || 0) >= FREE_DAILY_LIMIT) {
      setShowProModal(true);
      return false;
    }
    return true;
  }, [user, updateUserQuota]);

  const incrementQuota = useCallback(() => {
    if (!user || user.isPro) return;
    const nextCount = (user.dailyUsageCount || 0) + 1;
    updateUserQuota(nextCount, new Date().toDateString());
  }, [user, updateUserQuota]);

  const handleActivatePro = async (inputCode: string): Promise<boolean> => {
    if (!user) return false;

    if (!db || user.isMock) {
      const STATIC_CODES = ['MUSEUM2025', 'LINGUIST_PRO'];
      if (STATIC_CODES.includes(inputCode.toUpperCase())) {
        const proData = { isPro: true, proExpiry: Date.now() + 30 * 24 * 60 * 60 * 1000 };
        setUser(prev => prev ? { ...prev, ...proData } : null);
        const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
        localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, ...proData }));
        return true;
      }
      return false;
    }

    try {
      const q = query(
        collection(db, 'activationCodes'), 
        where('code', '==', inputCode.trim()),
        where('status', '==', 'active')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return false;

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      let durationDays = 30;
      if (codeData.membershipType === 'pro_365d') durationDays = 365;
      else if (codeData.membershipType === 'pro_7d') durationDays = 7;

      const proExpiry = Date.now() + durationDays * 24 * 60 * 60 * 1000;
      const proData = { isPro: true, proExpiry };

      const batch = writeBatch(db);
      
      batch.update(codeDoc.ref, { 
        status: 'used', 
        usedBy: user.uid,
        usedAt: serverTimestamp() 
      });
      
      const userRef = doc(db, 'users', user.uid);
      batch.set(userRef, { profile: { ...user, ...proData } }, { merge: true });

      await batch.commit();
      setUser(prev => prev ? { ...prev, ...proData } : null);
      return true;
    } catch (e) {
      console.error("Activation failed:", e);
      return false;
    }
  };

  const handleSaveFragment = async (content: string, language: string, type: 'transient' | 'seed', predefinedMeaning?: string, predefinedUsage?: string) => {
    if (!user || !content.trim()) return;
    const fragmentData = { content, meaning: predefinedMeaning || "", usage: predefinedUsage || "", language, fragmentType: type };
    if (!db || user.isMock) {
      const newFragment: InspirationFragment = { ...fragmentData, id: uuidv4(), timestamp: Date.now() };
      setFragments(prev => [newFragment, ...prev]);
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify([newFragment, ...local]));
    } else {
      const docRef = await addDoc(collection(db, 'users', user.uid, 'fragments'), { ...fragmentData, timestamp: serverTimestamp() });
      const newFragment: InspirationFragment = { ...fragmentData, id: docRef.id, timestamp: Date.now() };
      setFragments(prev => [newFragment, ...prev]);
    }
  };

  const handlePromoteToSeed = async (id: string) => {
    if (!user) return;
    setFragments(prev => prev.map(f => f.id === id ? { ...f, fragmentType: 'seed' } : f));
    if (!db || user.isMock) {
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify(local.map((f: any) => f.id === id ? { ...f, fragmentType: 'seed' } : f)));
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'fragments', id), { fragmentType: 'seed' });
    }
  };

    const handleDeleteFragment = useCallback(async (id: string) => {
    if (!user) return;
    setFragments(prev => prev.filter(f => f.id !== id));
    if (!db || user.isMock) {
      const local = JSON.parse(localStorage.getItem(`linguist_fragments_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify(local.filter((f: any) => f.id !== id)));
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'fragments', id));
    }
  }, [user]);

    const handleSaveDraft = useCallback(async (text: string, language: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const draft: Omit<DiaryEntry, 'id'> = { timestamp: Date.now(), date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }), originalText: text, language, type: 'diary', iterationCount: 0 };
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
    } catch (e) { setError("保存草稿失败。"); } finally { setIsLoading(false); }
  }, [user, entries]);

    const handleSaveManualVocab = async (vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'>) => {
    if (!user) return;
    const normalizedNewWord = stripRuby(vocab.word).trim().toLowerCase();
    const isExisting = allAdvancedVocab.some(v => stripRuby(v.word).trim().toLowerCase() === normalizedNewWord && v.language === vocab.language);
    if (isExisting) {
      alert("该词汇已在馆藏中。");
      return;
    }

    const cleanWord = normalizedNewWord;

    const potentialParents = allAdvancedVocab
      .filter(v => v.language === vocab.language)
      .filter(v => {
        const cleanExisting = stripRuby(v.word).toLowerCase().trim();
        return cleanWord.includes(cleanExisting) && cleanWord !== cleanExisting;
      })
      .sort((a, b) => stripRuby(b.word).length - stripRuby(a.word).length);
    
    const parentId = potentialParents[0]?.id;

    if (!db || user.isMock) {
      const newVocab: AdvancedVocab = { ...vocab, id: uuidv4(), mastery: 0, practices: [], timestamp: Date.now(), parentId };
      
      const currentVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      
      const listWithUpdatedChildren = currentVocab.map((v: AdvancedVocab) => {
        if (v.language === vocab.language && !v.parentId) {
          const cleanExisting = stripRuby(v.word).toLowerCase().trim();
          if (cleanExisting.includes(cleanWord) && cleanExisting !== cleanWord) {
            return { ...v, parentId: newVocab.id };
          }
        }
        return v;
      });

      const finalVocabList = [newVocab, ...listWithUpdatedChildren];
      
      setAllAdvancedVocab(finalVocabList);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(finalVocabList));
    } else {
      const dataToSave: { [key: string]: any } = { ...vocab, mastery: 0, timestamp: serverTimestamp() };
      if (parentId) dataToSave.parentId = parentId;
      const docRef = await addDoc(collection(db, 'users', user.uid, 'advancedVocab'), dataToSave);
      
      const childrenToUpdate = allAdvancedVocab.filter(v => 
        v.language === vocab.language && 
        !v.parentId && 
        stripRuby(v.word).toLowerCase().trim().includes(cleanWord) && 
        stripRuby(v.word).toLowerCase().trim() !== cleanWord
      );

      if (childrenToUpdate.length > 0) {
        const batch = writeBatch(db);
        for (const child of childrenToUpdate) {
          batch.update(doc(db, 'users', user.uid, 'advancedVocab', child.id), { parentId: docRef.id });
        }
        await batch.commit();
      }
      
      await loadUserData(user.uid, false);
    }
  };

  const handleBulkPromoteFragments = async (fragmentIds: string[]) => {
    if (!user || promotingFragmentId) return;
    
    setPromotingFragmentId('bulk');
    const toastId = toast.loading(`正在批量升级 ${fragmentIds.length} 项记录...`);
    
    try {
      for (const id of fragmentIds) {
        const fragment = fragments.find(f => f.id === id);
        if (!fragment) continue;

        let finalMeaning = fragment.meaning;
        let finalUsage = fragment.usage;

        if (!finalMeaning || !finalUsage || finalMeaning.trim() === "" || finalUsage.trim() === "") {
          try {
            const enrichment = await enrichFragment(fragment.content, fragment.language);
            finalMeaning = finalMeaning || enrichment.meaning;
            finalUsage = finalUsage || enrichment.usage;
          } catch (aiError) {
            console.warn("AI enrichment failed for", fragment.content, aiError);
          }
        }

        const vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'> = {
          word: fragment.content,
          meaning: finalMeaning || "未命名珍宝",
          usage: finalUsage || "暂无例句",
          level: 'Intermediate',
          language: fragment.language,
          timestamp: Date.now()
        };

        // We use a simplified version of handleSaveManualVocab here to avoid repeated state updates
        const normalizedNewWord = stripRuby(vocab.word).trim().toLowerCase();
        const isExisting = allAdvancedVocab.some(v => stripRuby(v.word).trim().toLowerCase() === normalizedNewWord && v.language === vocab.language);
        
        if (!isExisting) {
          const cleanWord = normalizedNewWord;
          const potentialParents = allAdvancedVocab
            .filter(v => v.language === vocab.language)
            .filter(v => {
              const cleanExisting = stripRuby(v.word).toLowerCase().trim();
              return cleanWord.includes(cleanExisting) && cleanWord !== cleanExisting;
            })
            .sort((a, b) => stripRuby(b.word).length - stripRuby(a.word).length);
          
          const parentId = potentialParents[0]?.id;

          if (!db || user.isMock) {
            const newVocab: AdvancedVocab = { ...vocab, id: uuidv4(), mastery: 0, practices: [], timestamp: Date.now(), parentId };
            setAllAdvancedVocab(prev => [newVocab, ...prev]);
            setFragments(prev => prev.filter(f => f.id !== id));
          } else {
            const dataToSave: { [key: string]: any } = { ...vocab, mastery: 0, timestamp: serverTimestamp() };
            if (parentId) dataToSave.parentId = parentId;
            await addDoc(collection(db, 'users', user.uid, 'advancedVocab'), dataToSave);
            await deleteDoc(doc(db, 'users', user.uid, 'fragments', id));
          }
        } else {
          // If already exists, just delete the fragment
          if (!db || user.isMock) {
            setFragments(prev => prev.filter(f => f.id !== id));
          } else {
            await deleteDoc(doc(db, 'users', user.uid, 'fragments', id));
          }
        }
      }
      
      if (db && !user.isMock) {
        await loadUserData(user.uid, false);
      } else {
        // Sync local storage
        localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(allAdvancedVocab));
        localStorage.setItem(`linguist_fragments_${user.uid}`, JSON.stringify(fragments));
      }
      
      toast.success('批量升级成功！', { id: toastId });
    } catch (e) {
      console.error("Bulk promotion failed:", e);
      toast.error('批量升级失败，请重试。', { id: toastId });
    } finally {
      setPromotingFragmentId(null);
    }
  };

  /**
   * 优化后的升级函数：增加 AI 智能补全逻辑
   */
  const handlePromoteFragment = async (fragmentId: string) => {
    if (!user || promotingFragmentId) return;
    const fragment = fragments.find(f => f.id === fragmentId);
    if (!fragment) return;

    setPromotingFragmentId(fragmentId);
    try {
      let finalMeaning = fragment.meaning;
      let finalUsage = fragment.usage;

      // 如果释义或例句为空，自动调用 AI 进行智能“修缮”
      if (!finalMeaning || !finalUsage || finalMeaning.trim() === "" || finalUsage.trim() === "") {
        try {
          const enrichment = await enrichFragment(fragment.content, fragment.language);
          finalMeaning = finalMeaning || enrichment.meaning;
          finalUsage = finalUsage || enrichment.usage;
        } catch (aiError) {
          console.warn("AI enrichment failed, using fallbacks:", aiError);
        }
      }

      const vocab: Omit<AdvancedVocab, 'id' | 'mastery' | 'practices'> = {
        word: fragment.content,
        meaning: finalMeaning || "未命名珍宝",
        usage: finalUsage || "暂无例句",
        level: 'Intermediate',
        language: fragment.language,
        timestamp: Date.now()
      };

      await handleSaveManualVocab(vocab);
      await handleDeleteFragment(fragmentId);
      toast.success('成功加入珍宝馆！');
    } catch (e) {
      console.error("Promotion failed:", e);
      alert("词汇入库失败，请重试。");
    } finally {
      setPromotingFragmentId(null);
    }
  };

    const handleAnalyze = useCallback(async (text: string, language: string, usedFragmentIds: string[]) => {
    if (!user) return;
    if (!checkQuota()) return;

    setIsLoading(true);
    setError(null);

    
    try {
      const historyContext = entries.filter(e => e.language === language && e.analysis).slice(0, 3);
      
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

      incrementQuota();

      const vocabItemsToSave = analysis.advancedVocab.filter(v => {
        const normalizedNewWord = stripRuby(v.word).trim().toLowerCase();
        return !allAdvancedVocab.some(existing => {
          const normalizedExistingWord = stripRuby(existing.word).trim().toLowerCase();
          return normalizedExistingWord === normalizedNewWord && existing.language === language;
        });
      }).map(v => {
        const normalizedNewWord = stripRuby(v.word).trim().toLowerCase();
        const potentialParents = allAdvancedVocab
          .filter(existing => existing.language === language)
          .filter(existing => {
            const cleanExisting = stripRuby(existing.word).toLowerCase().trim();
            return normalizedNewWord.includes(cleanExisting) && normalizedNewWord !== cleanExisting;
          })
          .sort((a, b) => stripRuby(b.word).length - stripRuby(a.word).length);
        
        const parentId = potentialParents[0]?.id;
        return { ...v, id: uuidv4(), mastery: 0, language, practices: [], timestamp: Date.now(), parentId };
      });

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
  }, [user, entries, allAdvancedVocab, checkQuota, incrementQuota, handleSaveDraft, handleDeleteFragment, loadUserData]);

  const handleRetryFailedGems = useCallback(async (failedItems: { word: string; meaning: string; usage: string; }[]) => {
    if (!user || !currentEntry) return;
    setIsLoading(true);
    try {
      for (const item of failedItems) {
        const enrichment = await enrichFragment(item.word, currentEntry.language || 'English');
        await handleSaveManualVocab({
          word: item.word,
          meaning: enrichment.meaning || item.meaning,
          usage: enrichment.usage || item.usage,
          level: 'Intermediate',
          language: currentEntry.language || 'English',
          timestamp: Date.now()
        });
      }
      toast.success('失败词条已重新分析并入馆！');

      // Update currentEntry and entries to reflect the changes
      if (currentEntry) {
        const updatedRecommendedGems = (currentEntry.rehearsal?.recommendedGems || []).filter(gem => 
          !failedItems.some(failed => failed.word === gem.word)
        );
        const updatedRehearsal = {
          ...currentEntry.rehearsal,
          recommendedGems: updatedRecommendedGems
        };
        const updatedEntry = {
          ...currentEntry,
          rehearsal: updatedRehearsal
        };
        setCurrentEntry(updatedEntry);
        setEntries(prev => prev.map(entry => entry.id === updatedEntry.id ? updatedEntry : entry));
      }

    } catch (e) {
      console.error('Failed to retry gems:', e);
      toast.error('重新分析失败。');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentEntry, handleSaveManualVocab, setEntries, setCurrentEntry]);





    const handleAnalyzeExistingEntry = useCallback(async (entry: DiaryEntry) => {
    if (!user) return;
    if (!checkQuota()) return;
    setAnalyzingId(entry.id);
    try {
      const historyContext = entries.filter(e => e.language === entry.language && e.analysis && e.id !== entry.id).slice(0, 3);
      const analysis = await analyzeDiaryEntry(entry.originalText, entry.language, historyContext);
      incrementQuota();
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
    } catch (e) { setError("分析失败。"); } finally { setAnalyzingId(null); }
  }, [user, entries, checkQuota, incrementQuota]);

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
    const candidate = entries.find(e => e.type === 'diary' && e.analysis && e.timestamp < weekAgo && (e.iterationCount || 0) < 3);
    return candidate || null;
  }, [entries, user]);

  const handleStartSmartReview = () => {
    const needingReview = allAdvancedVocab.filter(v => (v.mastery || 0) < 5);
    if (needingReview.length === 0) { alert("所有馆藏珍宝均已达到巅峰。"); return; }
    
    // Priority 1: Mastery level 0
    // Priority 2: Forgetting curve (longest time since last review)
    const sorted = [...needingReview].sort((a, b) => {
      const masteryA = a.mastery || 0;
      const masteryB = b.mastery || 0;

      // Mastery 0 is top priority
      if (masteryA === 0 && masteryB !== 0) return -1;
      if (masteryB === 0 && masteryA !== 0) return 1;

      // If mastery is same (or both non-zero), use forgetting curve
      const timeA = a.lastReviewTimestamp || a.timestamp;
      const timeB = b.lastReviewTimestamp || b.timestamp;

      // We want the one with the OLDEST review time first (longest interval)
      if (timeA !== timeB) return timeA - timeB;
      
      // Final tie-breaker: mastery level (lower first)
      return masteryA - masteryB;
    });

    const finalQueue: string[] = [];
    const excludedIds = new Set<string>();

    for (const v of sorted) {
      if (finalQueue.length >= 10) break;
      if (excludedIds.has(v.id)) continue;

      finalQueue.push(v.id);
      
      // If we pick this item, exclude its parent and all its children from this session
      if (v.parentId) excludedIds.add(v.parentId);
      const children = allAdvancedVocab.filter(child => child.parentId === v.id);
      children.forEach(child => excludedIds.add(child.id));
    }

    setPracticeQueue(finalQueue);
    setQueueIndex(0);
    setSelectedVocabForPracticeId(finalQueue[0]);
    setIsPracticeActive(true);
    setView('vocab_practice');
  };

  const handleUpdateMastery = async (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!user) return;
    const now = Date.now();
    
    const vocabToUpdate = allAdvancedVocab.find(v => v.id === vocabId);
    const parentId = vocabToUpdate?.parentId;

    setAllAdvancedVocab(prev => {
      let next = prev.map(v => v.id === vocabId ? { 
        ...v, 
        mastery: newMastery, 
        lastReviewTimestamp: now,
        practices: record ? [record, ...(v.practices || [])] : v.practices 
      } : v);

      // Synergy Boost: If this is a child, boost parent by 20% of the gain or just a flat 0.2
      if (parentId) {
        next = next.map(v => {
          if (v.id === parentId) {
            const currentMastery = v.mastery || 0;
            const boostedMastery = Math.min(5, Number((currentMastery + 0.2).toFixed(2)));
            return { ...v, mastery: boostedMastery };
          }
          return v;
        });
      }
      return next;
    });
    
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      let updated = localVocab.map((v: any) => v.id === vocabId ? { 
        ...v, 
        mastery: newMastery, 
        lastReviewTimestamp: now,
        practices: record ? [record, ...(v.practices || [])] : v.practices 
      } : v);

      if (parentId) {
        updated = updated.map((v: any) => v.id === parentId ? { ...v, mastery: Math.min(5, Number(((v.mastery || 0) + 0.2).toFixed(2))) } : v);
      }

      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      const vocabDocRef = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      await updateDoc(vocabDocRef, { 
        mastery: newMastery,
        lastReviewTimestamp: now
      });
      if (record) { await addDoc(collection(vocabDocRef, 'practices'), { ...record, timestamp: serverTimestamp() }); }

      if (parentId) {
        const parentDocRef = doc(db, 'users', user.uid, 'advancedVocab', parentId);
        const parentSnap = await getDoc(parentDocRef);
        if (parentSnap.exists()) {
          const currentParentMastery = parentSnap.data().mastery || 0;
          await updateDoc(parentDocRef, { mastery: Math.min(5, currentParentMastery + 0.2) });
        }
      }
    }
  };

  const handleDeleteVocab = async (vocabId: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.filter(v => v.id !== vocabId));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(localVocab.filter((v: any) => v.id !== vocabId)));
    } else { await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId)); }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const profile = { displayName: editName, photoURL: editPhoto };
      if (!db || user.isMock) {
        localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...user, ...profile }));
        setUser(prev => prev ? { ...prev, ...profile } : null);
      } else {
        await updateProfile(auth.currentUser!, profile);
        await updateDoc(doc(db, 'users', user.uid), { profile: { ...user, ...profile } });
        setUser(prev => prev ? { ...prev, ...profile } : null);
      }
    } catch (e) { setError("更新档案失败。"); } finally { setIsLoading(false); }
  };

  const handleSetIterationDay = async (day: number) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, iterationDay: day } : null);
    if (!db || user.isMock) {
       const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
       localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, iterationDay: day }));
    } else { await updateDoc(doc(db, 'users', user.uid), { 'profile.iterationDay': day }); }
  };

  const handleSetPreferredLanguages = async (langs: string[]) => {
    if (!user) return;
    setUser(prev => prev ? { ...prev, preferredLanguages: langs } : null);
    if (!db || user.isMock) {
       const profile = JSON.parse(localStorage.getItem(`linguist_profile_${user.uid}`) || '{}');
       localStorage.setItem(`linguist_profile_${user.uid}`, JSON.stringify({ ...profile, preferredLanguages: langs }));
    } else { await updateDoc(doc(db, 'users', user.uid), { 'profile.preferredLanguages': langs }); }
  };

  const handleUpdateVocabLanguage = async (vocabId: string, language: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => v.id === vocabId ? { ...v, language } : v));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => v.id === vocabId ? { ...v, language } : v);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      await updateDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId), { language });
    }
  };

  const handleBulkUpdateVocabLanguage = async (vocabIds: string[], language: string) => {
    if (!user) return;
    setAllAdvancedVocab(prev => prev.map(v => vocabIds.includes(v.id) ? { ...v, language } : v));
    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: any) => vocabIds.includes(v.id) ? { ...v, language } : v);
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      const batch = writeBatch(db);
      vocabIds.forEach(id => {
        batch.update(doc(db, 'users', user.uid, 'advancedVocab', id), { language });
      });
      await batch.commit();
    }
  };

    const handleSaveRehearsal = async (rehearsalData: RehearsalEvaluation) => {
    if (!user) return;

    const newEntry: Omit<DiaryEntry, 'id'> = {
      timestamp: rehearsalData.timestamp,
      date: new Date(rehearsalData.timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      originalText: rehearsalData.sourceText,
      language: rehearsalData.language,
      type: 'rehearsal',
      rehearsal: rehearsalData,
      iterationCount: 0
    };

    if (!db || user.isMock) {
      const finalEntry = { ...newEntry, id: uuidv4() } as DiaryEntry;
      const updatedEntries = [finalEntry, ...entries];
      setEntries(updatedEntries);
      localStorage.setItem(`linguist_entries_${user.uid}`, JSON.stringify(updatedEntries));
    } else {
      const entryToSave = { ...newEntry, timestamp: serverTimestamp() };
      const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), entryToSave);
      const finalEntry = { ...newEntry, id: docRef.id } as DiaryEntry;
      setEntries(prev => [finalEntry, ...prev]);
    }
  };

  const handleViewChange = (v: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(v);
    if (vocabId) setSelectedVocabForPracticeId(vocabId);
    if (isPracticeActive !== undefined) setIsPracticeActive(isPracticeActive);
    if (v !== 'editor') { setPrefilledEditorText(''); setSummaryPrompt(''); }
  };

    const handleDeletePractice = async (vocabId: string, practiceId: string) => {
    if (!user) return;

    setAllAdvancedVocab(prev => prev.map(v => {
      if (v.id === vocabId) {
        return { ...v, practices: v.practices?.filter(p => p.id !== practiceId) };
      }
      return v;
    }));

    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: AdvancedVocab) => {
        if (v.id === vocabId) {
          return { ...v, practices: v.practices?.filter(p => p.id !== practiceId) };
        }
        return v;
      });
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'advancedVocab', vocabId, 'practices', practiceId));
    }
  };

  const handleBatchDeletePractices = async (vocabId: string, practiceIds: string[]) => {
    if (!user) return;

    setAllAdvancedVocab(prev => prev.map(v => {
      if (v.id === vocabId) {
        return { ...v, practices: v.practices?.filter(p => !practiceIds.includes(p.id)) };
      }
      return v;
    }));

    if (!db || user.isMock) {
      const localVocab = JSON.parse(localStorage.getItem(`linguist_vocab_${user.uid}`) || '[]');
      const updated = localVocab.map((v: AdvancedVocab) => {
        if (v.id === vocabId) {
          return { ...v, practices: v.practices?.filter(p => !practiceIds.includes(p.id)) };
        }
        return v;
      });
      localStorage.setItem(`linguist_vocab_${user.uid}`, JSON.stringify(updated));
    } else {
      const batch = writeBatch(db);
      practiceIds.forEach(pid => {
        const docRef = doc(db, 'users', user.uid, 'advancedVocab', vocabId, 'practices', pid);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  };

  const handleLogout = async () => {
    if (auth && !user?.isMock) { await signOut(auth); }
    setUser(null);
    setView('dashboard');
  };

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    const fullUser = { ...userData, isMock, iterationDay: 0, preferredLanguages: DEFAULT_LANGS, isPro: false, dailyUsageCount: 0 };
    setUser(fullUser);
    loadUserData(userData.uid, isMock);
  };

  if (isAuthInitializing) return (
    <div className="min-screen bg-slate-50 flex flex-col items-center justify-center p-6 space-y-6">
       <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl animate-bounce shadow-xl">🖋️</div>
       <div className="text-center">
         <h2 className="text-xl font-black text-slate-900 serif-font">Linguist Diary</h2>
         <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">载入收藏馆中...</p>
       </div>
    </div>
  );

  if (!user) return <AuthView auth={auth} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;

  const ProUpgradeModal = () => {
    const [modalCode, setModalCode] = useState('');
    const [isActivating, setIsActivating] = useState(false);

    const handleModalActivate = async () => {
      if (!modalCode.trim()) return;
      setIsActivating(true);
      const success = await handleActivatePro(modalCode);
      setIsActivating(false);
      if (success) {
        setShowProModal(false);
        setModalCode('');
      } else {
        alert("无效激活码。");
      }
    };

    return (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowProModal(false)}></div>
        <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
           <div className="bg-slate-900 p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4 shadow-xl">✨</div>
             <h3 className="text-xl font-black text-white serif-font">馆长，今日灵感配额已满</h3>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">DAILY QUOTA EXCEEDED</p>
           </div>
           <div className="p-8 space-y-6">
             <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed text-center">
                  作为标准馆长，您每天拥有 <b>{FREE_DAILY_LIMIT} 次</b> 智能校对机会。升级至 Pro 馆长，解锁无限灵感。
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 flex items-center space-x-2">
                    <span className="text-indigo-600">♾️</span>
                    <span className="text-[9px] font-black uppercase text-slate-600">无限校对次数</span>
                  </div>
                  <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100 flex items-center space-x-2">
                    <span className="text-indigo-600">🧠</span>
                    <span className="text-[9px] font-black uppercase text-slate-600">深度逻辑分析</span>
                  </div>
                </div>
             </div>

             <div className="space-y-3">
               <div className="flex items-center space-x-2 bg-slate-50 border border-slate-100 p-2 rounded-2xl focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all">
                  <input 
                    type="text" 
                    value={modalCode}
                    onChange={(e) => setModalCode(e.target.value)}
                    placeholder="输入 Pro 激活码..." 
                    className="flex-1 bg-transparent border-none focus:ring-0 text-xs px-2 font-bold"
                  />
                  <button 
                    onClick={handleModalActivate}
                    disabled={isActivating || !modalCode.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isActivating ? '...' : '立即激活'}
                  </button>
               </div>
               <button 
                 onClick={() => { setShowProModal(false); setView('profile'); }}
                 className="w-full py-3 text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:underline"
               >
                 查看订阅计划详情 →
               </button>
               <button 
                 onClick={() => setShowProModal(false)}
                 className="w-full py-3 border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 tracking-widest hover:bg-slate-50"
               >
                 稍后再说 MAYBE LATER
               </button>
             </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
      <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen}>
      {view === 'dashboard' && <Dashboard onNewEntry={() => setView('editor')} onStartReview={handleStartSmartReview} entries={entries} allAdvancedVocab={allAdvancedVocab} recommendedIteration={recommendedIteration} onStartIteration={handleStartIteration} onSaveFragment={handleSaveFragment} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} onSaveDraft={handleSaveDraft} isLoading={isLoading} initialText={prefilledEditorText} initialLanguage={chatLanguage} summaryPrompt={summaryPrompt} fragments={fragments} onDeleteFragment={handleDeleteFragment} preferredLanguages={preferredLanguages} />}
      {view === 'review' && currentEntry && <Review analysis={currentEntry.analysis!} language={currentEntry.language} iterations={currentEntryIterations} allAdvancedVocab={allAdvancedVocab} onSave={() => setView('history')} onBack={() => setView('history')} onSaveManualVocab={handleSaveManualVocab} isExistingEntry={isReviewingExisting} />}
      {/* // FIX: Updated function name from handleUpdateLanguage to handleUpdateEntryLanguage */}
      {view === 'history' && (
        <History 
          entries={entries} 
          isAnalyzingId={analyzingId} 
          onAnalyzeDraft={handleAnalyzeExistingEntry} 
          onUpdateLanguage={handleUpdateEntryLanguage} 
          onSelect={(e) => { setCurrentEntry(e); setIsReviewingExisting(true); setView(e.type === 'rehearsal' ? 'rehearsal_report' : 'review'); }} 
          onDelete={(id) => { if (!user.isMock && db) deleteDoc(doc(db, 'users', user.uid, 'diaryEntries', id)); setEntries(prev => prev.filter(e => e.id !== id)); }} 
          onRewrite={(e) => { handleStartIteration(e); }} 
          preferredLanguages={preferredLanguages} 
          isMenuOpen={isMenuOpen} 
          hasMore={hasMoreEntries} 
          onLoadMore={handleLoadMoreEntries} 
          isLoadingMore={isFetchingMoreEntries} 
        />
      )}
      {view === 'chat' && <ChatEditor onFinish={(msgs, lang, summary) => { setChatLanguage(lang); setPrefilledEditorText(''); setSummaryPrompt(summary); setView('editor'); }} allGems={allAdvancedVocab} preferredLanguages={preferredLanguages} />}
      {view === 'vocab_list' && <VocabListView allAdvancedVocab={allAdvancedVocab} fragments={fragments} onViewChange={handleViewChange} onUpdateMastery={handleUpdateMastery} onDeleteVocab={handleDeleteVocab} onDeleteFragment={handleDeleteFragment} onPromoteFragment={handlePromoteFragment} onPromoteToSeed={handlePromoteToSeed} onBulkPromoteFragments={handleBulkPromoteFragments} isMenuOpen={isMenuOpen} onBulkUpdateLanguage={handleBulkUpdateVocabLanguage} promotingFragmentId={promotingFragmentId} />}
      {view === 'vocab_practice' && selectedVocabForPracticeId && (
        <VocabPractice 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onUpdateMastery={handleUpdateMastery} 
          onBackToVocabList={() => { setView('vocab_list'); setIsPracticeActive(false); }} 
          onViewChange={handleViewChange} 
          onSaveFragment={handleSaveFragment} 
          isPracticeActive={isPracticeActive} 
          queueProgress={practiceQueue.length > 0 ? { current: queueIndex + 1, total: practiceQueue.length } : undefined} 
          onNextInQueue={() => { 
            if (queueIndex < practiceQueue.length - 1) { 
              setQueueIndex(queueIndex + 1); 
              setSelectedVocabForPracticeId(practiceQueue[queueIndex + 1]); 
            } else { 
              setView('vocab_list'); 
              setIsPracticeActive(false);
            } 
          }} 
          nextVocabId={queueIndex < practiceQueue.length - 1 ? practiceQueue[queueIndex + 1] : undefined}
        />
      )}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && (
        <VocabPracticeDetailView selectedVocabId={selectedVocabForPracticeId} allAdvancedVocab={allAdvancedVocab} onBackToPracticeHistory={() => setView('vocab_list')} onUpdateLanguage={handleUpdateVocabLanguage} preferredLanguages={preferredLanguages} onDeletePractice={handleDeletePractice} onBatchDeletePractices={handleBatchDeletePractices} />
      )}
      {view === 'rehearsal' && <Rehearsal allAdvancedVocab={allAdvancedVocab} preferredLanguages={preferredLanguages} onSaveRehearsal={handleSaveRehearsal} onSaveVocab={handleSaveManualVocab} setView={setView} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && <RehearsalReport evaluation={currentEntry.rehearsal} language={currentEntry.language} date={currentEntry.date} onBack={() => setView('history')} onSaveVocab={handleSaveManualVocab} onRetryFailed={handleRetryFailedGems} isArchived={true} existingVocab={allAdvancedVocab} />}
      {view === 'profile' && <ProfileView user={user} editName={editName} setEditName={setEditName} editPhoto={editPhoto} setEditPhoto={setEditPhoto} isAvatarPickerOpen={isAvatarPickerOpen} setIsAvatarPickerOpen={setIsAvatarPickerOpen} avatarSeeds={AVATAR_SEEDS} onSaveProfile={handleSaveProfile} isLoading={isLoading} iterationDay={user.iterationDay ?? 0} onSetIterationDay={handleSetIterationDay} preferredLanguages={preferredLanguages} onSetPreferredLanguages={handleSetPreferredLanguages} onActivatePro={handleActivatePro} />}
      
      {showProModal && <ProUpgradeModal />}
    </Layout>
    </div>
  );
};

export default App;
