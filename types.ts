
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface ReadingPair {
  kanji: string;
  reading: string;
}

export interface AdvancedVocab {
  id: string;
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; 
  language: string;
  practices?: PracticeRecord[];
  lastReviewTimestamp?: number;
  timestamp: number;
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
  readingPairs?: ReadingPair[]; 
}

export interface PracticeRecord {
  id: string;
  sentence: string; 
  originalAttempt?: string; 
  feedback: string;
  betterVersion?: string;
  timestamp: number;
  status: 'Perfect' | 'Polished'; 
  vocabId: string;
}

export interface InspirationFragment {
  id: string;
  content: string;
  meaning?: string;
  usage?: string;
  timestamp: number;
  language: string;
  fragmentType: 'transient' | 'seed';
}

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'vocab_list' | 'vocab_practice' | 'vocab_practice_detail' | 'rehearsal' | 'rehearsal_report' | 'profile';

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export interface UserProfile {
  displayName: string;
  photoURL: string;
  iterationDay?: number;
  preferredLanguages?: string[];
  isPro?: boolean;
  proExpiry?: number;
  dailyUsageCount?: number;
  lastUsageDate?: string;
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
  iterationCount?: number;
}

export interface DiaryIteration {
  id: string;
  text: string;
  timestamp: number;
  analysis: DiaryAnalysis;
}

export interface RehearsalEvaluation {
  accuracyScore: number;
  qualityScore: number;
  contentFeedback: string;
  languageFeedback: string;
  suggestedVersion: string;
  diffedRetelling: string;
  sourceText?: string;
  userRetelling?: string;
}
