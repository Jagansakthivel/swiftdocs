import { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { PDFDocument } from "pdf-lib";
import {
  LockOpen,
  LockKey,
  Eye,
  EyeSlash,
  Download,
  WarningCircle,
  SpinnerGap,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfUnlocker() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const resetAll = () => {
    setFile(null);
    setRawBytes(null);
    setIsEncrypted(false);
    setPageCount(0);
    setPassword("");
    setShowPassword(false);
    setError("");
    setSuccessMsg("");
  };

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    resetAll();
    setFile(selected);

    try {
      const buffer = await selected.arrayBuffer();
      setRawBytes(buffer);

      // Probe with pdf.js to detect if a user password is required
      const probeCopy = buffer.slice(0);
      const loadingTask = pdfjsLib.getDocument({ data: probeCopy });
      const doc = await loadingTask.promise;

      setPageCount(doc.numPages);
      setIsEncrypted(false);
      await doc.destroy();
    } catch (err) {
      if (err?.name === "PasswordException") {
        setIsEncrypted(true);
      } else {
        console.error("Failed to probe PDF:", err);
        setError("Could not read this PDF. The file may be damaged.");
        setFile(null);
      }
    }
  };

  const handleUnlockAndDownload = async (e) => {
    if (e) e.preventDefault();
    if (!rawBytes || !file) return;

    if (isEncrypted && !password) {
      setError("Please enter the PDF password first.");
      return;
    }

    setIsUnlocking(true);
    setError("");
    setSuccessMsg("");

    try {
      // 1. Verify password via pdf.js first (supports AES-256 & RC4)
      const verifyCopy = rawBytes.slice(0);
      const loadingTask = pdfjsLib.getDocument({
        data: verifyCopy,
        password: password || undefined,
      });
      const verifiedDoc = await loadingTask.promise;
      const totalPages = verifiedDoc.numPages;

      // 2. Try direct structural decryption via pdf-lib (preserves selectable vector text)
      let outputBytes;
      try {
        const pdfLibDoc = await PDFDocument.load(rawBytes.slice(0), {
          password: password || undefined,
          ignoreEncryption: true,
        });
        outputBytes = await pdfLibDoc.save();
      } catch {
        // Fallback for AES-256 PDFs not supported by pdf-lib's parser:
        // Reconstruct clean unencrypted pages at 2x HD resolution
        const rebuiltPdf = await PDFDocument.create();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        for (let p = 1; p <= totalPages; p++) {
          const page = await verifiedDoc.getPage(p);
          const viewport = page.getViewport({ scale: 2.0 });
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;

          const jpgBlob = await new Promise((res) =>
            canvas.toBlob(res, "image/jpeg", 0.92)
          );
          const jpgBytes = await jpgBlob.arrayBuffer();
          const jpgImg = await rebuiltPdf.embedJpg(jpgBytes);

          const origViewport = page.getViewport({ scale: 1.0 });
          const newPage = rebuiltPdf.addPage([
            origViewport.width,
            origViewport.height,
          ]);
          newPage.drawImage(jpgImg, {
            x: 0,
            y: 0,
            width: origViewport.width,
            height: origViewport.height,
          });
        }
        outputBytes = await rebuiltPdf.save();
      }

      await verifiedDoc.destroy();

      const blob = new Blob([outputBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_unlocked.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setPageCount(totalPages);
      setSuccessMsg(
        `Unlocked "${outName}" (${totalPages} pages, ${formatBytes(blob.size)}) — password removed.`
      );
    } catch (err) {
      if (err?.name === "PasswordException") {
        setError("Incorrect password. Check your caps lock and try again.");
      } else {
        console.error("Unlock error:", err);
        setError("Failed to unlock this PDF. Please try again.");
      }
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-3">
        <Dropzone
          accept=".pdf"
          multiple={false}
          title="Drop a password-protected PDF to unlock"
          subtitle="Removes open & owner password restrictions locally in browser memory"
          onFilesSelected={handleFileSelected}
        />
        {error && (
          <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-2.5 text-xs font-medium text-signal">
            <WarningCircle size={16} weight="bold" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* File Info Header */}
      <div className="flex items-center justify-between gap-3 rounded-sharp border border-hairline bg-canvas p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-surface text-signal">
            {isEncrypted ? (
              <LockKey size={20} weight="bold" />
            ) : (
              <LockOpen size={20} weight="bold" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{file.name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
              {formatBytes(file.size)} ·{" "}
              {isEncrypted
                ? "Password required"
                : `${pageCount} ${pageCount === 1 ? "page" : "pages"} (Owner restrictions only)`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={resetAll}
          disabled={isUnlocking}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-mat disabled:opacity-50"
        >
          <ArrowCounterClockwise size={14} weight="bold" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* Password Input Form */}
      <form
        onSubmit={handleUnlockAndDownload}
        className="mat-recessed rounded-sharp border border-hairline p-5 sm:p-6"
      >
        <div className="mx-auto max-w-md space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink">
              {isEncrypted
                ? "Enter Current PDF Password"
                : "Document Password (Optional — No Open Password Detected)"}
            </label>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder={
                  isEncrypted
                    ? "Enter password to decrypt..."
                    : "Leave blank to strip owner print/copy locks"
                }
                autoFocus={isEncrypted}
                className="w-full rounded-sharp border border-hairline bg-surface py-2.5 pl-3.5 pr-10 text-sm text-ink focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 text-ink-muted hover:text-ink"
              >
                {showPassword ? (
                  <EyeSlash size={18} weight="regular" />
                ) : (
                  <Eye size={18} weight="regular" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isUnlocking || (isEncrypted && !password)}
            className="flex w-full items-center justify-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-50 dark:text-canvas"
          >
            {isUnlocking ? (
              <>
                <SpinnerGap size={16} weight="bold" className="animate-spin" />
                <span>Decrypting PDF...</span>
              </>
            ) : (
              <>
                <Download size={16} weight="bold" />
                <span>Unlock & Download PDF</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Alerts */}
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
    </div>
  );
}
