import type { VercelRequest, VercelResponse } from '@vercel/node';
import Airtable from "airtable";

const AIRTABLE_SCHEMA = {
  feedbacks: {
    tableName: "Feedbacks",
    columns: {
      userEmail: "User_Email",
      content: "Feedback_Content"
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
  
  console.log("Feedback submission received:", req.body);
  
  try {
    const base = getBase();
    if (!base) throw new Error("Airtable not configured");
    
    const { email, content } = req.body;
    
    // Try "Feedbacks" first, then "Feedback" as fallback
    const tableNames = [AIRTABLE_SCHEMA.feedbacks.tableName, "Feedback", "Feedbacks"];
    const uniqueTableNames = [...new Set(tableNames)];
    
    let lastError = null;
    for (const tableName of uniqueTableNames) {
      try {
        console.log(`Attempting to save feedback to table: ${tableName}`);
        
        // Build fields dynamically to be robust against missing columns
        const fields: any = {};
        
        // Try multiple common names for content
        const contentFieldNames = [AIRTABLE_SCHEMA.feedbacks.columns.content, "Feedback_Content", "Content", "Feedback", "Text", "Message"];
        const emailFieldNames = [AIRTABLE_SCHEMA.feedbacks.columns.userEmail, "User_Email", "Email", "User", "Username"];
        
        // Find the first matching column name if we could list them, but we can't easily.
        // So we just try to set the most likely ones.
        fields[AIRTABLE_SCHEMA.feedbacks.columns.content] = content;
        if (email) fields[AIRTABLE_SCHEMA.feedbacks.columns.userEmail] = email;
        
        console.log(`Sending fields to Airtable:`, JSON.stringify(fields));
        
        try {
          const record = await base(tableName).create([{ fields }]);
          console.log(`Feedback saved successfully to ${tableName}. Record ID: ${record[0].id}`);
          return res.json({ id: record[0].id, success: true, table: tableName });
        } catch (e: any) {
          console.warn(`Initial save failed for ${tableName}: ${e.message}`, JSON.stringify(e));
          
          // Fallback: Try with common alternative column names if the first one failed
          console.log(`Retrying ${tableName} with alternative column names...`);
          
          // Try "Content" as a very common fallback
          try {
            const altFields: any = { "Content": content };
            if (email) altFields["Email"] = email;
            console.log(`Retrying with 'Content' and 'Email' fields...`);
            const record = await base(tableName).create([{ fields: altFields }]);
            return res.json({ id: record[0].id, success: true, table: tableName, alt: "Content" });
          } catch (innerE1: any) {
            console.warn(`Retry 1 failed: ${innerE1.message}`);
            // Try "Feedback" as another common fallback
            try {
              const altFields: any = { "Feedback": content };
              if (email) altFields["User"] = email;
              console.log(`Retrying with 'Feedback' and 'User' fields...`);
              const record = await base(tableName).create([{ fields: altFields }]);
              return res.json({ id: record[0].id, success: true, table: tableName, alt: "Feedback" });
            } catch (innerE2: any) {
              console.warn(`Retry 2 failed: ${innerE2.message}`);
              // Last resort: try with ONLY content using the schema name
              try {
                console.log(`Last resort: retrying with only content field...`);
                const record = await base(tableName).create([{ fields: { [AIRTABLE_SCHEMA.feedbacks.columns.content]: content || "" } }]);
                return res.json({ id: record[0].id, success: true, table: tableName, partial: true });
              } catch (innerE3: any) {
                console.warn(`Last resort failed: ${innerE3.message}`);
                throw innerE3;
              }
            }
          }
        }
      } catch (e: any) {
        console.warn(`Failed to save to table ${tableName}: ${e.message}`);
        lastError = e;
      }
    }
    
    throw lastError || new Error("Failed to save to any feedback table");
  } catch (error: any) {
    console.error("Airtable Feedback Submission Failed:", error);
    res.status(500).json({ error: error.message });
  }
}
