import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import {
  FilePdf,
  Scissors,
  Download,
  Archive,
  LockKey,
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

// Shared unified thumbnail card
function LazyPageThumbnail({ pdfDoc, pageNum, index, isSelected, onToggle }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdfDoc || rendered) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          renderPage();
        }
      },
      { rootMargin: "160px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.45 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        setRendered(true);
      } catch (err) {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }

    return () => observer.disconnect();
  }, [pdfDoc, pageNum, rendered]);

  return (
    <div
      ref={containerRef}
      className={`group relative flex flex-col justify-between rounded-sharp border bg-surface transition-all duration-100 ${
        isSelected
          ? "border-signal ring-1 ring-signal"
          : "border-hairline hover:border-ink/40"
      }`}
    >
      {/* 1. Top Header Strip: 01 tabular-nums & selection checkbox */}
      <div className="flex items-center justify-between border-b border-hairline px-2.5 py-1.5 text-xs">
        <span className="font-mono font-bold tabular-nums text-ink">
          {String(index + 1).padStart(2, "0")}
        </span>

        <button
          type="button"
          onClick={() => onToggle(pageNum)}
          className="text-ink-muted transition-colors hover:text-signal"
          title={isSelected ? "Deselect page" : "Select page"}
        >
          {isSelected ? (
            <CheckSquare size={16} weight="regular" className="text-signal" />
          ) : (
            <Square size={16} weight="regular" />
          )}
        </button>
      </div>

      {/* 2. Crisp White A4 Preview on Neutral Mat in the Center */}
      <div
        onClick={() => onToggle(pageNum)}
        className="flex aspect-[3/4] w-full cursor-pointer items-center justify-center bg-mat p-2.5"
      >
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[2px] bg-white shadow-2xs ring-1 ring-black/10">
          {!rendered && (
            <div className="h-full w-full animate-pulse bg-neutral-100" />
          )}
          <canvas
            ref={canvasRef}
            className={`max-h-full max-w-full object-contain ${
              rendered ? "block" : "hidden"
            }`}
          />
        </div>
      </div>

      {/* 3. Page Controls in Bottom Strip */}
      <div className="flex items-center justify-between border-t border-hairline px-2.5 py-1.5 text-[11px] font-mono tabular-nums">
        <span className="text-ink-muted">Page {pageNum}</span>
        <button
          type="button"
          onClick={() => onToggle(pageNum)}
          className={`font-sans font-bold transition-colors ${
            isSelected ? "text-signal" : "text-ink-muted hover:text-ink"
          }`}
        >
          {isSelected ? "Selected" : "Select"}
        </button>
      </div>
    </div>
  );
}

export default function PdfSplitter() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);

  // Split mode: 'selected' = extract checked pages; 'burst' = every page separate
  const [splitMode, setSplitMode] = useState("selected");
  const [selectedPages, setSelectedPages] = useState(new Set());
  const [customRange, setCustomRange] = useState("");

  // Password state
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy().catch(() => {});
      }
    };
  }, [pdfDoc]);

  const resetAll = () => {
    if (pdfDoc) {
      pdfDoc.destroy().catch(() => {});
    }
    setFile(null);
    setRawBytes(null);
    setPdfDoc(null);
    setTotalPages(0);
    setSelectedPages(new Set());
    setCustomRange("");
    setNeedsPassword(false);
    setPassword("");
    setPasswordError("");
    setError("");
    setSuccessMsg("");
  };

  const loadPdf = async (buffer, pwd = undefined) => {
    try {
      setError("");
      setPasswordError("");
      const copy = buffer.slice(0);
      const loadingTask = pdfjsLib.getDocument({
        data: copy,
        password: pwd,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setNeedsPassword(false);

      // Default: select first page
      setSelectedPages(new Set([1]));
      setCustomRange("1");
    } catch (err) {
      if (err?.name === "PasswordException") {
        setNeedsPassword(true);
        if (pwd) {
          setPasswordError("Incorrect password. Please try again.");
        }
      } else {
        console.error("PDF load error:", err);
        setError("Could not read this PDF. Make sure it is not corrupted.");
        setFile(null);
      }
    }
  };

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    resetAll();
    setFile(selected);
    const buffer = await selected.arrayBuffer();
    setRawBytes(buffer);
    await loadPdf(buffer);
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!rawBytes || !password) return;
    await loadPdf(rawBytes, password);
  };

  const togglePage = (pageNum) => {
    setSuccessMsg("");
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      syncRangeString(next);
      return next;
    });
  };

  const selectAll = () => {
    setSuccessMsg("");
    const all = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    setSelectedPages(all);
    setCustomRange(`1-${totalPages}`);
  };

  const selectNone = () => {
    setSuccessMsg("");
    setSelectedPages(new Set());
    setCustomRange("");
  };

  const syncRangeString = (set) => {
    if (set.size === 0) {
      setCustomRange("");
      return;
    }
    const arr = Array.from(set).sort((a, b) => a - b);
    const parts = [];
    let start = arr[0];
    let end = arr[0];

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === end + 1) {
        end = arr[i];
      } else {
        parts.push(start === end ? `${start}` : `${start}-${end}`);
        start = arr[i];
        end = arr[i];
      }
    }
    parts.push(start === end ? `${start}` : `${start}-${end}`);
    setCustomRange(parts.join(", "));
  };

  const handleRangeInputChange = (text) => {
    setCustomRange(text);
    setSuccessMsg("");
    const newSelected = new Set();
    const parts = text.split(",").map((p) => p.trim());

    for (const part of parts) {
      if (!part) continue;
      if (part.includes("-")) {
        const [sStr, eStr] = part.split("-").map((x) => x.trim());
        const s = parseInt(sStr, 10);
        const e = parseInt(eStr, 10);
        if (!isNaN(s) && !isNaN(e)) {
          const lo = Math.max(1, Math.min(s, e));
          const hi = Math.min(totalPages, Math.max(s, e));
          for (let p = lo; p <= hi; p++) {
            newSelected.add(p);
          }
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n) && n >= 1 && n <= totalPages) {
          newSelected.add(n);
        }
      }
    }
    setSelectedPages(newSelected);
  };

  const handleExtractOrBurst = async () => {
    if (!rawBytes || !file) return;

    if (splitMode === "selected" && selectedPages.size === 0) {
      setError("Please select at least one page to extract.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      const srcDoc = await PDFDocument.load(rawBytes, {
        ignoreEncryption: true,
      });
      const baseName = file.name.replace(/\.pdf$/i, "");

      if (splitMode === "selected") {
        const outDoc = await PDFDocument.create();
        const sortedIndices = Array.from(selectedPages)
          .sort((a, b) => a - b)
          .map((p) => p - 1);

        const copiedPages = await outDoc.copyPages(srcDoc, sortedIndices);
        copiedPages.forEach((p) => outDoc.addPage(p));

        const pdfBytes = await outDoc.save();
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        const outName = `${baseName}_extracted.pdf`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSuccessMsg(
          `Extracted ${selectedPages.size} page(s) into "${outName}" (${formatBytes(blob.size)}).`
        );
      } else {
        const zipFiles = {};
        for (let i = 0; i < totalPages; i++) {
          const singleDoc = await PDFDocument.create();
          const [copied] = await singleDoc.copyPages(srcDoc, [i]);
          singleDoc.addPage(copied);
          const singleBytes = await singleDoc.save();
          const pad = String(i + 1).padStart(String(totalPages).length, "0");
          zipFiles[`${baseName}_page_${pad}.pdf`] = new Uint8Array(singleBytes);
        }

        const zipped = zipSync(zipFiles, { level: 1 });
        const zipBlob = new Blob([zipped], { type: "application/zip" });
        const zipName = `${baseName}_all_pages.zip`;

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setSuccessMsg(
          `Burst ${totalPages} pages into "${zipName}" (${formatBytes(zipBlob.size)}).`
        );
      }
    } catch (err) {
      console.error("Split / Burst failed:", err);
      setError("Failed to extract pages. Please try again.");
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
          title="Drop a PDF here to split or extract pages"
          subtitle="Extract custom page ranges or burst into separate PDFs • 100% browser-local"
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

  if (needsPassword) {
    return (
      <div className="rounded-sharp border border-hairline p-6 sm:p-8">
        <div className="mx-auto max-w-md rounded-sharp border border-hairline bg-surface p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
              <LockKey size={18} weight="regular" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                Password-Protected PDF
              </h3>
              <p className="truncate text-xs text-ink-muted">{file.name}</p>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter document password..."
              autoFocus
              className="w-full rounded-sharp border border-hairline bg-canvas px-3.5 py-2 text-sm text-ink focus:border-signal focus:outline-none"
            />
            {passwordError && (
              <p className="text-xs font-medium text-signal">{passwordError}</p>
            )}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={resetAll}
                className="text-xs font-medium text-ink-muted hover:text-ink"
              >
                Choose another file
              </button>
              <button
                type="submit"
                className="rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] dark:text-canvas"
              >
                Unlock PDF
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16 lg:pb-0">
      {/* 1. Header Strip: File Info & Change PDF */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <FilePdf size={18} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {totalPages} pages total · {formatBytes(file.size)}
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

      {/* 2. Mode Selector & Range Input Strip */}
      <div className="space-y-3.5 border-b border-hairline pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Mode switch */}
          <div className="inline-flex rounded-sharp border border-hairline bg-canvas p-1">
            <button
              type="button"
              onClick={() => setSplitMode("selected")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                splitMode === "selected"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <Scissors size={14} weight="regular" />
              <span>Extract Selected ({selectedPages.size})</span>
            </button>

            <button
              type="button"
              onClick={() => setSplitMode("burst")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                splitMode === "burst"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <Archive size={14} weight="regular" />
              <span>Burst Every Page ({totalPages})</span>
            </button>
          </div>

          {splitMode === "selected" && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs font-bold text-ink-muted transition-colors hover:text-ink"
              >
                Select All
              </button>
              <span className="text-hairline">·</span>
              <button
                type="button"
                onClick={selectNone}
                className="text-xs font-bold text-ink-muted transition-colors hover:text-signal"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {splitMode === "selected" && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-ink-muted">
              Page Range:
            </label>
            <input
              type="text"
              value={customRange}
              onChange={(e) => handleRangeInputChange(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              className="flex-1 min-w-[200px] rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-mono font-bold text-ink focus:border-signal focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 3. Thumbnails Grid inside Drafting Mat */}
      {splitMode === "selected" && (
        <div className="mat-recessed max-h-[480px] overflow-y-auto rounded-sharp border border-hairline p-4">
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum, idx) => (
              <LazyPageThumbnail
                key={pageNum}
                pdfDoc={pdfDoc}
                pageNum={pageNum}
                index={idx}
                isSelected={selectedPages.has(pageNum)}
                onToggle={togglePage}
              />
            ))}
          </div>
        </div>
      )}

      {splitMode === "burst" && (
        <div className="rounded-sharp border border-hairline bg-canvas p-6 text-center text-xs text-ink-muted">
          <p className="font-bold text-ink">Ready to burst document</p>
          <p className="mt-1">
            Every page will be saved as an individual PDF inside a ZIP archive.
          </p>
        </div>
      )}

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

      {/* 5. Desktop Action Bar Strip */}
      <div className="hidden justify-end border-t border-hairline pt-4 lg:flex">
        <button
          type="button"
          onClick={handleExtractOrBurst}
          disabled={
            isProcessing ||
            (splitMode === "selected" && selectedPages.size === 0)
          }
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          {isProcessing ? (
            <>
              <SpinnerGap size={16} weight="regular" className="animate-spin" />
              <span>Processing...</span>
            </>
          ) : splitMode === "selected" ? (
            <>
              <Scissors size={16} weight="regular" />
              <span>
                Extract {selectedPages.size}{" "}
                {selectedPages.size === 1 ? "Page" : "Pages"}
              </span>
            </>
          ) : (
            <>
              <Archive size={16} weight="regular" />
              <span>Burst All {totalPages} Pages as ZIP</span>
            </>
          )}
        </button>
      </div>

      {/* 6. Mobile Bottom Pinned Action Bar (< 1024px) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-hairline bg-surface px-4 py-3 lg:hidden">
        <div className="text-xs tabular-nums">
          <p className="font-bold text-ink">
            {splitMode === "selected"
              ? `${selectedPages.size} pages selected`
              : `${totalPages} pages ready`}
          </p>
          <p className="text-ink-muted">
            {splitMode === "selected" ? "Tap page to toggle" : "Ready to burst"}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExtractOrBurst}
          disabled={
            isProcessing ||
            (splitMode === "selected" && selectedPages.size === 0)
          }
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          <Download size={15} weight="regular" />
          <span>{isProcessing ? "Processing..." : "Extract PDF"}</span>
        </button>
      </div>
    </div>
  );
}
