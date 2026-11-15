// Synthesised sound: every effect and the ambient drone are built from plain
// WebAudio oscillators and filtered noise, so the game ships no audio files.
// All calls are safe before any user gesture (the context simply stays muted
// until the player first presses a key or clicks).
export function createAudio() {
  let context = null;
  let master = null;
  let musicNodes = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone({ frequency, endFrequency = frequency, duration, type = 'sine', volume = 0.2, delay = 0 }) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t0);
    if (endFrequency !== frequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t0 + duration);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function noise({ duration, volume = 0.25, lowpass = 1200, delay = 0 }) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function startMusic() {
    if (!ensure() || musicNodes || muted) return;
    // A slow two-oscillator drone a fifth apart, gently breathing.
    const drone = context.createGain();
    drone.gain.value = 0.05;
    drone.connect(master);
    const oscA = context.createOscillator();
    oscA.type = 'sine';
    oscA.frequency.value = 110;
    const oscB = context.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 164.81;
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.025;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.gain);
    oscA.connect(drone);
    oscB.connect(drone);
    oscA.start();
    oscB.start();
    lfo.start();
    musicNodes = { drone, oscA, oscB, lfo };
  }

  return {
    unlock() { resume(); startMusic(); },
    shoot() { tone({ frequency: 880, endFrequency: 320, duration: 0.07, type: 'square', volume: 0.08 }); },
    hit() { noise({ duration: 0.08, volume: 0.12, lowpass: 2500 }); },
    enemyDie() { tone({ frequency: 320, endFrequency: 60, duration: 0.22, type: 'sawtooth', volume: 0.16 }); noise({ duration: 0.18, volume: 0.18, lowpass: 900 }); },
    hurt() { tone({ frequency: 160, endFrequency: 55, duration: 0.3, type: 'sawtooth', volume: 0.22 }); },
    pickup() { tone({ frequency: 660, duration: 0.09, volume: 0.14 }); tone({ frequency: 990, duration: 0.12, volume: 0.14, delay: 0.07 }); },
    shard() { tone({ frequency: 1320, duration: 0.06, type: 'triangle', volume: 0.1 }); },
    waveClear() { [523, 659, 784, 1047].forEach((f, i) => tone({ frequency: f, duration: 0.16, volume: 0.15, delay: i * 0.09 })); },
    bossRoar() { tone({ frequency: 90, endFrequency: 45, duration: 0.7, type: 'sawtooth', volume: 0.25 }); noise({ duration: 0.6, volume: 0.2, lowpass: 500 }); },
    upgrade() { [392, 523, 659].forEach((f, i) => tone({ frequency: f, duration: 0.12, type: 'triangle', volume: 0.15, delay: i * 0.06 })); },
    victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ frequency: f, duration: 0.22, volume: 0.16, delay: i * 0.11 })); },
    gameOver() { [392, 330, 262, 196].forEach((f, i) => tone({ frequency: f, duration: 0.28, type: 'triangle', volume: 0.16, delay: i * 0.14 })); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
  };
}
