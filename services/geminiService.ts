
import { GoogleGenAI, Type, Modality, GenerateContentParameters } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";
import { stripRuby } from "../utils/textHelpers";

// Helper to initialize the GenAI client using the environment's API key.
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

/**
 * Utility to check if an error is transient and should be retried.
 */
const isRetryableError = (error: any): boolean => {
  const message = error?.message || "";
  const status = error?.status || error?.code;
  
  // Retry on 500s, Rate Limits (429), or Network/XHR issues
  return (
    status === 500 || 
    status === 429 || 
    status === "UNKNOWN" ||
    message.includes("xhr error") ||
    message.includes("fetch") ||
    message.includes("Network request failed") ||
    message.includes("deadline exceeded")
  );
};

/**
 * Executes an AI call with exponential backoff retry logic.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!isRetryableError(error) || i === maxRetries - 1) {
        throw error;
      }
      const delay = initialDelay * Math.pow(2, i);
      console.warn(`[geminiService] Transient error detected. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// Provides language-specific instructions for Japanese study text formatting.
const getJapaneseInstruction = (language: string) => {
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  const baseInstruction = `Output MUST be EXCLUSIVELY in ${language}. DO NOT include any English or other languages.`;

  return isJapanese
    ? `CRITICAL for Japanese: ALWAYS use '[Kanji](furigana)' format for kanji. Example: [今日](きょう). ${baseInstruction}`
    : baseInstruction;
};

/**
 * Helper function to generate more specific and user-friendly AI error messages.
 */
const getAiErrorMessage = (error: any) => {
  console.error("AI API Raw Error Object:", error);
  let errorMessage = "AI 处理失败，请稍后重试。";

  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch") ||
        error.message.includes("Network request failed") ||
        error.message.includes("timed out") ||
        error.message.includes("xhr error")) {
      errorMessage = "网络连接不稳定或处理超时，系统已自动重试但仍失败，请检查网络。";
    } else if (error.message.includes("JSON.parse")) {
      errorMessage = "AI 返回的数据格式不正确，请稍后再试。";
    } else {
      errorMessage = `AI 处理失败：${error.message}`;
    }
  }
  return errorMessage;
};

// Analyzes a diary entry. Optimized for MONOLINGUAL VOCAB EXPLANATION.
export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  const historyContext = history.length > 0 
    ? `\n[RECENT_CONTEXT]\n${history.map(h => `- ${h.date}: ${h.analysis?.overallFeedback}`).join('\n')}`
    : "";

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Role: Language Expert. Analyze this ${language} text: "${text}".
      ${historyContext}
      
      STRICT OUTPUT RULES:
      1. 'diffedText' MUST use <add> and <rem> tags for word-level changes.
      2. For 'modifiedText', 'diffedText', 'advancedVocab.meaning', and 'advancedVocab.usage': ${getJapaneseInstruction(language)}
      3. Provide 'overallFeedback' and 'corrections.explanation' in Chinese (中文).
      4. DO NOT use furigana brackets in 'corrections.original' or 'corrections.improved' fields.`,
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
    
    try {
      return JSON.parse(response.text) as DiaryAnalysis;
    } catch (e) {
      console.error("JSON Parsing Error from AI Response:", response.text);
      throw new Error("AI 返回了无法解析的数据格式。");
    }
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};

// Evaluates a retelling.
export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview'; 
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Source Text: "${source}"\nUser Retelling: "${retelling}"\nLanguage: ${language}.
      Evaluate how well the user retold the source text.
      STRICT OUTPUT RULES:
      1. 'diffedRetelling' MUST use <add> and <rem> tags to show word-level corrections or improvements on the user's retelling.
      2. For 'suggestedVersion' and 'diffedRetelling': ${getJapaneseInstruction(language)}
      3. Provide 'contentFeedback' and 'languageFeedback' in Chinese (中文).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracyScore: { type: Type.NUMBER, description: 'Score from 0 to 100 for factual accuracy.' },
            qualityScore: { type: Type.NUMBER, description: 'Score from 0 to 100 for language quality.' },
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
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};

/**
 * Generates a short text for practice.
 */
export const generatePracticeArtifact = async (language: string, keywords: string, difficulty: string, topic: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Task: Generate a short practice text in ${language}.
      Difficulty: ${difficulty}
      Topic: ${topic}
      Keywords to include: ${keywords}
      
      STRICT RULES:
      - Length: around 3-5 sentences.
      - ${getJapaneseInstruction(language)}`,
    });
    return response.text || "";
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};

/**
 * Transforms text input into audio.
 */
export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed: No data returned.");
    return base64Audio;
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};

/**
 * Gets a follow-up response for a chat session.
 */
export const getChatFollowUp = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: messages.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      config: {
        systemInstruction: `You are a helpful language learning companion. Continue the conversation in ${language}. Keep responses encouraging and brief. ${getJapaneseInstruction(language)}`,
      }
    });
    return response.text || "";
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};

/**
 * Validates a user's sentence using a specific vocabulary word.
 */
export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string): Promise<{ isCorrect: boolean; feedback: string; betterVersion?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `Word: ${word}\nMeaning: ${meaning}\nUser's sentence: ${sentence}\nLanguage: ${language}.
      Validate if the word is used correctly and naturally in the sentence. Provide feedback in Chinese (中文). If incorrect or unnatural, provide a better version.`,
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
  }).catch(error => {
    throw new Error(getAiErrorMessage(error));
  });
};
