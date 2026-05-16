import React, { useState, useEffect, useMemo } from 'react';
import {
  Dumbbell, Flame, TrendingDown, Plus, Trash2, Target, Calendar,
  Sunrise, CheckCircle2, Circle, Droplet, Activity, TrendingUp,
  AlertTriangle, Star, ChevronRight
} from 'lucide-react';

// ===== Storage =====
const storage = {
  get: (key) => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  list: (prefix) => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  }
};

const today = () => new Date().toISOString().split('T')[0];

// ===== Default morning priorities (RSR-tuned) =====
const DEFAULT_PRIORITIES = [
  { id: 'water', label: 'Water before coffee (16oz)' },
  { id: 'supps', label: 'Supplements (creatine, omega-3, D)' },
  { id: 'protein', label: 'Breakfast w/ 30g+ protein' },
  { id: 'plan', label: "Review today's #1 priority" },
  { id: 'gear', label: 'Phone, keys, scan gun, water bottle' },
];

// ===== App =====
const App = () => {
  const [activeTab, setActiveTab] = useState('today');

  const [stats, setStats] = useState({
    weight: 195,
    heightInches: 71, // 5'11"
    targetCalories: 2300,
    proteinTarget: 195,
    waterTarget: 100, // oz
  });

  const [day, setDay] = useState({
    calories: [],
    protein: 0,
    water: 0,
    workout: null,
    priorities: DEFAULT_PRIORITIES.map(p => ({ ...p, done: false })),
    habits: { gym: false, water_target: false },
    focus: '',
  });

  const [priorityTemplate, setPriorityTemplate] = useState(DEFAULT_PRIORITIES);
  const [history, setHistory] = useState([]);

  // Form inputs
  const [foodName, setFoodName] = useState('');
  const [foodCals, setFoodCals] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [workoutType, setWorkoutType] = useState('Upper A');
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', weight: '' }]);
  const [newPriority, setNewPriority] = useState('');

  // ===== Load on mount =====
  useEffect(() => {
    const s = storage.get('stats');
    if (s) setStats(prev => ({ ...prev, ...s }));

    const pt = storage.get('priorityTemplate');
    if (pt) setPriorityTemplate(pt);

    const todayData = storage.get(`day:${today()}`);
    if (todayData) {
      setDay({
        calories: todayData.calories || [],
        protein: todayData.protein || 0,
        water: todayData.water || 0,
        workout: todayData.workout || null,
        priorities: todayData.priorities || (pt || DEFAULT_PRIORITIES).map(p => ({ ...p, done: false })),
        habits: todayData.habits || { gym: false, water_target: false },
        focus: todayData.focus || '',
      });
    } else {
      // New day - reset priorities from template
      setDay(prev => ({
        ...prev,
        priorities: (pt || DEFAULT_PRIORITIES).map(p => ({ ...p, done: false })),
      }));
    }

    refreshHistory();
  }, []);

  const refreshHistory = () => {
    const keys = storage.list('day:').sort().reverse().slice(0, 30);
    const days = keys.map(k => {
      const data = storage.get(k);
      return data ? { date: k.replace('day:', ''), ...data } : null;
    }).filter(Boolean);
    setHistory(days);
  };

  const saveDay = (newDay) => {
    const toSave = newDay || day;
    storage.set(`day:${today()}`, toSave);
    refreshHistory();
  };

  const updateDay = (patch) => {
    const newDay = { ...day, ...patch };
    setDay(newDay);
    saveDay(newDay);
  };

  // ===== Derived =====
  const totalCals = day.calories.reduce((sum, f) => sum + f.cals, 0);
  const deficit = stats.targetCalories - totalCals;
  const calsPercent = Math.min(100, (totalCals / stats.targetCalories) * 100);
  const proteinPercent = Math.min(100, (day.protein / stats.proteinTarget) * 100);
  const waterPercent = Math.min(100, (day.water / stats.waterTarget) * 100);

  const heightMeters = (stats.heightInches * 0.0254);
  const weightKg = stats.weight * 0.453592;
  const bmi = (weightKg / (heightMeters * heightMeters)).toFixed(1);
  const bmiCategory = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Overweight' : 'Obese';
  const bmiColor = bmi < 25 ? '#22c55e' : bmi < 30 ? '#f97316' : '#ef4444';

  // Rough body fat using BMI method (Deurenberg) - imperfect but useful trend
  const estBodyFat = (1.20 * parseFloat(bmi) + 0.23 * 25 - 16.2).toFixed(1); // 25yo male
  const leanMass = (stats.weight * (1 - estBodyFat / 100)).toFixed(1);
  const fatMass = (stats.weight * (estBodyFat / 100)).toFixed(1);

  // ===== Fatigue analysis =====
  const exerciseHistory = useMemo(() => {
    const map = {};
    history.forEach(d => {
      if (d.workout && d.workout.exercises) {
        d.workout.exercises.forEach(ex => {
          const key = ex.name.toLowerCase().trim();
          if (!key) return;
          if (!map[key]) map[key] = [];
          map[key].push({
            date: d.date,
            sets: parseInt(ex.sets) || 0,
            reps: parseInt(ex.reps) || 0,
            weight: parseInt(ex.weight) || 0,
            volume: (parseInt(ex.sets) || 0) * (parseInt(ex.reps) || 0) * (parseInt(ex.weight) || 0),
            displayName: ex.name,
          });
        });
      }
    });
    return map;
  }, [history]);

  const getFatigueFlag = (exerciseName) => {
    const key = exerciseName.toLowerCase().trim();
    const sessions = exerciseHistory[key];
    if (!sessions || sessions.length < 2) return null;
    const recent = sessions.slice(0, 3); // newest first
    if (recent.length < 2) return null;
    const latest = recent[0];
    const prev = recent[1];
    if (latest.volume < prev.volume * 0.9) {
      return { type: 'fatigue', message: 'Volume dropped 10%+ — consider deload' };
    }
    if (latest.volume > prev.volume * 1.05 && recent.length >= 2) {
      return { type: 'progress', message: 'Volume up — push for PR' };
    }
    return null;
  };

  // ===== Actions =====
  const addFood = () => {
    if (!foodName || !foodCals) return;
    const entry = {
      name: foodName,
      cals: parseInt(foodCals) || 0,
      protein: parseInt(foodProtein) || 0,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    updateDay({
      calories: [...day.calories, entry],
      protein: day.protein + entry.protein,
    });
    setFoodName(''); setFoodCals(''); setFoodProtein('');
  };

  const removeFood = (idx) => {
    const removed = day.calories[idx];
    updateDay({
      calories: day.calories.filter((_, i) => i !== idx),
      protein: Math.max(0, day.protein - (removed.protein || 0)),
    });
  };

  const addWater = (oz) => {
    const newWater = Math.max(0, day.water + oz);
    const habits = { ...day.habits, water_target: newWater >= stats.waterTarget };
    updateDay({ water: newWater, habits });
  };

  const togglePriority = (id) => {
    const newPriorities = day.priorities.map(p =>
      p.id === id ? { ...p, done: !p.done } : p
    );
    updateDay({ priorities: newPriorities });
  };

  const addPriorityToTemplate = () => {
    if (!newPriority.trim()) return;
    const item = { id: `custom_${Date.now()}`, label: newPriority.trim() };
    const newTemplate = [...priorityTemplate, item];
    setPriorityTemplate(newTemplate);
    storage.set('priorityTemplate', newTemplate);
    updateDay({ priorities: [...day.priorities, { ...item, done: false }] });
    setNewPriority('');
  };

  const removeFromTemplate = (id) => {
    const newTemplate = priorityTemplate.filter(p => p.id !== id);
    setPriorityTemplate(newTemplate);
    storage.set('priorityTemplate', newTemplate);
    updateDay({ priorities: day.priorities.filter(p => p.id !== id) });
  };

  const addExerciseRow = () => setExercises([...exercises, { name: '', sets: '', reps: '', weight: '' }]);
  const updateExercise = (idx, field, value) => {
    const updated = [...exercises];
    updated[idx][field] = value;
    setExercises(updated);
  };
  const removeExercise = (idx) => setExercises(exercises.filter((_, i) => i !== idx));

  const saveWorkout = () => {
    const filled = exercises.filter(e => e.name);
    if (filled.length === 0) return;
    const workout = { type: workoutType, exercises: filled, completed: new Date().toISOString() };
    updateDay({
      workout,
      habits: { ...day.habits, gym: true }
    });
    setExercises([{ name: '', sets: '', reps: '', weight: '' }]);
  };

  const clearWorkout = () => {
    updateDay({ workout: null, habits: { ...day.habits, gym: false } });
  };

  const saveStats = (newStats) => {
    setStats(newStats);
    storage.set('stats', newStats);
  };

  const exportData = () => {
    const allData = { stats, priorityTemplate, days: {} };
    storage.list('day:').forEach(k => {
      allData.days[k.replace('day:', '')] = storage.get(k);
    });
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cut-tracker-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Stats =====
  const weeklyDeficit = history.slice(0, 7).reduce((sum, d) => {
    const dayCals = (d.calories || []).reduce((s, f) => s + f.cals, 0);
    return sum + (stats.targetCalories - dayCals);
  }, 0);
  const fatLossPounds = (weeklyDeficit / 3500).toFixed(2);

  const weekGymDays = history.slice(0, 7).filter(d => d.habits?.gym).length;
  const weekWaterDays = history.slice(0, 7).filter(d => d.habits?.water_target).length;

  const priorityCompletion = day.priorities.length > 0
    ? Math.round((day.priorities.filter(p => p.done).length / day.priorities.length) * 100)
    : 0;

  // ===== UI =====
  const tabBtn = (id, label, icon) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        flex: 1, padding: '10px 4px',
        background: activeTab === id ? '#1e293b' : 'transparent',
        color: activeTab === id ? '#fff' : '#64748b',
        border: 'none',
        borderBottom: activeTab === id ? '2px solid #f97316' : '2px solid transparent',
        fontSize: '11px', fontWeight: '600', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
      }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: 'env(safe-area-inset-bottom, 20px)', paddingTop: 'env(safe-area-inset-top, 0)' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <header style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={22} color="#f97316" />
            Cut Tracker
          </h1>
          <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </header>

        <div style={{ display: 'flex', background: '#0f172a', borderRadius: '12px', marginBottom: '16px', overflow: 'hidden' }}>
          {tabBtn('today', 'Today', <Sunrise size={16} />)}
          {tabBtn('food', 'Food', <Flame size={16} />)}
          {tabBtn('workout', 'Lift', <Dumbbell size={16} />)}
          {tabBtn('body', 'Body', <Activity size={16} />)}
          {tabBtn('history', 'Log', <Calendar size={16} />)}
          {tabBtn('settings', 'More', <TrendingDown size={16} />)}
        </div>

        {/* ===== TODAY TAB ===== */}
        {activeTab === 'today' && (
          <div>
            {/* Focus line */}
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Star size={14} color="#f97316" />
                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>TODAY'S #1 PRIORITY</span>
              </div>
              <input
                type="text"
                placeholder="One thing that has to happen today..."
                value={day.focus}
                onChange={(e) => updateDay({ focus: e.target.value })}
                style={{ ...inputStyle, fontSize: '15px' }}
              />
            </div>

            {/* Morning checklist */}
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>Morning Checklist</h3>
                <span style={{ fontSize: '12px', color: priorityCompletion === 100 ? '#22c55e' : '#64748b', fontWeight: '600' }}>
                  {day.priorities.filter(p => p.done).length}/{day.priorities.length}
                </span>
              </div>
              {day.priorities.map(p => (
                <div
                  key={p.id}
                  onClick={() => togglePriority(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 0', cursor: 'pointer',
                    borderBottom: '1px solid #1e293b',
                  }}
                >
                  {p.done
                    ? <CheckCircle2 size={20} color="#22c55e" />
                    : <Circle size={20} color="#475569" />
                  }
                  <span style={{
                    fontSize: '14px',
                    color: p.done ? '#64748b' : '#fff',
                    textDecoration: p.done ? 'line-through' : 'none',
                    flex: 1,
                  }}>
                    {p.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Daily habits */}
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Daily Habits</h3>

              {/* Gym */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Dumbbell size={18} color={day.habits.gym ? '#22c55e' : '#475569'} />
                  <span style={{ fontSize: '14px' }}>Gym / Workout</span>
                </div>
                {day.habits.gym
                  ? <CheckCircle2 size={20} color="#22c55e" />
                  : <span style={{ fontSize: '12px', color: '#64748b' }}>Log on Lift tab</span>
                }
              </div>

              {/* Water */}
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Droplet size={18} color={day.habits.water_target ? '#22c55e' : '#3b82f6'} />
                    <span style={{ fontSize: '14px' }}>Water</span>
                  </div>
                  <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                    {day.water} / {stats.waterTarget} oz
                  </span>
                </div>
                <div style={{ background: '#1e293b', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ background: '#3b82f6', height: '100%', width: `${waterPercent}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => addWater(8)} style={waterBtn}>+8oz</button>
                  <button onClick={() => addWater(16)} style={waterBtn}>+16oz</button>
                  <button onClick={() => addWater(24)} style={waterBtn}>+24oz</button>
                  <button onClick={() => addWater(-8)} style={{ ...waterBtn, background: '#3f1d1d', color: '#fca5a5' }}>-8</button>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Calories</div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>{totalCals}</div>
                <div style={{ fontSize: '11px', color: deficit >= 0 ? '#22c55e' : '#ef4444' }}>
                  {deficit >= 0 ? '-' : '+'}{Math.abs(deficit)} deficit
                </div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Protein</div>
                <div style={{ fontSize: '18px', fontWeight: '700' }}>{day.protein}g</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>of {stats.proteinTarget}g</div>
              </div>
            </div>
          </div>
        )}

        {/* ===== FOOD TAB ===== */}
        {activeTab === 'food' && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Calories</span>
                <span style={{ fontSize: '13px' }}>
                  <strong>{totalCals}</strong> <span style={{ color: '#64748b' }}>/ {stats.targetCalories}</span>
                </span>
              </div>
              <div style={{ background: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: calsPercent > 100 ? '#ef4444' : '#f97316', height: '100%', width: `${calsPercent}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Deficit</span>
                <span style={{ fontSize: '18px', fontWeight: '700', color: deficit >= 0 ? '#22c55e' : '#ef4444' }}>
                  {deficit >= 0 ? '-' : '+'}{Math.abs(deficit)} cal
                </span>
              </div>
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Protein</span>
                <span style={{ fontSize: '13px' }}>
                  <strong>{day.protein}g</strong> <span style={{ color: '#64748b' }}>/ {stats.proteinTarget}g</span>
                </span>
              </div>
              <div style={{ background: '#1e293b', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: '#3b82f6', height: '100%', width: `${proteinPercent}%`, transition: 'width 0.3s' }} />
              </div>
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Add Food</h3>
              <input type="text" placeholder="Food name (e.g. Nurri protein drink)" value={foodName} onChange={(e) => setFoodName(e.target.value)} style={inputStyle} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input type="number" inputMode="numeric" placeholder="Calories" value={foodCals} onChange={(e) => setFoodCals(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <input type="number" inputMode="numeric" placeholder="Protein (g)" value={foodProtein} onChange={(e) => setFoodProtein(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              </div>
              <button onClick={addFood} style={primaryBtn}>
                <Plus size={16} /> Add Food
              </button>
            </div>

            {day.calories.length > 0 && (
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Today's Food</h3>
                {day.calories.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < day.calories.length - 1 ? '1px solid #1e293b' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '14px' }}>{f.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {f.time} • {f.cals} cal • {f.protein}g protein
                      </div>
                    </div>
                    <button onClick={() => removeFood(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== WORKOUT TAB ===== */}
        {activeTab === 'workout' && (
          <div>
            {day.workout ? (
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0 }}>{day.workout.type} ✓</h3>
                  <button onClick={clearWorkout} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
                    Reset
                  </button>
                </div>
                {day.workout.exercises.map((ex, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < day.workout.exercises.length - 1 ? '1px solid #1e293b' : 'none' }}>
                    <div style={{ fontWeight: '600' }}>{ex.name}</div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {ex.sets} × {ex.reps} @ {ex.weight} lbs
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Log Workout</h3>
                <select value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} style={{ ...inputStyle, marginBottom: '12px' }}>
                  <option>Upper A</option>
                  <option>Lower A</option>
                  <option>Upper B</option>
                  <option>Lower B</option>
                  <option>Cardio/Walking Pad</option>
                </select>
                {exercises.map((ex, i) => {
                  const flag = ex.name ? getFatigueFlag(ex.name) : null;
                  const key = ex.name.toLowerCase().trim();
                  const lastSession = key && exerciseHistory[key]?.[0];
                  return (
                    <div key={i} style={{ marginBottom: '12px', padding: '12px', background: '#1e293b', borderRadius: '8px' }}>
                      <input type="text" placeholder="Exercise (e.g. Bench Press)" value={ex.name} onChange={(e) => updateExercise(i, 'name', e.target.value)} style={{ ...inputStyle, marginBottom: '8px' }} />
                      {lastSession && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                          Last: {lastSession.sets}×{lastSession.reps} @ {lastSession.weight} lbs
                        </div>
                      )}
                      {flag && (
                        <div style={{
                          fontSize: '11px',
                          color: flag.type === 'fatigue' ? '#fca5a5' : '#86efac',
                          background: flag.type === 'fatigue' ? '#3f1d1d' : '#14532d',
                          padding: '6px 8px', borderRadius: '6px', marginBottom: '8px',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          {flag.type === 'fatigue' ? <AlertTriangle size={12} /> : <TrendingUp size={12} />}
                          {flag.message}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input type="number" inputMode="numeric" placeholder="Sets" value={ex.sets} onChange={(e) => updateExercise(i, 'sets', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" inputMode="numeric" placeholder="Reps" value={ex.reps} onChange={(e) => updateExercise(i, 'reps', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <input type="number" inputMode="numeric" placeholder="Weight" value={ex.weight} onChange={(e) => updateExercise(i, 'weight', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        {exercises.length > 1 && (
                          <button onClick={() => removeExercise(i)} style={{ background: '#7f1d1d', border: 'none', color: '#fff', padding: '0 8px', borderRadius: '6px', cursor: 'pointer' }}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button onClick={addExerciseRow} style={{ ...primaryBtn, background: '#1e293b', marginBottom: '8px' }}>
                  <Plus size={16} /> Add Exercise
                </button>
                <button onClick={saveWorkout} style={primaryBtn}>
                  Save Workout
                </button>
              </div>
            )}

            {/* Exercise history summary */}
            {Object.keys(exerciseHistory).length > 0 && (
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginTop: '12px' }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Exercise PRs</h3>
                {Object.entries(exerciseHistory).slice(0, 10).map(([key, sessions]) => {
                  const maxWeight = Math.max(...sessions.map(s => s.weight));
                  const last = sessions[0];
                  return (
                    <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px' }}>{last.displayName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#f97316' }}>{maxWeight} lbs</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>top weight</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== BODY TAB ===== */}
        {activeTab === 'body' && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>BMI</h3>
              <div style={{ fontSize: '36px', fontWeight: '700', color: bmiColor }}>
                {bmi}
              </div>
              <div style={{ fontSize: '13px', color: bmiColor, marginTop: '4px' }}>
                {bmiCategory}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {stats.weight} lbs at {Math.floor(stats.heightInches / 12)}'{stats.heightInches % 12}"
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Est. Body Fat</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#f97316' }}>{estBodyFat}%</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>BMI-based estimate</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Lean Mass</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#22c55e' }}>{leanMass}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>lbs muscle + bone</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Fat Mass</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#ef4444' }}>{fatMass}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>lbs to cut from</div>
              </div>
              <div style={miniCard}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Protein Min</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#3b82f6' }}>{Math.round(leanMass)}g</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>1g per lb lean</div>
              </div>
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Update Weight</h3>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={stats.weight}
                onChange={(e) => saveStats({ ...stats, weight: parseFloat(e.target.value) || 0 })}
                style={inputStyle}
              />
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                Weigh in mornings after bathroom, before food/water
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
              <strong style={{ color: '#f97316' }}>Visible abs target:</strong> roughly 10-12% body fat for men. You'd need to drop ~{Math.max(0, parseFloat(fatMass) - leanMass * 0.12).toFixed(1)} lbs of fat from current estimate. At a 500 cal/day deficit that's ~{Math.max(0, ((parseFloat(fatMass) - leanMass * 0.12) / 1)).toFixed(0)} weeks.
            </div>
          </div>
        )}

        {/* ===== HISTORY TAB ===== */}
        {activeTab === 'history' && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#94a3b8' }}>Last 7 Days</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Fat Loss</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#22c55e' }}>~{fatLossPounds}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>lbs estimate</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Gym Days</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#f97316' }}>{weekGymDays}/7</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Water Goal</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>{weekWaterDays}/7</div>
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#64748b' }}>
                No history yet. Log some days.
              </div>
            ) : (
              history.map((d) => {
                const dayCals = (d.calories || []).reduce((s, f) => s + f.cals, 0);
                const dayDeficit = stats.targetCalories - dayCals;
                return (
                  <div key={d.date} style={{ background: '#0f172a', borderRadius: '12px', padding: '14px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '14px' }}>{new Date(d.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
                      <span style={{ color: dayDeficit >= 0 ? '#22c55e' : '#ef4444', fontWeight: '600', fontSize: '14px' }}>
                        {dayDeficit >= 0 ? '-' : '+'}{Math.abs(dayDeficit)}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <span>{dayCals} cal</span>
                      <span>{d.protein || 0}g pro</span>
                      <span>{d.water || 0}oz H₂O</span>
                      {d.habits?.gym && <span style={{ color: '#f97316' }}>● gym</span>}
                      {d.workout && <span>{d.workout.type}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== SETTINGS TAB ===== */}
        {activeTab === 'settings' && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Targets</h3>
              <label style={labelStyle}>Bodyweight (lbs)</label>
              <input type="number" inputMode="decimal" step="0.1" value={stats.weight} onChange={(e) => saveStats({ ...stats, weight: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              <label style={labelStyle}>Height (inches)</label>
              <input type="number" inputMode="numeric" value={stats.heightInches} onChange={(e) => saveStats({ ...stats, heightInches: parseInt(e.target.value) || 0 })} style={inputStyle} />
              <label style={labelStyle}>Daily Calorie Target</label>
              <input type="number" inputMode="numeric" value={stats.targetCalories} onChange={(e) => saveStats({ ...stats, targetCalories: parseInt(e.target.value) || 0 })} style={inputStyle} />
              <label style={labelStyle}>Daily Protein Target (g)</label>
              <input type="number" inputMode="numeric" value={stats.proteinTarget} onChange={(e) => saveStats({ ...stats, proteinTarget: parseInt(e.target.value) || 0 })} style={inputStyle} />
              <label style={labelStyle}>Daily Water Target (oz)</label>
              <input type="number" inputMode="numeric" value={stats.waterTarget} onChange={(e) => saveStats({ ...stats, waterTarget: parseInt(e.target.value) || 0 })} style={inputStyle} />
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#94a3b8' }}>Morning Checklist Items</h3>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
                These reset every morning. Edit to fit your routine.
              </div>
              {priorityTemplate.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ fontSize: '13px', flex: 1 }}>{p.label}</span>
                  <button onClick={() => removeFromTemplate(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                <input
                  type="text"
                  placeholder="Add checklist item..."
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addPriorityToTemplate()}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={addPriorityToTemplate} style={{ ...primaryBtn, width: 'auto', padding: '10px 16px', marginTop: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div style={{ background: '#0f172a', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
              <button onClick={exportData} style={{ ...primaryBtn, background: '#1e293b', marginTop: 0 }}>
                Export All Data (JSON Backup)
              </button>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Back up monthly. Data lives only in this browser.
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#94a3b8', lineHeight: '1.5' }}>
              <strong style={{ color: '#f97316' }}>The math:</strong> 500 cal/day deficit ≈ 1 lb/week fat loss. Hit ~1g protein per lb lean mass to protect muscle. Visible abs need 10-12% body fat. Patience over crash dieting.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = {
  width: '100%',
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#fff',
  padding: '10px 12px',
  borderRadius: '8px',
  fontSize: '16px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '6px',
  marginTop: '12px',
};

const primaryBtn = {
  width: '100%',
  background: '#f97316',
  border: 'none',
  color: '#fff',
  padding: '12px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '600',
  cursor: 'pointer',
  marginTop: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
};

const waterBtn = {
  flex: 1,
  background: '#1e3a5f',
  border: 'none',
  color: '#93c5fd',
  padding: '8px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: '600',
  cursor: 'pointer',
};

const miniCard = {
  background: '#0f172a',
  borderRadius: '12px',
  padding: '14px',
};

export default App;
