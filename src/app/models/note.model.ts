export type PriorityLevel = 'alta' | 'media' | 'baja';
export type NoteStatus = 'pendiente' | 'en_progreso' | 'completada';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  userId?: string;
  title: string;
  content: string;
  priority: PriorityLevel;
  categoryId: string;
  createdAt: string;
  completedAt?: string;
  dueDate?: string;
  status: NoteStatus;
  isPinned?: boolean;
  reminderSent?: boolean;
  checklist?: ChecklistItem[];
}

