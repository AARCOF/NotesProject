import { Component, OnInit, OnDestroy } from '@angular/core';
import { Note } from '../../models/note.model';
import { NotesService } from '../../services/notes.service';
import { Subscription, combineLatest } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CategoriesService } from '../../services/categories.service';
import { Category } from '../../models/category.model';
import { ChartOptions, ChartType } from 'chart.js';
import { Label, SingleDataSet } from 'ng2-charts';

@Component({
  selector: 'app-productivity-dashboard',
  templateUrl: './productivity-dashboard.component.html',
  styleUrls: ['./productivity-dashboard.component.scss']
})
export class ProductivityDashboardComponent implements OnInit, OnDestroy {
  notes: Note[] = [];
  categories: Category[] = [];
  isLoading: boolean = true;
  selectedStatusFilter: string = 'all';
  private subscriptions = new Subscription();

  public commonChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false
  };

  // Status Chart (Doughnut)
  public statusChartLabels: Label[] = ['Completadas', 'Pendientes'];
  public statusChartData: SingleDataSet = [0, 0];
  public statusChartType: ChartType = 'doughnut';
  public statusChartColors = [{ backgroundColor: ['#10b981', '#f59e0b'] }];
  
  // Category Chart (Histogram)
  public categoryChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { yAxes: [{ ticks: { beginAtZero: true, stepSize: 1 } }] }
  };
  public categoryChartLabels: Label[] = [];
  public categoryChartData: any[] = [{ data: [], label: 'Tareas' }];
  public categoryChartType: ChartType = 'bar';
  public categoryChartColors: any[] = [{ backgroundColor: [] }];
  public categoryChartLegend = false;

  // Priority / Weekly Frequency Curve (Line Histogram)
  public weeklyChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    elements: {
      line: {
        tension: 0.35
      },
      point: {
        radius: 5,
        hoverRadius: 7,
        hitRadius: 10
      }
    },
    scales: {
      xAxes: [{
        gridLines: { display: false },
        ticks: { fontColor: '#64748b' }
      }],
      yAxes: [{
        ticks: { beginAtZero: true, stepSize: 1, fontColor: '#64748b' },
        gridLines: { color: 'rgba(226, 232, 240, 0.6)' }
      }]
    }
  };
  public weeklyChartLabels: Label[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  public weeklyChartType: ChartType = 'line';
  public weeklyChartLegend = false;
  public weeklyChartData: any[] = [{ data: [0, 0, 0, 0, 0, 0, 0], label: 'Frecuencia de Tareas' }];
  public weeklyChartColors: any[] = [{ 
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#6366f1',
    borderWidth: 3,
    pointBackgroundColor: '#6366f1',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointHoverBackgroundColor: '#ffffff',
    pointHoverBorderColor: '#6366f1',
    fill: 'origin'
  }];

  constructor(
    private notesService: NotesService,
    private categoriesService: CategoriesService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const userSub = this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.loadNotes();
      }
    });
    this.subscriptions.add(userSub);
  }

  loadNotes(): void {
    this.isLoading = true;
    const dataSub = combineLatest([
      this.notesService.notes$,
      this.categoriesService.categories$
    ]).subscribe(([notes, categories]) => {
      this.notes = notes;
      this.categories = categories;
      this.isLoading = false;
      this.generateCharts();
    });
    this.subscriptions.add(dataSub);
  }

  generateCharts(): void {
    // 1. Status Chart (always based on all notes)
    const totalCompleted = this.notes.filter(n => n.status === 'completada').length;
    const totalPending = this.notes.length - totalCompleted;
    this.statusChartData = [totalCompleted, totalPending];

    // Filter notes for the other charts
    let filteredNotes = this.notes;
    if (this.selectedStatusFilter === 'pendiente') {
      filteredNotes = this.notes.filter(n => n.status !== 'completada');
    } else if (this.selectedStatusFilter === 'completada') {
      filteredNotes = this.notes.filter(n => n.status === 'completada');
    }

    // 2. Category Chart
    const categoryCounts: { [key: string]: { count: number, color: string } } = {};
    filteredNotes.forEach(note => {
      let catName = 'Sin Categoría';
      let catColor = '#94a3b8';
      if (note.categoryId) {
        const found = this.categories.find(c => c.id === note.categoryId);
        if (found) {
          catName = found.name;
          catColor = found.color;
        }
      }
      if (!categoryCounts[catName]) {
        categoryCounts[catName] = { count: 0, color: catColor };
      }
      categoryCounts[catName].count += 1;
    });
    this.categoryChartLabels = Object.keys(categoryCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    this.categoryChartData = [{ data: Object.values(categoryCounts).map(v => v.count), label: 'Tareas' }];
    this.categoryChartColors = [{ backgroundColor: Object.values(categoryCounts).map(v => v.color) }];

    // 3. Weekly Frequency Histogram (Tasks distribution by Day of Week)
    const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon=0, Tue=1, ... Sun=6
    filteredNotes.forEach(note => {
      if (note.dueDate) {
        const parts = note.dueDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const dayIndex = (d.getDay() + 6) % 7; // Map Sun(0)->6, Mon(1)->0
          dayCounts[dayIndex]++;
        }
      } else if (note.createdAt) {
        const d = new Date(note.createdAt);
        const dayIndex = (d.getDay() + 6) % 7;
        dayCounts[dayIndex]++;
      }
    });
    this.weeklyChartData = [{ 
      data: dayCounts, 
      label: 'Frecuencia de Tareas',
      fill: true
    }];
  }

  get totalCount(): number {
    return this.notes.length;
  }

  get highPriorityCount(): number {
    return this.notes.filter(n => n.priority === 'alta' && n.status !== 'completada').length;
  }

  get pendingCount(): number {
    return this.notes.filter(n => n.status !== 'completada').length;
  }

  get completedCount(): number {
    return this.notes.filter(n => n.status === 'completada').length;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
