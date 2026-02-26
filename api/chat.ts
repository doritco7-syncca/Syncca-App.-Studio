import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are Syncca, a professional Relationship Communication Guide. 
Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language.
CRITICAL: Use double brackets [[ ]] for lexicon terms like [[קורטקס]] or [[סנקציה]].
Keep responses warm, humble, and concise.
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  try {
    const { message, history, userName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is missing in Vercel environment variables." });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: { 
        systemInstruction: (userName ? `USER_NAME: ${userName}\n` : "") + SYSTEM_INSTRUCTION 
      },
      history: history || []
    });
    
    // Add a timeout race to catch long-running requests
    const chatPromise = chat.sendMessage({ message });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("AI took too long to respond (Vercel 10s limit). Try a shorter message.")), 9500)
    );

    const response = await Promise.race([chatPromise, timeoutPromise]) as any;
    
    if (!response || !response.text) {
      throw new Error("The AI returned an empty response.");
    }

    res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ 
      error: error.message || "An unexpected error occurred in the Chat API",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
