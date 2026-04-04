export type HabitStatus = 'success' | 'failure' | 'neutral';

export interface UserTag {
  name: string;
  colorIndex: number;
}

export interface Habit {
  id: number;
  name: string;
  category: string;
  type: 'positive' | 'negative';
  frequency: 'daily' | 'weekly' | 'monthly';
  habitType: 'boolean' | 'numeric';
  completions: Record<string, 'success' | 'failure'>;
  numericCompletions?: Record<string, number>;
  createdAt: string;
  streak: number;
  reference?: number;
  archived?: boolean;
  numericGoal?: number;
  numericDirection?: 'min' | 'max';
}
