import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, combineLatest } from 'rxjs';
import { ChartOptions, ChartType } from 'chart.js';
import { Label, SingleDataSet } from 'ng2-charts';
import { ExpenseService } from '../../services/expense.service';
import { ExpenseCategory, ExpenseSubcategory, ExpenseItem } from '../../models/expense.model';

@Component({
  selector: 'app-expenses-dashboard',
  templateUrl: './expenses-dashboard.component.html',
  styleUrls: ['./expenses-dashboard.component.scss']
})
export class ExpensesDashboardComponent implements OnInit, OnDestroy {
  categories: ExpenseCategory[] = [];
  subcategories: ExpenseSubcategory[] = [];
  expenses: ExpenseItem[] = [];
  
  selectedMonthKey: string = ''; // YYYY-MM
  formattedMonthLabel: string = '';
  currencySymbol: string = 'S/.'; // O '$'

  // Presupuesto y KPIs
  monthlyIncome: number = 0;
  totalExpenses: number = 0;
  balance: number = 0;
  budgetUsedPercent: number = 0;

  // Acordeón de subcategorías expandidas
  expandedSubcategories: { [subId: string]: boolean } = {};

  // Filtro de búsqueda rápida
  searchTerm: string = '';

  // Vista Activa (Pestañas superiores) - Predeterminada: Registro de Gastos
  activeTab: 'categorias' | 'graficas' | 'movimientos' = 'movimientos';

  setActiveTab(tab: 'categorias' | 'graficas' | 'movimientos'): void {
    this.activeTab = tab;
  }

  // Gráficos ng2-charts
  public chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    legend: {
      position: 'bottom',
      labels: {
        fontColor: '#475569',
        fontSize: 12,
        boxWidth: 12,
        padding: 14
      }
    },
    tooltips: {
      callbacks: {
        label: (tooltipItem, data) => {
          const dataset = data.datasets![tooltipItem.datasetIndex!];
          const currentValue = dataset.data![tooltipItem.index!] as number;
          const label = data.labels![tooltipItem.index!];
          return ` ${label}: ${this.currencySymbol} ${currentValue.toFixed(2)}`;
        }
      }
    }
  };

  // Doughnut Chart (Categorías)
  public categoryChartLabels: Label[] = [];
  public categoryChartData: SingleDataSet = [];
  public categoryChartType: ChartType = 'doughnut';
  public categoryChartColors: any[] = [{ backgroundColor: [] }];

  // Bar Chart (Top Subcategorías)
  public subcategoryChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      xAxes: [{
        gridLines: { display: false },
        ticks: { fontColor: '#64748b', fontSize: 11 }
      }],
      yAxes: [{
        gridLines: { color: '#f1f5f9' },
        ticks: {
          beginAtZero: true,
          fontColor: '#64748b',
          callback: (value) => `${this.currencySymbol} ${value}`
        }
      }]
    },
    legend: { display: false }
  };
  public subcategoryChartLabels: Label[] = [];
  public subcategoryChartData: any[] = [{ data: [], label: 'Gasto Total', backgroundColor: '#3b82f6' }];
  public subcategoryChartType: ChartType = 'bar';

  // --- Modales ---
  // Modal Gasto Individual
  isExpenseModalOpen: boolean = false;
  expenseToEdit: ExpenseItem | null = null;
  expenseForm = {
    title: '',
    amount: null as number | null,
    categoryId: '',
    subcategoryId: '',
    date: '',
    notes: ''
  };

  // Modal Categoría
  isCategoryModalOpen: boolean = false;
  categoryToEdit: ExpenseCategory | null = null;
  categoryForm = {
    name: '',
    icon: 'typcn-folder',
    color: '#3b82f6'
  };

  // Modal Subcategoría
  isSubcategoryModalOpen: boolean = false;
  subcategoryToEdit: ExpenseSubcategory | null = null;
  subcategoryForm = {
    categoryId: '',
    name: ''
  };

  // Modal Ingreso Mensual
  isIncomeModalOpen: boolean = false;
  incomeFormAmount: number | null = null;

  // Iconos y Colores disponibles
  availableIcons = [
    { class: 'typcn-home', label: 'Hogar' },
    { class: 'typcn-shopping-cart', label: 'Compras' },
    { class: 'typcn-plane', label: 'Viajes' },
    { class: 'typcn-flash', label: 'Servicios' },
    { class: 'typcn-film', label: 'Ocio' },
    { class: 'typcn-heart', label: 'Salud' },
    { class: 'typcn-book', label: 'Educación' },
    { class: 'typcn-coffee', label: 'Café' },
    { class: 'typcn-credit-card', label: 'Finanzas' },
    { class: 'typcn-gift', label: 'Regalos' },
    { class: 'typcn-device-phone', label: 'Tecnología' },
    { class: 'typcn-tag', label: 'Varios' }
  ];

  availableColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6',
    '#6366f1', '#84cc16', '#f97316', '#64748b'
  ];

  private subscriptions = new Subscription();

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.selectedMonthKey = `${year}-${month}`;
    this.updateFormattedMonthLabel();

    this.subscriptions.add(
      combineLatest([
        this.expenseService.categories$,
        this.expenseService.subcategories$,
        this.expenseService.expenses$,
        this.expenseService.budgets$
      ]).subscribe(([cats, subs, exps]) => {
        this.categories = cats;
        this.subcategories = subs;
        this.expenses = exps;
        this.calculateMetricsAndCharts();
      })
    );

    this.subscriptions.add(
      this.expenseService.openAddModalRequest$.subscribe(req => {
        if (req && req.open) {
          this.openAddExpenseModal(req.subcategoryId, req.categoryId);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // --- Navegación de Fechas ---

  updateFormattedMonthLabel(): void {
    const [year, month] = this.selectedMonthKey.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = date.toLocaleString('es-ES', { month: 'long' });
    this.formattedMonthLabel = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  }

  prevMonth(): void {
    const [yearStr, monthStr] = this.selectedMonthKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year--;
    }
    this.selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  nextMonth(): void {
    const [yearStr, monthStr] = this.selectedMonthKey.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year++;
    }
    this.selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  setTodayMonth(): void {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    this.selectedMonthKey = `${year}-${month}`;
    this.updateFormattedMonthLabel();
    this.calculateMetricsAndCharts();
  }

  // --- Cálculos y Gráficas ---

  calculateMetricsAndCharts(): void {
    this.monthlyIncome = this.expenseService.getMonthlyIncome(this.selectedMonthKey);
    this.totalExpenses = this.expenseService.getTotalExpensesForMonth(this.selectedMonthKey);
    this.balance = this.monthlyIncome - this.totalExpenses;

    this.budgetUsedPercent = this.monthlyIncome > 0 
      ? Math.min(100, Math.round((this.totalExpenses / this.monthlyIncome) * 100))
      : 0;

    this.updateCharts();
  }

  updateCharts(): void {
    // 1. Gráfico de Categorías (Doughnut)
    const catLabels: string[] = [];
    const catData: number[] = [];
    const catColors: string[] = [];

    this.categories.forEach(cat => {
      const total = this.expenseService.getCategoryTotal(cat.id, this.selectedMonthKey);
      if (total > 0) {
        catLabels.push(cat.name);
        catData.push(total);
        catColors.push(cat.color);
      }
    });

    this.categoryChartLabels = catLabels.length > 0 ? catLabels : ['Sin Gastos'];
    this.categoryChartData = catData.length > 0 ? catData : [0];
    this.categoryChartColors = [{ backgroundColor: catColors.length > 0 ? catColors : ['#e2e8f0'] }];

    // 2. Gráfico de Subcategorías Top (Bar)
    const subTotals: { name: string; total: number; color: string }[] = [];
    this.subcategories.forEach(sub => {
      const total = this.expenseService.getSubcategoryTotal(sub.id, this.selectedMonthKey);
      if (total > 0) {
        const cat = this.categories.find(c => c.id === sub.categoryId);
        subTotals.push({
          name: sub.name,
          total,
          color: cat ? cat.color : '#3b82f6'
        });
      }
    });

    // Ordenar de mayor a menor y tomar top 7
    subTotals.sort((a, b) => b.total - a.total);
    const topSubs = subTotals.slice(0, 7);

    this.subcategoryChartLabels = topSubs.map(s => s.name);
    this.subcategoryChartData = [{
      data: topSubs.map(s => s.total),
      label: 'Gasto',
      backgroundColor: topSubs.map(s => s.color)
    }];
  }

  // --- Helpers de Renderizado de Vista ---

  getCategorySubcategories(categoryId: string): ExpenseSubcategory[] {
    return this.subcategories.filter(s => s.categoryId === categoryId);
  }

  getSubcategoryExpenses(subcategoryId: string): ExpenseItem[] {
    const monthExpenses = this.expenseService.getExpensesForMonth(this.selectedMonthKey);
    let items = monthExpenses.filter(e => e.subcategoryId === subcategoryId);
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      items = items.filter(e => e.title.toLowerCase().includes(term) || (e.notes && e.notes.toLowerCase().includes(term)));
    }
    return items;
  }

  getCategoryTotal(categoryId: string): number {
    return this.expenseService.getCategoryTotal(categoryId, this.selectedMonthKey);
  }

  getSubcategoryTotal(subcategoryId: string): number {
    return this.expenseService.getSubcategoryTotal(subcategoryId, this.selectedMonthKey);
  }

  getCategoryPercentage(categoryId: string): number {
    if (this.totalExpenses === 0) return 0;
    const catTotal = this.getCategoryTotal(categoryId);
    return Math.round((catTotal / this.totalExpenses) * 100);
  }

  toggleSubcategory(subId: string): void {
    this.expandedSubcategories[subId] = !this.expandedSubcategories[subId];
  }

  isSubcategoryExpanded(subId: string): boolean {
    return !!this.expandedSubcategories[subId];
  }

  getAllMonthExpenses(): ExpenseItem[] {
    const monthExpenses = this.expenseService.getExpensesForMonth(this.selectedMonthKey);
    if (!this.searchTerm.trim()) {
      return monthExpenses;
    }
    const term = this.searchTerm.toLowerCase();
    return monthExpenses.filter(e => 
      e.title.toLowerCase().includes(term) || 
      (e.notes && e.notes.toLowerCase().includes(term))
    );
  }

  // --- Paginación para Histórico de Gastos ---
  historyPage: number = 1;
  historyPageSize: number = 6;

  getPaginatedMonthExpenses(): ExpenseItem[] {
    const all = this.getAllMonthExpenses();
    const totalPages = this.getHistoryTotalPages();
    if (this.historyPage > totalPages) {
      this.historyPage = totalPages;
    }
    const page = Math.max(1, this.historyPage || 1);
    const start = (page - 1) * this.historyPageSize;
    return all.slice(start, start + this.historyPageSize);
  }

  getHistoryTotalPages(): number {
    const total = this.getAllMonthExpenses().length;
    return Math.max(1, Math.ceil(total / this.historyPageSize));
  }

  getHistoryRangeText(): string {
    const total = this.getAllMonthExpenses().length;
    if (total === 0) return '0 de 0';
    const totalPages = this.getHistoryTotalPages();
    const page = Math.min(Math.max(1, this.historyPage || 1), totalPages);
    const start = (page - 1) * this.historyPageSize + 1;
    const end = Math.min(page * this.historyPageSize, total);
    return `${start}-${end} de ${total}`;
  }

  getHistoryPageNumbers(): number[] {
    const total = this.getHistoryTotalPages();
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }

  setHistoryPage(p: number, event?: Event): void {
    if (event) event.preventDefault();
    if (p >= 1 && p <= this.getHistoryTotalPages()) {
      this.historyPage = p;
    }
  }

  nextHistoryPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.historyPage < this.getHistoryTotalPages()) {
      this.historyPage++;
    }
  }

  prevHistoryPage(event?: Event): void {
    if (event) event.preventDefault();
    if (this.historyPage > 1) {
      this.historyPage--;
    }
  }

  getCategoryForExpense(catId: string): ExpenseCategory | undefined {
    return this.categories.find(c => c.id === catId);
  }

  getSubcategoryForExpense(subId: string): ExpenseSubcategory | undefined {
    return this.subcategories.find(s => s.id === subId);
  }

  // --- Modales Actions ---

  // Gasto Individual Modal
  openAddExpenseModal(subcategoryId?: string, categoryId?: string): void {
    this.expenseToEdit = null;
    const today = new Date().toISOString().split('T')[0];

    let targetCatId = categoryId || '';
    let targetSubId = subcategoryId || '';

    if (targetSubId && !targetCatId) {
      const sub = this.subcategories.find(s => s.id === targetSubId);
      if (sub) targetCatId = sub.categoryId;
    } else if (targetCatId && !targetSubId) {
      const subs = this.getCategorySubcategories(targetCatId);
      if (subs.length > 0) targetSubId = subs[0].id;
    } else if (!targetCatId && this.categories.length > 0) {
      targetCatId = this.categories[0].id;
      const subs = this.getCategorySubcategories(targetCatId);
      if (subs.length > 0) targetSubId = subs[0].id;
    }

    this.expenseForm = {
      title: '',
      amount: null,
      categoryId: targetCatId,
      subcategoryId: targetSubId,
      date: today,
      notes: ''
    };
    this.isExpenseModalOpen = true;
  }

  openEditExpenseModal(expense: ExpenseItem): void {
    this.expenseToEdit = expense;
    this.expenseForm = {
      title: expense.title,
      amount: expense.amount,
      categoryId: expense.categoryId,
      subcategoryId: expense.subcategoryId,
      date: expense.date,
      notes: expense.notes || ''
    };
    this.isExpenseModalOpen = true;
  }

  onExpenseCategoryChange(): void {
    const subs = this.getCategorySubcategories(this.expenseForm.categoryId);
    this.expenseForm.subcategoryId = subs.length > 0 ? subs[0].id : '';
  }

  saveExpense(): void {
    if (!this.expenseForm.title.trim() || !this.expenseForm.amount || !this.expenseForm.subcategoryId) {
      return;
    }

    const sub = this.subcategories.find(s => s.id === this.expenseForm.subcategoryId);
    const catId = sub ? sub.categoryId : this.expenseForm.categoryId;

    if (this.expenseToEdit) {
      this.expenseService.updateExpense(this.expenseToEdit.id, {
        title: this.expenseForm.title.trim(),
        amount: Number(this.expenseForm.amount),
        categoryId: catId,
        subcategoryId: this.expenseForm.subcategoryId,
        date: this.expenseForm.date || new Date().toISOString().split('T')[0],
        notes: this.expenseForm.notes.trim() || undefined
      });
    } else {
      this.expenseService.addExpense({
        title: this.expenseForm.title.trim(),
        amount: Number(this.expenseForm.amount),
        categoryId: catId,
        subcategoryId: this.expenseForm.subcategoryId,
        date: this.expenseForm.date || new Date().toISOString().split('T')[0],
        notes: this.expenseForm.notes.trim() || undefined
      });
    }

    this.expandedSubcategories[this.expenseForm.subcategoryId] = true;
    this.isExpenseModalOpen = false;
  }

  deleteExpense(expense: ExpenseItem, event?: Event): void {
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar el gasto "${expense.title}" de ${this.currencySymbol} ${expense.amount}?`)) {
      this.expenseService.deleteExpense(expense.id);
    }
  }

  // Categoría Modal
  openAddCategoryModal(): void {
    this.categoryToEdit = null;
    this.categoryForm = {
      name: '',
      icon: 'typcn-folder',
      color: '#3b82f6'
    };
    this.isCategoryModalOpen = true;
  }

  openEditCategoryModal(cat: ExpenseCategory, event?: Event): void {
    if (event) event.stopPropagation();
    this.categoryToEdit = cat;
    this.categoryForm = {
      name: cat.name,
      icon: cat.icon,
      color: cat.color
    };
    this.isCategoryModalOpen = true;
  }

  saveCategory(): void {
    if (!this.categoryForm.name.trim()) return;

    if (this.categoryToEdit) {
      this.expenseService.updateCategory(this.categoryToEdit.id, {
        name: this.categoryForm.name.trim(),
        icon: this.categoryForm.icon,
        color: this.categoryForm.color
      });
    } else {
      this.expenseService.addCategory(
        this.categoryForm.name.trim(),
        this.categoryForm.icon,
        this.categoryForm.color
      );
    }
    this.isCategoryModalOpen = false;
  }

  deleteCategory(cat: ExpenseCategory, event?: Event): void {
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar la categoría "${cat.name}" y todas sus subcategorías y gastos vinculados?`)) {
      this.expenseService.deleteCategory(cat.id);
      if (this.categoryToEdit && this.categoryToEdit.id === cat.id) {
        this.isCategoryModalOpen = false;
      }
    }
  }

  deleteCategoryFromModal(): void {
    if (this.categoryToEdit) {
      this.deleteCategory(this.categoryToEdit);
    }
  }

  restoreSuggestedCategories(): void {
    if (confirm('¿Deseas restaurar las categorías y subcategorías sugeridas por defecto?')) {
      this.expenseService.restoreDefaultCategories(true);
    }
  }

  // Subcategoría Modal
  openAddSubcategoryModal(categoryId?: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.subcategoryToEdit = null;
    this.subcategoryForm = {
      categoryId: categoryId || (this.categories.length > 0 ? this.categories[0].id : ''),
      name: ''
    };
    this.isSubcategoryModalOpen = true;
  }

  openEditSubcategoryModal(sub: ExpenseSubcategory, event?: Event): void {
    if (event) event.stopPropagation();
    this.subcategoryToEdit = sub;
    this.subcategoryForm = {
      categoryId: sub.categoryId,
      name: sub.name
    };
    this.isSubcategoryModalOpen = true;
  }

  saveSubcategory(): void {
    if (!this.subcategoryForm.name.trim() || !this.subcategoryForm.categoryId) return;

    if (this.subcategoryToEdit) {
      this.expenseService.updateSubcategory(this.subcategoryToEdit.id, this.subcategoryForm.name.trim());
    } else {
      this.expenseService.addSubcategory(this.subcategoryForm.categoryId, this.subcategoryForm.name.trim());
    }
    this.isSubcategoryModalOpen = false;
  }

  deleteSubcategory(sub: ExpenseSubcategory, event?: Event): void {
    if (event) event.stopPropagation();
    if (confirm(`¿Eliminar la subcategoría "${sub.name}" y todos sus gastos?`)) {
      this.expenseService.deleteSubcategory(sub.id);
    }
  }

  // Ingreso Mensual Modal
  openIncomeModal(): void {
    this.incomeFormAmount = this.monthlyIncome > 0 ? this.monthlyIncome : null;
    this.isIncomeModalOpen = true;
  }

  saveIncome(): void {
    const amount = Number(this.incomeFormAmount) || 0;
    this.expenseService.setMonthlyIncome(this.selectedMonthKey, amount);
    this.isIncomeModalOpen = false;
  }
}
