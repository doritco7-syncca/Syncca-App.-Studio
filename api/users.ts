import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBase, AIRTABLE_SCHEMA } from './_lib';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { username, fullName } = req.body;
    const existing = await base(AIRTABLE_SCHEMA.users.tableName).select({
      filterByFormula: `{${AIRTABLE_SCHEMA.users.columns.username}} = '${username}'`
    }).firstPage();
    
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, fields: existing[0].fields });
    }
    
    const record = await base(AIRTABLE_SCHEMA.users.tableName).create([{
      fields: { 
        [AIRTABLE_SCHEMA.users.columns.username]: username, 
        [AIRTABLE_SCHEMA.users.columns.fullName]: fullName || "" 
      }
    }]);
    
    res.json({ id: record[0].id, fields: record[0].fields });
  } catch (error: any) {
    console.warn("Airtable User Management Failed (likely limit reached). Using Guest fallback.");
    // Return a mock user so the app can continue in guest mode
    res.json({ 
      id: 'guest-fallback-' + Date.now(), 
      fields: { 
        [AIRTABLE_SCHEMA.users.columns.username]: 'guest@syncca.com',
        [AIRTABLE_SCHEMA.users.columns.firstName]: 'אורח'
      } 
    });
  }
}
