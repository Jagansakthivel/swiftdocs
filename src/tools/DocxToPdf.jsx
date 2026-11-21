import { useState, useRef } from "react";
import mammoth from "mammoth";
import html2pdf from "html2pdf.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import {
  FileDoc,
  FilePdf,
  Download,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowCounterClockwise,
  Eye,
  ArrowsLeftRight,
} from "@phosphor-icons/react";
import Dropzone from "../components/Dropzone";
import { formatBytes } from "../utils/formatBytes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function DocxToPdf() {
  const [direction, setDirection] = useState("docx-to-pdf"); // 'docx-to-pdf' | 'pdf-to-docx'
  const [file, setFile] = useState(null);

  // DOCX -> PDF states
  const [htmlContent, setHtmlContent] = useState("");
  const [margin, setMargin] = useState(15);
  const [orientation, setOrientation] = useState("portrait");

  // PDF -> DOCX states
  const [extractedPages, setExtractedPages] = useState([]); // [{ pageNum, text }]

  // Shared states
  const [outputName, setOutputName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const previewRef = useRef(null);

  const resetWorkspace = () => {
    setFile(null);
    setHtmlContent("");
    setExtractedPages([]);
    setOutputName("");
    setError("");
    setSuccessMsg("");
  };

  const switchDirection = (newDir) => {
    if (newDir === direction) return;
    setDirection(newDir);
    resetWorkspace();
  };

  // Parse .docx for DOCX -> PDF
  const handleDocxSelected = async (selected) => {
    setFile(selected);
    setOutputName(selected.name.replace(/\.docx$/i, ""));
    setError("");
    setSuccessMsg("");
    setIsParsing(true);

    try {
      const arrayBuffer = await selected.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setHtmlContent(
        result.value || "<p><em>(This document appears to be empty.)</em></p>"
      );
    } catch (err) {
      console.error("DOCX parsing failed:", err);
      setError(
        "Could not read this .docx file. Please make sure it is a valid Word (.docx) document."
      );
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  // Parse .pdf for PDF -> DOCX
  const handlePdfSelected = async (selected) => {
    setFile(selected);
    setOutputName(selected.name.replace(/\.pdf$/i, ""));
    setError("");
    setSuccessMsg("");
    setIsParsing(true);

    try {
      const arrayBuffer = await selected.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pages = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Reconstruct lines based on Y coordinates
        let lastY = null;
        let pageText = "";

        for (const item of textContent.items) {
          const currentY = item.transform ? item.transform[5] : null;
          if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 6) {
            pageText += "\n";
          } else if (pageText && !pageText.endsWith(" ") && !pageText.endsWith("\n")) {
            pageText += " ";
          }
          pageText += item.str;
          lastY = currentY;
        }

        pages.push({
          pageNum,
          text: pageText.trim(),
        });
      }

      const hasAnyText = pages.some((p) => p.text.length > 0);
      if (!hasAnyText) {
        setError(
          "No selectable text found in this PDF (it may be a scanned image PDF). Try a text-based PDF."
        );
      }

      setExtractedPages(pages);
    } catch (err) {
      console.error("PDF parsing failed:", err);
      setError(
        "Could not extract text from this PDF. Make sure it is not password-protected."
      );
      setFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFilesSelected = (files) => {
    const selected = files[0];
    if (!selected) return;
    if (direction === "docx-to-pdf") {
      handleDocxSelected(selected);
    } else {
      handlePdfSelected(selected);
    }
  };

  // Export DOCX -> PDF
  const exportToPdf = async () => {
    if (!previewRef.current || !htmlContent) return;
    setIsConverting(true);
    setError("");
    setSuccessMsg("");

    try {
      const cleanName = (outputName.trim() || "SwiftDocs_Document").replace(
        /\.pdf$/i,
        ""
      );
      const opt = {
        margin: [margin, margin, margin, margin],
        filename: `${cleanName}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation },
      };

      await html2pdf().set(opt).from(previewRef.current).save();
      setSuccessMsg(`Converted and saved "${cleanName}.pdf" successfully!`);
    } catch (err) {
      console.error("PDF export failed:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  // Export PDF -> DOCX
  const exportToDocx = async () => {
    if (extractedPages.length === 0) return;
    setIsConverting(true);
    setError("");
    setSuccessMsg("");

    try {
      const cleanName = (outputName.trim() || "SwiftDocs_Document").replace(
        /\.docx$/i,
        ""
      );

      const docChildren = [];
      extractedPages.forEach((page, idx) => {
        if (idx > 0) {
          docChildren.push(
            new Paragraph({
              text: "",
              pageBreakBefore: true,
            })
          );
        }

        docChildren.push(
          new Paragraph({
            text: `Page ${page.pageNum}`,
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 120 },
          })
        );

        const paragraphs = page.text.split("\n\n");
        paragraphs.forEach((pText) => {
          if (!pText.trim()) return;
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: pText.trim() })],
              spacing: { after: 100 },
            })
          );
        });
      });

      const doc = new Document({
        sections: [{ properties: {}, children: docChildren }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccessMsg(
        `Created and downloaded "${cleanName}.docx" (${extractedPages.length} pages, ${formatBytes(blob.size)})!`
      );
    } catch (err) {
      console.error("DOCX generation error:", err);
      setError("Failed to create DOCX document. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  const updatePageText = (pageNum, newText) => {
    setExtractedPages((prev) =>
      prev.map((p) => (p.pageNum === pageNum ? { ...p, text: newText } : p))
    );
  };

  return (
    <div className="space-y-5">
      {/* 1. Mode Switcher Strip */}
      <div className="flex border-b border-hairline pb-5">
        <div className="inline-flex rounded-sharp border border-hairline bg-canvas p-1">
          <button
            type="button"
            onClick={() => switchDirection("docx-to-pdf")}
            className={`inline-flex items-center gap-1.5 rounded-sharp px-3.5 py-1.5 text-xs transition-all duration-100 ${
              direction === "docx-to-pdf"
                ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                : "font-medium text-ink-muted hover:text-ink"
            }`}
          >
            <FileDoc size={14} weight="regular" />
            <span>Word (.docx) → PDF</span>
          </button>
          <button
            type="button"
            onClick={() => switchDirection("pdf-to-docx")}
            className={`inline-flex items-center gap-1.5 rounded-sharp px-3.5 py-1.5 text-xs transition-all duration-100 ${
              direction === "pdf-to-docx"
                ? "border border-hairline bg-surface font-bold text-ink shadow-2xs"
                : "font-medium text-ink-muted hover:text-ink"
            }`}
          >
            <FilePdf size={14} weight="regular" />
            <span>PDF → Word (.docx)</span>
          </button>
        </div>
      </div>

      {/* 2. Dropzone or Workspace */}
      {!file ? (
        <div className="space-y-3">
          <Dropzone
            accept={direction === "docx-to-pdf" ? ".docx" : ".pdf"}
            multiple={false}
            title={
              direction === "docx-to-pdf"
                ? "Drop a Word (.docx) file here to convert to PDF"
                : "Drop a PDF here to extract text and build an editable Word document"
            }
            subtitle="Local parsing in your browser • Zero server uploads"
            onFilesSelected={handleFilesSelected}
          />
          {error && (
            <div className="flex items-center gap-2 rounded-sharp border border-signal/40 bg-signal/10 px-4 py-2.5 text-xs font-medium text-signal">
              <WarningCircle size={16} weight="regular" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* File Info Header */}
          <div className="flex flex-col gap-3 border-b border-hairline pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal">
                {direction === "docx-to-pdf" ? (
                  <FileDoc size={18} weight="regular" />
                ) : (
                  <FilePdf size={18} weight="regular" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{file.name}</p>
                <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                  {formatBytes(file.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={resetWorkspace}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] sm:self-auto"
            >
              <ArrowCounterClockwise size={14} weight="regular" />
              <span>Change File</span>
            </button>
          </div>

          {/* Export Settings Strip */}
          <div className="grid gap-3 border-b border-hairline pb-5 sm:grid-cols-2">
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
                  {direction === "docx-to-pdf" ? ".pdf" : ".docx"}
                </span>
              </div>
            </div>

            {direction === "docx-to-pdf" ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-muted">
                    Orientation
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value)}
                    className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-ink-muted">
                    Margin
                  </label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(Number(e.target.value))}
                    className="w-full rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink focus:border-signal focus:outline-none"
                  >
                    <option value={10}>Compact (10mm)</option>
                    <option value={15}>Standard (15mm)</option>
                    <option value={20}>Wide (20mm)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-bold text-ink-muted">
                  Extracted Pages
                </label>
                <div className="flex items-center rounded-sharp border border-hairline bg-surface px-3 py-1.5 text-xs font-bold text-ink-muted">
                  <span>{extractedPages.length} pages parsed</span>
                </div>
              </div>
            )}
          </div>

          {/* Document Preview (Flattened) */}
          {direction === "docx-to-pdf" ? (
            <div className="space-y-2 border-b border-hairline pb-5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <Eye size={14} weight="regular" className="text-signal" />
                Formatted Preview
              </span>

              <div className="mat-recessed max-h-[440px] overflow-y-auto rounded-sharp border border-hairline p-4 sm:p-6">
                <div
                  ref={previewRef}
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    color: "#181715",
                    backgroundColor: "#ffffff",
                    lineHeight: 1.6,
                  }}
                  className="docx-preview mx-auto max-w-[720px] rounded-[2px] bg-white p-6 text-sm shadow-2xs sm:p-10"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 border-b border-hairline pb-5">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-muted">
                <Eye size={14} weight="regular" className="text-signal" />
                Extracted Text Preview (Editable)
              </span>

              <div className="max-h-[440px] space-y-3 overflow-y-auto rounded-sharp border border-hairline bg-canvas p-3 sm:p-4">
                {extractedPages.map((page) => (
                  <div
                    key={page.pageNum}
                    className="rounded-sharp border border-hairline bg-surface p-3"
                  >
                    <p className="mb-1.5 font-mono text-xs font-bold text-signal">
                      Page {page.pageNum}
                    </p>
                    <textarea
                      rows={5}
                      value={page.text}
                      onChange={(e) => updatePageText(page.pageNum, e.target.value)}
                      className="w-full rounded-sharp border border-hairline bg-canvas p-2.5 text-xs leading-relaxed text-ink focus:border-signal focus:bg-surface focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback Alerts */}
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

          {/* Primary Action Button */}
          <div className="flex justify-end pt-1">
            {direction === "docx-to-pdf" ? (
              <button
                type="button"
                onClick={exportToPdf}
                disabled={isConverting || isParsing || !htmlContent}
                className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
              >
                {isConverting ? (
                  <>
                    <SpinnerGap size={16} weight="regular" className="animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} weight="regular" />
                    <span>Convert & Download PDF</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={exportToDocx}
                disabled={isConverting || isParsing || extractedPages.length === 0}
                className="inline-flex items-center gap-2 rounded-sharp bg-signal px-5 py-2.5 text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] disabled:opacity-100 disabled:bg-hairline disabled:text-ink-muted disabled:cursor-not-allowed dark:text-canvas"
              >
                {isConverting ? (
                  <>
                    <SpinnerGap size={16} weight="regular" className="animate-spin" />
                    <span>Building DOCX...</span>
                  </>
                ) : (
                  <>
                    <Download size={16} weight="regular" />
                    <span>Convert & Download DOCX</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
