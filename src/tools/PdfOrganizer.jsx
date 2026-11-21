import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument, degrees } from "pdf-lib";
import {
  FilePdf,
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  Copy,
  Trash,
  Download,
  LockKey,
  WarningCircle,
  SpinnerGap,
  CheckCircle,
  ArrowCounterClockwise,
  ArrowsDownUp,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// Shared unified thumbnail card with live rotation preview & tactile controls
function LazyOrganizerThumbnail({
  pdfDoc,
  item,
  index,
  totalCount,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMove,
  onRotate,
  onDuplicate,
  onDelete,
}) {
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
        const page = await pdfDoc.getPage(item.origPageNum);
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
        console.error(`Error rendering page ${item.origPageNum}:`, err);
      }
    }

    return () => observer.disconnect();
  }, [pdfDoc, item.origPageNum, rendered]);

  return (
    <div
      ref={containerRef}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={`group relative flex flex-col justify-between rounded-sharp border bg-surface transition-all duration-100 ${
        isDragging
          ? "border-signal ring-1 ring-signal opacity-70"
          : "border-hairline hover:border-ink/40"
      }`}
    >
      {/* 1. Top Header Strip: 01 tabular-nums & original page tag */}
      <div className="flex items-center justify-between border-b border-hairline px-2.5 py-1.5 text-xs">
        <span className="font-mono font-bold tabular-nums text-ink">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-ink-muted">
          <span>p.{item.origPageNum}</span>
          {item.rotation !== 0 && (
            <span className="font-bold text-signal">{item.rotation}°</span>
          )}
        </div>
      </div>

      {/* 2. Crisp White A4 Preview on Neutral Mat in the Center */}
      <div className="flex aspect-[3/4] w-full cursor-grab items-center justify-center bg-mat p-2.5 active:cursor-grabbing">
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[2px] bg-white shadow-2xs ring-1 ring-black/10">
          {!rendered && (
            <div className="h-full w-full animate-pulse bg-neutral-100" />
          )}
          <canvas
            ref={canvasRef}
            style={{
              transform: `rotate(${item.rotation}deg)`,
            }}
            className={`max-h-full max-w-full object-contain transition-transform duration-150 ${
              rendered ? "block" : "hidden"
            }`}
          />
        </div>
      </div>

      {/* 3. Tactile Page Controls in Bottom Strip */}
      <div className="flex items-center justify-between border-t border-hairline px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            title="Move earlier"
            className="rounded-sharp p-1 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
          >
            <ArrowLeft size={13} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, 1)}
            disabled={index === totalCount - 1}
            title="Move later"
            className="rounded-sharp p-1 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
          >
            <ArrowRight size={13} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => onRotate(item.id)}
            title="Rotate 90° clockwise"
            className="rounded-sharp p-1 text-ink-muted transition-colors hover:bg-mat hover:text-signal"
          >
            <ArrowClockwise size={13} weight="regular" />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onDuplicate(index)}
            title="Duplicate page"
            className="rounded-sharp p-1 text-ink-muted transition-colors hover:bg-mat hover:text-ink"
          >
            <Copy size={13} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={totalCount <= 1}
            title="Delete page"
            className="rounded-sharp p-1 text-ink-muted transition-colors hover:bg-signal/10 hover:text-signal disabled:opacity-30"
          >
            <Trash size={13} weight="regular" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PdfOrganizer() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pages, setPages] = useState([]); // [{ id, origPageNum, rotation }]
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Password handling state
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy().catch(() => {});
      }
    };
  }, [pdfDoc]);

  const resetMat = () => {
    if (pdfDoc) {
      pdfDoc.destroy().catch(() => {});
    }
    setFile(null);
    setRawBytes(null);
    setPdfDoc(null);
    setPages([]);
    setDraggedIndex(null);
    setNeedsPassword(false);
    setPassword("");
    setPasswordError("");
    setError("");
    setSuccessMsg("");
  };

  const loadPdfDocument = async (buffer, pwd = undefined) => {
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
      setNeedsPassword(false);

      const initialPages = Array.from({ length: doc.numPages }, (_, i) => ({
        id: `page-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
        origPageNum: i + 1,
        rotation: 0,
      }));
      setPages(initialPages);
    } catch (err) {
      if (err?.name === "PasswordException") {
        setNeedsPassword(true);
        if (pwd) {
          setPasswordError("Incorrect password. Please try again.");
        }
      } else {
        console.error("PDF load error:", err);
        setError("Could not read this PDF. The file may be corrupted.");
        setFile(null);
      }
    }
  };

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    resetMat();
    setFile(selected);
    const buffer = await selected.arrayBuffer();
    setRawBytes(buffer);
    await loadPdfDocument(buffer);
  };

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    if (!rawBytes || !password) return;
    await loadPdfDocument(rawBytes, password);
  };

  const movePage = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    setSuccessMsg("");
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleDragStart = (index) => setDraggedIndex(index);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setSuccessMsg("");
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(draggedIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const rotatePage = (id) => {
    setSuccessMsg("");
    setPages((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  const rotateAllPages = () => {
    setSuccessMsg("");
    setPages((prev) =>
      prev.map((p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))
    );
  };

  const reverseOrder = () => {
    setSuccessMsg("");
    setPages((prev) => [...prev].reverse());
  };

  const duplicatePage = (index) => {
    setSuccessMsg("");
    setPages((prev) => {
      const target = prev[index];
      const copy = {
        ...target,
        id: `page-${target.origPageNum}-copy-${Math.random()
          .toString(36)
          .slice(2, 7)}`,
      };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const deletePage = (id) => {
    if (pages.length <= 1) return;
    setSuccessMsg("");
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const resetPageOrder = () => {
    if (!pdfDoc) return;
    setSuccessMsg("");
    const restored = Array.from({ length: pdfDoc.numPages }, (_, i) => ({
      id: `page-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
      origPageNum: i + 1,
      rotation: 0,
    }));
    setPages(restored);
  };

  const saveOrganizedPdf = async () => {
    if (!rawBytes || pages.length === 0) return;
    setIsSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      const srcDoc = await PDFDocument.load(rawBytes, {
        ignoreEncryption: true,
      });
      const outDoc = await PDFDocument.create();

      const zeroIndices = pages.map((p) => p.origPageNum - 1);
      const copiedPages = await outDoc.copyPages(srcDoc, zeroIndices);

      copiedPages.forEach((page, idx) => {
        const extraRot = pages[idx].rotation;
        if (extraRot !== 0) {
          const currentRot = page.getRotation().angle;
          page.setRotation(degrees((currentRot + extraRot) % 360));
        }
        outDoc.addPage(page);
      });

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_reordered.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Saved "${outName}" (${pages.length} pages, ${formatBytes(blob.size)}).`
      );
    } catch (err) {
      console.error("Save organized PDF failed:", err);
      setError("Failed to export reordered PDF. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-3">
        <Dropzone
          accept=".pdf"
          multiple={false}
          title="Drop a PDF here to reorder, rotate, or delete pages"
          subtitle="Drag thumbnails to rearrange page sequence • 100% browser-local"
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
                onClick={resetMat}
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
      {/* 1. Header Strip: File Info & Quick Batch Actions */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <FilePdf size={18} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {pages.length} {pages.length === 1 ? "page" : "pages"} in output ·{" "}
              {formatBytes(file.size)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={rotateAllPages}
            className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]"
          >
            <ArrowClockwise size={14} weight="regular" />
            <span>Rotate All</span>
          </button>

          <button
            type="button"
            onClick={reverseOrder}
            className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]"
          >
            <ArrowsDownUp size={14} weight="regular" />
            <span>Reverse</span>
          </button>

          <button
            type="button"
            onClick={resetPageOrder}
            className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 py-1.5 text-xs font-bold text-ink-muted transition-all duration-100 ease-out hover:text-ink active:translate-y-[1px]"
          >
            <span>Restore</span>
          </button>

          <button
            type="button"
            onClick={resetMat}
            className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-2.5 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]"
          >
            <ArrowCounterClockwise size={14} weight="regular" />
            <span>New PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Thumbnails Grid inside Drafting Mat */}
      <div className="mat-recessed max-h-[480px] overflow-y-auto rounded-sharp border border-hairline p-4">
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
          {pages.map((item, idx) => (
            <LazyOrganizerThumbnail
              key={item.id}
              pdfDoc={pdfDoc}
              item={item}
              index={idx}
              totalCount={pages.length}
              isDragging={draggedIndex === idx}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onMove={movePage}
              onRotate={rotatePage}
              onDuplicate={duplicatePage}
              onDelete={deletePage}
            />
          ))}
        </div>
      </div>

      {/* 3. Feedback Alerts */}
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

      {/* 4. Desktop Footer CTA Strip */}
      <div className="hidden justify-end border-t border-hairline pt-4 lg:flex">
        <button
          type="button"
          onClick={saveOrganizedPdf}
          disabled={isSaving || pages.length === 0}
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          {isSaving ? (
            <>
              <SpinnerGap size={16} weight="regular" className="animate-spin" />
              <span>Saving PDF...</span>
            </>
          ) : (
            <>
              <Download size={16} weight="regular" />
              <span>Save Reordered PDF ({pages.length} pages)</span>
            </>
          )}
        </button>
      </div>

      {/* 5. Mobile Sticky Bottom-Pinned Action Bar (< 1024px) */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t border-hairline bg-surface px-4 py-3 lg:hidden">
        <div className="text-xs tabular-nums">
          <p className="font-bold text-ink">{pages.length} pages ready</p>
          <p className="text-ink-muted">Drag or tap arrows to reorder</p>
        </div>

        <button
          type="button"
          onClick={saveOrganizedPdf}
          disabled={isSaving || pages.length === 0}
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          <Download size={15} weight="regular" />
          <span>{isSaving ? "Saving..." : "Save PDF"}</span>
        </button>
      </div>
    </div>
  );
}
