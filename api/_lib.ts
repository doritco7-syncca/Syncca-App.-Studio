import Airtable from "airtable";

export const AIRTABLE_SCHEMA = {
  systemInstruction: `You are Syncca, a Relationship Communication Guide. Use [[ ]] for lexicon terms.`,
  lexicon: { tableName: "Relationship_Lexicon", columns: { term: "English_Term", hebrew_term: "Hebrew_Term", definition_he: "Description_HE" } },
  users: { tableName: "Users", columns: { username: "Username", fullName: "full name", firstName: "first name" } }
};

export const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
};
