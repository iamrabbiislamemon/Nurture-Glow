import { GoogleGenAI } from "@google/genai";

export const translateText = async (text: string, targetLang: 'English' | 'Bangla') => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_GENAI_KEY;
    if (!apiKey) {
      console.warn('Translation: VITE_GOOGLE_GENAI_KEY not configured, returning original text');
      return text;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Translate the following text to ${targetLang}. Only return the translated text: "${text}"`,
    });
    // Use .text property directly as per GenAI SDK guidelines
    return response.text || text;
  } catch (error) {
    console.error("Translation error:", error);
    return text;
  }
};