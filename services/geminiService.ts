
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";

// Helper to initialize the GenAI client using the environment's API key.
const getAiInstance = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API key is missing.");
  return new GoogleGenAI({ apiKey });
};

// Provides language-specific instructions for Japanese study text formatting.
const getJapaneseInstruction = (language: string) => {
  const isJapanese = language.toLowerCase() === 'japanese' || language === '日本語';
  return isJapanese 
    ? "CRITICAL for Japanese: ALWAYS use '[Kanji](furigana)' format for kanji in the target language text. Example: [今日](きょう). NEVER output plain kanji without brackets for study text."
    : "";
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
      3. DO NOT wrap unchanged surrounding context. For example, if adding a comma, ONLY wrap the comma: "文<add>、</add>章". 
      4. If a verb conjugation changes, try to only wrap the changed suffix if it makes sense, or just the single verb. 
      5. NEVER wrap an entire phrase if only one word inside it changes.
      
      ANNOTATIONS RULE:
      1. For the 'corrections' array: NEVER use the '[Kanji](furigana)' format. Use PLAIN TEXT ONLY for both 'original' and 'improved' fields.
      
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
  } catch (error: any) { throw new Error(error.message || "Analysis failed."); }
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
  } catch (e) { throw new Error("Evaluation failed."); }
};

// Fix for Error in file components/ReviewVault.tsx on line 3: Validates vocabulary usage.
export const validateVocabUsage = async (word: string, meaning: string, sentence: string, language: string): Promise<{ isCorrect: boolean; feedback: string; betterVersion?: string }> => {
  const ai = getAiInstance();
  const model = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Evaluate if the word "${word}" (meaning: ${meaning}) is used correctly in the following ${language} sentence: "${sentence}".
      Provide feedback in Chinese. If it's not perfect, provide a better version.`,
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
  } catch (e) {
    throw new Error("Validation failed.");
  }
};

// Fix for Error in file components/Rehearsal.tsx on line 4: Generates practice materials.
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
  } catch (e) {
    throw new Error("Generation failed.");
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
  } catch (error) { throw error; }
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
  } catch (e) { return "..."; }
};
