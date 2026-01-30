/**
 * Crypto Service for Pad
 * 
 * Two-layer encryption:
 * 1. Device Key (stored in IndexedDB) - encrypts all notes at rest
 * 2. Password Key (derived from user password) - additional layer for protected notes
 */

const DB_NAME = 'pad-secure';
const STORE_NAME = 'keys';
const DEVICE_KEY_ID = 'device-key';
const PASSWORD_HASH_KEY = 'password-hash';
const SESSION_KEY_NAME = 'pad-session-key';

// --- IndexedDB Helpers ---

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function getFromDB<T>(key: string): Promise<T | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.value ?? null);
    });
}

async function saveToDB<T>(key: string, value: T): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put({ id: key, value });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// --- Device Key Management ---

async function generateDeviceKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable for storage
        ['encrypt', 'decrypt']
    );
}

async function exportKey(key: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('raw', key);
    return bufferToBase64(exported);
}

async function importKey(keyData: string): Promise<CryptoKey> {
    const raw = base64ToBuffer(keyData);
    return crypto.subtle.importKey(
        'raw',
        raw.buffer as ArrayBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

let cachedDeviceKey: CryptoKey | null = null;

export async function getDeviceKey(): Promise<CryptoKey> {
    if (cachedDeviceKey) return cachedDeviceKey;

    const storedKey = await getFromDB<string>(DEVICE_KEY_ID);
    if (storedKey) {
        cachedDeviceKey = await importKey(storedKey);
        return cachedDeviceKey;
    }

    // First time: generate and store
    const newKey = await generateDeviceKey();
    const exported = await exportKey(newKey);
    await saveToDB(DEVICE_KEY_ID, exported);
    cachedDeviceKey = newKey;
    return newKey;
}

// --- Password Key Management ---

async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt.buffer as ArrayBuffer,
            iterations: 100000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function setupPassword(password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKeyFromPassword(password, salt);

    // Store a verification hash (encrypt a known string)
    const verificationData = new TextEncoder().encode('pad-verification');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        verificationData
    );

    const hashData = {
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        encrypted: bufferToBase64(encrypted),
    };

    await saveToDB(PASSWORD_HASH_KEY, hashData);

    // Store key in session
    storeSessionKey(password, salt);
}

export async function verifyPassword(password: string): Promise<boolean> {
    const hashData = await getFromDB<{ salt: string; iv: string; encrypted: string }>(PASSWORD_HASH_KEY);
    if (!hashData) return false;

    try {
        const salt = base64ToBuffer(hashData.salt);
        const iv = base64ToBuffer(hashData.iv);
        const encrypted = base64ToBuffer(hashData.encrypted);

        const key = await deriveKeyFromPassword(password, new Uint8Array(salt));
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(iv) },
            key,
            encrypted.buffer as ArrayBuffer
        );

        const decoded = new TextDecoder().decode(decrypted);
        if (decoded === 'pad-verification') {
            // Store key in session
            storeSessionKey(password, new Uint8Array(salt));
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export async function isPasswordSetup(): Promise<boolean> {
    const hashData = await getFromDB<{ salt: string }>(PASSWORD_HASH_KEY);
    return hashData !== null;
}

// --- Session Key Storage ---

function storeSessionKey(password: string, salt: Uint8Array): void {
    // Store password + salt in sessionStorage (cleared on tab close)
    const sessionData = {
        password,
        salt: bufferToBase64(salt),
    };
    sessionStorage.setItem(SESSION_KEY_NAME, JSON.stringify(sessionData));
}

export async function getSessionPasswordKey(): Promise<CryptoKey | null> {
    const stored = sessionStorage.getItem(SESSION_KEY_NAME);
    if (!stored) return null;

    try {
        const { password, salt } = JSON.parse(stored);
        return await deriveKeyFromPassword(password, base64ToBuffer(salt));
    } catch {
        return null;
    }
}

export function isSessionUnlocked(): boolean {
    return sessionStorage.getItem(SESSION_KEY_NAME) !== null;
}

export function lockSession(): void {
    sessionStorage.removeItem(SESSION_KEY_NAME);
}

// --- Encryption / Decryption ---

export async function encrypt(plaintext: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoded
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return bufferToBase64(combined);
}

export async function decrypt(ciphertext: string, key: CryptoKey): Promise<string> {
    const combined = base64ToBuffer(ciphertext);
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
    );

    return new TextDecoder().decode(decrypted);
}

// --- Utility Functions ---

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// --- High-Level API for Notes ---

/**
 * Encrypt content for storage (Layer 1: Device Key)
 */
export async function encryptForStorage(content: string): Promise<string> {
    const deviceKey = await getDeviceKey();
    return encrypt(content, deviceKey);
}

/**
 * Decrypt content from storage (Layer 1: Device Key)
 */
export async function decryptFromStorage(encrypted: string): Promise<string> {
    const deviceKey = await getDeviceKey();
    return decrypt(encrypted, deviceKey);
}

/**
 * Add password protection layer (Layer 2)
 */
export async function addPasswordProtection(content: string): Promise<string> {
    const passwordKey = await getSessionPasswordKey();
    if (!passwordKey) throw new Error('Session not unlocked');
    return encrypt(content, passwordKey);
}

/**
 * Remove password protection layer (Layer 2)
 */
export async function removePasswordProtection(encrypted: string): Promise<string> {
    const passwordKey = await getSessionPasswordKey();
    if (!passwordKey) throw new Error('Session not unlocked');
    return decrypt(encrypted, passwordKey);
}
