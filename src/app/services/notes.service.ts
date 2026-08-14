import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Note, PriorityLevel, NoteStatus } from '../models/note.model';

const STORAGE_KEY = 'star_notes_items_v1';

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private notesSubject = new BehaviorSubject<Note[]>([]);
  public notes$: Observable<Note[]> = this.notesSubject.asObservable();

  constructor() {
    this.loadInitialNotes();
  }

  private getTodayFormatted(offsetDays = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  private loadInitialNotes(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.notesSubject.next(parsed);
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    const defaultNotes: Note[] = [
      {
        id: 'note_1',
        title: 'Repasar Algoritmos y Estructuras de Datos',
        content: 'Estudiar complejidad temporal Big-O, algoritmos de ordenamiento rápido y Convex Hull (Quickhull) para la entrega académica.',
        priority: 'alta',
        categoryId: 'cat_estudio',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(2),
        status: 'en_progreso',
        isPinned: true
      },
      {
        id: 'note_2',
        title: 'Comprar víveres y productos del hogar',
        content: 'Lista de compras: Frutas frescas, vegetales, leche, café especial, productos de limpieza y bolsas de recolección.',
        priority: 'media',
        categoryId: 'cat_hogar',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(0),
        status: 'pendiente',
        isPinned: false
      },
      {
        id: 'note_3',
        title: 'Enviar informe trimestral del proyecto',
        content: 'Consolidar métricas de avance del dashboard StarAdmin, compilar capturas de pantalla y redactar conclusiones de rendimiento.',
        priority: 'alta',
        categoryId: 'cat_trabajo',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(1),
        status: 'pendiente',
        isPinned: true
      },
      {
        id: 'note_4',
        title: 'Rutina de ejercicios 5K y cardio',
        content: 'Completar sesión de carrera continua de 30 minutos y estiramientos para mantener la condición física.',
        priority: 'baja',
        categoryId: 'cat_personal',
        createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(-1),
        status: 'completada',
        isPinned: false
      },
      {
        id: 'note_5',
        title: 'Pago de facturas de luz e internet',
        content: 'Ingresar a la plataforma de pagos del banco y cancelar los recibos con vencimiento a fin de mes.',
        priority: 'alta',
        categoryId: 'cat_finanzas',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(0),
        status: 'pendiente',
        isPinned: false
      },
      {
        id: 'note_6',
        title: 'Lectura: "Clean Code" de Robert C. Martin',
        content: 'Leer capítulos 7 y 8 sobre manejo estructurado de excepciones y límites de abstracción en software.',
        priority: 'baja',
        categoryId: 'cat_estudio',
        createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        dueDate: this.getTodayFormatted(5),
        status: 'en_progreso',
        isPinned: false
      }
    ];

    this.notesSubject.next(defaultNotes);
    this.saveToStorage(defaultNotes);
  }

  private saveToStorage(notes: Note[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }

  public getNotes(): Note[] {
    return this.notesSubject.getValue();
  }

  public getNoteById(id: string): Note | undefined {
    return this.getNotes().find(n => n.id === id);
  }

  public addNote(noteData: Omit<Note, 'id' | 'createdAt'>): Note {
    const newNote: Note = {
      ...noteData,
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      isPinned: noteData.isPinned || false
    };

    const current = this.getNotes();
    const updated = [newNote, ...current];
    this.notesSubject.next(updated);
    this.saveToStorage(updated);
    return newNote;
  }

  public updateNote(id: string, updatedData: Partial<Note>): void {
    const current = this.getNotes();
    const index = current.findIndex(n => n.id === id);
    if (index !== -1) {
      const updatedList = [...current];
      updatedList[index] = { ...updatedList[index], ...updatedData };
      this.notesSubject.next(updatedList);
      this.saveToStorage(updatedList);
    }
  }

  public deleteNote(id: string): void {
    const current = this.getNotes();
    const updated = current.filter(n => n.id !== id);
    this.notesSubject.next(updated);
    this.saveToStorage(updated);
  }

  public toggleStatus(id: string): void {
    const note = this.getNoteById(id);
    if (note) {
      let newStatus: NoteStatus = 'pendiente';
      if (note.status === 'pendiente') newStatus = 'en_progreso';
      else if (note.status === 'en_progreso') newStatus = 'completada';
      else newStatus = 'pendiente';

      this.updateNote(id, { status: newStatus });
    }
  }

  public togglePin(id: string): void {
    const note = this.getNoteById(id);
    if (note) {
      this.updateNote(id, { isPinned: !note.isPinned });
    }
  }

  public filterAndSortNotes(
    notes: Note[],
    searchTerm: string = '',
    categoryId: string = 'all',
    priority: string = 'all',
    status: string = 'all',
    sortBy: string = 'priority-desc'
  ): Note[] {
    let filtered = [...notes];

    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        n => n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term)
      );
    }

    if (categoryId && categoryId !== 'all') {
      filtered = filtered.filter(n => n.categoryId === categoryId);
    }

    if (priority && priority !== 'all') {
      filtered = filtered.filter(n => n.priority === priority);
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(n => n.status === status);
    }

    const priorityWeight: Record<PriorityLevel, number> = {
      alta: 3,
      media: 2,
      baja: 1
    };

    filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      switch (sortBy) {
        case 'priority-desc':
          return priorityWeight[b.priority] - priorityWeight[a.priority];
        case 'priority-asc':
          return priorityWeight[a.priority] - priorityWeight[b.priority];
        case 'date-desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'dueDate-asc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }
}
