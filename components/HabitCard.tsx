
import React, { useState, useRef, useEffect } from 'react';
import { Habit } from '../types';
import { getTagStyles, Icons } from '../constants';

interface HabitCardProps {
  habit: Habit;
  userTags: string[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onLogPast: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  isCompletedToday: boolean;
  isReorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ 
  habit, 
  userTags, 
  onToggle, 
  onDelete, 
  onLogPast, 
  onEdit, 
  isCompletedToday,
  isReorderMode,
  onMoveUp,
  onMoveDown
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const getFrequencyLabel = () => {
    switch(habit.frequency) {
      case 'daily': return 'Diario';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensual';
      default: return habit.frequency;
    }
  };

  const getFrequencyStyle = () => {
    switch(habit.frequency) {
      case 'daily': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'weekly': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'monthly': return 'bg-rose-100 text-rose-800 border-rose-200';
      default: return 'bg-orange-50 text-orange-500 border-orange-100';
    }
  };

  const startDeleteTimer = () => {
    startTimeRef.current = Date.now();
    setDeleteProgress(0);
    
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 5000) * 100, 100);
      setDeleteProgress(progress);
      
      if (progress >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        onDelete(habit.id);
      }
    }, 50);
  };

  const stopDeleteTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDeleteProgress(0);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (isConfirmingDelete) {
    return (
      <div className="relative bg-rose-50 rounded-[32px] p-6 shadow-md border-2 border-rose-200 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-rose-900 font-bold text-sm">¿Seguro? Mantén pulsado 5 segundos para eliminar</p>
          <div className="flex gap-4 w-full">
            <button 
              onClick={() => { setIsConfirmingDelete(false); setDeleteProgress(0); }}
              className="flex-1 py-3 px-4 rounded-2xl bg-white border border-rose-200 text-rose-900 font-black uppercase text-[10px]"
            >
              Cancelar
            </button>
            <button 
              onMouseDown={startDeleteTimer}
              onMouseUp={stopDeleteTimer}
              onMouseLeave={stopDeleteTimer}
              onTouchStart={startDeleteTimer}
              onTouchEnd={stopDeleteTimer}
              className="flex-1 relative overflow-hidden py-3 px-4 rounded-2xl bg-rose-600 text-white font-black uppercase text-[10px] shadow-lg active:scale-95 transition-transform select-none"
            >
              <div 
                className="absolute left-0 top-0 bottom-0 bg-rose-900/40 transition-all ease-linear" 
                style={{ width: `${deleteProgress}%` }}
              />
              <span className="relative z-10">Eliminar ({Math.ceil(5 - (deleteProgress/100 * 5))}s)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#fffdf5] rounded-[32px] p-6 shadow-md border-2 transition-all duration-500 ${isCompletedToday ? 'border-orange-500/20 bg-orange-50/30' : 'border-orange-100/50'} ${isReorderMode ? 'translate-x-2 border-orange-400' : ''}`}>
      <div className="flex items-center gap-5">
        {isReorderMode ? (
          <div className="flex flex-col gap-1 shrink-0 animate-in fade-in zoom-in duration-300">
             <button onClick={onMoveUp} className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center active:bg-orange-200">
               <Icons.Up />
             </button>
             <button onClick={onMoveDown} className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center active:bg-orange-200">
               <Icons.Down />
             </button>
          </div>
        ) : (
          <button 
            onClick={() => onToggle(habit.id)} 
            className={`w-14 h-14 rounded-3xl flex items-center justify-center transition-all duration-500 shrink-0 border-2 ${
              isCompletedToday ? 'bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-200' : 'bg-orange-50/50 text-orange-200 border-orange-100'
            }`}
          >
            {isCompletedToday ? <Icons.Check /> : <div className="w-2 h-2 rounded-full bg-orange-200" />}
          </button>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 overflow-x-auto no-scrollbar">
            <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border shrink-0 ${getTagStyles(habit.category)}`}>
              {habit.category}
            </span>

            <span className={`text-[8px] font-black uppercase tracking-[0.15em] px-2 py-0.5 rounded-md border shrink-0 ${getFrequencyStyle()}`}>
              {getFrequencyLabel()}
            </span>
            {habit.streak > 0 && (
              <span className="text-[10px] font-bold text-orange-500 whitespace-nowrap">
                🔥 {habit.streak}
              </span>
            )}
          </div>
          
          <h3 
            className={`font-bold text-orange-900 text-lg leading-tight transition-all truncate ${isCompletedToday && !isReorderMode ? 'opacity-30 line-through' : ''}`}
          >
            {habit.name}
          </h3>
        </div>

        {!isReorderMode && (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); onEdit(habit); }} className="text-orange-200 hover:text-orange-500 p-2 transition-colors shrink-0">
              <Icons.Edit />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onLogPast(habit); }} className="text-orange-200 hover:text-orange-500 p-2 transition-colors shrink-0">
              <Icons.Calendar />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} className="text-orange-200 hover:text-red-500 p-2 transition-colors shrink-0">
              <Icons.Trash />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HabitCard;
