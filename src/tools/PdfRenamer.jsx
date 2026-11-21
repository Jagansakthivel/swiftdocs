import { useState } from "react";
import { zipSync } from "fflate";
import {
  FileText,
  Download,
  Archive,
  Trash,
  Plus,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

export default function PdfRenamer() {
  const [items, setItems] = useState([]);
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [addIndex, setAddIndex] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const splitNameAndExt = (filename) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot <= 0) {
      return { baseName: filename, extension: "" };
    }
    return {
      baseName: filename.slice(0, lastDot),
      extension: filename.slice(lastDot),
    };
  };

  const handleFilesSelected = (newFiles) => {
    const mapped = newFiles.map((file, idx) => {
      const { baseName, extension } = splitNameAndExt(file.name);
      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        originalBaseName: baseName,
        newBaseName: baseName,
        extension,
      };
    });
    setItems((prev) => [...prev, ...mapped]);
  };

  const handleNameChange = (id, value) => {
    const sanitized = value.replace(/[<>:"/\\|?*]/g, "");
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, newBaseName: sanitized } : item
      )
    );
  };

  const applyBulkAffixes = () => {
    setItems((prev) =>
      prev.map((item, idx) => {
        const numTag = addIndex
          ? `_${String(idx + 1).padStart(String(prev.length).length, "0")}`
          : "";
        return {
          ...item,
          newBaseName: `${prefix}${item.originalBaseName}${suffix}${numTag}`,
        };
      })
    );
  };

  const resetAllNames = () => {
    setPrefix("");
    setSuffix("");
    setAddIndex(false);
    setItems((prev) =>
      prev.map((item) => ({ ...item, newBaseName: item.originalBaseName }))
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const getFinalFilename = (item) => {
    const cleanBase = item.newBaseName.trim() || item.originalBaseName;
    if (!item.extension) return cleanBase;
    return cleanBase.toLowerCase().endsWith(item.extension.toLowerCase())
      ? cleanBase
      : `${cleanBase}${item.extension}`;
  };

  const downloadSingle = (item) => {
    const finalName = getFinalFilename(item);
    const url = URL.createObjectURL(item.file);
    const a = document.createElement("a");
    a.href = url;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    if (items.length === 0) return;
    setIsZipping(true);
    try {
      const zipFiles = {};
      const usedNames = new Set();

      for (const item of items) {
        let finalName = getFinalFilename(item);
        if (usedNames.has(finalName.toLowerCase())) {
          const { baseName, extension } = splitNameAndExt(finalName);
          let counter = 2;
          while (
            usedNames.has(`${baseName}_${counter}${extension}`.toLowerCase())
          ) {
            counter++;
          }
          finalName = `${baseName}_${counter}${extension}`;
        }
        usedNames.add(finalName.toLowerCase());
        const buf = await item.file.arrayBuffer();
        zipFiles[finalName] = new Uint8Array(buf);
      }

      const zipped = zipSync(zipFiles, { level: 1 });
      const blob = new Blob([zipped], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "SwiftDocs_Renamed_Files.zip";
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
        accept="*"
        multiple={true}
        title="Drop any files here to rename"
        subtitle="Supports PDF, DOCX, JPG, PNG, ZIP, or any file format • 100% local"
        onFilesSelected={handleFilesSelected}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Bulk Prefix / Suffix / Numbering Bar */}
      <div className="rounded-sharp border border-hairline bg-canvas p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 bg-signal" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Bulk Rename Helper
            </span>
          </div>
          <button
            type="button"
            onClick={resetAllNames}
            className="inline-flex items-center gap-1 text-xs font-bold text-ink-muted hover:text-signal"
          >
            <ArrowCounterClockwise size={13} weight="bold" />
            <span>Reset Names</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Prefix (e.g., 2026_)"
            className="rounded-sharp border border-hairline bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-signal focus:outline-none"
          />
          <input
            type="text"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            placeholder="Suffix (e.g., _Final)"
            className="rounded-sharp border border-hairline bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted/70 focus:border-signal focus:outline-none"
          />
          <button
            type="button"
            onClick={applyBulkAffixes}
            className="rounded-sharp bg-signal px-4 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] dark:text-canvas"
          >
            Apply to All
          </button>
        </div>

        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink">
          <input
            type="checkbox"
            checked={addIndex}
            onChange={(e) => setAddIndex(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#D9381E]"
          />
          <span>Append sequential numbering (_1, _2, _3...) when applying</span>
        </label>
      </div>

      {/* Joined Hairline File List */}
      <div className="divide-y divide-hairline overflow-hidden rounded-sharp border border-hairline bg-surface">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-1 items-center gap-3">
              <span className="w-5 shrink-0 font-mono text-xs font-bold tabular-nums text-ink-muted">
                {idx + 1}.
              </span>

              <FileText size={20} weight="regular" className="shrink-0 text-signal" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center rounded-sharp border border-hairline bg-canvas px-3 py-1.5 focus-within:border-signal focus-within:bg-surface">
                  <input
                    type="text"
                    value={item.newBaseName}
                    onChange={(e) => handleNameChange(item.id, e.target.value)}
                    aria-label="New file name"
                    className="w-full bg-transparent text-sm font-bold text-ink focus:outline-none"
                  />
                  {item.extension && (
                    <span className="ml-1.5 shrink-0 font-mono text-xs font-bold text-ink-muted">
                      {item.extension}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-xs tabular-nums text-ink-muted">
                  Original: {item.file.name} · {formatBytes(item.file.size)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => downloadSingle(item)}
                className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-canvas px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:border-signal hover:text-signal active:translate-y-[1px]"
              >
                <Download size={14} weight="bold" />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                title="Remove file"
                className="rounded-sharp p-1.5 text-ink-muted transition-colors hover:bg-signal/10 hover:text-signal"
              >
                <Trash size={15} weight="regular" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-sharp border border-hairline bg-surface px-4 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px]">
          <Plus size={15} weight="bold" />
          <span>Add More Files</span>
          <input
            type="file"
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
              onClick={downloadAllAsZip}
              disabled={isZipping}
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
