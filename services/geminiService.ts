
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
  }).catch(error => { throw new Error("AI 处理失败，请稍后重试。"); });
};

export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const historyContext = history.length > 0 ? `\n[RECENT_CONTEXT]\n${history.map(h => `- ${h.date}: ${h.analysis?.overallFeedback}`).join('\n')}` : "";
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: "${text}". Language: ${language}.
      ${historyContext}
      STRICT VOCABULARY RULES:
      1. FOR JAPANESE: The 'word' property MUST use '[Kanji](furigana)' format (e.g., "[形跡](けいせい)").
      2. FOR JAPANESE: DO NOT use ruby/furigana in 'meaning' or 'usage' properties. Keep them as plain text.
      3. NATIVE DEFINITION: The 'meaning' property MUST be in the target language (${language}), NOT Chinese. (e.g., explain an English word in English).
      4. NATIVE EXAMPLE: The 'usage' property MUST be in the target language (${language}).
      
      STRICT FORMAT RULES:
      1. 'overallFeedback' and 'corrections.explanation' MUST be in Chinese (中文).
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
  }).catch(error => { throw new Error("AI 分析失败，请检查 API 配置。"); });
};

export const generateChatSummaryPrompt = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Dialogue History:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nTask: Generate a warm and encouraging writing prompt in Chinese for the museum curator. 
      The prompt should:
      1. Summarize what they just talked about in ${language}.
      2. Suggest they rewrite the core content as a diary entry.
      3. Mention 1-2 useful words or grammar points from the chat.
      Keep it under 80 words.`,
    });
    return response.text || "刚才的聊天很有趣，试着把这些零散的想法整理成一篇日记吧！";
  }).catch(() => "试着把刚才聊的内容整理成一篇正式的日记吧。");
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Evaluate retelling of "${source}" with "${retelling}" in ${language}. Feedback in Chinese.`,
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
  }).catch(error => { throw new Error("评估失败。"); });
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
  }).catch(error => { throw new Error("TTS 失败。"); });
};

export const getChatFollowUp = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: messages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.content }] })),
      config: { 
        systemInstruction: `You are a friendly language mentor in ${language}. 
        STRICT RULES:
        1. Keep responses CONCISE (max 2-3 sentences).
        2. Focus on the conversation, not formal teaching.
        3. Do NOT provide "Corrections" or "Vocabulary Tips" in the chat bubble.
        4. Ask only one natural follow-up question.` 
      }
    });
    return response.text || "";
  }).catch(error => { throw new Error("无法获取回复。"); });
};

export const generatePracticeArtifact = async (language: string, keywords: string, difficulty: string, topic: string): Promise<string> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Task: Write a cohesive short text (3-5 sentences) in ${language}. 
      Topic: ${topic}. 
      Difficulty level: ${difficulty}. 
      Keywords to include: ${keywords}.
      
      STRICT RULE: The response MUST be entirely and purely in ${language}. 
      Do NOT mix other languages (like English) in the content. 
      For Japanese: Use natural phrasing and avoid mixing English unless it's a loanword commonly written in Katakana.`,
    });
    return response.text || "";
  }).catch(error => { throw new Error("生成失败。"); });
};
