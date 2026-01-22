
// Helper functions for audio encoding and decoding, compliant with GenAI guidelines.

/**
 * Decodes a base64 string into a Uint8Array.
 * @param base64 The base64 encoded string.
 * @returns A Uint8Array containing the decoded binary data.
 */
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM audio data (Uint8Array) into an AudioBuffer.
 * This function handles raw PCM bytes which do not contain header information.
 *
 * @param data The raw PCM audio data as a Uint8Array.
 * @param ctx The AudioContext to create the AudioBuffer with.
 * @param sampleRate The sample rate of the audio data (e.g., 24000).
 * @param numChannels The number of audio channels (e.g., 1 for mono).
 * @returns A Promise that resolves to an AudioBuffer.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Convert Uint8Array to Int16Array for processing PCM 16-bit signed integers
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;

  // Create an empty AudioBuffer
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  // Fill the AudioBuffer with decoded data
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 range [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}