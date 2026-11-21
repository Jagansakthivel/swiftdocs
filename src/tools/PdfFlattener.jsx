import { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import {
  Stamp,
  Download,
  LockKey,
  ShieldCheck,
  WarningCircle,
  SpinnerGap,
  CheckCircle,
  ArrowCounterClockwise,
  CheckSquare,
  Square,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfFlattener() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  // Inspection states
  const [fieldCount, setFieldCount] = useState(0);
  const [metaInfo, setMetaInfo] = useState({
    title: "",
    author: "",
    creator: "",
    producer: "",
  });

  // Toggles
  const [flattenForms, setFlattenForms] = useState(true);
  const [scrubMetadata, setScrubMetadata] = useState(true);
  const [removeAnnotations, setRemoveAnnotations] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const resetAll = () => {
    setFile(null);
    setRawBytes(null);
    setPageCount(0);
    setFieldCount(0);
    setMetaInfo({ title: "", author: "", creator: "", producer: "" });
    setFlattenForms(true);
    setScrubMetadata(true);
    setRemoveAnnotations(false);
    setError("");
    setSuccessMsg("");
  };

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    resetAll();

    try {
      const buffer = await selected.arrayBuffer();
      setFile(selected);
      setRawBytes(buffer);

      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      setPageCount(pdfDoc.getPageCount());

      // Inspect form fields
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        setFieldCount(fields.length);
      } catch {
        setFieldCount(0);
      }

      // Inspect metadata
      setMetaInfo({
        title: pdfDoc.getTitle() || "None",
        author: pdfDoc.getAuthor() || "None",
        creator: pdfDoc.getCreator() || "None",
        producer: pdfDoc.getProducer() || "None",
      });
    } catch (err) {
      console.error("PDF analysis error:", err);
      setError("Could not load this PDF. The file may be password-protected or corrupted.");
      setFile(null);
    }
  };

  const handleProcessAndDownload = async () => {
    if (!rawBytes || !file) return;
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      const pdfDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });

      // 1. Flatten forms
      if (flattenForms) {
        try {
          const form = pdfDoc.getForm();
          form.flatten();
        } catch (e) {
          console.warn("No form to flatten or error flattening:", e);
        }
      }

      // 2. Scrub metadata
      if (scrubMetadata) {
        pdfDoc.setTitle("");
        pdfDoc.setAuthor("");
        pdfDoc.setSubject("");
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer("");
        pdfDoc.setCreator("");
        pdfDoc.setCreationDate(new Date(0));
        pdfDoc.setModificationDate(new Date(0));
      }

      // 3. Remove annotations if checked
      if (removeAnnotations) {
        const pages = pdfDoc.getPages();
        pages.forEach((page) => {
          page.node.delete(pdfDoc.context.obj("Annots"));
        });
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_flattened.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Successfully flattened and scrubbed "${outName}" (${pageCount} pages, ${formatBytes(blob.size)}).`
      );
    } catch (err) {
      console.error("Flatten failed:", err);
      setError("Failed to flatten and scrub PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-3">
        <Dropzone
          accept=".pdf"
          multiple={false}
          title="Drop a PDF here to flatten and scrub"
          subtitle="Permanently lock fillable forms & strip author metadata • 100% browser-local"
          onFilesSelected={handleFileSelected}
        />
        {error && (
          <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-2.5 text-xs font-medium text-signal">
            <WarningCircle size={16} weight="regular" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Header Strip: File Info & Change PDF */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <Stamp size={18} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {pageCount} {pageCount === 1 ? "page" : "pages"} · {formatBytes(file.size)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          disabled={isProcessing}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] disabled:opacity-40 sm:self-auto"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* 2. Inspection Telemetry Strip */}
      <div className="grid gap-3 border-b border-hairline pb-5 sm:grid-cols-2">
        <div className="rounded-sharp border border-hairline bg-canvas p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Form Fields Detected
          </span>
          <p className="mt-1 font-mono text-base font-bold tabular-nums text-ink">
            {fieldCount} {fieldCount === 1 ? "interactive field" : "interactive fields"}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {fieldCount > 0
              ? "Form can be flattened into permanent non-editable text."
              : "No interactive form fields found; document will be locked."}
          </p>
        </div>

        <div className="rounded-sharp border border-hairline bg-canvas p-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Metadata Detected
          </span>
          <div className="mt-1 space-y-0.5 text-xs">
            <p className="truncate text-ink-muted">
              Author: <span className="font-bold text-ink">{metaInfo.author}</span>
            </p>
            <p className="truncate text-ink-muted">
              Producer: <span className="font-bold text-ink">{metaInfo.producer}</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Scrub & Flatten Action Toggles */}
      <div className="space-y-3.5 border-b border-hairline pb-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={flattenForms}
            onChange={(e) => setFlattenForms(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#D9381E] cursor-pointer"
          />
          <div>
            <span className="text-sm font-bold text-ink">
              Lock & Flatten Fillable Forms
            </span>
            <p className="text-xs text-ink-muted">
              Renders all interactive text boxes, checkboxes, and radio buttons directly into static page content so values cannot be altered.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={scrubMetadata}
            onChange={(e) => setScrubMetadata(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#D9381E] cursor-pointer"
          />
          <div>
            <span className="text-sm font-bold text-ink">
              Scrub Author & Document Metadata
            </span>
            <p className="text-xs text-ink-muted">
              Wipes hidden document properties including author names, software producer, creation dates, and revision timestamps.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={removeAnnotations}
            onChange={(e) => setRemoveAnnotations(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#D9381E] cursor-pointer"
          />
          <div>
            <span className="text-sm font-bold text-ink">
              Strip Popup Comments & Sticky Notes
            </span>
            <p className="text-xs text-ink-muted">
              Purges embedded reviewer notes, highlighted annotations, and markup from all pages.
            </p>
          </div>
        </label>
      </div>

      {/* 4. Feedback Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-3 text-xs font-medium text-signal">
          <WarningCircle size={16} weight="regular" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-sharp border border-emerald-600/40 bg-emerald-600/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle size={16} weight="regular" className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 5. Primary Action Strip */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleProcessAndDownload}
          disabled={isProcessing || (!flattenForms && !scrubMetadata && !removeAnnotations)}
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          {isProcessing ? (
            <>
              <SpinnerGap size={16} weight="regular" className="animate-spin" />
              <span>Sanitizing PDF...</span>
            </>
          ) : (
            <>
              <Stamp size={16} weight="regular" />
              <span>Flatten & Scrub PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
