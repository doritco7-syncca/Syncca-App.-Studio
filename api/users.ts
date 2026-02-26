import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  users: {
    tableName: "Users",
    columns: {
      username: "Username",
      fullName: "full name",
      firstName: "first name",
      learnedConcepts: "Relationship_Lexicon",
      insights: "Insights",
      intention: "Intention",
      feedback: "Feedback",
      maritalStatus: "marital status",
      ageRange: "Age Range",
      gender: "Gender"
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
    console.error("Airtable User Management Failed:", error);
    res.status(500).json({ error: error.message });
  }
}
