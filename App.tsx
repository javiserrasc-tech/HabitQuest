
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Habit, UserTag, HabitStatus } from './types';
import { Icons, getTagStyles } from './constants';
import HabitCard from './components/HabitCard';

const STORAGE_KEY = 'habitquest_data_v5';
const TAGS_KEY = 'habitquest_tags_v4';
const DEFAULT_TAG: UserTag = { name: 'General', colorIndex: 0 };

type View = 'habits' | 'analysis' | 'panel';
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
  const [showArchived, setShowArchived] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [isPastDateModalOpen, setIsPastDateModalOpen] = useState(false);
  
  const [exportStartDate, setExportStartDate] = useState(todayStr);
  const [exportEndDate, setExportEndDate] = useState(todayStr);
  
  const [selectedHabitForPastDate, setSelectedHabitForPastDate] = useState<Habit | null>(null);
  const [pastDateToLog, setPastDateToLog] = useState(getLocalDateString());
  const [pastStatusToLog, setPastStatusToLog] = useState<HabitStatus>('success');
  
  const [newId, setNewId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'positive' | 'negative'>('positive');
  const [selectedTagName, setSelectedTagName] = useState(DEFAULT_TAG.name);
  const [newFreq, setNewFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [newReference, setNewReference] = useState<string>('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [panelFeedback, setPanelFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [analysisModalType, setAnalysisModalType] = useState<'improving' | 'worsening' | null>(null);

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
        return { ...h, completions: newCompletions, streak: nextStatus === 'success' ? h.streak + 1 : (nextStatus === 'failure' ? 0 : h.streak) };
      }
      return h;
    }));
  };

  const handleArchiveHabit = (id: number) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const message = habit.archived ? "¿Desarchivar este hábito?" : "¿Archivar este hábito?";
    if (window.confirm(message)) {
      setHabits(prev => prev.map(h => h.id === id ? { ...h, archived: !h.archived } : h));
    }
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

    return habits.filter(h => !h.archived).map(h => {
      const curWeek = calculateRateInRange(h, sunThisWeek, new Date());
      const prevWeek = calculateRateInRange(h, sunLastWeek, satLastWeek);
      const curMonth = calculateRateInRange(h, firstThisMonth, now);
      const prevMonth = calculateRateInRange(h, firstLastMonth, lastLastMonth);
      const last3M = calculateRateInRange(h, ninetyDaysAgo, now);
      const year = calculateRateInRange(h, firstThisYear, now);
      return { id: h.id, curWeek, prevWeek, weekBetter: curWeek >= prevWeek, curMonth, prevMonth, monthBetter: curMonth >= prevMonth, last3M, year };
    });
  }, [habits]);

  const handleExportCSV = () => {
    const start = new Date(exportStartDate + 'T00:00:00');
    const end = new Date(exportEndDate + 'T00:00:00');
    let csvContent = "fecha,id_habito,nombre_habito,valor\n";
    
    habits.forEach(h => {
      Object.entries(h.completions).forEach(([dateStr, status]) => {
        const d = new Date(dateStr + 'T00:00:00');
        if (d >= start && d <= end) {
          const valor = status === 'success' ? '1' : '0';
          csvContent += `${dateStr},${h.id},"${h.name}",${valor}\n`;
        }
      });
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `habit_export_${exportStartDate}_${exportEndDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCsvFeedback({ type: 'success', message: "CSV exportado correctamente" });
  };

  const handleImportCSV = () => {
    if (!importFile) {
      setCsvFeedback({ type: 'error', message: "Por favor, selecciona un archivo CSV primero." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) throw new Error("El archivo está vacío o no se pudo leer.");
        const lines = text.split('\n');
        let importedCount = 0;
        
        setHabits(prevHabits => {
          const newHabits = JSON.parse(JSON.stringify(prevHabits)) as Habit[];
          // Skip header
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',');
            if (parts.length < 4) continue;
            
            const fecha = parts[0];
            const id_habito = parseInt(parts[1]);
            const valor = parts[parts.length - 1];
            
            if (!fecha || isNaN(id_habito) || !valor) continue;
            
            const habitIndex = newHabits.findIndex(h => h.id === id_habito);
            if (habitIndex === -1) continue;
            
            if (valor === '1' || valor === '0') {
              const status = valor === '1' ? 'success' : 'failure';
              newHabits[habitIndex].completions[fecha] = status;
              importedCount++;
            }
          }
          setCsvFeedback({ type: 'success', message: `${importedCount} registros importados correctamente.` });
          return newHabits;
        });
        setImportFile(null);
      } catch (err: any) {
        setCsvFeedback({ type: 'error', message: err.message || "Error al importar el archivo." });
      }
    };
    reader.onerror = () => {
      setCsvFeedback({ type: 'error', message: "Error al leer el archivo." });
    };
    reader.readAsText(importFile);
  };

  const handleExportPanelCSV = () => {
    setPanelFeedback(null);
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      let csvContent = "id,nombre,referencia,total,pct_90d,pct_30d,sem_2,sem_anterior,sem_actual\n";
      
      habits.forEach(h => {
        const now = new Date(); now.setHours(0,0,0,0);
        const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(now.getDate() - 90);
        const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
        const sunThisWeek = getSundayOfDate(now);
        const sunLastWeek = new Date(sunThisWeek); sunLastWeek.setDate(sunLastWeek.getDate() - 7);
        const satLastWeek = new Date(sunThisWeek); satLastWeek.setDate(satLastWeek.getDate() - 1);
        const sunTwoWeeksAgo = new Date(sunThisWeek); sunTwoWeeksAgo.setDate(sunTwoWeeksAgo.getDate() - 14);
        const satTwoWeeksAgo = new Date(sunThisWeek); satTwoWeeksAgo.setDate(satTwoWeeksAgo.getDate() - 8);

        const completions = Object.keys(h.completions).sort();
        const startDate = completions.length > 0 ? new Date(completions[0]) : new Date(h.createdAt);
        
        const totalRate = calculateRateInRange(h, startDate, now);
        const rate90d = calculateRateInRange(h, ninetyDaysAgo, now);
        const rate30d = calculateRateInRange(h, thirtyDaysAgo, now);
        const ratePrevWeek = calculateRateInRange(h, sunLastWeek, satLastWeek);
        const rateTwoWeeksAgo = calculateRateInRange(h, sunTwoWeeksAgo, satTwoWeeksAgo);
        const rateCurWeek = calculateRateInRange(h, sunThisWeek, new Date());

        const ref = h.reference !== undefined ? h.reference : '';
        csvContent += `${h.id},"${h.name}",${ref},${totalRate},${rate90d},${rate30d},${rateTwoWeeksAgo},${ratePrevWeek},${rateCurWeek}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `panel-${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setPanelFeedback({ type: 'success', message: "CSV exportado correctamente" });
    } catch (error: any) {
      setPanelFeedback({ type: 'error', message: error.message || "Error al exportar CSV" });
    }
  };

  const handleExportPanelImage = () => {
    setPanelFeedback(null);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const element = document.getElementById('panel-table-container');
    if (!element) {
      setPanelFeedback({ type: 'error', message: "No se encontró el contenedor de la tabla" });
      return;
    }

    const runCapture = () => {
      try {
        const originalHeight = element.style.height;
        const originalOverflow = element.style.overflow;
        const originalMaxHeight = element.style.maxHeight;

        element.style.height = 'auto';
        element.style.overflow = 'visible';
        element.style.maxHeight = 'none';

        (window as any).html2canvas(element, {
          backgroundColor: '#fffcf0',
          scrollX: 0,
          scrollY: 0,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
          width: element.scrollWidth,
          height: element.scrollHeight,
          useCORS: true,
          scale: 2,
          logging: false
        }).then((canvas: HTMLCanvasElement) => {
          element.style.height = originalHeight;
          element.style.overflow = originalOverflow;
          element.style.maxHeight = originalMaxHeight;

          const link = document.createElement('a');
          link.download = `panel-report-${dateStr}.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
          setPanelFeedback({ type: 'success', message: "Imagen exportada correctamente" });
        }).catch((err: any) => {
          setPanelFeedback({ type: 'error', message: err.message || "Error al generar la imagen" });
        });
      } catch (err: any) {
        setPanelFeedback({ type: 'error', message: err.message || "Error al capturar la imagen" });
      }
    };

    if (!(window as any).html2canvas) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = runCapture;
      script.onerror = () => setPanelFeedback({ type: 'error', message: "Error al cargar la librería de captura" });
      document.head.appendChild(script);
    } else {
      runCapture();
    }
  };

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    const idNum = parseInt(newId);
    if (!newName.trim() || isNaN(idNum) || isIdTaken(idNum)) return;
    const refNum = newReference ? parseInt(newReference) : undefined;
    const newHabit: Habit = {
      id: idNum, name: newName, description: '', category: selectedTagName, type: newType, frequency: newFreq, color: '', completions: {}, createdAt: new Date().toISOString(), streak: 0, reference: refNum
    };
    setHabits(prev => [...prev, newHabit]);
    setNewName(''); setNewReference(''); setIsModalOpen(false);
  };

  return (
    <div className="max-w-md mx-auto landscape:max-w-full min-h-screen flex flex-col relative text-orange-950 bg-[#fffcf0]">
      <div className="px-6 pt-10 flex justify-between items-center mb-2">
        <div className="flex gap-2">
          <button onClick={() => setIsTagManagerOpen(true)} className="p-3 rounded-2xl border bg-white/60 border-black/5 text-black/60 shadow-sm"><Icons.Settings /></button>
          <button onClick={() => setIsReorderMode(!isReorderMode)} className={`p-3 rounded-2xl border shadow-sm ${isReorderMode ? 'bg-orange-600 text-white' : 'bg-white/60 border-black/5 text-black/60'}`}><Icons.Move /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived(!showArchived)} className={`p-3 rounded-2xl border shadow-sm ${showArchived ? 'bg-orange-600 text-white' : 'bg-white/60 border-black/5 text-black/60'}`}><Icons.Archive /></button>
          <button onClick={() => { setCsvFeedback(null); setIsSyncModalOpen(true); }} className="p-3 rounded-2xl border bg-white/60 border-black/5 text-black/60 shadow-sm"><Icons.Cloud /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 landscape:pb-8 landscape:pl-24">
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
              {habits.filter(h => showArchived || !h.archived).map((h, idx) => {
                const now = new Date(); now.setHours(0,0,0,0);
                const sunThisWeek = getSundayOfDate(now);
                const sunLastWeek = new Date(sunThisWeek); sunLastWeek.setDate(sunLastWeek.getDate() - 7);
                const satLastWeek = new Date(sunThisWeek); satLastWeek.setDate(satLastWeek.getDate() - 1);
                const curWeek = calculateRateInRange(h, sunThisWeek, new Date());
                const prevWeek = calculateRateInRange(h, sunLastWeek, satLastWeek);

                return (
                  <HabitCard 
                    key={h.id} habit={h} userTags={userTags} status={getHabitStatusForDate(h, selectedDate)} 
                    onToggle={handleToggleHabit} onDelete={(id) => setHabits(p => p.filter(x => x.id !== id))} 
                    onEdit={(h) => { setEditingHabit({...h}); setIsEditModalOpen(true); }}
                    onLogPast={(h) => { setSelectedHabitForPastDate(h); setIsPastDateModalOpen(true); }}
                    onArchive={handleArchiveHabit}
                    isReorderMode={isReorderMode} isFirst={idx === 0} isLast={idx === habits.length - 1}
                    onMoveUp={() => { const n = [...habits]; [n[idx], n[idx-1]] = [n[idx-1], n[idx]]; setHabits(n); }}
                    onMoveDown={() => { const n = [...habits]; [n[idx], n[idx+1]] = [n[idx+1], n[idx]]; setHabits(n); }}
                    curWeek={curWeek} prevWeek={prevWeek}
                  />
                );
              })}
              {habits.length === 0 && <div className="text-center py-20 opacity-30 italic">Crea un hábito con el botón +</div>}
            </section>
          </div>
        ) : currentView === 'analysis' ? (
          <div className="px-6 animate-in slide-in-from-right duration-500 mt-4">
            <header className="mb-8">
              <h1 className="text-3xl font-black tracking-tight">Análisis</h1>
              <p className="text-[10px] font-black uppercase text-black/30 tracking-widest mt-1">Rendimiento Detallado</p>
            </header>
            <div className="space-y-6 pb-12">
              <div className="bg-white border-2 border-black/5 rounded-[32px] p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase opacity-40 mb-4 text-center tracking-widest">Resumen Mensual</p>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setAnalysisModalType('improving')}
                  >
                    <span className="text-3xl font-black text-emerald-600">
                      {analysisData.filter(d => d.monthBetter).length}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-60 mt-1">hábitos mejorando</span>
                  </div>
                  <div 
                    className="flex flex-col items-center text-center cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setAnalysisModalType('worsening')}
                  >
                    <span className="text-3xl font-black text-rose-600">
                      {analysisData.filter(d => !d.monthBetter).length}
                    </span>
                    <span className="text-[10px] font-bold uppercase opacity-60 mt-1">hábitos empeorando</span>
                  </div>
                </div>
              </div>
              {habits.filter(h => !h.archived).map(habit => {
                const tagData = userTags.find(t => t.name === habit.category);
                const theme = getTagStyles(habit.category, tagData?.colorIndex);
                const data = analysisData.find(d => d.id === habit.id);
                if (!data) return null;
                const isExpanded = expandedHabitId === habit.id;

                // Generar los periodos de tiempo según frecuencia
                const historyMarks = [];
                if (habit.frequency === 'daily') {
                  const sunThisWeek = getSundayOfDate(new Date());
                  const startDate = new Date(sunThisWeek);
                  startDate.setDate(startDate.getDate() - 21);
                  for (let i = 0; i < 28; i++) {
                    const d = new Date(startDate);
                    d.setDate(d.getDate() + i);
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
                            Historial ({habit.frequency === 'daily' ? 'Últimas 4 semanas' : habit.frequency === 'weekly' ? 'Últimas 12 semanas' : 'Últimos 12 meses'})
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
        ) : (
          <div className="px-6 animate-in slide-in-from-right duration-500 mt-4">
            <header className="mb-8">
              <h1 className="text-3xl font-black tracking-tight">Panel</h1>
              <p className="text-[10px] font-black uppercase text-black/30 tracking-widest mt-1">Vista de Tabla</p>
            </header>
            <div className="flex justify-end gap-2 mb-4">
              <button onClick={handleExportPanelCSV} className="px-3 py-2 rounded-xl border bg-white border-black/5 text-[9px] font-black uppercase shadow-sm active:scale-95 transition-transform">CSV Panel</button>
              <button onClick={handleExportPanelImage} className="px-3 py-2 rounded-xl border bg-white border-black/5 text-[9px] font-black uppercase shadow-sm active:scale-95 transition-transform">Imagen</button>
            </div>
            {panelFeedback && (
              <div className={`mb-4 p-4 rounded-2xl border text-xs font-bold ${
                panelFeedback.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}>
                {panelFeedback.message}
              </div>
            )}
            <div id="panel-table-container" className="overflow-x-auto pb-12 landscape:text-sm">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[9px] font-black uppercase opacity-40">
                    <th className="px-4 py-2 sticky left-0 z-10 bg-[#fffcf0]">Hábito</th>
                    <th className="px-4 py-2 text-center">Ref.</th>
                    <th className="px-4 py-2 text-center">Total</th>
                    <th className="px-4 py-2 text-center">% 90d</th>
                    <th className="px-4 py-2 text-center">% 30d</th>
                    <th className="px-4 py-2 text-center">Sem-2</th>
                    <th className="px-4 py-2 text-center">Sem-1</th>
                    <th className="px-4 py-2 text-center">% Sem</th>
                  </tr>
                </thead>
                <tbody>
                  {habits.filter(h => !h.archived).map(h => {
                    const now = new Date(); now.setHours(0,0,0,0);
                    const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(now.getDate() - 90);
                    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
                    const sunThisWeek = getSundayOfDate(now);
                    const sunLastWeek = new Date(sunThisWeek); sunLastWeek.setDate(sunLastWeek.getDate() - 7);
                    const satLastWeek = new Date(sunThisWeek); satLastWeek.setDate(satLastWeek.getDate() - 1);
                    const sunTwoWeeksAgo = new Date(sunThisWeek); sunTwoWeeksAgo.setDate(sunTwoWeeksAgo.getDate() - 14);
                    const satTwoWeeksAgo = new Date(sunThisWeek); satTwoWeeksAgo.setDate(satTwoWeeksAgo.getDate() - 8);

                    const completions = Object.keys(h.completions).sort();
                    const startDate = completions.length > 0 ? new Date(completions[0]) : new Date(h.createdAt);
                    
                    const totalRate = calculateRateInRange(h, startDate, now);
                    const rate90d = calculateRateInRange(h, ninetyDaysAgo, now);
                    const rate30d = calculateRateInRange(h, thirtyDaysAgo, now);
                    const ratePrevWeek = calculateRateInRange(h, sunLastWeek, satLastWeek);
                    const rateTwoWeeksAgo = calculateRateInRange(h, sunTwoWeeksAgo, satTwoWeeksAgo);
                    const rateCurWeek = calculateRateInRange(h, sunThisWeek, new Date());

                    const getCellStyles = (val: number, ref: number | undefined) => {
                      if (ref === undefined) return "bg-gray-50 text-gray-500";
                      return val >= ref ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
                    };

                    const tagData = userTags.find(t => t.name === h.category);
                    const theme = getTagStyles(h.category, tagData?.colorIndex);

                    return (
                      <tr key={h.id} className="bg-white border-2 border-black/5 rounded-2xl shadow-sm overflow-hidden">
                        <td className={`px-4 py-4 font-bold text-sm border-y-2 border-l-2 border-black/5 rounded-l-2xl sticky left-0 z-10 ${theme.tag}`}>{h.name}</td>
                        <td className="px-4 py-4 text-center font-black text-xs border-y-2 border-black/5 opacity-40">{h.reference !== undefined ? `${h.reference}%` : '—'}</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-black/5 ${getCellStyles(totalRate, h.reference)}`}>{totalRate}%</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-black/5 ${getCellStyles(rate90d, totalRate)}`}>{rate90d}%</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-black/5 ${getCellStyles(rate30d, rate90d)}`}>{rate30d}%</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-black/5 ${getCellStyles(rateTwoWeeksAgo, rate30d)}`}>{rateTwoWeeksAgo}%</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-black/5 ${getCellStyles(ratePrevWeek, rateTwoWeeksAgo)}`}>{ratePrevWeek}%</td>
                        <td className={`px-4 py-4 text-center font-black text-sm border-y-2 border-r-2 border-black/5 rounded-r-2xl ${getCellStyles(rateCurWeek, ratePrevWeek)}`}>{rateCurWeek}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto backdrop-blur-xl border-t px-12 py-5 flex justify-between items-center z-40 rounded-t-[32px] shadow-2xl bg-white/80 border-black/5 landscape:fixed landscape:left-0 landscape:top-0 landscape:bottom-0 landscape:w-20 landscape:flex-col landscape:justify-center landscape:rounded-none landscape:border-r landscape:border-t-0 landscape:py-8 landscape:px-0">
        <button onClick={() => { setNewId(String(getFirstAvailableId())); setNewReference(''); setIsModalOpen(true); }} className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl bg-orange-700 text-white -mt-10 landscape:mt-0 border-4 border-white active:scale-90 transition-transform"><Icons.Plus /></button>
        <button onClick={() => setCurrentView('habits')} className={`flex flex-col items-center gap-1.5 ${currentView === 'habits' ? 'text-orange-700' : 'opacity-30'} landscape:flex-col`}><Icons.Target /><span className="text-[9px] font-black uppercase">Hábitos</span></button>
        <button onClick={() => setCurrentView('analysis')} className={`flex flex-col items-center gap-1.5 ${currentView === 'analysis' ? 'text-orange-700' : 'opacity-30'} landscape:flex-col`}><Icons.Chart /><span className="text-[9px] font-black uppercase">Análisis</span></button>
        <button onClick={() => setCurrentView('panel')} className={`flex flex-col items-center gap-1.5 ${currentView === 'panel' ? 'text-orange-700' : 'opacity-30'} landscape:flex-col`}><Icons.Table /><span className="text-[9px] font-black uppercase">Panel</span></button>
      </nav>

      {/* Modales - Se mantienen igual para no perder funcionalidad */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl landscape:max-h-[85vh] landscape:overflow-y-auto">
            <h3 className="text-3xl font-black mb-2 text-center">Exportar CSV</h3>
            <p className="text-[10px] text-center font-black uppercase opacity-40 mb-8">Selecciona el rango de fechas</p>
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase opacity-40 ml-2">Desde</p>
                <input type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-white font-bold text-xs" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase opacity-40 ml-2">Hasta</p>
                <input type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="w-full px-5 py-4 rounded-2xl border bg-white font-bold text-xs" />
              </div>
              <button onClick={handleExportCSV} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Exportar CSV</button>
              
              <div className="pt-8 mt-4 border-t border-black/5 space-y-4">
                <p className="text-[10px] text-center font-black uppercase opacity-40">Importar datos</p>
                <div className="space-y-3">
                  <input 
                    type="file" 
                    accept=".csv, text/csv, text/plain, application/csv, application/vnd.ms-excel" 
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-[10px] font-bold file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                  />
                  <button 
                    onClick={handleImportCSV}
                    className="w-full py-4 rounded-2xl border bg-white border-black/5 text-[10px] font-black uppercase shadow-sm active:scale-95 transition-transform"
                  >
                    Importar CSV
                  </button>
                </div>
              </div>

              {csvFeedback && (
                <div className={`p-4 rounded-2xl border text-xs font-bold ${
                  csvFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  {csvFeedback.message}
                </div>
              )}

              <button onClick={() => setIsSyncModalOpen(false)} className="w-full mt-4 py-4 font-black uppercase text-[10px] opacity-40 text-center">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={handleAddHabit} className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-y-auto max-h-[90vh] landscape:max-h-[85vh]">
            <h3 className="text-3xl font-black mb-8">Nuevo Hábito</h3>
            <div className="space-y-5">
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">ID Sheet (Manual)</p><input required type="number" value={newId} onChange={e => setNewId(e.target.value)} className={`w-full px-6 py-4 rounded-2xl border font-bold ${isIdTaken(parseInt(newId)) ? 'border-rose-500 bg-rose-50' : 'bg-white border-black/5'}`} placeholder="ID..." />{isIdTaken(parseInt(newId)) && <p className="text-[9px] text-rose-500 font-bold ml-2">Este ID ya está en uso</p>}</div>
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">Nombre</p><input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full px-6 py-5 rounded-3xl border bg-white font-bold" placeholder="Hábito..." /></div>
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">Referencia % (Opcional)</p><input type="number" min="0" max="100" value={newReference} onChange={e => setNewReference(e.target.value)} className="w-full px-6 py-4 rounded-2xl border bg-white font-bold" placeholder="0-100..." /></div>
              <div className="grid grid-cols-3 gap-2">{['daily', 'weekly', 'monthly'].map(f => (<button key={f} type="button" onClick={() => setNewFreq(f as any)} className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 ${newFreq === f ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-black/5'}`}>{f}</button>))}</div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-2">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => setSelectedTagName(tag.name)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${selectedTagName === tag.name ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-black/5 text-black/40'}`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-6"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 font-black uppercase text-[10px] opacity-40">Cerrar</button><button type="submit" disabled={isIdTaken(parseInt(newId))} className="flex-[2] py-5 bg-orange-700 text-white rounded-3xl font-black shadow-lg disabled:opacity-50">Crear</button></div>
            </div>
          </form>
        </div>
      )}

      {isPastDateModalOpen && selectedHabitForPastDate && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={(e) => {
            e.preventDefault();
            setHabits(prev => prev.map(h => {
              if (h.id === selectedHabitForPastDate.id) {
                const nC = updateHabitCompletions(h, pastDateToLog, pastStatusToLog);
                return { ...h, completions: nC };
              }
              return h;
            }));
            setIsPastDateModalOpen(false);
          }} className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl landscape:max-h-[85vh] landscape:overflow-y-auto">
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

      {analysisModalType && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0" onClick={() => setAnalysisModalType(null)}>
          <div className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl landscape:max-h-[85vh] landscape:overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-3xl font-black mb-2 text-center">
              {analysisModalType === 'improving' ? 'Mejorando este mes' : 'Empeorando este mes'}
            </h3>
            <p className="text-[10px] text-center font-black uppercase opacity-40 mb-8">
              Comparativa vs mes anterior
            </p>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 mb-8">
              {habits
                .map(h => ({ h, data: analysisData.find(d => d.id === h.id) }))
                .filter(item => item.data && (analysisModalType === 'improving' ? item.data.monthBetter : !item.data.monthBetter))
                .map(item => (
                  <div key={item.h.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-black/5">
                    <span className="font-bold text-sm">{item.h.name}</span>
                    <span className="text-[10px] font-black opacity-40">
                      ({item.data!.prevMonth}% → {item.data!.curMonth}%)
                    </span>
                  </div>
                ))}
            </div>
            <button onClick={() => setAnalysisModalType(null)} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-[10px] shadow-lg">Cerrar</button>
          </div>
        </div>
      )}

      {isEditModalOpen && editingHabit && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0">
          <form onSubmit={(e) => { e.preventDefault(); setHabits(prev => prev.map(h => h.id === editingHabit.id ? editingHabit : h)); setIsEditModalOpen(false); }} className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl landscape:max-h-[85vh] landscape:overflow-y-auto">
            <h3 className="text-3xl font-black mb-8 text-center">Editar Hábito</h3>
            <div className="space-y-5">
              <div className="space-y-2 opacity-50"><p className="text-[10px] font-black uppercase ml-2">ID Sheet (No editable)</p><div className="w-full px-6 py-4 rounded-2xl border bg-gray-100 font-bold text-sm">{editingHabit.id}</div></div>
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">Nombre</p><input required value={editingHabit.name} onChange={e => setEditingHabit({...editingHabit, name: e.target.value})} className="w-full px-6 py-5 rounded-3xl border bg-white font-bold" /></div>
              <div className="space-y-2"><p className="text-[10px] font-black uppercase opacity-40 ml-2">Referencia % (Opcional)</p><input type="number" min="0" max="100" value={editingHabit.reference || ''} onChange={e => setEditingHabit({...editingHabit, reference: e.target.value ? parseInt(e.target.value) : undefined})} className="w-full px-6 py-4 rounded-2xl border bg-white font-bold" placeholder="0-100..." /></div>
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-40 ml-2">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {userTags.map(tag => (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => setEditingHabit({...editingHabit, category: tag.name})}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${editingHabit.category === tag.name ? 'bg-orange-700 border-orange-700 text-white' : 'bg-white border-black/5 text-black/40'}`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-orange-700 text-white rounded-3xl font-black shadow-lg">Guardar Cambios</button>
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="w-full py-4 font-black uppercase text-[10px] opacity-40 text-center">Cerrar</button>
            </div>
          </form>
        </div>
      )}

      {isTagManagerOpen && (
        <div className="fixed inset-0 z-[100] flex items-end landscape:items-center justify-center landscape:justify-center bg-black/60 backdrop-blur-sm p-0">
          <div className="w-full max-w-md rounded-t-[48px] landscape:rounded-[32px] p-10 bg-[#fffcf5] animate-in slide-in-from-bottom duration-500 shadow-2xl landscape:max-h-[85vh] landscape:overflow-y-auto">
            <h3 className="text-3xl font-black mb-8 text-center">Categorías</h3>
            <div className="mb-6 flex gap-2">
              <input
                id="new-tag-input"
                className="flex-1 px-4 py-3 rounded-xl border bg-white font-bold text-xs"
                placeholder="Nueva categoría..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val && !userTags.some(t => t.name === val)) {
                      setUserTags([...userTags, { name: val, colorIndex: userTags.length % 10 }]);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.getElementById('new-tag-input') as HTMLInputElement;
                  const val = input.value.trim();
                  if (val && !userTags.some(t => t.name === val)) {
                    setUserTags([...userTags, { name: val, colorIndex: userTags.length % 10 }]);
                    input.value = '';
                  }
                }}
                className="px-4 py-3 bg-orange-700 text-white rounded-xl font-black text-[10px] uppercase"
              >
                Añadir
              </button>
            </div>
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
