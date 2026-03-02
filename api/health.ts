import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const airtableKey = process.env.AIRTABLE_API_KEY;
  const airtableBaseId = process.env.AIRTABLE_BASE_ID;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  let airtableStatus = "Not Configured";
  if (airtableKey && airtableBaseId) {
    try {
      const base = new Airtable({ apiKey: airtableKey }).base(airtableBaseId);
      await base("Relationship_Lexicon").select({ maxRecords: 1 }).firstPage();
      airtableStatus = "Connected Successfully";
    } catch (e: any) {
      airtableStatus = `Configuration Error: ${e.message}`;
    }
  }

  let geminiStatus = "Not Configured";
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "hi",
        config: { maxOutputTokens: 1 }
      });
      geminiStatus = "Connected Successfully";
    } catch (e: any) {
      geminiStatus = `Configuration Error: ${e.message}`;
    }
  }

  res.status(200).json({ 
    status: "ok", 
    time: new Date().toISOString(),
    airtable: {
      status: airtableStatus,
      keyPresent: !!airtableKey,
      basePresent: !!airtableBaseId
    },
    gemini: {
      status: geminiStatus,
      keyPresent: !!geminiKey
    },
    env: {
      airtable: !!airtableKey,
      gemini: !!geminiKey
    }
  });
}
