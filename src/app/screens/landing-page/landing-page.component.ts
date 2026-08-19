import { Component, OnInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

export interface PhoneDemoTask {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryBg: string;
  priority: 'Alta' | 'Media' | 'Baja';
  priorityClass: string;
  status: 'pendiente' | 'en_progreso' | 'terminada';
  completed?: boolean;
  tag?: string;
  subtasks?: string[];
  createdAt: string;
}

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  @ViewChild('phoneTasksContainer', { static: false }) phoneTasksContainer?: ElementRef;

  isAuthenticated: boolean = false;
  activeSection: string = 'inicio';

  isLegalModalOpen: boolean = false;
  legalModalTitle: string = '';
  legalModalContent: string = '';

  // Cuaderno Hero Interactive Notebook State
  notebookTasks = [
    { id: 1, text: 'Comprar café colombiano & fruta orgánica', category: 'Compras', categoryBg: 'bg-emerald', completed: true },
    { id: 2, text: 'Revisar tablero Kanban NoteYou', category: 'Trabajo', categoryBg: 'bg-blue', completed: true },
    { id: 3, text: 'Escribir apunte de la reunión de diseño', category: 'Ideas', categoryBg: 'bg-amber', completed: false, isWriting: true },
    { id: 4, text: 'Configurar recordatorio para las 4:00 PM', category: 'Personal', categoryBg: 'bg-purple', completed: false },
    { id: 5, text: 'Sincronizar listas y subtareas automáticas', category: 'Proyectos', categoryBg: 'bg-indigo', completed: false },
    { id: 6, text: 'Revisar entregas y fechas límite', category: 'Urgente', categoryBg: 'bg-rose', completed: false },
    { id: 7, text: 'Lectura diaria y apuntes de desarrollo', category: 'Hábitos', categoryBg: 'bg-teal', completed: false },
    { id: 8, text: 'Planificar sprint y notas rápidas', category: 'Trabajo', categoryBg: 'bg-blue', completed: false },
    { id: 9, text: 'Respaldar notas y listas en la nube', category: 'Cloud', categoryBg: 'bg-indigo', completed: false },
    { id: 10, text: 'Exportar reporte semanal de productividad', category: 'Métricas', categoryBg: 'bg-purple', completed: false }
  ];

  // Phone Mockup Interactive Demo State
  phoneActiveCategory: string = 'Todas';
  phoneCategories: string[] = ['Todas', 'Trabajo', 'Ideas', 'Compras', 'Proyectos', 'Personal'];
  phoneSearchQuery: string = '';
  phoneActiveTab: 'home' | 'calendar' = 'home';
  justAddedTaskId: string = '';
  private glowTimeout: any;

  private taskPoolIndex: number = 0;
  private demoTaskPool = [
    {
      title: 'Tablero Kanban Dinámico',
      description: 'Arrastra tus notas y organízalas por columnas (Pendiente, En Progreso, Terminada).',
      category: 'Trabajo',
      categoryBg: 'bg-blue',
      priority: 'Alta' as const,
      priorityClass: 'badge-priority-high',
      status: 'en_progreso' as const,
      tag: 'Kanban'
    },
    {
      title: 'Auto-eliminación en 15 Días',
      description: 'Las tareas completadas se limpian solas tras 15 días continuos sin reaperturarse.',
      category: 'Proyectos',
      categoryBg: 'bg-indigo',
      priority: 'Media' as const,
      priorityClass: 'badge-priority-medium',
      status: 'terminada' as const,
      tag: 'Completada'
    },
    {
      title: 'Subtareas & Listas de Compras',
      description: 'Crea viñetas interactivas y listas de compras que se tachan en tiempo real.',
      category: 'Compras',
      categoryBg: 'bg-emerald',
      priority: 'Media' as const,
      priorityClass: 'badge-priority-medium',
      status: 'pendiente' as const,
      subtasks: ['Frutas frescas', 'Café arábica', 'Pan integral']
    },
    {
      title: 'Panel de Notas Rápidas',
      description: 'Apunta ideas instantáneas con colores personalizados desde cualquier pantalla.',
      category: 'Ideas',
      categoryBg: 'bg-amber',
      priority: 'Baja' as const,
      priorityClass: 'badge-priority-low',
      status: 'en_progreso' as const,
      tag: 'Quick Notes'
    },
    {
      title: 'Calendario & Recordatorios',
      description: 'Visualiza tus fechas de entrega en el calendario interactivo con alertas.',
      category: 'Personal',
      categoryBg: 'bg-purple',
      priority: 'Alta' as const,
      priorityClass: 'badge-priority-high',
      status: 'pendiente' as const,
      tag: 'Calendario'
    },
    {
      title: 'Seguridad reCAPTCHA v3 & JWT',
      description: 'Tus sesiones y apuntes están protegidos con autenticación segura en la nube.',
      category: 'Trabajo',
      categoryBg: 'bg-teal',
      priority: 'Alta' as const,
      priorityClass: 'badge-priority-high',
      status: 'en_progreso' as const,
      tag: 'Seguridad'
    },
    {
      title: 'Filtros y Búsqueda Inteligente',
      description: 'Encuentra cualquier nota por título, fecha o categoría en milisegundos.',
      category: 'Proyectos',
      categoryBg: 'bg-blue',
      priority: 'Media' as const,
      priorityClass: 'badge-priority-medium',
      status: 'pendiente' as const
    }
  ];

  phoneDemoTasks: PhoneDemoTask[] = [
    {
      id: 'demo-1',
      title: 'Notas de Sincronización',
      description: 'Implementación de arquitectura en la nube y persistencia en tiempo real.',
      category: 'Trabajo',
      categoryBg: 'bg-blue',
      priority: 'Alta',
      priorityClass: 'badge-priority-high',
      status: 'en_progreso',
      completed: false,
      createdAt: 'Hoy'
    },
    {
      id: 'demo-2',
      title: 'Lista de compras semanal',
      description: 'Café colombiano, frutas, pan integral, frutos secos y avena.',
      category: 'Compras',
      categoryBg: 'bg-emerald',
      priority: 'Media',
      priorityClass: 'badge-priority-medium',
      status: 'pendiente',
      completed: false,
      createdAt: 'Pendiente'
    },
    {
      id: 'demo-3',
      title: 'Diseño de Micro-animaciones',
      description: 'Efectos hápticos e interacciones fluidas en la plataforma NoteYou.',
      category: 'Ideas',
      categoryBg: 'bg-amber',
      priority: 'Media',
      priorityClass: 'badge-priority-medium',
      status: 'terminada',
      tag: 'Finalizada',
      completed: true,
      createdAt: 'Hoy'
    }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
    });
  }

  get filteredPhoneTasks(): PhoneDemoTask[] {
    return this.phoneDemoTasks.filter(task => {
      const matchesCat = this.phoneActiveCategory === 'Todas' || task.category.toLowerCase() === this.phoneActiveCategory.toLowerCase();
      const matchesSearch = !this.phoneSearchQuery || 
        task.title.toLowerCase().includes(this.phoneSearchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(this.phoneSearchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }

  setPhoneCategory(cat: string): void {
    this.phoneActiveCategory = cat;
  }

  setPhoneTab(tab: 'home' | 'calendar'): void {
    this.phoneActiveTab = tab;
  }

  addPhoneDemoTask(): void {
    const template = this.demoTaskPool[this.taskPoolIndex % this.demoTaskPool.length];
    this.taskPoolIndex++;

    const newTask: PhoneDemoTask = {
      id: 'demo-' + Date.now(),
      title: template.title,
      description: template.description,
      category: template.category,
      categoryBg: template.categoryBg,
      priority: template.priority,
      priorityClass: template.priorityClass,
      status: template.status,
      tag: template.tag,
      subtasks: template.subtasks,
      completed: template.status === 'terminada',
      createdAt: 'Ahora'
    };

    // Ensure we are in home tab if calendar was active
    if (this.phoneActiveTab !== 'home') {
      this.phoneActiveTab = 'home';
    }

    // If current filter wouldn't show it, reset to Todas or category
    if (this.phoneActiveCategory !== 'Todas' && this.phoneActiveCategory.toLowerCase() !== newTask.category.toLowerCase()) {
      this.phoneActiveCategory = 'Todas';
    }

    this.phoneDemoTasks.unshift(newTask);
    this.justAddedTaskId = newTask.id;

    if (this.glowTimeout) {
      clearTimeout(this.glowTimeout);
    }
    this.glowTimeout = setTimeout(() => {
      this.justAddedTaskId = '';
    }, 1800);

    // Smooth auto-scroll to reveal the newly created task at the top
    setTimeout(() => {
      if (this.phoneTasksContainer && this.phoneTasksContainer.nativeElement) {
        this.phoneTasksContainer.nativeElement.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 40);
  }

  toggleNotebookTask(task: any): void {
    task.completed = !task.completed;
    if (task.isWriting && task.completed) {
      task.isWriting = false;
    }
  }

  togglePhoneTask(task: PhoneDemoTask, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    // Cycle between: pendiente -> en_progreso -> terminada -> pendiente
    if (task.status === 'pendiente') {
      task.status = 'en_progreso';
      task.completed = false;
    } else if (task.status === 'en_progreso') {
      task.status = 'terminada';
      task.completed = true;
    } else {
      task.status = 'pendiente';
      task.completed = false;
    }
  }

  deletePhoneTask(taskId: string, event: Event): void {
    event.stopPropagation();
    this.phoneDemoTasks = this.phoneDemoTasks.filter(t => t.id !== taskId);
  }

  scrollTo(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      this.activeSection = sectionId;
    }
  }

  openLegalModal(type: 'privacy' | 'terms' | 'about' | 'security'): void {
    if (type === 'privacy') {
      this.legalModalTitle = 'Política de Privacidad';
      this.legalModalContent = 'En NoteYou nos tomamos muy en serio la privacidad de tus notas e información personal. Todos tus apuntes, categorías y preferencias se almacenan de forma segura y sincronizada, sin compartir tus datos con terceros.';
    } else if (type === 'terms') {
      this.legalModalTitle = 'Términos del Servicio';
      this.legalModalContent = 'Al utilizar NoteYou, accedes a un servicio de gestión de notas, calendario y productividad diseñado para facilitarte la captura y organización de tareas de manera fluida y moderna.';
    } else if (type === 'security') {
      this.legalModalTitle = 'Seguridad y Protección';
      this.legalModalContent = 'NoteYou utiliza estándares modernos de autenticación JWT y almacenamiento seguro para garantizar que únicamente tú tengas acceso a tus proyectos, notas rápidas y tableros Kanban.';
    } else {
      this.legalModalTitle = 'Acerca de NoteYou';
      this.legalModalContent = 'NoteYou es una plataforma moderna de productividad y organización de notas creada para estudiantes, profesionales y creadores que buscan maximizar su enfoque diario.';
    }
    this.isLegalModalOpen = true;
  }

  closeLegalModal(): void {
    this.isLegalModalOpen = false;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    const sections = ['inicio', 'herramientas', 'como-funciona'];
    const scrollPosition = window.pageYOffset + 100; // offset

    for (const section of sections) {
      const element = document.getElementById(section);
      if (element) {
        const top = element.offsetTop;
        const height = element.offsetHeight;
        if (scrollPosition >= top && scrollPosition < top + height) {
          this.activeSection = section;
        }
      }
    }
    
    // Scroll reveal logic
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-up');
    for (let i = 0; i < reveals.length; i++) {
      const windowHeight = window.innerHeight;
      const elementTop = reveals[i].getBoundingClientRect().top;
      const elementVisible = 100;
      if (elementTop < windowHeight - elementVisible) {
        reveals[i].classList.add('active');
      }
    }
  }
}
