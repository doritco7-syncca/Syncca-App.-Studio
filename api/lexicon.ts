import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  lexicon: {
    tableName: "Relationship_Lexicon",
    columns: {
      term: "English_Term",
      hebrew_term: "Hebrew_Term",
      definition_he: "Description_HE",
      definition_en: "Description_EN",
      category: "Category"
    }
  }
};

const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select().all();
    const lexicon = records.map(record => ({
      id: record.id,
      term: record.get(AIRTABLE_SCHEMA.lexicon.columns.term),
      hebrew_term: record.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
      definition_he: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he),
      definition_en: record.get(AIRTABLE_SCHEMA.lexicon.columns.definition_en),
      category: record.get(AIRTABLE_SCHEMA.lexicon.columns.category)
    }));
    
    res.json(lexicon);
  } catch (error: any) {
    console.error("Airtable Lexicon Fetch Failed:", error);
    res.status(500).json({ error: error.message });
  }
}
