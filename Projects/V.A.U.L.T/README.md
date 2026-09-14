# V.A.U.L.T — Visual Application for Unified Library Tracking

**V.A.U.L.T** (Vault-Reader) is a client-side, offline-capable digital library and document reader built entirely with vanilla HTML, CSS, and JavaScript. It serves as a visually engaging, privacy-focused hub for storing, organizing, and studying PDF documents directly within the browser without relying on external servers.

---

## 🏛️ Core Architecture

* **Storage Engine (`IndexedDB`)**: Securely stores heavy PDF blobs, cover artwork, bookmarks, study notes, and metadata on the user's local machine, completely bypassing the 5MB `localStorage` limit.
* **Global State (`localStorage`)**: Used strictly for persistent lightweight user preferences, such as the active aesthetic UI theme.
* **Rendering Engine (`PDF.js`)**: Native HTML5 `<canvas>` hardware-accelerated rendering with automatic Device Pixel Ratio (DPR) compensation for crisp text on high-resolution displays.

---

## 🚀 Key Features

* **Store (Library Management)**:
  * Dynamic grid layout inspired by digital game capsules.
  * Form for custom title, cover image (with 1:1 preview), description, and PDF file.
  * Memory-efficient single-listener event delegation on the grid container.
  * Complete database purging to manage local disk space.
* **Read (Study Environment)**:
  * **Seamless Resume**: Automatically recalls the last read page upon opening.
  * **Study Notes**: Per-document notes editor with debounced auto-saving to IndexedDB.
  * **Bookmarks**: One-click active page bookmarking and quick-jump navigation.
  * **Zoom Controls**: Fluid Zoom In (`+`), Zoom Out (`−`), and Reset to Fit (`Fit`) with live percentage display and keyboard shortcuts (`Ctrl + =` / `Ctrl + -` / `Ctrl + 0`).
  * **Ergonomic Reading Bounds**: Capped reading line length to prevent horizontal scanning fatigue on ultra-wide screens.
* **Distraction-Free Focus Mode**:
  * Strips away toolbars, sidebars, and navigation to center the document for deep focus.
* **Modular Theme System**:
  * Decoupled aesthetic CSS variables (`--bg-primary`, `--accent-primary`, etc.) driven by `<html data-theme="...">`.
  * Pre-configured themes: **Dark Vault**, **Clean Light**, **Midnight OLED**, and **Warm Sepia**.

---

## 💾 IndexedDB Data Schema

| Property | Data Type | Function |
| --- | --- | --- |
| `id` | `String` (UUID) | Unique identifier for database retrieval |
| `title` | `String` | Display name of the document |
| `cover` | `Blob` / `Base64` | Custom image for the grid layout |
| `description` | `String` | User-generated summary text |
| `fileData` | `Blob` | The primary PDF document binary payload |
| `lastPage` | `Number` | Integer tracking reading progress |
| `bookmarks` | `Array<Number>` | Saved page numbers for instant navigation |
| `notes` | `String` | Text payload for the integrated notepad |

---

## 📂 Project Structure

```
V.A.U.L.T/
├── hero.html             # Project landing page & feature overview
├── index.html            # Main application workspace (Store & Reader)
├── css/
│   ├── themes.css        # Color tokens & theme palettes
│   └── styles.css        # Structural layouts, grid, reader canvas, and focus mode
├── js/
│   ├── db.js             # IndexedDB Storage Engine (CRUD operations)
│   └── app.js            # App orchestration, PDF.js rendering & event delegation
└── README.md             # Documentation
```
