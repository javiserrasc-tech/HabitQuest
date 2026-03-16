
export type HabitStatus = 'success' | 'failure' | 'neutral';

export interface UserTag {
  name: string;
  colorIndex: number;
}

export interface Habit {
  id: number;
  name: string;
  category: string; // Refers to UserTag.name
  type: 'positive' | 'negative';
  frequency: 'daily' | 'weekly' | 'monthly';
  // completions stores the status for each date. 
  // Dates are YYYY-MM-DD. 'neutral' is implied if date is missing.
  completions: Record<string, 'success' | 'failure'>; 
  createdAt: string;
  streak: number;
  reference?: number;
  archived?: boolean;
}
