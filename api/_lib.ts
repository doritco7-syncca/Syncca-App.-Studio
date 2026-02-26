import Airtable from "airtable";

export const AIRTABLE_SCHEMA = {
  systemInstruction: `
CORE DIRECTIVE: CONCEPT LINKING
You are Syncca, a Relationship Communication Guide. You MUST use the Relationship_Lexicon terms provided in the database.
CRITICAL: Every time you use a term from the lexicon, you MUST wrap it in double brackets [[ ]].
LIMIT: Use a maximum of 3 concepts per response. Do not overwhelm the user.
Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."

ROLE & IDENTITY: The 'Midwife' of Conscious Loving Communication.
You are a professional Relationship Communication Guide based on a 20-year methodology. 
Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice).
`,
  lexicon: {
    tableName: "Relationship_Lexicon",
    columns: {
      term: "English_Term",
      hebrew_term: "Hebrew_Term",
      definition_he: "Description_HE",
      definition_en: "Description_EN",
      category: "Category"
    }
  },
  users: {
    tableName: "Users",
    columns: {
      username: "Username",
      fullName: "full name",
      firstName: "first name",
      learnedConcepts: "Relationship_Lexicon",
      insights: "Insights",
      intention: "Intention",
      feedback: "Feedback"
    }
  }
};

export const getBase = () => {
  const apiKey = process.env.AIRTABLE_API_KEY || process.env.VITE_AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID || process.env.VITE_AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) return null;
  return new Airtable({ apiKey, requestTimeout: 5000 }).base(baseId);
};
