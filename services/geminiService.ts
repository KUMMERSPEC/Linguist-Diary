import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";
import { decode, decodeAudioData } from '../utils/audioHelpers';

// Helper to initialize the GenAI client using the environment's API key.
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

// Provides language-specific instructions for Japanese study text formatting,
// and general strict output rules for all languages to prevent prompt leakage.
const getJapaneseInstruction = (language: string) => {
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  // CRITICAL: Always output EXCLUSIVELY in the target language.
  // CRITICAL: NEVER include any prompt instructions, meta-comments, or extraneous text in the final output.
  const baseInstruction = `Output MUST be EXCLUSIVELY in ${language}. DO NOT include any English or other languages, nor any meta-comments or instructions from this prompt in your final text.`;

  return isJapanese
    ? `CRITICAL for Japanese: ALWAYS use '[Kanji](furigana)' format for kanji in the target language text. Example: [今日](きょう). NEVER output plain kanji without brackets for study text. ${baseInstruction}`
    : baseInstruction;
};

/**
 * Helper function to generate more specific and user-friendly AI error messages.
 * @param error The error object caught from an AI API call.
 * @returns A string containing the user-friendly error message.
 */
const getAiErrorMessage = (error: any) => {
  console.error("AI API Error:", error);
  let errorMessage = "AI 处理失败，请稍后重试。";

  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch") ||
        error.message.includes("Network request failed") ||
        error.message.includes("network error") ||
        error.message.includes("timed out")) {
      errorMessage = "网络连接不稳定或处理超时，请检查网络后重试。";
    } else if (error.message.includes("JSON.parse")) {
      errorMessage = "AI 返回的数据格式不正确，请稍后重试。";
    } else if (error.message.includes("API key not valid") ||
               error.message.includes("Authentication failed")) {
      errorMessage = "API 密钥无效或未配置。请联系管理员。";
    } else if (error.message.includes("Requested entity was not found")) {
      errorMessage = "API 密钥请求实体未找到，请检查您的付费密钥是否已正确选择。";
    } else {
      errorMessage = `AI 处理失败：${error.message}`;
    }
  }

  // Truncate message if it's too long
  if (errorMessage.length > 200) {
    errorMessage = errorMessage.substring(0, 197) + "...";
  }

  return errorMessage;
};


// Analyzes a diary entry for grammar, vocabulary, and style improvements.
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
      
      STRICT DIFF RULES (CRITICAL):
      1. 'diffedText' MUST use MINIMAL CHARACTER-LEVEL DIFFS. 
      2. ONLY wrap the EXACT wrong character, particle, or word in <add> and <rem> tags. 
      3. PUNCTUATION: If only a comma is added, ONLY use <add>、</add>. DO NOT include adjacent words.
      4. EXAMPLE: "その時<add>、</add>大きくて" is correct. "<rem>その時</rem><add>その时、</add>" is INCORRECT.
      5. NEVER wrap an entire phrase if only one word or punctuation inside it changes. If a word needs to be entirely replaced, wrap only that word: <rem>oldword</rem><add>newword</add>.
      
      ANNOTATIONS RULE:
      1. For the 'corrections' array: DO NOT use the '[Kanji](furigana)' format. Use PLAIN TEXT ONLY (No brackets, no furigana).
      
      FORMATTING RULES:
      1. For 'overallFeedback' (written in Chinese): Use plain text ONLY.
      2. For 'modifiedText' and 'diffedText': ${getJapaneseInstruction(language)}`,
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
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Evaluates a user's retelling of a source text.
export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Evaluate a language retelling exercise in ${language}. 
      
      ARCHIVE SOURCE: "${source}"
      USER'S RETELLING: "${retelling}"
      
      TASKS:
      1. 'suggestedVersion' MUST be a polished version of the USER'S RETELLING.
      2. 'diffedRetelling' MUST use MINIMAL CHARACTER-LEVEL DIFFS between USER'S RETELLING and suggestedVersion using <add> and <rem> tags.
      3. For 'diffedRetelling' and 'suggestedVersion': ${getJapaneseInstruction(language)}
      4. PUNCTUATION: If only a comma is added, ONLY use <add>、</add>. DO NOT include adjacent words.
      5. EXAMPLE: "その時<add>、</add>大きくて" is correct. "<rem>その時</rem><add>その时、</add>" is INCORRECT.
      6. NEVER wrap an entire phrase if only one word or punctuation inside it changes. If a word needs to be entirely replaced, wrap only that word: <rem>oldword</rem><add>newword</add>.
      
      FORMATTING RULES:
      1. Provide 'contentFeedback' and 'languageFeedback' in Chinese using PLAIN TEXT.
      2. 'accuracyScore' and 'qualityScore' must be INTEGERS 0-100.`,
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            accuracyScore: { type: Type.INTEGER },
            qualityScore: { type: Type.INTEGER },
            contentFeedback: { type: Type.STRING },
            languageFeedback: { type: Type.STRING },
            suggestedVersion: { type: Type.STRING },
            diffedRetelling: { type: Type.STRING }
          },
          required: ["accuracyScore", "qualityScore", "contentFeedback", "languageFeedback", "suggestedVersion", "diffedRetelling"]
        }
      }
    });
    const result = JSON.parse(response.text);
    return {
      ...result,
      accuracyScore: Number(result.accuracyScore) || 0,
      qualityScore: Number(result.qualityScore) || 0
    };
  } catch (e: any) { throw new Error(getAiErrorMessage(e)); }
};

// Validates vocabulary usage. (BetterVersion now strictly PLAIN TEXT)
export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string): Promise<{ isCorrect: boolean; feedback: string; betterVersion?: string }> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Evaluate if the word "${word}" (meaning: ${meaning}) is used correctly in the following ${language} sentence: "${sentence}".
      
      RULES:
      1. Provide feedback in Chinese.
      2. If not perfect, provide 'betterVersion' in PLAIN TEXT ONLY. 
      3. FORBIDDEN: Do NOT use '[Kanji](furigana)' format in betterVersion.`,
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
  } catch (e: any) {
    throw new Error(getAiErrorMessage(e));
  }
};

// Generates practice materials.
export const generatePracticeArtifact = async (language: string, keywords: string, difficulty: string, topic: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Generate a short ${language} text for a retelling exercise.
      Topic: ${topic}
      Difficulty: ${difficulty}
      Keywords to include: ${keywords || 'none'}
      
      The text should be natural and suitable for study. ${getJapaneseInstruction(language)}`,
    });
    return response.text || "";
  } catch (e: any) {
    throw new Error(getAiErrorMessage(e));
  }
};

// Generates audio for a given text using the Text-to-Speech model.
export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  if (!text) return "";
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
  } catch (error: any) { throw new Error(getAiErrorMessage(error)); }
};

// Combines chat history into a single narrative for analysis.
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  return history.filter(m => m.role === 'user').map(m => m.content.trim()).join('\n\n');
};

// Generates a helpful follow-up response for the guided chat feature.
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Reply in ${language} to: ${JSON.stringify(history)}. 
      For the reply: ${getJapaneseInstruction(language)}`,
    });
    return response.text?.trim() || "";
  } catch (e: any) { 
    // This function specifically returns "..." on error for a smoother chat experience,
    // so we'll catch and return the default behavior.
    console.error("Chat follow-up failed:", e);
    return "..."; 
  }
};