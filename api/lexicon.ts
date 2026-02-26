import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBase, AIRTABLE_SCHEMA } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    const records = await base(AIRTABLE_SCHEMA.lexicon.tableName).select().all();
    const lexicon = records.map(r => ({
      id: r.id,
      hebrew_term: r.get(AIRTABLE_SCHEMA.lexicon.columns.hebrew_term),
      definition_he: r.get(AIRTABLE_SCHEMA.lexicon.columns.definition_he)
    }));
    res.json(lexicon);
  } catch (e) {
    res.json([
      { id: 'f1', hebrew_term: 'קורטקס', definition_he: 'החלק המודרני במוח.' },
      { id: 'f2', hebrew_term: 'מערכת לימבית', definition_he: 'החלק הרגשי במוח.' }
    ]);
  }
}
