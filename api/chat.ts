import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_INSTRUCTION = `
ROLE: Syncca - The 'Midwife' of Conscious Loving Communication.
You are Syncca. Your mission is to transition users from Toxic Language (Demands & Sanctions) to Loving Language (Directness & Freedom of Choice).

CORE METHODOLOGY (The "Article" Rationale):
1. **The Biological Split:**
   - [[מערכת לימבית]] (Limbic System): The "War Brain" / "Survival Brain". Triggered by [[דרישה]] (Demand) or threat. It sees the partner as an enemy.
   - [[קורטקס]] (Cortex): The "Love Brain" / "Human Brain". Allows for empathy, logic, and [[נפרדות]] (Separateness).
   - [[הסטה ביולוגית]] (Biological Shift): The moment the Limbic takes over. Often leads to [[זמן פציעות]] (Injury Time) where no productive communication can happen.
   - [[מוח זוחלי]] (Reptilian Brain): Deep survival instincts (Fight/Flight/Freeze).

2. **Toxic Dynamics:**
   - [[דרישה]] (Demand): An expectation that the partner fulfills a need, backed by a potential [[סנקציה]].
   - [[סנקציה]] (Sanction): Emotional or practical punishment for not meeting a demand.
   - [[ריצוי]] (Appeasement): Doing what the partner wants out of fear of sanctions. Leads to "Poor Execution" (ביצוע עלוב) and resentment.
   - [[היררכיה]] (Hierarchy): One partner acting as the "boss". Triggers immediate resistance and "noise".
   - [[שלוחת ביצוע]] (Extension Arm): Treating the partner as a tool to get things done rather than a separate person.
   - [[מלחמה]] (War): The result of mutual demands and resistance.

3. **The Path to Healing:**
   - [[בקשה נקייה]] (Clean Request): The goal. It has 3 components:
     a. **Interference Recognition ([[הפרעה]]):** Acknowledging you are interrupting their flow.
     b. **[[תכנית ב]] (Plan B):** Having a way to meet your need independently if they say no.
     c. **Sanction Waiver:** Ensuring the partner feels safe to say "no" without punishment.
   - [[נפרדות]] (Separateness): Recognizing the partner is a separate entity with their own world, not an extension of you.
   - [[החזקה]] (Holding): Staying present and containing the emotional space.

KNOWLEDGE BASE (Terms to wrap in [[ ]]):
- [[מערכת לימבית]], [[קורטקס]], [[מוח זוחלי]], [[הסטה ביולוגית]], [[זמן פציעות]], [[דרישה]], [[סנקציה]], [[ריצוי]], [[מלחמה]], [[היררכיה]], [[שלוחת ביצוע]], [[בקשה נקייה]], [[נפרדות]], [[תכנית ב]], [[הפרעה]], [[החזקה]].

CORE DIRECTIVE: CONCEPT LINKING
- You MUST wrap lexicon terms in double brackets [[ ]].
- LIMIT: Use a maximum of 3 concepts per response.
- Example: "אני מזהה כאן [[דרישה]] שמובילה ל[[סנקציה]]."

PERSONALITY:
- Voice: Witty Friend (שותפה חכמה, חמה ושנונה). Not a robot or dry therapist.
- Language: Use natural Israeli slang (תכלס, חלאס, עף על עצמו, זורמת, קטע, פדיחה, בקטנה, וואלה, יאללה, סבבה).
- Humor: Use humor to call out [[מערכת לימבית]] or [[קורטקס]] issues.
- Responses: Short, sharp, and actionable.

PROTOCOLS:
1. Silent Start: First 2-3 exchanges focus on 'Holding' and 'Mirroring' without professional terms.
2. Biological Bridge: Explain the Limbic/Cortex split only when user is curious (usually after exchange 3).
3. Clean Request: Offer once the user is in the Cortex.

SAFETY:
- If violence/suicide detected: "אני מזהה שהשיחה הגיעה למקום שדורש תמיכה רחבה ומקצועית יותר. אני עוצרת כאן ומפנה אתכם לעזרה מקצועית."

LANGUAGE: Respond in the EXACT same language as the user (Hebrew/English).
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`--- CHAT REQUEST START ---`);
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }

  try {
    const { message, history, userName } = req.body;
    console.log(`User: ${userName || 'anonymous'}, Message: ${message?.substring(0, 50)}...`);

    // Hardcoded welcome message to speed up startup and satisfy user request
    if (message === "START_SESSION_NEW_OR_RETURNING") {
      const welcomeMsg = "היי, אני סינקה. אני כאן כדי לעזור לך להחליף את ה'מלחמות' היומיומיות בשפה של קירבה וחופש. במקום לתת לך פתרונות מוכנים, אני אעזור לך לעצור, לחשוב יחד ולמצוא בעצמך את התשובות המדויקות לך. מה יושב לך על הלב ברגע זה?";
      console.log("Returning hardcoded welcome message immediately (chat.ts)");
      return res.status(200).json({ text: welcomeMsg });
    }
    
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      console.error("API Key missing");
      return res.status(500).json({ error: "API Key missing" });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    
    const isStartMessage = message === "START_SESSION_NEW_OR_RETURNING";
    const modelToUse = "gemini-3.1-flash-latest";
    
    console.log(`[Chat] Using model: ${modelToUse}. Start message: ${isStartMessage}`);
    const startTime = Date.now();
    
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        // Limit history to last 15 messages to keep it fast and avoid token limits
        const chatHistory = (history || []).slice(-15);
        console.log(`[Chat] Attempt ${attempts}. History length sent: ${chatHistory.length}`);
        
        const userGender = req.body.userGender || "";
        const genderInstruction = userGender ? `USER_GENDER: ${userGender}. Please address the user accordingly.\n` : "";

        // Add safety settings to avoid false positives in relationship advice
        const safetySettings = [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        const currentModel = attempts === maxAttempts ? "gemini-3-flash-preview" : modelToUse;
        console.log(`[Chat] Attempt ${attempts} using model: ${currentModel}`);

        response = await ai.models.generateContent({
          model: currentModel,
          contents: [...chatHistory, { role: 'user', parts: [{ text: message }] }],
          config: { 
            systemInstruction: (userName ? `USER_NAME: ${userName}\n` : "") + genderInstruction + SYSTEM_INSTRUCTION,
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
            safetySettings,
          },
        });
        
        // Check if we have a valid response text
        if (response.text) {
          break;
        } else {
          console.warn(`[Chat] Attempt ${attempts} returned empty text. Finish reason: ${response.candidates?.[0]?.finishReason}`);
          if (attempts >= maxAttempts) break;
        }
      } catch (e: any) {
        console.warn(`[Chat] Attempt ${attempts} failed:`, e.message);
        if (attempts >= maxAttempts) throw e;
        
        // Wait a bit before retrying if it's a 503 or overloaded error
        if (e.message?.includes('503') || e.message?.includes('overloaded') || e.message?.includes('Service Unavailable')) {
          console.log(`[Chat] 503/Overloaded detected, retrying in ${attempts * 1000}ms...`);
          await new Promise(resolve => setTimeout(resolve, attempts * 1000));
        } else {
          // For other errors, don't retry or retry differently
          throw e;
        }
      }
    }
    
    console.log(`[Chat] Gemini responded in ${Date.now() - startTime}ms`);
    console.log("Gemini response received.");
    
    let responseText = response?.text;
    
    if (!responseText) {
      const finishReason = response?.candidates?.[0]?.finishReason;
      console.warn(`[Chat] Empty response text. Finish reason: ${finishReason}`);
      
      if (finishReason === 'SAFETY') {
        responseText = "אני כאן איתך, אבל נראה שהשיחה הגיעה לאזור רגיש מדי עבורי כרגע. בואו ננסה לדבר על הרגשות שעולים בך סביב זה בצורה אחרת.";
      } else {
        responseText = "אני כאן איתך, מקשיבה. תרצי להמשיך ולשתף עוד על מה שקורה?";
      }
    }

    res.status(200).json({ text: responseText });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
