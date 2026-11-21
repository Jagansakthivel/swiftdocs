import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { encryptPDF } from "@pdfsmaller/pdf-encrypt-lite";
import {
  LockKey,
  Eye,
  EyeSlash,
  WarningCircle,
  SpinnerGap,
  CheckCircle,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function PdfProtector() {
  const [file, setFile] = useState(null);
  const [rawBytes, setRawBytes] = useState(null);
  const [pageCount, setPageCount] = useState(0);

  const [userPassword, setUserPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [useSeparateOwner, setUseSeparateOwner] = useState(false);

  const [showUserPwd, setShowUserPwd] = useState(false);
  const [showOwnerPwd, setShowOwnerPwd] = useState(false);

  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const resetAll = () => {
    setFile(null);
    setRawBytes(null);
    setPageCount(0);
    setUserPassword("");
    setConfirmPassword("");
    setOwnerPassword("");
    setUseSeparateOwner(false);
    setShowUserPwd(false);
    setShowOwnerPwd(false);
    setError("");
    setSuccessMsg("");
  };

  const handleFileSelected = async (files) => {
    const selected = files[0];
    if (!selected) return;
    resetAll();

    try {
      const buffer = await selected.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer);
      setFile(selected);
      setRawBytes(new Uint8Array(buffer));
      setPageCount(pdfDoc.getPageCount());
    } catch (err) {
      console.error("Failed to read PDF:", err);
      setError(
        "Could not load this PDF. Make sure it is not already password-protected or corrupted."
      );
    }
  };

  const handleProtectAndDownload = async (e) => {
    e.preventDefault();
    if (!rawBytes || !file) return;

    if (!userPassword.trim()) {
      setError("Please enter a password to lock this PDF.");
      return;
    }

    if (userPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter carefully.");
      return;
    }

    if (useSeparateOwner && !ownerPassword.trim()) {
      setError("Please enter an owner password or uncheck the separate owner option.");
      return;
    }

    setIsEncrypting(true);
    setError("");
    setSuccessMsg("");

    try {
      const effectiveOwnerPwd =
        useSeparateOwner && ownerPassword.trim()
          ? ownerPassword.trim()
          : userPassword;

      const encryptedBytes = await encryptPDF(
        rawBytes,
        userPassword,
        effectiveOwnerPwd
      );

      const blob = new Blob([encryptedBytes], { type: "application/pdf" });
      const baseName = file.name.replace(/\.pdf$/i, "");
      const outName = `${baseName}_protected.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Encrypted "${outName}" (${pageCount} pages, ${formatBytes(blob.size)}) — password required to open.`
      );
    } catch (err) {
      console.error("Encryption failed:", err);
      setError("Failed to encrypt this PDF. Please try again.");
    } finally {
      setIsEncrypting(false);
    }
  };

  if (!file) {
    return (
      <div className="space-y-3">
        <Dropzone
          accept=".pdf"
          multiple={false}
          title="Drop a PDF here to encrypt with a password"
          subtitle="Encrypts documents locally in your browser • Zero server uploads"
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

  const isFormValid = Boolean(
    userPassword && confirmPassword && userPassword === confirmPassword
  );

  return (
    <div className="space-y-5">
      {/* 1. Header Strip: File Info & Change PDF */}
      <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* Standardized 36px x 36px icon box */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
            <LockKey size={18} weight="regular" />
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
          onClick={resetAll}
          disabled={isEncrypting}
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] disabled:opacity-40 sm:self-auto"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
          <span>Change PDF</span>
        </button>
      </div>

      {/* 2. Password Settings Section (Flattened, no nested boxes) */}
      <form onSubmit={handleProtectAndDownload} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-bold text-ink">
            Document Open Password
          </label>
          <div className="relative flex items-center">
            <input
              type={showUserPwd ? "text" : "password"}
              value={userPassword}
              onChange={(e) => {
                setUserPassword(e.target.value);
                setError("");
              }}
              placeholder="Enter password to open PDF..."
              autoFocus
              className="w-full rounded-sharp border border-hairline bg-surface py-2.5 pl-3.5 pr-10 text-sm text-ink focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowUserPwd(!showUserPwd)}
              aria-label={showUserPwd ? "Hide password" : "Show password"}
              className="absolute right-3 text-ink-muted hover:text-ink"
            >
              {showUserPwd ? (
                <EyeSlash size={16} weight="regular" />
              ) : (
                <Eye size={16} weight="regular" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold text-ink">
            Confirm Password
          </label>
          <input
            type={showUserPwd ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError("");
            }}
            placeholder="Re-enter password..."
            className="w-full rounded-sharp border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
          />
        </div>

        {/* Optional Separate Owner Password */}
        <div className="border-t border-hairline pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink">
            <input
              type="checkbox"
              checked={useSeparateOwner}
              onChange={(e) => setUseSeparateOwner(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#D9381E]"
            />
            <span>Set a separate owner permissions password (optional)</span>
          </label>

          {useSeparateOwner && (
            <div className="relative mt-2.5 flex items-center">
              <input
                type={showOwnerPwd ? "text" : "password"}
                value={ownerPassword}
                onChange={(e) => {
                  setOwnerPassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter owner password..."
                className="w-full rounded-sharp border border-hairline bg-surface py-2 pl-3.5 pr-10 text-sm text-ink focus:border-signal focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowOwnerPwd(!showOwnerPwd)}
                className="absolute right-3 text-ink-muted hover:text-ink"
              >
                {showOwnerPwd ? (
                  <EyeSlash size={16} weight="regular" />
                ) : (
                  <Eye size={16} weight="regular" />
                )}
              </button>
            </div>
          )}
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

        {/* 4. Primary CTA: Neutral when disabled instead of faded salmon */}
        <div className="border-t border-hairline pt-4">
          <button
            type="submit"
            disabled={isEncrypting || !isFormValid}
            className="flex w-full items-center justify-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
          >
            {isEncrypting ? (
              <>
                <SpinnerGap size={16} weight="regular" className="animate-spin" />
                <span>Encrypting PDF...</span>
              </>
            ) : (
              <>
                <LockKey size={16} weight="regular" />
                <span>Protect & Download PDF</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
