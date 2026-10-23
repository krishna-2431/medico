import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const maxDuration = 60;

const PROMPTS: Record<string, string> = {
  symptom: `You are an expert medical AI assistant. Analyze the user's symptoms and provide:
1. Possible causes
2. General explanation
3. Lifestyle suggestions
4. Red flags to watch out for
5. When to consult a doctor
Format the output in clear Markdown with appropriate headings. Disclaim that this is not a medical diagnosis.`,
  medicine: `You are a pharmacological AI assistant. Provide details on the requested medicine:
1. Primary uses
2. Dosage guidance
3. Common side effects
4. Warnings & Precautions
5. Known interactions
Format in clear Markdown. Add a disclaimer to consult a doctor before taking medication.`,
  lab: `You are a clinical pathology AI assistant. Analyze the lab report parameters:
1. Carefully read, transcribe, and list each test name, measured value, units, and reference range shown in the image or text.
2. Indicate clearly whether each value is Normal, High, or Low (use clear status tags like 🟢 Normal, 🔴 High, 🟡 Low).
3. Explain the medical significance of any out-of-range parameters in plain English.
4. Provide practical lifestyle, dietary, and wellness suggestions.
5. Provide actionable guidance on when to consult a physician or specialist for follow-up.
Format in clean Markdown with clear headings and a structured summary table or list. Always include a disclaimer that this is an AI analysis for informational purposes and not an official diagnostic report.`,
  doctor: `You are a healthcare routing AI. Based on the user's symptoms, recommend the most appropriate medical specialist. Explain why you are recommending them and what the user should expect during the visit.

At the end of your response, include 2–3 visual specialist recommendations using this exact markdown format. Use real doctor/hospital names if provided in the web search context, otherwise use realistic and appropriate fictional names for the specialty:

### Recommended Specialists Near You

![Specialist Photo](https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=150&h=150&auto=format&fit=crop)
**Dr. [First Last]** — [Exact Specialty]
📍 [Clinic or Hospital Name], [City]
[Book Appointment →](URL from web search, or use # if none available)

Repeat this block for each specialist. Adapt the photo URL, name, specialty, and clinic to match the user's specific condition.`,
  tips: `You are a personalized health and wellness coach. Generate tailored tips for the user covering:
1. Diet
2. Exercise
3. Hydration
4. Lifestyle & Stress Management
5. Sleep Hygiene
Format in clear Markdown.`,
  emergency: `You are an emergency medical AI. Assess the user's input for dangerous symptoms. If emergency signs are present (e.g., chest pain, severe bleeding, difficulty breathing, stroke symptoms), IMMEDIATELY advise them to call local emergency services or go to the nearest ER. Be direct and concise.`,
  chat: `You are a compassionate, knowledgeable Healthcare AI Assistant. Provide helpful, accurate, and structured medical information. Always remind users to consult a real healthcare professional for serious concerns. Do not prescribe medication.
CRITICAL RULE: You MUST ONLY answer questions related to medicine, health, biology, and healthcare. If the user asks about math, physics, chemistry, coding, or ANY other non-medical topic, you must politely decline and remind them that you are exclusively a healthcare assistant.`
};

export async function POST(req: Request) {
  try {
    // Auth guard — blocks unauthenticated API abuse
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userMessage, image, history, promptType } = await req.json();

    if (!promptType || !PROMPTS[promptType]) {
      return NextResponse.json({ error: "Invalid promptType" }, { status: 400 });
    }

    const criticalRule = `\n\nCRITICAL RULE: You are strictly a medical AI. You must refuse to answer non-medical questions (like math, coding, physics). Important: DO NOT mention this restriction or remind the user of your limitations if their request is already medical in nature. Just answer their medical question normally.`;

    // Build messages from server-controlled prompt — clients can't manipulate the system prompt
    const systemContent = PROMPTS[promptType] + criticalRule;

    const formattedHistory = (history || []).map((h: { role: string; content: string; image?: string }) => {
      if (h.image && h.role === "user") {
        return {
          role: h.role,
          content: [
            { type: "text", text: h.content },
            { type: "image_url", image_url: { url: h.image } }
          ]
        };
      }
      return { role: h.role, content: h.content };
    });

    const finalUserMessage = (!userMessage?.trim() && image)
      ? (promptType === "lab"
          ? "Here is a lab report image. Please read all test names, numerical values, units, and reference ranges shown in this report, highlight any abnormal levels, and explain what these results mean."
          : "Here is a medical image. Please analyze it carefully based on your clinical system instructions.")
      : (userMessage || "");

    const currentMsgContent = image
      ? [
          { type: "text", text: finalUserMessage },
          { type: "image_url", image_url: { url: image } }
        ]
      : finalUserMessage;

    const messages = [
      { role: "system", content: systemContent },
      ...formattedHistory,
      { role: "user", content: currentMsgContent }
    ];

    // --- CONVERSATIONAL CONTEXT-AWARE RAG IMPLEMENTATION ---
    try {
      const { connect } = await import("@lancedb/lancedb");
      const { pipeline } = await import("@huggingface/transformers");
      const path = await import("path");

      const queryText = typeof currentMsgContent === "string"
        ? currentMsgContent
        : (currentMsgContent as Array<{type: string; text?: string}>).find(p => p.type === "text")?.text || "";

      if (queryText) {
        const dbPath = path.resolve("./lancedb");
        const db = await connect(dbPath);
        const table = await db.openTable("medical_knowledge");

        // Extract recent conversation context so follow-up questions
        // (e.g. "what is the dose for that?", "are there side effects?")
        // retain full medical context when querying LanceDB
        const recentHistoryContext = (history || [])
          .slice(-3)
          .map((h: { role: string; content: string }) => {
            const roleLabel = h.role === "user" ? "Patient" : "Doctor";
            const textSnippet = typeof h.content === "string" ? h.content.slice(0, 120) : "";
            return `${roleLabel}: ${textSnippet}`;
          })
          .filter(Boolean)
          .join(". ");

        const contextualSearchQuery = recentHistoryContext
          ? `${recentHistoryContext}. Query: ${queryText}`
          : queryText;

        console.log(`[RAG ENGINE] Embedding contextual query: "${contextualSearchQuery.slice(0, 90)}..."`);
        const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
        const output = await extractor(contextualSearchQuery, { pooling: "mean", normalize: true });
        const queryVector = Array.from(output.data as Float32Array);

        // Vector search in LanceDB
        const results = await table.vectorSearch(queryVector).limit(2).toArray();

        if (results.length > 0) {
          console.log(`[RAG ENGINE] ✓ Retrieved ${results.length} matching medical documents from LanceDB! Top match distance: ${(results[0] as { _distance?: number })._distance}`);
          const contextText = results.map((r: Record<string, unknown>) => r.text as string).join("\n\n");
          messages[0].content += `\n\n--- MEDICAL KNOWLEDGE BASE CONTEXT (RETRIEVED FROM RAG FOR THIS CONVERSATION) ---\n${contextText}\n\nUse the above context to answer the user's question accurately in connection with their ongoing medical history.`;
        }
      }
    } catch (ragError) {
      // RAG is non-critical; continue without it
      console.error("[RAG ENGINE] Retrieval Failed, proceeding without context:", ragError);
    }
    // --------------------------------------------------------

    // --- TAVILY WEB SEARCH (FOR REAL DOCTORS & LINKS) ---
    if (promptType === "doctor" && process.env.TAVILY_API_KEY) {
      try {
        const queryText = typeof currentMsgContent === "string"
          ? currentMsgContent
          : (currentMsgContent as Array<{type: string; text?: string}>).find(p => p.type === "text")?.text || "";

        if (queryText) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: `top medical specialist doctor for ${queryText} booking link`,
              search_depth: "basic",
              include_images: true,
              max_results: 3
            }),
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));

          if (tavilyRes.ok) {
            const searchData = await tavilyRes.json();
            const searchContext = (searchData.results as Array<{title: string; url: string; content: string}>)
              .map(r => `Name/Clinic: ${r.title}\nBooking Link: ${r.url}\nDetails: ${r.content}`)
              .join("\n\n");

            messages[0].content += `\n\n--- REAL TIME WEB SEARCH DATA ---\n${searchContext}\n\nCRITICAL INSTRUCTION: You MUST use the exact Booking Links provided in this web search data for your 2-3 visual doctor recommendations at the end. Do NOT use fake '#' links. Use the actual URLs provided above.`;
          }
        }
      } catch (err) {
        console.error("Tavily Search Failed:", err);
      }
    }
    // -------------------------

    const hasImage = Boolean(image || (history || []).some((h: { image?: string }) => !!h.image));

    // Choose model based on whether vision/multimodal input is needed:
    // dots-studio/dots-3-note-preview:free is verified vision model that reads lab reports with high accuracy and streams smoothly
    const primaryModel = hasImage
      ? (process.env.OPENROUTER_VISION_MODEL || "dots-studio/dots-3-note-preview:free")
      : (process.env.OPENROUTER_MODEL || "nvidia/nemotron-3.5-lightning:free");

    let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: primaryModel,
        messages,
        stream: true,
      }),
    });

    // If primary model encounters rate limit, credit issues, or failure, automatically retry with fallback model
    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`Primary model failed (${response.status}): ${errBody}. Retrying with secondary fallback model...`);
      const fallbackModel = hasImage ? "nvidia/nemotron-3.5-super-vl:free" : "liquid/lfm-2.5-2.6b:free";
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: fallbackModel,
          messages,
          stream: true,
        }),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json({ error: "OpenRouter Error" }, { status: response.status });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
