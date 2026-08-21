import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CategoriesService } from '../../services/categories.service';
import { NotesService } from '../../services/notes.service';
import { AuthService } from '../../core/services/auth.service';
import { Category } from '../../models/category.model';
import { PriorityLevel } from '../../models/note.model';

@Component({
  selector: 'app-onboarding-wizard',
  templateUrl: './onboarding-wizard.component.html',
  styleUrls: ['./onboarding-wizard.component.scss']
})
export class OnboardingWizardComponent implements OnInit {
  @Output() completed = new EventEmitter<void>();

  currentStep: number = 1;

  // Step 1 Form: Category
  categoryName: string = '';
  categoryDescription: string = '';
  categoryColor: string = '#0284C7';
  createdCategory: Category | null = null;

  // Step 2 Form: Note
  noteTitle: string = '';
  noteContent: string = '';
  notePriority: PriorityLevel = 'alta';
  noteDueDate: string = '';

  constructor(
    private categoriesService: CategoriesService,
    private notesService: NotesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {}

  createCategoryStep(): void {
    if (!this.categoryName.trim()) return;

    this.createdCategory = this.categoriesService.addCategory({
      name: this.categoryName.trim(),
      description: this.categoryDescription.trim() || 'Categoría creada en la bienvenida',
      color: this.categoryColor,
      icon: 'typcn-star'
    });

    this.currentStep = 2;
  }

  createNoteStep(): void {
    if (!this.noteTitle.trim() || !this.createdCategory) return;

    this.notesService.addNote({
      title: this.noteTitle.trim(),
      content: this.noteContent.trim() || 'Nota inicial de prueba creada durante el recorrido de bienvenida.',
      categoryId: this.createdCategory.id,
      priority: this.notePriority,
      status: 'pendiente',
      dueDate: this.noteDueDate || undefined,
      isPinned: true
    });

    this.currentStep = 3;
  }

  finishTutorial(): void {
    this.authService.markTutorialAsCompleted();
    this.completed.emit();
  }

  skipTutorial(): void {
    this.authService.markTutorialAsCompleted();
    this.completed.emit();
  }
}
