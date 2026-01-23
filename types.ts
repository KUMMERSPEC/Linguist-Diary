
export interface Correction {
  original: string;
  improved: string;
  explanation: string;
  category: 'Grammar' | 'Vocabulary' | 'Style' | 'Spelling';
}

export interface SynonymStep {
  word: string;
  level: string;
  nuance: string;
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
  // 新增字段
  context?: string;
  appropriatenessScore?: number; // 0-100
  synonymLadder?: SynonymStep[];
}

export interface AdvancedVocab {
  id: string;
  word: string;
  meaning: string;
  usage: string;
  level: 'Intermediate' | 'Advanced' | 'Native';
  mastery?: number; 
  language: string;
  practiceCount?: number;
  practices?: PracticeRecord[];
}

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
  diffedRetelling: string;
  sourceText?: string;
  userRetelling?: string;
}

export interface DiaryIteration {
  id: string;
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
  iterationCount?: number;
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'vocab_list' | 'vocab_practice' | 'vocab_practice_detail' | 'practice_history' | 'rehearsal' | 'rehearsal_report' | 'profile';
