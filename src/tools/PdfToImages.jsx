import { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { zipSync } from "fflate";
import {
  FileImage,
  Download,
  Archive,
  SpinnerGap,
  WarningCircle,
  ArrowCounterClockwise,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfToImages() {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("image/jpeg");
  const [scale, setScale] = useState(2);
  const [pages, setPages] = useState([]);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isZipping, setIsZipping] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      pages.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, [pages]);

  const clearRenderedPages = () => {
    pages.forEach((p) => {
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    });
    setPages([]);
  };

  const renderPdfToImages = async (targetFile, targetFormat, targetScale) => {
    if (!targetFile) return;
    setIsRendering(true);
    setError("");
    clearRenderedPages();

    try {
      const arrayBuffer = await targetFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages });

      const extMap = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const ext = extMap[targetFormat] || "jpg";
      const baseName = targetFile.name.replace(/\.pdf$/i, "");

      const renderedList = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgress({ current: pageNum, total: totalPages });

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: targetScale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, targetFormat, 0.92)
        );

        const padNum = String(pageNum).padStart(
          String(totalPages).length,
          "0"
        );
        const filename = `${baseName}_page_${padNum}.${ext}`;

        renderedList.push({
          pageNum,
          blob,
          previewUrl: URL.createObjectURL(blob),
          filename,
        });
      }

      await pdf.destroy();
      setPages(renderedList);
    } catch (err) {
      console.error("PDF to Images failed:", err);
      setError(
        "Failed to render PDF pages. Make sure the file is not password-protected or corrupted."
      );
    } finally {
      setIsRendering(false);
    }
  };

  const handleFileSelected = (files) => {
    const selected = files[0];
    if (!selected) return;
    setFile(selected);
    renderPdfToImages(selected, format, scale);
  };

  const downloadSingle = (pageItem) => {
    const url = URL.createObjectURL(pageItem.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pageItem.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = async () => {
    if (pages.length === 0) return;
    setIsZipping(true);
    try {
      const zipFiles = {};
      for (const p of pages) {
        const buf = await p.blob.arrayBuffer();
        zipFiles[p.filename] = new Uint8Array(buf);
      }
      const zipped = zipSync(zipFiles, { level: 1 });
      const zipBlob = new Blob([zipped], { type: "application/zip" });
      const baseName = file.name.replace(/\.pdf$/i, "");

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_images.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  if (!file) {
    return (
      <Dropzone
        accept=".pdf"
        multiple={false}
        title="Drop a PDF here to convert pages into images"
        subtitle="Export every PDF page as crisp JPG, PNG, or WebP • 100% local"
        onFilesSelected={handleFileSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-sharp border border-hairline bg-canvas p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-surface text-signal">
              <FileImage size={20} weight="bold" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{file.name}</p>
              <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                {formatBytes(file.size)} · {pages.length} page(s) rendered
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              clearRenderedPages();
              setFile(null);
              setError("");
            }}
            disabled={isRendering}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] disabled:opacity-50 sm:self-auto"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
            <span>Change PDF</span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 border-t border-hairline pt-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted">
              Image Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              disabled={isRendering}
              className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
            >
              <option value="image/jpeg">JPG (Compact & Universal)</option>
              <option value="image/png">PNG (Lossless Sharpness)</option>
              <option value="image/webp">WebP (Modern & Light)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted">
              Resolution Quality
            </label>
            <select
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              disabled={isRendering}
              className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
            >
              <option value={1.5}>Standard (1.5x DPI)</option>
              <option value={2}>High HD (2.0x DPI)</option>
              <option value={3}>Ultra Crisp (3.0x DPI)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => renderPdfToImages(file, format, scale)}
              disabled={isRendering}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-sharp bg-signal px-4 py-1.5 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 sm:h-[32px] dark:text-canvas"
            >
              <ArrowsClockwise size={14} weight="bold" />
              <span>Re-render</span>
            </button>
          </div>
        </div>
      </div>

      {isRendering && (
        <div className="mat-recessed flex items-center justify-center gap-2.5 rounded-sharp border border-hairline py-8 text-xs font-bold tabular-nums text-ink">
          <SpinnerGap size={18} weight="bold" className="animate-spin text-signal" />
          <span>
            Rendering page {progress.current} of {progress.total}...
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-3 text-xs font-medium text-signal">
          <WarningCircle size={16} weight="bold" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {pages.length > 0 && !isRendering && (
        <>
          <div className="mat-recessed rounded-sharp border border-hairline p-4">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              {pages.map((p) => (
                <div
                  key={p.pageNum}
                  className="flex flex-col justify-between rounded-sharp border border-hairline bg-surface p-2.5"
                >
                  <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[2px] bg-white ring-1 ring-black/10">
                    <img
                      src={p.previewUrl}
                      alt={`Page ${p.pageNum}`}
                      className="h-full w-full object-contain p-1.5"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-[2px] bg-ink/85 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-surface">
                      Page {p.pageNum}
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium tabular-nums text-ink-muted">
                      {formatBytes(p.blob.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadSingle(p)}
                      className="inline-flex items-center gap-1 rounded-sharp border border-hairline bg-canvas px-2.5 py-1 text-xs font-bold text-ink transition-all duration-100 ease-out hover:border-signal hover:text-signal active:translate-y-[1px]"
                    >
                      <Download size={12} weight="bold" />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {pages.length > 1 && (
            <div className="flex justify-end border-t border-hairline pt-4">
              <button
                type="button"
                onClick={downloadAllZip}
                disabled={isZipping}
                className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
              >
                <Archive size={16} weight="bold" />
                <span>
                  {isZipping
                    ? "Bundling ZIP..."
                    : `Download All ${pages.length} Images as ZIP`}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
