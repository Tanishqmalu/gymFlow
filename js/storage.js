const STORAGE_KEY = 'gymflow_workouts';
const STREAK_KEY = 'gymflow_streak';
const SYNC_KEY = 'gymflow_sync_code';
const TOKEN_KEY = 'gymflow_github_token';
const REPO_OWNER = 'Tanishqmalu';
const REPO_NAME = 'gym-timer';
const USER_DATA_PATH = 'data/users';

let savedWorkouts = [];
let streakData = { completedDates: [] };
let syncCode = '';
let githubToken = '';
let editingWorkoutId = null;

function loadSavedWorkouts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    savedWorkouts = data ? JSON.parse(data) : [];
  } catch (e) {
    savedWorkouts = [];
  }
  loadStreakData();
  renderSavedWorkouts();
  renderStreak();
}

function persistWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedWorkouts));
  renderSavedWorkouts();
}

// Streak
function loadStreakData() {
  try {
    const data = localStorage.getItem(STREAK_KEY);
    streakData = data ? JSON.parse(data) : { completedDates: [] };
  } catch (e) {
    streakData = { completedDates: [] };
  }
}

function persistStreak() {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streakData));
  renderStreak();
}

function markWorkoutCompleted() {
  const today = new Date().toISOString().slice(0, 10);
  if (!streakData.completedDates.includes(today)) {
    streakData.completedDates.push(today);
    persistStreak();
  }
}

function getCurrentStreak() {
  const dates = [...streakData.completedDates].sort().reverse();
  if (dates.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().slice(0, 10);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Streak must include today or yesterday
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

  let streak = 0;
  let checkDate = new Date(dates[0]);

  for (const dateStr of dates) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);

    if (d.getTime() === checkDate.getTime()) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (d.getTime() < checkDate.getTime()) {
      break;
    }
  }

  return streak;
}

function getMonthCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: 0, completed: false, today: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({
      day: d,
      completed: streakData.completedDates.includes(dateStr),
      today: d === today
    });
  }
  return { days, monthName: now.toLocaleString('default', { month: 'long', year: 'numeric' }) };
}

function renderStreak() {
  // Desktop full-size streak
  const desktopContainer = document.getElementById('streak-display-desktop');
  if (desktopContainer) {
    const streak = getCurrentStreak();
    const { days, monthName } = getMonthCalendar();
    const totalThisMonth = days.filter(d => d.completed).length;

    desktopContainer.innerHTML = `
      <div class="streak-header">
        <div class="streak-count">
          <span class="streak-fire">&#128293;</span>
          <span class="streak-number">${streak}</span>
          <span class="streak-label">day streak</span>
        </div>
        <div class="streak-month-count">${totalThisMonth} workouts this month</div>
      </div>
      <div class="streak-calendar">
        <div class="cal-title">${monthName}</div>
        <div class="cal-days-header">
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>
        <div class="cal-grid">
          ${days.map(d => {
            if (d.day === 0) return '<span class="cal-day empty"></span>';
            let cls = 'cal-day';
            if (d.completed) cls += ' completed';
            if (d.today) cls += ' today';
            return `<span class="${cls}">${d.day}</span>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Mobile strip calendar
  renderStripCalendar();
}

function renderStripCalendar() {
  const container = document.getElementById('strip-calendar');
  if (!container) return;

  const streak = getCurrentStreak();
  const { days, monthName } = getMonthCalendar();

  container.innerHTML = `
    <div class="strip-cal-header">
      <span class="strip-cal-streak">&#128293; ${streak}</span>
      <span class="strip-cal-month">${monthName}</span>
    </div>
    <div class="strip-cal-grid">
      ${days.map(d => {
        if (d.day === 0) return '<span class="strip-cal-day empty"></span>';
        let cls = 'strip-cal-day';
        if (d.completed) cls += ' completed';
        if (d.today) cls += ' today';
        return `<span class="${cls}">${d.day}</span>`;
      }).join('')}
    </div>`;
}

// Quote of the day
let quotes = [];

async function loadQuotes() {
  try {
    const res = await fetch('data/quotes.json');
    quotes = await res.json();
    renderDailyQuote();
  } catch (e) {
    quotes = ['The only bad workout is the one that didn\'t happen.'];
    renderDailyQuote();
  }
}

function renderDailyQuote() {
  const container = document.getElementById('strip-quote');
  if (!container || quotes.length === 0) return;

  // Pick quote based on day of year (deterministic per day)
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const quoteIndex = dayOfYear % quotes.length;

  container.innerHTML = `<span class="quote-text">"${quotes[quoteIndex]}"</span>`;
}

function showSaveDialog() {
  if (workout.length === 0) {
    alert('Add some exercises to your workout first!');
    return;
  }
  const modal = document.getElementById('save-modal');
  const nameInput = document.getElementById('save-workout-name');
  const saveBtn = document.getElementById('save-modal-btn');

  if (editingWorkoutId) {
    const existing = savedWorkouts.find(w => w.id === editingWorkoutId);
    nameInput.value = existing ? existing.name : '';
    saveBtn.textContent = 'Update Workout';
  } else {
    nameInput.value = '';
    saveBtn.textContent = 'Save Workout';
  }

  modal.classList.add('visible');
  setTimeout(() => nameInput.focus(), 100);
}

function closeSaveModal(event, force = false) {
  if (force || event.target === event.currentTarget) {
    document.getElementById('save-modal').classList.remove('visible');
    editingWorkoutId = null;
  }
}

function saveCurrentWorkout() {
  const nameInput = document.getElementById('save-workout-name');
  const name = nameInput.value.trim();

  if (!name) {
    nameInput.style.borderColor = 'var(--accent)';
    nameInput.placeholder = 'Please enter a name!';
    return;
  }

  const exerciseData = workout.map(item => ({
    exerciseId: item.exerciseId,
    sets: item.sets,
    reps: item.reps,
    weight: item.weight,
    duration: item.duration
  }));

  if (editingWorkoutId) {
    // Update existing
    const idx = savedWorkouts.findIndex(w => w.id === editingWorkoutId);
    if (idx !== -1) {
      savedWorkouts[idx].name = name;
      savedWorkouts[idx].exercises = exerciseData;
      savedWorkouts[idx].restBetweenSets = getRestBetweenSets();
      savedWorkouts[idx].restBetweenExercises = getRestBetweenExercises();
      savedWorkouts[idx].updatedAt = new Date().toISOString();
    }
    editingWorkoutId = null;
  } else {
    // Create new
    const workoutData = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: name,
      createdAt: new Date().toISOString(),
      restBetweenSets: getRestBetweenSets(),
      restBetweenExercises: getRestBetweenExercises(),
      exercises: exerciseData
    };
    savedWorkouts.unshift(workoutData);
  }

  persistWorkouts();
  document.getElementById('save-modal').classList.remove('visible');

  // Auto-push to cloud if connected
  if (syncCode && githubToken) {
    pushToCloud(true);
  }
}

function editSavedWorkout(id) {
  const saved = savedWorkouts.find(w => w.id === id);
  if (!saved) return;

  // Load into builder
  workout = saved.exercises.map(item => ({ ...item }));
  document.getElementById('rest-between-sets').value = saved.restBetweenSets || 60;
  document.getElementById('rest-between-exercises').value = saved.restBetweenExercises || 90;

  updateWorkoutBadge();
  renderExerciseList();
  renderWorkout();

  // Set editing mode
  editingWorkoutId = id;

  if (!isDesktop()) {
    switchTab('workout');
  }

  // Show indicator that we're editing
  renderWorkoutEditBanner(saved.name);
}

function renderWorkoutEditBanner(name) {
  const container = document.getElementById('workout-exercises');
  const banner = document.createElement('div');
  banner.className = 'edit-banner';
  banner.innerHTML = `
    <span>Editing: <strong>${name}</strong></span>
    <button class="btn btn-primary" onclick="showSaveDialog()" style="font-size:0.75rem; padding:0.35rem 0.6rem;">Save Changes</button>
    <button class="btn btn-outline" onclick="cancelEdit()" style="font-size:0.75rem; padding:0.35rem 0.6rem;">Cancel</button>
  `;
  container.insertBefore(banner, container.firstChild);
}

function cancelEdit() {
  editingWorkoutId = null;
  workout = [];
  updateWorkoutBadge();
  renderExerciseList();
  renderWorkout();
}

function loadSavedWorkout(id) {
  const saved = savedWorkouts.find(w => w.id === id);
  if (!saved) return;

  workout = saved.exercises.map(item => ({ ...item }));

  document.getElementById('rest-between-sets').value = saved.restBetweenSets || 60;
  document.getElementById('rest-between-exercises').value = saved.restBetweenExercises || 90;

  updateWorkoutBadge();
  renderExerciseList();
  renderWorkout();

  if (!isDesktop()) {
    switchTab('workout');
  }
}

function deleteSavedWorkout(id) {
  savedWorkouts = savedWorkouts.filter(w => w.id !== id);
  persistWorkouts();

  if (syncCode && githubToken) {
    pushToCloud(true);
  }
}

function renderSavedWorkouts() {
  const containers = [
    document.getElementById('saved-list'),
    document.getElementById('saved-list-desktop')
  ].filter(Boolean);

  const html = savedWorkouts.length === 0
    ? `<div class="empty-state">
        <div class="icon">&#128190;</div>
        <p>No saved workouts yet. Build a workout and save it!</p>
       </div>`
    : savedWorkouts.map(w => {
        const exNames = w.exercises.map(e => {
          const ex = exercises.find(x => x.id === e.exerciseId);
          return ex ? ex.name : 'Unknown';
        });
        const totalSets = w.exercises.reduce((s, e) => s + e.sets, 0);
        const date = new Date(w.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

        return `
          <div class="saved-card">
            <div class="saved-card-header">
              <h4>${w.name}</h4>
              <span class="saved-card-date">${date}</span>
            </div>
            <div class="saved-card-meta">
              <span>${w.exercises.length} exercises</span>
              <span>${totalSets} sets</span>
            </div>
            <div class="saved-card-exercises">
              ${exNames.slice(0, 4).join(', ')}${exNames.length > 4 ? ` +${exNames.length - 4} more` : ''}
            </div>
            <div class="saved-card-actions">
              <button class="btn btn-success" onclick="loadSavedWorkout('${w.id}')">Load</button>
              <button class="btn btn-outline" onclick="editSavedWorkout('${w.id}')">Edit</button>
              <button class="btn btn-danger" onclick="confirmDelete('${w.id}')">Delete</button>
            </div>
          </div>`;
      }).join('');

  containers.forEach(c => { c.innerHTML = html; });
}

function confirmDelete(id) {
  if (confirm('Delete this saved workout?')) {
    deleteSavedWorkout(id);
  }
}

// GitHub Sync
function loadSyncState() {
  syncCode = localStorage.getItem(SYNC_KEY) || '';
  githubToken = localStorage.getItem(TOKEN_KEY) || '';

  const codeInput = document.getElementById('sync-code-input');
  const tokenInput = document.getElementById('sync-token-input');

  if (syncCode) {
    codeInput.value = syncCode;
  }
  if (githubToken) {
    tokenInput.value = '••••••••••••';
  }

  updateSyncUI();
}

function updateSyncUI() {
  const status = document.getElementById('sync-status');
  const actions = document.getElementById('sync-actions');

  if (syncCode && githubToken) {
    status.textContent = syncCode;
    status.classList.add('connected');
    actions.style.display = 'flex';
  } else {
    status.textContent = 'Local only';
    status.classList.remove('connected');
    actions.style.display = 'none';
  }
}

function toggleSyncPanel() {
  document.getElementById('sync-panel').classList.toggle('open');
}

function showSyncMessage(msg, type = 'success') {
  const el = document.getElementById('sync-message');
  el.textContent = msg;
  el.className = `sync-message ${type}`;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

async function connectSync() {
  const code = document.getElementById('sync-code-input').value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
  const token = document.getElementById('sync-token-input').value.trim();

  if (!code || code.length < 3) {
    showSyncMessage('Username must be at least 3 characters (a-z, 0-9, -)', 'error');
    return;
  }

  if (!token || token === '••••••••••••') {
    if (githubToken) {
      // Already have token stored, just update code
      syncCode = code;
      localStorage.setItem(SYNC_KEY, syncCode);
      updateSyncUI();
      showSyncMessage('Connected!', 'success');
      return;
    }
    showSyncMessage('GitHub token required for first-time setup', 'error');
    return;
  }

  // Verify token works
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
      headers: { 'Authorization': `token ${token}` }
    });

    if (!res.ok) {
      showSyncMessage('Invalid token or no access to repo', 'error');
      return;
    }
  } catch (e) {
    showSyncMessage('Network error. Check connection.', 'error');
    return;
  }

  syncCode = code;
  githubToken = token;
  localStorage.setItem(SYNC_KEY, syncCode);
  localStorage.setItem(TOKEN_KEY, githubToken);

  updateSyncUI();
  showSyncMessage('Connected! Your data syncs to: ' + code + '.json', 'success');
}

function disconnectSync() {
  syncCode = '';
  githubToken = '';
  localStorage.removeItem(SYNC_KEY);
  localStorage.removeItem(TOKEN_KEY);

  document.getElementById('sync-code-input').value = '';
  document.getElementById('sync-token-input').value = '';
  updateSyncUI();
  showSyncMessage('Disconnected. Workouts still saved locally.', 'success');
}

async function pushToCloud(silent = false) {
  if (!syncCode || !githubToken) {
    if (!silent) showSyncMessage('Connect first with username + token', 'error');
    return;
  }

  const filePath = `${USER_DATA_PATH}/${syncCode}.json`;
  const content = JSON.stringify({
    user: syncCode,
    workouts: savedWorkouts,
    streak: streakData,
    lastUpdated: new Date().toISOString()
  }, null, 2);

  const encodedContent = btoa(unescape(encodeURIComponent(content)));

  try {
    if (!silent) showSyncMessage('Pushing...', 'success');

    // Check if file exists (to get SHA for update)
    let sha = null;
    const checkRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      { headers: { 'Authorization': `token ${githubToken}` } }
    );

    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    // Create or update file
    const body = {
      message: `sync: update ${syncCode} workouts`,
      content: encodedContent
    };
    if (sha) body.sha = sha;

    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Push failed');
    }

    if (!silent) showSyncMessage(`Pushed ${savedWorkouts.length} workouts`, 'success');
  } catch (e) {
    if (!silent) showSyncMessage(`Push failed: ${e.message}`, 'error');
  }
}

async function pullFromCloud() {
  if (!syncCode) {
    showSyncMessage('Enter a username first', 'error');
    return;
  }

  const filePath = `${USER_DATA_PATH}/${syncCode}.json`;

  try {
    showSyncMessage('Pulling...', 'success');

    // Try public raw URL first (works without token for public repos)
    const res = await fetch(
      `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${filePath}?t=${Date.now()}`
    );

    if (!res.ok) {
      if (res.status === 404) {
        showSyncMessage('No cloud data found for this username. Push first.', 'error');
      } else {
        throw new Error('Fetch failed');
      }
      return;
    }

    const data = await res.json();
    savedWorkouts = data.workouts || [];
    if (data.streak) {
      streakData = data.streak;
      persistStreak();
    }
    persistWorkouts();
    showSyncMessage(`Pulled ${savedWorkouts.length} workouts (last updated: ${new Date(data.lastUpdated).toLocaleString()})`, 'success');
  } catch (e) {
    showSyncMessage('Pull failed. Check connection.', 'error');
  }
}

// Export/Import
function exportWorkouts() {
  const data = JSON.stringify(savedWorkouts, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gymflow-${syncCode || 'workouts'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importWorkouts(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (Array.isArray(imported)) {
        savedWorkouts = imported;
        persistWorkouts();
        showSyncMessage(`Imported ${imported.length} workouts`, 'success');
      } else {
        showSyncMessage('Invalid file format', 'error');
      }
    } catch (err) {
      showSyncMessage('Failed to parse file', 'error');
    }
  };
  reader.readAsText(file);
}
