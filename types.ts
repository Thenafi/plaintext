export interface Draft {
  id: string;
  content: string;
  createdAt: number; // Timestamp
  lastUpdated: number; // Timestamp
  snippet?: string;
}
