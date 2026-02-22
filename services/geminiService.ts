
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DiaryAnalysis, ChatMessage, RehearsalEvaluation, DiaryEntry } from "../types";
import { calculateDiff } from "../utils/diffHelper";
import { weaveRubyMarkdown, stripRuby } from "../utils/textHelpers";

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

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 1000): Promise<T> {
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

export const analyzeDiaryEntry = async (text: string, language: string, history: DiaryEntry[] = []): Promise<DiaryAnalysis> => {
  const ai = getAiInstance();
  const historyContext = history.slice(0, 2).map(e => `- ${e.date}: ${e.analysis?.overallFeedback}`).join('\n');
  
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: "${text}". Lang: ${language}.
      Context: ${historyContext}
      Task: Correct the text. 
      IMPORTANT: Maintain the user's original phrasing where it is correct. Only rewrite if necessary for naturalness or grammar. 
      Provide grammar tips(${language}), advanced vocab, readingPairs(N2+).
      
      FOR ALL LANGUAGES:
      - 'advancedVocab.meaning' MUST be a monolingual definition in the target language (${language}) itself. DO NOT use English or Chinese for meaning.
      - 'corrections.explanation' MUST be in the target language (${language}).
      - 'transitionSuggestions.explanation' MUST be in the target language (${language}).
      
      FOR JAPANESE:
      - 'advancedVocab.word' and 'advancedVocab.usage' MUST use the format: [漢字](かんじ).
      - Ensure 'readingPairs' contains all Kanji from 'advancedVocab'.
      - 'advancedVocab.meaning' MUST BE PLAIN TEXT without any furigana or parentheses reading.`,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            modifiedText: { type: Type.STRING },
            overallFeedback: { type: Type.STRING },
            readingPairs: { 
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kanji: { type: Type.STRING },
                  reading: { type: Type.STRING }
                },
                required: ["kanji", "reading"]
              }
            },
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
          required: ["modifiedText", "corrections", "advancedVocab", "transitionSuggestions", "overallFeedback"]
        }
      }
    });
    
    const analysis = JSON.parse(response.text) as DiaryAnalysis;
    
    if (analysis.readingPairs) {
      analysis.advancedVocab = analysis.advancedVocab.map(v => ({
        ...v,
        word: language === 'Japanese' && !v.word.includes('[') ? weaveRubyMarkdown(v.word, analysis.readingPairs, 'Japanese') : v.word,
        usage: language === 'Japanese' && !v.usage.includes('[') ? weaveRubyMarkdown(v.usage, analysis.readingPairs, 'Japanese') : v.usage,
        meaning: stripRuby(v.meaning)
      }));
    }

    analysis.diffedText = calculateDiff(text, analysis.modifiedText, language);
    return analysis;
  });
};

/**
 * Optimized for Token Efficiency and Surgical Precision
 */
export const analyzeDiaryEntryStream = async function* (text: string, language: string, history: DiaryEntry[] = []) {
  const ai = getAiInstance();
  const historyContext = history.slice(0, 2).map(e => `- ${e.date}: ${e.analysis?.overallFeedback}`).join('\n');
  
  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: `Analyze: "${text}". Lang: ${language}.
    Context: ${historyContext}
    Task: Correct the text. 
    IMPORTANT: Maintain the user's original phrasing where it is correct. Only rewrite if necessary for naturalness or grammar. 
    Provide grammar tips(${language}), advanced vocab, readingPairs(N2+).
    
    FOR ALL LANGUAGES:
    - 'advancedVocab.meaning' MUST be a monolingual definition in the target language (${language}) itself. DO NOT use English or Chinese for meaning.
    - 'corrections.explanation' MUST be in the target language (${language}).
    - 'transitionSuggestions.explanation' MUST be in the target language (${language}).
    
    FOR JAPANESE:
    - 'advancedVocab.word' and 'advancedVocab.usage' MUST use the format: [漢字](かんじ).
    - Ensure 'readingPairs' contains all Kanji from 'advancedVocab'.
    - 'advancedVocab.meaning' MUST BE PLAIN TEXT without any furigana or parentheses reading.`,
    config: {
      thinkingConfig: { thinkingBudget: 0 }, 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          modifiedText: { type: Type.STRING },
          overallFeedback: { type: Type.STRING },
          readingPairs: { 
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                kanji: { type: Type.STRING },
                reading: { type: Type.STRING }
              },
              required: ["kanji", "reading"]
            }
          },
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
        required: ["modifiedText", "corrections", "advancedVocab", "transitionSuggestions", "overallFeedback"]
      }
    }
  });

  for await (const chunk of response) {
    yield chunk.text;
  }
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Compare Source/Retelling in ${language}. Score accuracy/quality. Feedbacks(${language}).`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
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
    const result = JSON.parse(response.text) as RehearsalEvaluation;
    result.diffedRetelling = calculateDiff(retelling, result.suggestedVersion, language);
    return result;
  });
};

export const getChatFollowUp = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const recentMessages = messages.slice(-6);
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: recentMessages.map(m => ({ 
      role: m.role === 'ai' ? 'model' : 'user', 
      parts: [{ text: m.content }] 
    })),
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      systemInstruction: `You are a language tutor in ${language}. Short responses (max 2 sentences).`
    }
  });
  return response.text || "";
};

export const validateVocabUsageStream = async function* (word: string, meaning: string, sentence: string, language: string) {
  const ai = getAiInstance();
  const response = await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: `Word: "${word}". Sentence: "${sentence}". Correct? Feedback(${language}).`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isCorrect: { type: Type.BOOLEAN },
          feedback: { type: Type.STRING },
          betterVersion: { type: Type.STRING },
          keyPhrases: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                phrase: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["phrase", "explanation"]
            }
          }
        },
        required: ["isCorrect", "feedback", "betterVersion"]
      }
    }
  });

  for await (const chunk of response) {
    yield chunk.text;
  }
};

export const generatePracticeArtifact = async (language: string, keywords: string, difficultyId: string, topicLabel: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Topic: ${topicLabel}. Lang: ${language}. Keywords: ${keywords}. Difficulty: ${difficultyId}. Pure text.`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return response.text.trim();
};

export const generateWeavedArtifact = async (language: string, gems: any[]): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Paragraph in ${language} using: ${gems.map(g => g.word).join(', ')}.`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return response.text.trim();
};

export const generateDailyMuses = async (language: string): Promise<any[]> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `3 prompts in ${language}. JSON [{id, title, prompt, icon}]`,
    config: { 
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json" 
    }
  });
  return JSON.parse(response.text);
};

export const generateDiaryAudio = async (text: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Say: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
};

export const generateChatSummaryPrompt = async (messages: ChatMessage[], language: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summary to 1-sentence prompt: ${messages.slice(-5).map(m => m.content).join(' ')}`,
    config: { thinkingConfig: { thinkingBudget: 0 } }
  });
  return response.text || "";
};

export const enrichFragment = async (content: string, language: string): Promise<{ meaning: string, usage: string }> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Fragment: "${content}". Meaning(CN), Usage(${language}).`,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meaning: { type: Type.STRING },
          usage: { type: Type.STRING }
        },
        required: ["meaning", "usage"]
      }
    }
  });
  return JSON.parse(response.text);
};
