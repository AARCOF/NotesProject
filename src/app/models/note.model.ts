export type PriorityLevel = 'alta' | 'media' | 'baja';
export type NoteStatus = 'pendiente' | 'en_progreso' | 'completada';

export interface Note {
  id: string;
  title: string;
  content: string;
  priority: PriorityLevel;
  categoryId: string;
  createdAt: string;
  dueDate?: string;
  status: NoteStatus;
  isPinned?: boolean;
}
