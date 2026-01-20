
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation } from "../types";

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
    ? "IMPORTANT for Japanese: For BOTH 'modifiedText' and 'diffedText', provide Furigana for ALL Kanji using the syntax '[Kanji](furigana)'. Example: [今日](きょう)."
    : "";

  const diffInstruction = "In the 'diffedText' field, you MUST wrap deleted parts in '<rem>...</rem>' and added/corrected parts in '<add>...</add>'.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `You are an elite language professor. Analyze this ${language} diary: "${text}". 
      ${diffInstruction}
      ${japaneseInstruction}`,
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

export const generatePracticeArtifact = async (language: string, keywords?: string): Promise<string> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  
  const keywordInstruction = keywords 
    ? `CRITICAL: You MUST include these specific keywords in the text: "${keywords}". Ensure they are used naturally.` 
    : "Generate a short description of a random daily object, culture fact, or tiny story.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `${keywordInstruction} 
      The text must be in ${language}.
      
      CONSTRAINTS:
      1. Length: Approximately 40-50 words/characters. Keep it very short and simple.
      2. Language: Output ONLY the text in ${language}. 
      3. NO English: Do NOT include any English headers, descriptions, or translations.
      4. NO Markdown headers: Just the plain text content.`,
    });
    return response.text?.replace(/#{1,6}\s.*?\n/g, '').trim() || "No text generated.";
  } catch (e) {
    return "Error generating practice text.";
  }
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  const model = 'gemini-3-pro-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Compare the user's retelling of a source text.
      Source: "${source}"
      Retelling: "${retelling}"
      Language: ${language}
      
      Score Accuracy (0-100) based on content preservation.
      Score Quality (0-100) based on grammar and style.
      Provide helpful feedback in Chinese.`,
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
  } catch (e) {
    throw new Error("Evaluation failed.");
  }
};

export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string) => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Act as a language tutor. The user is trying to use "${word}" (${meaning}) in: "${sentence}". Language: ${language}.`,
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
  } catch (error) {
    return { isCorrect: false, feedback: "Error." };
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
      contents: `Ask a follow-up in ${language} for this chat: ${JSON.stringify(history)}`,
    });
    return response.text?.trim() || "Tell me more.";
  } catch (e) { return "Go on..."; }
};
