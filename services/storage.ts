import { Draft } from '../types';
import { STORAGE_KEY, DRAFT_RETENTION_MS, SETTINGS_KEY } from '../constants';
import {
  encryptForStorage,
  decryptFromStorage,
  addPasswordProtection,
  removePasswordProtection,
  isSessionUnlocked,
  getDeviceKey
} from './crypto';

// Generate a simple unique ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Internal storage format (encrypted)
interface StoredDraft {
  id: string;
  content: string; // Encrypted with device key
  createdAt: number;
  lastUpdated: number;
  snippet: string; // Encrypted or obfuscated
  isProtected: boolean;
}

// --- Helpers for encrypted storage ---

async function loadRawDrafts(): Promise<StoredDraft[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load drafts", error);
    return [];
  }
}

function saveRawDrafts(drafts: StoredDraft[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

// --- Public API ---

/**
 * Initialize the crypto system (call once on app start)
 */
export async function initializeCrypto(): Promise<void> {
  // This ensures the device key is created on first load
  await getDeviceKey();
}

/**
 * Get all drafts (decrypted for display)
 * Protected drafts will have hidden snippets if session is locked
 */
export async function getDrafts(): Promise<Draft[]> {
  try {
    const rawDrafts = await loadRawDrafts();
    const sessionUnlocked = isSessionUnlocked();

    const decryptedDrafts: Draft[] = await Promise.all(
      rawDrafts.map(async (d) => {
        try {
          // Decrypt snippet (device key layer)
          let snippet = await decryptFromStorage(d.snippet);

          // If protected and session is locked, hide the snippet
          if (d.isProtected && !sessionUnlocked) {
            snippet = '🔒 Protected note';
          }

          return {
            id: d.id,
            content: d.content, // Keep encrypted, will decrypt on select
            createdAt: d.createdAt,
            lastUpdated: d.lastUpdated,
            snippet,
            isProtected: d.isProtected,
          };
        } catch {
          // If decryption fails, return placeholder
          return {
            id: d.id,
            content: d.content,
            createdAt: d.createdAt,
            lastUpdated: d.lastUpdated,
            snippet: '⚠️ Unable to decrypt',
            isProtected: d.isProtected,
          };
        }
      })
    );

    // Sort by last updated (newest first)
    return decryptedDrafts.sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error("Failed to load drafts", error);
    return [];
  }
}

/**
 * Get full decrypted content of a draft
 */
export async function getDraftContent(id: string, isProtected: boolean): Promise<string | null> {
  const rawDrafts = await loadRawDrafts();
  const draft = rawDrafts.find(d => d.id === id);
  if (!draft) return null;

  try {
    // Layer 1: Decrypt with device key
    let content = await decryptFromStorage(draft.content);

    // Layer 2: If protected, decrypt with password key
    if (isProtected) {
      content = await removePasswordProtection(content);
    }

    return content;
  } catch (error) {
    console.error("Failed to decrypt draft", error);
    return null;
  }
}

/**
 * Save a draft (encrypts before storage)
 */
export async function saveDraft(
  id: string,
  content: string,
  isProtected: boolean = false,
  createdAt?: number
): Promise<void> {
  if (!content.trim()) return;

  const rawDrafts = await loadRawDrafts();
  const now = Date.now();

  // Prepare content for storage
  let contentToStore = content;

  // Layer 2: If protected, encrypt with password key first
  if (isProtected) {
    contentToStore = await addPasswordProtection(content);
  }

  // Layer 1: Encrypt with device key
  const encryptedContent = await encryptForStorage(contentToStore);

  // Snippet: first 100 chars, encrypted
  const snippetText = isProtected
    ? '🔒 Protected note'
    : content.slice(0, 100).replace(/\n/g, ' ');
  const encryptedSnippet = await encryptForStorage(snippetText);

  const existingIndex = rawDrafts.findIndex(d => d.id === id);

  const newDraft: StoredDraft = {
    id,
    content: encryptedContent,
    createdAt: existingIndex >= 0 ? rawDrafts[existingIndex].createdAt : (createdAt || now),
    lastUpdated: now,
    snippet: encryptedSnippet,
    isProtected,
  };

  if (existingIndex >= 0) {
    rawDrafts[existingIndex] = newDraft;
  } else {
    rawDrafts.unshift(newDraft);
  }

  saveRawDrafts(rawDrafts);
}

/**
 * Delete a draft
 */
export async function deleteDraft(id: string): Promise<void> {
  const rawDrafts = await loadRawDrafts();
  const filtered = rawDrafts.filter(d => d.id !== id);
  saveRawDrafts(filtered);
}

export const createNewSessionId = (): string => {
  return generateId();
};

export const getRetentionPeriod = (): number => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return DRAFT_RETENTION_MS;
    const settings = JSON.parse(stored);
    return typeof settings.retentionMs === 'number' ? settings.retentionMs : DRAFT_RETENTION_MS;
  } catch {
    return DRAFT_RETENTION_MS;
  }
};

export const setRetentionPeriod = (ms: number): void => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    const settings = stored ? JSON.parse(stored) : {};
    settings.retentionMs = ms;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save settings", error);
  }
};

export const cleanupOldDrafts = async (): Promise<void> => {
  try {
    const rawDrafts = await loadRawDrafts();
    const now = Date.now();
    const retentionMs = getRetentionPeriod();
    const freshDrafts = rawDrafts.filter(d => (now - d.lastUpdated) < retentionMs);

    if (rawDrafts.length !== freshDrafts.length) {
      saveRawDrafts(freshDrafts);
      console.log(`Cleaned up ${rawDrafts.length - freshDrafts.length} expired drafts.`);
    }
  } catch (error) {
    console.error("Cleanup failed", error);
  }
};

// --- Settings for encryption ---

const ENCRYPTION_SETTINGS_KEY = 'pad-encryption-settings';

export interface EncryptionSettings {
  requirePasswordOnStart: boolean;
}

export function getEncryptionSettings(): EncryptionSettings {
  try {
    const stored = localStorage.getItem(ENCRYPTION_SETTINGS_KEY);
    if (!stored) return { requirePasswordOnStart: false };
    return JSON.parse(stored);
  } catch {
    return { requirePasswordOnStart: false };
  }
}

export function setEncryptionSettings(settings: EncryptionSettings): void {
  localStorage.setItem(ENCRYPTION_SETTINGS_KEY, JSON.stringify(settings));
}
