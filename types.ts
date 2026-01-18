
export interface UserTag {
  name: string;
  colorIndex: number;
}

export interface Habit {
  id: number;
  name: string;
  description: string;
  category: string; // Refers to UserTag.name
  type: 'positive' | 'negative';
  frequency: 'daily' | 'weekly' | 'monthly';
  color: string;
  completedDates: string[]; // ISO Strings YYYY-MM-DD
  createdAt: string;
  streak: number;
}
