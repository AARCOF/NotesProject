import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { SharedSpace, SharedTask, SharedNotification, SharedTaskStatus, SharedChecklistItem, SharedSpaceCategory } from '../models/shared-task.model';
import { AuthService } from '../core/services/auth.service';
import { User } from '../core/models/user.model';
import { AutomatedReminderService } from '../core/services/automated-reminder.service';

const SPACES_KEY = 'noteyou_shared_spaces_v1';
const TASKS_KEY = 'noteyou_shared_tasks_v1';
const NOTIFS_KEY = 'noteyou_shared_notifications_v1';

@Injectable({
  providedIn: 'root'
})
export class SharedTasksService {
  private spacesSubject = new BehaviorSubject<SharedSpace[]>([]);
  public spaces$: Observable<SharedSpace[]> = this.spacesSubject.asObservable();

  private tasksSubject = new BehaviorSubject<SharedTask[]>([]);
  public tasks$: Observable<SharedTask[]> = this.tasksSubject.asObservable();

  private notificationsSubject = new BehaviorSubject<SharedNotification[]>([]);
  public notifications$: Observable<SharedNotification[]> = this.notificationsSubject.asObservable();

  private activeSpaceIdSubject = new BehaviorSubject<string | null>(null);
  public activeSpaceId$: Observable<string | null> = this.activeSpaceIdSubject.asObservable();

  private openCreateTaskRequestSubject = new BehaviorSubject<boolean>(false);
  public openCreateTaskRequest$: Observable<boolean> = this.openCreateTaskRequestSubject.asObservable();

  public requestOpenCreateTaskModal(): void {
    this.openCreateTaskRequestSubject.next(true);
  }

  private currentUser: User | null = null;
  private autoSyncTimer: any = null;

  constructor(
    private authService: AuthService,
    private reminderService: AutomatedReminderService,
    private http: HttpClient
  ) {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.loadInitialData();
      this.initAutoSync();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', () => this.loadInitialData());
      window.addEventListener('focus', () => this.fetchCloudSharedData());
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) this.fetchCloudSharedData();
        });
      }
    }
  }

  private initAutoSync(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.currentUser) {
      this.fetchCloudSharedData();
      this.autoSyncTimer = setInterval(() => {
        this.fetchCloudSharedData();
      }, 4000);
    }
  }

  public loadInitialData(): void {
    const spaces = this.getStoredSpaces();
    const tasks = this.getStoredTasks();
    const notifs = this.getStoredNotifications();

    this.spacesSubject.next(spaces);
    this.tasksSubject.next(tasks);
    this.notificationsSubject.next(notifs);

    if (spaces.length > 0 && !this.activeSpaceIdSubject.value) {
      const userSpaces = this.getAccessibleSpaces(spaces);
      if (userSpaces.length > 0) {
        this.activeSpaceIdSubject.next(userSpaces[0].id);
      }
    }

    if (this.currentUser) {
      this.fetchCloudSharedData();
    }
  }

  public fetchCloudSharedData(): void {
    if (!this.currentUser) return;

    this.http.get<{
      success: boolean;
      spaces: SharedSpace[];
      tasks: SharedTask[];
      notifications: SharedNotification[];
    }>('/api/shared-tasks').subscribe({
      next: (res) => {
        if (res && res.success) {
          const cloudSpaces = res.spaces || [];
          const cloudTasks = res.tasks || [];
          const cloudNotifs = res.notifications || [];

          // Guardamos directamente los datos autoritativos de la nube
          this.saveSpaces(cloudSpaces);
          this.saveTasks(cloudTasks);
          this.saveNotifications(cloudNotifs);

          if (cloudSpaces.length > 0) {
            const currentActiveId = this.activeSpaceIdSubject.value;
            const accessible = this.getAccessibleSpaces(cloudSpaces);
            if (!currentActiveId || !accessible.some(s => s.id === currentActiveId)) {
              if (accessible.length > 0) {
                this.activeSpaceIdSubject.next(accessible[0].id);
              }
            }
          }
        }
      },
      error: () => {}
    });
  }

  // --- GETTERS & FILTERING ---
  public getAccessibleSpaces(allSpaces: SharedSpace[] = this.spacesSubject.value): SharedSpace[] {
    if (!this.currentUser) return [];
    if (
      this.currentUser.role === 'admin' || 
      this.currentUser.role === 'superadmin' || 
      this.authService.isAdminOrSuperAdmin()
    ) {
      return allSpaces;
    }

    const currentId = (this.currentUser.id || '').toString();
    const currentEmail = (this.currentUser.email || '').toLowerCase().trim();

    return allSpaces.filter(s => {
      if (!s) return false;
      if (s.createdBy && s.createdBy.toString() === currentId) return true;
      if (Array.isArray(s.participantIds) && s.participantIds.some(pid => pid && pid.toString() === currentId)) return true;
      if (s.participantEmails) {
        const emails = Object.values(s.participantEmails).map(e => (e || '').toLowerCase().trim());
        if (emails.includes(currentEmail)) return true;
      }
      return false;
    });
  }

  public getTasksForSpace(spaceId: string): SharedTask[] {
    return this.tasksSubject.value.filter(t => t.spaceId === spaceId);
  }

  public getNotificationsForCurrentUser(): SharedNotification[] {
    if (!this.currentUser) return [];
    return this.notificationsSubject.value
      .filter(n => n.recipientId === this.currentUser!.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getUnreadNotificationCount(): number {
    return this.getNotificationsForCurrentUser().filter(n => !n.read).length;
  }

  public setActiveSpace(spaceId: string): void {
    this.activeSpaceIdSubject.next(spaceId);
  }

  // --- CRUD SPACES (Admins & SuperAdmins Only) ---
  public createSpace(
    title: string,
    description: string,
    participantIds: string[],
    participantDetails: { [id: string]: { name: string; email: string } } = {}
  ): SharedSpace {
    if (!this.authService.isAdminOrSuperAdmin()) {
      throw new Error('Solo los administradores y superadministradores pueden crear espacios de tareas compartidas.');
    }

    const currentSpaces = this.getStoredSpaces();
    const names: { [id: string]: string } = {};
    const emails: { [id: string]: string } = {};

    const currentUserId = this.currentUser?.id || 'admin';
    const allParticipantIds = Array.from(new Set([...participantIds, currentUserId]));

    allParticipantIds.forEach(id => {
      if (participantDetails[id]) {
        names[id] = participantDetails[id].name;
        emails[id] = participantDetails[id].email;
      }
    });
    if (this.currentUser) {
      names[currentUserId] = this.currentUser.name;
      emails[currentUserId] = this.currentUser.email;
    }

    const colors = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newSpace: SharedSpace = {
      id: 'space_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: title.trim(),
      description: description.trim(),
      createdBy: currentUserId,
      createdByName: this.currentUser?.name || 'Administrador',
      participantIds: allParticipantIds,
      participantNames: names,
      participantEmails: emails,
      createdAt: new Date().toISOString(),
      status: 'active',
      color: randomColor
    };

    const updated = [newSpace, ...currentSpaces];
    this.saveSpaces(updated);
    this.activeSpaceIdSubject.next(newSpace.id);

    // Sync con MongoDB
    this.http.post('/api/shared-tasks', { type: 'space', data: newSpace }).subscribe({ error: () => {} });

    // Enviar notificación a los participantes añadidos
    participantIds.forEach(pId => {
      if (pId !== this.currentUser?.id) {
        const notifMsg = `Has sido añadido al espacio colaborativo "${newSpace.title}" por ${this.currentUser?.name || 'un Administrador'}.`;
        this.emitNotification({
          spaceId: newSpace.id,
          spaceTitle: newSpace.title,
          senderId: this.currentUser?.id || 'system',
          senderName: this.currentUser?.name || 'Administrador',
          recipientId: pId,
          message: notifMsg,
          type: 'created'
        });

        this.reminderService.triggerDeviceNotification(
          `👥 Nuevo Espacio: ${newSpace.title}`,
          notifMsg,
          `space_${newSpace.id}_${pId}`
        );
      }
    });

    return newSpace;
  }

  public deleteSpace(spaceId: string): void {
    const currentSpaces = this.getStoredSpaces();
    const space = currentSpaces.find(s => s.id === spaceId);
    if (!space) return;

    if (!this.authService.isAdminOrSuperAdmin() && space.createdBy !== this.currentUser?.id) {
      throw new Error('No tienes permisos para eliminar este espacio de trabajo.');
    }

    const updatedSpaces = currentSpaces.filter(s => s.id !== spaceId);
    this.saveSpaces(updatedSpaces);

    // Eliminar también sus tareas asociadas
    const currentTasks = this.getStoredTasks().filter(t => t.spaceId !== spaceId);
    this.saveTasks(currentTasks);

    const remaining = this.getAccessibleSpaces(updatedSpaces);
    this.activeSpaceIdSubject.next(remaining.length > 0 ? remaining[0].id : null);

    // Sync Delete con MongoDB
    this.http.delete(`/api/shared-tasks?type=space&id=${spaceId}`).subscribe({
      next: () => {
        this.fetchCloudSharedData();
      },
      error: (err) => {
        console.error('Error al eliminar espacio en MongoDB:', err);
      }
    });
  }

  // --- CRUD SPACES CATEGORIES (Any participant in the space) ---
  public addCategoryToSpace(spaceId: string, categoryName: string, color: string = '#0284c7', icon: string = 'typcn-tag'): SharedSpace {
    const currentSpaces = this.getStoredSpaces();
    const idx = currentSpaces.findIndex(s => s.id === spaceId);
    if (idx === -1) throw new Error('Espacio no encontrado');

    const space = currentSpaces[idx];
    const categories = space.categories || [];
    
    const cleanName = categoryName.trim();
    if (categories.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
      return space;
    }

    const newCategory: SharedSpaceCategory = {
      id: 'scat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: cleanName,
      color: color,
      icon: icon
    };

    const updatedSpace: SharedSpace = {
      ...space,
      categories: [...categories, newCategory],
      updatedAt: new Date().toISOString()
    };

    currentSpaces[idx] = updatedSpace;
    this.saveSpaces(currentSpaces);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'space', data: updatedSpace }).subscribe({ error: () => {} });

    this.notifyOtherParticipants(
      updatedSpace,
      '',
      updatedSpace.title,
      `${this.currentUser?.name || 'Un colaborador'} añadió la categoría "${newCategory.name}" al espacio.`,
      'category'
    );

    return updatedSpace;
  }

  public deleteCategoryFromSpace(spaceId: string, categoryId: string): SharedSpace {
    const currentSpaces = this.getStoredSpaces();
    const idx = currentSpaces.findIndex(s => s.id === spaceId);
    if (idx === -1) throw new Error('Espacio no encontrado');

    const space = currentSpaces[idx];
    const catToDelete = (space.categories || []).find(c => c.id === categoryId);
    const updatedCategories = (space.categories || []).filter(c => c.id !== categoryId);

    const updatedSpace: SharedSpace = {
      ...space,
      categories: updatedCategories,
      updatedAt: new Date().toISOString()
    };

    currentSpaces[idx] = updatedSpace;
    this.saveSpaces(currentSpaces);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'space', data: updatedSpace }).subscribe({ error: () => {} });

    if (catToDelete) {
      this.notifyOtherParticipants(
        updatedSpace,
        '',
        updatedSpace.title,
        `${this.currentUser?.name || 'Un colaborador'} eliminó la categoría "${catToDelete.name}".`,
        'category'
      );
    }

    return updatedSpace;
  }

  // --- CRUD SHARED TASKS (Both Participants & Admins) ---
  public createTask(
    spaceId: string,
    taskData: {
      title: string;
      description?: string;
      priority: 'alta' | 'media' | 'baja';
      category?: string;
      categoryColor?: string;
      assignedToId?: string;
      assignedToName?: string;
      dueDate?: string;
      dueTime?: string;
      checklist?: string[];
    }
  ): SharedTask {
    const space = this.getStoredSpaces().find(s => s.id === spaceId);
    if (!space) throw new Error('Espacio no encontrado');

    const checklistItems: SharedChecklistItem[] = (taskData.checklist || []).map((text, idx) => ({
      id: 'chk_' + Date.now() + '_' + idx,
      text: text.trim(),
      completed: false
    }));

    const newTask: SharedTask = {
      id: 'stask_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      spaceId: spaceId,
      title: taskData.title.trim(),
      description: taskData.description?.trim() || '',
      priority: taskData.priority,
      status: 'pendiente',
      category: taskData.category,
      categoryColor: taskData.categoryColor,
      creatorId: this.currentUser?.id || 'anonymous',
      creatorName: this.currentUser?.name || 'Colaborador',
      assignedToId: taskData.assignedToId,
      assignedToName: taskData.assignedToName,
      dueDate: taskData.dueDate,
      dueTime: taskData.dueTime,
      checklist: checklistItems,
      createdAt: new Date().toISOString(),
      lastModifiedBy: this.currentUser?.id,
      lastModifiedByName: this.currentUser?.name,
      lastModifiedAt: new Date().toISOString()
    };

    const currentTasks = this.getStoredTasks();
    const updated = [newTask, ...currentTasks];
    this.saveTasks(updated);

    // Sync con MongoDB
    this.http.post('/api/shared-tasks', { type: 'task', data: newTask }).subscribe({ error: () => {} });

    this.notifyOtherParticipants(
      space,
      newTask.id,
      newTask.title,
      `${this.currentUser?.name || 'Un colaborador'} creó el entregable: "${newTask.title}"`,
      'created'
    );

    return newTask;
  }

  public updateTask(taskId: string, changes: Partial<SharedTask>): SharedTask {
    const currentTasks = this.getStoredTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Tarea no encontrada');

    const existing = currentTasks[idx];
    const space = this.getStoredSpaces().find(s => s.id === existing.spaceId);

    const updatedTask: SharedTask = {
      ...existing,
      ...changes,
      lastModifiedBy: this.currentUser?.id,
      lastModifiedByName: this.currentUser?.name,
      lastModifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    currentTasks[idx] = updatedTask;
    this.saveTasks(currentTasks);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'task', data: updatedTask }).subscribe({ error: () => {} });

    if (space) {
      this.notifyOtherParticipants(
        space,
        updatedTask.id,
        updatedTask.title,
        `${this.currentUser?.name || 'Un colaborador'} actualizó los detalles de: "${updatedTask.title}"`,
        'updated'
      );
    }

    return updatedTask;
  }

  public returnTaskWithFeedback(taskId: string, returnNotes: string): SharedTask {
    const currentTasks = this.getStoredTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Tarea no encontrada');

    const existing = currentTasks[idx];
    const space = this.getStoredSpaces().find(s => s.id === existing.spaceId);

    const updatedTask: SharedTask = {
      ...existing,
      status: 'devuelta',
      returnNotes: returnNotes.trim(),
      returnedAt: new Date().toISOString(),
      returnedBy: this.currentUser?.id,
      returnedByName: this.currentUser?.name,
      lastModifiedBy: this.currentUser?.id,
      lastModifiedByName: this.currentUser?.name,
      lastModifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    currentTasks[idx] = updatedTask;
    this.saveTasks(currentTasks);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'task', data: updatedTask }).subscribe({ error: () => {} });

    if (space) {
      const commentSnippet = returnNotes.trim() ? `: "${returnNotes.trim()}"` : '';
      this.notifyOtherParticipants(
        space,
        updatedTask.id,
        updatedTask.title,
        `${this.currentUser?.name || 'Un colaborador'} solicitó correcciones y devolvió la entrega "${updatedTask.title}"${commentSnippet}`,
        'returned'
      );
    }

    return updatedTask;
  }

  public updateTaskStatus(taskId: string, newStatus: SharedTaskStatus, deliveryNotes?: string): SharedTask {
    const currentTasks = this.getStoredTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Tarea no encontrada');

    const existing = currentTasks[idx];
    const space = this.getStoredSpaces().find(s => s.id === existing.spaceId);

    const updates: Partial<SharedTask> = {
      status: newStatus,
      lastModifiedBy: this.currentUser?.id,
      lastModifiedByName: this.currentUser?.name,
      lastModifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (deliveryNotes !== undefined) {
      updates.deliveryNotes = deliveryNotes;
    }

    if (newStatus === 'entregada') {
      updates.deliveredAt = new Date().toISOString();
      updates.deliveredBy = this.currentUser?.id;
      updates.deliveredByName = this.currentUser?.name;
    } else if (newStatus === 'completada') {
      updates.completedAt = new Date().toISOString();
      updates.completedBy = this.currentUser?.id;
      updates.completedByName = this.currentUser?.name;
    } else if (newStatus === 'devuelta') {
      updates.returnedAt = new Date().toISOString();
      updates.returnedBy = this.currentUser?.id;
      updates.returnedByName = this.currentUser?.name;
      if (deliveryNotes) {
        updates.returnNotes = deliveryNotes;
      }
    }

    const updatedTask: SharedTask = { ...existing, ...updates };
    currentTasks[idx] = updatedTask;
    this.saveTasks(currentTasks);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'task', data: updatedTask }).subscribe({ error: () => {} });

    if (space) {
      const actionVerb = newStatus === 'entregada' ? 'marcó como entregada la tarea' :
                         newStatus === 'completada' ? 'completó y aprobó la entrega' :
                         newStatus === 'devuelta' ? 'solicitó correcciones y devolvió la tarea' :
                         newStatus === 'en_progreso' ? 'inició el trabajo en' : 'actualizó el estado de';
      this.notifyOtherParticipants(
        space,
        updatedTask.id,
        updatedTask.title,
        `${this.currentUser?.name || 'Un colaborador'} ${actionVerb}: "${updatedTask.title}"`,
        newStatus === 'entregada' ? 'delivered' : newStatus === 'completada' ? 'completed' : newStatus === 'devuelta' ? 'returned' : 'updated'
      );
    }

    return updatedTask;
  }

  public toggleChecklistItem(taskId: string, itemId: string): SharedTask {
    const currentTasks = this.getStoredTasks();
    const idx = currentTasks.findIndex(t => t.id === taskId);
    if (idx === -1) throw new Error('Tarea no encontrada');

    const existing = currentTasks[idx];
    const space = this.getStoredSpaces().find(s => s.id === existing.spaceId);

    let changedItemText = '';
    let isNowCompleted = false;

    const updatedChecklist = (existing.checklist || []).map(item => {
      if (item.id === itemId) {
        const nextState = !item.completed;
        changedItemText = item.text;
        isNowCompleted = nextState;
        return {
          ...item,
          completed: nextState,
          completedBy: nextState ? this.currentUser?.id : undefined,
          completedByName: nextState ? this.currentUser?.name : undefined,
          completedAt: nextState ? new Date().toISOString() : undefined
        };
      }
      return item;
    });

    const updatedTask: SharedTask = {
      ...existing,
      checklist: updatedChecklist,
      lastModifiedBy: this.currentUser?.id,
      lastModifiedByName: this.currentUser?.name,
      lastModifiedAt: new Date().toISOString()
    };

    currentTasks[idx] = updatedTask;
    this.saveTasks(currentTasks);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'task', data: updatedTask }).subscribe({ error: () => {} });

    if (space && changedItemText) {
      this.notifyOtherParticipants(
        space,
        updatedTask.id,
        updatedTask.title,
        `${this.currentUser?.name || 'Un colaborador'} ${isNowCompleted ? 'completó' : 'desmarcó'} el ítem "${changedItemText}" en "${updatedTask.title}"`,
        'checklist'
      );
    }

    return updatedTask;
  }

  public deleteTask(taskId: string): void {
    const currentTasks = this.getStoredTasks();
    const task = currentTasks.find(t => t.id === taskId);
    const updated = currentTasks.filter(t => t.id !== taskId);
    this.saveTasks(updated);

    // Sync Delete con MongoDB
    this.http.delete(`/api/shared-tasks?type=task&id=${taskId}`).subscribe({
      next: () => {
        this.fetchCloudSharedData();
      },
      error: (err) => {
        console.error('Error al eliminar tarea compartida en MongoDB:', err);
      }
    });

    if (task) {
      const space = this.getStoredSpaces().find(s => s.id === task.spaceId);
      if (space) {
        this.notifyOtherParticipants(
          space,
          task.id,
          task.title,
          `${this.currentUser?.name || 'Un colaborador'} eliminó la entrega "${task.title}"`,
          'updated'
        );
      }
    }
  }

  // --- NOTIFICATIONS DISPATCH & MANAGEMENT ---
  private notifyOtherParticipants(
    space: SharedSpace,
    taskId: string,
    taskTitle: string,
    message: string,
    type: 'created' | 'updated' | 'delivered' | 'returned' | 'completed' | 'checklist' | 'category'
  ): void {
    const currentUserId = this.currentUser?.id;
    const recipients = space.participantIds.filter(id => id !== currentUserId);

    recipients.forEach(recipientId => {
      this.emitNotification({
        spaceId: space.id,
        spaceTitle: space.title,
        taskId: taskId,
        taskTitle: taskTitle,
        senderId: currentUserId || 'system',
        senderName: this.currentUser?.name || 'Colaborador',
        recipientId: recipientId,
        message: message,
        type: type
      });
    });

    this.reminderService.triggerDeviceNotification(
      `👥 Tarea Compartida: ${space.title}`,
      message,
      `shared_${taskId}_${Date.now()}`
    );
  }

  private emitNotification(data: Omit<SharedNotification, 'id' | 'createdAt' | 'read'>): void {
    const notifs = this.getStoredNotifications();
    const newNotif: SharedNotification = {
      ...data,
      id: 'snotif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      read: false,
      createdAt: new Date().toISOString()
    };

    const updated = [newNotif, ...notifs];
    this.saveNotifications(updated);

    // Sync Notif con MongoDB
    this.http.post('/api/shared-tasks', { type: 'notification', data: newNotif }).subscribe({ error: () => {} });
  }

  public markNotificationAsRead(notifId: string): void {
    const notifs = this.getStoredNotifications().map(n => {
      if (n.id === notifId) return { ...n, read: true };
      return n;
    });
    this.saveNotifications(notifs);

    // Sync con MongoDB
    this.http.put('/api/shared-tasks', { type: 'notification', data: { id: notifId, read: true } }).subscribe({ error: () => {} });
  }

  public markAllNotificationsAsRead(): void {
    if (!this.currentUser) return;
    const currentUserId = this.currentUser.id;
    const notifs = this.getStoredNotifications().map(n => {
      if (n.recipientId === currentUserId) return { ...n, read: true };
      return n;
    });
    this.saveNotifications(notifs);

    const userNotifs = notifs.filter(n => n.recipientId === currentUserId);
    for (const un of userNotifs) {
      this.http.put('/api/shared-tasks', { type: 'notification', data: { id: un.id, read: true } }).subscribe({ error: () => {} });
    }
  }

  // --- STORAGE HELPERS ---
  private getStoredSpaces(): SharedSpace[] {
    try {
      const raw = localStorage.getItem(SPACES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveSpaces(spaces: SharedSpace[]): void {
    localStorage.setItem(SPACES_KEY, JSON.stringify(spaces));
    this.spacesSubject.next(spaces);
  }

  private getStoredTasks(): SharedTask[] {
    try {
      const raw = localStorage.getItem(TASKS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveTasks(tasks: SharedTask[]): void {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    this.tasksSubject.next(tasks);
  }

  private getStoredNotifications(): SharedNotification[] {
    try {
      const raw = localStorage.getItem(NOTIFS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveNotifications(notifs: SharedNotification[]): void {
    localStorage.setItem(NOTIFS_KEY, JSON.stringify(notifs));
    this.notificationsSubject.next(notifs);
  }
}
