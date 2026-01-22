
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AdvancedVocab, PracticeRecord, ViewState } from '../types';
import { validateVocabUsage, generateDiaryAudio } from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

interface VocabPracticeProps {
  selectedVocabId: string;
  allAdvancedVocab: (AdvancedVocab & { language: string })[];
  onUpdateMastery: (vocabId: string, word: string, newMastery: number, record?: PracticeRecord) => void; // Updated first param to vocabId
  onBackToVocabList: () => void;
  onViewChange: (view: ViewState, vocabId?: string, isPracticeActive?: boolean) => void;
  isPracticeActive: boolean;
}

const VocabPractice: React.FC<VocabPracticeProps> = ({
  selectedVocabId,
  allAdvancedVocab,
  onUpdateMastery,
  onBackToVocabList,
  onViewChange,
  isPracticeActive: initialIsPracticeActive,
}) => {
  const [practiceInput, setPracticeInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; feedback: string; betterVersion?: string } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isPracticeActive, setIsPracticeActive] = useState(initialIsPracticeActive);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentVocabIndex = useMemo(() => {
    return allAdvancedVocab.findIndex(v => v.id === selectedVocabId); // Use id for finding
  }, [selectedVocabId, allAdvancedVocab]);

  const currentVocab = useMemo(() => {
    return allAdvancedVocab[currentVocabIndex];
  }, [allAdvancedVocab, currentVocabIndex]);

  useEffect(() => {
    setLastFeedback(null);
    setPracticeInput('');
    setIsPracticeActive(initialIsPracticeActive);
  }, [selectedVocabId, initialIsPracticeActive]);

  if (!currentVocab) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
        <p className="text-xl text-slate-500">词汇未找到，请返回列表。</p>
        <button onClick={onBackToVocabList} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">
          返回珍宝复习
        </button>
      </div>
    );
  }

  const renderRuby = (text: string) => {
    if (!text) return '';
    const