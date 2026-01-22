

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
  writeBatch, // Import writeBatch for atomic operations
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
// Corrected import syntax: changed `=>` to `from`
import { analyzeDiaryEntry } from './services/geminiService';
import { stripRuby } from './utils/textHelpers';

const firebaseConfig = {
  // Updated to use process.env for consistency and to resolve TypeScript errors
  apiKey: process.env.VITE_FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.VITE_FIREBASE_APP_ID || ""
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
  console.warn("⚠️ 未检测到有效的 Firebase API Key。");
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

  // Profile editing state
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
    console.log(`[DEBUG] Attempting to load data for user: ${userId}, isMock: ${isMock}`);

    try {
      if (!db || isMock) {
        // Mock data loading
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));
        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));
        
        const localProfile = localStorage.getItem(`linguist_profile_${userId}`);
        if (localProfile) {
          const { displayName, photoURL } = JSON.parse(localProfile);
          setUser(prev => prev ? { ...prev, displayName, photoURL } : null);
        }
        console.log(`[DEBUG] Mock data loaded for ${userId}: Entries ${localEntries ? JSON.parse(localEntries).length : 0}, Vocab ${localVocab ? JSON.parse(localVocab).length : 0}`);

      } else {
        // --- Load Profile from main user document ---
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (data.profile) {
             setUser(prev => prev ? { ...prev, ...data.profile } : null);
             console.log(`[DEBUG] Firebase profile loaded for ${userId}: ${data.profile.displayName}`);
          } else {
             // Fallback to Firebase auth data if no profile in doc
             setUser(prev => prev ? { 
                ...prev, 
                displayName: auth.currentUser?.displayName || prev.displayName, 
                photoURL: auth.currentUser?.photoURL || prev.photoURL 
             } : null);
             console.log(`[DEBUG] Firebase profile fallback used for ${userId}`);
          }
        } else {
          // Create user profile if it doesn't exist
          await setDoc(userDocRef, { 
            profile: { 
              displayName: auth.currentUser?.displayName || '馆长', 
              photoURL: auth.currentUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
            }
          });
          console.log(`[DEBUG] New Firebase profile created for ${userId}`);
        }

        // --- Load Diary Entries from top-level collection ---
        const diaryEntriesColRef = collection(db, 'users', userId, 'diaryEntries');
        const diaryEntriesQuery = query(diaryEntriesColRef, orderBy('timestamp', 'desc'));
        const diaryEntriesSnapshot = await getDocs(diaryEntriesQuery);
        const loadedEntries: DiaryEntry[] = diaryEntriesSnapshot.docs.map(d => ({ 
            ...d.data(), 
            id: d.id, 
            timestamp: (d.data().timestamp as Timestamp).toMillis() 
        })) as DiaryEntry[];
        setEntries(loadedEntries);
        console.log(`[DEBUG] Firebase Diary Entries loaded for ${userId}: Count = ${loadedEntries.length}, Data:`, loadedEntries);


        // --- Load Advanced Vocab from top-level collection ---
        const advancedVocabColRef = collection(db, 'users', userId, 'advancedVocab');
        const advancedVocabQuery = query(advancedVocabColRef, orderBy('word', 'asc')); 
        const advancedVocabSnapshot = await getDocs(advancedVocabQuery);
        const loadedVocab: AdvancedVocab[] = advancedVocabSnapshot.docs.map(d => ({ ...d.data(), id: d.id })) as AdvancedVocab[];
        setAllAdvancedVocab(loadedVocab);
        console.log(`[DEBUG] Firebase Advanced Vocab loaded for ${userId}: Count = ${loadedVocab.length}, Data:`, loadedVocab);
      }
    } catch (e) {
      console.error("[DEBUG] Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
      console.log(`[DEBUG] Finished loading data for user: ${userId}`);
    }
  }, [auth, db]);

  const saveProfileData = useCallback(async (userId: string, isMock: boolean, updatedProfile: { displayName: string, photoURL: string }) => {
    try {
      if (!db || isMock) {
        localStorage.setItem(`linguist_profile_${userId}`, JSON.stringify(updatedProfile));
        console.log(`[DEBUG] Mock profile saved for ${userId}:`, updatedProfile);
      } else {
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { profile: updatedProfile }, { merge: true });
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, updatedProfile);
        }
        console.log(`[DEBUG] Firebase profile saved for ${userId}:`, updatedProfile);
      }
    } catch (e) {
      console.error("[DEBUG] Error saving profile data:", e);
    }
  }, [auth, db]);

  useEffect(() => {
    if (user) {
      loadUserData(user.uid, user.isMock);
    }
  }, [user?.uid, user?.isMock, loadUserData]);

  useEffect(() => {
    if (user && user.displayName && user.photoURL && (user.displayName !== editName || user.photoURL !== editPhoto)) {
      setEditName(user.displayName);
      setEditPhoto(user.photoURL);
    }
  }, [user?.displayName, user?.photoURL, editName, editPhoto, user]);


  const handleLogin = useCallback((userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    setUser({ ...userData, isMock });
    setView('dashboard');
    console.log(`[DEBUG] User logged in: ${userData.uid}, isMock: ${isMock}`);
  }, []);

  const handleLogout = useCallback(async () => {
    console.log(`[DEBUG] User logging out: ${user?.uid}`);
    if (user?.isMock) {
      setUser(null);
      setEntries([]);
      setAllAdvancedVocab([]);
    } else if (auth) {
      await auth.signOut();
    }
    setView('dashboard');
  }, [auth, user?.isMock, user?.uid]);

  const handleViewChange = useCallback((newView: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(newView);
    setError(null);
    setSelectedVocabForPracticeId(vocabId || null);
    setIsPracticeActive(!!isPracticeActive);
    if (newView !== 'editor') {
      setPrefilledEditorText('');
      setChatLanguage('');
      setRewriteBaseEntryId(null); 
    }
    if (newView === 'profile' && user) {
      setEditName(user.displayName);
      setEditPhoto(user.photoURL);
      setIsAvatarPickerOpen(false);
    }
    console.log(`[DEBUG] View changed to: ${newView}`);
  }, [user]);

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const updatedProfile = { displayName: editName, photoURL: editPhoto };
    setUser(prev => prev ? { ...prev, ...updatedProfile } : null); 
    
    try {
      await saveProfileData(user.uid, user.isMock, updatedProfile);
      alert("馆长档案已云端同步！");
      console.log(`[DEBUG] Profile saved successfully for ${user.uid}`);
    } catch (e) {
      console.error("[DEBUG] Error saving profile:", e);
      setError("保存个人配置失败。");
      setUser(user); // Revert UI state if save fails
    } finally {
      setIsLoading(false);
    }
  }, [user, editName, editPhoto, saveProfileData]);

  const handleAnalyze = useCallback(async (text: string, language: string) => {
    console.log(`[App] handleAnalyze: Function called. Text length: ${text.length}, language: ${language}`);
    if (!user) {
      console.error("[App] handleAnalyze: User not authenticated.");
      setError("请先登录才能进行 AI 分析。");
      return;
    }
    if (!db) {
      console.error("[App] handleAnalyze: Firestore database not initialized.");
      setError("数据库未连接，无法保存分析结果。");
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log(`[App] handleAnalyze: Loading state set to true for user: ${user.uid}, language: ${language}`);

    try {
      const historyContext = entries
        .filter(e => e.language === language && e.analysis)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) 
        .slice(0, 5); 
      console.log(`[App] handleAnalyze: Preparing to call analyzeDiaryEntry. History context length: ${historyContext.length}`);

      const analysis = await analyzeDiaryEntry(text, language, historyContext);
      console.log(`[App] handleAnalyze: analyzeDiaryEntry completed. Analysis result:`, analysis);

      const timestamp = serverTimestamp(); 
      const clientTimestamp = Date.now(); 
      console.log(`[App] handleAnalyze: Server timestamp requested, client timestamp: ${clientTimestamp}`);

      // --- Handle Diary Entry (New or Iteration) ---
      let targetEntry: DiaryEntry;
      if (rewriteBaseEntryId && currentEntry) {
        console.log(`[App] handleAnalyze: Processing as an iteration for existing entry ${rewriteBaseEntryId}`);
        const baseEntryDocRef = doc(db, 'users', user.uid, 'diaryEntries', rewriteBaseEntryId);
        
        const iterationColRef = collection(baseEntryDocRef, 'iterations');
        const newIterationDocRef = await addDoc(iterationColRef, {
          text: text,
          timestamp: timestamp,
          analysis: analysis,
        });
        const newIteration: DiaryIteration = {
          id: newIterationDocRef.id,
          text: text,
          timestamp: clientTimestamp, // Use client timestamp for local state
          analysis: analysis,
        };
        console.log(`[App] handleAnalyze: Added new iteration ${newIteration.id} for entry ${rewriteBaseEntryId}`);

        await updateDoc(baseEntryDocRef, {
          originalText: text, // Denormalize latest text to parent
          analysis: analysis, // Denormalize latest analysis to parent
          timestamp: timestamp, // Update parent timestamp
          iterationCount: (currentEntry.iterationCount || 0) + 1, // Increment denormalized count
        });
        console.log(`[App] handleAnalyze: Updated base entry ${rewriteBaseEntryId} with latest data.`);

        targetEntry = {
          ...currentEntry,
          originalText: text,
          analysis: analysis,
          timestamp: clientTimestamp, // Update local entry timestamp
          iterationCount: (currentEntry.iterationCount || 0) + 1,
        } as DiaryEntry; // Explicitly cast to DiaryEntry
        setEntries(prev => prev.map(e => e.id === rewriteBaseEntryId ? targetEntry : e));
        setCurrentEntry(targetEntry);
        setCurrentEntryIterations(prev => [...prev, newIteration]);
        setRewriteBaseEntryId(null); 
      } else {
        console.log(`[App] handleAnalyze: Creating a new diary entry.`);
        const newEntryData = {
          timestamp: timestamp,
          date: new Date(clientTimestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
          originalText: text,
          language: language,
          type: 'diary',
          analysis: analysis,
          iterationCount: 0,
        };
        const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), newEntryData);
        targetEntry = { ...newEntryData, id: docRef.id, timestamp: clientTimestamp } as DiaryEntry; // Explicitly cast to DiaryEntry
        setEntries(prev => [targetEntry, ...prev]);
        setCurrentEntry(targetEntry);
        setCurrentEntryIterations([]); 
        console.log(`[App] handleAnalyze: Created new diary entry ${targetEntry.id}`);
      }

      // --- Handle Advanced Vocab Updates ---
      const batch = writeBatch(db);
      const updatedVocabList: AdvancedVocab[] = [...allAdvancedVocab]; 
      console.log(`[App] handleAnalyze: Processing ${analysis.advancedVocab.length} new vocab items.`);

      for (const newV of analysis.advancedVocab) {
        const cleanedNewWord = stripRuby(newV.word).toLowerCase();
        const existingVocab = updatedVocabList.find(v =>
            stripRuby(v.word).toLowerCase() === cleanedNewWord && v.language === language
        );

        if (existingVocab) {
            const vocabDocRef = doc(db, 'users', user.uid, 'advancedVocab', existingVocab.id);
            batch.update(vocabDocRef, { 
                meaning: newV.meaning,
                usage: newV.usage,
                level: newV.level,
            });
            // Update local state immediately
            Object.assign(existingVocab, { meaning: newV.meaning, usage: newV.usage, level: newV.level });
            console.log(`[App] handleAnalyze: Updated existing vocab ${existingVocab.id}: ${existingVocab.word}`);
        } else {
            const vocabToAdd: AdvancedVocab = { 
                id: uuidv4(), // Client-generated ID for immediate local use
                ...newV, 
                language, 
                mastery: 0, 
                practiceCount: 0,
            };
            const newVocabDocRef = doc(collection(db, 'users', user.uid, 'advancedVocab'), vocabToAdd.id);
            batch.set(newVocabDocRef, vocabToAdd);
            updatedVocabList.push(vocabToAdd);
            console.log(`[App] handleAnalyze: Added new vocab ${vocabToAdd.id}: ${vocabToAdd.word}`);
        }
      }
      console.log(`[App] handleAnalyze: Committing vocab batch.`);
      await batch.commit();
      setAllAdvancedVocab(updatedVocabList); 
      console.log(`[App] handleAnalyze: Vocab batch commit complete. Total vocab: ${updatedVocabList.length}`);

      setPrefilledEditorText('');
      setView('review');
      console.log(`[App] handleAnalyze: Successfully completed analysis and saved data. View set to 'review'.`);
    } catch (e: any) {
      console.error("[App] handleAnalyze: Caught error during analysis or data saving:", e);
      setError(e.message || "AI 分析失败。");
    } finally {
      setIsLoading(false);
      console.log(`[App] handleAnalyze: Loading state set to false.`);
    }
  }, [user, db, entries, rewriteBaseEntryId, currentEntry, allAdvancedVocab]);

  const handleChatFinish = useCallback((transcript: ChatMessage[], language: string) => {
    const draft = transcript
      .filter(m => m.role === 'user')
      .map(m => m.content.trim())
      .join('\n\n');
    setPrefilledEditorText(draft);
    setChatLanguage(language);
    handleViewChange('editor');
    console.log(`[DEBUG] Chat finished, drafting to editor. Language: ${language}`);
  }, [handleViewChange]);

  const handleSaveEntry = useCallback(() => {
    handleViewChange('history');
    setCurrentEntry(null);
    setCurrentEntryIterations([]);
    setRewriteBaseEntryId(null);
    console.log(`[DEBUG] Entry saved, returning to history.`);
  }, [handleViewChange]);

  const handleSelectEntry = useCallback(async (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    console.log(`[DEBUG] Selected entry: ${entry.id}, type: ${entry.type}`);
    if (db && user) {
      setIsLoading(true);
      try {
        const iterationColRef = collection(db, 'users', user.uid, 'diaryEntries', entry.id, 'iterations');
        const iterationQuery = query(iterationColRef, orderBy('timestamp', 'asc'));
        const iterationSnapshot = await getDocs(iterationQuery);
        const loadedIterations: DiaryIteration[] = iterationSnapshot.docs.map(d => ({ ...d.data(), id: d.id, timestamp: (d.data().timestamp as Timestamp).toMillis() })) as DiaryIteration[];
        setCurrentEntryIterations(loadedIterations);
        console.log(`[DEBUG] Loaded ${loadedIterations.length} iterations for entry ${entry.id}`);
      } catch (e) {
        console.error("[DEBUG] Error loading iterations:", e);
        setError("无法加载日记迭代记录。");
        setCurrentEntryIterations([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (entry.type === 'rehearsal' && entry.rehearsal) {
      handleViewChange('rehearsal_report');
    } else {
      handleViewChange('review');
    }
  }, [db, user, handleViewChange]);

  const handleRewriteEntry = useCallback((entry: DiaryEntry) => {
    setPrefilledEditorText(entry.originalText);
    setChatLanguage(entry.language);
    setRewriteBaseEntryId(entry.id);
    setCurrentEntry(entry); // Set currentEntry for iteration count updates
    handleViewChange('editor');
    console.log(`[DEBUG] Rewriting entry: ${entry.id}`);
  }, [handleViewChange]);

  const handleDeleteEntry = useCallback(async (entryId: string) => {
    if (!user || !db || !window.confirm("确定要永久删除这篇日记及其所有迭代记录吗？此操作不可撤销。")) return;
    
    setIsLoading(true);
    setError(null);
    console.log(`[DEBUG] Deleting entry: ${entryId} for user: ${user.uid}`);
    try {
      const entryDocRef = doc(db, 'users', user.uid, 'diaryEntries', entryId);
      const batch = writeBatch(db);

      // Delete all iterations in the subcollection
      const iterationsColRef = collection(entryDocRef, 'iterations');
      const iterationSnapshot = await getDocs(iterationsColRef);
      iterationSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        console.log(`[DEBUG] Deleting iteration: ${doc.id}`);
      });

      // Delete the main diary entry document
      batch.delete(entryDocRef);
      await batch.commit();

      setEntries(prev => prev.filter(e => e.id !== entryId));
      if (currentEntry?.id === entryId) {
        setCurrentEntry(null);
        setCurrentEntryIterations([]);
      }
      alert("日记及其迭代记录已成功删除。");
      console.log(`[DEBUG] Entry ${entryId} and its iterations successfully deleted.`);
    } catch (e: any) {
      console.error("[DEBUG] Error deleting entry:", e);
      setError(`删除日记失败: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, db, currentEntry]);

  const handleUpdateMastery = useCallback(async (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    if (!user || !db) return;
    setIsLoading(true); // Maybe a lighter loading state or no loading for quick updates
    setError(null);
    console.log(`[DEBUG] Updating mastery for vocab: ${vocabId}, new mastery: ${newMastery}`);

    try {
      const vocabDocRef = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      const batch = writeBatch(db);
      
      // Update mastery and practiceCount on the parent AdvancedVocab document
      batch.update(vocabDocRef, {
        mastery: newMastery,
        practiceCount: (allAdvancedVocab.find(v => v.id === vocabId)?.practiceCount || 0) + 1,
      });

      // Add a new practice record to the subcollection if provided
      if (record) {
        const practiceColRef = collection(vocabDocRef, 'practices');
        batch.add(practiceColRef, { ...record, timestamp: serverTimestamp() });
        console.log(`[DEBUG] Added practice record for vocab ${vocabId}`);
      }

      await batch.commit();

      // Update local state
      setAllAdvancedVocab(prev => prev.map(v => 
        v.id === vocabId 
          ? { 
              ...v, 
              mastery: newMastery, 
              practiceCount: (v.practiceCount || 0) + 1,
              // Add the new practice record to the local array
              practices: record ? [...(v.practices || []), { ...record, id: uuidv4(), timestamp: Date.now() }] : v.practices
            } 
          : v
      ));
      console.log(`[DEBUG] Mastery update and practice record batch commit complete for vocab ${vocabId}`);
    } catch (e: any) {
      console.error("[DEBUG] Error updating mastery or adding practice record:", e);
      setError(`更新词汇掌握度失败: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, db, allAdvancedVocab]);

  const handleDeleteVocab = useCallback(async (vocabId: string) => {
    if (!user || !db || !window.confirm("确定要永久删除此词汇及其所有练习记录吗？此操作不可撤销。")) return;

    setIsLoading(true);
    setError(null);
    console.log(`[DEBUG] Deleting vocab: ${vocabId} for user: ${user.uid}`);
    try {
      const vocabDocRef = doc(db, 'users', user.uid, 'advancedVocab', vocabId);
      const batch = writeBatch(db);

      // Delete all practice records in the subcollection
      const practicesColRef = collection(vocabDocRef, 'practices');
      const practicesSnapshot = await getDocs(practicesColRef);
      practicesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        console.log(`[DEBUG] Deleting practice record: ${doc.id}`);
      });

      // Delete the main advanced vocab document
      batch.delete(vocabDocRef);
      await batch.commit();

      setAllAdvancedVocab(prev => prev.filter(v => v.id !== vocabId));
      alert("词汇及其练习记录已成功删除。");
      console.log(`[DEBUG] Vocab ${vocabId} and its practices successfully deleted.`);
    } catch (e: any) {
      console.error("[DEBUG] Error deleting vocab:", e);
      setError(`删除词汇失败: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, db]);


  const handleSaveRehearsalToMuseum = useCallback(async (language: string, result: RehearsalEvaluation) => {
    if (!user || !db) return;
    setIsLoading(true);
    setError(null);
    console.log(`[DEBUG] Saving rehearsal to museum for user: ${user.uid}, language: ${language}`);
    try {
      const timestamp = serverTimestamp();
      const clientTimestamp = Date.now();
      const newEntryData = {
        timestamp: timestamp,
        date: new Date(clientTimestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
        originalText: result.userRetelling || "",
        language: language,
        type: 'rehearsal',
        rehearsal: result,
        iterationCount: 0,
      };
      const docRef = await addDoc(collection(db, 'users', user.uid, 'diaryEntries'), newEntryData);
      const newEntry: DiaryEntry = { ...newEntryData, id: docRef.id, timestamp: clientTimestamp } as DiaryEntry; // Explicitly cast to DiaryEntry
      setEntries(prev => [newEntry, ...prev]);
      alert("演练报告已存入收藏馆！");
      handleViewChange('history');
      console.log(`[DEBUG] Rehearsal entry ${newEntry.id} saved.`);
    } catch (e: any) {
      console.error("[DEBUG] Error saving rehearsal:", e);
      setError(`保存演练报告失败: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [user, db, handleViewChange]);

  const currentChatGems = useMemo(() => {
    // Filter advanced vocab for the current chat language that are not yet mastered
    return allAdvancedVocab.filter(v => 
      v.language === chatLanguage && (v.mastery || 0) < 3 // Assuming mastery < 3 means 'not mastered'
    );
  }, [allAdvancedVocab, chatLanguage]);

  if (!user && isFirebaseValid) {
    return <AuthView auth={auth} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;
  }

  if (!user && !isFirebaseValid) {
    return <AuthView auth={null} isFirebaseValid={isFirebaseValid} onLogin={handleLogin} />;
  }

  return (
    <Layout 
      activeView={view} 
      onViewChange={handleViewChange} 
      user={user || { uid: 'guest', displayName: '访客', photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=guest`, isMock: true }}
      onLogout={handleLogout}
    >
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>AI 正在为您处理，请稍候...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 right-4 bg-rose-500 text-white p-4 rounded-xl shadow-lg z-50 flex items-center space-x-2 animate-in slide-in-from-right-8 fade-in duration-500">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="ml-2 px-2 py-1 bg-rose-600 rounded-lg text-xs">X</button>
        </div>
      )}

      {view === 'dashboard' && <Dashboard onNewEntry={() => handleViewChange('editor')} onStartReview={() => handleViewChange('history')} entries={entries} />}
      {view === 'editor' && <Editor onAnalyze={handleAnalyze} isLoading={isLoading} initialText={prefilledEditorText} initialLanguage={chatLanguage || 'English'} />}
      {view === 'review' && currentEntry && (
        <Review 
          analysis={currentEntry.analysis!} 
          language={currentEntry.language} 
          iterations={currentEntryIterations}
          onSave={handleSaveEntry} 
          onBack={() => { 
            handleViewChange('history');
            setCurrentEntry(null);
            setCurrentEntryIterations([]);
            setRewriteBaseEntryId(null);
          }} 
        />
      )}
      {view === 'history' && <History entries={entries} onSelect={handleSelectEntry} onDelete={handleDeleteEntry} onRewrite={handleRewriteEntry} />}
      {view === 'chat' && <ChatEditor onFinish={handleChatFinish} allGems={currentChatGems} />}
      {view === 'vocab_list' && <VocabListView allAdvancedVocab={allAdvancedVocab} onViewChange={handleViewChange} onUpdateMastery={handleUpdateMastery} />}
      {view === 'vocab_practice' && selectedVocabForPracticeId && (
        <VocabPractice 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onUpdateMastery={handleUpdateMastery} 
          onBackToVocabList={() => handleViewChange('vocab_list')}
          onViewChange={handleViewChange}
          isPracticeActive={isPracticeActive}
        />
      )}
      {view === 'vocab_practice_detail' && selectedVocabForPracticeId && (
        <VocabPracticeDetailView 
          selectedVocabId={selectedVocabForPracticeId} 
          allAdvancedVocab={allAdvancedVocab} 
          onBackToPracticeHistory={() => handleViewChange('vocab_list')} 
        />
      )}
      {view === 'rehearsal' && <Rehearsal onSaveToMuseum={handleSaveRehearsalToMuseum} />}
      {view === 'rehearsal_report' && currentEntry?.rehearsal && (
        <RehearsalReport 
          evaluation={currentEntry.rehearsal} 
          language={currentEntry.language} 
          date={currentEntry.date} 
          onBack={() => handleViewChange('history')} 
        />
      )}
      {view === 'profile' && user && (
        <ProfileView
          user={user}
          editName={editName}
          setEditName={setEditName}
          editPhoto={editPhoto}
          setEditPhoto={setEditPhoto}
          isAvatarPickerOpen={isAvatarPickerOpen}
          setIsAvatarPickerOpen={setIsAvatarPickerOpen}
          avatarSeeds={AVATAR_SEEDS}
          onSaveProfile={handleSaveProfile}
          isLoading={isLoading}
        />
      )}
    </Layout>
  );
};

export default App;
