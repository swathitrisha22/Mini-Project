import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { z } from "zod";

type GeminiModelInfo = {
  name?: string;
  supportedGenerationMethods?: string[];
};

const OPENAI_MAX_OUTPUT_TOKENS = 16384;
const GEMINI_MAX_OUTPUT_TOKENS = 8192;

let cachedModel: string | null = null;
let cachedAt = 0;

async function listModelsViaRest(apiKey: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
    apiKey
  )}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    throw new Error(`ListModels failed (${r.status})`);
  }
  return (await r.json()) as { models?: GeminiModelInfo[] };
}

async function resolveSupportedModel(apiKey: string) {
  const now = Date.now();
  if (cachedModel && now - cachedAt < 10 * 60_000) return cachedModel;

  const preferred = process.env.GEMINI_MODEL?.trim();

  const listing = await listModelsViaRest(apiKey);
  const models = (listing.models ?? []).filter(
    (m: GeminiModelInfo) =>
      typeof m?.name === "string" &&
      Array.isArray(m?.supportedGenerationMethods) &&
      m.supportedGenerationMethods.includes("generateContent")
  ) as Array<{ name: string }>;

  if (preferred) {
    const prefName = preferred.startsWith("models/") ? preferred : `models/${preferred}`;
    if (models.some((m) => m.name === prefName)) {
      cachedModel = preferred;
      cachedAt = now;
      return preferred;
    }
  }

  const flash = models.find((m) => m.name.includes("flash"));
  const chosenFull = (flash ?? models[0])?.name;
  if (!chosenFull) throw new Error("No supported Gemini models available for generateContent");

  const chosen = chosenFull.replace(/^models\//, "");
  cachedModel = chosen;
  cachedAt = now;
  return chosen;
}

export async function GET() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  return NextResponse.json({
    provider: hasOpenAI ? "openai" : hasGemini ? "gemini" : "none",
    model: hasOpenAI
      ? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
      : process.env.GEMINI_MODEL ?? "(auto)",
  });
}

const bodySchema = z.object({
  lang: z.string().min(2).max(20).default("en"),
  text: z.string().min(1).max(4000),
  style: z.enum(["concise", "human"]).optional().default("human"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().min(1).max(2000),
      })
    )
    .max(12)
    .optional()
    .default([]),
  coords: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .optional(),
  locationLabel: z.string().max(200).optional(),
});

function buildPrompt(
  lang: string,
  userText: string,
  style: "concise" | "human",
  history: Array<{ role: "user" | "assistant"; text: string }>,
  locationLabel?: string,
  coords?: { lat: number; lon: number }
) {
  const locLine = locationLabel
    ? `User location (approx): ${locationLabel}`
    : coords
      ? `User location (approx): ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`
      : "";
  const historyBlock =
    history.length > 0
      ? `Recent conversation:\n${history
          .map((h) => `- ${h.role.toUpperCase()}: ${h.text}`)
          .join("\n")}\n`
      : "";
  const styleLine =
    style === "human"
      ? "Tone: empathetic, natural, and human-like. Sound like a caring assistant, not a formal bot."
      : "Tone: concise and direct.";
  return `
You are a prescription explanation assistant. You are NOT a doctor.
Respond in the user's language: ${lang}.
${styleLine}

Goal: Analyze the prescription text and explain practical usage clearly.
Output sections in this exact order:
1) Simple Explanation
2) Dosage & Schedule Plan
3) Medicine Summary Table
4) Side Effects & Warnings
5) Lifestyle & Food Advice
6) Reminders / Routine Plan
7) Medicine Alternatives (General Info)

Rules:
- If medicine name/dose is unclear, say "unclear from prescription" and provide safe guidance.
- Do NOT invent dosages.
- Keep the answer detailed but easy to understand for a patient.
- For section 3, provide a compact plain-text table with columns:
  Medicine name | Purpose | Dosage | Duration | Special instructions
- For section 2, provide a practical day plan (morning / afternoon / night).
- For section 4, include common side effects + serious red flags + possible interactions.
- For section 7, only provide informational generic/brand alternatives with a warning to confirm with doctor/pharmacist.
- If severe warning signs are present, advise urgent in-person care.
- Output plain text only.
- Do NOT use markdown headings like ###.
- Do NOT add intro lines like "Here is an explanation...".
${locLine ? `\nContext:\n- ${locLine}\n` : ""}
${historyBlock}

Prescription / user message:
${userText}
`.trim();
}

async function analyzeWithOpenAI(prompt: string, apiKey: string) {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const out = await client.responses.create({
    model,
    temperature: 0.2,
    max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
    input: prompt,
  });
  const reply = out.output_text?.trim() ?? "";
  if (!reply) throw new Error("OpenAI returned empty response");
  return reply;
}

async function analyzeWithGemini(prompt: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = await resolveSupportedModel(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0.2, maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS },
  });
  const out = await model.generateContent(prompt);
  return out.response.text().trim();
}

function normalizeAiOverview(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trimEnd());

  const filtered = lines.filter((line, idx) => {
    if (!line.trim()) return true;
    if (
      idx < 2 &&
      /^(here is|here's|this is|ai overview|explanation of your prescription)/i.test(
        line.trim()
      )
    ) {
      return false;
    }
    return true;
  });

  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function buildLocalFallbackAdvice(userText: string) {
  const medicinePattern =
    /\b(?:tab|tablet|cap|capsule|syrup|inj|injection|drop|ointment|cream)\s+([A-Za-z][A-Za-z0-9-]*)/gi;
  const meds = Array.from(userText.matchAll(medicinePattern))
    .map((m) => m[1]?.trim())
    .filter((v): v is string => Boolean(v));
  const uniqueMeds = Array.from(new Set(meds));
  const medLines =
    uniqueMeds.length > 0
      ? uniqueMeds.map((m) => `- ${m} (dose/timing unclear from prescription)`).join("\n")
      : "- unclear from prescription";

  return [
    "1) Simple Explanation",
    "- Purpose appears prescription-based, but exact diagnosis is unclear from OCR text.",
    "- Doctor likely prescribed these for symptom control and recovery support.",
    "",
    "2) Dosage & Schedule Plan",
    "- Exact timing is unclear from prescription text.",
    "- Use this safe plan until confirmed: Morning / Afternoon / Night as written on strip or doctor note.",
    "- Prefer after food unless specifically marked before food.",
    "",
    "3) Medicine Summary Table",
    "Medicine name | Purpose | Dosage | Duration | Special instructions",
    ...(uniqueMeds.length > 0
      ? uniqueMeds.map((m) => `${m} | unclear from prescription | unclear | unclear | confirm with doctor/pharmacist`)
      : ["unclear | unclear | unclear | unclear | prescription text unclear"]),
    "",
    "4) Side Effects & Warnings",
    "- Common: mild nausea, acidity, sleepiness, loose stools (depends on medicine).",
    "- Serious: breathing trouble, swelling, chest pain, severe rash, persistent vomiting, black stools -> urgent care.",
    "- Interactions: avoid combining new OTC painkillers/antibiotics without pharmacist check.",
    "",
    "5) Lifestyle & Food Advice",
    "- Stay hydrated, take adequate rest, avoid alcohol and smoking.",
    "- Prefer light meals if stomach upset occurs.",
    "",
    "6) Reminders / Routine Plan",
    "- Set alarms for Morning / Afternoon / Night doses.",
    "- Keep a checklist and mark dose taken immediately.",
    "",
    "7) Medicine Alternatives (General Info)",
    "- Generic vs brand alternatives may exist, but substitutions must be confirmed by a licensed doctor/pharmacist.",
    "- This is fallback guidance from local rules due to AI provider limits. Confirm exact dosage and substitutions with your doctor.",
  ].join("\n");
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prompt = buildPrompt(
    parsed.data.lang,
    parsed.data.text,
    parsed.data.style,
    parsed.data.history,
    parsed.data.locationLabel,
    parsed.data.coords
  );

  const openAIKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const providerErrors: string[] = [];

  if (openAIKey) {
    try {
      const rawReply = await analyzeWithOpenAI(prompt, openAIKey);
      const reply = normalizeAiOverview(rawReply);
      return NextResponse.json({ reply, provider: "openai" });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "OpenAI request failed";
      providerErrors.push(`OpenAI: ${message}`);
    }
  }

  if (geminiKey) {
    try {
      const rawReply = await analyzeWithGemini(prompt, geminiKey);
      const reply = normalizeAiOverview(rawReply);
      if (reply) {
        return NextResponse.json({ reply, provider: "gemini" });
      }
      providerErrors.push("Gemini: empty response");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Gemini request failed";
      providerErrors.push(`Gemini: ${message}`);
    }
  }

  const fallbackReply = buildLocalFallbackAdvice(parsed.data.text);
  return NextResponse.json({
    reply: fallbackReply,
    provider: "local-fallback",
    warning: providerErrors.join(" | "),
  });
}
