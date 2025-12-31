
export interface Habit {
  id: number; // Identificador entero manual
  name: string;
  description: string;
  category: string; // Etiqueta personalizada por el usuario
  frequency: 'daily' | 'weekly' | 'monthly';
  color: string;
  completedDates: string[]; // ISO Strings YYYY-MM-DD
  createdAt: string;
  streak: number;
}
