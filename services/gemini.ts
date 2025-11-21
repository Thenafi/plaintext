import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const enhanceText = async (text: string, instruction: string): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a helpful writing assistant. 
      
      User's current text:
      """
      ${text}
      """

      User's Instruction: ${instruction}
      
      Return ONLY the refined or continued text. Do not add markdown conversational filler like "Here is the text:".`,
    });
    
    return response.text || text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
