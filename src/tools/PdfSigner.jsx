import { useState, useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import {
  Signature,
  Download,
  Trash,
  UploadSimple,
  PencilSimple,
  TextT,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfSigner() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Signature creation mode: 'draw' | 'type' | 'upload'
  const [sigMode, setSigMode] = useState("draw");
  const [typedName, setTypedName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);

  // Signature placement on PDF page preview (percentage 0..100)
  const [sigPos, setSigPos] = useState({ x: 50, y: 80 }); // center-ish near bottom
  const [sigScale, setSigScale] = useState(100); // 50% to 150%
  const [isDraggingSig, setIsDraggingSig] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const drawCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const pageCanvasRef = useRef(null);
  const pageContainerRef = useRef(null);

  // Load PDF when file selected
  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    setFile(selected);
    setError("");
    setSuccessMsg("");

    try {
      const buffer = await selected.arrayBuffer();
      setRawBytes(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
    } catch (err) {
      console.error("PDF load error:", err);
      setError("Failed to load PDF. Please make sure the file is valid.");
      setFile(null);
    }
  };

  // Render current PDF page in canvas
  useEffect(() => {
    if (!pdfDoc || !pageCanvasRef.current) return;
    let isCancelled = false;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.0 });
        const canvas = pageCanvasRef.current;
        if (!canvas || isCancelled) return;

        const ctx = canvas.getContext("2d");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error("Render page error:", err);
      }
    }

    renderPage();
    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, currentPage]);

  // Drawing canvas logic
  useEffect(() => {
    if (sigMode !== "draw" || !drawCanvasRef.current) return;
    const canvas = drawCanvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#181715";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [sigMode]);

  const startDrawing = (e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const drawMove = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const canvas = drawCanvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setSignatureDataUrl(null);
  };

  // Typed signature generation
  const handleTypedChange = (val) => {
    setTypedName(val);
    if (!val.trim()) {
      setHasSignature(false);
      setSignatureDataUrl(null);
      return;
    }
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 400;
    tempCanvas.height = 140;
    const ctx = tempCanvas.getContext("2d");
    ctx.font = "italic 44px 'Brush Script MT', 'Dancing Script', cursive, sans-serif";
    ctx.fillStyle = "#181715";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(val.trim(), 200, 70);
    setSignatureDataUrl(tempCanvas.toDataURL("image/png"));
    setHasSignature(true);
  };

  // Uploaded signature image
  const handleSignatureUpload = (e) => {
    const uploadFile = e.target.files?.[0];
    if (!uploadFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      setSignatureDataUrl(reader.result);
      setHasSignature(true);
    };
    reader.readAsDataURL(uploadFile);
    e.target.value = "";
  };

  // Dragging placement on preview
  const handlePagePointerDown = (e) => {
    if (!hasSignature || !pageContainerRef.current) return;
    setIsDraggingSig(true);
    updateSigPositionFromPointer(e);
  };

  const updateSigPositionFromPointer = (e) => {
    if (!pageContainerRef.current) return;
    const rect = pageContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;

    const xPct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    setSigPos({ x: Math.round(xPct), y: Math.round(yPct) });
  };

  // Stamp signature onto PDF
  const handleStampAndDownload = async () => {
    if (!rawBytes || !signatureDataUrl || !file) return;
    setIsProcessing(true);
    setError("");
    setSuccessMsg("");

    try {
      const pdfLibDoc = await PDFDocument.load(rawBytes, { ignoreEncryption: true });
      const pages = pdfLibDoc.getPages();
      const targetPage = pages[currentPage - 1];
      if (!targetPage) throw new Error("Target page not found.");

      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      // Convert data URL to PNG bytes
      const base64Data = signatureDataUrl.split(",")[1];
      const binaryStr = window.atob(base64Data);
      const sigBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        sigBytes[i] = binaryStr.charCodeAt(i);
      }

      const embeddedSig = await pdfLibDoc.embedPng(sigBytes);
      const baseSigW = 160 * (sigScale / 100);
      const baseSigH = (baseSigW / embeddedSig.width) * embeddedSig.height;

      // Position: sigPos.x and sigPos.y are centers in percent
      const centerXPts = (sigPos.x / 100) * pageWidth;
      const centerYPtsFromTop = (sigPos.y / 100) * pageHeight;

      // In PDF, Y=0 is bottom
      const x = Math.max(0, centerXPts - baseSigW / 2);
      const y = Math.max(0, pageHeight - centerYPtsFromTop - baseSigH / 2);

      targetPage.drawImage(embeddedSig, {
        x,
        y,
        width: baseSigW,
        height: baseSigH,
      });

      const outPdfBytes = await pdfLibDoc.save();
      const blob = new Blob([outPdfBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_signed.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Stamped signature onto Page ${currentPage} and downloaded "${outName}" (${formatBytes(blob.size)}).`
      );
    } catch (err) {
      console.error("Sign PDF error:", err);
      setError("Failed to stamp signature onto PDF. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setRawBytes(null);
    setPdfDoc(null);
    setNumPages(0);
    setCurrentPage(1);
    setHasSignature(false);
    setSignatureDataUrl(null);
    setTypedName("");
    setError("");
    setSuccessMsg("");
  };

  if (!file) {
    return (
      <Dropzone
        accept=".pdf"
        multiple={false}
        title="Drop a PDF here to sign"
        subtitle="Draw, type, or upload your signature and stamp it locally • 100% browser-local"
        onFilesSelected={handleFileSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Header Strip: File Info & Change PDF */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <Signature size={18} weight="regular" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {numPages} {numPages === 1 ? "page" : "pages"} · {formatBytes(file.size)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] sm:self-auto"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* 2. Signature Creator Strip */}
      <div className="space-y-3.5 border-b border-hairline pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-sharp border border-hairline bg-canvas p-1">
            <button
              type="button"
              onClick={() => setSigMode("draw")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                sigMode === "draw"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <PencilSimple size={14} weight="regular" />
              <span>Draw</span>
            </button>
            <button
              type="button"
              onClick={() => setSigMode("type")}
              className={`inline-flex items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                sigMode === "type"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <TextT size={14} weight="regular" />
              <span>Type</span>
            </button>
            <label
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-sharp px-3 py-1.5 text-xs transition-all duration-100 ${
                sigMode === "upload"
                  ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                  : "font-medium text-ink-muted hover:text-ink"
              }`}
            >
              <UploadSimple size={14} weight="regular" />
              <span>Upload Image</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  setSigMode("upload");
                  handleSignatureUpload(e);
                }}
                className="hidden"
              />
            </label>
          </div>

          {hasSignature && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-ink-muted">Stamp Size:</label>
              <div className="flex items-center gap-1">
                {[75, 100, 125].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSigScale(s)}
                    className={`rounded-sharp border px-2 py-1 font-mono text-[11px] font-bold tabular-nums transition-all ${
                      sigScale === s
                        ? "border-signal bg-signal text-white dark:text-canvas"
                        : "border-hairline bg-surface text-ink-muted hover:text-ink"
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Signature input panels */}
        {sigMode === "draw" && (
          <div className="relative rounded-sharp border border-hairline bg-canvas p-2">
            <canvas
              ref={drawCanvasRef}
              width={500}
              height={120}
              onMouseDown={startDrawing}
              onMouseMove={drawMove}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={drawMove}
              onTouchEnd={stopDrawing}
              className="h-[100px] w-full cursor-crosshair rounded-[2px] bg-white ring-1 ring-black/10 touch-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-ink-muted">
                Draw your signature on the pad above
              </span>
              <button
                type="button"
                onClick={clearCanvas}
                className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-signal"
              >
                <Trash size={13} weight="regular" />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {sigMode === "type" && (
          <div>
            <label className="mb-1 block text-xs font-bold text-ink-muted">
              Enter Name for Script Signature
            </label>
            <input
              type="text"
              value={typedName}
              onChange={(e) => handleTypedChange(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-sharp border border-hairline bg-surface px-3.5 py-2 text-sm text-ink focus:border-signal focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 3. Interactive Page Preview & Signature Stamp Placement */}
      <div className="space-y-3 border-b border-hairline pb-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Click or Drag to Position Signature on Page
          </span>

          {numPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-sharp p-1 text-ink-muted hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowLeft size={14} weight="regular" />
              </button>
              <span className="font-mono text-xs font-bold tabular-nums text-ink">
                Page {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="rounded-sharp p-1 text-ink-muted hover:bg-mat hover:text-ink disabled:opacity-30"
              >
                <ArrowRight size={14} weight="regular" />
              </button>
            </div>
          )}
        </div>

        {/* Drafting Mat with rendered PDF page */}
        <div className="mat-recessed flex max-h-[500px] overflow-auto rounded-sharp border border-hairline p-4 justify-center">
          <div
            ref={pageContainerRef}
            onClick={handlePagePointerDown}
            className="relative cursor-pointer rounded-[2px] bg-white shadow-md ring-1 ring-black/10 select-none"
          >
            <canvas ref={pageCanvasRef} className="block max-w-full h-auto" />

            {/* Floating Signature Stamp Marker */}
            {hasSignature && signatureDataUrl && (
              <div
                style={{
                  left: `${sigPos.x}%`,
                  top: `${sigPos.y}%`,
                  transform: `translate(-50%, -50%) scale(${sigScale / 100})`,
                }}
                className="pointer-events-none absolute cursor-move rounded-[2px] border border-dashed border-signal bg-signal/5 p-1 transition-transform"
              >
                <img
                  src={signatureDataUrl}
                  alt="Signature"
                  className="h-10 max-w-[160px] object-contain"
                />
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[2px] bg-ink/80 px-1 font-mono text-[9px] text-surface">
                  Stamp Location
                </span>
              </div>
            )}
          </div>
        </div>
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
          onClick={handleStampAndDownload}
          disabled={isProcessing || !hasSignature}
          className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
        >
          {isProcessing ? (
            <>
              <SpinnerGap size={16} weight="regular" className="animate-spin" />
              <span>Stamping Signature...</span>
            </>
          ) : (
            <>
              <Signature size={16} weight="regular" />
              <span>Stamp Signature & Download PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
