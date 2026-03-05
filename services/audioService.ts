
import { openDB, IDBPDatabase } from 'idb';
import { generateDiaryAudio } from './geminiService';
import { decode, decodeAudioData } from '../utils/audioHelpers';

const DB_NAME = 'linguist_audio_cache';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
};

/**
 * Generates a unique key for the audio cache based on text and optional parameters
 */
const generateKey = (text: string, voice?: string): string => {
  const cleanText = text.trim().toLowerCase();
  return `${cleanText}_${voice || 'default'}`;
};

/**
 * Saves base64 audio data to IndexedDB
 */
export const cacheAudio = async (text: string, base64Data: string, voice?: string): Promise<void> => {
  try {
    const db = await getDB();
    const key = generateKey(text, voice);
    await db.put(STORE_NAME, base64Data, key);
  } catch (error) {
    console.error('Failed to cache audio:', error);
  }
};

/**
 * Retrieves base64 audio data from IndexedDB
 */
export const getCachedAudio = async (text: string, voice?: string): Promise<string | null> => {
  try {
    const db = await getDB();
    const key = generateKey(text, voice);
    const data = await db.get(STORE_NAME, key);
    return data || null;
  } catch (error) {
    console.error('Failed to get cached audio:', error);
    return null;
  }
};

/**
 * Clears the entire audio cache
 */
export const clearAudioCache = async (): Promise<void> => {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    console.error('Failed to clear audio cache:', error);
  }
};

/**
 * Gets audio data with caching
 */
export const getAudioWithCache = async (text: string): Promise<string> => {
  if (!text) return "";
  
  const cached = await getCachedAudio(text);
  if (cached) {
    return cached;
  }

  const audioData = await generateDiaryAudio(text);
  if (audioData) {
    await cacheAudio(text, audioData);
  }
  return audioData;
};

/**
 * Plays audio using the smart speech logic with caching
 */
export const playSmartSpeech = async (
  text: string, 
  language: string, 
  id: string, 
  onStart: () => void, 
  onEnd: () => void,
  isLongText: boolean = false
): Promise<AudioBufferSourceNode | null> => {
  try {
    onStart();
    
    const base64Audio = await getAudioWithCache(text);
    
    if (!base64Audio) {
      onEnd();
      return null;
    }

    const bytes = decode(base64Audio);
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.onended = onEnd;
    source.start();
    
    return source;
  } catch (error) {
    console.error('playSmartSpeech error:', error);
    onEnd();
    return null;
  }
};
