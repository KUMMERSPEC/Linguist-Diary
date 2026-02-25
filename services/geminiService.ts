
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

async function withRetry<T>(fn: (model: string) => Promise<T>, initialModel: string, maxRetries = 2, initialDelay = 1000): Promise<T> {
  let lastError: any;
  let currentModel = initialModel;
  for (let i = 0; i < maxRetries; i++) {
    try { 
      return await fn(currentModel); 
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.code;
      
      // If 429, try switching model to a lighter one if we are on the main one
      if (status === 429 && currentModel === 'gemini-3-flash-preview') {
        currentModel = 'gemini-flash-lite-latest'; // Fallback to standard flash
      }

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
  
  return withRetry(async (model) => {
    const response = await ai.models.generateContent({
      model: model as any,
      contents: `You are an expert language tutor. Analyze the following text written in ${language}.
Your task is to provide a comprehensive analysis based on the JSON schema.

User's Text:
---
${text}
---

Recent Feedback Context (for personalization):
---
${historyContext || 'No recent history.'}
---

Key Instructions:
1.  **Correction Style**: Only correct grammatical errors or unnatural phrasing. Preserve the user's original style and voice.
2.  **Monolingual Definitions**: All explanations and definitions ('advancedVocab.meaning', 'corrections.explanation') must be in ${language}.
3.  **Japanese Specifics**: For Japanese text, 'advancedVocab.word' and 'advancedVocab.usage' must use Furigana markdown format, e.g., [漢字](かんじ). Ensure 'readingPairs' is complete for all Kanji in the vocab. 'advancedVocab.meaning' must be plain text.

Produce only the JSON output that adheres to the provided schema.`,
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
                  phonetic: { type: Type.STRING, description: "Phonetic transcription or IPA. For Japanese, use reading if not already in word." },
                  level: { type: Type.STRING, enum: ['Intermediate', 'Advanced', 'Native'] }
                },
                required: ["word", "meaning", "usage", "level"]
              }
            },
                      },
          required: ["modifiedText", "corrections", "advancedVocab", "overallFeedback"]
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
  }, 'gemini-3-flash-preview');
};

/**
 * Optimized for Token Efficiency and Surgical Precision
 */
export const analyzeDiaryEntryStream = async function* (text: string, language: string, history: DiaryEntry[] = []) {
  const ai = getAiInstance();
  const historyContext = history.slice(0, 2).map(e => `- ${e.date}: ${e.analysis?.overallFeedback}`).join('\n');
  
  const config = {
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
              phonetic: { type: Type.STRING, description: "Phonetic transcription or IPA. For Japanese, use reading if not already in word." },
              level: { type: Type.STRING, enum: ['Intermediate', 'Advanced', 'Native'] }
            },
            required: ["word", "meaning", "usage", "level"]
          }
        },
              },
      required: ["modifiedText", "corrections", "advancedVocab", "overallFeedback"]
    }
  };

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: `You are an expert language tutor. Analyze the following text written in ${language}.
Your task is to provide a comprehensive analysis based on the JSON schema.

User's Text:
---
${text}
---

Recent Feedback Context (for personalization):
---
${historyContext || 'No recent history.'}
---

Key Instructions:
1.  **Correction Style**: Only correct grammatical errors or unnatural phrasing. Preserve the user's original style and voice.
2.  **Monolingual Definitions**: All explanations and definitions ('advancedVocab.meaning', 'corrections.explanation') must be in ${language}.
3.  **Japanese Specifics**: For Japanese text, 'advancedVocab.word' and 'advancedVocab.usage' must use Furigana markdown format, e.g., [漢字](かんじ). Ensure 'readingPairs' is complete for all Kanji in the vocab. 'advancedVocab.meaning' must be plain text.

Produce only the JSON output that adheres to the provided schema.`,
      config: config as any
    });

    for await (const chunk of response) {
      yield chunk.text;
    }
  } catch (error: any) {
    const status = error?.status || error?.code;
    if (status === 429) {
      const fallbackResponse = await ai.models.generateContentStream({
        model: 'gemini-flash-lite-latest' as any,
        contents: `Analyze this ${language} text and provide corrections, feedback, and vocabulary based on the schema. Text: "${text}"`,
        config: config as any
      });
      for await (const chunk of fallbackResponse) {
        yield chunk.text;
      }
    } else {
      throw error;
    }
  }
};

export const evaluateRetelling = async (source: string, retelling: string, language: string): Promise<RehearsalEvaluation> => {
  const ai = getAiInstance();
  return withRetry(async (model) => {
    const response = await ai.models.generateContent({
      model: model as any,
      contents: `
      You are a language evaluation expert. Your task is to compare a user's retelling of a source text and provide a detailed evaluation in ${language}.

      **Source Text:**
      ---
      ${source}
      ---

      **User's Retelling:**
      ---
      ${retelling}
      ---

      **Your Task:**
      1.  **Score Accuracy (0-100):** How faithfully does the retelling capture the key information and meaning of the source?
      2.  **Score Quality (0-100):** Evaluate the grammatical correctness, style, and naturalness of the user's language.
      3.  **Provide Feedback:** Write two distinct feedback paragraphs in ${language}:
          - **Content Feedback:** Comment on what the user did well and what they missed from the source text.
          - **Language Feedback:** Comment on grammar, vocabulary, and style in the user's retelling.
      4.  **Suggest an Improved Version:** Rewrite the user's retelling to be more accurate and natural.
      5.  **Recommend Vocabulary (Gems):** Extract 3-5 key vocabulary words or phrases from your suggested version that would be beneficial for the user to learn. For each, provide the word, its meaning in ${language}, and a simple usage example.

      **Output MUST be valid JSON that adheres to the schema.**
    `,
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
            suggestedVersion: { type: Type.STRING },
            recommendedGems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  usage: { type: Type.STRING }
                },
                required: ["word", "meaning", "usage"]
              }
            }
          },
          required: ["accuracyScore", "qualityScore", "contentFeedback", "languageFeedback", "suggestedVersion"]
        }
      }
    });
    const result = JSON.parse(response.text) as RehearsalEvaluation;
    result.diffedRetelling = calculateDiff(retelling, result.suggestedVersion, language);
    return result;
  }, 'gemini-3-flash-preview');
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
  let model = 'gemini-3-flash-preview';
  
  try {
    const response = await ai.models.generateContentStream({
      model: model as any,
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
  } catch (error: any) {
    const status = error?.status || error?.code;
    if (status === 429) {
      // Fallback for stream
      const fallbackResponse = await ai.models.generateContentStream({
        model: 'gemini-flash-lite-latest' as any,
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
      for await (const chunk of fallbackResponse) {
        yield chunk.text;
      }
    } else {
      throw error;
    }
  }
};

export const generatePracticeArtifact = async (language: string, keywords: string, difficultyId: string, topicLabel: string): Promise<string> => {
  const ai = getAiInstance();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `
      You are a language content creator. Your task is to generate a short, engaging text based on the user's request.
      
      **Request Details:**
      - **Topic:** ${topicLabel}
      - **Language:** ${language}
      - **Keywords to include:** ${keywords}
      - **Difficulty Level:** ${difficultyId}

      **Strict Output Requirements:**
      1.  **Content Only:** Provide only the generated text, with no extra commentary, titles, or explanations.
      2.  **Length Constraint (${difficultyId}):** 
          - If Difficulty is 'Beginner', the text MUST be between 80 and 120 characters long.
          - For other difficulties, aim for a concise paragraph (around 150-200 characters).
      3.  **Japanese Formatting:** 
          - If the language is Japanese, you MUST use HTML <ruby> tags for Furigana (e.g., <ruby>漢字<rt>かんじ</rt></ruby>).
          - DO NOT use the format: 漢字(かんじ).

      Begin generating the text now.
    `,
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

export const retryEvaluationForGems = async (failedGems: { word: string; }[], language: string): Promise<{ word: string; meaning: string; usage: string; }[]> => {
  const ai = getAiInstance();
  const words = failedGems.map(g => g.word).join(', ');

  return withRetry(async (model) => {
    const response = await ai.models.generateContent({
      model: model as any,
      contents: `For the following list of words in ${language}, provide a concise meaning (in ${language}) and a simple usage example sentence for each: ${words}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correctedGems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  usage: { type: Type.STRING }
                },
                required: ["word", "meaning", "usage"]
              }
            }
          },
          required: ["correctedGems"]
        }
      }
    });
    const result = JSON.parse(response.text) as { correctedGems: { word: string; meaning: string; usage: string; }[] };
    return result.correctedGems;
  }, 'gemini-3-flash-preview');
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
