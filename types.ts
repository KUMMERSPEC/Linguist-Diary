
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface PracticeRecord {
  id: string; // Added for Firestore subcollection document ID
  sentence: string; 
  originalAttempt?: string; 
  feedback: string;
  betterVersion?: string;
  timestamp: number;
  status: 'Perfect' | 'Polished'; 
  vocabId: string; // Reference to the parent vocab document ID
}

export interface AdvancedVocab {
  id: string; // Firestore document ID
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; 
  language: string; // Ensure language is always present for top-level vocab
  practiceCount?: number; // Denormalized count for UI display
  practices?: PracticeRecord[]; // Temporary local storage for practice records during display
}

// 新增 ExtendedVocab 类型，包含词汇所在的日记信息
export type ExtendedVocab = AdvancedVocab & { date: string, entryId: string, language: string };

export interface TransitionSuggestion {
  word: string;
  explanation: string;
  example: string;
}

export interface DiaryAnalysis {
  modifiedText: string;
  diffedText: string;
  corrections: Correction[];
  advancedVocab: AdvancedVocab[]; // This will store the *new* vocab identified in this analysis, not the full list from DB.
  transitionSuggestions: TransitionSuggestion[];
  overallFeedback: string;
}

export interface RehearsalEvaluation {
  accuracyScore: number;
  qualityScore: number;
  contentFeedback: string;
  languageFeedback: string;
  suggestedVersion: string;
  diffedRetelling: string; // 新增：对比后的复述文本
  sourceText?: string;
  userRetelling?: string;
}

export interface DiaryIteration {
  id: string; // Firestore document ID for the iteration
  text: string;
  timestamp: number;
  analysis: DiaryAnalysis;
}

export interface DiaryEntry {
  id: string; // Firestore document ID
  timestamp: number; 
  date: string; 
  originalText: string; // The text of the very first entry or the latest iteration for quick display
  language: string;
  type: 'diary' | 'rehearsal';
  analysis?: DiaryAnalysis; // The analysis of the latest iteration for quick display
  rehearsal?: RehearsalEvaluation; // Only for type 'rehearsal'
  iterationCount?: number; // Denormalized count for UI display
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

// 更新 ViewState 类型，新增 profile 视图
export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'vocab_list' | 'vocab_practice' | 'vocab_practice_detail' | 'practice_history' | 'rehearsal' | 'rehearsal_report' | 'profile';