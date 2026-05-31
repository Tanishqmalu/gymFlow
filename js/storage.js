const STORAGE_KEY = 'gymflow_workouts';
const SYNC_KEY = 'gymflow_sync_code';
const TOKEN_KEY = 'gymflow_github_token';
const REPO_OWNER = 'Tanishqmalu';
const REPO_NAME = 'gym-timer';
const USER_DATA_PATH = 'data/users';

let savedWorkouts = [];
let syncCode = '';
let githubToken = '';

function loadSavedWorkouts() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    savedWorkouts = data ? JSON.parse(data) : [];
  } catch (e) {
    savedWorkouts = [];
  }
  renderSavedWorkouts();
}

function persistWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(savedWorkouts));
  renderSavedWorkouts();
}

function showSaveDialog() {
  if (workout.length === 0) {
    alert('Add some exercises to your workout first!');
    return;
  }
  document.getElementById('save-modal').classList.add('visible');
  document.getElementById('save-workout-name').value = '';
  setTimeout(() => document.getElementById('save-workout-name').focus(), 100);
}

function closeSaveModal(event, force = false) {
  if (force || event.target === event.currentTarget) {
    document.getElementById('save-modal').classList.remove('visible');
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

  const workoutData = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: name,
    createdAt: new Date().toISOString(),
    restBetweenSets: getRestBetweenSets(),
    restBetweenExercises: getRestBetweenExercises(),
    exercises: workout.map(item => ({
      exerciseId: item.exerciseId,
      sets: item.sets,
      reps: item.reps,
      weight: item.weight,
      duration: item.duration
    }))
  };

  savedWorkouts.unshift(workoutData);
  persistWorkouts();
  document.getElementById('save-modal').classList.remove('visible');

  // Auto-push to cloud if connected
  if (syncCode && githubToken) {
    pushToCloud(true);
  }
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
