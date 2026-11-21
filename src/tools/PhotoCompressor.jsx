import { useState, useEffect } from "react";
import { zipSync } from "fflate";
import {
  Download,
  Archive,
  Trash,
  Plus,
  SlidersHorizontal,
  Target,
  SpinnerGap,
  CheckCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function PhotoCompressor() {
  const [items, setItems] = useState([]);
  const [mode, setMode] = useState("target"); // 'target' | 'quality'
  const [targetKb, setTargetKb] = useState(50);
  const [quality, setQuality] = useState(75);
  const [outputFormat, setOutputFormat] = useState("original");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
      });
    };
  }, []);

  const resolveMimeType = (file, fmt) => {
    if (fmt === "image/jpeg" || fmt === "image/webp") return fmt;
    return file.type === "image/webp" ? "image/webp" : "image/jpeg";
  };

  const compressImageFile = (file, currentMode, kbLimit, qPct, fmt) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = async () => {
        const mime = resolveMimeType(file, fmt);
        const ext = mime === "image/webp" ? "webp" : "jpg";
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const outputName = `${baseName}_compressed.${ext}`;

        const renderAtScaleAndQuality = (scale, q) =>
          new Promise((res) => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const ctx = canvas.getContext("2d");

            if (mime === "image/jpeg") {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => res(blob), mime, q);
          });

        let finalBlob;

        if (currentMode === "quality") {
          finalBlob = await renderAtScaleAndQuality(1, qPct / 100);
        } else {
          const targetBytes = Math.max(5, Number(kbLimit) || 50) * 1024;
          let scale = 1.0;
          let bestBlob = null;

          for (let step = 0; step < 5; step++) {
            let low = 0.08;
            let high = 0.95;
            for (let i = 0; i < 6; i++) {
              const mid = (low + high) / 2;
              const candidate = await renderAtScaleAndQuality(scale, mid);
              if (!bestBlob || candidate.size < bestBlob.size) {
                bestBlob = candidate;
              }
              if (candidate.size <= targetBytes) {
                bestBlob = candidate;
                low = mid;
              } else {
                high = mid;
              }
            }
            if (bestBlob && bestBlob.size <= targetBytes) break;
            scale *= 0.72;
          }
          finalBlob = bestBlob;
        }

        URL.revokeObjectURL(url);
        resolve({
          outputBlob: finalBlob,
          outputUrl: URL.createObjectURL(finalBlob),
          outputName,
          status: "done",
        });
      };
      img.src = url;
    });

  const handleFilesSelected = async (newFiles) => {
    setIsProcessing(true);
    const initialized = newFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      outputBlob: null,
      outputUrl: null,
      outputName: file.name,
      status: "processing",
    }));

    setItems((prev) => [...prev, ...initialized]);

    const processed = await Promise.all(
      initialized.map(async (it) => {
        const res = await compressImageFile(
          it.file,
          mode,
          targetKb,
          quality,
          outputFormat
        );
        return { ...it, ...res };
      })
    );

    setItems((prev) =>
      prev.map((existing) => {
        const match = processed.find((p) => p.id === existing.id);
        return match || existing;
      })
    );
    setIsProcessing(false);
  };

  const recompressAll = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setItems((prev) => prev.map((it) => ({ ...it, status: "processing" })));

    const updated = await Promise.all(
      items.map(async (it) => {
        if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
        const res = await compressImageFile(
          it.file,
          mode,
          targetKb,
          quality,
          outputFormat
        );
        return { ...it, ...res };
      })
    );

    setItems(updated);
    setIsProcessing(false);
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.outputUrl) URL.revokeObjectURL(target.outputUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const downloadSingle = (item) => {
    if (!item.outputBlob) return;
    const url = URL.createObjectURL(item.outputBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.outputName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllZip = async () => {
    const ready = items.filter((i) => i.outputBlob);
    if (ready.length === 0) return;
    setIsZipping(true);
    try {
      const zipFiles = {};
      for (const it of ready) {
        const buf = await it.outputBlob.arrayBuffer();
        zipFiles[it.outputName] = new Uint8Array(buf);
      }
      const zipped = zipSync(zipFiles, { level: 1 });
      const blob = new Blob([zipped], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SwiftDocs_Compressed_Photos.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept=".jpg,.jpeg,.png,.webp"
        multiple={true}
        title="Drop JPG, PNG, or WebP photos here"
        subtitle="Compress to an exact KB target or custom quality percentage • 100% local"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="space-y-4 rounded-sharp border border-hairline bg-canvas p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Raised Segmented Switch inside Recessed Mat */}
          <div className="mat-recessed inline-flex rounded-sharp border border-hairline p-1">
            <button
              type="button"
              onClick={() => setMode("target")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                mode === "target"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <Target size={14} weight="bold" />
              <span>Target Size (KB)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("quality")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                mode === "quality"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <SlidersHorizontal size={14} weight="bold" />
              <span>Quality Slider</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-ink-muted">Format:</label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="rounded-sharp border border-hairline bg-surface px-2.5 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
            >
              <option value="original">Keep Original</option>
              <option value="image/jpeg">JPG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
        </div>

        {/* Mode Inputs */}
        {mode === "target" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 focus-within:border-signal">
                <input
                  type="number"
                  min="5"
                  max="10000"
                  value={targetKb}
                  onChange={(e) => setTargetKb(e.target.value)}
                  className="w-20 bg-transparent text-xs font-bold tabular-nums text-ink focus:outline-none"
                />
                <span className="font-mono text-xs font-bold text-ink-muted">
                  KB
                </span>
              </div>

              {[50, 100, 200, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTargetKb(preset)}
                  className={`rounded-sharp border px-2.5 py-1.5 font-mono text-xs font-bold tabular-nums transition-all duration-100 active:translate-y-[1px] ${
                    Number(targetKb) === preset
                      ? "border-signal bg-signal text-white dark:text-canvas"
                      : "border-hairline bg-surface text-ink-muted hover:text-ink"
                  }`}
                >
                  {preset} KB
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={recompressAll}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
            >
              <ArrowsClockwise size={14} weight="bold" />
              <span>{isProcessing ? "Compressing..." : "Apply to All"}</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-t border-hairline pt-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <span className="w-24 font-mono text-xs font-bold tabular-nums text-ink">
                Quality: {quality}%
              </span>
              <input
                type="range"
                min="10"
                max="95"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-sharp bg-hairline accent-[#D9381E]"
              />
            </div>

            <button
              type="button"
              onClick={recompressAll}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
            >
              <ArrowsClockwise size={14} weight="bold" />
              <span>{isProcessing ? "Compressing..." : "Apply to All"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Joined Hairline Image Results List */}
      <div className="divide-y divide-hairline overflow-hidden rounded-sharp border border-hairline bg-surface">
        {items.map((item) => {
          const origSize = item.file.size;
          const newSize = item.outputBlob?.size || origSize;
          const savedPct =
            item.status === "done"
              ? Math.max(0, Math.round(((origSize - newSize) / origSize) * 100))
              : 0;

          return (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={item.outputUrl || item.previewUrl}
                  alt={item.outputName}
                  className="h-12 w-12 shrink-0 rounded-[2px] bg-white object-cover ring-1 ring-black/10"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">
                    {item.outputName}
                  </p>
                  {item.status === "processing" ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-signal">
                      <SpinnerGap size={13} weight="bold" className="animate-spin" />
                      Compressing...
                    </p>
                  ) : (
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs tabular-nums text-ink-muted">
                      <span>{formatBytes(origSize)}</span>
                      <span>→</span>
                      <span className="font-bold text-ink">
                        {formatBytes(newSize)}
                      </span>
                      {savedPct > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle size={13} weight="bold" />
                          -{savedPct}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => downloadSingle(item)}
                  disabled={item.status !== "done"}
                  className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-canvas px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:border-signal hover:text-signal active:translate-y-[1px] disabled:opacity-40"
                >
                  <Download size={14} weight="bold" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-signal/10 hover:text-signal"
                >
                  <Trash size={15} weight="regular" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sharp border border-hairline bg-surface px-4 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]">
          <Plus size={15} weight="bold" />
          <span>Add More Photos</span>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
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
            onClick={() => setItems([])}
            className="text-xs font-medium text-ink-muted hover:text-signal"
          >
            Clear All
          </button>

          {items.length > 1 && (
            <button
              type="button"
              onClick={downloadAllZip}
              disabled={isZipping || isProcessing}
              className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
            >
              <Archive size={16} weight="bold" />
              <span>
                {isZipping
                  ? "Bundling ZIP..."
                  : `Download All (${items.length}) as ZIP`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
