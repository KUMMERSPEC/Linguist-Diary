
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API key is missing.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  const japaneseInstruction = isJapanese 
    ? "IMPORTANT for Japanese: For BOTH 'modifiedText' and 'diffedText', provide Furigana for ALL Kanji using the syntax '[Kanji](furigana)'."
    : "";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an elite language professor. Analyze this ${language} diary: "${text}". ${japaneseInstruction}`,
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
  } catch (error: any) {
    throw new Error(error.message || "Analysis failed.");
  }
};

/**
 * 造句挑战判定
 */
export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string) => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Act as a language tutor. The user is trying to use the word/phrase "${word}" (Meaning: ${meaning}) in a sentence: "${sentence}".
      Language: ${language}.
      Tasks:
      1. Check if the usage is grammatically correct and semantically natural.
      2. Provide a brief explanation (in Chinese).
      3. If incorrect, provide a natural alternative.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING, description: "Chinese explanation of the usage." },
            betterVersion: { type: Type.STRING, description: "A more natural version if applicable." }
          },
          required: ["isCorrect", "feedback"]
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Validation Error:", error);
    return { isCorrect: false, feedback: "AI 判定暂时不可用，请稍后再试。" };
  }
};

export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  const cleanText = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) { throw error; }
};

export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content.trim());
  return userMessages.join('\n\n');
};

export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Ask a follow-up in ${language} for this diary chat: ${JSON.stringify(history)}`,
    });
    return response.text?.trim() || "Tell me more.";
  } catch (e) { return "Go on..."; }
};
