
import React, { useState, useRef, useEffect } from 'react';
import { Habit, UserTag, HabitStatus } from '../types';
import { getTagStyles, Icons } from '../constants';

interface HabitCardProps {
  habit: Habit;
  userTags: UserTag[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onLogPast: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  status: HabitStatus;
  isReorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const HabitCard: React.FC<HabitCardProps> = ({ 
  habit, 
  userTags, 
  onToggle, 
  onDelete, 
  onLogPast, 
  onEdit, 
  status,
  isReorderMode,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const tagData = userTags.find(t => t.name === habit.category);
  const theme = getTagStyles(habit.category, tagData?.colorIndex);

  const getFrequencyLabel = () => {
    switch(habit.frequency) {
      case 'daily': return 'Diario';
      case 'weekly': return 'Semanal';
      case 'monthly': return 'Mensual';
      default: return habit.frequency;
    }
  };

  const startDeleteTimer = () => {
    startTimeRef.current = Date.now();
    setDeleteProgress(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100);
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
      <div className="bg-rose-50 rounded-[32px] p-6 border-2 border-rose-100 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-rose-900 font-bold text-sm">¿Eliminar? Mantén pulsado 3s</p>
          <div className="flex gap-3 w-full">
            <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-3 px-4 rounded-2xl bg-white border border-rose-200 text-rose-900 font-bold text-xs">Cancelar</button>
            <button 
              onMouseDown={startDeleteTimer} onMouseUp={stopDeleteTimer} onTouchStart={startDeleteTimer} onTouchEnd={stopDeleteTimer}
              className="flex-1 relative overflow-hidden py-3 px-4 rounded-2xl bg-rose-600 text-white font-bold text-xs select-none"
            >
              <div className="absolute left-0 top-0 bottom-0 bg-rose-900/30 transition-all ease-linear" style={{ width: `${deleteProgress}%` }} />
              <span className="relative z-10">Eliminar ({Math.ceil(3 - (deleteProgress/100 * 3))}s)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isNegative = habit.type === 'negative';

  const getStatusStyles = () => {
    switch (status) {
      case 'success':
        return 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200/50';
      case 'failure':
        return 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200/50';
      default:
        return 'bg-white text-orange-200 border-orange-100 hover:border-orange-200';
    }
  };

  const getCardOverlay = () => {
    if (status === 'success') return 'border-emerald-100 bg-emerald-50/20';
    if (status === 'failure') return 'border-rose-100 bg-rose-50/20';
    return theme.card + ' border-transparent';
  };

  return (
    <div className={`relative rounded-[32px] p-5 shadow-sm border-2 transition-all duration-300 ${getCardOverlay()} ${
      status !== 'neutral' ? 'opacity-90' : ''
    }`}>
      <div className="flex flex-col gap-4">
        
        {/* Fila Superior: Etiquetas y Acciones de Gestión */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {isNegative && (
              <span className="text-rose-400">
                <Icons.Alert />
              </span>
            )}
            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border shrink-0 ${theme.tag}`}>
              {habit.category}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-lg bg-white/50 border border-black/5 text-black/40 shrink-0">
              {getFrequencyLabel()}
            </span>
            {habit.streak > 0 && (
              <span className="text-[9px] font-bold text-orange-600 shrink-0">🔥 {habit.streak}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {isReorderMode ? (
              <div className="flex gap-1">
                {!isFirst && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }} 
                    className="p-1.5 rounded-lg bg-white/80 text-orange-700 border border-orange-100 shadow-sm active:scale-90 transition-transform"
                    title="Subir"
                  >
                    <Icons.Up />
                  </button>
                )}
                {!isLast && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }} 
                    className="p-1.5 rounded-lg bg-white/80 text-orange-700 border border-orange-100 shadow-sm active:scale-90 transition-transform"
                    title="Bajar"
                  >
                    <Icons.Down />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex">
                <button onClick={() => onEdit(habit)} className="p-1.5 text-black/10 hover:text-black/40 transition-colors"><Icons.Edit /></button>
                <button onClick={() => onLogPast(habit)} className="p-1.5 text-black/10 hover:text-black/40 transition-colors"><Icons.Calendar /></button>
                <button onClick={() => setIsConfirmingDelete(true)} className="p-1.5 text-black/10 hover:text-rose-500 transition-colors"><Icons.Trash /></button>
              </div>
            )}
          </div>
        </div>

        {/* Fila Inferior: Botonocito de completar (izquierda) + Nombre (ocupa el resto) */}
        <div className="flex items-center gap-4">
          <button 
            disabled={isReorderMode}
            onClick={() => onToggle(habit.id)} 
            className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 active:scale-90 ${getStatusStyles()} ${isReorderMode ? 'opacity-20 grayscale cursor-default' : ''}`}
          >
            {status === 'success' ? <Icons.Check /> : status === 'failure' ? <Icons.X /> : <div className={`w-4 h-4 rounded-full border-2 border-current opacity-20`} />}
          </button>
          
          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-orange-950 text-lg leading-tight transition-all break-words ${status === 'success' ? 'opacity-50' : status === 'failure' ? 'text-rose-900' : ''}`}>
              {habit.name}
            </h3>
            {status === 'success' && <p className="text-[8px] font-black uppercase text-emerald-600 mt-1 tracking-wider">¡Bien hecho!</p>}
            {status === 'failure' && <p className="text-[8px] font-black uppercase text-rose-600 mt-1 tracking-wider">Mañana será mejor</p>}
            {status === 'neutral' && isNegative && <p className="text-[8px] font-black uppercase text-rose-400 mt-1 tracking-wider">Resiste hoy</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabitCard;
