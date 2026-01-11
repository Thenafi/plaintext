import { Draft } from '../types';
import { STORAGE_KEY, DRAFT_RETENTION_MS, SETTINGS_KEY } from '../constants';

// Generate a simple unique ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getDrafts = (): Draft[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const drafts: Draft[] = JSON.parse(stored);

    // Sort by last updated (newest first)
    return drafts.sort((a, b) => b.lastUpdated - a.lastUpdated);
  } catch (error) {
    console.error("Failed to load drafts", error);
    return [];
  }
};

export const saveDraft = (id: string, content: string, createdAt?: number): void => {
  if (!content.trim()) return; // Don't save empty drafts logic is handled in component usually, but safety here

  const drafts = getDrafts();
  const now = Date.now();
  const existingIndex = drafts.findIndex(d => d.id === id);

  if (existingIndex >= 0) {
    drafts[existingIndex] = {
      ...drafts[existingIndex],
      content,
      lastUpdated: now,
      snippet: content.slice(0, 100).replace(/\n/g, ' ')
    };
  } else {
    drafts.unshift({
      id,
      content,
      createdAt: createdAt || now,
      lastUpdated: now,
      snippet: content.slice(0, 100).replace(/\n/g, ' ')
    });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
};

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

export const cleanupOldDrafts = (): void => {
  try {
    const drafts = getDrafts();
    const now = Date.now();
    const retentionMs = getRetentionPeriod();
    const freshDrafts = drafts.filter(d => (now - d.lastUpdated) < retentionMs);

    if (drafts.length !== freshDrafts.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(freshDrafts));
      console.log(`Cleaned up ${drafts.length - freshDrafts.length} expired drafts.`);
    }
  } catch (error) {
    console.error("Cleanup failed", error);
  }
};
