import { useState, useEffect } from "react";
import { PDFDocument } from "pdf-lib";
import {
  ArrowUp,
  ArrowDown,
  Trash,
  Plus,
  Download,
  DotsSixVertical,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function ImagesToPdf() {
  const [items, setItems] = useState([]);
  const [pageLayout, setPageLayout] = useState("a4"); // 'a4' | 'fit'
  const [marginPreset, setMarginPreset] = useState("small"); // 'none' | 'small' | 'large'
  const [outputName, setOutputName] = useState("SwiftDocs_Images");
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleFilesSelected = (newFiles) => {
    setError("");
    setSuccessMsg("");
    const mapped = newFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...mapped]);
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

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setItems((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDraggedIndex(index);
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
    setSuccessMsg("");
  };

  const imageFileToJpgOrPngBytes = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");

        if (file.type !== "image/png") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const targetMime =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error("Canvas conversion failed"));
            const buffer = await blob.arrayBuffer();
            resolve({
              bytes: buffer,
              isPng: targetMime === "image/png",
            });
          },
          targetMime,
          0.92
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error(`Could not decode ${file.name}`));
      };
      img.src = url;
    });

  const buildPdf = async () => {
    if (items.length === 0) return;
    setIsBuilding(true);
    setError("");
    setSuccessMsg("");

    try {
      const pdfDoc = await PDFDocument.create();
      const A4_W = 595.28;
      const A4_H = 841.89;
      const marginMap = { none: 0, small: 24, large: 54 };
      const margin = marginMap[marginPreset] ?? 24;

      for (const item of items) {
        const { bytes, isPng } = await imageFileToJpgOrPngBytes(item.file);
        const embeddedImg = isPng
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);

        const imgW = embeddedImg.width;
        const imgH = embeddedImg.height;

        if (pageLayout === "fit") {
          const page = pdfDoc.addPage([imgW + margin * 2, imgH + margin * 2]);
          page.drawImage(embeddedImg, {
            x: margin,
            y: margin,
            width: imgW,
            height: imgH,
          });
        } else {
          const isLandscape = imgW > imgH;
          const pageW = isLandscape ? A4_H : A4_W;
          const pageH = isLandscape ? A4_W : A4_H;

          const availW = pageW - margin * 2;
          const availH = pageH - margin * 2;
          const scale = Math.min(availW / imgW, availH / imgH);

          const drawW = imgW * scale;
          const drawH = imgH * scale;
          const x = (pageW - drawW) / 2;
          const y = (pageH - drawH) / 2;

          const page = pdfDoc.addPage([pageW, pageH]);
          page.drawImage(embeddedImg, { x, y, width: drawW, height: drawH });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const cleanName = (outputName.trim() || "SwiftDocs_Images").replace(
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
        `Created "${cleanName}.pdf" (${items.length} pages, ${formatBytes(blob.size)}).`
      );
    } catch (err) {
      console.error("Images to PDF failed:", err);
      setError("Failed to generate PDF from images. Please try again.");
    } finally {
      setIsBuilding(false);
    }
  };

  if (items.length === 0) {
    return (
      <Dropzone
        accept=".jpg,.jpeg,.png,.webp"
        multiple={true}
        title="Drop JPG, PNG, or WebP images here"
        subtitle="Combine multiple photos or scans into one PDF • 100% local"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Settings Bar */}
      <div className="grid gap-3 rounded-sharp border border-hairline bg-canvas p-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-bold text-ink-muted">
            Output Filename
          </label>
          <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 focus-within:border-signal">
            <input
              type="text"
              value={outputName}
              onChange={(e) => setOutputName(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-ink focus:outline-none"
            />
            <span className="ml-1 font-mono text-xs font-bold text-ink-muted">
              .pdf
            </span>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-ink-muted">
            Page Layout
          </label>
          <select
            value={pageLayout}
            onChange={(e) => setPageLayout(e.target.value)}
            className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
          >
            <option value="a4">Standard A4 (Auto-Fit)</option>
            <option value="fit">Original Image Size</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-ink-muted">
            Page Margin
          </label>
          <select
            value={marginPreset}
            onChange={(e) => setMarginPreset(e.target.value)}
            className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
          >
            <option value="none">No Margin (Full Bleed)</option>
            <option value="small">Small Margin</option>
            <option value="large">Wide Margin</option>
          </select>
        </div>
      </div>

      {/* Joined Hairline Reorderable Image List */}
      <div className="divide-y divide-hairline overflow-hidden rounded-sharp border border-hairline bg-surface">
        {items.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => setDraggedIndex(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={() => setDraggedIndex(null)}
            className={`flex items-center justify-between gap-3 p-3.5 transition-colors duration-100 ${
              draggedIndex === index ? "bg-mat opacity-75" : "hover:bg-mat/40"
            }`}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="cursor-grab text-ink-muted hover:text-ink active:cursor-grabbing">
                <DotsSixVertical size={18} weight="bold" />
              </div>

              <span className="w-5 shrink-0 font-mono text-xs font-bold tabular-nums text-ink-muted">
                {index + 1}.
              </span>

              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-11 w-11 shrink-0 rounded-[2px] bg-white object-cover ring-1 ring-black/10"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  {item.file.name}
                </p>
                <p className="text-xs tabular-nums text-ink-muted">
                  Page {index + 1} · {formatBytes(item.file.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                title="Move up"
                className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowUp size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                title="Move down"
                className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowDown size={15} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                title="Remove image"
                className="ml-1 rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-signal/10 hover:text-signal"
              >
                <Trash size={15} weight="regular" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-3 text-xs font-medium text-signal">
          <WarningCircle size={16} weight="bold" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-sharp border border-emerald-600/40 bg-emerald-600/10 px-4 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle size={16} weight="bold" className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sharp border border-hairline bg-surface px-4 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]">
          <Plus size={15} weight="bold" />
          <span>Add More Images</span>
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
            onClick={() => {
              items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
              setItems([]);
              setSuccessMsg("");
            }}
            className="text-xs font-medium text-ink-muted hover:text-signal"
          >
            Clear All
          </button>

          <button
            type="button"
            onClick={buildPdf}
            disabled={isBuilding}
            className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
          >
            {isBuilding ? (
              <>
                <SpinnerGap size={16} weight="bold" className="animate-spin" />
                <span>Building PDF...</span>
              </>
            ) : (
              <>
                <Download size={16} weight="bold" />
                <span>Convert {items.length} Image(s) to PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
