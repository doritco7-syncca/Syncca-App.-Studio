import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  users: {
    tableName: "Users",
    columns: {
      username: "Username",
      fullName: "full name",
      firstName: "first name",
      maritalStatus: "marital status",
      ageRange: "Age Range",
      gender: "Gender",
      learnedConcepts: "Relationship_Lexicon",
      insights: "Insights",
      intention: "Intention",
      feedback: "Feedback"
    }
  }
};

const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 15000 }).base(baseId);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { username, fullName } = req.body;
  console.log(`User management request for: ${username}`);
  
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    // Try "Users" first, then "User" as fallback
    const tableNames = [AIRTABLE_SCHEMA.users.tableName, "User", "Users"];
    const uniqueTableNames = [...new Set(tableNames)];
    
    let lastError = null;
    for (const tableName of uniqueTableNames) {
      try {
        console.log(`Checking table: ${tableName} for user: ${username}`);
        const existing = await base(tableName).select({
          filterByFormula: `{${AIRTABLE_SCHEMA.users.columns.username}} = '${username}'`
        }).firstPage();
        
        if (existing.length > 0) {
          console.log(`Found existing user in ${tableName}: ${existing[0].id}`);
          return res.json({ id: existing[0].id, fields: existing[0].fields, table: tableName });
        }
        
        console.log(`User not found in ${tableName}, creating...`);
        
        // Build fields dynamically to be robust against missing columns
        const fields: any = {
          [AIRTABLE_SCHEMA.users.columns.username]: username
        };
        if (fullName) fields[AIRTABLE_SCHEMA.users.columns.fullName] = fullName;
        
        try {
          const record = await base(tableName).create([{ fields }]);
          console.log(`Created new user in ${tableName}: ${record[0].id}`);
          return res.json({ id: record[0].id, fields: record[0].fields, table: tableName });
        } catch (createErr: any) {
          console.warn(`Initial creation failed in ${tableName}: ${createErr.message}`);
          if (createErr.message?.includes('column') || createErr.message?.includes('field')) {
            console.log(`Retrying ${tableName} with username only...`);
            const record = await base(tableName).create([{ 
              fields: { [AIRTABLE_SCHEMA.users.columns.username]: username } 
            }]);
            return res.json({ id: record[0].id, fields: record[0].fields, table: tableName, partial: true });
          }
          throw createErr;
        }
      } catch (e: any) {
        console.warn(`User operation failed on table ${tableName}: ${e.message}`);
        lastError = e;
      }
    }
    
    throw lastError || new Error("Failed to manage user in any table");
  } catch (error: any) {
    console.error("Airtable User Management Failed:", error);
    res.status(500).json({ error: error.message });
  }
}
