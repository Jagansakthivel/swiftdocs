import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import {
  FilePdf,
  FileArrowDown,
  Download,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PRESETS = [
  {
    id: "light",
    title: "Light Compression",
    subtitle: "High clarity • Best for text & forms",
    scale: 1.5,
    quality: 0.8,
  },
  {
    id: "balanced",
    title: "Balanced",
    subtitle: "Recommended • Great quality & size",
    scale: 1.15,
    quality: 0.6,
  },
  {
    id: "extreme",
    title: "Extreme Compression",
    subtitle: "Smallest file size • Best for strict limits",
    scale: 0.9,
    quality: 0.4,
  },
];

export default function PdfCompressor() {
  const [file, setFile] = useState(null);
  const [presetId, setPresetId] = useState("balanced");
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFileSelected = (files) => {
    setError("");
    setResult(null);
    setProgress({ current: 0, total: 0 });
    setFile(files[0]);
  };

  const compressPdf = async () => {
    if (!file) return;
    const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[1];

    setIsCompressing(true);
    setError("");
    setResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages });

      const newPdf = await PDFDocument.create();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgress({ current: pageNum, total: totalPages });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: preset.scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        const jpegDataUrl = canvas.toDataURL("image/jpeg", preset.quality);
        const jpegImage = await newPdf.embedJpg(jpegDataUrl);

        const origViewport = page.getViewport({ scale: 1 });
        const newPage = newPdf.addPage([origViewport.width, origViewport.height]);
        newPage.drawImage(jpegImage, {
          x: 0,
          y: 0,
          width: origViewport.width,
          height: origViewport.height,
        });
      }

      const compressedBytes = await newPdf.save();
      const blob = new Blob([compressedBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");

      setResult({
        blob,
        filename: `${baseName}_compressed.pdf`,
        originalSize: file.size,
        compressedSize: blob.size,
        pageCount: totalPages,
      });
    } catch (err) {
      console.error("PDF Compression error:", err);
      setError(
        "Failed to compress this PDF. Make sure it is not password-protected or corrupted."
      );
    } finally {
      setIsCompressing(false);
    }
  };

  const downloadCompressed = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!file) {
    return (
      <Dropzone
        accept=".pdf"
        multiple={false}
        title="Drop a PDF here to compress"
        subtitle="Shrink large scanned or image-heavy PDFs locally in your browser"
        onFilesSelected={handleFileSelected}
      />
    );
  }

  const savedPercent = result
    ? Math.max(
        0,
        Math.round(
          ((result.originalSize - result.compressedSize) / result.originalSize) *
            100
        )
      )
    : 0;

  return (
    <div className="space-y-5">
      {/* 1. File Info Header Strip */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <FilePdf size={18} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {formatBytes(file.size)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFile(null);
            setResult(null);
            setError("");
          }}
          disabled={isCompressing}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] disabled:opacity-40 sm:self-auto"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* 2. Preset Selection Strip */}
      <div className="border-b border-hairline pb-5">
        <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-ink-muted">
          Select Compression Level
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRESETS.map((preset) => {
            const active = preset.id === presetId;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setPresetId(preset.id)}
                disabled={isCompressing}
                className={`flex flex-col justify-between rounded-sharp border p-3.5 text-left transition-all duration-100 active:translate-y-[1px] ${
                  active
                    ? "border-signal bg-signal/10 ring-1 ring-signal"
                    : "border-hairline bg-surface hover:border-ink/40"
                }`}
              >
                <div>
                  <p
                    className={`text-sm font-bold ${
                      active ? "text-signal" : "text-ink"
                    }`}
                  >
                    {preset.title}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {preset.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Progress State */}
      {isCompressing && (
        <div className="border-b border-hairline pb-5">
          <div className="flex items-center justify-between text-xs font-bold tabular-nums text-ink">
            <span className="flex items-center gap-2">
              <SpinnerGap size={16} weight="regular" className="animate-spin text-signal" />
              <span>
                Compressing page {progress.current} of {progress.total}...
              </span>
            </span>
            <span>
              {progress.total > 0
                ? Math.round((progress.current / progress.total) * 100)
                : 0}
              %
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-sharp bg-hairline">
            <div
              className="h-full bg-signal transition-all duration-150"
              style={{
                width: `${
                  progress.total > 0
                    ? (progress.current / progress.total) * 100
                    : 10
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* 4. Feedback Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-3 text-xs font-medium text-signal">
          <WarningCircle size={16} weight="regular" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 5. Result State */}
      {result && (
        <div className="flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={16} weight="regular" className="shrink-0" />
              <span>Compression Complete</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="text-ink-muted line-through">
                {formatBytes(result.originalSize)}
              </span>
              <span className="text-sm font-bold text-ink">
                → {formatBytes(result.compressedSize)}
              </span>
              {savedPercent > 0 ? (
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  (-{savedPercent}%)
                </span>
              ) : (
                <span className="text-ink-muted">(Optimized)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Primary Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {result ? (
          <>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setProgress({ current: 0, total: 0 });
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-signal"
            >
              <ArrowCounterClockwise size={14} weight="regular" />
              <span>Compress Again</span>
            </button>
            <button
              type="button"
              onClick={downloadCompressed}
              className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] dark:text-canvas"
            >
              <Download size={16} weight="regular" />
              <span>Download Compressed PDF</span>
            </button>
          </>
        ) : (
          <div className="ml-auto">
            <button
              type="button"
              onClick={compressPdf}
              disabled={isCompressing}
              className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
            >
              {isCompressing ? (
                <>
                  <SpinnerGap size={16} weight="regular" className="animate-spin" />
                  <span>Compressing PDF...</span>
                </>
              ) : (
                <>
                  <FileArrowDown size={16} weight="regular" />
                  <span>Compress PDF</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
