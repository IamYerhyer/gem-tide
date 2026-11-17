// Sound effects made with the Web Audio API: short oscillator blips and filtered noise, no
// audio files and no network. The context is created lazily on the first play() call, which
// the game only makes after a user gesture (starting a run), so autoplay rules are respected.
// M mutes everything; the flag lives here so every caller stays simple.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context === null) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return null;
      context = new AudioCtor();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise(seconds, volume) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
  }

  return {
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(880, 320, 0.07, 'square', 0.05);
    },
    explosion(big) {
      noise(big ? 0.35 : 0.18, big ? 0.22 : 0.13);
      tone(big ? 160 : 220, 40, big ? 0.3 : 0.16, 'sawtooth', 0.1);
    },
    gem() {
      tone(1180, 1180, 0.06, 'sine', 0.09);
      tone(1770, 1770, 0.09, 'sine', 0.09, 0.05);
    },
    power() {
      tone(520, 1040, 0.16, 'triangle', 0.14);
    },
    hit() {
      tone(200, 55, 0.3, 'sawtooth', 0.2);
      noise(0.25, 0.18);
    },
    breach() {
      tone(340, 90, 0.28, 'square', 0.14);
    },
    wave() {
      tone(523, 523, 0.1, 'triangle', 0.12);
      tone(659, 659, 0.1, 'triangle', 0.12, 0.09);
      tone(784, 784, 0.16, 'triangle', 0.12, 0.18);
    },
    win() {
      tone(523, 523, 0.12, 'triangle', 0.13);
      tone(659, 659, 0.12, 'triangle', 0.13, 0.11);
      tone(784, 784, 0.12, 'triangle', 0.13, 0.22);
      tone(1046, 1046, 0.3, 'triangle', 0.14, 0.33);
    },
    over() {
      tone(392, 392, 0.16, 'triangle', 0.13);
      tone(330, 330, 0.16, 'triangle', 0.13, 0.15);
      tone(262, 196, 0.36, 'triangle', 0.13, 0.3);
    },
  };
}
