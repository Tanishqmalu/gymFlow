class IntervalTimer {
  constructor(onTick, onPhaseChange, onComplete) {
    this.onTick = onTick;
    this.onPhaseChange = onPhaseChange;
    this.onComplete = onComplete;
    this.reset();
  }

  reset() {
    this.exercises = [];
    this.currentExerciseIndex = 0;
    this.currentSet = 1;
    this.phase = 'idle';
    this.timeRemaining = 0;
    this.totalTime = 0;
    this.isRunning = false;
    this.intervalId = null;
    this.lastTick = null;
  }

  loadWorkout(exercises, restBetweenSets, restBetweenExercises) {
    this.exercises = exercises;
    this.restBetweenSets = restBetweenSets;
    this.restBetweenExercises = restBetweenExercises;
    this.currentExerciseIndex = 0;
    this.currentSet = 1;
    this.phase = 'idle';
    this.timeRemaining = 0;
  }

  start() {
    if (this.exercises.length === 0) return;

    if (this.phase === 'idle') {
      this.startWorkPhase();
    }

    this.isRunning = true;
    this.lastTick = Date.now();
    this.intervalId = setInterval(() => this.tick(), 100);
  }

  pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  stop() {
    this.pause();
    this.currentExerciseIndex = 0;
    this.currentSet = 1;
    this.phase = 'idle';
    this.timeRemaining = 0;
    this.onTick(this.getState());
  }

  skip() {
    this.moveToNext();
  }

  tick() {
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;

    this.timeRemaining -= elapsed;

    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.moveToNext();
      return;
    }

    this.onTick(this.getState());
  }

  startWorkPhase() {
    const exercise = this.exercises[this.currentExerciseIndex];
    this.phase = 'work';
    this.timeRemaining = exercise.duration * 1000;
    this.totalTime = exercise.duration * 1000;
    this.onPhaseChange(this.getState());
    this.onTick(this.getState());
  }

  startRestPhase(isExerciseTransition) {
    this.phase = 'rest';
    const restTime = isExerciseTransition ? this.restBetweenExercises : this.restBetweenSets;
    this.timeRemaining = restTime * 1000;
    this.totalTime = restTime * 1000;
    this.onPhaseChange(this.getState());
    this.onTick(this.getState());
  }

  moveToNext() {
    if (this.phase === 'work') {
      const exercise = this.exercises[this.currentExerciseIndex];
      if (this.currentSet < exercise.sets) {
        this.currentSet++;
        this.startRestPhase(false);
      } else if (this.currentExerciseIndex < this.exercises.length - 1) {
        this.startRestPhase(true);
      } else {
        this.phase = 'complete';
        this.pause();
        this.onComplete();
        this.onTick(this.getState());
      }
    } else if (this.phase === 'rest') {
      const exercise = this.exercises[this.currentExerciseIndex];
      if (this.currentSet >= exercise.sets && this.currentExerciseIndex < this.exercises.length - 1) {
        this.currentExerciseIndex++;
        this.currentSet = 1;
      }
      this.startWorkPhase();
    }
  }

  getState() {
    const exercise = this.exercises[this.currentExerciseIndex] || null;
    const progress = this.totalTime > 0 ? 1 - (this.timeRemaining / this.totalTime) : 0;

    return {
      phase: this.phase,
      isRunning: this.isRunning,
      currentExercise: exercise,
      currentExerciseIndex: this.currentExerciseIndex,
      currentSet: this.currentSet,
      totalSets: exercise ? exercise.sets : 0,
      timeRemaining: Math.max(0, Math.ceil(this.timeRemaining / 1000)),
      timeRemainingMs: Math.max(0, this.timeRemaining),
      progress: Math.min(1, Math.max(0, progress)),
      totalExercises: this.exercises.length
    };
  }
}
