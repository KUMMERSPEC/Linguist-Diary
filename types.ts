
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface PracticeRecord {
  sentence: string;
  feedback: string;
  betterVersion?: string;
  timestamp: number;
}

export interface AdvancedVocab {
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; // 熟练度：0-3
  practices?: PracticeRecord[]; // 历次造句记录
}

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

export interface DiaryEntry {
  id: string;
  timestamp: number; 
  date: string; 
  originalText: string;
  language: string;
  analysis?: DiaryAnalysis;
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'review_vault';
