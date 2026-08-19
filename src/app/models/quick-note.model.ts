export interface QuickNote {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  linkedTaskId?: string;
  expiresAt: number;
  retentionLabel: string;
  isPermanent?: boolean;
}
