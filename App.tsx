
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Habit, UserTag, HabitStatus } from './types';
import { Icons, getTagStyles } from './constants';
import HabitCard from './components/HabitCard';

const STORAGE_KEY = 'habitquest_data_v5';
const SYNC_URL_KEY = 'habitquest_sync_url';
const TAGS_KEY = 'habitquest_tags_v4';
const DEFAULT_TAG: UserTag = { name: 'General', colorIndex: 0 };

type View = 'habits' | 'analysis';
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const getLocalDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getSundayOfDate = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); 
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
};

const getStartOfMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

const App: React.FC = () => {
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [userTags, setUserTags] = useState<UserTag[]>([DEFAULT_TAG]);
  const [currentView, setCurrentView] = useState<View>('habits');
  const [expandedHabitId, setExpandedHabitId] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isPastDateModalOpen, setIsPastDateModalOpen] = useState(false);
  
  const [syncUrl, setSyncUrl] = useState(localStorage.getItem(SYNC_URL_KEY) || '');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  
  const [selectedHabitForPastDate, setSelectedHabitForPastDate] = useState<Habit | null>(null);
  const [pastDateToLog, setPastDateToLog] = useState(getLocalDateString());
  const [pastStatusToLog, setPastStatusToLog] = useState<HabitStatus>('success');
  
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'positive' | 'negative'>('positive');
  const [selectedTagName, setSelectedTagName] = useState(DEFAULT_TAG.name);
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  useEffect(() => {
    const newData = localStorage.getItem(STORAGE_KEY);
    if (newData) setHabits(JSON.parse(newData));
    const savedTags = localStorage.getItem(TAGS_KEY);
    if (savedTags) setUserTags(JSON.parse(savedTags));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
    localStorage.setItem(TAGS_KEY, JSON.stringify(userTags));
  }, [habits, userTags]);

  const syncActionToCloud = useCallback(async (habit: Habit, date: string, status: HabitStatus) => {
    if (!syncUrl || !syncUrl.startsWith('https')) return;
    setSyncStatus('syncing');
    try {
      const valorEnviado = status === 'success' ? '1' : status === 'failure' ? '0' : 'Eliminado';
      const payload = {
        fecha: date,
        id_habito: habit.id,
        nombre_habito: habit.name,
        valor: valorEnviado
      };
      await fetch(syncUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error("Error en sync individual:", error);
      setSyncStatus('error');
    }
  }, [syncUrl]);

  const updateHabitCompletions = (habit: Habit, dateStr: string, status: HabitStatus) => {
    const newCompletions = { ...habit.completions };
    
    if (habit.frequency !== 'daily') {
      const date = new Date(dateStr + 'T00:00:00');
      let start: string, end: string;
      if (habit.frequency === 'weekly') {
        const sunday = getSundayOfDate(date);
        start = getLocalDateString(sunday);
        end = getLocalDateString(new Date(sunday.getTime() + 6 * 24 * 60 * 60 * 1000));
      } else {
        const first = getStartOfMonth(date);
        start = getLocalDateString(first);
        end = getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
      }
      Object.keys(newCompletions).forEach(d => {
        if (d >= start && d <= end) delete newCompletions[d];
      });
    } else {
      delete newCompletions[dateStr];
    }

    if (status !== 'neutral') {
      newCompletions[dateStr] = status as 'success' | 'failure';
    }
    return newCompletions;
  };

  const handleToggleHabit = (id: number) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const currentStatus = getHabitStatusForDate(h, selectedDate);
        let nextStatus: HabitStatus = currentStatus === 'neutral' ? 'success' : currentStatus === 'success' ? 'failure' : 'neutral';
        const newCompletions = updateHabitCompletions(h, selectedDate, nextStatus);
        syncActionToCloud(h, selectedDate, nextStatus);
        return { ...h, completions: newCompletions, streak: nextStatus === 'success' ? h.streak + 1 : (nextStatus === 'failure' ? 0 : h.streak) };
      }
      return h;
    }));
  };

  const getFirstAvailableId = () => {
    const ids = new Set(habits.map(h => h.id));
    let id = 1;
    while (ids.has(id)) { id++; }
    return id;
  };

  const isIdTaken = (id: number) => habits.some(h => h.id === id);

  const getHabitStatusForDate = (habit: Habit, dateStr: string): HabitStatus => {
    if (habit.frequency === 'daily') return habit.completions[dateStr] || 'neutral';
    const date = new Date(dateStr + 'T00:00:00');
    let start: string, end: string;
    if (habit.frequency === 'weekly') {
      const sunday = getSundayOfDate(date);
      start = getLocalDateString(sunday);
      end = getLocalDateString(new Date(sunday.getTime() + 6 * 24 * 60 * 60 * 1000));
    } else {
      const first = getStartOfMonth(date);
      start = getLocalDateString(first);
      end = getLocalDateString(new Date(date.getFullYear(), date.getMonth() + 1, 0));
    }
    const keys = Object.keys(habit.completions).filter(d => d >= start && d <= end);
    if (keys.some(k => habit.completions[k] === 'success')) return 'success';
    if (keys.some(k => habit.completions[k] === 'failure')) return 'failure';
    return 'neutral';
  };

  const calculateRateInRange = (habit: Habit, start: Date, end: Date) => {
    const sDate = new Date(start); sDate.setHours(0,0,0,0);
    const eDate = new Date(end); eDate.setHours(0,0,0,0);
    if (habit.frequency === 'daily') {
      let total = 0; let ok = 0; let curr = new Date(sDate);
      while (curr <= eDate) { total++; if (habit.completions[getLocalDateString(curr)] === 'success') ok++; curr.setDate(curr.getDate() + 1); }
      return total > 0 ? Math.round((ok / total) * 100) : 0;
    } else if (habit.frequency === 'weekly') {
      let weeks = 0; let ok = 0; let curr = getSundayOfDate(sDate);
      while (curr <= eDate) {
        weeks++;
        const wS = getLocalDateString(curr);
        const wE = getLocalDateString(new Date(curr.getTime() + 6 * 24 * 60 * 60 * 1000));
        if (Object.keys(habit.completions).some(d => d >= wS && d <= wE && habit.completions[d] === 'success')) ok++;
        curr.setDate(curr.getDate() + 7);
      }
      return weeks > 0 ? Math.round((ok / weeks) * 100) : 0;
    } else {
      let months = 0; let ok = 0; let curr = getStartOfMonth(sDate);
      while (curr <= eDate) {
        months++;
        const mS = getLocalDateString(curr);
        const mE = getLocalDateString(new Date(curr.getFullYear(), curr.getMonth() + 1, 0));
        if (Object.keys(habit.completions).some(d => d >= mS && d <= mE && habit.completions[d] === 'success')) ok++;
        curr.setMonth(curr.getMonth() + 1);
      }
      return months > 0 ? Math.round((ok / months) * 100) : 0;
    }
  };

  const analysisData = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const sunThisWeek = getSundayOfDate(now);
    const sunLastWeek = new Date(sunThisWeek); sunLastWeek.setDate(sunLastWeek.getDate() - 7);
    const satLastWeek = new Date(sunThisWeek); satLastWeek.setDate(satLastWeek.getDate() - 1);
    const firstThisMonth = getStartOfMonth(now);
    const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(now.getDate() - 90);
    const firstThisYear = new Date(now.getFullYear(), 0, 1);

    return habits.map(h => {
      const curWeek = calculateRateInRange(h, sunThisWeek, now);
      const prevWeek = calculateRateInRange(h, sunLastWeek, satLastWeek);
      const curMonth = calculateRateInRange(h, firstThisMonth, now);
      const prevMonth = calculateRateInRange(h, firstLastMonth, lastLastMonth);
      const last3M = calculateRateInRange(h, ninetyDaysAgo, now);
      const year = calculateRateInRange(h, firstThisYear, now);
      return { id: h.id, curWeek, prevWeek, weekBetter: curWeek >= prevWeek, curMonth, prevMonth, monthBetter: curMonth >= prevMonth, last3M, year };
    });
  }, [habits]);

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(newId);
    if (!newName.trim() || isNaN(idNum) || isIdTaken(idNum)) return;
    const newHabit: Habit = {
      id: idNum, name: newName, description: '', category: selectedTagName, type: newType, frequency: newFreq, color: '', completions: {}, createdAt: new Date().toISOString(), streak: 0
    };
    setHabits(prev => [...prev, newHabit]);
    setNewName(''); setIsModalOpen(false);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col relative text-orange-950 bg-[#fffcf0]">
      <div className="px-6 pt-10 flex justify-between items-center mb-2">
        <div className="flex gap-2">
          <button onClick={() => setIsTagManagerOpen(true)} className="p-3 rounded-2xl border bg-white/60 border-black/5 text-black/60 shadow-sm"><Icons.Settings /></button>
          <button onClick={() => setIsReorderMode(!isReorderMode)} className={`p-3 rounded-2xl border shadow-sm ${isReorderMode ? 'bg-orange-600 text-white' : 'bg-white/60 border-black/5 text-black/60'}`}><Icons.Move /></button>
        </div>
        <div className="flex items-center gap-2">
          {syncStatus !== 'idle' && (
            <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-full border ${
              syncStatus === 'syncing' ? 'bg-amber-100 text-amber-700 animate-pulse border-amber-200' :
              syncStatus === 'synced' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
            }`}>
              {syncStatus === 'syncing' ? 'Guardando...' : syncStatus === 'synced' ? 'Sheet OK' : 'Error'}
            </span>
          )}
          <button onClick={() => setIsSyncModalOpen(true)} className="p-3 rounded-2xl border bg-white/60 border-black/5 text-black/60 shadow-sm"><Icons.Cloud /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        {currentView === 'habits' ? (
          <div className="px-6 animate-in fade-in duration-500">
            <header className="mb-8 mt-4">
              <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-black tracking-tight">HabitQuest</h1>
                <input type="date" value={selectedDate} max={todayStr} onChange={(e) => setSelectedDate(e.target.value)} className="bg-white/60 border border-black/5 px-3 py-2 rounded-xl font-bold text-[10px] uppercase" />
              </div>
              <p className="font-medium opacity-40 uppercase text-[10px] tracking-widest mt-1">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </header>
            <section className="space-y-4">
              {habits.map((h, idx) => (
                <HabitCard 
                  key={h.id} habit={h} userTags={userTags} status={getHabitStatusForDate(h, selectedDate)} 
                  onToggle={handleToggleHabit} onDelete={(id) => setHabits(p => p.filter(x => x.id !== id))} 
                  onEdit={(h) => { setEditingHabit({...h}); setIsEditModalOpen(true); }}
                  onLogPast={(h) => { setSelectedHabitForPastDate(h); setIsPastDateModalOpen(true); }}
                  isReorderMode={isReorderMode} isFirst={idx === 0} isLast={idx === habits.length - 1}
                  onMoveUp={() => { const n = [...habits]; [n[idx], n[idx-1]] = [n[idx-1], n[idx]]; setHabits(n); }}
                  onMoveDown={() => { const n = [...habits]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; setHabits(n); }}
                />
              ))}
              {habits.length === 0 && <div className="text-center py-20 opacity-30 italic">Crea un hábito con el botón +</div>}
            </section>
          </div>
        ) : (
          <div className="px-6 animate-in slide-in-from-right duration-500 mt-4">
            <header className="mb-8">
              <h1 className="text-3xl font-black tracking-tight">Análisis</h1>
              <p className="text-[10px] font-black uppercase text-black/30 tracking-widest mt-1">Rendimiento Detallado</p>
            </header>
            <div className="space-y-6 pb-12">
              {habits.map(habit => {
                const tagData = userTags.find(t => t.name === habit.category);
                const theme = getTagStyles(habit.category, tagData?.colorIndex);
                const data = analysisData.find(d => d.id === habit.id);
                if (!data) return null;
                const isExpanded = expandedHabitId === habit.id;

                // Generar los periodos de tiempo según frecuencia
                const historyMarks = [];
                if (habit.frequency === 'daily') {
                  for (let i = 27; i >= 0; i--) {
                    const d = new Date(); d.setDate(d.getDate() - i);
                    historyMarks.push(getLocalDateString(d));
                  }
                } else if (habit.frequency === 'weekly') {
                  const base = getSundayOfDate(new Date());
                  for (let i = 11; i >= 0; i--) {
                    const d = new Date(base); d.setDate(d.getDate() - (i * 7));
                    historyMarks.push(getLocalDateString(d));
                  }
                } else {
                  const base = getStartOfMonth(new Date());
                  for (let i = 11; i >= 0; i--) {
                    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
                    historyMarks.push(getLocalDateString(d));
                  }
                }

                return (
                  <div key={habit.id} onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)} className={`border-2 rounded-[32px] p-6 shadow-sm transition-all duration-300 ${theme.card} ${isExpanded ? 'shadow-lg border-black/10' : 'border-transparent'}`}>
                    <div className="flex flex-col gap-5">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-[8px] font-black opacity-30 mb-0.5">ID: {habit.id}</p>
                          <h4 className="font-black text-orange-950 text-lg leading-tight">{habit.name}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${theme.tag}`}>{habit.category}</span>
                          <span className="text-xs font-black text-orange-600">🔥 {habit.streak}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className={`rounded-3xl p-4 shadow-sm border-2 ${data.weekBetter ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <p className="text-[9px] font-black uppercase mb-1 opacity-40">Semana</p>
                          <div className="flex items-baseline gap-2">
                            <span className={`text-2xl font-black ${data.weekBetter ? 'text-emerald-700' : 'text-rose-700'}`}>{data.curWeek}%</span>
                            <span className="text-[10px] font-bold opacity-40">vs {data.prevWeek}%</span>
                          </div>
                        </div>
                        <div className={`rounded-3xl p-4 shadow-sm border-2 ${data.monthBetter ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                          <p className="text-[9px] font-black uppercase mb-1 opacity-40">Mes</p>
                          <span className={`text-2xl font-black ${data.monthBetter ? 'text-emerald-700' : 'text-rose-700'}`}>{data.curMonth}%</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-black/5 animate-in fade-in slide-in-from-top-2 space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/50 border border-black/5 rounded-2xl p-3 flex flex-col">
                            <span className="text-[8px] font-black uppercase opacity-40">Últimos 3 meses</span>
                            <span className="text-xl font-black text-orange-950">{data.last3M}%</span>
                          </div>
                          <div className="bg-white/50 border border-black/5 rounded-2xl p-3 flex flex-col">
                            <span className="text-[8px] font-black uppercase opacity-40">Año Actual</span>
                            <span className="text-xl font-black text-orange-950">{data.year}%</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] font-black uppercase opacity-30 mb-3 text-center">
                            Historial ({habit.frequency === 'daily' ? 'Últimos 28 días' : habit.frequency === 'weekly' ? 'Últimas 12 semanas' : 'Últimos 12 meses'})
                          </p>
                          <div className={`grid ${habit.frequency === 'daily' ? 'grid-cols-7' : 'grid-cols-6'} gap-1.5`}>
                            {historyMarks.map((m, i) => {
                              const status = getHabitStatusForDate(habit, m);
                              return (
                                <div key={i} className={`aspect-square rounded-lg border flex items-center justify-center transition-all ${
                                  status === 'success' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 
                                  status === 'failure' ? 'bg-rose-600 border-rose-600 text-white shadow-sm' : 
                                  'bg-white/40 border-black/5 text-transparent'
                                }`}>
                                  {status === 'success' && <Icons.Check />}
                                  {status === 'failure' && <Icons.X />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t px-12 py-5 flex justify-between items-center z-40 rounded-t-[32px] shadow-2xl bg-white/80 border-black/5">
        <button onClick={() => setCurrentView('habits')} className={`flex flex-col items-center gap-1.5 ${currentView === 'habits' ? 'text-orange-700' : 'opacity-30'}`}><Icons.Target /><span className="text-[9px] font-black uppercase">Hábitos</span></button>
        <button onClick={() => { setNewId(String(getFirstAvailableId())); setIsModalOpen(true); }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-orange-700 text-white -mt-10 border-4 border-white active:scale-90 transition-transform"><Icons.Plus /></button>
        <button onClick={() => { setCurrentView('analysis'); setExpandedHabitId(null); }} className={`flex flex-col items-center gap-1.5 ${currentView === 'analysis' ? 'text-orange-700' : 'opacity-30'}`}><Icons.Chart /><span className="text-[9px] font-black uppercase">Análisis</span></button>
      </nav>

      {/* Modales - Se mantienen igual para no perder funcionalidad */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <h3 className="text-3xl font-black mb-2 text-center">Configuración</h3>
            <p className="text-[10px] text-center font-black uppercase opacity-40 mb-8">Google Sheets Connection</p>
            <div className="space-y-4">
              <input value={syncUrl} onChange={e => setSyncUrl(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-white font-bold text-xs" placeholder="URL del Script de Google" />
              <button onClick={() => { localStorage.setItem(SYNC_URL_KEY, syncUrl); alert('URL Guardada Correctamente'); }} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Guardar URL</button>
              <div className="pt-4 border-t border-black/5">
                <button onClick={() => {
                  const data = JSON.stringify({ habits, userTags });
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = `habit-backup-${todayStr}.json`; a.click();
                }} className="w-full py-4 bg-white border-2 border-black/5 text-black rounded-2xl font-black uppercase text-[10px] shadow-sm">Exportar Backup JSON</button>
              </div>
              <button onClick={() => setIsSyncModalOpen(false)} className="w-full mt-4 py-4 font-black uppercase text-[10px] opacity-40 text-center">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={handleAddHabit} className="w-full max-w-md rounded-t-[48px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black mb-8">Nuevo Hábito</h3>
            <div className="space-y-5">
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">ID Sheet (Manual)</p><input required type="number" value={newId} onChange={e => setNewId(e.target.value)} className={`w-full px-6 py-4 rounded-2xl border font-bold ${isIdTaken(parseInt(newId)) ? 'border-rose-500 bg-rose-50' : 'bg-white border-black/5'}`} placeholder="ID..." />{isIdTaken(parseInt(newId)) && <p className="text-[9px] text-rose-500 font-bold ml-2">Este ID ya está en uso</p>}</div>
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">Nombre</p><input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-6 py-5 rounded-3xl border bg-white font-bold" placeholder="Hábito..." /></div>
              <div className="grid grid-cols-3 gap-2">{['daily', 'weekly', 'monthly'].map(f => (<button key={f} type="button" onClick={() => setNewFreq(f as any)} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 ${newFreq === f ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-black/5'}`}>{f}</button>))}</div>
              <div className="flex gap-4 pt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 font-black uppercase text-[10px] opacity-40">Cerrar</button><button type="submit" disabled={isIdTaken(parseInt(newId))} className="flex-[2] py-5 bg-orange-700 text-white rounded-3xl font-black shadow-lg disabled:opacity-50">Crear</button></div>
            </div>
          </form>
        </div>
      )}

      {isPastDateModalOpen && selectedHabitForPastDate && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={(e) => {
            e.preventDefault();
            setHabits(prev => prev.map(h => {
              if (h.id === selectedHabitForPastDate.id) {
                const nC = updateHabitCompletions(h, pastDateToLog, pastStatusToLog);
                syncActionToCloud(h, pastDateToLog, pastStatusToLog);
                return { ...h, completions: nC };
              }
              return h;
            }));
            setIsPastDateModalOpen(false);
          }} className="w-full max-w-md rounded-t-[48px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <h3 className="text-3xl font-black mb-2 text-center">Registro Pasado</h3>
            <p className="text-[10px] text-center font-black uppercase opacity-40 mb-8">{selectedHabitForPastDate.name}</p>
            <div className="space-y-5">
              <input type="date" required value={pastDateToLog} max={todayStr} onChange={e => setPastDateToLog(e.target.value)} className="w-full px-6 py-4 rounded-2xl border bg-white font-bold" />
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setPastStatusToLog('success')} className={`py-4 rounded-xl font-black uppercase text-[10px] border-2 ${pastStatusToLog === 'success' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-black/5'}`}>Éxito</button>
                <button type="button" onClick={() => setPastStatusToLog('failure')} className={`py-4 rounded-xl font-black uppercase text-[10px] border-2 ${pastStatusToLog === 'failure' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-black/5'}`}>Fallo</button>
                <button type="button" onClick={() => setPastStatusToLog('neutral')} className={`py-4 rounded-xl font-black uppercase text-[10px] border-2 ${pastStatusToLog === 'neutral' ? 'bg-gray-200 border-gray-200 text-gray-700' : 'bg-white border-black/5'}`}>Borrar</button>
              </div>
              <button type="submit" className="w-full py-5 bg-orange-700 text-white rounded-3xl font-black shadow-lg">Guardar Registro</button>
              <button type="button" onClick={() => setIsPastDateModalOpen(false)} className="w-full py-4 font-black uppercase text-[10px] opacity-40 text-center">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {isEditModalOpen && editingHabit && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={(e) => { e.preventDefault(); setHabits(prev => prev.map(h => h.id === editingHabit.id ? editingHabit : h)); setIsEditModalOpen(false); }} className="w-full max-w-md rounded-t-[48px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <h3 className="text-3xl font-black mb-8 text-center">Editar Hábito</h3>
            <div className="space-y-5">
              <div className="space-y-2 opacity-50"><p className="text-[10px] font-black uppercase ml-2">ID Sheet (No editable)</p><div className="w-full px-6 py-4 rounded-2xl border bg-gray-100 font-bold text-sm">{editingHabit.id}</div></div>
              <input required value={editingHabit.name} onChange={e => setEditingHabit({...editingHabit, name: e.target.value})} className="w-full px-6 py-5 rounded-3xl border bg-white font-bold" />
              <button type="submit" className="w-full py-5 bg-orange-700 text-white rounded-3xl font-black shadow-lg">Guardar Cambios</button>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="w-full py-4 font-black uppercase text-[10px] opacity-40 text-center">Cerrar</button>
            </div>
          </form>
        </div>
      )}

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <h3 className="text-3xl font-black mb-8 text-center">Categorías</h3>
            <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
              {userTags.map(t => (
                <div key={t.name} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-black/5">
                  <span className="font-bold text-sm">{t.name}</span>
                  {t.name !== DEFAULT_TAG.name && <button onClick={() => setUserTags(p => p.filter(x => x.name !== t.name))} className="text-rose-500"><Icons.Trash /></button>}
                </div>
              ))}
            </div>
            <button onClick={() => setIsTagManagerOpen(false)} className="w-full mt-8 py-4 font-black uppercase text-[10px] opacity-40 text-center">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
