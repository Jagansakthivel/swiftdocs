import { useState, useEffect, useRef, createContext, useContext } from "react";
import {
  FileArrowDown,
  ImageSquare,
  ArrowsMerge,
  Scissors,
  ListNumbers,
  LockOpen,
  LockKey,
  Textbox,
  ArrowsLeftRight,
  Images,
  FileImage,
  Resize,
  Stamp,
  Signature,
  TextAa,
  MagnifyingGlass,
  ArrowLeft,
  TrayArrowUp,
} from "@phosphor-icons/react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useHotkeys } from "./hooks/useHotkeys";
import { formatBytes } from "./utils/formatBytes";

export const StagedFilesContext = createContext({
  stagedFiles: [],
  clearStagedFiles: () => {},
});

function renderToolTitle(title) {
  if (title === "DOCX ↔ PDF") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>DOCX</span>
        <ArrowsLeftRight size={14} weight="bold" className="shrink-0 text-signal" />
        <span>PDF</span>
      </span>
    );
  }
  return title;
}
import PdfCompressor from "./tools/PdfCompressor";
import PhotoCompressor from "./tools/PhotoCompressor";
import PdfMerger from "./tools/PdfMerger";
import PdfSplitter from "./tools/PdfSplitter";
import PdfOrganizer from "./tools/PdfOrganizer";
import PdfSigner from "./tools/PdfSigner";
import PdfFlattener from "./tools/PdfFlattener";
import PdfUnlocker from "./tools/PdfUnlocker";
import PdfProtector from "./tools/PdfProtector";
import PdfRenamer from "./tools/PdfRenamer";
import DocxToPdf from "./tools/DocxToPdf";
import ImagesToPdf from "./tools/ImagesToPdf";
import PdfToImages from "./tools/PdfToImages";
import PhotoConverter from "./tools/PhotoConverter";
import PdfWatermark from "./tools/PdfWatermark";

const TOOLS = [
  {
    id: "pdf-compress",
    title: "Compress PDF",
    shortTitle: "Compress PDF",
    category: "pdf",
    description:
      "Reduce heavy PDF file sizes with Light, Balanced, or Extreme presets while preserving text sharpness.",
    icon: FileArrowDown,
    component: PdfCompressor,
  },
  {
    id: "pdf-merge",
    title: "Merge PDF",
    shortTitle: "Merge PDF",
    category: "pdf",
    description:
      "Combine multiple PDF documents into one file and reorder individual pages visually.",
    icon: ArrowsMerge,
    component: PdfMerger,
  },
  {
    id: "pdf-split",
    title: "Split & Extract",
    shortTitle: "Split & Extract",
    category: "pdf",
    description:
      "Extract specific page ranges or burst every page into separate downloadable PDFs.",
    icon: Scissors,
    component: PdfSplitter,
  },
  {
    id: "docx-to-pdf",
    title: "DOCX ↔ PDF",
    shortTitle: "DOCX ↔ PDF",
    category: "convert",
    description:
      "Convert Word documents to clean A4 PDFs or pull editable text out of existing PDFs.",
    icon: ArrowsLeftRight,
    component: DocxToPdf,
  },
  {
    id: "images-to-pdf",
    title: "Images to PDF",
    shortTitle: "Images to PDF",
    category: "convert",
    description:
      "Assemble JPG, PNG, or WebP scans into a multi-page PDF with custom margins.",
    icon: Images,
    component: ImagesToPdf,
  },
  {
    id: "photo-compress",
    title: "Photo Compressor",
    shortTitle: "Photo Compressor",
    category: "image",
    description:
      "Shrink JPG, PNG, or WebP files by quality percentage or target an exact KB size limit.",
    icon: ImageSquare,
    component: PhotoCompressor,
  },
  {
    id: "pdf-to-images",
    title: "PDF to Images",
    shortTitle: "PDF to Images",
    category: "convert",
    description:
      "Render PDF pages into high-DPI JPG, PNG, or WebP images individually or as a ZIP.",
    icon: FileImage,
    component: PdfToImages,
  },
  {
    id: "pdf-reorder",
    title: "Reorder & Rotate PDF",
    shortTitle: "Reorder Pages",
    category: "pdf",
    description:
      "Drag and drop thumbnails to reorder, rotate, duplicate, or delete PDF pages visually.",
    icon: ListNumbers,
    component: PdfOrganizer,
  },
  {
    id: "photo-convert",
    title: "Resize & Convert",
    shortTitle: "Resize & Convert",
    category: "image",
    description:
      "Convert between WebP, PNG, and JPG or scale photos to exact pixel dimensions.",
    icon: Resize,
    component: PhotoConverter,
  },
  {
    id: "pdf-sign",
    title: "Sign PDF",
    shortTitle: "Sign PDF",
    category: "pdf",
    description:
      "Draw, type, or upload your signature and stamp it onto any page locally.",
    icon: Signature,
    component: PdfSigner,
  },
  {
    id: "pdf-flatten",
    title: "Flatten & Scrub PDF",
    shortTitle: "Flatten & Scrub",
    category: "pdf",
    description:
      "Lock fillable form fields permanently and strip hidden author metadata.",
    icon: Stamp,
    component: PdfFlattener,
  },
  {
    id: "pdf-unlock",
    title: "Unlock PDF",
    shortTitle: "Unlock PDF",
    category: "pdf",
    description:
      "Remove password protection and printing or copying restrictions from a PDF.",
    icon: LockOpen,
    component: PdfUnlocker,
  },
  {
    id: "pdf-protect",
    title: "Protect PDF",
    shortTitle: "Protect PDF",
    category: "pdf",
    description:
      "Encrypt a PDF with a password so it cannot be opened without authorization.",
    icon: LockKey,
    component: PdfProtector,
  },
  {
    id: "pdf-watermark",
    title: "Watermark & Page Numbers",
    shortTitle: "Watermark & Pages",
    category: "pdf",
    description:
      "Stamp diagonal text watermarks and automatic page numbers across every page of a PDF.",
    icon: TextAa,
    component: PdfWatermark,
  },
  {
    id: "pdf-rename",
    title: "Batch File Renamer",
    shortTitle: "Batch Renamer",
    category: "image",
    description:
      "Rename dozens of PDFs, docs, or images at once with custom prefixes and export as ZIP.",
    icon: Textbox,
    component: PdfRenamer,
  },
];

const CATEGORIES = [
  { id: "all", label: "All Tools", count: TOOLS.length },
  { id: "pdf", label: "PDF Suite", count: TOOLS.filter((t) => t.category === "pdf").length },
  { id: "convert", label: "Converters", count: TOOLS.filter((t) => t.category === "convert").length },
  { id: "image", label: "Images & Batch", count: TOOLS.filter((t) => t.category === "image").length },
];

export default function App() {
  const [activeToolId, setActiveToolId] = useState(() => {
    const hashId = window.location.hash.replace(/^#/, "");
    return TOOLS.some((t) => t.id === hashId) ? hashId : null;
  });

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [routedFileHint, setRoutedFileHint] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);
  const quickInputRef = useRef(null);
  const searchInputRef = useRef(null);

  const stagedTotalSize = stagedFiles.reduce((sum, f) => sum + (f?.size || 0), 0);

  const openTool = (id, keepFiles = false) => {
    if (!keepFiles) {
      setStagedFiles([]);
      setRoutedFileHint(null);
    }
    setActiveToolId(id);
    if (id) {
      window.history.pushState(null, "", `#${id}`);
    } else {
      window.history.pushState(null, "", window.location.pathname);
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hashId = window.location.hash.replace(/^#/, "");
      setActiveToolId(TOOLS.some((t) => t.id === hashId) ? hashId : null);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut to focus tool search
  useEffect(() => {
    const handleCmdK = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (activeToolId) {
          openTool(null);
          setTimeout(() => searchInputRef.current?.focus(), 40);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleCmdK);
    return () => window.removeEventListener("keydown", handleCmdK);
  }, [activeToolId]);

  useHotkeys({
    onEscape: () => {
      if (searchQuery) setSearchQuery("");
      else if (activeToolId) openTool(null);
      else if (routedFileHint) setRoutedFileHint(null);
    },
  });

  const handleQuickFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setStagedFiles(files);

    const first = files[0].name.toLowerCase();
    if (first.endsWith(".docx")) {
      setRoutedFileHint(null);
      openTool("docx-to-pdf", true);
      return;
    }

    if (
      first.endsWith(".jpg") ||
      first.endsWith(".jpeg") ||
      first.endsWith(".png") ||
      first.endsWith(".webp")
    ) {
      if (files.length > 1) {
        setRoutedFileHint(null);
        openTool("images-to-pdf", true);
      } else {
        setRoutedFileHint({
          label: files[0].name,
          tools: ["photo-compress", "photo-convert", "images-to-pdf"],
        });
      }
      return;
    }

    if (first.endsWith(".pdf")) {
      if (files.length > 1) {
        setRoutedFileHint(null);
        openTool("pdf-merge", true);
      } else {
        setRoutedFileHint({
          label: files[0].name,
          tools: [
            "pdf-compress",
            "pdf-merge",
            "pdf-split",
            "pdf-reorder",
            "pdf-sign",
            "pdf-flatten",
            "pdf-unlock",
            "pdf-protect",
            "pdf-to-images",
            "pdf-watermark",
          ],
        });
      }
      return;
    }

    setRoutedFileHint(null);
    openTool("pdf-rename", true);
  };

  const filteredTools = TOOLS.filter((tool) => {
    const matchesCat =
      selectedCategory === "all" || tool.category === selectedCategory;
    const q = searchQuery.trim().toLowerCase();
    const matchesText =
      !q ||
      tool.title.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q);
    return matchesCat && matchesText;
  });

  const selectedTool = TOOLS.find((t) => t.id === activeToolId);
  const ActiveToolComponent = selectedTool?.component;

  return (
    <StagedFilesContext.Provider
      value={{
        stagedFiles,
        clearStagedFiles: () => setStagedFiles([]),
      }}
    >
      <div className="relative flex min-h-screen flex-col bg-canvas text-ink transition-colors duration-150 selection:bg-signal selection:text-white">
      {/* Fixed 1.5% Matte Paper Grain Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <Navbar
        onGoHome={() => {
          openTool(null);
          setSearchQuery("");
          setRoutedFileHint(null);
        }}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:py-12">
        {!selectedTool ? (
          <>
            {/* Editorial Print-Specimen Hero & Recessed Dropzone */}
            <section className="mb-10">
              <div className="mb-6 max-w-2xl">
                <h1 className="mb-2.5 text-3xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-[40px]">
                  PDF & document tools that never leave your device.
                </h1>
                <p className="text-sm leading-normal text-ink-muted sm:text-base">
                  Drop a file below to auto-detect actions, or choose a specific tool from the grid.
                </p>
              </div>

              {/* Physically Recessed Quick-Drop Mat */}
              <div
                onClick={() => quickInputRef.current?.click()}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleQuickFiles(e.dataTransfer.files);
                }}
                className={`mat-recessed block cursor-pointer rounded-sharp border border-dashed p-5 transition-colors duration-100 sm:p-7 ${
                  isDragging
                    ? "border-signal bg-signal/5"
                    : "border-paper-ink/30 dark:border-carbon-ink/25 hover:border-paper-accent dark:hover:border-carbon-accent"
                }`}
              >
                <input
                  ref={quickInputRef}
                  type="file"
                  multiple
                  onChange={(e) => {
                    handleQuickFiles(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />

                <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sharp border border-hairline bg-surface text-signal">
                      <TrayArrowUp size={24} weight="regular" />
                    </div>
                    {routedFileHint ? (
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 max-w-full truncate text-sm font-bold text-ink sm:max-w-md md:max-w-lg">
                            {routedFileHint.label}
                          </p>
                          {stagedTotalSize > 0 && (
                            <span className="shrink-0 rounded-sharp border border-hairline bg-mat px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-ink-muted">
                              {formatBytes(stagedTotalSize)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Ready in browser memory · Choose an action below
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-ink">
                          Quick-Drop: Drop any PDF, Word doc, or image
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Auto-detects compatible tools · Zero server uploads
                        </p>
                      </div>
                    )}
                  </div>

                  <span className="w-full shrink-0 rounded-sharp bg-signal px-4 py-2 text-center text-sm font-bold text-white transition-all duration-100 ease-out hover:bg-signal-hover active:translate-y-[1px] sm:w-auto dark:text-canvas">
                    Select Files
                  </span>
                </div>

                {routedFileHint && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4"
                  >
                    <span className="mr-1 text-xs font-medium text-ink-muted">
                      Open with:
                    </span>
                    {routedFileHint.tools.map((id) => {
                      const tool = TOOLS.find((t) => t.id === id);
                      if (!tool) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => openTool(id, true)}
                          className="inline-flex items-center gap-1.5 rounded-sharp border border-hairline bg-canvas px-2.5 py-1 text-xs font-bold text-ink transition-all duration-100 ease-out hover:border-signal hover:text-signal active:translate-y-[1px]"
                        >
                          {renderToolTitle(tool.title)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Architectural Section Rule + Underline Category Tabs + Search Input */}
            <section className="mb-6">
              <div className="mb-4 flex items-center justify-between border-b border-hairline pb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 bg-signal" />
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                    Tool Directory
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-ink-muted">
                  {filteredTools.length} / {TOOLS.length}
                </span>
              </div>

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                {/* Horizontally Scrollable Underline Category Tabs (scrollbar hidden) */}
                <div className="no-scrollbar flex items-center gap-5 overflow-x-auto whitespace-nowrap border-b border-hairline sm:border-b-0">
                  {CATEGORIES.map((cat) => {
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`inline-flex items-baseline gap-1.5 border-b-2 pb-1.5 text-sm transition-all duration-100 ease-out active:translate-y-[1px] ${
                          isActive
                            ? "border-paper-accent dark:border-carbon-accent font-bold text-ink"
                            : "border-transparent font-medium text-ink-muted hover:text-ink"
                        }`}
                      >
                        <span>{cat.label}</span>
                        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Input with Dynamic ⌘K → ESC <kbd> Badge */}
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlass
                    size={15}
                    weight="regular"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter tools..."
                    className="w-full rounded-sharp border border-hairline bg-surface py-1.5 pl-8 pr-14 text-xs text-ink placeholder:text-ink-muted focus:border-signal focus:outline-none"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      if (searchQuery) {
                        setSearchQuery("");
                      } else if (isSearchFocused) {
                        searchInputRef.current?.blur();
                      } else {
                        searchInputRef.current?.focus();
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <kbd
                      className={`inline-flex items-center rounded-[2px] border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider transition-all duration-150 ${
                        isSearchFocused || searchQuery
                          ? "border-signal/40 bg-signal/10 text-signal"
                          : "border-hairline bg-mat text-ink-muted"
                      }`}
                    >
                      {isSearchFocused || searchQuery ? "ESC" : "⌘K"}
                    </kbd>
                  </button>
                </div>
              </div>
            </section>

            {/* Swiss Joined 1px Ledger Grid */}
            {filteredTools.length > 0 ? (
              <div className="overflow-hidden rounded-sharp border border-hairline bg-hairline">
                <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
                  {filteredTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => openTool(tool.id)}
                        className="group relative flex flex-col justify-between bg-surface p-5 text-left transition-all duration-150 ease-out hover:z-10 hover:-translate-y-[2px] hover:bg-canvas hover:ring-1 hover:ring-[#D6D3CD] dark:hover:ring-[#3A3835] active:translate-y-0"
                      >
                        <div>
                          <div className="mb-3.5 flex items-center justify-between">
                            <div className="flex h-9 w-9 items-center justify-center rounded-sharp border border-hairline bg-canvas text-signal transition-colors duration-150 group-hover:border-signal/40">
                              <Icon size={20} weight="regular" className="h-5 w-5 shrink-0" />
                            </div>

                            <span
                              aria-hidden="true"
                              className="font-mono text-xs text-ink-muted opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-signal group-hover:opacity-100"
                            >
                              ↗
                            </span>
                          </div>

                          <h3 className="text-base font-bold tracking-[-0.01em] text-ink transition-colors duration-150 group-hover:text-signal">
                            {renderToolTitle(tool.title)}
                          </h3>

                          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                            {tool.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-sharp border border-hairline bg-surface py-14 text-center">
                <p className="text-sm font-bold">
                  No tools match "{searchQuery}"
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="mt-2 text-xs font-bold text-signal underline transition-all duration-100 ease-out active:translate-y-[1px]"
                >
                  Show all tools
                </button>
              </div>
            )}
          </>
        ) : (
          /* 2-Column Active Tool Workspace (min-w-0 prevents horizontal grid blowout) */
          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
            <aside className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openTool(null)}
                  className="flex shrink-0 items-center gap-2 rounded-sharp border border-hairline bg-surface px-3 py-2 text-xs font-bold text-ink transition-all duration-100 ease-out hover:bg-mat active:translate-y-[1px] lg:w-full"
                >
                  <ArrowLeft size={14} weight="regular" />
                  <span>All Tools</span>
                </button>

                {/* Mobile/Tablet Compact Tool Dropdown (< 1024px) */}
                <select
                  value={activeToolId}
                  onChange={(e) => openTool(e.target.value)}
                  aria-label="Switch tool"
                  className="min-w-0 flex-1 rounded-sharp border border-hairline bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-signal focus:outline-none lg:hidden"
                >
                  {TOOLS.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Desktop Vertical Sidebar Rail (>= 1024px) */}
              <div className="hidden flex-col gap-1 lg:flex">
                {TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const active = tool.id === activeToolId;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => openTool(tool.id)}
                      className={`flex items-center gap-2.5 rounded-sharp px-3 py-2 text-left text-xs transition-all duration-100 ease-out active:translate-y-[1px] ${
                        active
                          ? "bg-ink font-bold text-surface"
                          : "font-medium text-ink-muted hover:bg-surface hover:text-ink"
                      }`}
                    >
                      <Icon
                        size={16}
                        weight={active ? "bold" : "regular"}
                        className="shrink-0"
                      />
                      <span className="truncate">{tool.shortTitle}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="min-w-0 rounded-sharp border border-hairline bg-surface p-4 sm:p-7">
              <div className="mb-6 border-b border-hairline pb-5">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 bg-signal" />
                  <h2 className="text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                    {selectedTool.title}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {selectedTool.description}
                </p>
              </div>

              <ActiveToolComponent
                initialFiles={stagedFiles}
                onConsumeInitialFiles={() => setStagedFiles([])}
              />
            </section>
          </div>
        )}
      </main>

      {/* Minimalist Swiss Colophon Footer */}
      <Footer />
    </div>
    </StagedFilesContext.Provider>
  );
}
