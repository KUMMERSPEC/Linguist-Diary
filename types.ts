
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
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; 
  practices?: PracticeRecord[]; 
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

export interface RehearsalEvaluation {
  accuracyScore: number;
  qualityScore: number;
  contentFeedback: string;
  languageFeedback: string;
  suggestedVersion: string;
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
  iterations?: DiaryIteration[]; // 新增：存储重写历史
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'review_vault' | 'rehearsal' | 'rehearsal_report';
