
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";

const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

// 抽取公共的日语指令
const getJapaneseInstruction = (language: string) => {
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  return isJapanese 
    ? "CRITICAL: For Japanese, ALWAYS use '[Kanji](furigana)' format for ALL kanji in ALL fields (including word, meaning, usage, and feedback). Example: [今日](きょう). NEVER output plain kanji without brackets."
    : "";
};

export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  const historyContext = history.length > 0 
    ? `\n[ARCHIVES]\n${history.map(h => `- ${h.date}: ${h.analysis?.corrections.map(c => c.improved).slice(0, 1)}`).join('\n')}`
    : "";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Role: Lead Curator. Analyze artifact: "${text}" in ${language}. 
      ${historyContext}
      Format 'diffedText' with <add> and <rem>. 
      ${getJapaneseInstruction(language)}`,
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
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
  } catch (error: any) { throw new Error(error.message || "Analysis failed."); }
};

export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string) => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Check usage of "${word}" in "${sentence}" (${language}). Output JSON. ${getJapaneseInstruction(language)}`,
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
    return JSON.parse(response.text);
  } catch (error) { return { isCorrect: false, feedback: "Error." }; }
};

export const generatePracticeArtifact = async (language: string, keywords?: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Generate 40-word text in ${language}. ${keywords ? `Include: ${keywords}` : ""} ${getJapaneseInstruction(language)}`,
    });
    return response.text?.trim() || "";
  } catch (e) { return "Error."; }
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Evaluate retelling in ${language}. Source: "${source}", Retelling: "${retelling}". Response in Chinese. ${getJapaneseInstruction(language)}`,
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
    return JSON.parse(response.text);
  } catch (e) { throw new Error("Evaluation failed."); }
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
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
  } catch (error) { throw error; }
};

export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  return history.filter(m => m.role === 'user').map(m => m.content.trim()).join('\n\n');
};

export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Reply in ${language} to: ${JSON.stringify(history)}. ${getJapaneseInstruction(language)}`,
    });
    return response.text?.trim() || "";
  } catch (e) { return "..."; }
};
