(() => {
  'use strict';

  const STORAGE_KEY = 'loading.sfx';
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch (_) {
      return false;
    }
  }

  function setEnabled(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'on' : 'off');
    } catch (_) {}
    updateSfxButtonUI(val);
  }

  function toggle() {
    const next = !isEnabled();
    setEnabled(next);
    if (next) {
      getAudioContext();
      play('toggle');
    }
    return next;
  }

  function play(name) {
    if (!isEnabled()) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.12, now);
    master.connect(ctx.destination);

    if (name === 'click') {
      // Clique mecânico curto (noise burst filtrado)
      const bufferSize = ctx.sampleRate * 0.02;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.5, now);

      master.gain.setValueAtTime(0.08, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      noise.connect(filter);
      filter.connect(master);
      noise.start(now);
      noise.stop(now + 0.02);
      return;
    }

    if (name === 'toggle') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.04);
      master.gain.setValueAtTime(0.06, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.08);
      return;
    }

    if (name === 'success') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.05); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.10); // G5
      master.gain.setValueAtTime(0.07, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.22);
      return;
    }

    if (name === 'error') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15);
      master.gain.setValueAtTime(0.08, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.15);
      return;
    }

    if (name === 'badge') {
      const notes = [587.33, 739.99, 880, 1174.66]; // D5, F#5, A5, D6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        g.gain.setValueAtTime(0.09, now + idx * 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.18);
      });
      return;
    }

    if (name === 'eat') {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(950, now + 0.06);
      master.gain.setValueAtTime(0.07, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.06);
      return;
    }

    if (name === 'die') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.25);
      master.gain.setValueAtTime(0.12, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.25);
      return;
    }

    if (name === 'start') {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.07);
      master.gain.setValueAtTime(0.08, now);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(master);
      osc.start(now);
      osc.stop(now + 0.18);
      return;
    }
  }

  function updateSfxButtonUI(enabled) {
    const btn = document.getElementById('sfx-btn');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.setAttribute('aria-label', enabled ? 'Desativar feedback sonoro' : 'Ativar feedback sonoro');
    btn.setAttribute('title', enabled ? 'Sons táteis ativados (clique para mutar)' : 'Sons táteis desativados (clique para ligar)');
    btn.classList.toggle('is-on', enabled);
  }

  document.addEventListener('DOMContentLoaded', () => {
    updateSfxButtonUI(isEnabled());
    const btn = document.getElementById('sfx-btn');
    if (btn) {
      btn.addEventListener('click', () => toggle());
    }
  });

  // Delegação global de cliques para botões e links táteis
  document.addEventListener('click', (e) => {
    if (!isEnabled()) return;
    const target = e.target.closest && e.target.closest('.btn, .chip, .deck-switch button, .auth-tab, .star-input button, .react-btn, .dlg-close, .auth-close-btn');
    if (target) {
      play('click');
    }
  }, { capture: false, passive: true });

  // Som em submissão de formulário
  document.addEventListener('submit', () => {
    if (isEnabled()) play('success');
  }, { capture: false, passive: true });

  window.LoadingSfx = {
    play,
    enabled: isEnabled,
    setEnabled,
    toggle,
  };
})();
