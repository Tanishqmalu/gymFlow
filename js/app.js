const GIF_BASE = 'https://raw.githubusercontent.com/Tanishqmalu/exercises-gifs/main/assets';

let exercises = [];
let workout = [];
let selectedCategory = 'all';
let selectedEquipment = 'all';
let searchQuery = '';
let timer = null;
let soundEnabled = true;
let displayLimit = 50;
let countdownTimeout = null;

let audioCtx;
try {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
  audioCtx = null;
}

function getGifUrl(gifId) {
  return `${GIF_BASE}/${gifId}.gif`;
}

function playBeep(frequency = 800, duration = 150, count = 1) {
  if (!soundEnabled || !audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.value = frequency;
          gain.gain.value = 0.3;
          osc.start(audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
          osc.stop(audioCtx.currentTime + duration / 1000);
        } catch (e) {}
      }, i * 250);
    }
  } catch (e) {}
}

// Tab Navigation
function isDesktop() {
  return window.innerWidth >= 768;
}

function switchTab(tab) {
  if (isDesktop()) return;

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add('active');
}

// Init
async function init() {
  const response = await fetch('data/exercises.json');
  exercises = await response.json();

  timer = new IntervalTimer(onTimerTick, onPhaseChange, onWorkoutComplete);

  renderCategories();
  renderEquipmentFilters();
  renderExerciseList();
  renderWorkout();
  renderTimer(timer.getState());

  document.getElementById('tab-exercises').addEventListener('scroll', function () {
    if (this.scrollTop + this.clientHeight >= this.scrollHeight - 200) {
      loadMore();
    }
  });
}

function getFilteredExercises() {
  let filtered = exercises;

  if (selectedCategory !== 'all') {
    filtered = filtered.filter(e => e.category === selectedCategory);
  }

  if (selectedEquipment !== 'all') {
    filtered = filtered.filter(e => e.equipment === selectedEquipment);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.primaryMuscles.some(m => m.toLowerCase().includes(q)) ||
      e.equipment.toLowerCase().includes(q)
    );
  }

  return filtered;
}

function renderCategories() {
  const categories = ['all', ...new Set(exercises.map(e => e.category))];
  const container = document.getElementById('category-filters');
  container.innerHTML = categories.map(cat =>
    `<button class="category-btn ${cat === selectedCategory ? 'active' : ''}"
             onclick="filterCategory('${cat}')">
      ${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>`
  ).join('');
}

function renderEquipmentFilters() {
  const equipments = ['all', ...new Set(exercises.map(e => e.equipment))].sort();
  const container = document.getElementById('equipment-filters');
  container.innerHTML = equipments.map(eq =>
    `<button class="category-btn ${eq === selectedEquipment ? 'active' : ''}"
             onclick="filterEquipment('${eq}')">
      ${eq === 'all' ? 'All Equip' : eq}
    </button>`
  ).join('');
}

function filterCategory(cat) {
  selectedCategory = cat;
  displayLimit = 50;
  renderCategories();
  renderExerciseList();
}

function filterEquipment(eq) {
  selectedEquipment = eq;
  displayLimit = 50;
  renderEquipmentFilters();
  renderExerciseList();
}

function onSearch() {
  searchQuery = document.getElementById('exercise-search').value;
  displayLimit = 50;
  renderExerciseList();
}

function loadMore() {
  const filtered = getFilteredExercises();
  if (displayLimit >= filtered.length) return;
  displayLimit += 50;
  renderExerciseList();
}

function renderExerciseList() {
  const container = document.getElementById('exercise-list');
  const countEl = document.getElementById('exercise-count');
  const filtered = getFilteredExercises();
  const toShow = filtered.slice(0, displayLimit);

  countEl.textContent = `${filtered.length} exercises`;

  const eqIcons = {
    'barbell': 'BB', 'dumbbell': 'DB', 'cable': 'CB', 'leverage machine': 'LV',
    'body weight': 'BW', 'band': 'BD', 'medicine ball': 'MB', 'kettlebell': 'KB',
    'ez barbell': 'EZ', 'smith machine': 'SM', 'resistance band': 'RB',
    'stability ball': 'SB', 'weighted': 'WT', 'assisted': 'AS', 'roller': 'RL',
    'olympic barbell': 'OB', 'trap bar': 'TB', 'rope': 'RP',
    'bosu ball': 'BS', 'hammer': 'HM', 'wheel roller': 'WR',
    'upper body ergometer': 'UB', 'stationary bike': 'BK',
    'elliptical machine': 'EL', 'skierg machine': 'SK',
    'stepmill machine': 'ST', 'sled machine': 'SL', 'tire': 'TR'
  };

  container.innerHTML = toShow.map(ex => {
    const inWorkout = workout.some(w => w.exerciseId === ex.id);
    const icon = eqIcons[ex.equipment] || ex.equipment.substring(0, 2).toUpperCase();
    return `
      <div class="exercise-item ${inWorkout ? 'in-workout' : ''}"
           onclick="showExerciseModal('${ex.id}')">
        <div class="eq-icon">${icon}</div>
        <div class="ex-info">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-muscles">${ex.primaryMuscles.join(', ')} · ${ex.equipment}</div>
        </div>
        <div class="ex-add-icon">${inWorkout ? '&#10003;' : '+'}</div>
      </div>`;
  }).join('');
}

// Exercise Modal
function showExerciseModal(id) {
  const ex = exercises.find(e => e.id === id);
  if (!ex) return;

  const inWorkout = workout.some(w => w.exerciseId === ex.id);
  const modal = document.getElementById('exercise-modal');
  const content = document.getElementById('modal-content');

  content.innerHTML = `
    <div class="modal-gif">
      <img src="${getGifUrl(ex.gifId)}" alt="${ex.name}" />
    </div>
    <div class="modal-title">${ex.name}</div>
    <div class="modal-muscles">
      ${ex.primaryMuscles.map(m => `<span class="muscle-tag primary">${m}</span>`).join('')}
      ${ex.secondaryMuscles.map(m => `<span class="muscle-tag secondary">${m}</span>`).join('')}
      <span class="muscle-tag secondary">${ex.equipment}</span>
    </div>
    <button class="modal-btn ${inWorkout ? 'remove' : 'add'}" onclick="toggleExerciseFromModal('${ex.id}')">
      ${inWorkout ? 'Remove from Workout' : 'Add to Workout'}
    </button>`;

  modal.classList.add('visible');
}

function closeModal(event) {
  if (event.target === event.currentTarget) {
    document.getElementById('exercise-modal').classList.remove('visible');
  }
}

function toggleExerciseFromModal(id) {
  addToWorkout(id);
  document.getElementById('exercise-modal').classList.remove('visible');
}

function addToWorkout(exerciseId) {
  const existing = workout.find(w => w.exerciseId === exerciseId);
  if (existing) {
    workout = workout.filter(w => w.exerciseId !== exerciseId);
  } else {
    workout.push({
      exerciseId,
      sets: 3,
      reps: 12,
      weight: 0,
      duration: 45
    });
  }
  updateWorkoutBadge();
  renderExerciseList();
  renderWorkout();
}

function updateWorkoutBadge() {
  const badge = document.getElementById('workout-badge');
  if (workout.length > 0) {
    badge.textContent = workout.length;
    badge.classList.add('visible');
  } else {
    badge.classList.remove('visible');
  }
}

function renderWorkout() {
  const container = document.getElementById('workout-exercises');

  if (workout.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">&#127947;</div>
        <p>Add exercises from the Exercises tab</p>
      </div>`;
    return;
  }

  container.innerHTML = workout.map((item, idx) => {
    const ex = exercises.find(e => e.id === item.exerciseId);
    return `
      <div class="workout-exercise-card" id="we-${idx}">
        <div class="we-header">
          <h4>${ex.name}</h4>
          <div class="we-header-actions">
            ${idx > 0 ? `<button onclick="moveWorkoutItem(${idx}, -1)">&#9650;</button>` : ''}
            ${idx < workout.length - 1 ? `<button onclick="moveWorkoutItem(${idx}, 1)">&#9660;</button>` : ''}
            <button onclick="removeFromWorkout(${idx})">&#10005;</button>
          </div>
        </div>
        <div class="we-params">
          <div class="we-param">
            <label>Sets</label>
            <input type="number" inputmode="numeric" min="1" max="20" value="${item.sets}"
                   onchange="updateWorkoutItem(${idx}, 'sets', this.value)">
          </div>
          <div class="we-param">
            <label>Reps</label>
            <input type="number" inputmode="numeric" min="1" max="100" value="${item.reps}"
                   onchange="updateWorkoutItem(${idx}, 'reps', this.value)">
          </div>
          <div class="we-param">
            <label>Kg</label>
            <input type="number" inputmode="decimal" min="0" max="500" value="${item.weight}"
                   onchange="updateWorkoutItem(${idx}, 'weight', this.value)">
          </div>
          <div class="we-param">
            <label>Sec</label>
            <input type="number" inputmode="numeric" min="5" max="300" value="${item.duration}"
                   onchange="updateWorkoutItem(${idx}, 'duration', this.value)">
          </div>
        </div>
      </div>`;
  }).join('');

  const totalSets = workout.reduce((sum, w) => sum + w.sets, 0);
  const totalTime = workout.reduce((sum, w) => sum + (w.duration * w.sets), 0);
  const restTime = getRestBetweenSets() * (totalSets - workout.length) + getRestBetweenExercises() * (workout.length - 1);
  const estTotal = totalTime + restTime;

  container.innerHTML += `
    <div class="workout-summary">
      <span>${workout.length} exercises</span>
      <span>${totalSets} sets</span>
      <span>~${Math.ceil(estTotal / 60)} min</span>
    </div>`;
}

function updateWorkoutItem(idx, field, value) {
  workout[idx][field] = parseFloat(value) || 0;
}

function removeFromWorkout(idx) {
  workout.splice(idx, 1);
  updateWorkoutBadge();
  renderExerciseList();
  renderWorkout();
}

function moveWorkoutItem(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= workout.length) return;
  [workout[idx], workout[newIdx]] = [workout[newIdx], workout[idx]];
  renderWorkout();
}

function adjustRest(type, delta) {
  const id = type === 'sets' ? 'rest-between-sets' : 'rest-between-exercises';
  const input = document.getElementById(id);
  const newVal = Math.max(10, Math.min(300, parseInt(input.value) + delta));
  input.value = newVal;
}

function getRestBetweenSets() {
  return parseInt(document.getElementById('rest-between-sets').value) || 60;
}

function getRestBetweenExercises() {
  return parseInt(document.getElementById('rest-between-exercises').value) || 90;
}

// Timer
function startWorkout() {
  if (workout.length === 0) return;

  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  const timerExercises = workout.map(item => {
    const ex = exercises.find(e => e.id === item.exerciseId);
    return { ...item, name: ex.name, gifId: ex.gifId, exercise: ex };
  });

  timer.loadWorkout(timerExercises, getRestBetweenSets(), getRestBetweenExercises());
  timer.start();

  switchTab('timer');
  renderTimer(timer.getState());

  if (timerExercises[0]) {
    updateTimerGif(timerExercises[0].gifId, timerExercises[0].name);
  }
}

function pauseWorkout() {
  timer.pause();
  renderTimer(timer.getState());
}

function resumeWorkout() {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  timer.start();
  renderTimer(timer.getState());
}

function stopWorkout() {
  timer.stop();
  hideCountdown();
  renderTimer(timer.getState());
  document.getElementById('timer-gif').innerHTML = '<div class="placeholder">Workout stopped. Press play to restart.</div>';
  document.querySelectorAll('.workout-exercise-card').forEach(el => el.classList.remove('active-exercise'));
}

function skipPhase() {
  hideCountdown();
  timer.skip();
}

function updateTimerGif(gifId, name) {
  const container = document.getElementById('timer-gif');
  container.innerHTML = `<img src="${getGifUrl(gifId)}" alt="${name}" />`;
}

// Countdown overlay
function showCountdown(num) {
  const overlay = document.getElementById('countdown-overlay');
  const number = document.getElementById('countdown-number');
  overlay.classList.add('visible');
  number.textContent = num;
  number.style.animation = 'none';
  number.offsetHeight; // trigger reflow
  number.style.animation = 'countPulse 0.5s ease-out';
}

function hideCountdown() {
  document.getElementById('countdown-overlay').classList.remove('visible');
  if (countdownTimeout) {
    clearTimeout(countdownTimeout);
    countdownTimeout = null;
  }
}

function onTimerTick(state) {
  renderTimer(state);

  // 3-second countdown before phase ends
  if ((state.phase === 'work' || state.phase === 'rest') && state.timeRemaining <= 3 && state.timeRemaining > 0) {
    showCountdown(state.timeRemaining);
    playBeep(600 + (3 - state.timeRemaining) * 100, 120, 1);
  } else {
    hideCountdown();
  }
}

function onPhaseChange(state) {
  hideCountdown();

  if (state.phase === 'work') {
    playBeep(1000, 200, 2);
    if (state.currentExercise) {
      updateTimerGif(state.currentExercise.gifId, state.currentExercise.name);
    }
  } else if (state.phase === 'rest') {
    playBeep(500, 300, 1);
    document.getElementById('timer-gif').innerHTML = `
      <div class="placeholder" style="font-size:1.5rem; font-weight:700; color:var(--green);">
        REST<br><span style="font-size:0.9rem; font-weight:400; color:var(--text-muted);">Next up: ${getNextExerciseName(state)}</span>
      </div>`;
  }
}

function getNextExerciseName(state) {
  const ex = state.currentExercise;
  if (!ex) return '';
  if (state.currentSet < ex.sets) {
    return `${ex.name} (Set ${state.currentSet + 1})`;
  }
  const nextIdx = state.currentExerciseIndex + 1;
  if (nextIdx < state.totalExercises) {
    return workout[nextIdx] ? exercises.find(e => e.id === workout[nextIdx].exerciseId)?.name || '' : '';
  }
  return 'Done!';
}

function onWorkoutComplete() {
  playBeep(1200, 300, 3);
  document.getElementById('timer-gif').innerHTML = `
    <div class="placeholder" style="font-size:1.5rem; font-weight:700; color:var(--green);">
      Workout Complete! &#127881;
    </div>`;
}

let lastControlState = '';

function renderTimer(state) {
  const timeDisplay = document.getElementById('timer-time');
  const phaseLabel = document.getElementById('timer-phase-label');
  const exerciseName = document.getElementById('timer-exercise-name');
  const progressBar = document.getElementById('timer-progress-bar');
  const meta = document.getElementById('timer-meta');
  const controls = document.getElementById('timer-controls');

  const minutes = Math.floor(state.timeRemaining / 60);
  const seconds = state.timeRemaining % 60;
  timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  timeDisplay.className = 'timer-time';
  progressBar.className = 'timer-progress-bar';

  if (state.phase === 'work') {
    timeDisplay.classList.add('work-mode');
    if (state.isRunning) timeDisplay.classList.add('running');
    phaseLabel.textContent = `SET ${state.currentSet} OF ${state.totalSets}`;
    exerciseName.textContent = state.currentExercise?.name || '';
  } else if (state.phase === 'rest') {
    timeDisplay.classList.add('rest-mode');
    if (state.isRunning) timeDisplay.classList.add('running');
    phaseLabel.textContent = 'REST';
    exerciseName.textContent = '';
    progressBar.classList.add('rest-mode');
  } else if (state.phase === 'complete') {
    phaseLabel.textContent = 'COMPLETE';
    timeDisplay.textContent = '00:00';
    exerciseName.textContent = '';
  } else {
    phaseLabel.textContent = 'READY';
    exerciseName.textContent = workout.length > 0 ? `${workout.length} exercises loaded` : '';
  }

  progressBar.style.width = `${state.progress * 100}%`;

  meta.innerHTML = (state.phase !== 'idle' && state.phase !== 'complete')
    ? `<span>Exercise ${state.currentExerciseIndex + 1}/${state.totalExercises}</span>`
    : '';

  // Only re-render controls when state changes (prevents click swallowing)
  const controlKey = `${state.phase}-${state.isRunning}`;
  if (controlKey !== lastControlState) {
    lastControlState = controlKey;
    if (state.phase === 'idle' || state.phase === 'complete') {
      controls.innerHTML = `
        <button class="btn-icon play" onclick="startWorkout()" title="Start">&#9654;</button>`;
    } else if (state.isRunning) {
      controls.innerHTML = `
        <button class="btn-icon stop" onclick="stopWorkout()" title="Stop">&#9632;</button>
        <button class="btn-icon pause" onclick="pauseWorkout()" title="Pause">&#10074;&#10074;</button>
        <button class="btn-icon skip" onclick="skipPhase()" title="Skip">&#9654;&#9654;</button>`;
    } else {
      controls.innerHTML = `
        <button class="btn-icon stop" onclick="stopWorkout()" title="Stop">&#9632;</button>
        <button class="btn-icon play" onclick="resumeWorkout()" title="Resume">&#9654;</button>
        <button class="btn-icon skip" onclick="skipPhase()" title="Skip">&#9654;&#9654;</button>`;
    }
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('sound-toggle').textContent = soundEnabled ? '🔊' : '🔇';
}

document.addEventListener('DOMContentLoaded', init);
