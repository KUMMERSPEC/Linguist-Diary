
import { generateDiaryAudio } from "./geminiService";
import { decode, decodeAudioData } from "../utils/audioHelpers";

// Local Memory Cache for this session
const audioBufferCache: Record<string, AudioBuffer> = {};

/**
 * Native Browser TTS - 0 Token, 0 Latency
 */
export const playNativeSpeech = (text: string, language: string) => {
  return new Promise((resolve) => {
    const msg = new SpeechSynthesisUtterance();
    msg.text = text;
    
    // Map language codes to browser voice locales
    const langMap: Record<string, string> = {
      'English': 'en-US',
      'Japanese': 'ja-JP',
      'French': 'fr-FR',
      'Spanish': 'es-ES',
      'German': 'de-DE'
    };
    
    msg.lang = langMap[language] || 'en-US';
    msg.rate = 0.9; // Slightly slower for better learning
    msg.onend = resolve;
    window.speechSynthesis.speak(msg);
  });
};

/**
 * Tiered Speech Logic: 
 * If it's a short word, use native. 
 * If it's a long sentence, use AI with caching.
 */
export const playSmartSpeech = async (
  text: string, 
  language: string, 
  id: string, 
  onStart: () => void, 
  onEnd: () => void,
  forceAI: boolean = false
) => {
  // 1. For short words, always prefer native (Token Saver)
  if (!forceAI && text.length < 10) {
    onStart();
    await playNativeSpeech(text, language);
    onEnd();
    return null;
  }

  // 2. Check Cache for AI voice
  const cacheKey = `${language}_${text}`;
  onStart();

  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    let buffer: AudioBuffer;
    if (audioBufferCache[cacheKey]) {
      buffer = audioBufferCache[cacheKey];
    } else {
      // 3. Fallback to API
      const base64 = await generateDiaryAudio(text);
      if (!base64) throw new Error("TTS failed");
      const bytes = decode(base64);
      buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
      audioBufferCache[cacheKey] = buffer; // Cache it
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.onended = onEnd;
    source.start();
    return source;
  } catch (e) {
    console.warn("AI TTS failed, falling back to native:", e);
    await playNativeSpeech(text, language);
    onEnd();
    return null;
  }
};
