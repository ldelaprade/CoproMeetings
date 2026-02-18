
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Utilise l'IA Gemini pour raffiner une idée brute en une résolution formelle.
 * L'instance est créée à l'intérieur de la fonction pour garantir l'accès 
 * à l'API_KEY injectée dans l'environnement au moment de l'appel.
 */
export const refineResolution = async (rawIdea: string): Promise<{ title: string; description: string }> => {
  // Initialisation à chaque appel pour suivre les recommandations de fraîcheur de la clé API
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Transformez cette idée de résolution de copropriété en texte formel et juridique pour une assemblée générale de copropriété française. L'idée est : "${rawIdea}"`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { 
            type: Type.STRING, 
            description: "Un titre court, formel et clair (ex: Travaux de ravalement, Rénovation des parties communes)." 
          },
          description: { 
            type: Type.STRING, 
            description: "Le texte détaillé et juridique de la résolution, rédigé à la troisième personne, incluant les modalités d'exécution et de vote." 
          }
        },
        required: ["title", "description"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Réponse vide de l'IA");
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Erreur de parsing Gemini:", e);
    return {
      title: "Nouvelle Résolution (Rédigée)",
      description: rawIdea
    };
  }
};
