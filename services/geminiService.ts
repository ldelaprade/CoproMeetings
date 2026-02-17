
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const refineResolution = async (rawIdea: string): Promise<{ title: string; description: string }> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Transformez cette idée de résolution de copropriété en texte formel et juridique pour une assemblée générale: "${rawIdea}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Un titre court et clair." },
          description: { type: Type.STRING, description: "Le texte détaillé de la résolution incluant les modalités de vote." }
        },
        required: ["title", "description"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    return {
      title: "Nouvelle Résolution",
      description: rawIdea
    };
  }
};
