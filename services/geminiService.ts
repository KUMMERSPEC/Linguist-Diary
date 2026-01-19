
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

/**
 * 获取 AI 实例
 */
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API key is missing. Please ensure process.env.API_KEY is configured.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * 核心分析函数
 */
export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  const japaneseInstruction = isJapanese 
    ? "IMPORTANT for Japanese: For BOTH 'modifiedText' and 'diffedText', provide Furigana for ALL Kanji using the syntax '[Kanji](furigana)'. For example: '[先生](せんせい)'. Ensure the reading is contextually correct."
    : "";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an elite language professor and literary curator. 
      Input: A raw diary entry or a collection of raw thoughts in ${language}.
      
      Tasks:
      1. CRITICAL: Correct the text for grammar and naturalness. Use <rem>text</rem> for original errors and <add>text</add> for improvements. Respect the user's original phrasing while fixing errors.
      2. LOGIC & TRANSITIONS: Suggest 3-5 specific transition words or phrases (in ${language}) that could help connect these potentially fragmented thoughts into a cohesive narrative.
      3. INTEGRATED MASTERPIECE: Produce a final, polished, and cohesive diary entry (as 'modifiedText') that incorporates all corrected fragments and appropriate transition logic.
      4. EXPLAIN: Categorize corrections and provide explanations in Chinese.
      5. VOCABULARY: Suggest 3-5 advanced vocabulary items.
      ${japaneseInstruction}
      
      Input text:
      "${text}"`,
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

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    return JSON.parse(response.text) as DiaryAnalysis;
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Analysis failed.");
  }
};

/**
 * 文本转语音函数
 */
export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  
  // 清理日语注音标记 [汉字](假名) -> 汉字
  const cleanText = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Please read this diary entry with a calm, natural, and expressive voice: ${cleanText}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }, 
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio data is missing in the response.");
    
    return base64Audio;
  } catch (error) {
    console.error("TTS Generation Error:", error);
    throw error;
  }
};

/**
 * 综合对话生成日记
 */
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content.trim())
    .filter(content => content.length > 0);
  
  if (userMessages.length === 0) return "Synthesis failed.";
  return userMessages.join('\n\n');
};

/**
 * 启发式对话函数
 */
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview'; 
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an empathetic and creative language tutor. The user is writing a diary in ${language}. 
      Based on the history, ask ONE short, engaging follow-up question in ${language} to encourage them to write more. 
      DO NOT use Chinese.
      
      History:
      ${historyText}`,
    });
    return response.text?.trim() || "Can you tell me more about that?";
  } catch (e) {
    return "That sounds interesting. Could you expand on that?";
  }
};
