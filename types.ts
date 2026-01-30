export interface Draft {
  id: string;
  content: string; // Encrypted content (device key layer)
  createdAt: number; // Timestamp
  lastUpdated: number; // Timestamp
  snippet?: string; // Encrypted or obfuscated for protected notes
  isProtected?: boolean; // If true, content has password encryption layer
}
