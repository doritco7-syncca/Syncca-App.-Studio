import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBase, AIRTABLE_SCHEMA } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    const { username } = req.body;
    const existing = await base(AIRTABLE_SCHEMA.users.tableName).select({ filterByFormula: `{Username} = '${username}'` }).firstPage();
    if (existing.length > 0) return res.json({ id: existing[0].id, fields: existing[0].fields });
    const record = await base(AIRTABLE_SCHEMA.users.tableName).create([{ fields: { Username: username } }]);
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (e) {
    res.json({ id: 'guest-' + Date.now(), fields: { [AIRTABLE_SCHEMA.users.columns.firstName]: 'אורח' } });
  }
}
