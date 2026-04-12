(() => {
  const STORAGE_KEY = 'adaptive-audio-universes';
  const GENRES_URL = 'genres.json';
  const FFT_SIZE = 2048;
  const SMOOTHING = 0.82;
  const DEFAULT_GENRE_ID = 'ambient_drone';
  const TARGET_FRAME_MS = 1000 / 60;
  const TYPE_COLORS = {
    void: '#7f8aa6',
    nebula: '#78d6ff',
    warp: '#ff7aa8',
    fractal: '#b087ff',
    orbital: '#72f3c2',
  };

  const state = {
    audioContext: null,
    analyser: null,
    sourceNode: null,
    frequencyData: null,
    timeData: null,
    currentSongId: null,
    currentUniverse: null,
    audioFeatures: { bpm: 0, energy: 0, bass: 0, mids: 0, highs: 0 },
    liveMetrics: { energy: 0, brightness: 0, complexity: 0, peak: 0 },
    currentGenre: null,
    targetGenre: null,
    blendFactor: 1,
    genres: [],
    genreMap: {},
    world: {
      gravity: 0,
      friction: 0.018,
      scale: 1,
      forwardDrift: 0,
      axisTilt: 0,
      pulse: 0,
      geometryMode: 'clouds',
      movementStyle: 'hover',
      transitionStyle: 'morph',
    },
    stars: createStarField(140),
    orbiters: [],
    particles: [],
    lastPersistTime: 0,
    currentObjectUrl: null,
    lastFrameTime: 0,
  };

  const elements = {
    upload: document.getElementById('audio-upload'),
    player: document.getElementById('audio-player'),
    songId: document.getElementById('song-id'),
    universeType: document.getElementById('universe-type'),
    genreName: document.getElementById('genre-name'),
    evolutionStage: document.getElementById('evolution-stage'),
    playCount: document.getElementById('play-count'),
    energyMeter: document.getElementById('energy-meter'),
    brightnessMeter: document.getElementById('brightness-meter'),
    complexityMeter: document.getElementById('complexity-meter'),
    energyValue: document.getElementById('energy-value'),
    brightnessValue: document.getElementById('brightness-value'),
    complexityValue: document.getElementById('complexity-value'),
    bpmValue: document.getElementById('bpm-value'),
    bassValue: document.getElementById('bass-value'),
    midsValue: document.getElementById('mids-value'),
    highsValue: document.getElementById('highs-value'),
    genreDescription: document.getElementById('genre-description'),
    deleteSong: document.getElementById('delete-song'),
    clearAll: document.getElementById('clear-all'),
    storageMessage: document.getElementById('storage-message'),
    canvasHint: document.getElementById('canvas-hint'),
    legendGenre: document.getElementById('legend-genre'),
    legendType: document.getElementById('legend-type'),
    canvas: document.getElementById('universe-canvas'),
  };

  const ctx = elements.canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  elements.upload.addEventListener('change', handleFileUpload);
  elements.player.addEventListener('play', handlePlaybackStart);
  // Unlock suspended audio contexts as soon as the user interacts anywhere.
  document.body.addEventListener('click', handleUserGestureResume, { passive: true });
  elements.player.addEventListener('pause', persistUniverseState);
  elements.player.addEventListener('ended', persistUniverseState);
  elements.deleteSong.addEventListener('click', deleteCurrentUniverse);
  elements.clearAll.addEventListener('click', clearAllUniverses);

  bootstrap();

  async function bootstrap() {
    showServingHintIfNeeded();
    await loadGenres();
    animate();
  }

  async function loadGenres() {
    try {
      const genres = await fetch(GENRES_URL).then((response) => response.json());
      state.genres = genres;
      state.genreMap = Object.fromEntries(genres.map((genre) => [genre.id, genre]));
      state.currentGenre = state.genreMap[DEFAULT_GENRE_ID] || genres[0];
      state.targetGenre = state.currentGenre;
      updateGenreUI();
    } catch (_error) {
      setStorageMessage(
        'Could not load genres.json. Start a local server (python3 -m http.server 8000) and open http://localhost:8000/.',
      );
      // Keep the app interactive even if genres.json is unavailable.
      const fallbackGenre = {
        id: DEFAULT_GENRE_ID,
        genre: 'Ambient / Drone',
        description: 'Fallback ambient profile loaded because genres.json was unavailable.',
        time_signature: 'Free time',
        physics_engine: {
          gravity_weight: 'Zero',
          friction: 'Low',
          motion_pattern: 'Drifting slow motion',
          collision_handling: 'Volumetric blending',
        },
        render_rules: {
          movement_style: 'Weightless hovering',
          geometry: 'Amorphous clouds',
          transitions: 'Slow morph',
        },
      };
      state.genres = [fallbackGenre];
      state.genreMap = { [DEFAULT_GENRE_ID]: fallbackGenre };
      state.currentGenre = fallbackGenre;
      state.targetGenre = fallbackGenre;
      updateGenreUI();
    }
  }

  function showServingHintIfNeeded() {
    if (window.location.protocol !== 'file:') return;
    const hint =
      'Detected file:// mode. Use python3 -m http.server 8000 and open http://localhost:8000/ to avoid browser security blocks.';
    setStorageMessage(hint);
    elements.canvasHint.textContent = hint;
  }

  async function handleFileUpload(event) {
    const [file] = event.target.files || [];
    if (!file) return;
    await ensureAudioPipeline();

    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
    }
    state.currentObjectUrl = URL.createObjectURL(file);
    elements.player.src = state.currentObjectUrl;
    elements.player.load();
    await waitForAudioLoadedData(elements.player);

    const songId = await makeSongId(file);
    state.currentSongId = songId;

    const existingUniverse = loadUniverse(songId);
    if (existingUniverse) {
      state.currentUniverse = hydrateUniverse(existingUniverse, file.name);
      state.currentGenre = state.genreMap[state.currentUniverse.genreId] || state.currentGenre;
      state.targetGenre = state.currentGenre;
      setStorageMessage(`Loaded saved ${state.currentUniverse.type} universe for ${file.name}.`);
    } else {
      const audioBuffer = await decodeFile(file);
      const dna = analyzeSongDNA(audioBuffer);
      const type = assignUniverseType(dna);
      const genreId = assignBaseGenre(dna);
      state.currentUniverse = createUniverse(songId, file.name, dna, type, genreId);
      state.currentGenre = state.genreMap[genreId] || state.currentGenre;
      state.targetGenre = state.currentGenre;
      saveUniverse(state.currentUniverse);
      setStorageMessage(`Created a new ${type} universe for ${file.name}.`);
    }

    syncUniverseToScene();
    updateInterface();

    try {
      await elements.player.play();
    } catch (_error) {
      elements.canvasHint.textContent = 'Press play to start the universe visualization.';
    }
  }

  async function handlePlaybackStart() {
    await ensureAudioPipeline();
    if (state.audioContext?.state === 'suspended') {
      await state.audioContext.resume();
    }

    if (state.currentUniverse) {
      state.currentUniverse.playCount += 1;
      state.currentUniverse.lastPlayedAt = new Date().toISOString();
      saveUniverse(state.currentUniverse);
      updateInterface();
    }
  }

  async function ensureAudioPipeline() {
    if (!state.audioContext) {
      state.audioContext = new AudioContext();
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = FFT_SIZE;
      state.analyser.smoothingTimeConstant = SMOOTHING;
      state.frequencyData = new Uint8Array(state.analyser.frequencyBinCount);
      state.timeData = new Uint8Array(state.analyser.fftSize);
    }

    if (!state.sourceNode) {
      state.sourceNode = state.audioContext.createMediaElementSource(elements.player);
      // Keep analyzer connected to the destination so realtime data updates while audio plays.
      state.sourceNode.connect(state.analyser);
      state.analyser.connect(state.audioContext.destination);
    }
  }

  async function handleUserGestureResume() {
    if (!state.audioContext) return;
    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }
  }

  async function decodeFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    // Primary path: decode with the active AudioContext when available.
    if (state.audioContext) {
      return state.audioContext.decodeAudioData(arrayBuffer.slice(0));
    }
    // Fallback path: use an offline context before user playback starts.
    const offlineContext = new OfflineAudioContext(1, 44100 * 40, 44100);
    return offlineContext.decodeAudioData(arrayBuffer.slice(0));
  }

  function waitForAudioLoadedData(audioElement) {
    return new Promise((resolve, reject) => {
      if (audioElement.readyState >= 2) {
        resolve();
        return;
      }

      const onLoadedData = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Failed to load audio data from selected file.'));
      };
      const cleanup = () => {
        audioElement.removeEventListener('loadeddata', onLoadedData);
        audioElement.removeEventListener('error', onError);
      };

      audioElement.addEventListener('loadeddata', onLoadedData, { once: true });
      audioElement.addEventListener('error', onError, { once: true });
    });
  }

  function analyzeSongDNA(audioBuffer) {
    const channelData = audioBuffer.getChannelData(0);
    const sampleStep = Math.max(1, Math.floor(channelData.length / 12000));
    let total = 0;
    let peaks = 0;
    let zeroCrossings = 0;
    let previous = channelData[0] || 0;

    for (let index = 0; index < channelData.length; index += sampleStep) {
      const current = channelData[index];
      total += Math.abs(current);
      if (Math.abs(current) > 0.68) peaks += 1;
      if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) {
        zeroCrossings += 1;
      }
      previous = current;
    }

    const sampledLength = channelData.length / sampleStep;
    const energy = clamp(total / sampledLength, 0, 1);
    const brightness = clamp((zeroCrossings / sampledLength) * 8, 0, 1);
    const complexity = clamp((peaks / sampledLength) * 10 + brightness * 0.35, 0, 1);
    return { energy, brightness, complexity };
  }

  function assignUniverseType(dna) {
    const { energy, brightness, complexity } = dna;
    if (energy < 0.2 && brightness < 0.25) return 'void';
    if (brightness > 0.72 && energy > 0.52) return 'warp';
    if (complexity > 0.74) return 'fractal';
    if (energy > 0.62) return 'orbital';
    return 'nebula';
  }

  function assignBaseGenre(dna) {
    if (dna.energy < 0.15) return 'ambient_drone';
    if (dna.energy > 0.65 && dna.brightness > 0.55) return 'rock_metal';
    if (dna.complexity > 0.72) return 'jazz_bebop';
    if (dna.energy > 0.55) return 'techno_minimalist';
    return 'blues';
  }

  function createUniverse(songId, fileName, dna, type, genreId) {
    const seed = hashString(`${songId}:${fileName}:${type}:${genreId}`);
    return {
      id: songId,
      fileName,
      type,
      genreId,
      dna,
      createdAt: new Date().toISOString(),
      lastPlayedAt: null,
      playCount: 0,
      evolutionStage: 1,
      age: 0,
      hueShift: seed % 360,
      orbitCount: 3 + (seed % 5),
      particleBias: ((seed >> 3) % 100) / 100,
      genreHistory: [genreId],
      seed,
    };
  }

  function hydrateUniverse(universe, fileName) {
    return {
      ...universe,
      fileName: fileName || universe.fileName,
      dna: universe.dna || { energy: 0.3, brightness: 0.3, complexity: 0.3 },
      genreId: universe.genreId || DEFAULT_GENRE_ID,
      evolutionStage: universe.evolutionStage || 1,
      age: universe.age || 0,
      playCount: universe.playCount || 0,
      orbitCount: universe.orbitCount || 4,
      particleBias: universe.particleBias ?? 0.5,
      genreHistory: universe.genreHistory || [universe.genreId || DEFAULT_GENRE_ID],
      seed: universe.seed || hashString(universe.id),
      hueShift: universe.hueShift || 0,
    };
  }

  function syncUniverseToScene() {
    if (!state.currentUniverse) return;
    const { orbitCount, dna, particleBias, seed } = state.currentUniverse;
    const rng = mulberry32(seed);

    state.orbiters = Array.from({ length: orbitCount }, (_, index) => ({
      radius: 55 + index * (34 + dna.energy * 28),
      size: 6 + rng() * 12 + dna.brightness * 8,
      speed: 0.002 + rng() * 0.006 + dna.complexity * 0.005,
      angle: rng() * Math.PI * 2,
      trail: 0.08 + rng() * 0.2,
      wobble: rng() * Math.PI * 2,
    }));

    const baseParticleCount = getAdaptiveParticleCount(120 + Math.round(particleBias * 110));
    state.particles = Array.from({ length: baseParticleCount }, () => ({
      x: rng(),
      y: rng(),
      radius: 0.6 + rng() * 3,
      alpha: 0.1 + rng() * 0.4,
      vx: (rng() - 0.5) * 0.003,
      vy: (rng() - 0.5) * 0.003,
      drift: (rng() - 0.5) * (0.001 + dna.energy * 0.003),
      pulse: rng() * Math.PI * 2,
      mass: 0.6 + rng() * 1.4,
      hue: (state.currentUniverse.hueShift + rng() * 90) % 360,
    }));
  }

  function animate(timestamp = 0) {
    requestAnimationFrame(animate);
    if (timestamp - state.lastFrameTime < TARGET_FRAME_MS) return;
    state.lastFrameTime = timestamp;

    const width = getCanvasWidth();
    const height = getCanvasHeight();
    const centerX = width / 2;
    const centerY = height / 2;

    updateAudioFeatures();
    updateGenre();
    updateWorldPhysics();

    drawBackground(width, height);
    drawStarField(width, height);

    if (!state.currentUniverse) {
      drawIdleState(width, height);
      return;
    }

    const universe = state.currentUniverse;
    universe.age += 0.004 + state.audioFeatures.energy * 0.016;
    universe.evolutionStage = Math.max(1, Math.floor(universe.playCount / 2) + 1 + Math.floor(universe.age / 30));
    universe.genreId = state.currentGenre?.id || universe.genreId;

    drawUniverseCore(centerX, centerY, universe);
    updateParticles(width, height);
    drawParticles(width, height, universe);
    drawOrbiters(centerX, centerY, universe);
    drawFrequencyHalo(centerX, centerY, universe);
    drawGeometryOverlay(centerX, centerY, width, height, universe);

    saveUniverseThrottled(universe);
    updateInterface(false);
  }

  function updateAudioFeatures() {
    if (!state.analyser || elements.player.paused) {
      dampAudioFeatures();
      return;
    }
    if (!state.frequencyData || state.frequencyData.length === 0) {
      return;
    }

    state.analyser.getByteFrequencyData(state.frequencyData);
    state.analyser.getByteTimeDomainData(state.timeData);

    const bins = state.frequencyData.length;
    let bass = 0;
    let mids = 0;
    let highs = 0;

    for (let index = 0; index < bins; index += 1) {
      const value = state.frequencyData[index];
      if (index < 50) bass += value;
      else if (index < 150) mids += value;
      else highs += value;
    }

    const bassNorm = clamp(bass / 50 / 255, 0, 1);
    const midsNorm = clamp(mids / 100 / 255, 0, 1);
    const highsNorm = clamp(highs / Math.max(1, bins - 150) / 255, 0, 1);
    const energy = clamp((bassNorm + midsNorm + highsNorm) / 3, 0, 1);
    const peak = Math.max(...state.frequencyData) / 255;
    const complexity = clamp(calculateVariance(state.frequencyData) / 1800, 0, 1);

    state.audioFeatures = {
      bpm: estimateBpm(bassNorm),
      energy,
      bass: bassNorm,
      mids: midsNorm,
      highs: highsNorm,
    };

    state.liveMetrics = {
      energy,
      brightness: highsNorm,
      complexity,
      peak,
    };
  }

  function dampAudioFeatures() {
    if (state.currentUniverse && state.audioFeatures.energy < 0.015) {
      // Keep visuals subtly alive on extremely silent or short tracks.
      const noise = (Math.random() - 0.5) * 0.008;
      state.audioFeatures.energy = clamp(0.02 + noise, 0.01, 0.04);
      state.audioFeatures.bass = clamp(0.018 + noise, 0.005, 0.04);
      state.audioFeatures.mids = clamp(0.017 - noise, 0.005, 0.04);
      state.audioFeatures.highs = clamp(0.016 + noise * 0.8, 0.005, 0.04);
    }

    state.audioFeatures = {
      bpm: Math.max(0, state.audioFeatures.bpm * 0.95),
      energy: state.audioFeatures.energy * 0.92,
      bass: state.audioFeatures.bass * 0.92,
      mids: state.audioFeatures.mids * 0.92,
      highs: state.audioFeatures.highs * 0.92,
    };
    state.liveMetrics = {
      energy: state.liveMetrics.energy * 0.92,
      brightness: state.liveMetrics.brightness * 0.92,
      complexity: state.liveMetrics.complexity * 0.92,
      peak: state.liveMetrics.peak * 0.94,
    };
  }

  function updateGenre() {
    if (!state.currentGenre || !state.genreMap || !state.currentUniverse) return;

    const detectedId = detectGenre(state.audioFeatures);
    if (!state.targetGenre || detectedId !== state.targetGenre.id) {
      state.targetGenre = state.genreMap[detectedId] || state.currentGenre;
      state.blendFactor = 0;
    }

    state.blendFactor = Math.min(1, state.blendFactor + 0.02);
    state.currentGenre = blendGenres(state.currentGenre, state.targetGenre, state.blendFactor);

    if (state.targetGenre?.id && state.blendFactor >= 1) {
      state.currentUniverse.genreId = state.targetGenre.id;
      if (state.currentUniverse.genreHistory.at(-1) !== state.targetGenre.id) {
        state.currentUniverse.genreHistory.push(state.targetGenre.id);
      }
    }
  }

  function detectGenre(features) {
    if (features.energy < 0.15) return 'ambient_drone';
    if (features.bass > 0.6 && features.energy > 0.5) return 'techno_minimalist';
    if (features.bass > 0.7 && features.mids < 0.4) return 'hiphop_boombap';
    if (features.highs > 0.6 && features.energy > 0.6) return 'rock_metal';
    if (features.mids > 0.5 && features.highs > 0.4) return 'jazz_bebop';
    if (features.bass > 0.48 && features.highs < 0.3) return 'reggae_dub';
    if (features.mids > 0.55 && features.energy < 0.55) return 'waltz_romantic';
    if (features.highs > 0.5 && features.mids > 0.52 && features.bass > 0.38) return 'mathrock_prog';
    return 'blues';
  }

  function blendGenres(sourceGenre, targetGenre, blendFactor) {
    if (!sourceGenre || !targetGenre) return sourceGenre || targetGenre;
    const t = clamp(blendFactor, 0, 1);
    return {
      id: t < 1 ? sourceGenre.id : targetGenre.id,
      genre: t < 0.5 ? sourceGenre.genre : targetGenre.genre,
      description: t < 0.5 ? sourceGenre.description : targetGenre.description,
      time_signature: t < 0.5 ? sourceGenre.time_signature : targetGenre.time_signature,
      physics_engine: {
        gravity_weight: t < 0.5 ? sourceGenre.physics_engine.gravity_weight : targetGenre.physics_engine.gravity_weight,
        friction: lerpFriction(sourceGenre.physics_engine.friction, targetGenre.physics_engine.friction, t),
        motion_pattern: t < 0.5 ? sourceGenre.physics_engine.motion_pattern : targetGenre.physics_engine.motion_pattern,
        collision_handling: t < 0.5 ? sourceGenre.physics_engine.collision_handling : targetGenre.physics_engine.collision_handling,
      },
      render_rules: {
        movement_style: t < 0.5 ? sourceGenre.render_rules.movement_style : targetGenre.render_rules.movement_style,
        geometry: t < 0.5 ? sourceGenre.render_rules.geometry : targetGenre.render_rules.geometry,
        transitions: t < 0.5 ? sourceGenre.render_rules.transitions : targetGenre.render_rules.transitions,
      },
    };
  }

  function updateWorldPhysics() {
    if (!state.currentGenre) return;
    applyGenre(state.currentGenre, state.audioFeatures);
  }

  function applyGenre(genre, audio) {
    const physics = genre.physics_engine;
    const render = genre.render_rules;
    state.world.gravity = resolveGravity(physics.gravity_weight, audio);
    state.world.friction = resolveFriction(physics.friction);
    applyMotionPattern(physics.motion_pattern, audio);
    applyMovementStyle(render.movement_style, audio);
    applyGeometry(render.geometry, audio);
    applyTransitions(render.transitions, audio);
  }

  function resolveGravity(type, audio) {
    switch (type) {
      case 'Zero':
        return 0;
      case 'Heavy vertical pulse':
        return Math.sin(performance.now() * 0.01) * audio.bass * 5;
      case 'Extreme':
        return audio.bass * 15;
      case 'Light/Elastic':
        return Math.sin(performance.now() * 0.002) * 2;
      case 'Dynamic/Variable':
        return audio.energy * 10;
      case 'Submerged/Buoyant':
        return Math.sin(performance.now() * 0.003) * audio.bass * 3;
      case 'Constantly shifting axis':
        return (Math.sin(performance.now() * 0.006) + Math.cos(performance.now() * 0.004)) * 4;
      case 'Heavy':
        return 8 + audio.bass * 5;
      default:
        return 2 + audio.energy * 4;
    }
  }

  function resolveFriction(type) {
    if (typeof type === 'number') return type;
    const normalized = String(type).toLowerCase();
    if (normalized.includes('zero') || normalized.includes('none')) return 0.004;
    if (normalized.includes('low')) return 0.012;
    if (normalized.includes('variable')) return 0.02 + Math.sin(performance.now() * 0.0015) * 0.008;
    if (normalized.includes('high')) return 0.045;
    return 0.02;
  }

  function applyMotionPattern(pattern, audio) {
    state.world.pulse = 1 + audio.bass * 0.35;
    state.world.forwardDrift = 0;
    state.world.axisTilt = 0;

    if (pattern.includes('Elastic snapping')) {
      state.particles.forEach((particle, index) => {
        particle.vx += Math.sin(performance.now() * 0.002 + index) * audio.highs * 0.0008;
        particle.vy += Math.cos(performance.now() * 0.002 + index) * audio.highs * 0.0008;
      });
    }

    if (pattern.includes('Pulsing')) {
      state.world.scale = 1 + audio.bass * 0.2;
    } else {
      state.world.scale = 1;
    }

    if (pattern.includes('Driving forward')) {
      state.world.forwardDrift = audio.energy * 45;
    }

    if (pattern.includes('Delayed buoyant bob')) {
      state.world.axisTilt = Math.sin(performance.now() * 0.0012) * 0.18;
    }

    if (pattern.includes('Cyclical swooping')) {
      state.world.axisTilt = Math.sin(performance.now() * 0.0009) * 0.28;
    }

    if (pattern.includes('Stuttering')) {
      state.world.axisTilt = Math.sin(performance.now() * 0.005) * audio.highs * 0.45;
    }
  }

  function applyMovementStyle(style, audio) {
    const lower = style.toLowerCase();
    state.world.movementStyle = 'hover';
    if (lower.includes('machine-like') || lower.includes('precision')) state.world.movementStyle = 'mechanical';
    if (lower.includes('weighty') || lower.includes('swaggering')) state.world.movementStyle = 'sway';
    if (lower.includes('aggressive') || lower.includes('explosive')) state.world.movementStyle = 'eruption';
    if (lower.includes('graceful') || lower.includes('rotation')) state.world.movementStyle = 'orbital';
    if (lower.includes('jittery') || lower.includes('angular')) state.world.movementStyle = 'glitch';
    if (lower.includes('ethereal') || lower.includes('hovering')) state.world.movementStyle = 'float';
    state.world.scale *= 1 + audio.energy * 0.04;
  }

  function applyGeometry(type, audio) {
    const lower = type.toLowerCase();
    state.world.geometryMode = 'clouds';
    if (lower.includes('fractal') || lower.includes('polygram')) state.world.geometryMode = 'fractals';
    if (lower.includes('cube') || lower.includes('grid') || lower.includes('wireframe')) state.world.geometryMode = 'cubes';
    if (lower.includes('blob') || lower.includes('amorphous') || lower.includes('rounded')) state.world.geometryMode = 'blobs';
    if (lower.includes('ring') || lower.includes('ellipse') || lower.includes('spiral')) state.world.geometryMode = 'rings';
    if (lower.includes('triangle') || lower.includes('spike') || lower.includes('polygon')) state.world.geometryMode = 'spikes';
    state.world.pulse += audio.mids * 0.25;
  }

  function applyTransitions(style, audio) {
    const lower = style.toLowerCase();
    state.world.transitionStyle = 'morph';
    if (lower.includes('hard cuts') || lower.includes('strobing')) state.world.transitionStyle = 'strobe';
    if (lower.includes('shattering')) state.world.transitionStyle = 'shatter';
    if (lower.includes('cross-fading') || lower.includes('fluid')) state.world.transitionStyle = 'crossfade';
    if (lower.includes('dissolving')) state.world.transitionStyle = 'dissolve';
    if (lower.includes('glitch')) state.world.transitionStyle = 'glitch';
    if (lower.includes('slow')) state.world.transitionStyle = 'drift';
    state.world.pulse += audio.highs * 0.12;
  }

  function updateParticles(width, height) {
    const gravityInfluence = state.world.gravity * 0.00002;
    const friction = 1 - state.world.friction;
    const tilt = state.world.axisTilt;

    state.particles.forEach((particle, index) => {
      if (state.world.movementStyle === 'sway') {
        particle.vx += Math.sin(performance.now() * 0.001 + index * 0.1) * 0.0002;
      }
      if (state.world.movementStyle === 'glitch') {
        particle.vx += (Math.random() - 0.5) * state.audioFeatures.highs * 0.0015;
        particle.vy += (Math.random() - 0.5) * state.audioFeatures.highs * 0.0015;
      }
      if (state.world.movementStyle === 'eruption') {
        particle.vx += (particle.x - 0.5) * state.audioFeatures.energy * 0.0003;
        particle.vy += (particle.y - 0.5) * state.audioFeatures.energy * 0.0003;
      }

      particle.vx += Math.sin(tilt + index) * 0.00003;
      particle.vy += gravityInfluence * particle.mass + particle.drift;
      particle.vx *= friction;
      particle.vy *= friction;
      particle.x = (particle.x + particle.vx + 1) % 1;
      particle.y = (particle.y + particle.vy + 1) % 1;

      if (state.world.transitionStyle === 'strobe' && index % 7 === 0) {
        particle.alpha = 0.05 + Math.random() * 0.7;
      }

      particle.screenX = particle.x * width;
      particle.screenY = particle.y * height;
    });
  }

  function drawBackground(width, height) {
    const hue = state.currentUniverse ? state.currentUniverse.hueShift : 220;
    const energy = state.audioFeatures.energy;
    const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, width * 0.08, width * 0.5, height * 0.5, width * 0.75);
    gradient.addColorStop(0, `hsla(${hue}, 85%, ${16 + energy * 20}%, 0.40)`);
    gradient.addColorStop(1, 'rgba(3, 6, 18, 0.94)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStarField(width, height) {
    state.stars.forEach((star) => {
      const twinkle = 0.25 + Math.sin(performance.now() * 0.001 * star.speed + star.phase) * 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha + twinkle})`;
      ctx.beginPath();
      ctx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawIdleState(width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 34px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Upload a song to generate its universe', width / 2, height / 2 - 12);
    ctx.fillStyle = 'rgba(170,180,222,0.88)';
    ctx.font = '400 18px Inter, sans-serif';
    ctx.fillText('The scene will adapt to song DNA, live audio features, and genre-blended physics.', width / 2, height / 2 + 24);
    ctx.restore();
  }

  function drawUniverseCore(cx, cy, universe) {
    const combinedEnergy = universe.dna.energy * 0.5 + state.audioFeatures.energy * 0.5;
    const coreRadius = (42 + universe.evolutionStage * 10 + combinedEnergy * 60) * state.world.scale;
    const hue = (universe.hueShift + state.audioFeatures.highs * 160) % 360;
    const color = TYPE_COLORS[universe.type] || '#78d6ff';
    const glow = ctx.createRadialGradient(cx, cy, coreRadius * 0.2, cx, cy, coreRadius * 2);
    glow.addColorStop(0, hexToRgba(color, 0.95));
    glow.addColorStop(0.6, `hsla(${hue}, 90%, 60%, 0.35)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius * 2, 0, Math.PI * 2);
    ctx.fill();

    if (state.world.geometryMode === 'blobs' || universe.type === 'nebula' || universe.type === 'void') {
      drawNebulaClouds(cx, cy, coreRadius, universe);
    }

    ctx.fillStyle = `hsla(${hue}, 95%, 72%, 0.92)`;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawNebulaClouds(cx, cy, baseRadius, universe) {
    const layers = universe.type === 'void' ? 3 : 6;
    for (let index = 0; index < layers; index += 1) {
      const angle = universe.age * 0.7 + index * 1.3;
      const radius = baseRadius * (1.2 + index * 0.2);
      const x = cx + Math.cos(angle) * radius * 0.4;
      const y = cy + Math.sin(angle) * radius * 0.24;
      ctx.fillStyle = `hsla(${(universe.hueShift + index * 18) % 360}, 90%, ${34 + index * 6}%, ${0.06 + index * 0.03})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(_width, _height, universe) {
    const brightness = 0.35 + state.audioFeatures.highs * 1.2;
    state.particles.forEach((particle, index) => {
      const pulse = Math.sin(universe.age * 2 + particle.pulse + index * 0.03);
      const alpha = clamp(particle.alpha * brightness + pulse * 0.05, 0.02, 0.95);
      const radius = particle.radius + pulse * 0.4 + state.audioFeatures.highs * 1.5;
      ctx.fillStyle = `hsla(${particle.hue}, 95%, 74%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.screenX, particle.screenY, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawOrbiters(cx, cy, universe) {
    state.orbiters.forEach((orbiter, index) => {
      const motionScale = 1 + state.audioFeatures.energy * 0.4;
      orbiter.angle += orbiter.speed * motionScale;
      const radiusMod = state.world.movementStyle === 'mechanical' ? Math.sin(universe.age * 3 + index) * 18 : 0;
      const radius = orbiter.radius + radiusMod + state.world.forwardDrift * 0.2;
      const x = cx + Math.cos(orbiter.angle + state.world.axisTilt) * radius;
      const y = cy + Math.sin(orbiter.angle * (state.world.geometryMode === 'fractals' ? 1.6 : 1) + orbiter.wobble) * radius * 0.6;

      ctx.strokeStyle = `rgba(255,255,255,${orbiter.trail})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius, radius * 0.6, universe.age * 0.15 + state.world.axisTilt, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `hsla(${(universe.hueShift + index * 35) % 360}, 95%, 72%, 0.95)`;
      ctx.beginPath();
      ctx.arc(x, y, orbiter.size + state.liveMetrics.peak * 6, 0, Math.PI * 2);
      ctx.fill();

      if (state.world.geometryMode === 'fractals') {
        drawFractalBranches(x, y, orbiter.size, universe, index);
      }
    });
  }

  function drawFractalBranches(x, y, size, universe, branchIndex) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(state.world.axisTilt);
    ctx.strokeStyle = `hsla(${(universe.hueShift + branchIndex * 40) % 360}, 90%, 76%, 0.35)`;
    ctx.lineWidth = 1.1;
    for (let index = 0; index < 6; index += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(size * 4, 0);
      ctx.lineTo(size * 5.1, size * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrequencyHalo(cx, cy, universe) {
    if (!state.frequencyData) return;
    const bars = 120;
    const radius = 145 + universe.evolutionStage * 10;
    const angleStep = (Math.PI * 2) / bars;
    ctx.save();
    ctx.translate(cx, cy);
    for (let index = 0; index < bars; index += 1) {
      const binIndex = Math.floor((index / bars) * state.frequencyData.length);
      const amplitude = (state.frequencyData[binIndex] || 0) / 255;
      const barLength = 24 + amplitude * (118 + universe.dna.brightness * 70);
      const angle = index * angleStep + universe.age * 0.18;
      const hue = (universe.hueShift + index * 1.8 + amplitude * 120) % 360;
      ctx.strokeStyle = `hsla(${hue}, 92%, ${55 + amplitude * 30}%, ${0.24 + amplitude * 0.55})`;
      ctx.lineWidth = 1.5 + amplitude * 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.lineTo(Math.cos(angle) * (radius + barLength), Math.sin(angle) * (radius + barLength));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGeometryOverlay(cx, cy, width, height, universe) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.world.axisTilt);
    ctx.globalAlpha = 0.3 + state.audioFeatures.energy * 0.28;

    switch (state.world.geometryMode) {
      case 'cubes':
        drawCubeGrid(width, height, universe);
        break;
      case 'rings':
        drawRings(universe);
        break;
      case 'spikes':
        drawSpikes(universe);
        break;
      case 'fractals':
        drawFractalMesh(universe);
        break;
      case 'blobs':
        drawBlobField(universe);
        break;
      default:
        drawFogBands(width, height, universe);
        break;
    }

    ctx.restore();
  }

  function drawCubeGrid(width, height, universe) {
    const spacing = 36 + state.audioFeatures.bass * 48;
    ctx.strokeStyle = `hsla(${universe.hueShift}, 88%, 70%, 0.28)`;
    for (let x = -width / 2; x < width / 2; x += spacing) {
      for (let y = -height / 2; y < height / 2; y += spacing) {
        const size = spacing * (0.5 + state.audioFeatures.energy * 0.6);
        ctx.strokeRect(x, y, size, size);
      }
    }
  }

  function drawRings(universe) {
    for (let index = 0; index < 5; index += 1) {
      const radius = 110 + index * 38 + Math.sin(universe.age * 1.5 + index) * 15;
      ctx.strokeStyle = `hsla(${(universe.hueShift + index * 16) % 360}, 90%, 74%, 0.24)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (0.45 + index * 0.04), universe.age * 0.2 + index * 0.3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawSpikes(universe) {
    const spikes = 28;
    for (let index = 0; index < spikes; index += 1) {
      const angle = (Math.PI * 2 * index) / spikes + universe.age * 0.3;
      const inner = 90;
      const outer = 180 + state.audioFeatures.highs * 120;
      ctx.strokeStyle = `hsla(${(universe.hueShift + index * 7) % 360}, 95%, 70%, 0.32)`;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
  }

  function drawFractalMesh(universe) {
    const branches = 10;
    for (let index = 0; index < branches; index += 1) {
      const angle = (Math.PI * 2 * index) / branches + universe.age * 0.1;
      ctx.save();
      ctx.rotate(angle);
      ctx.strokeStyle = `hsla(${(universe.hueShift + index * 22) % 360}, 90%, 76%, 0.2)`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(150, 0);
      ctx.lineTo(190, 25);
      ctx.lineTo(210, -8);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBlobField(universe) {
    for (let index = 0; index < 5; index += 1) {
      const radius = 90 + index * 28 + state.audioFeatures.energy * 22;
      ctx.fillStyle = `hsla(${(universe.hueShift + index * 25) % 360}, 85%, 68%, 0.08)`;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(universe.age + index) * 38,
        Math.sin(universe.age * 0.8 + index) * 24,
        radius,
        radius * (0.5 + Math.sin(universe.age + index) * 0.1),
        universe.age * 0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  function drawFogBands(width, height, universe) {
    for (let index = 0; index < 6; index += 1) {
      const y = -height * 0.3 + index * (height * 0.12);
      ctx.fillStyle = `hsla(${(universe.hueShift + index * 15) % 360}, 80%, 65%, 0.05)`;
      ctx.fillRect(-width / 2, y + Math.sin(universe.age + index) * 20, width, 42);
    }
  }

  function updateInterface(updateMeters = true) {
    const universe = state.currentUniverse;
    const genre = state.currentGenre;
    if (!universe) return;

    elements.songId.textContent = universe.id;
    elements.universeType.textContent = universe.type;
    elements.evolutionStage.textContent = String(universe.evolutionStage);
    elements.playCount.textContent = String(universe.playCount);
    elements.canvasHint.textContent = `Universe reacts to live audio, stored state, and genre-blended rules.`;
    elements.legendType.textContent = universe.type;
    elements.deleteSong.disabled = false;

    if (updateMeters) {
      paintMeter(elements.energyMeter, elements.energyValue, universe.dna.energy);
      paintMeter(elements.brightnessMeter, elements.brightnessValue, universe.dna.brightness);
      paintMeter(elements.complexityMeter, elements.complexityValue, universe.dna.complexity);
    }

    elements.bpmValue.textContent = String(Math.round(state.audioFeatures.bpm || 0));
    elements.bassValue.textContent = formatPercent(state.audioFeatures.bass);
    elements.midsValue.textContent = formatPercent(state.audioFeatures.mids);
    elements.highsValue.textContent = formatPercent(state.audioFeatures.highs);

    if (genre) {
      elements.genreName.textContent = genre.genre;
      elements.genreDescription.textContent = genre.render_rules.movement_style;
      elements.legendGenre.textContent = genre.id;
    }
  }

  function updateGenreUI() {
    if (!state.currentGenre) return;
    elements.genreName.textContent = state.currentGenre.genre;
    elements.genreDescription.textContent = state.currentGenre.render_rules.movement_style;
    elements.legendGenre.textContent = state.currentGenre.id;
  }

  function paintMeter(bar, label, value) {
    const percent = `${Math.round(value * 100)}%`;
    bar.style.width = percent;
    label.textContent = percent;
  }

  function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
  }

  function loadUniverse(songId) {
    return readUniverseStore()[songId] || null;
  }

  function saveUniverse(universe) {
    const allUniverses = readUniverseStore();
    allUniverses[universe.id] = universe;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allUniverses));
  }

  function saveUniverseThrottled(universe) {
    const now = performance.now();
    if (now - state.lastPersistTime < 1500) return;
    state.lastPersistTime = now;
    saveUniverse(universe);
  }

  function persistUniverseState() {
    if (state.currentUniverse) saveUniverse(state.currentUniverse);
  }

  function deleteCurrentUniverse() {
    if (!state.currentSongId) return;
    const allUniverses = readUniverseStore();
    delete allUniverses[state.currentSongId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allUniverses));
    setStorageMessage(`Deleted stored universe ${state.currentSongId}.`);
    resetCurrentUniverse();
  }

  function clearAllUniverses() {
    localStorage.removeItem(STORAGE_KEY);
    setStorageMessage('Cleared every stored universe from localStorage.');
    resetCurrentUniverse();
  }

  function resetCurrentUniverse() {
    state.currentSongId = null;
    state.currentUniverse = null;
    state.orbiters = [];
    state.particles = [];
    state.audioFeatures = { bpm: 0, energy: 0, bass: 0, mids: 0, highs: 0 };
    if (state.currentObjectUrl) {
      URL.revokeObjectURL(state.currentObjectUrl);
      state.currentObjectUrl = null;
    }
    elements.upload.value = '';
    elements.player.pause();
    elements.player.removeAttribute('src');
    elements.player.load();
    elements.songId.textContent = 'Waiting for upload';
    elements.universeType.textContent = '—';
    elements.evolutionStage.textContent = '0';
    elements.playCount.textContent = '0';
    elements.legendType.textContent = 'nebula';
    paintMeter(elements.energyMeter, elements.energyValue, 0);
    paintMeter(elements.brightnessMeter, elements.brightnessValue, 0);
    paintMeter(elements.complexityMeter, elements.complexityValue, 0);
    elements.bpmValue.textContent = '0';
    elements.bassValue.textContent = '0%';
    elements.midsValue.textContent = '0%';
    elements.highsValue.textContent = '0%';
    elements.deleteSong.disabled = true;
    elements.canvasHint.textContent = 'Upload a track to ignite the cosmos.';
    state.currentGenre = state.genreMap[DEFAULT_GENRE_ID] || null;
    state.targetGenre = state.currentGenre;
    updateGenreUI();
  }

  function readUniverseStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_error) {
      return {};
    }
  }

  async function makeSongId(file) {
    const chunk = await file.slice(0, 1024 * 512).arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', chunk);
    const digest = Array.from(new Uint8Array(hashBuffer))
      .slice(0, 8)
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    return `${sanitizeFileName(file.name)}-${digest}`;
  }

  function sanitizeFileName(fileName) {
    return fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  }

  function estimateBpm(bassLevel) {
    const pulse = Math.abs(Math.sin(performance.now() * 0.0025));
    return clamp(72 + bassLevel * 90 + pulse * 18, 60, 180);
  }

  function setStorageMessage(message) {
    elements.storageMessage.textContent = message;
  }

  function createStarField(count) {
    return Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: Math.random() * 1.4 + 0.2,
      alpha: Math.random() * 0.4 + 0.08,
      speed: Math.random() * 1.8 + 0.4,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function calculateVariance(array) {
    let total = 0;
    let mean = 0;
    for (let index = 0; index < array.length; index += 1) {
      mean += array[index];
    }
    mean /= array.length;
    for (let index = 0; index < array.length; index += 1) {
      total += (array[index] - mean) ** 2;
    }
    return total / array.length;
  }

  function getCanvasWidth() {
    return elements.canvas.width / (window.devicePixelRatio || 1);
  }

  function getCanvasHeight() {
    return elements.canvas.height / (window.devicePixelRatio || 1);
  }

  function getAdaptiveParticleCount(desiredCount) {
    const viewportWidth = window.innerWidth || 1280;
    if (viewportWidth <= 640) return Math.max(50, Math.floor(desiredCount * 0.5));
    if (viewportWidth <= 960) return Math.max(70, Math.floor(desiredCount * 0.72));
    return desiredCount;
  }

  function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = elements.canvas.getBoundingClientRect();
    const width = Math.max(640, Math.floor(rect.width || 1280));
    const height = Math.max(360, Math.floor(rect.height || 720));
    elements.canvas.width = width * ratio;
    elements.canvas.height = height * ratio;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
  }

  function lerpFriction(a, b, t) {
    const map = { zero: 0.004, none: 0.004, low: 0.012, variable: 0.022, high: 0.045 };
    const valueA = map[String(a).toLowerCase().split(' ')[0]] ?? resolveFriction(a);
    const valueB = map[String(b).toLowerCase().split(' ')[0]] ?? resolveFriction(b);
    return valueA + (valueB - valueA) * t;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    return function random() {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgba(hex, alpha) {
    const parsed = hex.replace('#', '');
    const bigint = Number.parseInt(parsed, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
})();
