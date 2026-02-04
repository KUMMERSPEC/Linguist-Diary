
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";
import { calculateDiff } from "../utils/diffHelper";

const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

const isRetryableError = (error: any): boolean => {
  const message = error?.message || "";
  const status = error?.status || error?.code;
  return (status === 500 || status === 429 || status === "UNKNOWN" || message.includes("xhr error") || message.includes("fetch"));
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (error: any) {
      lastError = error;
      if (!isRetryableError(error) || i === maxRetries - 1) throw error;
      const delay = initialDelay * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  // Token Saving: Only use overall feedback from last 2 entries for context
  const historyContext = history.slice(0, 2).map(e => `- ${e.date}: ${e.analysis?.overallFeedback}`).join('\n');
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: "${text}". Lang: ${language}.
      Context: ${historyContext}
      
      Task:
      1. Correct text.
      2. If Japanese: NO brackets in 'modifiedText'.
      3. If Japanese: 'readingPairs' ONLY for N2+ level words. Skip easy words (私,今日,学校,日本,etc).
      4. Feedbacks/explanations in CHINESE.
      5. 'advancedVocab.meaning' in ${language}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modifiedText: { type: Type.STRING },
            overallFeedback: { type: Type.STRING },
            readingPairs: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kanji: { type: Type.STRING },
                  reading: { type: Type.STRING }
                },
                required: ["kanji", "reading"]
              }
            },
            corrections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  improved: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ['Grammar', 'Vocabulary', 'Style', 'Spelling'] }
                },
                required: ["original", "improved", "explanation", "category"]
              }
            },
            advancedVocab: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  usage: { type: Type.STRING },
                  level: { type: Type.STRING, enum: ['Intermediate', 'Advanced', 'Native'] }
                },
                required: ["word", "meaning", "usage", "level"]
              }
            },
            transitionSuggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  example: { type: Type.STRING }
                },
                required: ["word", "explanation", "example"]
              }
            }
          },
          required: ["modifiedText", "corrections", "advancedVocab", "transitionSuggestions", "overallFeedback"]
        }
      }
    });
    
    const analysis = JSON.parse(response.text) as DiaryAnalysis;
    analysis.diffedText = calculateDiff(text, analysis.modifiedText);
    return analysis;
  });
};

export const getChatFollowUp = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  // Token Saving: Sliding window - only send last 6 messages to maintain context
  const recentMessages = messages.slice(-6);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: recentMessages.map(m => ({ 
      role: m.role === 'ai' ? 'model' : 'user', 
      parts: [{ text: m.content }] 
    })),
    config: {
      systemInstruction: `You are a language tutor in ${language}. Keep responses short (max 2 sentences) to encourage user to speak more.`
    }
  });
  return response.text || "";
};

export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string): Promise<any> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Word: "${word}" (${meaning}). Sentence: "${sentence}". Lang: ${language}.
      Correct? Feedback (CN). Better version. 1-2 key phrases.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            betterVersion: { type: Type.STRING },
            keyPhrases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  explanation: { type: Type.STRING }
                },
                required: ["phrase", "explanation"]
              }
            }
          },
          required: ["isCorrect", "feedback", "betterVersion"]
        }
      }
    });
    return JSON.parse(response.text);
  });
};

export const generatePracticeArtifact = async (language: string, keywords: string, difficultyId: string, topicLabel: string): Promise<string> => {
  const ai = getAiInstance();
  // Token Saving: Hard-coded length constraints in system instruction
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Topic: ${topicLabel}. Lang: ${language}. Keywords: ${keywords}. Diff: ${difficultyId}.
    Rules: Pure text. No title. 
    Length: Beginner < 50w, Intermediate < 80w, Advanced < 120w.`,
  });
  return response.text.trim();
};

export const generateWeavedArtifact = async (language: string, gems: any[]): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Short paragraph in ${language} using: ${gems.map(g => g.word).join(', ')}. Max 80 words.`,
  });
  return response.text.trim();
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Compare Source and Retelling in ${language}. 
    Schema: accuracyScore, qualityScore, contentFeedback(CN), languageFeedback(CN), suggestedVersion.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          accuracyScore: { type: Type.NUMBER },
          qualityScore: { type: Type.NUMBER },
          contentFeedback: { type: Type.STRING },
          languageFeedback: { type: Type.STRING },
          suggestedVersion: { type: Type.STRING }
        },
        required: ["accuracyScore", "qualityScore", "contentFeedback", "languageFeedback", "suggestedVersion"]
      }
    }
  });
  const result = JSON.parse(response.text) as RehearsalEvaluation;
  result.diffedRetelling = calculateDiff(retelling, result.suggestedVersion);
  return result;
};

export const generateDailyMuses = async (language: string): Promise<any[]> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `3 diary prompts in ${language}. Return JSON [{id, title, prompt, icon}]`,
    config: { responseMimeType: "application/json" }
  });
  return JSON.parse(response.text);
};

export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateChatSummaryPrompt = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize this chat into a 1-sentence diary prompt: ${messages.slice(-5).map(m => m.content).join(' ')}`,
  });
  return response.text || "";
};

export const enrichFragment = async (content: string, language: string): Promise<{ meaning: string, usage: string }> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Fragment: "${content}". Lang: ${language}. Meaning (CN). Usage (${language}).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meaning: { type: Type.STRING },
          usage: { type: Type.STRING }
        },
        required: ["meaning", "usage"]
      }
    }
  });
  return JSON.parse(response.text);
};
