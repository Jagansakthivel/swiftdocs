# SwiftDocs

> **100% Browser-Local PDF & Document Utilities · Zero Server Uploads**

SwiftDocs is a privacy-first, local-first web application for viewing, converting, editing, compressing, and protecting PDFs and documents. Every byte processed stays strictly in browser memory.

---

## Features

- **100% Client-Side Privacy**: All operations execute entirely on your machine via Web APIs and WebAssembly. No files or metadata are ever uploaded to any server.
- **Offline Capable & Installable PWA**: Packaged with a Service Worker and Web App Manifest for instant offline use and standalone installation across desktop and mobile.
- **Swiss Print-Shop Design**: Built with an archival paper palette (`#F4F2ED` canvas, `#FAF9F6` cotton surface, `#D9381E` International Vermilion accents) and tactile feedback.
- **Quick-Drop Routing**: Drop any file onto the hero area to auto-detect file types and stage files directly into the target tool workspace.

---

## 15 Local-First Tools

| Category | Tool | Description |
|---|---|---|
| **PDF Suite** | **Compress PDF** | Reduce PDF file size with Light, Balanced, or Extreme presets |
| | **Merge PDF** | Combine multiple PDF files into one unified document |
| | **Split & Extract** | Extract specific page ranges or burst all pages into individual PDFs |
| | **Reorder & Rotate** | Visual page grid to rearrange, rotate, or delete individual pages |
| | **Sign PDF** | Draw or upload digital signatures and place them interactively |
| | **Flatten & Scrub** | Rasterize pages to remove form fields, annotations, and hidden metadata |
| | **Unlock PDF** | Strip owner and user passwords from unprotected viewable PDFs |
| | **Protect PDF** | Encrypt PDFs with standard AES password protection |
| | **Watermark & Numbers** | Stamp custom text watermarks and configurable page numbers |
| | **Batch Rename PDF** | Rename multiple PDF documents with prefix, suffix, and counter rules |
| **Converters** | **DOCX ↔ PDF** | Convert Word documents to PDF or extract clean text |
| | **Images to PDF** | Assemble JPG, PNG, or WebP images into a multi-page PDF |
| | **PDF to Images** | Render PDF pages into high-resolution JPG or PNG downloads |
| **Images & Batch** | **Photo Compressor** | Client-side image compression with resolution scaling |
| | **Convert Photo** | Convert between PNG, JPEG, and WebP formats in batch |

---

## Tech Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Iconography**: `@phosphor-icons/react`
- **PDF & Document Engines**: `pdf-lib`, `pdfjs-dist`, `mammoth`, `docx`, `html2pdf.js`, `@pdfsmaller/pdf-encrypt-lite`
- **Compression & Archives**: `fflate`
- **PWA & Offline**: Cache-first / Stale-While-Revalidate Service Worker

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Jagansakthivel/swiftdocs.git

# Enter project directory
cd swiftdocs

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
npm run build
npm run preview
```

---

## License

MIT © [Jagan](https://github.com/Jagansakthivel)
