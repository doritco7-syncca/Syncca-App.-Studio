import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBase, AIRTABLE_SCHEMA } from './_lib';

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
