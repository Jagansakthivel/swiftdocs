import { useState } from "react";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import {
  Stamp,
  Download,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

const WATERMARK_COLORS = [
  { id: "slate", label: "Slate Gray", rgb: rgb(0.45, 0.5, 0.58) },
  { id: "red", label: "Signal Vermilion", rgb: rgb(0.85, 0.22, 0.12) },
  { id: "indigo", label: "Cobalt Ink", rgb: rgb(0.1, 0.1, 0.1) },
];

export default function PdfWatermark() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  // Watermark Options
  const [enableWatermark, setEnableWatermark] = useState(true);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [watermarkSize, setWatermarkSize] = useState(48);
  const [watermarkColorId, setWatermarkColorId] = useState("slate");

  // Page Number Options
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [numberFormat, setNumberFormat] = useState("page-of"); // 'page-of' | 'slash' | 'simple'
  const [numberPosition, setNumberPosition] = useState("bottom-center"); // 'bottom-center' | 'bottom-right' | 'top-right'

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    setError("");
    setSuccessMsg("");

    try {
      const arrayBuffer = await selected.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      setFile(selected);
      setPageCount(pdfDoc.getPageCount());
    } catch (err) {
      console.error("Failed to read PDF:", err);
      setError(
        "Could not load this PDF. Make sure it is not password-protected or corrupted."
      );
    }
  };

  const applyAndDownload = async () => {
    if (!file) return;
    if (!enableWatermark && !enablePageNumbers) {
      setError("Please enable at least Watermark or Page Numbers before exporting.");
      return;
    }

    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const helveticaRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const total = pages.length;
      const colorObj =
        WATERMARK_COLORS.find((c) => c.id === watermarkColorId) ||
        WATERMARK_COLORS[0];

      pages.forEach((page, idx) => {
        const { width, height } = page.getSize();

        // 1. Diagonal Center Watermark
        if (enableWatermark && watermarkText.trim()) {
          const text = watermarkText.trim();
          const textWidth = helveticaBold.widthOfTextAtSize(
            text,
            watermarkSize
          );

          // Center diagonal placement at 45 degrees
          const angleRad = (45 * Math.PI) / 180;
          const x =
            width / 2 - (textWidth / 2) * Math.cos(angleRad);
          const y =
            height / 2 - (textWidth / 2) * Math.sin(angleRad);

          page.drawText(text, {
            x,
            y,
            size: watermarkSize,
            font: helveticaBold,
            color: colorObj.rgb,
            opacity: watermarkOpacity,
            rotate: degrees(45),
          });
        }

        // 2. Page Numbering
        if (enablePageNumbers) {
          const current = idx + 1;
          let label = `${current}`;
          if (numberFormat === "page-of") label = `Page ${current} of ${total}`;
          else if (numberFormat === "slash") label = `${current} / ${total}`;

          const fontSize = 10;
          const labelWidth = helveticaRegular.widthOfTextAtSize(label, fontSize);
          const margin = 28;

          let x = width / 2 - labelWidth / 2;
          let y = margin;

          if (numberPosition === "bottom-right") {
            x = width - labelWidth - margin;
            y = margin;
          } else if (numberPosition === "top-right") {
            x = width - labelWidth - margin;
            y = height - margin;
          }

          page.drawText(label, {
            x,
            y,
            size: fontSize,
            font: helveticaRegular,
            color: rgb(0.3, 0.35, 0.42),
          });
        }
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_watermarked.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Exported "${outName}" with watermark & numbering applied (${formatBytes(blob.size)}).`
      );
    } catch (err) {
      console.error("Watermark application failed:", err);
      setError("Failed to apply watermark. Please try again.");
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
          title="Drop a PDF here to stamp watermarks or page numbers"
          subtitle="Add diagonal stamps, confidentiality marks, or automated page numbering • 100% local"
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
          onClick={() => {
            setFile(null);
            setError("");
            setSuccessMsg("");
          }}
          disabled={isProcessing}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] disabled:opacity-40 sm:self-auto"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* 2. Flattened Section: Watermark Settings */}
      <div className="space-y-3 border-b border-hairline pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">
              Diagonal Text Watermark
            </h3>
            <p className="text-xs text-ink-muted">
              Stamps diagonal watermark text across all pages
            </p>
          </div>
          <input
            type="checkbox"
            checked={enableWatermark}
            onChange={(e) => setEnableWatermark(e.target.checked)}
            className="h-4 w-4 accent-[#D9381E] cursor-pointer"
          />
        </div>

        {enableWatermark && (
          <div className="space-y-3 pt-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">
                Watermark Text
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="CONFIDENTIAL, DRAFT, INTERNAL USE..."
                className="w-full rounded-sharp border border-hairline bg-surface px-3.5 py-2 text-sm font-bold text-ink focus:border-signal focus:outline-none"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-muted">
                  Color Tint
                </label>
                <select
                  value={watermarkColorId}
                  onChange={(e) => setWatermarkColorId(e.target.value)}
                  className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
                >
                  {WATERMARK_COLORS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-ink-muted">
                  Opacity: {Math.round(watermarkOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.08"
                  max="0.6"
                  step="0.02"
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-sharp bg-hairline accent-[#D9381E]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Flattened Section: Page Numbering Settings */}
      <div className="space-y-3 border-b border-hairline pb-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink">
              Automatic Page Numbers
            </h3>
            <p className="text-xs text-ink-muted">
              Add clean page numbering headers or footers
            </p>
          </div>
          <input
            type="checkbox"
            checked={enablePageNumbers}
            onChange={(e) => setEnablePageNumbers(e.target.checked)}
            className="h-4 w-4 accent-[#D9381E] cursor-pointer"
          />
        </div>

        {enablePageNumbers && (
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">
                Number Format
              </label>
              <select
                value={numberFormat}
                onChange={(e) => setNumberFormat(e.target.value)}
                className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
              >
                <option value="page-of">Page 1 of {pageCount}</option>
                <option value="slash">1 / {pageCount}</option>
                <option value="simple">1, 2, 3...</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink-muted">
                Position
              </label>
              <select
                value={numberPosition}
                onChange={(e) => setNumberPosition(e.target.value)}
                className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
              >
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="top-right">Top Right</option>
              </select>
            </div>
          </div>
        )}
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

      {/* 5. Primary CTA Action Bar */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={applyAndDownload}
          disabled={isProcessing || (!enableWatermark && !enablePageNumbers)}
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          {isProcessing ? (
            <>
              <SpinnerGap size={16} weight="regular" className="animate-spin" />
              <span>Applying Stamps...</span>
            </>
          ) : (
            <>
              <Download size={16} weight="regular" />
              <span>Apply & Download PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
