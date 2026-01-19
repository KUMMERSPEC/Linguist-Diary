
import { GoogleGenAI, Type } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

/**
 * 核心分析函数
 * 输入：可能是单篇日记，也可能是由聊天产生的多个原文片段
 */
export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an elite language professor and literary curator. 
      Input: A raw diary entry or a collection of raw thoughts in ${language}.
      
      Tasks:
      1. CRITICAL: Correct the text for grammar and naturalness. Use <rem>text</rem> for original errors and <add>text</add> for improvements. You MUST respect the user's original phrasing while fixing errors.
      2. LOGIC & TRANSITIONS: Suggest 3-5 specific transition words or phrases (in ${language}) that could help connect these potentially fragmented thoughts into a cohesive narrative.
      3. INTEGRATED MASTERPIECE: Produce a final, polished, and cohesive diary entry (as 'modifiedText') that incorporates all corrected fragments and appropriate transition logic to make it read like a professional essay/diary.
      4. EXPLAIN: Categorize corrections and provide explanations in Chinese.
      5. VOCABULARY: Suggest 3-5 advanced vocabulary items.
      
      Input text:
      "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modifiedText: { type: Type.STRING, description: "The final, integrated, and cohesive diary entry." },
            diffedText: { type: Type.STRING, description: "The corrected original text with <rem> and <add> tags." },
            overallFeedback: { type: Type.STRING, description: "General summary of the writing style and logical improvements." },
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
                  word: { type: Type.STRING, description: "The transition word/phrase in the target language" },
                  explanation: { type: Type.STRING, description: "How this helps the logic of the entry, in Chinese" },
                  example: { type: Type.STRING, description: "A sentence showing how to bridge two user ideas" }
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
 * 综合对话生成日记 - 纯原文提取逻辑
 * 不再调用 AI，确保 100% 保留用户在对话中的原始输入
 */
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const userMessages = history
    .filter(m => m.role === 'user')
    .map(m => m.content.trim())
    .filter(content => content.length > 0);
  
  if (userMessages.length === 0) return "Synthesis failed.";
  
  // 将用户的所有回复按顺序用双换行符连接
  // 这种“手稿片段”格式会被 analyzeDiaryEntry 识别并进行精准的 diff 纠错和衔接建议
  return userMessages.join('\n\n');
};

/**
 * 启发式对话函数
 */
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
