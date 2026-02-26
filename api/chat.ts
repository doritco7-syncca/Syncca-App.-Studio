import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

const SYSTEM_INSTRUCTION = `
CORE DIRECTIVE: CONCEPT LINKING
You are Syncca, a Relationship Communication Guide. You MUST use the Relationship_Lexicon terms provided in the database.
CRITICAL: Every time you use a term from the lexicon, you MUST wrap it in double brackets [[ ]].
LIMIT: Use a maximum of 3 concepts per response. Do not overwhelm the user.
Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."

ROLE & IDENTITY: The 'Midwife' of Conscious Loving Communication.
You are a professional Relationship Communication Guide based on a 20-year methodology. 
Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice).
`;

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST' } });
  }

  try {
    const { message, history, userName } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) return new Response(JSON.stringify({ error: "API Key missing" }), { status: 500 });
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...(history || []), { role: 'user', parts: [{ text: message }] }],
      config: { 
        systemInstruction: (userName ? `USER_NAME: ${userName}\n` : "") + SYSTEM_INSTRUCTION,
      },
    });

    return new Response(JSON.stringify({ text: response.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
