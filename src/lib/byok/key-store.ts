/**
 * Jarre - BYOK Key Store
 *
 * Client-side encrypted storage for user-provided API keys.
 * Keys are encrypted with AES-GCM using a key derived from the user's session token (PBKDF2).
 * Stored in localStorage, decrypted into an in-memory cache on load.
 */

const STORAGE_KEY = 'jarre-byok-keys';
const PBKDF2_ITERATIONS = 100_000;

export interface ByokKeys {
  deepseek?: string;
  gemini?: string;
}

// In-memory cache for fast synchronous access
let cachedKeys: ByokKeys | null = null;

/**
 * Derive an AES-GCM key from a session token using PBKDF2.
 */
async function deriveKey(sessionToken: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionToken),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt and store API keys in localStorage.
 */
export async function storeKeys(keys: ByokKeys, sessionToken: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const derivedKey = await deriveKey(sessionToken, salt);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(keys));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    derivedKey,
    plaintext,
  );

  const payload = {
    salt: arrayToBase64(salt),
    iv: arrayToBase64(iv),
    data: arrayToBase64(new Uint8Array(ciphertext)),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  cachedKeys = keys;
}

/**
 * Load and decrypt API keys from localStorage.
 * Returns null if no keys stored or decryption fails.
 */
export async function loadKeys(sessionToken: string): Promise<ByokKeys | null> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const { salt, iv, data } = JSON.parse(raw);
    const derivedKey = await deriveKey(sessionToken, base64ToArray(salt));

    const ivArr = base64ToArray(iv);
    const dataArr = base64ToArray(data);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArr.buffer as ArrayBuffer },
      derivedKey,
      dataArr.buffer as ArrayBuffer,
    );

    const decoder = new TextDecoder();
    const keys: ByokKeys = JSON.parse(decoder.decode(plaintext));
    cachedKeys = keys;
    return keys;
  } catch {
    // Decryption failed (wrong session, corrupted data, etc.)
    return null;
  }
}

/**
 * Get cached keys synchronously. Returns null if not loaded yet.
 */
export function getStoredKeys(): ByokKeys {
  return cachedKeys || {};
}

/**
 * Clear stored keys from localStorage and memory cache.
 */
export function clearKeys(): void {
  localStorage.removeItem(STORAGE_KEY);
  cachedKeys = null;
}

/**
 * Check if any keys are currently stored.
 */
export function hasStoredKeys(): boolean {
  return cachedKeys !== null && (!!cachedKeys.deepseek || !!cachedKeys.gemini);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function arrayToBase64(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr));
}

function base64ToArray(base64: string): Uint8Array {
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}
