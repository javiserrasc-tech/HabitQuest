import React, { useState, useRef, useEffect } from 'react';
import { Habit, UserTag, HabitStatus } from '../types';
import { getTagStyles, Icons, COLOR_PALETTE } from '../constants';

interface HabitCardProps {
  habit: Habit;
  userTags: UserTag[];
  onToggle: (id: number) => void;
  onNumericLog: (id: number, value: number) => void;
  onDelete: (id: number) => void;
  onLogPast: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onArchive: (id: number) => void;
  status: HabitStatus;
  todayNumericValue?: number;
  isReorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  curWeek?: number;
  prevWeek?: number;
  selectedDate: string;
}

const HabitCard: React.FC<HabitCardProps> = ({ 
  habit, userTags, onToggle, onNumericLog, onDelete, onLogPast, onEdit, onArchive,
  status, todayNumericValue, isReorderMode, onMoveUp, onMoveDown, isFirst, isLast,
  curWeek, prevWeek, selectedDate
}) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [numericInput, setNumericInput] = useState<string>(
    todayNumericValue !== undefined ? String(todayNumericValue) : ''
  );
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Sync input when date changes
  useEffect(() => {
    setNumericInput(todayNumericValue !== undefined ? String(todayNumericValue) : '');
  }, [todayNumericValue, selectedDate]);

  const tagData = userTags.find(t => t.name === habit.category);
  const theme = getTagStyles(habit.category, tagData?.colorIndex);
  const colorIndex = tagData?.colorIndex ?? 0;
  const paletteColor = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];

  // Franja lateral y badge según frecuencia
  const isWeekly = habit.frequency === 'weekly';
  const isMonthly = habit.frequency === 'monthly';
  const isNonDaily = isWeekly || isMonthly;

  // Franja lateral izquierda: semanal = sólida, mensual = doble línea
  const leftAccent = isWeekly
    ? `before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:${paletteColor.bg}`
    : isMonthly
    ? `before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-full before:${paletteColor.bg} after:content-[''] after:absolute after:left-2 after:top-3 after:bottom-3 after:w-0.5 after:rounded-full after:${paletteColor.bg} after:opacity-50`
    : '';

  // Badge de frecuencia con estilo según tipo
  const freqBadge = () => {
    if (habit.frequency === 'daily') {
      return <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border border-black/5 bg-black/5 text-black/40 shrink-0">Diario</span>;
    }
    if (isWeekly) {
      return <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${paletteColor.tag}`}>· Semanal ·</span>;
    }
    return <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border-2 shrink-0 bg-white ${paletteColor.tag}`}>◈ Mensual ◈</span>;
  };

  const isNumeric = habit.habitType === 'numeric';

  // For numeric: green if value is good vs goal
  const numericIsGood = (val: number) => {
    if (habit.numericGoal === undefined) return null;
    return habit.numericDirection === 'max' ? val >= habit.numericGoal : val <= habit.numericGoal;
  };

  const numericStatus = todayNumericValue !== undefined ? numericIsGood(todayNumericValue) : null;

  const startDeleteTimer = () => {
    startTimeRef.current = Date.now(); setDeleteProgress(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setDeleteProgress(progress);
      if (progress >= 100) { if (timerRef.current) clearInterval(timerRef.current); onDelete(habit.id); }
    }, 50);
  };

  const stopDeleteTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setDeleteProgress(0);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  if (isConfirmingDelete) {
    return (
      <div className="bg-rose-50 rounded-[32px] p-6 border-2 border-rose-100 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-rose-900 font-bold text-sm">¿Eliminar #{habit.id}? Mantén 3s</p>
          <div className="flex gap-3 w-full">
            <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-3 rounded-2xl bg-white border border-rose-200 font-bold text-xs">Atrás</button>
            <button onMouseDown={startDeleteTimer} onMouseUp={stopDeleteTimer} onTouchStart={startDeleteTimer} onTouchEnd={stopDeleteTimer} className="flex-1 relative overflow-hidden py-3 rounded-2xl bg-rose-600 text-white font-bold text-xs select-none">
              <div className="absolute left-0 top-0 bottom-0 bg-rose-900/30 transition-all ease-linear" style={{ width: `${deleteProgress}%` }} />
              <span className="relative z-10">Eliminar</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Card border color
  const cardBorder = isNumeric
    ? numericStatus === true ? 'bg-emerald-50/20 border-emerald-100'
      : numericStatus === false ? 'bg-rose-50/20 border-rose-100'
      : theme.card + ' border-transparent'
    : status === 'success' ? 'bg-emerald-50/20 border-emerald-100'
      : status === 'failure' ? 'bg-rose-50/20 border-rose-100'
      : theme.card + ' border-transparent';

  return (
    <div className={`relative rounded-[32px] p-5 shadow-sm border-2 transition-all duration-300 overflow-hidden ${cardBorder} ${isNonDaily ? leftAccent : ''}`}>
      <div className={`flex flex-col gap-4 ${isNonDaily ? 'pl-3' : ''}`}>
        {/* Top row: tags + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[9px] font-black text-black/20 bg-black/5 px-2 py-0.5 rounded-md">#{habit.id}</span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border shrink-0 ${theme.tag}`}>{habit.category}</span>
            {freqBadge()}
            {isNumeric && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${habit.numericDirection === 'max' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                {habit.numericDirection === 'max' ? '↑' : '↓'} {habit.numericGoal}
              </span>
            )}
            {!isNumeric && habit.streak > 0 && <span className="text-[9px] font-bold text-orange-600">🔥 {habit.streak}</span>}
          </div>
          <div className="flex items-center">
            {isReorderMode ? (
              <div className="flex gap-1">
                {!isFirst && <button onClick={onMoveUp} className="p-1.5 rounded-lg bg-white/80 text-orange-700 border border-orange-100"><Icons.Up /></button>}
                {!isLast && <button onClick={onMoveDown} className="p-1.5 rounded-lg bg-white/80 text-orange-700 border border-orange-100"><Icons.Down /></button>}
              </div>
            ) : (
              <div className="flex">
                <button onClick={() => onArchive(habit.id)} className={`p-1.5 transition-colors ${habit.archived ? 'text-orange-600' : 'text-black/10 hover:text-black/40'}`}><Icons.Archive /></button>
                <button onClick={() => onEdit(habit)} className="p-1.5 text-black/10 hover:text-black/40"><Icons.Edit /></button>
                <button onClick={() => onLogPast(habit)} className="p-1.5 text-black/10 hover:text-black/40"><Icons.Calendar /></button>
                <button onClick={() => setIsConfirmingDelete(true)} className="p-1.5 text-black/10 hover:text-rose-500"><Icons.Trash /></button>
              </div>
            )}
          </div>
        </div>

        {/* Main row: toggle/input + name */}
        <div className="flex items-center gap-4">
          {isNumeric ? (
            <div className="flex flex-col items-center gap-1 shrink-0">
              <input
                type="number"
                value={numericInput}
                onChange={e => setNumericInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(numericInput);
                  if (!isNaN(val)) onNumericLog(habit.id, val);
                }}
                disabled={isReorderMode}
                placeholder="—"
                className={`w-16 h-11 text-center font-black text-sm rounded-2xl border-2 outline-none transition-all
                  ${numericStatus === true ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : numericStatus === false ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'bg-white border-orange-100 text-orange-950'}
                `}
              />
            </div>
          ) : (
            <button
              disabled={isReorderMode}
              onClick={() => onToggle(habit.id)}
              className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center transition-all border-2 active:scale-90
                ${status === 'success' ? 'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200/50 shadow-md'
                  : status === 'failure' ? 'bg-rose-600 border-rose-600 text-white shadow-rose-200/50 shadow-md'
                  : 'bg-white text-orange-200 border-orange-100'}`}
            >
              {status === 'success' ? <Icons.Check /> : status === 'failure' ? <Icons.X /> : <div className="w-4 h-4 rounded-full border-2 border-current opacity-20" />}
            </button>
          )}

          <div className="flex-1 min-w-0">
            <h3 className={`font-bold text-orange-950 text-lg leading-tight transition-all break-words ${!isNumeric && status === 'success' ? 'opacity-40' : ''}`}>
              {habit.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              {isNumeric ? (
                <>
                  <span className="text-[10px] font-black uppercase opacity-40">
                    Sem: {curWeek !== undefined ? curWeek.toFixed(1) : '—'}
                  </span>
                  {prevWeek !== undefined && curWeek !== undefined && (
                    <span className={`text-[10px] font-black uppercase ${
                      habit.numericDirection === 'max'
                        ? curWeek >= prevWeek ? 'text-emerald-600' : 'text-rose-600'
                        : curWeek <= prevWeek ? 'text-emerald-600' : 'text-rose-600'
                    }`}>vs {prevWeek.toFixed(1)}</span>
                  )}
                  {habit.numericGoal !== undefined && curWeek !== undefined && (
                    <span className={`text-[10px] font-black uppercase ${
                      habit.numericDirection === 'max'
                        ? curWeek >= habit.numericGoal ? 'text-emerald-600' : 'text-rose-600'
                        : curWeek <= habit.numericGoal ? 'text-emerald-600' : 'text-rose-600'
                    }`}>obj {habit.numericGoal}</span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[10px] font-black uppercase opacity-40">Semana: {curWeek}%</span>
                  {prevWeek !== undefined && curWeek !== undefined && (
                    <span className={`text-[10px] font-black uppercase ${curWeek >= prevWeek ? 'text-emerald-600' : 'text-rose-600'}`}>
                      vs {prevWeek}%
                    </span>
                  )}
                  {habit.reference !== undefined && curWeek !== undefined && (
                    <span className={`text-[10px] font-black uppercase ${curWeek >= habit.reference ? 'text-emerald-600' : 'text-rose-600'}`}>
                      obj {habit.reference}%
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HabitCard;
