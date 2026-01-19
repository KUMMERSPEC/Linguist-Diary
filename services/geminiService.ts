
import { GoogleGenAI, Type } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

/**
 * 核心分析函数
 */
export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  // 必须直接使用 process.env.API_KEY 进行初始化
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const model = 'gemini-3-flash-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an elite language professor and literary critic. Analyze this diary entry written in ${language}. 
      
      Tasks:
      1. Correct the text for grammar, naturalness, and elegance.
      2. Produce a "diffed" version of the original text using:
         - <rem>text</rem> for errors or sub-optimal parts to be removed.
         - <add>text</add> for corrected or improved parts.
         Ensure EVERY change is captured in these tags so the user can see exactly what changed in the original context.
      3. Categorize and explain each major correction in Chinese.
      4. Suggest 3-5 high-level, sophisticated vocabulary items (Advanced/Native level) that could elevate the user's specific writing style in this entry.
      
      Diary text:
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
                  category: { 
                    type: Type.STRING, 
                    enum: ['Grammar', 'Vocabulary', 'Style', 'Spelling'] 
                  }
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
                  level: { 
                    type: Type.STRING, 
                    enum: ['Intermediate', 'Advanced', 'Native'] 
                  }
                },
                required: ["word", "meaning", "usage", "level"]
              }
            }
          },
          required: ["modifiedText", "diffedText", "corrections", "advancedVocab", "overallFeedback"]
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
 * 启发式对话函数
 */
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
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

/**
 * 综合对话生成日记
 */
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
  const model = 'gemini-3-flash-preview';
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Strictly convert the following conversation history into a formal, first-person diary entry in ${language}. 
      Combine all user inputs into a cohesive narrative. 
      Do not include any AI dialogue or introduction. Just the diary text.
      
      Conversation:
      ${historyText}`,
    });
    return response.text?.trim() || "Synthesis failed.";
  } catch (e) {
    return history.filter(m => m.role === 'user').map(m => m.content).join('\n');
  }
};
