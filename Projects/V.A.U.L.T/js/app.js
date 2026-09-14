/**
 * V.A.U.L.T - Main Application Controller
 * Orchestrates UI interactions, Theme handling, PDF.js rendering, and Storage Engine.
 */

import {
  initDB,
  addBook,
  getAllBooks,
  getBook,
  deleteBook,
  updateReadingProgress,
  updateBookmarks,
  updateNotes
} from './db.js';

// Resolve PDF.js library instance from CDN
const pdfjs = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
if (pdfjs && pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ---------------------------------------------------------------------------
// 1. Theme Management (localStorage)
// ---------------------------------------------------------------------------
const THEME_STORAGE_KEY = 'vault_theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    themeSelect.value = savedTheme;
    themeSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      document.documentElement.setAttribute('data-theme', selected);
      localStorage.setItem(THEME_STORAGE_KEY, selected);
    });
  }
}

/**
 * Converts an image file to a Base64 Data URL.
 * @param {File} file 
 * @returns {Promise<string>}
 */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// 2. Upload Modal & Submission Pipeline
// ---------------------------------------------------------------------------
export function setupUploadListeners() {
  const uploadModal = document.getElementById('upload-modal');
  const uploadForm = document.getElementById('upload-form');
  const openUploadBtn = document.getElementById('btn-open-upload');
  const emptyUploadBtn = document.getElementById('btn-empty-upload');
  const closeModalBtn = document.getElementById('btn-close-modal');
  const cancelModalBtn = document.getElementById('btn-cancel-modal');
  const fileInput = document.getElementById('book-file-input');
  const coverInput = document.getElementById('book-cover-input');
  const titleInput = document.getElementById('book-title-input');
  const descInput = document.getElementById('book-desc-input');
  const submitBtn = document.getElementById('btn-submit-book');
  const coverPreviewBox = document.getElementById('cover-preview-box');

  const openModal = () => {
    if (uploadModal) uploadModal.classList.remove('hidden');
  };

  const closeModal = () => {
    if (uploadModal) {
      uploadModal.classList.add('hidden');
      if (uploadForm) uploadForm.reset();
      if (coverPreviewBox) {
        coverPreviewBox.textContent = '1:1';
        coverPreviewBox.style.backgroundImage = 'none';
      }
    }
  };

  if (openUploadBtn) openUploadBtn.addEventListener('click', openModal);
  if (emptyUploadBtn) emptyUploadBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

  // Live cover image preview (1:1 aspect ratio)
  if (coverInput) {
    coverInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file && coverPreviewBox) {
        const dataUrl = await fileToDataUrl(file);
        coverPreviewBox.textContent = '';
        coverPreviewBox.style.backgroundImage = `url(${dataUrl})`;
        coverPreviewBox.style.backgroundSize = 'cover';
        coverPreviewBox.style.backgroundPosition = 'center';
      }
    });
  }

  // Auto-fill title from selected PDF filename
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && titleInput && !titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '');
      }
    });
  }

  // Handle PDF submission and storage in IndexedDB
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pdfFile = fileInput?.files?.[0];
      if (!pdfFile) {
        alert('Please select a valid PDF document.');
        return;
      }

      const title = titleInput?.value?.trim() || pdfFile.name.replace(/\.[^/.]+$/, '');
      const description = descInput?.value?.trim() || '';
      const coverFile = coverInput?.files?.[0] || null;

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Saving...';
        }

        // Process cover image if provided
        let coverDataUrl = null;
        if (coverFile) {
          coverDataUrl = await fileToDataUrl(coverFile);
        }

        // Construct book payload conforming to the V.A.U.L.T schema
        const newBook = {
          id: (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : `book_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title,
          cover: coverDataUrl,
          description,
          fileData: pdfFile, // Stored directly as a binary Blob
          lastPage: 1,
          bookmarks: [],
          notes: ''
        };

        // Save to IndexedDB
        await addBook(newBook);
        console.log('[V.A.U.L.T] Stored document in IndexedDB:', newBook.id);

        closeModal();
        await renderLibrary();
      } catch (error) {
        console.error('[V.A.U.L.T] Failed to store document:', error);
        alert(`Failed to store document: ${error.message || error}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save to IndexedDB';
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Store / Library View & Event Delegation
// ---------------------------------------------------------------------------
export async function renderLibrary() {
  const grid = document.getElementById('books-grid');
  const emptyState = document.getElementById('empty-state');
  const countLabel = document.getElementById('library-count-label');

  if (!grid) return;

  try {
    const books = await getAllBooks();

    if (countLabel) {
      countLabel.textContent = `${books.length} document${books.length === 1 ? '' : 's'} stored locally`;
    }

    if (!books || books.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // Pure markup generation - zero per-element event listeners to prevent memory bloat
    grid.innerHTML = books.map((book) => {
      const coverHtml = book.cover 
        ? `<img class="book-cover-img" src="${book.cover}" alt="${escapeHtml(book.title)} cover">`
        : `<div class="book-cover-fallback">
             <span style="font-size: 2.2rem; margin-bottom: 0.5rem;">📄</span>
             <span style="font-size: 0.8rem; font-weight: 600;">PDF Document</span>
           </div>`;

      return `
        <div class="book-card" data-id="${book.id}" data-title="${escapeHtml(book.title)}">
          <div class="book-cover-wrapper">
            ${coverHtml}
            <button class="book-delete-btn" type="button" title="Delete from Vault" aria-label="Delete ${escapeHtml(book.title)}">✕</button>
          </div>
          <div class="book-info">
            <h3 class="book-title" title="${escapeHtml(book.title)}">${escapeHtml(book.title)}</h3>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('[V.A.U.L.T] Error rendering library:', error);
  }
}

/**
 * Sets up a single delegated click listener on #books-grid to handle
 * both card opening and book deletion with zero memory bloat.
 */
export function setupLibraryGridDelegation() {
  const grid = document.getElementById('books-grid');
  if (!grid) return;

  grid.addEventListener('click', async (e) => {
    // 1. Check if the click target is the delete button (or inside it)
    const deleteBtn = e.target.closest('.book-delete-btn');
    if (deleteBtn) {
      e.stopPropagation();
      const card = deleteBtn.closest('.book-card');
      const bookId = card?.dataset?.id;
      const bookTitle = card?.dataset?.title || 'this document';

      if (bookId) {
        const confirmed = confirm(`Are you sure you want to delete "${bookTitle}" from your vault? This cannot be undone.`);
        if (confirmed) {
          try {
            await deleteBook(bookId);
            await renderLibrary();
          } catch (err) {
            console.error('[V.A.U.L.T] Error deleting book:', err);
          }
        }
      }
      return; // Stop processing to prevent opening reader
    }

    // 2. Check if the click target is a book card
    const card = e.target.closest('.book-card');
    if (card) {
      const bookId = card.dataset.id;
      openReader(bookId);
    }
  });
}

// ---------------------------------------------------------------------------
// 4. Read / Study Environment Engine
// ---------------------------------------------------------------------------

// Reader Session State
let activeBook = null;
let activePdfDoc = null;
let currentPageNum = 1;
let isPageRendering = false;
let pendingPageNum = null;
let activeRenderTask = null;
let notesDebounceTimer = null;
let userZoomFactor = 1.0;

/**
 * Opens a book from IndexedDB and mounts the study reader view.
 * @param {string} bookId 
 */
export async function openReader(bookId) {
  try {
    const book = await getBook(bookId);
    if (!book || !book.fileData) {
      alert('Could not load document from IndexedDB.');
      return;
    }

    activeBook = book;
    userZoomFactor = 1.0;
    if (!Array.isArray(activeBook.bookmarks)) {
      activeBook.bookmarks = [];
    }

    // 1. UI Swap: Hide Library, Reveal Reader
    const libraryView = document.getElementById('library-view');
    const readerView = document.getElementById('reader-view');
    if (libraryView) libraryView.classList.add('hidden');
    if (readerView) readerView.classList.remove('hidden');

    // 2. Populate Header and Study Workbench
    const readerTitle = document.getElementById('reader-book-title');
    if (readerTitle) readerTitle.textContent = book.title;

    const notesEditor = document.getElementById('notes-editor');
    const notesStatus = document.getElementById('notes-status');
    if (notesEditor) notesEditor.value = book.notes || '';
    if (notesStatus) notesStatus.textContent = 'Saved';

    renderBookmarksList();

    // 3. Blob Conversion & PDF.js Loading
    console.log(`[Reader] Converting Blob (${book.fileData.size} bytes) to ArrayBuffer...`);
    const arrayBuffer = await book.fileData.arrayBuffer();

    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    activePdfDoc = await loadingTask.promise;
    console.log(`[Reader] PDF loaded successfully. Total pages: ${activePdfDoc.numPages}`);

    // Update Page Count Indicator
    const pageCountEl = document.getElementById('page-count');
    const pageInput = document.getElementById('page-num-input');
    if (pageCountEl) pageCountEl.textContent = activePdfDoc.numPages;
    if (pageInput) pageInput.max = activePdfDoc.numPages;

    // 4. Fetch and Clamp Last Read Page
    currentPageNum = Math.min(Math.max(book.lastPage || 1, 1), activePdfDoc.numPages);

    // 5. Draw to Canvas
    renderPage(currentPageNum);

  } catch (error) {
    console.error('[Reader] Failed to open document:', error);
    alert(`Error loading PDF: ${error.message || error}`);
    closeReader();
  }
}

/**
 * Renders a specific PDF page onto the HTML5 <canvas> with Hi-DPI scaling.
 * @param {number} num 
 */
async function renderPage(num) {
  if (!activePdfDoc) return;

  // Cancel any active render task to avoid collisions
  if (isPageRendering) {
    pendingPageNum = num;
    if (activeRenderTask) {
      activeRenderTask.cancel();
    }
    return;
  }

  isPageRendering = true;

  try {
    const page = await activePdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-canvas');
    const viewportContainer = document.getElementById('canvas-viewport');
    if (!canvas || !viewportContainer) return;

    const ctx = canvas.getContext('2d');

    // Compute optimal ergonomic base scale based on container width and comfortable reading limits
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    
    // Optimal ergonomic reading width limit (caps document width at ~800px to avoid scanning back and forth)
    const MAX_READING_WIDTH = 800;
    const availableWidth = Math.min(viewportContainer.clientWidth - 48, MAX_READING_WIDTH);
    const baseScale = Math.min(Math.max(availableWidth / unscaledViewport.width, 0.65), 1.35);
    
    // Apply user zoom modifier
    const scale = parseFloat((baseScale * userZoomFactor).toFixed(3));

    const viewport = page.getViewport({ scale });

    // Hi-DPI / Device Pixel Ratio scaling for razor-sharp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    activeRenderTask = page.render(renderContext);
    await activeRenderTask.promise;

  } catch (error) {
    if (error?.name !== 'RenderingCancelledException') {
      console.error('[Reader] Error rendering page:', error);
    }
  } finally {
    isPageRendering = false;
    activeRenderTask = null;

    if (pendingPageNum !== null) {
      const nextNum = pendingPageNum;
      pendingPageNum = null;
      renderPage(nextNum);
      return;
    }

    // Synchronize UI Controls
    updateReaderControls(num);

    // Asynchronously update reading progress in IndexedDB
    if (activeBook && activeBook.id) {
      activeBook.lastPage = num;
      updateReadingProgress(activeBook.id, num).catch((err) => {
        console.error('[Reader] Failed to update reading progress:', err);
      });
    }
  }
}

/**
 * Queues a page change with boundary checks.
 * @param {number} num 
 */
function queueRenderPage(num) {
  if (!activePdfDoc) return;
  const targetPage = Math.min(Math.max(num, 1), activePdfDoc.numPages);
  if (targetPage === currentPageNum && !isPageRendering) return;

  currentPageNum = targetPage;
  renderPage(currentPageNum);
}

/**
 * Synchronizes buttons, input, and bookmark indicator with current page.
 * @param {number} num 
 */
function updateReaderControls(num) {
  const pageInput = document.getElementById('page-num-input');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  const bookmarkBtn = document.getElementById('btn-toggle-bookmark');

  if (pageInput) pageInput.value = num;
  if (prevBtn) prevBtn.disabled = (num <= 1);
  if (nextBtn && activePdfDoc) nextBtn.disabled = (num >= activePdfDoc.numPages);

  // Update Zoom controls
  const zoomLevelLabel = document.getElementById('zoom-level-label');
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  if (zoomLevelLabel) zoomLevelLabel.textContent = `${Math.round(userZoomFactor * 100)}%`;
  if (zoomInBtn) zoomInBtn.disabled = (userZoomFactor >= 2.5);
  if (zoomOutBtn) zoomOutBtn.disabled = (userZoomFactor <= 0.4);

  // Update Bookmark toggle indicator
  if (bookmarkBtn && activeBook) {
    const isBookmarked = activeBook.bookmarks.includes(num);
    bookmarkBtn.textContent = isBookmarked ? '★ Bookmarked' : '☆ Bookmark Page';
    if (isBookmarked) {
      bookmarkBtn.classList.add('btn-primary');
      bookmarkBtn.classList.remove('btn-secondary');
    } else {
      bookmarkBtn.classList.remove('btn-primary');
      bookmarkBtn.classList.add('btn-secondary');
    }
  }
}

/**
 * Renders the bookmarks list in the side workbench.
 */
function renderBookmarksList() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList || !activeBook) return;

  if (!activeBook.bookmarks || activeBook.bookmarks.length === 0) {
    bookmarksList.innerHTML = `<li style="font-size: 0.8rem; color: var(--text-muted); padding: 0.5rem 0;">No bookmarks saved yet.</li>`;
    return;
  }

  bookmarksList.innerHTML = activeBook.bookmarks.map((pageNum) => `
    <li class="bookmark-item" data-page="${pageNum}" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.6rem; margin-bottom: 0.35rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--radius-sm); cursor: pointer; font-size: 0.85rem;">
      <span>Page ${pageNum}</span>
      <button class="bookmark-del-btn" data-page="${pageNum}" title="Remove bookmark" style="color: var(--text-muted); font-size: 0.85rem; padding: 0 0.35rem;">✕</button>
    </li>
  `).join('');
}

/**
 * Sets up all Reader toolbar, pagination, workbench, and focus mode event listeners.
 */
export function setupReaderListeners() {
  const backBtn = document.getElementById('btn-back-library');
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');
  const pageInput = document.getElementById('page-num-input');
  const bookmarkBtn = document.getElementById('btn-toggle-bookmark');
  const focusBtn = document.getElementById('btn-toggle-focus');
  const exitFocusBtn = document.getElementById('btn-exit-focus');
  const bookmarksList = document.getElementById('bookmarks-list');
  const notesEditor = document.getElementById('notes-editor');
  const notesStatus = document.getElementById('notes-status');

  // Back to Library
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      closeReader();
    });
  }

  // Prev / Next Page Buttons
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPageNum > 1) {
        queueRenderPage(currentPageNum - 1);
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (activePdfDoc && currentPageNum < activePdfDoc.numPages) {
        queueRenderPage(currentPageNum + 1);
      }
    });
  }

  // Direct Page Number Input
  if (pageInput) {
    pageInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        queueRenderPage(val);
      }
    });
  }

  // Toggle Current Page Bookmark
  if (bookmarkBtn) {
    bookmarkBtn.addEventListener('click', async () => {
      if (!activeBook) return;

      const idx = activeBook.bookmarks.indexOf(currentPageNum);
      if (idx > -1) {
        activeBook.bookmarks.splice(idx, 1);
      } else {
        activeBook.bookmarks.push(currentPageNum);
        activeBook.bookmarks.sort((a, b) => a - b);
      }

      await updateBookmarks(activeBook.id, activeBook.bookmarks);
      renderBookmarksList();
      updateReaderControls(currentPageNum);
    });
  }

  // Delegated Bookmark Clicks & Deletion
  if (bookmarksList) {
    bookmarksList.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.bookmark-del-btn');
      if (delBtn) {
        e.stopPropagation();
        const pageNum = parseInt(delBtn.dataset.page, 10);
        if (!isNaN(pageNum) && activeBook) {
          activeBook.bookmarks = activeBook.bookmarks.filter(p => p !== pageNum);
          await updateBookmarks(activeBook.id, activeBook.bookmarks);
          renderBookmarksList();
          updateReaderControls(currentPageNum);
        }
        return;
      }

      const item = e.target.closest('.bookmark-item');
      if (item) {
        const pageNum = parseInt(item.dataset.page, 10);
        if (!isNaN(pageNum)) {
          queueRenderPage(pageNum);
        }
      }
    });
  }

  // Debounced Notes Auto-Save
  if (notesEditor) {
    notesEditor.addEventListener('input', () => {
      if (!activeBook) return;
      if (notesStatus) notesStatus.textContent = 'Saving...';

      clearTimeout(notesDebounceTimer);
      notesDebounceTimer = setTimeout(async () => {
        try {
          if (activeBook) {
            activeBook.notes = notesEditor.value;
            await updateNotes(activeBook.id, activeBook.notes);
            if (notesStatus) notesStatus.textContent = 'Auto-saved';
          }
        } catch (err) {
          console.error('[Notes] Auto-save failed:', err);
          if (notesStatus) notesStatus.textContent = 'Save failed';
        }
      }, 500);
    });
  }

  // Focus Mode Toggles
  const toggleFocus = () => {
    document.body.classList.toggle('focus-mode');
  };

  if (focusBtn) focusBtn.addEventListener('click', toggleFocus);
  if (exitFocusBtn) exitFocusBtn.addEventListener('click', toggleFocus);

  // Zoom In / Out / Reset Controls
  const zoomInBtn = document.getElementById('btn-zoom-in');
  const zoomOutBtn = document.getElementById('btn-zoom-out');
  const zoomResetBtn = document.getElementById('btn-zoom-reset');

  if (zoomInBtn) {
    zoomInBtn.addEventListener('click', () => {
      if (userZoomFactor < 2.5) {
        userZoomFactor = Math.min(parseFloat((userZoomFactor + 0.15).toFixed(2)), 2.5);
        renderPage(currentPageNum);
      }
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', () => {
      if (userZoomFactor > 0.4) {
        userZoomFactor = Math.max(parseFloat((userZoomFactor - 0.15).toFixed(2)), 0.4);
        renderPage(currentPageNum);
      }
    });
  }

  if (zoomResetBtn) {
    zoomResetBtn.addEventListener('click', () => {
      userZoomFactor = 1.0;
      renderPage(currentPageNum);
    });
  }

  // Keyboard navigation & zoom shortcuts
  window.addEventListener('keydown', (e) => {
    // Ignore keystrokes when typing in inputs/textareas
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    if (!activePdfDoc || document.getElementById('reader-view')?.classList.contains('hidden')) return;

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      if (userZoomFactor < 2.5) {
        userZoomFactor = Math.min(parseFloat((userZoomFactor + 0.15).toFixed(2)), 2.5);
        renderPage(currentPageNum);
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      if (userZoomFactor > 0.4) {
        userZoomFactor = Math.max(parseFloat((userZoomFactor - 0.15).toFixed(2)), 0.4);
        renderPage(currentPageNum);
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      userZoomFactor = 1.0;
      renderPage(currentPageNum);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      if (currentPageNum > 1) queueRenderPage(currentPageNum - 1);
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
      if (currentPageNum < activePdfDoc.numPages) queueRenderPage(currentPageNum + 1);
    } else if (e.key === 'Escape') {
      document.body.classList.remove('focus-mode');
    }
  });

  // Responsive window resize handler to maintain optimal reading bounds
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (!activePdfDoc || document.getElementById('reader-view')?.classList.contains('hidden')) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderPage(currentPageNum);
    }, 150);
  });
}

/**
 * Closes the reader session, cleans up resources, and returns to the library.
 */
function closeReader() {
  // Cancel active render task
  if (activeRenderTask) {
    activeRenderTask.cancel();
    activeRenderTask = null;
  }

  // Flush notes if debounce timer active
  if (notesDebounceTimer && activeBook) {
    clearTimeout(notesDebounceTimer);
    const notesEditor = document.getElementById('notes-editor');
    if (notesEditor) {
      activeBook.notes = notesEditor.value;
      updateNotes(activeBook.id, activeBook.notes).catch(console.error);
    }
  }

  // Exit focus mode
  document.body.classList.remove('focus-mode');

  // Clear session state
  activeBook = null;
  activePdfDoc = null;
  currentPageNum = 1;
  isPageRendering = false;
  pendingPageNum = null;
  userZoomFactor = 1.0;

  // Clear Canvas
  const canvas = document.getElementById('pdf-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }

  // UI Swap: Hide Reader, Reveal Library
  const readerView = document.getElementById('reader-view');
  const libraryView = document.getElementById('library-view');
  if (readerView) readerView.classList.add('hidden');
  if (libraryView) libraryView.classList.remove('hidden');

  // Refresh library grid to reflect any progress or bookmark updates
  renderLibrary();
}

// ---------------------------------------------------------------------------
// 5. Utilities & Bootstrap
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Application Lifecycle Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupUploadListeners();
  setupLibraryGridDelegation();
  setupReaderListeners();

  try {
    await initDB();
    await renderLibrary();
  } catch (err) {
    console.error('[V.A.U.L.T] Initialization failed:', err);
  }
});
