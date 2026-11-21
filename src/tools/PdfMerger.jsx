import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  FilePdf,
  ArrowUp,
  ArrowDown,
  Trash,
  Plus,
  ArrowsMerge,
  DotsSixVertical,
  WarningCircle,
  SpinnerGap,
  CheckCircle,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function PdfMerger() {
  const [items, setItems] = useState([]);
  const [outputName, setOutputName] = useState("SwiftDocs_Merged");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleFilesSelected = async (newFiles) => {
    setError("");
    setSuccessMsg("");

    const loadedItems = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        loadedItems.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          pageCount: pdfDoc.getPageCount(),
        });
      } catch (err) {
        console.error("Failed to read PDF:", err);
        setError(
          `Could not load "${file.name}". It may be password-protected or corrupted.`
        );
      }
    }

    if (loadedItems.length > 0) {
      setItems((prev) => [...prev, ...loadedItems]);
    }
  };

  const moveItem = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= items.length) return;
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(newIndex, 0, moved);
      return updated;
    });
  };

  const handleDragStart = (index) => setDraggedIndex(index);

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setItems((prev) => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, draggedItem);
      return updated;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setSuccessMsg("");
  };

  const handleMerge = async () => {
    if (items.length < 2) {
      setError("Please add at least 2 PDF files to merge.");
      return;
    }

    setError("");
    setSuccessMsg("");
    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const item of items) {
        const arrayBuffer = await item.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const cleanName = (outputName.trim() || "SwiftDocs_Merged").replace(
        /\.pdf$/i,
        ""
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Merged ${items.length} PDFs (${mergedPdf.getPageCount()} pages total) into "${cleanName}.pdf".`
      );
    } catch (err) {
      console.error("Merge failed:", err);
      setError("Something went wrong while merging your PDFs. Please try again.");
    } finally {
      setIsMerging(false);
    }
  };

  const totalPages = items.reduce((sum, item) => sum + item.pageCount, 0);
  const totalSize = items.reduce((sum, item) => sum + item.file.size, 0);

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <Dropzone
          accept=".pdf"
          multiple={true}
          title="Drop multiple PDFs here to merge"
          subtitle="Select 2 or more PDF files • Reorder them before combining"
          onFilesSelected={handleFilesSelected}
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
      {/* 1. Header Settings & Telemetry Strip */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {items.length} {items.length === 1 ? "document" : "documents"} queued
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
            {totalPages} {totalPages === 1 ? "page" : "pages"} total · {formatBytes(totalSize)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-ink-muted">
            Output name:
          </label>
          <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 focus-within:border-signal">
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-36 bg-transparent text-xs font-bold text-ink focus:outline-none sm:w-48"
            />
            <span className="font-mono text-xs font-bold text-ink-muted">
              .pdf
            </span>
          </div>
        </div>
      </div>

      {/* 2. Joined Hairline Reorderable List */}
      <div className="divide-y divide-hairline overflow-hidden rounded-sharp border border-hairline bg-surface">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center justify-between gap-3 p-3.5 transition-colors ${
              draggedIndex === index ? "bg-mat opacity-75" : "hover:bg-mat/40"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div
                title="Drag to reorder"
                className="cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing"
              >
                <DotsSixVertical size={18} weight="regular" />
              </div>

              <span className="w-5 shrink-0 font-mono text-xs font-bold tabular-nums text-ink-muted">
                {String(index + 1).padStart(2, "0")}
              </span>

              {/* 36px x 36px standardized file icon container */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
                <FilePdf size={18} weight="regular" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {item.file.name}
                </p>
                <p className="text-xs tabular-nums text-ink-muted">
                  {item.pageCount} {item.pageCount === 1 ? "page" : "pages"} ·{" "}
                  {formatBytes(item.file.size)}
                </p>
              </div>
            </div>

            {/* Reorder & Remove Buttons with regular weights */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title="Move earlier"
                className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={15} weight="regular" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title="Move later"
                className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={15} weight="regular" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                title="Remove PDF"
                className="ml-1 rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-signal/10 hover:text-signal"
              >
                <Trash size={15} weight="regular" />
              </button>
            </div>
          </div>
        ))}
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

      {/* 4. Footer Actions Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sharp border border-hairline bg-surface px-4 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]">
          <Plus size={15} weight="regular" />
          <span>Add More PDFs</span>
          <input
            type="file"
            accept=".pdf"
            multiple
            onChange={(e) => {
              handleFilesSelected(Array.from(e.target.files));
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setItems([]);
              setError("");
              setSuccessMsg("");
            }}
            className="text-xs font-medium text-ink-muted hover:text-signal"
          >
            Clear All
          </button>

          <button
            type="button"
            onClick={handleMerge}
            disabled={isMerging || items.length < 2}
            className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
          >
            {isMerging ? (
              <>
                <SpinnerGap size={16} weight="regular" className="animate-spin" />
                <span>Merging PDFs...</span>
              </>
            ) : (
              <>
                <ArrowsMerge size={16} weight="regular" />
                <span>Merge {items.length} PDFs & Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
