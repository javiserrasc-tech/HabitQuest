
import React, { useState, useEffect, useMemo } from 'react';
import { Habit, UserTag } from './types';
import { Icons, getTagStyles, COLOR_PALETTE } from './constants';
import HabitCard from './components/HabitCard';

const STORAGE_KEY = 'habitquest_data_v4';
const SYNC_URL_KEY = 'habitquest_sync_url';
const TAGS_KEY = 'habitquest_tags_v4';
const DEFAULT_TAG: UserTag = { name: 'General', colorIndex: 0 };

type View = 'habits' | 'analysis';
type Period = 'weekly' | 'monthly';

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d.setDate(diff));
  return getLocalDateString(start);
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  return getLocalDateString(start);
};

const App: React.FC = () => {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userTags, setUserTags] = useState<UserTag[]>([DEFAULT_TAG]);
  const [currentView, setCurrentView] = useState<View>('habits');
  const [analysisPeriod, setAnalysisPeriod] = useState<Period>('weekly');
  const [expandedHabitId, setExpandedHabitId] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isPastDateModalOpen, setIsPastDateModalOpen] = useState(false);
  
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem(SYNC_URL_KEY) || '');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [selectedHabitForPastDate, setSelectedHabitForPastDate] = useState<Habit | null>(null);
  const [pastDateToLog, setPastDateToLog] = useState(getLocalDateString());
  const [isPastDateCompleted, setIsPastDateCompleted] = useState(false);
  
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'positive' | 'negative'>('positive');
  const [selectedTagName, setSelectedTagName] = useState(DEFAULT_TAG.name);
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagColorIndex, setNewTagColorIndex] = useState(0);

  useEffect(() => {
    const savedHabits = localStorage.getItem(STORAGE_KEY);
    if (savedHabits) {
      const parsed = JSON.parse(savedHabits);
      // Asegurar que los hábitos antiguos tengan un type
      setHabits(parsed.map((h: any) => ({ ...h, type: h.type || 'positive' })));
    }
    
    const savedTags = localStorage.getItem(TAGS_KEY);
    if (savedTags) {
      const parsedTags = JSON.parse(savedTags);
      if (parsedTags.length > 0) {
        const formattedTags = parsedTags.map((t: any) => ({
          name: typeof t === 'string' ? t : t.name,
          colorIndex: (t.colorIndex !== undefined ? t.colorIndex : 0) % COLOR_PALETTE.length
        }));
        setUserTags(formattedTags);
      } else {
        setUserTags([DEFAULT_TAG]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem(TAGS_KEY, JSON.stringify(userTags));
  }, [userTags]);

  const isIdTaken = (id: number) => habits.some(h => h.id === id);
  const idInUse = newId !== '' && isIdTaken(parseInt(newId));

  const getFirstAvailableId = () => {
    const ids = new Set(habits.map(h => h.id));
    let id = 1;
    while (ids.has(id)) { id++; }
    return id;
  };

  const calculateRate = (habit: Habit, daysBack: number | 'year') => {
    const now = new Date();
    let cutoffDate: Date;
    if (daysBack === 'year') {
      cutoffDate = new Date(now.getFullYear(), 0, 1);
    } else {
      cutoffDate = new Date();
      cutoffDate.setDate(now.getDate() - daysBack);
    }
    const cutoffStr = getLocalDateString(cutoffDate);
    const completions = habit.completedDates.filter(d => d >= cutoffStr).length;
    const diffTime = Math.abs(now.getTime() - cutoffDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    let expected = 1;
    if (habit.frequency === 'daily') expected = diffDays;
    else if (habit.frequency === 'weekly') expected = Math.ceil(diffDays / 7);
    else expected = Math.ceil(diffDays / 30);
    
    const rawRate = (completions / expected);
    // Para hábitos negativos, la tasa es el % de días en los que NO se ha marcado (completados = caídas)
    const finalRate = habit.type === 'negative' ? (1 - rawRate) : rawRate;
    return Math.min(100, Math.max(0, Math.round(finalRate * 100)));
  };

  const syncToGoogleSheets = async (habit: Habit, valor: number, customDate?: string) => {
    if (!syncUrl) return;
    setIsSyncing(true);
    try {
      const dateOnly = customDate || selectedDate;
      const payload = {
        action: 'upsert', 
        id_habito: habit.id,
        nombre_habito: habit.name,
        categoria: habit.category,
        fecha: dateOnly,
        valor: valor 
      };
      await fetch(syncUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  const isHabitCompletedForDate = (habit: Habit, dateStr: string) => {
    if (habit.frequency === 'daily') return habit.completedDates.includes(dateStr);
    const date = new Date(dateStr);
    if (habit.frequency === 'weekly') {
      const start = getStartOfWeek(date);
      const end = getLocalDateString(new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000));
      return habit.completedDates.some(d => d >= start && d <= end);
    }
    const startM = getStartOfMonth(date);
    const endM = getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    return habit.completedDates.some(d => d >= startM && d <= endM);
  };

  const handleToggleHabit = (id: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const isCurrentlyMarked = isHabitCompletedForDate(h, selectedDate);
        const willBeMarked = !isCurrentlyMarked;
        
        // LOGICA CRÍTICA: Hábitos Negativos
        let sheetValue: number;
        if (h.type === 'negative') {
          // Si lo marco (willBeMarked = true), es que caí => enviar 0
          // Si lo desmarco (willBeMarked = false), es que me resistí => enviar 1
          sheetValue = willBeMarked ? 0 : 1;
        } else {
          // Si lo marco, completado => enviar 1
          // Si lo desmarco, no completado => enviar 0
          sheetValue = willBeMarked ? 1 : 0;
        }

        let newCompletedDates = [...h.completedDates];
        if (isCurrentlyMarked) {
          if (h.frequency === 'daily') {
            newCompletedDates = newCompletedDates.filter(d => d !== selectedDate);
          } else {
            const date = new Date(selectedDate);
            if (h.frequency === 'weekly') {
              const start = getStartOfWeek(date);
              const end = getLocalDateString(new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000));
              newCompletedDates = newCompletedDates.filter(d => !(d >= start && d <= end));
            } else {
              const startM = getStartOfMonth(date);
              const endM = getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
              newCompletedDates = newCompletedDates.filter(d => !(d >= startM && d <= endM));
            }
          }
        } else {
          newCompletedDates.push(selectedDate);
        }
        
        syncToGoogleSheets(h, sheetValue, selectedDate);
        
        // Streak logic simplificada: para positivos incrementa al marcar, para negativos al resistir (desmarcar)
        let newStreak = h.streak;
        if (h.type === 'negative') {
          newStreak = willBeMarked ? 0 : h.streak + 1; // Si marco (caigo), reseteo. Si desmarco (resisto), sumo? Un poco raro para desmarcar.
        } else {
          newStreak = willBeMarked ? h.streak + 1 : Math.max(0, h.streak - 1);
        }

        return { ...h, completedDates: newCompletedDates, streak: newStreak };
      }
      return h;
    }));
  };

  const handleAddHabit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const idNum = parseInt(newId);
    if (isNaN(idNum) || !newName.trim() || isIdTaken(idNum)) return;
    const newHabit: Habit = {
      id: idNum, name: newName, description: '', category: selectedTagName,
      type: newType,
      frequency: newFreq, color: '#10b981', completedDates: [],
      createdAt: new Date().toISOString(), streak: 0
    };
    setHabits(prev => [...prev, newHabit]);
    setIsModalOpen(false);
    setNewId(''); setNewName(''); setSelectedTagName(userTags[0]?.name || DEFAULT_TAG.name); setNewType('positive');
    // Para hábitos negativos, al crear se asume que se resistió hoy (valor 1)? 
    // Por simplicidad enviamos 0 de valor neutral en la creación para positivos, 1 para negativos (resistencia por defecto si no hay marca)
    syncToGoogleSheets(newHabit, newHabit.type === 'negative' ? 1 : 0, today);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingHabit) return;
    setHabits(prev => prev.map(h => h.id === editingHabit.id ? editingHabit : h));
    
    const isMarked = editingHabit.completedDates.includes(selectedDate);
    let sheetValue: number;
    if (editingHabit.type === 'negative') {
        sheetValue = isMarked ? 0 : 1;
    } else {
        sheetValue = isMarked ? 1 : 0;
    }
    
    syncToGoogleSheets(editingHabit, sheetValue, selectedDate);
    setIsEditModalOpen(false);
    setEditingHabit(null);
  };

  const stats = useMemo(() => {
    const totalHabitsCount = habits.length;
    // La tasa de hoy es complicada si mezclamos tipos.
    // Usaremos un promedio de las tasas individuales
    const habitDetails = habits.map(h => ({ 
        ...h, 
        weekRate: calculateRate(h, 7),
        threeMonthsRate: calculateRate(h, 90),
        yearRate: calculateRate(h, 'year')
      }));
      
    const avgRate = totalHabitsCount > 0 
        ? habitDetails.reduce((acc, h) => acc + calculateRate(h, 1), 0) / totalHabitsCount 
        : 0;

    return { 
        totalHabitsCount, 
        globalCompletionRate: avgRate, 
        habitDetails,
        completedThisPeriodCount: habits.filter(h => {
            const marked = isHabitCompletedForDate(h, selectedDate);
            return h.type === 'negative' ? !marked : marked;
        }).length
    };
  }, [habits, selectedDate]);

  const moveHabit = (index: number, direction: 'up' | 'down') => {
    const newHabits = [...habits];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newHabits.length) {
      [newHabits[index], newHabits[targetIndex]] = [newHabits[targetIndex], newHabits[index]];
      setHabits(newHabits);
    }
  };

  const renderHabitAnalysis = (habit: Habit) => {
    let history: { completed: boolean }[] = [];
    let label = ""; let sublabel = "";
    const isNegative = habit.type === 'negative';

    if (habit.frequency === 'daily') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const iso = getLocalDateString(d);
        const marked = habit.completedDates.includes(iso);
        // "Completed" en análisis significa "Éxito"
        history.push({ completed: isNegative ? !marked : marked });
      }
      label = "Últimos 30 días (Éxito)";
      sublabel = `${history.filter(h => h.completed).length} de 30 días sin fallar`;
    } else if (habit.frequency === 'weekly') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - (i * 7));
        const start = getStartOfWeek(d);
        const end = getLocalDateString(new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000));
        const marked = habit.completedDates.some(cd => cd >= start && cd <= end);
        history.push({ completed: isNegative ? !marked : marked });
      }
      label = "Últimas 12 semanas (Éxito)";
      sublabel = `${history.filter(h => h.completed).length} de 12 semanas limpio`;
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const m = d.getMonth(); const y = d.getFullYear();
        const start = getLocalDateString(new Date(y, m, 1));
        const end = getLocalDateString(new Date(y, m + 1, 0));
        const marked = habit.completedDates.some(cd => cd >= start && cd <= end);
        history.push({ completed: isNegative ? !marked : marked });
      }
      label = "Últimos 12 meses (Éxito)";
      sublabel = `${history.filter(h => h.completed).length} de 12 meses de victoria`;
    }
    return (
      <div className="mt-6 pt-6 border-t border-black/5 animate-in fade-in slide-in-from-top-2">
        <div className="flex justify-between items-end mb-4">
          <div>
            <p className="text-[10px] font-black uppercase text-black/30 tracking-wider mb-0.5">{label}</p>
            <p className="text-xs font-bold text-black/60">{sublabel}</p>
          </div>
          <p className="text-[9px] font-bold text-black/20">{isNegative ? 'Caídas' : 'Completados'}: {habit.completedDates.length}</p>
        </div>
        <div className="grid grid-cols-6 gap-2.5">
           {history.map((item, idx) => (
              <div key={idx} className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${item.completed ? (isNegative ? 'bg-emerald-600 border-emerald-600' : 'bg-orange-600 border-orange-600') + ' text-white shadow-sm' : 'bg-white/40 border-black/5 text-black/10'}`}>
                {item.completed && <Icons.Check />}
              </div>
            ))}
        </div>
      </div>
    );
  };

  const handleSaveSyncUrl = () => {
    localStorage.setItem(SYNC_URL_KEY, syncUrl);
    setIsSyncModalOpen(false);
  };

  const isPast = selectedDate !== today;

  return (
    <div className={`max-w-md mx-auto min-h-screen flex flex-col relative safe-area-inset-top text-orange-950 transition-colors duration-500 ${isPast ? 'bg-amber-50/30' : ''}`}>
      {isSyncing && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] bg-orange-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <div className="w-2 h-2 bg-orange-300 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
        </div>
      )}

      {isPast && (
        <div className="bg-orange-600 text-white text-[9px] font-black uppercase tracking-[0.2em] py-1.5 text-center shadow-sm animate-in slide-in-from-top duration-300">
          Modo Historial Activo
        </div>
      )}

      <div className={`px-6 pt-8 flex justify-between items-start mb-2 transition-all ${isPast ? 'bg-orange-50/80 backdrop-blur-md pb-4' : ''}`}>
        <div className="flex gap-2">
          <button onClick={() => setIsTagManagerOpen(true)} className="p-3 rounded-2xl border bg-white/60 border-black/5 text-black/60 shadow-sm flex items-center gap-2 active:scale-95 transition-all">
            <Icons.Settings />
            <span className="text-[10px] font-black uppercase tracking-wider">Etiquetas</span>
          </button>
          <button onClick={() => setIsReorderMode(!isReorderMode)} className={`p-3 rounded-2xl border shadow-sm flex items-center gap-2 active:scale-95 transition-all ${isReorderMode ? 'bg-orange-600 text-white border-orange-600' : 'bg-white/60 border-black/5 text-black/60'}`}>
            <Icons.Move />
            <span className="text-[10px] font-black uppercase tracking-wider">{isReorderMode ? 'Hecho' : 'Mover'}</span>
          </button>
        </div>
        <button onClick={() => setIsSyncModalOpen(true)} className={`p-3 rounded-2xl transition-all shadow-sm border ${syncUrl ? 'text-black/60 bg-white/60 border-black/5' : 'opacity-30'}`}>
          <Icons.Cloud />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {currentView === 'habits' ? (
          <div className="px-6 animate-in fade-in duration-500">
            <header className="mb-8 flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-black tracking-tight">HabitQuest</h1>
                <div className="relative group">
                  <input 
                    type="date" 
                    value={selectedDate} 
                    max={today}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white/40 border border-black/5 px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider outline-none focus:ring-2 ring-orange-200 transition-all cursor-pointer"
                  />
                </div>
              </div>
              <p className="font-medium opacity-60 uppercase text-[10px] tracking-widest">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </header>
            {!isReorderMode && (
              <div className={`mb-8 rounded-[32px] p-7 shadow-xl relative overflow-hidden text-orange-50 animate-in zoom-in duration-300 transition-all ${isPast ? 'bg-orange-800' : 'bg-orange-700'}`}>
                <div className="relative z-10">
                  <p className="text-[10px] font-bold mb-1 uppercase tracking-widest opacity-60">
                    {isPast ? `Progreso el ${selectedDate}` : 'Rendimiento diario'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-5xl font-black">{Math.round(stats.globalCompletionRate)}%</h2>
                    <p className="opacity-70 font-bold">{stats.completedThisPeriodCount} / {stats.totalHabitsCount}</p>
                  </div>
                  <div className="mt-6 w-full rounded-full h-3 bg-white/10">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out bg-orange-300" style={{ width: `${stats.globalCompletionRate}%` }} />
                  </div>
                </div>
              </div>
            )}
            <section className="space-y-4">
              {habits.length === 0 ? (
                <div className="text-center py-20 opacity-40 italic">Nada por aquí aún... pulsa +</div>
              ) : (
                habits.map((h, idx) => (
                  <HabitCard 
                    key={h.id} 
                    habit={h} 
                    userTags={userTags} 
                    isCompletedToday={isHabitCompletedForDate(h, selectedDate)} 
                    onToggle={handleToggleHabit} 
                    onEdit={(habit) => { setEditingHabit({...habit}); setIsEditModalOpen(true); }} 
                    onDelete={(id) => setHabits(p => p.filter(x => x.id !== id))} 
                    onLogPast={(habit) => { setSelectedHabitForPastDate(habit); setIsPastDateModalOpen(true); }} 
                    isReorderMode={isReorderMode} 
                    onMoveUp={() => moveHabit(idx, 'up')} 
                    onMoveDown={() => moveHabit(idx, 'down')} 
                  />
                ))
              )}
            </section>
          </div>
        ) : (
          <div className="px-6 animate-in slide-in-from-right duration-500">
             <header className="mb-8">
                <h1 className="text-3xl font-black tracking-tight text-orange-950">Análisis</h1>
                <p className="text-[10px] font-black uppercase text-black/30 tracking-widest mt-1">Rendimiento Histórico</p>
             </header>
             <div className="space-y-4 pb-12">
              {stats.habitDetails.map(habit => {
                const tagData = userTags.find(t => t.name === habit.category);
                const theme = getTagStyles(habit.category, tagData?.colorIndex);
                const isNegative = habit.type === 'negative';
                return (
                  <div key={habit.id} onClick={() => setExpandedHabitId(expandedHabitId === habit.id ? null : habit.id)} className={`border-2 rounded-[32px] p-6 shadow-sm cursor-pointer transition-all duration-300 ${theme.card} ${expandedHabitId === habit.id ? 'shadow-lg border-black/10' : 'border-transparent'} ${isNegative && expandedHabitId !== habit.id ? 'border-rose-100' : ''}`}>
                    <div className="flex flex-col gap-5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-orange-950 truncate text-lg">{habit.name}</h4>
                          {isNegative && <Icons.Alert />}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md border shrink-0 ${theme.tag}`}>
                            {habit.category}
                          </span>
                          <span className="text-[8px] opacity-40 uppercase font-black tracking-widest">
                            {habit.frequency === 'daily' ? 'Diario' : habit.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                          </span>
                          {isNegative && <span className="text-[8px] font-black text-rose-500 uppercase">Negativo</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {[{l:'Semana', r: habit.weekRate}, {l:'3 Meses', r: habit.threeMonthsRate}, {l:'Año', r: habit.yearRate}].map((s, i) => (
                          <div key={i} className="bg-white/60 border border-white rounded-2xl p-3 flex flex-col items-center shadow-sm">
                            <span className="text-[8px] font-black uppercase text-black/30 mb-1">{s.l}</span>
                            <span className={`text-lg font-black ${isNegative ? 'text-rose-600' : theme.accent}`}>{s.r}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {expandedHabitId === habit.id && renderHabitAnalysis(habit)}
                  </div>
                );
              })}
              {habits.length === 0 && <div className="text-center py-20 opacity-40 italic">Crea hábitos para ver estadísticas.</div>}
             </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t px-12 py-5 flex justify-between items-center z-40 rounded-t-[32px] shadow-2xl bg-white/80 border-black/5">
        <button onClick={() => setCurrentView('habits')} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'habits' ? 'scale-110 text-orange-700' : 'opacity-30'}`}>
          <Icons.Target /><span className="text-[9px] font-black uppercase">Hábitos</span>
        </button>
        <button onClick={() => { setNewId(String(getFirstAvailableId())); setIsModalOpen(true); }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-orange-700 text-white -mt-10 border-4 border-white">
          <Icons.Plus />
        </button>
        <button onClick={() => { setCurrentView('analysis'); setExpandedHabitId(null); }} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'analysis' ? 'scale-110 text-orange-700' : 'opacity-30'}`}>
          <Icons.Chart /><span className="text-[9px] font-black uppercase">Análisis</span>
        </button>
      </nav>

      {/* MODALES */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={handleAddHabit} className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto bg-[#fffcf5]">
            <h3 className="text-3xl font-black mb-8 tracking-tight">Nuevo Hábito</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">ID Único</p>
                <input required type="number" value={newId} onChange={e => setNewId(e.target.value)} className={`w-full px-6 py-4 rounded-[20px] border outline-none font-bold transition-all ${idInUse ? 'border-rose-500 bg-rose-50' : 'bg-white border-black/5'}`} />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Nombre</p>
                <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-6 py-5 rounded-[24px] border border-black/5 bg-white font-bold" placeholder="¿Qué harás hoy?" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Tipo de Hábito</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNewType('positive')} className={`py-4 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newType === 'positive' ? 'bg-orange-700 border-orange-700 text-white shadow-md' : 'bg-white border-black/5 text-black/20'}`}>Positivo</button>
                  <button type="button" onClick={() => setNewType('negative')} className={`py-4 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newType === 'negative' ? 'bg-rose-700 border-rose-700 text-white shadow-md' : 'bg-white border-black/5 text-black/20'}`}>Negativo</button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => {
                    const theme = getTagStyles(tag.name, tag.colorIndex);
                    return <button key={tag.name} type="button" onClick={() => setSelectedTagName(tag.name)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${selectedTagName === tag.name ? 'bg-orange-700 border-orange-700 text-white shadow-sm' : `${theme.tag} border-transparent`}`}>{tag.name}</button>;
                  })}
                  <button type="button" onClick={() => setIsTagManagerOpen(true)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-dashed border-black/10 text-black/20">+</button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Frecuencia</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(f => (
                    <button key={f} type="button" onClick={() => setNewFreq(f)} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newFreq === f ? 'bg-orange-700 border-orange-700 text-white shadow-md' : 'bg-white border-black/5 text-black/20'}`}>{f === 'daily' ? 'Día' : f === 'weekly' ? 'Sem' : 'Mes'}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 opacity-40 font-black uppercase text-[10px]">Cerrar</button>
                <button type="submit" disabled={idInUse || !newId || !newName} className="flex-[2] py-5 font-black uppercase text-[10px] rounded-[24px] shadow-lg bg-orange-700 text-white">Crear</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isEditModalOpen && editingHabit && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={handleSaveEdit} className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl bg-[#fffcf5]">
            <h3 className="text-3xl font-black mb-8 tracking-tight">Editar Hábito</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Nombre</p>
                <input required value={editingHabit.name} onChange={e => setEditingHabit({...editingHabit, name: e.target.value})} className="w-full px-6 py-5 rounded-[24px] border border-black/5 bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Tipo de Hábito</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditingHabit({...editingHabit, type: 'positive'})} className={`py-4 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editingHabit.type === 'positive' ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-black/5'}`}>Positivo</button>
                  <button type="button" onClick={() => setEditingHabit({...editingHabit, type: 'negative'})} className={`py-4 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editingHabit.type === 'negative' ? 'bg-rose-700 border-rose-700 text-white' : 'bg-white border-black/5'}`}>Negativo</button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => {
                    const theme = getTagStyles(tag.name, tag.colorIndex);
                    return <button key={tag.name} type="button" onClick={() => setEditingHabit({...editingHabit, category: tag.name})} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editingHabit.category === tag.name ? 'bg-orange-700 border-orange-700 text-white' : `${theme.tag} border-transparent`}`}>{tag.name}</button>;
                  })}
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingHabit(null); }} className="flex-1 py-5 opacity-40 font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-[2] py-5 font-black uppercase text-[10px] rounded-[24px] shadow-lg bg-orange-700 text-white">Guardar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl bg-[#fffcf5] max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black mb-6">Gestionar Etiquetas</h3>
            <div className="space-y-4 mb-6">
              <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-black/5 bg-white font-bold" placeholder="Nombre..." />
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Color (5 opciones claras)</p>
                <div className="flex gap-3 pb-2">
                  {COLOR_PALETTE.map((color, i) => (
                    <button key={i} type="button" onClick={() => setNewTagColorIndex(i)} className={`w-12 h-12 rounded-2xl shrink-0 border-4 transition-all ${newTagColorIndex === i ? 'border-orange-700 scale-110 shadow-md' : 'border-white'} ${color.bg}`} />
                  ))}
                </div>
              </div>
              <button onClick={() => { if(newTagInput) { setUserTags(p => [...p, { name: newTagInput, colorIndex: newTagColorIndex }]); setNewTagInput(''); } }} className="w-full py-4 font-black rounded-2xl text-[10px] bg-orange-700 text-white uppercase shadow-lg">Añadir Etiqueta</button>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase opacity-40 ml-1">Tus Etiquetas</p>
              {userTags.map((t) => {
                const theme = getTagStyles(t.name, t.colorIndex);
                return (
                  <div key={t.name} className={`flex items-center justify-between p-4 rounded-2xl border ${theme.card}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-lg shadow-sm ${COLOR_PALETTE[t.colorIndex].bg}`} />
                      <span className="font-bold text-sm text-orange-950">{t.name}</span>
                    </div>
                    <button onClick={() => { if(userTags.length > 1) setUserTags(p => p.filter(x => x.name !== t.name)); }} className="text-black/10 hover:text-rose-500 p-2"><Icons.Trash /></button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setIsTagManagerOpen(false)} className="mt-8 py-4 opacity-40 text-xs font-black uppercase w-full">Cerrar</button>
          </div>
        </div>
      )}

      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-8 shadow-2xl flex flex-col bg-[#fffcf5] overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black mb-4 tracking-tight text-center">Nube</h3>
            <div className="space-y-4 mb-6">
              <input value={syncUrl} onChange={e => setSyncUrl(e.target.value)} className="w-full px-5 py-4 rounded-2xl border border-black/5 bg-white font-bold text-xs" placeholder="URL Google App Script" />
              <button onClick={handleSaveSyncUrl} className="w-full py-4 bg-orange-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Guardar Configuración</button>
            </div>
            <button onClick={() => setIsSyncModalOpen(false)} className="py-2 opacity-40 font-black uppercase text-[10px] w-full text-center">Cerrar</button>
          </div>
        </div>
      )}

      {isPastDateModalOpen && selectedHabitForPastDate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-xs bg-[#fffcf5] rounded-[40px] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-4 text-center">Log Histórico</h3>
            <input type="date" value={pastDateToLog} max={today} onChange={e => setPastDateToLog(e.target.value)} className="w-full p-4 rounded-2xl border mb-4 font-bold border-black/5 bg-white text-center" />
            <div className="flex p-1 bg-black/5 rounded-2xl mb-6">
               <button onClick={() => setIsPastDateCompleted(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${isPastDateCompleted ? 'bg-orange-600 text-white shadow-sm' : 'opacity-40'}`}>{selectedHabitForPastDate.type === 'negative' ? 'Caída' : 'Hecho'}</button>
               <button onClick={() => setIsPastDateCompleted(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${!isPastDateCompleted ? 'bg-orange-600 text-white shadow-sm' : 'opacity-40'}`}>{selectedHabitForPastDate.type === 'negative' ? 'Limpio' : 'No'}</button>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setIsPastDateModalOpen(false)} className="flex-1 text-[10px] font-black uppercase opacity-40">Atrás</button>
               <button onClick={() => {
                 setHabits(prev => prev.map(h => {
                   if (h.id === selectedHabitForPastDate.id) {
                     const markedNow = isPastDateCompleted;
                     let dates = [...h.completedDates];
                     
                     let sheetValue: number;
                     if (h.type === 'negative') {
                         sheetValue = markedNow ? 0 : 1;
                     } else {
                         sheetValue = markedNow ? 1 : 0;
                     }

                     if (markedNow && !dates.includes(pastDateToLog)) { dates.push(pastDateToLog); }
                     else if (!markedNow) { dates = dates.filter(d => d !== pastDateToLog); }
                     
                     syncToGoogleSheets(h, sheetValue, pastDateToLog);
                     return { ...h, completedDates: dates };
                   }
                   return h;
                 }));
                 setIsPastDateModalOpen(false);
               }} className="flex-[2] py-4 bg-orange-700 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg">Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
