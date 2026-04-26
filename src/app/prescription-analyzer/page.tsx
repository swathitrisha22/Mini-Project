"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { recognize } from "tesseract.js";

const OCR_LANGUAGE_OPTIONS = [
  { label: "English", value: "eng" },
  { label: "English + Hindi", value: "eng+hin" },
  { label: "English + Telugu", value: "eng+tel" },
  { label: "English + Hindi + Telugu", value: "eng+hin+tel" },
];

function cleanPrescriptionText(raw: string) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[|]{2,}/g, "|")
    .replace(/[~`^]{2,}/g, "")
    .replace(/[_]{2,}/g, "_")
    .replace(/\b([A-Za-z])\s+([A-Za-z])\b/g, "$1$2")
    .replace(/[^\S\n]+$/gm, "")
    .trim();
}

function detectMedicineNames(text: string) {
  const matches = text.match(
    /\b(?:tab|tablet|cap|capsule|syrup|inj|injection|drop|ointment|cream)\s+([A-Za-z][A-Za-z0-9-]*)/gi
  );
  const names = (matches ?? [])
    .map((m) => m.replace(/\b(?:tab|tablet|cap|capsule|syrup|inj|injection|drop|ointment|cream)\s+/i, ""))
    .map((n) => n.trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

async function extractPdfTextWithOcrFallback(
  file: File,
  onProgress: (value: number) => void,
  ocrLang: string
) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const bytes = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  let textFromPdfLayer = "";
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ")
      .trim();
    if (pageText) {
      textFromPdfLayer += `${pageText}\n`;
    }
    onProgress(Math.round((pageNo / pdf.numPages) * 40));
  }

  const cleanLayerText = textFromPdfLayer.trim();
  if (cleanLayerText.replace(/\s/g, "").length >= 80) {
    return cleanLayerText;
  }

  let textFromOcr = "";
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) continue;

    const ocr = await recognize(blob, ocrLang, {
      logger: (message) => {
        if (message.status === "recognizing text" && typeof message.progress === "number") {
          const progress = Math.round(((pageNo - 1 + message.progress) / pdf.numPages) * 60 + 40);
          onProgress(Math.min(99, progress));
        }
      },
    });

    const pageText = ocr.data.text.trim();
    if (pageText) {
      textFromOcr += `${pageText}\n`;
    }
    onProgress(Math.round((pageNo / pdf.numPages) * 60 + 40));
  }

  return textFromOcr.trim();
}

export default function PrescriptionAnalyzerPage() {
  const [lang] = useState(
    typeof navigator !== "undefined" ? (navigator.language || "en").toLowerCase() : "en"
  );
  const [prescriptionText, setPrescriptionText] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrFileName, setOcrFileName] = useState("");
  const [ocrLang, setOcrLang] = useState("eng+hin+tel");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const detectedMedicines = useMemo(
    () => detectMedicineNames(prescriptionText),
    [prescriptionText]
  );

  async function analyzePrescription(input: string) {
    const res = await fetch("/api/prescription-analyzer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang,
        text: input,
        style: "concise",
        history: [],
      }),
    });
    const data = (await res.json()) as { reply?: string; error?: string };
    return data.reply ?? data.error ?? "Sorry, I couldn't answer.";
  }

  async function onAnalyze() {
    const combined = [
      "Prescription text:",
      prescriptionText.trim(),
      extraNotes.trim() ? `Patient notes: ${extraNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    if (!prescriptionText.trim()) {
      setError("Please upload or capture a prescription file first.");
      return;
    }

    setError("");
    setResult("");
    setLoading(true);
    try {
      const reply = await analyzePrescription(combined);
      setResult(reply);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to analyze prescription.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeExtractedText(text: string) {
    setPrescriptionText(text);
    setResult("");
    const combined = [
      "Prescription text:",
      text,
      extraNotes.trim() ? `Patient notes: ${extraNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setLoading(true);
    try {
      const reply = await analyzePrescription(combined);
      setResult(reply);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to analyze prescription.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function onUploadPrescriptionImage(file: File) {
    setError("");
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrFileName(file.name);
    try {
      const extracted = await recognize(file, ocrLang, {
        logger: (message) => {
          if (message.status === "recognizing text" && typeof message.progress === "number") {
            setOcrProgress(Math.round(message.progress * 100));
          }
        },
      });
      const text = extracted.data.text.trim();
      if (!text) {
        setError("No readable text found in the uploaded image. Try a clearer photo.");
        return;
      }
      const cleaned = cleanPrescriptionText(text);
      await analyzeExtractedText(cleaned);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Failed to extract text from the image.";
      setError(message);
    } finally {
      setOcrLoading(false);
    }
  }

  async function onUploadPrescriptionPdf(file: File) {
    setError("");
    setOcrLoading(true);
    setOcrProgress(0);
    setOcrFileName(file.name);
    try {
      const text = await extractPdfTextWithOcrFallback(
        file,
        (progress) => setOcrProgress(progress),
        ocrLang
      );
      if (!text) {
        setError("No readable text found in the uploaded PDF. Try a clearer scan.");
        return;
      }
      const cleaned = cleanPrescriptionText(text);
      await analyzeExtractedText(cleaned);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to read text from PDF.";
      setError(message);
    } finally {
      setOcrLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-6 py-5">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
            Prescription Analyzer
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Upload or capture a prescription. We extract text and generate an AI overview with
            timing, side effects, and precautions.
          </p>
        </div>

        <div className="p-6">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-zinc-700">OCR language profile</div>
            <select
              value={ocrLang}
              onChange={(e) => setOcrLang(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-zinc-400"
            >
              {OCR_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">
              Use mixed language profiles for Indian prescriptions. OCR may take longer.
            </p>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-medium text-zinc-700">
              Upload prescription image (JPG/PNG/WebP)
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void onUploadPrescriptionImage(file);
              }}
            />
          </label>

          <label className="mt-3 block">
            <div className="mb-1 text-xs font-medium text-zinc-700">
              Capture from camera
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void onUploadPrescriptionImage(file);
              }}
            />
          </label>

          <label className="mt-3 block">
            <div className="mb-1 text-xs font-medium text-zinc-700">
              Upload prescription PDF
            </div>
            <input
              type="file"
              accept="application/pdf"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-zinc-800"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void onUploadPrescriptionPdf(file);
              }}
            />
          </label>

          {ocrLoading ? (
            <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              Processing {ocrFileName}... {ocrProgress}%
            </div>
          ) : null}

          <label className="mt-3 block">
            <div className="mb-1 text-xs font-medium text-zinc-700">
              Optional notes (age, allergies, existing conditions)
            </div>
            <textarea
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              className="min-h-20 w-full rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none focus:border-zinc-400"
              placeholder="Example: Age 56, diabetic, no known drug allergy."
            />
          </label>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPrescriptionText("");
                setExtraNotes("");
                setResult("");
                setError("");
                setOcrFileName("");
                setOcrProgress(0);
              }}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => void onAnalyze()}
              disabled={loading || ocrLoading || !prescriptionText.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Generating AI overview..." : "Generate AI overview"}
            </button>
          </div>

          {detectedMedicines.length > 0 ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Detected medicines
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {detectedMedicines.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-900"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                AI Overview
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-zinc-900">
                {result}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
