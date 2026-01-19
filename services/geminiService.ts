
import { GoogleGenAI, Type } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

// 辅助函数：从环境变量中获取 API Key
const getApiKey = () => {
  return process.env.API_KEY || "";
};

/**
 * 核心分析函数：增加了详细的错误捕获
 */
export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("未检测到 API Key。请确保在 GitHub Secrets 或本地环境变量中配置了 API_KEY。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-pro-preview';
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Please act as a professional language teacher. Analyze this diary entry written in ${language}. 
      
      1. Correct the text for grammar, flow, and naturalness.
      2. Provide a "diffed" version of the original text using custom tags:
         - Use <rem>text</rem> for parts that should be removed or corrected.
         - Use <add>text</add> for the corrected/new parts.
      3. Provide specific corrections with explanations in Chinese.
      4. Suggest advanced vocabulary that could replace common words used in the text.
      
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
      throw new Error("AI 返回了空响应，请检查输入内容或模型状态。");
    }

    return JSON.parse(response.text) as DiaryAnalysis;
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    
    // 针对常见错误的友好提示
    if (error.message?.includes('403')) {
      throw new Error("API 访问被拒绝 (403)。原因可能是：1. 您的 Key 未绑定结算信息；2. 您的地区不支持此模型；3. API Key 无效。");
    }
    if (error.message?.includes('429')) {
      throw new Error("请求过于频繁 (429)。免费层级限额较低，请稍后再试。");
    }
    if (error.message?.includes('500')) {
      throw new Error("Google 服务器内部错误 (500)。请稍后重试。");
    }
    
    throw new Error(error.message || "AI 分析过程中发生了未知错误。");
  }
};

/**
 * 启发式对话函数
 */
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview'; 
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an empathetic and creative language tutor. The user is writing a diary in ${language}. 
      Based on the history, ask ONE short, engaging follow-up question in ${language}. NO CHINESE.
      
      History:
      ${historyText}`,
    });
    return response.text?.trim() || "Can you tell me more?";
  } catch (e) {
    console.error("Chat API Error:", e);
    return "That's interesting. What happened next?";
  }
};

/**
 * 综合对话生成日记
 */
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-pro-preview';
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Convert this conversation into a first-person diary in ${language}:
      ${historyText}`,
    });
    return response.text?.trim() || "";
  } catch (e) {
    return history.filter(m => m.role === 'user').map(m => m.content).join('\n');
  }
};
