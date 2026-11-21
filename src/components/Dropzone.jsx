import { useState, useRef, useEffect, useContext } from "react";
import { TrayArrowUp } from "@phosphor-icons/react";
import { StagedFilesContext } from "../App";

export default function Dropzone({
  accept,
  multiple = false,
  title = "Drop files here",
  subtitle = "100% browser-local processing · Zero server uploads",
  onFilesSelected,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const { stagedFiles, clearStagedFiles } = useContext(StagedFilesContext);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current || !stagedFiles?.length) return;
    consumedRef.current = true;

    const filesToPass = multiple ? stagedFiles : [stagedFiles[0]];
    clearStagedFiles();
    onFilesSelected(filesToPass);
  }, [stagedFiles, multiple, onFilesSelected, clearStagedFiles]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onFilesSelected(files);
  };

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onFilesSelected(files);
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`group flex cursor-pointer flex-col items-center justify-center rounded-sharp border border-dashed px-6 py-11 text-center transition-all duration-150 ease-out ${
        isDragging
          ? "border-signal bg-signal/[0.05]"
          : "border-hairline bg-canvas/60 hover:border-ink/40 hover:bg-canvas"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
      />

      <div
        className={`mb-3.5 flex h-11 w-11 items-center justify-center rounded-sharp border transition-all duration-150 ease-out ${
          isDragging
            ? "scale-105 border-signal/50 bg-signal/10 text-signal"
            : "border-hairline bg-surface text-signal group-hover:scale-105"
        }`}
      >
        <TrayArrowUp size={22} weight="regular" />
      </div>

      <p className="text-base font-bold tracking-tight text-ink">{title}</p>
      <p className="mt-1 max-w-md text-xs text-ink-muted">{subtitle}</p>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
        className="mt-5 rounded-sharp bg-signal px-5 py-2 text-xs font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] dark:text-canvas"
      >
        {multiple ? "Select Files" : "Select File"}
      </button>
    </div>
  );
}
