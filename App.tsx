
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

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
};

const getStartOfMonth = (date: Date) => {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userTags, setUserTags] = useState<string[]>([DEFAULT_TAG]);
  const [currentView, setCurrentView] = useState<View>('habits');
  const [analysisPeriod, setAnalysisPeriod] = useState<Period>('weekly');
  
  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isPastDateModalOpen, setIsPastDateModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  
  // Sincronización
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem(SYNC_URL_KEY) || '');
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Estado para registro de fecha pasada
  const [selectedHabitForPastDate, setSelectedHabitForPastDate] = useState<Habit | null>(null);
  const [pastDateToLog, setPastDateToLog] = useState(new Date().toISOString().split('T')[0]);
  const [isPastDateCompleted, setIsPastDateCompleted] = useState(false);
  
  // Formulario nuevo hábito
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [selectedTag, setSelectedTag] = useState(DEFAULT_TAG);
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Gestión de etiquetas
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

  const today = new Date().toISOString().split('T')[0];
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
        id_habito: habit.id,
        nombre_habito: habit.name,
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
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    const totalHabits = habits.length;
    const completedThisPeriod = habits.filter(isHabitCompletedCurrentPeriod).length;
    const completionRate = totalHabits > 0 ? (completedThisPeriod / totalHabits) * 100 : 0;
    const periodCompletions = habits.reduce((acc, h) => acc + h.completedDates.filter(d => d >= cutoffStr).length, 0);
    return { completedThisPeriod, totalHabits, completionRate, periodCompletions };
  }, [habits, today, analysisPeriod]);

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
          <button onClick={() => setIsInstallModalOpen(true)} className="p-3 rounded-2xl border bg-orange-100/50 border-orange-200 text-orange-600 shadow-sm flex items-center gap-2 active:scale-95 transition-all">
            <Icons.Plus />
            <span className="text-[10px] font-black uppercase tracking-wider">Instalar</span>
          </button>
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
                   <h2 className="text-5xl font-black">{Math.round(stats.completionRate)}%</h2>
                   <p className="opacity-70 font-bold">{stats.completedThisPeriod} / {stats.totalHabits}</p>
                 </div>
                 <div className="mt-6 w-full rounded-full h-3 bg-white/10">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out bg-orange-300" style={{ width: `${stats.completionRate}%` }} />
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
             <header className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-black tracking-tight">Análisis</h1>
              <div className="flex p-1 rounded-xl bg-black/5">
                <button onClick={() => setAnalysisPeriod('weekly')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg ${analysisPeriod === 'weekly' ? 'bg-white shadow-sm text-orange-700' : 'opacity-40'}`}>Semana</button>
                <button onClick={() => setAnalysisPeriod('monthly')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg ${analysisPeriod === 'monthly' ? 'bg-white shadow-sm text-orange-700' : 'opacity-40'}`}>Mes</button>
              </div>
            </header>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[32px] border bg-white/50 border-black/5">
                <div className="text-3xl font-black">{stats.periodCompletions}</div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Checks</div>
              </div>
              <div className="p-6 rounded-[32px] border bg-white/50 border-black/5">
                <div className="text-3xl font-black">{habits.length > 0 ? Math.max(...habits.map(h => h.streak), 0) : 0}</div>
                <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Racha Max</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t px-12 py-5 flex justify-between items-center z-40 rounded-t-[32px] shadow-2xl bg-orange-50/80 border-orange-100">
        <button onClick={() => setCurrentView('habits')} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'habits' ? 'scale-110 opacity-100 text-orange-700' : 'opacity-30'}`}>
          <Icons.Target />
          <span className="text-[9px] font-black uppercase tracking-widest">Hábitos</span>
        </button>
        
        <button onClick={() => setIsModalOpen(true)} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90 bg-orange-700 text-white -mt-10 border-4 border-orange-50">
          <Icons.Plus />
        </button>

        <button onClick={() => setCurrentView('analysis')} className={`flex flex-col items-center gap-1.5 transition-all ${currentView === 'analysis' ? 'scale-110 opacity-100 text-orange-700' : 'opacity-30'}`}>
          <Icons.Chart />
          <span className="text-[9px] font-black uppercase tracking-widest">Análisis</span>
        </button>
      </nav>

      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[85vh] flex flex-col bg-[#fffcf5]">
            <h3 className="text-2xl font-black mb-4">Sincronización</h3>
            <p className="text-sm opacity-60 mb-6 font-medium">Introduce la URL de tu Google Apps Script para guardar datos en Google Sheets.</p>
            <div className="space-y-4">
              <input 
                value={syncUrl} 
                onChange={e => {
                  setSyncUrl(e.target.value);
                  localStorage.setItem(SYNC_URL_KEY, e.target.value);
                }} 
                className="w-full px-5 py-4 rounded-2xl border border-black/5 bg-white outline-none font-bold text-sm" 
                placeholder="https://script.google.com/macros/s/..." 
              />
              <button onClick={() => setIsSyncModalOpen(false)} className="w-full py-4 bg-orange-700 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Guardar Configuración</button>
              <button onClick={() => setIsSyncModalOpen(false)} className="w-full py-4 opacity-40 font-black uppercase text-[10px]">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={handleAddHabit} className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[90vh] overflow-y-auto bg-[#fffcf5]">
            <h3 className="text-3xl font-black mb-8 tracking-tight">Nuevo Hábito</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">ID Único (Número)</p>
                <input required type="number" value={newId} onChange={e => setNewId(e.target.value)} className={`w-full px-6 py-4 rounded-[20px] border outline-none font-bold transition-all ${idInUse ? 'border-rose-500 bg-rose-50 text-rose-700' : 'bg-white border-black/5'}`} placeholder="Ej: 777" />
                {idInUse && <p className="text-[10px] font-black text-rose-500 ml-2">EL ID YA ESTÁ EN USO</p>}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Nombre del hábito</p>
                <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-6 py-5 rounded-[24px] border border-black/5 bg-white outline-none font-bold" placeholder="¿Qué quieres mejorar?" />
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Etiqueta</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => (
                    <button 
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTag(tag)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${selectedTag === tag ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-orange-100 text-orange-300'}`}
                    >
                      {tag}
                    </button>
                  ))}
                  <button 
                    type="button"
                    onClick={() => setIsTagManagerOpen(true)}
                    className="px-4 py-2 rounded-xl text-[10px] font-black uppercase border-2 border-dashed border-orange-200 text-orange-300"
                  >
                    + Nueva
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-1">Frecuencia</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(f => (
                    <button 
                      key={f}
                      type="button"
                      onClick={() => setNewFreq(f)}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${newFreq === f ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-orange-100 text-orange-300'}`}
                    >
                      {f === 'daily' ? 'Diario' : f === 'weekly' ? 'Semanal' : 'Mensual'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 opacity-40 font-black uppercase text-[10px]">Cerrar</button>
                <button type="submit" disabled={idInUse || !newId || !newName} className={`flex-[2] py-5 font-black uppercase text-[10px] rounded-[24px] shadow-lg transition-all ${idInUse ? 'opacity-20' : 'bg-orange-700 text-white'}`}>Crear</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 shadow-2xl animate-in slide-in-from-bottom duration-500 max-h-[85vh] flex flex-col bg-[#fffcf5]">
            <h3 className="text-2xl font-black mb-6">Etiquetas</h3>
            <div className="flex gap-2 mb-6">
              <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} className="flex-1 px-5 py-4 rounded-2xl border border-black/5 bg-white outline-none font-bold" placeholder="Añadir..." />
              <button onClick={() => { if(newTagInput) { setUserTags(p => [...p, newTagInput]); setNewTagInput(''); } }} className="px-6 font-black rounded-2xl text-[10px] uppercase bg-orange-700 text-white">OK</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {userTags.map((t) => (
                <div key={t} className="flex items-center justify-between p-4 bg-black/5 rounded-2xl">
                   <div className="flex items-center gap-3">
                     <div className={`w-3 h-3 rounded-full ${getTagStyles(t)}`}></div>
                     <span className="font-bold text-sm">{t}</span>
                   </div>
                   <button onClick={() => { if(userTags.length > 1) setUserTags(p => p.filter(x => x !== t)); }} className="opacity-20 hover:opacity-100 transition-opacity"><Icons.Trash /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setIsTagManagerOpen(false)} className="mt-6 py-4 opacity-40 text-xs font-black uppercase">Cerrar</button>
          </div>
        </div>
      )}

      {isPastDateModalOpen && selectedHabitForPastDate && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="w-full max-w-xs bg-[#fffcf5] rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-xl font-black mb-4">Registro pasado</h3>
            <input type="date" value={pastDateToLog} max={today} onChange={e => setPastDateToLog(e.target.value)} className="w-full p-4 rounded-2xl border border-black/5 mb-4 font-bold" />
            <div className="flex p-1 bg-black/5 rounded-2xl mb-6">
               <button onClick={() => setIsPastDateCompleted(true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${isPastDateCompleted ? 'bg-orange-600 text-white' : 'opacity-40'}`}>Hecho</button>
               <button onClick={() => setIsPastDateCompleted(false)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${!isPastDateCompleted ? 'bg-orange-600 text-white' : 'opacity-40'}`}>No hecho</button>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setIsPastDateModalOpen(false)} className="flex-1 py-4 text-xs font-black uppercase opacity-40">Cerrar</button>
               <button onClick={() => {
                 setHabits(prev => prev.map(h => {
                   if (h.id === selectedHabitForPastDate.id) {
                     let dates = [...h.completedDates];
                     if (isPastDateCompleted && !dates.includes(pastDateToLog)) {
                        dates.push(pastDateToLog);
                        syncToGoogleSheets(h, 1, pastDateToLog);
                     }
                     else if (!isPastDateCompleted) {
                        dates = dates.filter(d => d !== pastDateToLog);
                        syncToGoogleSheets(h, 0, pastDateToLog);
                     }
                     return { ...h, completedDates: dates };
                   }
                   return h;
                 }));
                 setIsPastDateModalOpen(false);
               }} className="flex-[2] py-4 bg-orange-700 text-white rounded-2xl text-xs font-black uppercase">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
