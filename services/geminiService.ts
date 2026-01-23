
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";

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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
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

const getJapaneseInstruction = (language: string) => {
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  if (!isJapanese) return "DO NOT use '[Kanji](furigana)' format.";
  return "FOR JAPANESE TEXT ONLY: Use '[Kanji](furigana)' format for kanji. Example: [今日](きょう).";
};

const getAiErrorMessage = (error: any) => {
  if (error instanceof Error) return `AI 处理失败：${error.message}`;
  return "AI 处理失败，请稍后重试。";
};

export const generatePracticeTasks = async (word: string, meaning: string, language: string): Promise<{ id: string, label: string, icon: string }[]> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Word: "${word}" (${meaning}), Language: ${language}.
      Generate 1 simple conversation mission in Chinese to help use this word in chat.
      Output ONLY JSON: [{ id, label, icon }]`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              icon: { type: Type.STRING }
            },
            required: ["id", "label", "icon"]
          }
        }
      }
    });
    return JSON.parse(response.text) || [];
  }).catch(() => [
    { id: '1', label: `在对话中尝试运用这个词`, icon: '💬' },
  ]);
};

export const validateVocabUsage = async (
  word: string, 
  meaning: string, 
  sentence: string, 
  language: string
): Promise<{ 
  isCorrect: boolean; 
  feedback: string; 
  betterVersion?: string; 
}> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Word: "${word}" (${meaning}). User Sentence: "${sentence}". Language: ${language}.
      1. Correctness check.
      2. Concise feedback in Chinese (中文).
      3. Suggested version in ${language}.
      CRITICAL: ONLY use '[Kanji](furigana)' for the 'betterVersion' IF the language is Japanese. NEVER use it in 'feedback'.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            betterVersion: { type: Type.STRING }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};

export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const historyContext = history.length > 0 ? `\n[RECENT_CONTEXT]\n${history.map(h => `- ${h.date}: ${h.analysis?.overallFeedback}`).join('\n')}` : "";
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: "${text}". Language: ${language}.
      ${historyContext}
      STRICT FORMAT RULES:
      1. 'overallFeedback' and 'corrections.explanation' MUST be in Chinese (中文) WITHOUT any Japanese furigana [Kanji](furigana).
      2. ONLY 'modifiedText' and 'diffedText' should use '[Kanji](furigana)' if the language is Japanese.
      3. Use <add>/<rem> for diffs.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modifiedText: { type: Type.STRING },
            diffedText: { type: Type.STRING },
            overallFeedback: { type: Type.STRING },
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
          required: ["modifiedText", "diffedText", "corrections", "advancedVocab", "transitionSuggestions", "overallFeedback"]
        }
      }
    });
    return JSON.parse(response.text) as DiaryAnalysis;
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Evaluate retelling of "${source}" with "${retelling}" in ${language}.
      Feedback in Chinese. No furigana in Chinese text.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracyScore: { type: Type.NUMBER },
            qualityScore: { type: Type.NUMBER },
            contentFeedback: { type: Type.STRING },
            languageFeedback: { type: Type.STRING },
            suggestedVersion: { type: Type.STRING },
            diffedRetelling: { type: Type.STRING }
          },
          required: ["accuracyScore", "qualityScore", "contentFeedback", "languageFeedback", "suggestedVersion", "diffedRetelling"]
        }
      }
    });
    return JSON.parse(response.text) as RehearsalEvaluation;
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};

export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};

export const getChatFollowUp = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] })),
      config: { systemInstruction: `Friendly language mentor in ${language}. No furigana in Chinese thought/meta-text.` }
    });
    return response.text || "";
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};

export const generatePracticeArtifact = async (language: string, keywords: string, difficulty: string, topic: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write short text in ${language}. Topic: ${topic}. Difficulty: ${difficulty}. Keywords: ${keywords}.`,
    });
    return response.text || "";
  }).catch(error => { throw new Error(getAiErrorMessage(error)); });
};
