import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { SharedTasksService } from '../../services/shared-tasks.service';
import { SharedSpace, SharedTask, SharedNotification, SharedTaskStatus, SharedTaskPriority, SharedSpaceCategory } from '../../models/shared-task.model';
import { AuthService } from '../../core/services/auth.service';
import { UserRepository } from '../../core/repositories/user.repository';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-shared-tasks',
  templateUrl: './shared-tasks.component.html',
  styleUrls: ['./shared-tasks.component.scss']
})
export class SharedTasksComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  spaces: SharedSpace[] = [];
  activeSpace: SharedSpace | null = null;
  tasks: SharedTask[] = [];
  notifications: SharedNotification[] = [];
  allUsers: User[] = [];

  // Filter & Search
  searchTerm: string = '';
  statusFilter: string = 'all'; // 'all', 'pendiente', 'en_progreso', 'entregada', 'devuelta', 'completada'
  priorityFilter: string = 'all';
  categoryFilter: string = 'all';
  mobileTab: 'entregas' | 'espacios' = 'entregas';
  viewMode: 'kanban' | 'grid' = 'kanban';

  // Modals & Panels
  isTaskModalOpen: boolean = false;
  isSpaceModalOpen: boolean = false;
  isDeliverModalOpen: boolean = false;
  isReturnModalOpen: boolean = false;
  isCategoryModalOpen: boolean = false;
  isViewModalOpen: boolean = false;
  isNotifsOpen: boolean = false;

  selectedTaskForView: SharedTask | null = null;
  editingTask: SharedTask | null = null;
  deliveringTask: SharedTask | null = null;
  returningTask: SharedTask | null = null;
  deliveryNotesInput: string = '';
  returnFeedbackInput: string = '';

  // New Category in Space (Any member)
  newCategoryName: string = '';
  newCategoryColor: string = '#0284c7';

  // Predefined Category Colors
  categoryColorPalette: string[] = [
    '#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#6366f1', '#14b8a6'
  ];

  // New Space Form (Admin/SuperAdmin)
  newSpaceTitle: string = '';
  newSpaceDesc: string = '';
  selectedUserIds: string[] = [];

  // New/Edit Task Form
  taskFormTitle: string = '';
  taskFormDesc: string = '';
  taskFormPriority: SharedTaskPriority = 'media';
  taskFormCategory: string = '';
  taskFormCategoryColor: string = '';
  taskFormAssignedTo: string = '';
  taskFormDueDate: string = '';
  taskFormDueTime: string = '';
  checklistInputs: string[] = [''];

  private subs = new Subscription();

  constructor(
    public sharedTasksService: SharedTasksService,
    public authService: AuthService,
    private userRepository: UserRepository
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();

    // Cargar usuarios del sistema para selección en espacios y tareas
    this.userRepository.getCloudUsers().subscribe(users => {
      this.allUsers = users.filter(u => u.isActive !== false);
    });

    // Suscribirse a Espacios
    this.subs.add(
      this.sharedTasksService.spaces$.subscribe(spaces => {
        this.spaces = this.sharedTasksService.getAccessibleSpaces(spaces);
        this.updateActiveSpace();
      })
    );

    // Suscribirse a Espacio Activo
    this.subs.add(
      this.sharedTasksService.activeSpaceId$.subscribe(activeId => {
        this.activeSpace = this.spaces.find(s => s.id === activeId) || (this.spaces.length > 0 ? this.spaces[0] : null);
        this.loadTasksForActiveSpace();
      })
    );

    // Suscribirse a Tareas
    this.subs.add(
      this.sharedTasksService.tasks$.subscribe(() => {
        this.loadTasksForActiveSpace();
      })
    );

    // Suscribirse a Notificaciones
    this.subs.add(
      this.sharedTasksService.notifications$.subscribe(() => {
        this.notifications = this.sharedTasksService.getNotificationsForCurrentUser();
      })
    );

    // Suscribirse a petición de apertura de modal desde FAB móvil
    this.subs.add(
      this.sharedTasksService.openCreateTaskRequest$.subscribe(open => {
        if (open) {
          this.openCreateTaskModal();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private updateActiveSpace(): void {
    if (!this.activeSpace && this.spaces.length > 0) {
      this.activeSpace = this.spaces[0];
      this.sharedTasksService.setActiveSpace(this.activeSpace.id);
    } else if (this.activeSpace) {
      this.activeSpace = this.spaces.find(s => s.id === this.activeSpace!.id) || (this.spaces.length > 0 ? this.spaces[0] : null);
    }
    this.loadTasksForActiveSpace();
  }

  public selectSpace(space: SharedSpace): void {
    this.activeSpace = space;
    this.sharedTasksService.setActiveSpace(space.id);
    this.loadTasksForActiveSpace();
  }

  public loadTasksForActiveSpace(): void {
    if (!this.activeSpace) {
      this.tasks = [];
      return;
    }
    this.tasks = this.sharedTasksService.getTasksForSpace(this.activeSpace.id);
  }

  get filteredTasks(): SharedTask[] {
    return this.tasks.filter(t => {
      const matchSearch = !this.searchTerm.trim() ||
        t.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        (t.assignedToName && t.assignedToName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (t.category && t.category.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchStatus = this.statusFilter === 'all' || t.status === this.statusFilter;
      const matchPriority = this.priorityFilter === 'all' || t.priority === this.priorityFilter;
      const matchCategory = this.categoryFilter === 'all' || t.category === this.categoryFilter;

      return matchSearch && matchStatus && matchPriority && matchCategory;
    });
  }

  get isAdminOrSuperAdmin(): boolean {
    return this.authService.isAdminOrSuperAdmin();
  }

  get unreadNotifsCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getTasksByStatus(status: SharedTaskStatus): SharedTask[] {
    return this.filteredTasks.filter(t => t.status === status);
  }

  openViewDetailsModal(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedTaskForView = task;
    this.isViewModalOpen = true;
  }

  quickMoveStatus(task: SharedTask, newStatus: SharedTaskStatus, event?: Event): void {
    if (event) event.stopPropagation();
    if (newStatus === 'entregada') {
      this.openDeliverModal(task, event);
    } else if (newStatus === 'devuelta') {
      this.openReturnModal(task, event);
    } else if (newStatus === 'completada') {
      this.approveAndComplete(task, event);
    } else {
      this.sharedTasksService.updateTaskStatus(task.id, newStatus);
    }
  }

  getTaskWatermarkColor(task: SharedTask): string {
    if (task.categoryColor) return task.categoryColor;
    if (task.priority === 'alta') return '#f43f5e';
    if (task.priority === 'media') return '#f59e0b';
    if (task.priority === 'baja') return '#10b981';
    return '#0284c7';
  }

  // --- STATS ---
  get totalCount(): number { return this.tasks.length; }
  get pendingCount(): number { return this.tasks.filter(t => t.status === 'pendiente').length; }
  get inProgressCount(): number { return this.tasks.filter(t => t.status === 'en_progreso').length; }
  get deliveredCount(): number { return this.tasks.filter(t => t.status === 'entregada').length; }
  get returnedCount(): number { return this.tasks.filter(t => t.status === 'devuelta').length; }
  get completedCount(): number { return this.tasks.filter(t => t.status === 'completada').length; }

  // --- CHECKLIST & PROGRESS ---
  getTaskProgress(task: SharedTask): number {
    if (!task.checklist || task.checklist.length === 0) {
      return task.status === 'completada' ? 100 : task.status === 'entregada' ? 85 : (task.status === 'en_progreso' || task.status === 'devuelta') ? 40 : 0;
    }
    const completed = task.checklist.filter(i => i.completed).length;
    return Math.round((completed / task.checklist.length) * 100);
  }

  toggleChecklist(task: SharedTask, itemId: string, event: Event): void {
    event.stopPropagation();
    this.sharedTasksService.toggleChecklistItem(task.id, itemId);
  }

  // Custom Modal Confirmation & Alert System (Reemplaza native confirm/alert)
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    icon: string;
    variant: 'danger' | 'warning' | 'info';
    action: (() => void) | null;
  } = {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    icon: 'typcn-trash',
    variant: 'danger',
    action: null
  };

  alertDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'warning' | 'info' | 'error';
  } = {
    isOpen: false,
    title: '',
    message: '',
    type: 'warning'
  };

  showConfirm(config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    icon?: string;
    onConfirm: () => void;
  }): void {
    this.confirmDialog = {
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirmar',
      cancelText: config.cancelText || 'Cancelar',
      variant: config.variant || 'danger',
      icon: config.icon || (config.variant === 'warning' ? 'typcn-warning' : 'typcn-trash'),
      action: config.onConfirm
    };
  }

  closeConfirm(): void {
    this.confirmDialog.isOpen = false;
    this.confirmDialog.action = null;
  }

  executeConfirm(): void {
    if (this.confirmDialog.action) {
      this.confirmDialog.action();
    }
    this.closeConfirm();
  }

  showAlert(title: string, message: string, type: 'warning' | 'info' | 'error' = 'warning'): void {
    this.alertDialog = {
      isOpen: true,
      title,
      message,
      type
    };
  }

  closeAlert(): void {
    this.alertDialog.isOpen = false;
  }

  // --- CATEGORY CREATION IN SPACE (Any Participant) ---
  openCreateCategoryModal(): void {
    if (!this.activeSpace) return;
    this.newCategoryName = '';
    this.newCategoryColor = '#0284c7';
    this.isCategoryModalOpen = true;
  }

  saveCategory(): void {
    if (!this.activeSpace) return;
    if (!this.newCategoryName.trim()) {
      this.showAlert('Categoría requerida', 'Por favor ingresa un nombre para la categoría.', 'warning');
      return;
    }

    this.sharedTasksService.addCategoryToSpace(
      this.activeSpace.id,
      this.newCategoryName.trim(),
      this.newCategoryColor
    );

    // Seleccionar automáticamente en el formulario si está abierto
    this.taskFormCategory = this.newCategoryName.trim();
    this.taskFormCategoryColor = this.newCategoryColor;
    this.isCategoryModalOpen = false;
  }

  deleteCategory(cat: SharedSpaceCategory, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.activeSpace) return;
    this.showConfirm({
      title: '¿Eliminar categoría?',
      message: `¿Estás seguro de eliminar la categoría "${cat.name}" de este espacio?`,
      confirmText: 'Sí, eliminar',
      variant: 'danger',
      onConfirm: () => {
        this.sharedTasksService.deleteCategoryFromSpace(this.activeSpace!.id, cat.id);
        if (this.categoryFilter === cat.name) {
          this.categoryFilter = 'all';
        }
        if (this.taskFormCategory === cat.name) {
          this.taskFormCategory = '';
          this.taskFormCategoryColor = '';
        }
      }
    });
  }

  selectCategoryInForm(cat: { name: string; color: string }): void {
    if (this.taskFormCategory === cat.name) {
      this.taskFormCategory = '';
      this.taskFormCategoryColor = '';
    } else {
      this.taskFormCategory = cat.name;
      this.taskFormCategoryColor = cat.color;
    }
  }

  // --- SPACE CREATION (Admin/SuperAdmin Only) ---
  openCreateSpaceModal(): void {
    if (!this.isAdminOrSuperAdmin) return;
    this.newSpaceTitle = '';
    this.newSpaceDesc = '';
    this.selectedUserIds = this.currentUser ? [this.currentUser.id] : [];
    this.isSpaceModalOpen = true;
  }

  toggleUserSelection(userId: string): void {
    if (this.selectedUserIds.includes(userId)) {
      this.selectedUserIds = this.selectedUserIds.filter(id => id !== userId);
    } else {
      this.selectedUserIds.push(userId);
    }
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUserIds.includes(userId);
  }

  saveSpace(): void {
    if (!this.newSpaceTitle.trim()) {
      this.showAlert('Título requerido', 'Por favor, ingresa el título del espacio compartido.', 'warning');
      return;
    }
    if (this.selectedUserIds.length < 2) {
      this.showAlert('Colaboradores requeridos', 'Debes seleccionar al menos dos usuarios colaboradores para el espacio compartido.', 'warning');
      return;
    }

    const details: { [id: string]: { name: string; email: string } } = {};
    this.allUsers.forEach(u => {
      if (this.selectedUserIds.includes(u.id)) {
        details[u.id] = { name: u.name, email: u.email };
      }
    });

    this.sharedTasksService.createSpace(
      this.newSpaceTitle,
      this.newSpaceDesc,
      this.selectedUserIds,
      details
    );

    this.isSpaceModalOpen = false;
  }

  canDeleteSpace(space: SharedSpace | null): boolean {
    if (!space) return false;
    if (this.isAdminOrSuperAdmin) return true;
    return space.createdBy === this.currentUser?.id;
  }

  deleteSpace(space: SharedSpace, event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.canDeleteSpace(space)) return;
    this.showConfirm({
      title: '¿Eliminar espacio compartido?',
      message: `¿Estás seguro de eliminar el espacio de trabajo "${space.title}" y todos sus entregables? Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar espacio',
      variant: 'danger',
      onConfirm: () => {
        this.sharedTasksService.deleteSpace(space.id);
      }
    });
  }

  deleteActiveSpace(): void {
    if (this.activeSpace) {
      this.deleteSpace(this.activeSpace);
    }
  }

  // --- TASK CREATION & EDITING ---
  openCreateTaskModal(): void {
    if (!this.activeSpace) return;
    this.editingTask = null;
    this.taskFormTitle = '';
    this.taskFormDesc = '';
    this.taskFormPriority = 'media';
    this.taskFormCategory = '';
    this.taskFormCategoryColor = '';
    this.taskFormAssignedTo = '';
    this.taskFormDueDate = '';
    this.taskFormDueTime = '';
    this.checklistInputs = [''];
    this.isTaskModalOpen = true;
  }

  openEditTaskModal(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingTask = task;
    this.taskFormTitle = task.title;
    this.taskFormDesc = task.description || '';
    this.taskFormPriority = task.priority;
    this.taskFormCategory = task.category || '';
    this.taskFormCategoryColor = task.categoryColor || '';
    this.taskFormAssignedTo = task.assignedToId || '';
    this.taskFormDueDate = task.dueDate || '';
    this.taskFormDueTime = task.dueTime || '';
    this.checklistInputs = task.checklist && task.checklist.length > 0 ? task.checklist.map(i => i.text) : [''];
    this.isTaskModalOpen = true;
  }

  addChecklistField(): void {
    this.checklistInputs.push('');
  }

  removeChecklistField(index: number): void {
    if (this.checklistInputs.length > 1) {
      this.checklistInputs.splice(index, 1);
    } else {
      this.checklistInputs[0] = '';
    }
  }

  get activeSpaceParticipants(): User[] {
    if (!this.activeSpace) return [];
    return this.allUsers.filter(u => this.activeSpace!.participantIds.includes(u.id));
  }

  saveTask(): void {
    if (!this.taskFormTitle.trim() || !this.activeSpace) {
      this.showAlert('Título requerido', 'Por favor, ingresa el título del entregable.', 'warning');
      return;
    }

    const assignedUser = this.activeSpaceParticipants.find(u => u.id === this.taskFormAssignedTo);
    const validChecklist = this.checklistInputs.filter(t => t.trim().length > 0);

    if (this.editingTask) {
      this.sharedTasksService.updateTask(this.editingTask.id, {
        title: this.taskFormTitle.trim(),
        description: this.taskFormDesc.trim(),
        priority: this.taskFormPriority,
        category: this.taskFormCategory || undefined,
        categoryColor: this.taskFormCategoryColor || undefined,
        assignedToId: this.taskFormAssignedTo || undefined,
        assignedToName: assignedUser ? assignedUser.name : undefined,
        dueDate: this.taskFormDueDate || undefined,
        dueTime: this.taskFormDueTime || undefined
      });
    } else {
      this.sharedTasksService.createTask(this.activeSpace.id, {
        title: this.taskFormTitle.trim(),
        description: this.taskFormDesc.trim(),
        priority: this.taskFormPriority,
        category: this.taskFormCategory || undefined,
        categoryColor: this.taskFormCategoryColor || undefined,
        assignedToId: this.taskFormAssignedTo || undefined,
        assignedToName: assignedUser ? assignedUser.name : undefined,
        dueDate: this.taskFormDueDate || undefined,
        dueTime: this.taskFormDueTime || undefined,
        checklist: validChecklist
      });
    }

    this.isTaskModalOpen = false;
  }

  deleteTask(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.showConfirm({
      title: '¿Eliminar entregable?',
      message: `¿Estás seguro de eliminar la entrega "${task.title}"?`,
      confirmText: 'Sí, eliminar',
      variant: 'danger',
      onConfirm: () => {
        this.sharedTasksService.deleteTask(task.id);
      }
    });
  }

  // --- DELIVERABLE ACTIONS ---
  openDeliverModal(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.deliveringTask = task;
    this.deliveryNotesInput = task.deliveryNotes || '';
    this.isDeliverModalOpen = true;
  }

  confirmDeliver(): void {
    if (!this.deliveringTask) return;
    this.sharedTasksService.updateTaskStatus(this.deliveringTask.id, 'entregada', this.deliveryNotesInput.trim());
    this.isDeliverModalOpen = false;
  }

  // --- RETURN / SOLICITAR CORRECCIONES ---
  openReturnModal(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.returningTask = task;
    this.returnFeedbackInput = '';
    this.isReturnModalOpen = true;
  }

  confirmReturn(): void {
    if (!this.returningTask) return;
    this.sharedTasksService.returnTaskWithFeedback(this.returningTask.id, this.returnFeedbackInput.trim());
    this.isReturnModalOpen = false;
  }

  markAsInProgress(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.sharedTasksService.updateTaskStatus(task.id, 'en_progreso');
  }

  approveAndComplete(task: SharedTask, event?: Event): void {
    if (event) event.stopPropagation();
    this.sharedTasksService.updateTaskStatus(task.id, 'completada');
  }

  // --- NOTIFICATIONS PANEL ---
  toggleNotifs(): void {
    this.isNotifsOpen = !this.isNotifsOpen;
  }

  markNotifRead(notif: SharedNotification): void {
    this.sharedTasksService.markNotificationAsRead(notif.id);
  }

  markAllNotifsRead(): void {
    this.sharedTasksService.markAllNotificationsAsRead();
  }

  getParticipantNamesList(space: SharedSpace): string {
    if (space.participantNames) {
      return Object.values(space.participantNames).join(', ');
    }
    return `${space.participantIds.length} colaboradores`;
  }

  trackByFn(index: number, item: any): any {
    return index;
  }

  getCompletedChecklistCount(task: SharedTask): number {
    return (task.checklist || []).filter(i => i.completed).length;
  }
}
