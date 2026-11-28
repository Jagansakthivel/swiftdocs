# SwiftDocs

**PDF and document tools that never leave your device.**

[Open SwiftDocs](https://swiftdocs-theta.vercel.app/) · [Portfolio](https://jagansakthivel.github.io/#work)

<a href="https://swiftdocs-theta.vercel.app/"><img src="https://raw.githubusercontent.com/Jagansakthivel/jagansakthivel.github.io/main/public/projects/swiftdocs-tools.png" alt="SwiftDocs tool directory" width="760"></a>

I built SwiftDocs around a simple constraint: a routine document operation should not require uploading a private file. The app brings 15 utilities into a single browser-local workspace.

| What matters | Implementation |
| --- | --- |
| Privacy | Local file processing; no document upload backend |
| Availability | Installable PWA and service-worker caching |
| Workflow | File-type detection and drag-and-drop routing |
| Document control | Compression, signing, AES protection and metadata scrubbing |

## A closer look

<img src="https://raw.githubusercontent.com/Jagansakthivel/jagansakthivel.github.io/main/public/projects/swiftdocs-compressor.png" alt="PDF compressor workspace with preset controls" width="760">

**Try it:** open the live app, select Compress PDF, choose a non-sensitive sample file and compare the output sizes. The screenshots above are actual interface captures, not a simulated recording.

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
