
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

export interface DiaryEntry {
  id: string;
  timestamp: number; 
  date: string; 
  originalText: string;
  language: string;
  type: 'diary' | 'rehearsal'; // 新增：区分类型
  analysis?: DiaryAnalysis;
  rehearsal?: RehearsalEvaluation; // 新增：演练报告数据
}

export interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
}

export type ViewState = 'dashboard' | 'editor' | 'review' | 'history' | 'chat' | 'review_vault' | 'rehearsal';
