
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface AdvancedVocab {
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
}

export interface DiaryAnalysis {
  modifiedText: string;
  diffedText: string;
  corrections: Correction[];
  advancedVocab: AdvancedVocab[];
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

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat';
