
import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, User as FirebaseAuthUser } from 'firebase/auth'; // Import FirebaseAuthUser
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';
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
// import PracticeHistoryView from './components/PracticeHistoryView'; // REMOVED
// import ReviewVault from './components/ReviewVault'; // REMOVED
import VocabPracticeDetailView from './components/VocabPracticeDetailView';
import Rehearsal from './components/Rehearsal';
import RehearsalReport from './components/RehearsalReport';

import { ViewState, DiaryEntry, ChatMessage, RehearsalEvaluation, DiaryIteration, AdvancedVocab, PracticeRecord } from './types';
import { analyzeDiaryEntry, synthesizeDiary } from './services/geminiService';

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
let auth;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10) {
    const existingApps = getApps();
    app = existingApps.length === 0 ? initializeApp(firebaseConfig) : existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    isFirebaseValid = true;
  }
} catch (e) {
  console.warn("Firebase config is present but invalid, falling back to local mode.");
}

const App: React.FC = () => {
  const [user, setUser] = useState<{ uid: string, displayName: string, photoURL: string, isMock: boolean } | null>(null);
  const [view, setView] = useState<ViewState>('dashboard');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<DiaryEntry | null>(null);
  const [rewriteBaseId, setRewriteBaseId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatTranscript, setChatTranscript] = useState<ChatMessage[]>([]);
  const [chatLanguage, setChatLanguage] = useState('');

  // New state for Advanced Vocabulary management
  const [allAdvancedVocab, setAllAdvancedVocab] = useState<(AdvancedVocab & { language: string })[]>([]);
  const [selectedVocabForPracticeId, setSelectedVocabForPracticeId] = useState<string | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);

  // Auth State Listener
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || '馆长',
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${firebaseUser.uid}`,
          isMock: false
        });
      } else {
        setUser(null);
        setEntries([]);
        setAllAdvancedVocab([]);
      }
    });
    return () => unsubscribe();
  }, [isFirebaseValid]);

  // Load / Save Data from Firebase or Local Storage
  const loadUserData = useCallback(async (userId: string, isMock: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      if (!db || isMock) {
        // Local storage for mock user
        const localEntries = localStorage.getItem(`linguist_entries_${userId}`);
        if (localEntries) setEntries(JSON.parse(localEntries));

        const localVocab = localStorage.getItem(`linguist_vocab_${userId}`);
        if (localVocab) setAllAdvancedVocab(JSON.parse(localVocab));

      } else {
        // Firebase for authenticated user
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.entries) setEntries(data.entries);
          if (data.advancedVocab) setAllAdvancedVocab(data.advancedVocab);
        }
      }
    } catch (e) {
      console.error("Error loading user data:", e);
      setError("无法加载数据。");
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  const saveUserData = useCallback(async (userId: string, isMock: boolean, currentEntries: DiaryEntry[], currentVocab: (AdvancedVocab & { language: string })[]) => {
    try {
      if (!db || isMock) {
        // Local storage for mock user
        localStorage.setItem(`linguist_entries_${userId}`, JSON.stringify(currentEntries));
        localStorage.setItem(`linguist_vocab_${userId}`, JSON.stringify(currentVocab));
      } else {
        // Firebase for authenticated user
        const docRef = doc(db, 'users', userId);
        await setDoc(docRef, { entries: currentEntries, advancedVocab: currentVocab }, { merge: true });
      }
    } catch (e) {
      console.error("Error saving user data:", e);
      setError("无法保存数据。");
    }
  }, [db]);

  // Effect to load data on user change
  useEffect(() => {
    if (user) {
      loadUserData(user.uid, user.isMock);
    }
  }, [user, loadUserData]);

  // Effect to save entries when they change
  useEffect(() => {
    if (user && entries.length > 0) { // Only save if there are entries and user is logged in
      saveUserData(user.uid, user.isMock, entries, allAdvancedVocab);
    }
  }, [entries, allAdvancedVocab, user, saveUserData]);

  // Handlers for App functionality

  const handleLogin = (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => {
    setUser({ ...userData, isMock });
    setView('dashboard');
  };

  const handleLogout = async () => {
    if (user?.isMock) {
      setUser(null);
      setEntries([]);
      setAllAdvancedVocab([]);
    } else if (auth) {
      await auth.signOut();
    }
    setView('dashboard');
  };

  const handleViewChange = (newView: ViewState, vocabId?: string, isPracticeActive?: boolean) => {
    setView(newView);
    setError(null);
    setCurrentEntry(null);
    setRewriteBaseId(null);
    setSelectedVocabForPracticeId(vocabId || null); // Set selected vocab ID for practice view
    setIsPracticeActive(!!isPracticeActive); // Set the practice mode flag
    if (newView === 'editor') {
      setCurrentEntry(null);
    }
    if (newView === 'chat') {
      setChatTranscript([]);
      setChatLanguage('');
    }
  };

  const handleAnalyze = async (text: string, language: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const historyContext = entries.filter(e => e.language === language && e.analysis).slice(-5); // Use last 5 relevant entries
      const analysis = await analyzeDiaryEntry(text, language, historyContext);

      const newEntryId = uuidv4();
      const timestamp = Date.now();
      const date = new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

      let newEntry: DiaryEntry;

      if (rewriteBaseId && currentEntry) {
        // This is an iteration on an existing entry
        const baseEntryIndex = entries.findIndex(e => e.id === rewriteBaseId);
        if (baseEntryIndex !== -1) {
          const updatedEntries = [...entries];
          const baseEntry = { ...updatedEntries[baseEntryIndex] };
          if (!baseEntry.iterations) baseEntry.iterations = [];
          
          // Add the original entry's initial analysis as the first iteration if not already present
          if (baseEntry.analysis && baseEntry.iterations.length === 0) {
              baseEntry.iterations.push({
                  text: baseEntry.originalText,
                  timestamp: baseEntry.timestamp,
                  analysis: baseEntry.analysis
              });
          }
          
          baseEntry.iterations.push({
            text: text,
            timestamp: timestamp,
            analysis: analysis
          });
          updatedEntries[baseEntryIndex] = baseEntry;
          setEntries(updatedEntries);
          setCurrentEntry(baseEntry); // Set current entry to the base entry being iterated on
          setRewriteBaseId(null);
        }
      } else {
        // This is a brand new entry
        newEntry = {
          id: newEntryId,
          timestamp: timestamp,
          date: date,
          originalText: text,
          language: language,
          type: 'diary',
          analysis: analysis,
          iterations: []
        };
        setEntries(prev => [newEntry!, ...prev]); // Add new entry to the beginning
        setCurrentEntry(newEntry);
      }

      // Update allAdvancedVocab after successful analysis
      setAllAdvancedVocab(prevVocab => {
        const updatedVocab = new Map<string, AdvancedVocab & { language: string }>(
          prevVocab.map(v => [`${v.word}-${v.language}`, v])
        );

        analysis.advancedVocab.forEach(newV => {
          const key = `${newV.word}-${language}`; // Ensure language is considered for uniqueness
          const existing = updatedVocab.get(key);
          if (existing) {
            // Merge or update if exists
            updatedVocab.set(key, { ...existing, ...newV, // keep existing mastery/practices
              mastery: existing.mastery || newV.mastery,
              practices: existing.practices || newV.practices
            });
          } else {
            updatedVocab.set(key, { ...newV, language: language });
          }
        });
        return Array.from(updatedVocab.values());
      });

      setView('review');

    } catch (e: any) {
      setError(e.message || "AI 分析失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatFinish = async (transcript: ChatMessage[], language: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const synthesizedText = await synthesizeDiary(transcript, language);
      const analysis = await analyzeDiaryEntry(synthesizedText, language);

      const newEntryId = uuidv4();
      const timestamp = Date.now();
      const date = new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

      const newEntry: DiaryEntry = {
        id: newEntryId,
        timestamp: timestamp,
        date: date,
        originalText: synthesizedText,
        language: language,
        type: 'diary',
        analysis: analysis,
        iterations: []
      };
      setEntries(prev => [newEntry, ...prev]);
      setCurrentEntry(newEntry);
      setChatTranscript(transcript); // Save transcript to state
      setChatLanguage(language);

      // Update allAdvancedVocab after successful analysis from chat
      setAllAdvancedVocab(prevVocab => {
        const updatedVocab = new Map<string, AdvancedVocab & { language: string }>(
          prevVocab.map(v => [`${v.word}-${v.language}`, v])
        );

        analysis.advancedVocab.forEach(newV => {
          const key = `${newV.word}-${language}`;
          const existing = updatedVocab.get(key);
          if (existing) {
            updatedVocab.set(key, { ...existing, ...newV,
              mastery: existing.mastery || newV.mastery,
              practices: existing.practices || newV.practices
            });
          } else {
            updatedVocab.set(key, { ...newV, language: language });
          }
        });
        return Array.from(updatedVocab.values());
      });

      setView('review');

    } catch (e: any) {
      setError(e.message || "AI 合成与分析失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEntry = () => {
    // This function is typically called after reviewing an entry and deciding to "exhibit" it.
    // The entry (or its latest iteration) should already be in the `entries` state.
    // If it was a new entry, it's already added by handleAnalyze. If it was an iteration, it's updated.
    // The advanced vocabulary is also already updated.
    // Just navigate back to the dashboard or history.
    setView('history');
    setCurrentEntry(null);
    setRewriteBaseId(null);
  };

  const handleSelectEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    if (entry.type === 'rehearsal' && entry.rehearsal) {
      setView('rehearsal_report');
    } else {
      setView('review');
    }
  };

  const handleRewriteEntry = (entry: DiaryEntry) => {
    setCurrentEntry(entry);
    setRewriteBaseId(entry.id);
    setView('editor');
  };

  const handleDeleteEntry = (id: string) => {
    if (window.confirm("确定要删除这篇馆藏吗？此操作不可撤销。")) {
      setEntries(prev => prev.filter(entry => entry.id === id));
      // Optionally, clean up associated vocab if it's no longer referenced elsewhere.
      // This can be complex, so for now, vocab remains in allAdvancedVocab.
      alert("馆藏已删除。");
    }
  };

  const handleSaveRehearsalToMuseum = (language: string, evaluation: RehearsalEvaluation) => {
    if (!user) return;

    const newEntryId = uuidv4();
    const timestamp = Date.now();
    const date = new Date(timestamp).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });

    const newEntry: DiaryEntry = {
      id: newEntryId,
      timestamp: timestamp,
      date: date,
      originalText: evaluation.userRetelling || evaluation.sourceText || '', // Use user retelling if available, otherwise source
      language: language,
      type: 'rehearsal',
      rehearsal: evaluation,
      iterations: [] // Rehearsals don't have iterations in the same way diaries do
    };
    setEntries(prev => [newEntry, ...prev]);
    // For now, rehearsal evaluations don't generate advanced vocab directly to the vault.
    // This could be a future enhancement if desired.
    alert("演练报告已存入收藏馆！");
    setView('history');
  };

  const handleUpdateMastery = useCallback((entryId: string, word: string, newMastery: number, record?: PracticeRecord) => {
    setAllAdvancedVocab(prev => {
      return prev.map(vocab => {
        // The key for vocab should include language for true uniqueness
        if (vocab.word === word) {
          const updatedVocab = { ...vocab, mastery: newMastery };
          if (record) {
            if (!updatedVocab.practices) updatedVocab.practices = [];
            updatedVocab.practices = [...updatedVocab.practices, record];
          }
          return updatedVocab;
        }
        return vocab;
      });
    });
  }, []);

  const getCombinedAllGems = useCallback(() => {
    const combinedGems = new Map<string, AdvancedVocab & { language: string }>(); // key: `${word}-${language}`

    entries.forEach(entry => {
      if (entry.analysis?.advancedVocab) {
        entry.analysis.advancedVocab.forEach(vocab => {
          const key = `${vocab.word}-${entry.language}`;
          if (!combinedGems.has(key)) {
            combinedGems.set(key, { ...vocab, language: entry.language, mastery: 0, practices: [] });
          }
        });
      }
      // If the vocab is already in allAdvancedVocab, it means it's deduplicated and has actual mastery/practices
    });

    // Merge with allAdvancedVocab (which contains consolidated mastery/practices)
    allAdvancedVocab.forEach(vocab => {
      const key = `${vocab.word}-${vocab.language}`;
      combinedGems.set(key, vocab); // Overwrite with consolidated version
    });

    return Array.from(combinedGems.values());
  }, [entries, allAdvancedVocab]);

  const handleStartReviewFromDashboard = () => {
    if (allAdvancedVocab.length > 0) {
      // Randomly select a vocab to start practicing
      const randomIndex = Math.floor(Math.random() * allAdvancedVocab.length);
      const selectedVocab = allAdvancedVocab[randomIndex];
      const vocabId = `${selectedVocab.word}-${selectedVocab.language}`;
      // Navigate directly to vocab_practice and set it to active mode
      handleViewChange('vocab_practice', vocabId, true);
    } else {
      alert("珍宝库中没有词汇可供练习。请先撰写日记以发现新的词汇珍宝。");
      handleViewChange('vocab_list'); // Still go to vocab list view to show empty state
    }
  };


  if (!user) {
    return (
      <AuthView
        auth={auth || null}
        isFirebaseValid={isFirebaseValid}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <Layout activeView={view} onViewChange={handleViewChange} user={user} onLogout={handleLogout}>
      {isLoading && (
        <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in">
          <div className="flex flex-col items-center space-y-4 p-8 bg-white rounded-3xl shadow-2xl border border-slate-100 text-slate-700">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-lg font-semibold">AI 馆长正在处理中...</p>
            <p className="text-sm text-slate-400 italic">请耐心等待片刻，珍宝即将呈现。</p>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-8 right-8 z-50 animate-in slide-in-from-right-8 fade-in duration-500">
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-6 py-4 rounded-2xl shadow-lg flex items-center space-x-3 max-w-sm">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-bold mb-1">操作失败</p>
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-rose-500 hover:text-rose-700">✕</button>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <Dashboard
          onNewEntry={() => handleViewChange('editor')}
          onStartReview={handleStartReviewFromDashboard}
          entries={entries}
        />
      )}
      {view === 'editor' && (
        <Editor
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          initialText={rewriteBaseId && currentEntry ? currentEntry.originalText : (currentEntry?.type === 'diary' && currentEntry.iterations && currentEntry.iterations.length > 0 ? currentEntry.iterations[currentEntry.iterations.length - 1].text : '')}
          initialLanguage={currentEntry?.language || 'English'}
        />
      )}
      {view === 'review' && currentEntry && currentEntry.analysis && (
        <Review
          analysis={currentEntry.analysis}
          language={currentEntry.language}
          iterations={currentEntry.iterations}
          onSave={handleSaveEntry}
          onBack={() => handleViewChange('dashboard')}
        />
      )}
      {view === 'history' && (
        <History
          entries={entries}
          onSelect={handleSelectEntry}
          onDelete={handleDeleteEntry}
          onRewrite={handleRewriteEntry}
        />
      )}
      {view === 'chat' && (
        <ChatEditor
          onFinish={handleChatFinish}
          allGems={getCombinedAllGems()}
        />
      )}
      {view === 'vocab_list' && (
        <VocabListView
          allAdvancedVocab={allAdvancedVocab}
          onViewChange={handleViewChange}
          onUpdateMastery={handleUpdateMastery}
        />
      )}
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
      {view === 'rehearsal' && (
        <Rehearsal
          onSaveToMuseum={handleSaveRehearsalToMuseum}
        />
      )}
      {view === 'rehearsal_report' && currentEntry && currentEntry.rehearsal && (
        <RehearsalReport
          evaluation={currentEntry.rehearsal}
          language={currentEntry.language}
          date={currentEntry.date}
          onBack={() => handleViewChange('history')}
        />
      )}
    </Layout>
  );
};

export default App;
    