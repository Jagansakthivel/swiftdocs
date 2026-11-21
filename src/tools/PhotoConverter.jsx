import { useState, useEffect } from "react";
import { zipSync } from "fflate";
import {
  Download,
  Archive,
  Trash,
  Plus,
  LockSimple,
  LockSimpleOpen,
  ArrowsClockwise,
  SpinnerGap,
  Image,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function PhotoConverter() {
  const [items, setItems] = useState([]);
  const [targetFormat, setTargetFormat] = useState("image/webp");
  const [resizeMode, setResizeMode] = useState("original");
  const [scalePercent, setScalePercent] = useState(50);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [lockAspect, setLockAspect] = useState(true);
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

  const loadImageDimensions = (file) =>
    new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          previewUrl: url,
        });
      };
      img.onerror = () => {
        resolve({ width: 800, height: 600, previewUrl: url });
      };
      img.src = url;
    });

  const processSingleImage = (
    item,
    fmt,
    rMode,
    pct,
    wPx,
    hPx,
    keepRatio
  ) =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        let outW = img.naturalWidth;
        let outH = img.naturalHeight;

        if (rMode === "percent") {
          const factor = Math.max(5, Math.min(300, Number(pct) || 100)) / 100;
          outW = Math.max(1, Math.round(img.naturalWidth * factor));
          outH = Math.max(1, Math.round(img.naturalHeight * factor));
        } else if (rMode === "exact") {
          const reqW = Math.max(1, Number(wPx) || img.naturalWidth);
          const reqH = Math.max(1, Number(hPx) || img.naturalHeight);
          if (keepRatio) {
            const ratio = img.naturalHeight / img.naturalWidth;
            outW = reqW;
            outH = Math.max(1, Math.round(reqW * ratio));
          } else {
            outW = reqW;
            outH = reqH;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");

        if (fmt === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, outW, outH);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, outW, outH);

        canvas.toBlob(
          (blob) => {
            const extMap = {
              "image/jpeg": "jpg",
              "image/png": "png",
              "image/webp": "webp",
            };
            const ext = extMap[fmt] || "png";
            const baseName = item.file.name.replace(/\.[^/.]+$/, "");
            const outputName = `${baseName}_${outW}x${outH}.${ext}`;

            resolve({
              outputBlob: blob,
              outputUrl: URL.createObjectURL(blob),
              outputName,
              outWidth: outW,
              outHeight: outH,
              status: "done",
            });
          },
          fmt,
          0.92
        );
      };
      img.src = item.previewUrl;
    });

  const handleFilesSelected = async (newFiles) => {
    setIsProcessing(true);

    const initialized = await Promise.all(
      newFiles.map(async (file, idx) => {
        const dims = await loadImageDimensions(file);
        return {
          id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          origWidth: dims.width,
          origHeight: dims.height,
          previewUrl: dims.previewUrl,
          outputBlob: null,
          outputUrl: null,
          outputName: file.name,
          outWidth: dims.width,
          outHeight: dims.height,
          status: "processing",
        };
      })
    );

    if (items.length === 0 && initialized.length > 0) {
      setCustomWidth(initialized[0].origWidth);
      setCustomHeight(initialized[0].origHeight);
    }

    setItems((prev) => [...prev, ...initialized]);

    const processed = await Promise.all(
      initialized.map(async (it) => {
        const res = await processSingleImage(
          it,
          targetFormat,
          resizeMode,
          scalePercent,
          customWidth,
          customHeight,
          lockAspect
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

  const applyToAll = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setItems((prev) => prev.map((it) => ({ ...it, status: "processing" })));

    const updated = await Promise.all(
      items.map(async (it) => {
        if (it.outputUrl) URL.revokeObjectURL(it.outputUrl);
        const res = await processSingleImage(
          it,
          targetFormat,
          resizeMode,
          scalePercent,
          customWidth,
          customHeight,
          lockAspect
        );
        return { ...it, ...res };
      })
    );

    setItems(updated);
    setIsProcessing(false);
  };

  const handleWidthChange = (val) => {
    const num = Number(val) || 0;
    setCustomWidth(val);
    if (lockAspect && items[0]?.origWidth && num > 0) {
      const ratio = items[0].origHeight / items[0].origWidth;
      setCustomHeight(Math.round(num * ratio));
    }
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
      a.download = "SwiftDocs_Converted_Photos.zip";
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
        title="Drop images to convert format or resize"
        subtitle="Bulk convert JPG, PNG, WebP & resize pixel dimensions locally"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Flattened Settings Section */}
      <div className="space-y-4 border-b border-hairline pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted">
              Convert Format To
            </label>
            <select
              value={targetFormat}
              onChange={(e) => setTargetFormat(e.target.value)}
              className="w-full rounded-sharp border border-hairline bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-signal focus:outline-none"
            >
              <option value="image/webp">WebP (Smallest Web Format)</option>
              <option value="image/jpeg">JPG / JPEG (Universal Photo)</option>
              <option value="image/png">PNG (Lossless + Transparency)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted">
              Resize Mode
            </label>
            <select
              value={resizeMode}
              onChange={(e) => setResizeMode(e.target.value)}
              className="w-full rounded-sharp border border-hairline bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-signal focus:outline-none"
            >
              <option value="original">Keep Original Dimensions</option>
              <option value="percent">Scale by Percentage (%)</option>
              <option value="exact">Exact Pixel Dimensions (W × H)</option>
            </select>
          </div>
        </div>

        {resizeMode === "percent" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3.5">
            <span className="text-xs font-bold text-ink-muted">Scale:</span>
            {[25, 50, 75, 150].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setScalePercent(pct)}
                className={`rounded-sharp border px-2.5 py-1 font-mono text-xs font-bold tabular-nums transition-all duration-100 active:translate-y-[1px] ${
                  Number(scalePercent) === pct
                    ? "border-signal bg-signal text-white dark:text-canvas"
                    : "border-hairline bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {pct}%
              </button>
            ))}
            <div className="flex items-center rounded-sharp border border-hairline bg-surface px-2.5 py-1 focus-within:border-signal">
              <input
                type="number"
                min="5"
                max="300"
                value={scalePercent}
                onChange={(e) => setScalePercent(e.target.value)}
                className="w-14 bg-transparent text-xs font-bold tabular-nums text-ink focus:outline-none"
              />
              <span className="font-mono text-xs font-bold text-ink-muted">
                %
              </span>
            </div>
          </div>
        )}

        {resizeMode === "exact" && (
          <div className="space-y-3 border-t border-hairline pt-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 focus-within:border-signal">
                <span className="mr-1.5 font-mono text-[11px] font-bold text-ink-muted">
                  W
                </span>
                <input
                  type="number"
                  min="1"
                  value={customWidth}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-20 bg-transparent text-xs font-bold tabular-nums text-ink focus:outline-none"
                />
                <span className="font-mono text-[11px] text-ink-muted">px</span>
              </div>

              <button
                type="button"
                onClick={() => setLockAspect(!lockAspect)}
                title={
                  lockAspect ? "Aspect ratio locked" : "Aspect ratio unlocked"
                }
                className={`rounded-sharp border p-2 transition-all duration-100 active:translate-y-[1px] ${
                  lockAspect
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-hairline bg-surface text-ink-muted hover:text-ink"
                }`}
              >
                {lockAspect ? (
                  <LockSimple size={14} weight="regular" />
                ) : (
                  <LockSimpleOpen size={14} weight="regular" />
                )}
              </button>

              <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 focus-within:border-signal">
                <span className="mr-1.5 font-mono text-[11px] font-bold text-ink-muted">
                  H
                </span>
                <input
                  type="number"
                  min="1"
                  value={customHeight}
                  disabled={lockAspect}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  className="w-20 bg-transparent text-xs font-bold tabular-nums text-ink focus:outline-none disabled:opacity-50"
                />
                <span className="font-mono text-[11px] text-ink-muted">px</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-ink-muted">
                Presets:
              </span>
              {[
                { label: "Square 1080×1080", w: 1080, h: 1080 },
                { label: "Full HD 1920×1080", w: 1920, h: 1080 },
                { label: "Passport 413×531", w: 413, h: 531 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setLockAspect(false);
                    setCustomWidth(preset.w);
                    setCustomHeight(preset.h);
                  }}
                  className="rounded-sharp border border-hairline bg-surface px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums text-ink-muted transition-all duration-100 hover:border-signal hover:text-signal active:translate-y-[1px]"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={applyToAll}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
          >
            <ArrowsClockwise size={14} weight="regular" />
            <span>
              {isProcessing ? "Processing..." : "Convert & Resize All"}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Joined Hairline Results List */}
      <div className="divide-y divide-hairline overflow-hidden rounded-sharp border border-hairline bg-surface">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-center gap-3">
              {/* 36px x 36px standardized thumbnail container */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sharp border border-hairline bg-canvas">
                <img
                  src={item.outputUrl || item.previewUrl}
                  alt={item.outputName}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {item.outputName}
                </p>
                {item.status === "processing" ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-signal">
                    <SpinnerGap size={13} weight="regular" className="animate-spin" />
                    Converting...
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {item.origWidth}×{item.origHeight} →{" "}
                    <span className="font-bold text-ink">
                      {item.outWidth}×{item.outHeight} px
                    </span>{" "}
                    · {formatBytes(item.outputBlob?.size || item.file.size)}
                  </p>
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
                <Download size={14} weight="regular" />
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
        ))}
      </div>

      {/* 3. Footer Actions Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sharp border border-hairline bg-surface px-4 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]">
          <Plus size={15} weight="regular" />
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
              className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
            >
              <Archive size={16} weight="regular" />
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
