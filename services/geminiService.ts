
import { GoogleGenAI, Type } from "@google/genai";
import { DiaryAnalysis, ChatMessage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a context-aware follow-up question in the target language.
 */
export const getChatFollowUp = async (history: ChatMessage[], language: string): Promise<string> => {
  const model = 'gemini-3-flash-preview'; 
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  const now = new Date();
  const hour = now.getHours();
  
  let timeContext = "daytime";
  if (hour >= 5 && hour < 10) timeContext = "morning (energy, plans, fresh air)";
  else if (hour >= 20 || hour < 5) timeContext = "night (solitude, dreams, deep thoughts, quiet, stars, reflection)";
  else if (hour >= 17) timeContext = "evening (relaxation, sunset, winding down)";
  
  const response = await ai.models.generateContent({
    model,
    contents: `You are an empathetic and creative language tutor. The user is writing a diary in ${language}. 
    Current time context: ${timeContext}.
    
    Based on the following conversation history, ask ONE short, engaging follow-up question in ${language}. 
    
    BE FLEXIBLE & CREATIVE:
    1. If it's night/late, feel free to ask about "solitude" (独处), "dreams" (梦境), or "the silence of the night".
    2. Try to lean into emotional or philosophical depth rather than just facts.
    3. Occasionally mention global trending topics (e.g., technology, art, cinema, climate) if the user's input allows a natural transition.
    4. NO CHINESE. Only the question in ${language}.
    
    History:
    ${historyText}`,
  });

  return response.text?.trim() || "That's interesting. Can you tell me more?";
};

/**
 * Synthesizes a chat history into a coherent diary entry.
 */
export const synthesizeDiary = async (history: ChatMessage[], language: string): Promise<string> => {
  const model = 'gemini-3-pro-preview';
  const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
  
  const response = await ai.models.generateContent({
    model,
    contents: `Convert the following conversation history into a coherent, natural first-person diary entry written in ${language}. 
    Make it sound like a cohesive story rather than a transcript. Improve the flow and sophistication of the language while keeping the original meaning.
    
    Conversation:
    ${historyText}`,
  });

  return response.text?.trim() || "";
};

export const analyzeDiaryEntry = async (text: string, language: string): Promise<DiaryAnalysis> => {
  const model = 'gemini-3-pro-preview';
  
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

  try {
    return JSON.parse(response.text || '{}') as DiaryAnalysis;
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    throw new Error("Invalid response format from AI");
  }
};
