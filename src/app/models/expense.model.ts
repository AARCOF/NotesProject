export interface ExpenseCategory {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
}

export interface ExpenseSubcategory {
  id: string;
  categoryId: string;
  userId: string;
  name: string;
  budget?: number;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  subcategoryId: string;
  categoryId: string;
  userId: string;
  title: string;
  amount: number;
  date: string; // Formato YYYY-MM-DD
  notes?: string;
  isRecurring?: boolean; // Si es true, se repite automáticamente todos los meses
  createdAt: string;
}

export interface ExtraIncomeItem {
  id: string;
  userId: string;
  title: string; // Ej: "Bono de desempeño", "Venta freelance", "Aguinaldo"
  amount: number;
  date: string; // Formato YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface MonthlyBudget {
  userId: string;
  monthKey: string; // Formato YYYY-MM
  monthlyIncome: number;
}
