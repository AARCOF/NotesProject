export type SharedTaskPriority = 'alta' | 'media' | 'baja';
export type SharedTaskStatus = 'pendiente' | 'en_progreso' | 'entregada' | 'devuelta' | 'completada';

export interface SharedSpaceCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface SharedChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
}

export interface SharedSpace {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdByName: string;
  participantIds: string[];
  participantNames?: { [userId: string]: string };
  participantEmails?: { [userId: string]: string };
  categories?: SharedSpaceCategory[];
  createdAt: string;
  updatedAt?: string;
  status: 'active' | 'archived';
  color?: string;
}

export interface SharedTask {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  priority: SharedTaskPriority;
  status: SharedTaskStatus;
  category?: string;
  categoryColor?: string;
  creatorId: string;
  creatorName: string;
  assignedToId?: string;
  assignedToName?: string;
  dueDate?: string;
  dueTime?: string;
  checklist?: SharedChecklistItem[];
  deliveryNotes?: string;
  deliveredAt?: string;
  deliveredBy?: string;
  deliveredByName?: string;
  returnNotes?: string;
  returnedAt?: string;
  returnedBy?: string;
  returnedByName?: string;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  lastModifiedBy?: string;
  lastModifiedByName?: string;
  lastModifiedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SharedNotification {
  id: string;
  spaceId: string;
  spaceTitle?: string;
  taskId?: string;
  taskTitle?: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  message: string;
  type: 'created' | 'updated' | 'delivered' | 'returned' | 'completed' | 'checklist' | 'category';
  read: boolean;
  createdAt: string;
}
