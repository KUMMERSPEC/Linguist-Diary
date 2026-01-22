
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface PracticeRecord {
  sentence: string; 
  originalAttempt?: string; 
  feedback: string;
  betterVersion?: string;
  timestamp: number;
  status: 'Perfect' | 'Polished'; 
}

export interface AdvancedVocab {
  id?: string; // Added for Firestore document ID
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; 
  practices?: PracticeRecord[]; 
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
  advancedVocab: AdvancedVocab[];
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
  text: string;
  timestamp: number;
  analysis: DiaryAnalysis;
}

export interface DiaryEntry {
  id: string;
  timestamp: number; 
  date: string; 
  originalText: string;
  language: string;
  type: 'diary' | 'rehearsal';
  analysis?: DiaryAnalysis;
  rehearsal?: RehearsalEvaluation;
  iterations?: DiaryIteration[]; 
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

// 更新 ViewState 类型，新增 profile 视图
export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'vocab_list' | 'vocab_practice' | 'vocab_practice_detail' | 'practice_history' | 'rehearsal' | 'rehearsal_report' | 'profile';
