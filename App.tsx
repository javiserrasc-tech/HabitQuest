
import React, { useState, useEffect, useMemo } from 'react';
import { Habit } from './types';
import { Icons, getTagStyles } from './constants';
import HabitCard from './components/HabitCard';

const STORAGE_KEY = 'habitquest_data_v4';
const SYNC_URL_KEY = 'habitquest_sync_url';
const TAGS_KEY = 'habitquest_tags_v4';
const DEFAULT_TAG = 'General';

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
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userTags, setUserTags] = useState<string[]>([DEFAULT_TAG]);
  const [currentView, setCurrentView] = useState<View>('habits');
  const [analysisPeriod, setAnalysisPeriod] = useState<Period>('weekly');
  const [expandedHabitId, setExpandedHabitId] = useState<number | null>(null);
  
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
  const [selectedTag, setSelectedTag] = useState(DEFAULT_TAG);
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  useEffect(() => {
    const savedHabits = localStorage.getItem(STORAGE_KEY);
    if (savedHabits) setHabits(JSON.parse(savedHabits));
    
    const savedTags = localStorage.getItem(TAGS_KEY);
    if (savedTags) {
      const parsedTags = JSON.parse(savedTags);
      setUserTags(parsedTags.length > 0 ? parsedTags : [DEFAULT_TAG]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem(TAGS_KEY, JSON.stringify(userTags));
  }, [userTags]);

  const today = getLocalDateString();
  const startOfCurrentWeek = getStartOfWeek(new Date());
  const startOfCurrentMonth = getStartOfMonth(new Date());

  const isIdTaken = (id: number) => habits.some(h => h.id === id);
  const idInUse = newId !== '' && isIdTaken(parseInt(newId));

  const syncToGoogleSheets = async (habit: Habit, valor: number, customDate?: string) => {
    if (!syncUrl) return;
    setIsSyncing(true);
    try {
      const dateOnly = customDate || today;
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

  const handleToggleHabit = (id: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const isCompletedNow = isHabitCompletedCurrentPeriod(h);
        let newCompletedDates = [...h.completedDates];
        const newVal = isCompletedNow ? 0 : 1; 
        
        if (isCompletedNow) {
          if (h.frequency === 'daily') newCompletedDates = newCompletedDates.filter(d => d !== today);
          else if (h.frequency === 'weekly') newCompletedDates = newCompletedDates.filter(d => d < startOfCurrentWeek);
          else newCompletedDates = newCompletedDates.filter(d => d < startOfCurrentMonth);
        } else {
          newCompletedDates.push(today);
        }

        syncToGoogleSheets(h, newVal);

        return { ...h, completedDates: newCompletedDates, streak: !isCompletedNow ? h.streak + 1 : Math.max(0, h.streak - 1) };
      }
      return h;
    }));
  };

  const handleUpdateHabit = (id: number, updates: Partial<Habit>) => {
    setHabits(prev => prev.map(h => h.id === id ? { ...h, ...updates } : h));
  };

  const handleAddHabit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const idNum = parseInt(newId);
    if (isNaN(idNum) || !newName.trim() || isIdTaken(idNum)) return;
    const newHabit: Habit = {
      id: idNum, name: newName, description: '', category: selectedTag,
      frequency: newFreq, color: '#10b981', completedDates: [],
      createdAt: new Date().toISOString(), streak: 0
    };
    setHabits(prev => [...prev, newHabit]);
    setIsModalOpen(false);
    setNewId(''); setNewName(''); setSelectedTag(DEFAULT_TAG);
    syncToGoogleSheets(newHabit, 0, today);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingHabit) return;
    setHabits(prev => prev.map(h => h.id === editingHabit.id ? editingHabit : h));
    const isDone = editingHabit.completedDates.includes(today);
    syncToGoogleSheets(editingHabit, isDone ? 1 : 0, today);
    setIsEditModalOpen(false);
    setEditingHabit(null);
  };

  const isHabitCompletedCurrentPeriod = (habit: Habit) => {
    if (habit.frequency === 'daily') return habit.completedDates.includes(today);
    if (habit.frequency === 'weekly') return habit.completedDates.some(d => d >= startOfCurrentWeek);
    return habit.completedDates.some(d => d >= startOfCurrentMonth);
  };

  const stats = useMemo(() => {
    const daysToLookBack = analysisPeriod === 'weekly' ? 7 : 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToLookBack);
    const cutoffStr = getLocalDateString(cutoffDate);
    
    const totalHabitsCount = habits.length;
    const completedThisPeriodCount = habits.filter(isHabitCompletedCurrentPeriod).length;
    const globalCompletionRate = totalHabitsCount > 0 ? (completedThisPeriodCount / totalHabitsCount) * 100 : 0;

    const habitDetails = habits.map(h => {
      const completionsInPeriod = h.completedDates.filter(d => d >= cutoffStr).length;
      let expectedCompletions = daysToLookBack;
      if (h.frequency === 'weekly') expectedCompletions = Math.ceil(daysToLookBack / 7);
      if (h.frequency === 'monthly') expectedCompletions = Math.ceil(daysToLookBack / 30);
      const rate = Math.min(100, Math.round((completionsInPeriod / expectedCompletions) * 100));
      return { ...h, periodRate: rate, periodChecks: completionsInPeriod };
    });

    return { completedThisPeriodCount, totalHabitsCount, globalCompletionRate, habitDetails };
  }, [habits, today, analysisPeriod]);

  // Historiales específicos para Feedback del usuario
  const getHistoryDaily = (habit: Habit) => {
    const dates = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = getLocalDateString(d);
      dates.push({ date: iso, completed: habit.completedDates.includes(iso) });
    }
    return dates;
  };

  const getHistoryWeekly = (habit: Habit) => {
    const weeks = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - (i * 7));
      const start = getStartOfWeek(d);
      const end = getLocalDateString(new Date(new Date(start).getTime() + 6 * 24 * 60 * 60 * 1000));
      const isCompleted = habit.completedDates.some(cd => cd >= start && cd <= end);
      weeks.push({ start, end, completed: isCompleted });
    }
    return weeks;
  };

  const getHistoryMonthly = (habit: Habit) => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const start = getLocalDateString(new Date(y, m, 1));
      const end = getLocalDateString(new Date(y, m + 1, 0));
      const isCompleted = habit.completedDates.some(cd => cd >= start && cd <= end);
      months.push({ start, end, completed: isCompleted });
    }
    return months;
  };

  const handleSaveSyncUrl = () => {
    localStorage.setItem(SYNC_URL_KEY, syncUrl);
    setIsSyncModalOpen(false);
  };

  const renderHabitAnalysis = (habit: Habit) => {
    let history: { completed: boolean }[] = [];
    let label = "";
    let sublabel = "";
    const totalCompletions = habit.completedDates.length;

    if (habit.frequency === 'daily') {
      history = getHistoryDaily(habit);
      label = "Últimos 30 días";
      const count = history.filter(h => h.completed).length;
      sublabel = `${count} de 30 completados`;
    } else if (habit.frequency === 'weekly') {
      history = getHistoryWeekly(habit);
      label = "Últimas 12 semanas";
      const count = history.filter(h => h.completed).length;
      sublabel = `${count} de 12 completadas`;
    } else {
      history = getHistoryMonthly(habit);
      label = "Últimos 12 meses";
      const count = history.filter(h => h.completed).length;
      sublabel = `${count} de 12 completados`;
    }

    return (
      <div className="mt-4 pt-4 border-t border-orange-50 animate-in fade-in slide-in-from-top-2">
        <div className="flex justify-between items-end mb-3">
          <div>
            <p className="text-[10px] font-black uppercase text-orange-400 tracking-wider mb-0.5">{label}</p>
            <p className="text-xs font-bold text-orange-700">{sublabel}</p>
          </div>
          <p className="text-[9px] font-bold text-orange-300">Total histórico: {totalCompletions}</p>
        </div>
        <div className="grid grid-cols-6 gap-2">
           {history.map((item, idx) => (
              <div key={idx} className={`aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${item.completed ? 'bg-orange-600 border-orange-600 text-white' : 'bg-orange-50 border-orange-100 text-orange-200'}`}>
                {item.completed && <Icons.Check />}
              </div>
            ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative safe-area-inset-top text-orange-950">
      
      {isSyncing && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] bg-orange-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in duration-300">
          <div className="w-2 h-2 bg-orange-300 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando...</span>
        </div>
      )}

      <div className="px-6 pt-8 flex justify-between items-start mb-2">
        <div className="flex gap-2">
          <button onClick={() => setIsTagManagerOpen(true)} className="p-3 rounded-2xl border bg-orange-100/50 border-orange-200 text-orange-600 shadow-sm flex items-center gap-2 active:scale-95 transition-all">
            <Icons.Settings />
            <span className="text-[10px] font-black uppercase tracking-wider">Etiquetas</span>
          </button>
        </div>
        <button onClick={() => setIsSyncModalOpen(true)} className={`p-3 rounded-2xl transition-all shadow-sm border ${syncUrl ? 'text-orange-700 bg-orange-100 border-orange-200' : 'opacity-30'}`}>
          <Icons.Cloud />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {currentView === 'habits' ? (
          <div className="px-6 animate-in fade-in duration-500">
            <header className="mb-8">
              <h1 className="text-3xl font-black tracking-tight">Mis Hábitos</h1>
              <p className="font-medium opacity-60 uppercase text-[10px] tracking-widest">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </header>

            <div className="mb-8 rounded-[32px] p-7 shadow-xl relative overflow-hidden bg-orange-700 text-orange-50">
               <div className="relative z-10">
                 <p className="text-[10px] font-bold mb-1 uppercase tracking-widest opacity-60">Progreso del día</p>
                 <div className="flex items-baseline gap-2">
                   <h2 className="text-5xl font-black">{Math.round(stats.globalCompletionRate)}%</h2>
                   <p className="opacity-70 font-bold">{stats.completedThisPeriodCount} / {stats.totalHabitsCount}</p>
                 </div>
                 <div className="mt-6 w-full rounded-full h-3 bg-white/10">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out bg-orange-300" style={{ width: `${stats.globalCompletionRate}%` }} />
                 </div>
               </div>
            </div>

            <section className="space-y-4">
              {habits.length === 0 ? (
                <div className="text-center py-20 opacity-40 italic">Nada por aquí aún... pulsa +</div>
              ) : (
                habits.map(h => (
                  <HabitCard 
                    key={h.id} 
                    habit={h}
                    userTags={userTags}
                    isCompletedToday={isHabitCompletedCurrentPeriod(h)} 
                    onToggle={handleToggleHabit} 
                    onEdit={(habit) => { setEditingHabit({...habit}); setIsEditModalOpen(true); }}
                    onUpdate={handleUpdateHabit}
                    onDelete={(id) => setHabits(p => p.filter(x => x.id !== id))}
                    onLogPast={(habit) => { setSelectedHabitForPastDate(habit); setIsPastDateModalOpen(true); }}
                  />
                ))
              )}
            </section>
          </div>
        ) : (
          <div className="px-6 animate-in slide-in-from-right duration-500">
             <header className="flex flex-col mb-8 gap-4">
                <h1 className="text-3xl font-black tracking-tight text-orange-950">Análisis</h1>
             </header>
             <div className="space-y-4 pb-12">
              {stats.habitDetails.map(habit => (
                <div key={habit.id} onClick={() => setExpandedHabitId(expandedHabitId === habit.id ? null : habit.id)} className={`bg-[#fffdf5] border-2 rounded-[32px] p-6 shadow-sm cursor-pointer transition-all duration-300 ${expandedHabitId === habit.id ? 'border-orange-500 bg-orange-50/20' : 'border-orange-100/50'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-black text-orange-900 truncate text-lg ${expandedHabitId === habit.id ? 'mb-1' : ''}`}>{habit.name}</h4>
                      <p className="text-[10px] opacity-40 uppercase font-black tracking-widest">{habit.category} • {habit.frequency === 'daily' ? 'Diario' : habit.frequency === 'weekly' ? 'Semanal' : 'Mensual'}</p>
                    </div>
                    <div className="text-2xl font-black text-orange-700">{habit.periodRate}%</div>
                  </div>
                  {expandedHabitId === habit.id && renderHabitAnalysis(habit)}
                </div>
              ))}
              {habits.length === 0 && (
                <div className="text-center py-20 opacity-40 italic">Crea hábitos para ver estadísticas.</div>
              )}
             </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t px-12 py-5 flex justify-between items-center z-40 rounded-t-[32px] shadow-2xl bg-orange-50/80 border-orange-100">
        <button onClick={() => setCurrentView('habits')} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'habits' ? 'scale-110 text-orange-700' : 'opacity-30'}`}>
          <Icons.Target />
          <span className="text-[9px] font-black uppercase">Hábitos</span>
        </button>
        <button onClick={() => { 
          setNewId(String(habits.length > 0 ? Math.max(...habits.map(h => h.id)) + 1 : 101));
          setIsModalOpen(true); 
        }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-orange-700 text-white -mt-10 border-4 border-orange-50">
          <Icons.Plus />
        </button>
        <button onClick={() => { setCurrentView('analysis'); setExpandedHabitId(null); }} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'analysis' ? 'scale-110 text-orange-700' : 'opacity-30'}`}>
          <Icons.Chart />
          <span className="text-[9px] font-black uppercase">Análisis</span>
        </button>
      </nav>

      {/* MODAL NUEVO HÁBITO */}
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
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => (
                    <button key={tag} type="button" onClick={() => setSelectedTag(tag)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${selectedTag === tag ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-orange-100 text-orange-300'}`}>{tag}</button>
                  ))}
                  <button type="button" onClick={() => setIsTagManagerOpen(true)} className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-dashed border-orange-200 text-orange-300">+</button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Frecuencia</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(f => (
                    <button key={f} type="button" onClick={() => setNewFreq(f)} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newFreq === f ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-orange-100 text-orange-300'}`}>{f === 'daily' ? 'Día' : f === 'weekly' ? 'Sem' : 'Mes'}</button>
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

      {/* MODAL EDITAR HÁBITO */}
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
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => (
                    <button key={tag} type="button" onClick={() => setEditingHabit({...editingHabit, category: tag})} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editingHabit.category === tag ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-orange-100 text-orange-300'}`}>{tag}</button>
                  ))}
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

      {/* MODAL TAG MANAGER */}
      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl bg-[#fffcf5]">
            <h3 className="text-2xl font-black mb-6">Etiquetas</h3>
            <div className="flex gap-2 mb-6">
              <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} className="flex-1 px-5 py-4 rounded-2xl border border-black/5 bg-white font-bold" placeholder="Nueva..." />
              <button onClick={() => { if(newTagInput) { setUserTags(p => [...p, newTagInput]); setNewTagInput(''); } }} className="px-6 font-black rounded-2xl text-[10px] bg-orange-700 text-white uppercase">Añadir</button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {userTags.map((t) => (
                <div key={t} className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100/50">
                   <span className="font-bold text-sm text-orange-900">{t}</span>
                   <button onClick={() => { if(userTags.length > 1) setUserTags(p => p.filter(x => x !== t)); }} className="text-orange-300 hover:text-rose-500"><Icons.Trash /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsTagManagerOpen(false)} className="mt-6 py-4 opacity-40 text-xs font-black uppercase w-full">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL SINCRONIZACIÓN */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-8 shadow-2xl flex flex-col bg-[#fffcf5] overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl font-black mb-4 tracking-tight">Sincronización</h3>
            <p className="text-xs opacity-60 mb-6 font-medium">Configura la URL de tu Google Web App para sincronizar tus hábitos.</p>
            
            <div className="space-y-4 mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">URL de Google Web App</p>
                <input 
                  value={syncUrl} 
                  onChange={e => setSyncUrl(e.target.value)} 
                  className="w-full px-5 py-4 rounded-2xl border border-black/5 bg-white outline-none font-bold text-xs" 
                  placeholder="https://script.google.com/macros/s/..." 
                />
              </div>

              <button 
                onClick={handleSaveSyncUrl} 
                className="w-full py-4 bg-orange-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all"
              >
                Guardar URL
              </button>
            </div>

            <button onClick={() => setIsSyncModalOpen(false)} className="py-2 opacity-40 font-black uppercase text-[10px] w-full text-center">Cerrar</button>
          </div>
        </div>
      )}

      {/* MODAL REGISTRO PASADO */}
      {isPastDateModalOpen && selectedHabitForPastDate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-xs bg-[#fffcf5] rounded-[40px] p-8">
            <h3 className="text-xl font-black mb-4">Registro Pasado</h3>
            <input type="date" value={pastDateToLog} max={today} onChange={e => setPastDateToLog(e.target.value)} className="w-full p-4 rounded-2xl border mb-4 font-bold" />
            <div className="flex p-1 bg-black/5 rounded-2xl mb-6">
               <button onClick={() => setIsPastDateCompleted(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${isPastDateCompleted ? 'bg-orange-600 text-white' : 'opacity-40'}`}>Hecho</button>
               <button onClick={() => setIsPastDateCompleted(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${!isPastDateCompleted ? 'bg-orange-600 text-white' : 'opacity-40'}`}>No</button>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setIsPastDateModalOpen(false)} className="flex-1 text-[10px]">Cerrar</button>
               <button onClick={() => {
                 setHabits(prev => prev.map(h => {
                   if (h.id === selectedHabitForPastDate.id) {
                     let dates = [...h.completedDates];
                     if (isPastDateCompleted && !dates.includes(pastDateToLog)) { dates.push(pastDateToLog); syncToGoogleSheets(h, 1, pastDateToLog); }
                     else if (!isPastDateCompleted) { dates = dates.filter(d => d !== pastDateToLog); syncToGoogleSheets(h, 0, pastDateToLog); }
                     return { ...h, completedDates: dates };
                   }
                   return h;
                 }));
                 setIsPastDateModalOpen(false);
               }} className="flex-[2] py-4 bg-orange-700 text-white rounded-2xl text-[10px] font-black uppercase">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
