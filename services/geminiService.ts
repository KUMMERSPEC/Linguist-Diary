
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";

// Helper to initialize the GenAI client using the environment's API key.
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

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
  console.error("AI API Error:", error);
  let errorMessage = "AI 处理失败，请稍后重试。";

  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch") ||
        error.message.includes("Network request failed") ||
        error.message.includes("timed out") ||
        error.message.includes("xhr error")) {
      errorMessage = "网络连接不稳定或处理超时，请检查网络后重试。";
    } else if (error.message.includes("JSON.parse")) {
      errorMessage = "AI 返回的数据格式不正确，请重试。";
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

  try {
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
    return JSON.parse(response.text) as DiaryAnalysis;
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Evaluates a retelling.
export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview'; 
  try {
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
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Generates a short text for practice.
export const generatePracticeArtifact = async (language: string, keywords: string, difficulty: string, topic: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Generate a short text for language practice.
      Language: ${language}
      Difficulty: ${difficulty}
      Topic: ${topic}
      ${keywords ? `Include these specific keywords/themes: ${keywords}` : ''}
      
      ${getJapaneseInstruction(language)}`,
    });
    return response.text || "";
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Validates vocabulary usage in a sentence.
export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string) => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Vocabulary Practice Check:
      Word: "${word}"
      Meaning: "${meaning}"
      User Sentence: "${sentence}"
      Language: ${language}
      
      Evaluate if the word is used correctly and naturally. Provide feedback and a better version if needed.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: 'Feedback in Chinese (中文).' },
            betterVersion: { type: Type.STRING, description: 'A more natural version in the target language.' }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Gets follow-up response for guided chat.
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: history.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      config: {
        systemInstruction: `You are a helpful language mentor. Engage the user in a natural conversation in ${language} to help them practice. 
        Keep responses concise and encourage the user to express themselves.
        ${getJapaneseInstruction(language)}`,
      }
    });
    return response.text || "";
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Generates audio for a given text using TTS.
export const generateDiaryAudio = async (text: string): Promise<string | undefined> => {
  const ai = getAiInstance();
  const model = 'gemini-2.5-flash-preview-tts';
  try {
    // Stripping potential ruby markers for TTS processing
    const cleanText = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error: any) {
    console.error("TTS Generation Error:", error);
    return undefined;
  }
};
