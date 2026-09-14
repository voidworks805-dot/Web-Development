/**
 * V.A.U.L.T - Storage Engine (IndexedDB)
 * 
 * Schema reference:
 * - id: String (UUID)
 * - title: String
 * - cover: Blob / Base64 / null
 * - description: String
 * - fileData: Blob (PDF payload)
 * - lastPage: Number
 * - bookmarks: Array[Number]
 * - notes: String
 */

export const DB_NAME = 'vault_reader_db';
export const DB_VERSION = 1;
export const STORE_NAME = 'books';

let dbInstance = null;

/**
 * Initializes and returns the IndexedDB connection.
 * Caches the connection for subsequent operations.
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        console.log(`[Storage Engine] Created object store "${STORE_NAME}" with keyPath "id".`);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      console.log(`[Storage Engine] Successfully connected to IndexedDB: "${DB_NAME}".`);
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[Storage Engine] Failed to open IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Adds a new book record into the 'books' object store.
 * @param {Object} bookData - Record conforming to the V.A.U.L.T schema
 * @returns {Promise<string>} Resolves with the book's id
 */
export async function addBook(bookData) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(bookData);

    request.onsuccess = () => {
      console.log(`[Storage Engine] Book "${bookData.title}" (${bookData.id}) stored successfully.`);
      resolve(bookData.id);
    };

    request.onerror = (event) => {
      console.error('[Storage Engine] Error adding book:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves a single book by ID.
 * @param {string} id - The book's unique UUID
 * @returns {Promise<Object|null>}
 */
export async function getBook(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (event) => {
      resolve(event.target.result || null);
    };

    request.onerror = (event) => {
      console.error(`[Storage Engine] Error retrieving book (${id}):`, event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Retrieves all stored books (for library grid rendering).
 * @returns {Promise<Array>}
 */
export async function getAllBooks() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result || []);
    };

    request.onerror = (event) => {
      console.error('[Storage Engine] Error fetching all books:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Updates reading progress (lastPage) for a book.
 * @param {string} id
 * @param {number} lastPage
 */
export async function updateReadingProgress(id, lastPage) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const book = getReq.result;
      if (!book) {
        return reject(new Error(`Book with id ${id} not found.`));
      }
      book.lastPage = lastPage;
      const putReq = store.put(book);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Updates the bookmarks array for a book.
 * @param {string} id
 * @param {Array<number>} bookmarks
 */
export async function updateBookmarks(id, bookmarks) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const book = getReq.result;
      if (!book) {
        return reject(new Error(`Book with id ${id} not found.`));
      }
      book.bookmarks = bookmarks;
      const putReq = store.put(book);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Updates study notes for a book.
 * @param {string} id
 * @param {string} notes
 */
export async function updateNotes(id, notes) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const book = getReq.result;
      if (!book) {
        return reject(new Error(`Book with id ${id} not found.`));
      }
      book.notes = notes;
      const putReq = store.put(book);
      putReq.onsuccess = () => resolve(true);
      putReq.onerror = (e) => reject(e.target.error);
    };

    getReq.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Purges a book completely from IndexedDB.
 * @param {string} id
 */
export async function deleteBook(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log(`[Storage Engine] Book with ID ${id} deleted successfully.`);
      resolve(true);
    };

    request.onerror = (event) => {
      console.error(`[Storage Engine] Error deleting book (${id}):`, event.target.error);
      reject(event.target.error);
    };
  });
}
