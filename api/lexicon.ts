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
    console.warn("Airtable Lexicon Fetch Failed (likely limit reached). Using fallback.");
    // Return a minimal fallback lexicon so the app doesn't crash
    res.json([
      { id: 'f1', hebrew_term: 'קורטקס', definition_he: 'החלק המודרני במוח האחראי על חשיבה לוגית ובחירה.' },
      { id: 'f2', hebrew_term: 'מערכת לימבית', definition_he: 'החלק הרגשי וההישרדותי במוח המופעל בזמן סטרס.' },
      { id: 'f3', hebrew_term: 'סנקציה', definition_he: 'ענישה או איום המופעלים כאשר דרישה לא נענית.' }
    ]);
  }
}
