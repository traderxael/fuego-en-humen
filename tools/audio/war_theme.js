// Procedural background music for the intro: the Opium War siege at Humen.
// Pure math, no samples, no external assets, no licence questions.
//   node tools/audio/war_theme.js <out.wav> [seconds]
//
// Written as 16-bit stereo PCM at 44.1 kHz. Encode it afterwards:
//   ffmpeg -i war_theme.wav -b:a 128k war_theme.mp3

const fs = require('fs');
const path = require('path');

const SR = 44100;
const DUR = Number(process.argv[3]) || 46;
const OUT = process.argv[2] || path.join(__dirname, 'war_theme.wav');
const N = Math.floor(SR * DUR);

const L = new Float32Array(N);
const R = new Float32Array(N);

// Deterministic noise so the theme is byte-identical on every run.
let seed = 20241101 >>> 0;
function rnd() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
}

// Pan a voice: -1 hard left, +1 hard right, 0 centre.
function add(i, v, pan) {
  if (i < 0 || i >= N) return;
  const gl = Math.sqrt((1 - pan) / 2);
  const gr = Math.sqrt((1 + pan) / 2);
  L[i] += v * gl;
  R[i] += v * gr;
}

// One-pole low-pass, state kept per voice.
function lowpass(cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  let y = 0;
  return function (x) {
    y += a * (x - y);
    return y;
  };
}

// Band-limited-ish saw: a few harmonics, cheap and warm enough for a pad.
function saw(phase, harmonics) {
  let v = 0;
  for (let h = 1; h <= harmonics; h++) v += Math.sin(phase * h) / h;
  return v;
}

function fade(t) {
  const inT = Math.min(1, t / 2.0);
  const outT = Math.min(1, Math.max(0, (DUR - t) / 3.0));
  return Math.min(inT, outT);
}

// --- 1. Drone: the fortress standing on the river -------------------------
{
  const lp = lowpass(220);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const swell = 0.62 + 0.38 * Math.sin(2 * Math.PI * 0.063 * t);
    const body =
      Math.sin(2 * Math.PI * 36.71 * t) * 0.55 +
      Math.sin(2 * Math.PI * 73.42 * t + 0.4) * 0.3 +
      Math.sin(2 * Math.PI * 73.6 * t) * 0.22;
    const v = lp(body) * 0.34 * swell * fade(t);
    add(i, v, 0);
  }
}

// --- 2. Wind over the water ----------------------------------------------
{
  const lp = lowpass(900);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const gust = 0.45 + 0.55 * Math.sin(2 * Math.PI * 0.041 * t + 1.1);
    const v = lp(rnd()) * 0.075 * gust * fade(t);
    add(i, v, -0.25);
    add(i, v * 0.85, 0.35);
  }
}

// --- 3. String pad: D minor swell from the second section -----------------
const PAD_CHORD = [
  { f: 146.83, t0: 5, t1: 41, gain: 0.5, pan: -0.3 },  // D3
  { f: 174.61, t0: 8, t1: 39, gain: 0.42, pan: 0.3 },  // F3
  { f: 220.0, t0: 11, t1: 42, gain: 0.38, pan: 0.05 }, // A3
  { f: 293.66, t0: 22, t1: 43, gain: 0.22, pan: -0.1 },// D4 (tension)
];
for (const note of PAD_CHORD) {
  const lp = lowpass(1100);
  const start = Math.floor(note.t0 * SR);
  const end = Math.floor(note.t1 * SR);
  const len = end - start;
  let phase = 0;
  for (let i = start; i < end && i < N; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * note.f) / SR;
    const rel = (i - start) / len;
    const env = Math.min(1, rel * 7) * Math.min(1, (1 - rel) * 3.2);
    const v = lp(saw(phase, 5)) * 0.16 * note.gain * env * fade(t);
    add(i, v, note.pan);
  }
}

// --- 4. Melody: the soldier's theme ---------------------------------------
const MELODY = [
  { t: 11.0, d: 2.6, f: 293.66, g: 0.55 },  // D4
  { t: 13.6, d: 1.8, f: 349.23, g: 0.42 },  // F4
  { t: 15.4, d: 2.6, f: 440.0, g: 0.5 },    // A4
  { t: 18.0, d: 1.9, f: 392.0, g: 0.42 },   // G4
  { t: 19.9, d: 3.0, f: 349.23, g: 0.52 },  // F4
  { t: 22.9, d: 3.2, f: 293.66, g: 0.5 },   // D4
  { t: 26.1, d: 1.9, f: 261.63, g: 0.4 },   // C4
  { t: 28.0, d: 4.4, f: 293.66, g: 0.55 },  // D4
];
for (const note of MELODY) {
  const lp = lowpass(2600);
  const start = Math.floor(note.t * SR);
  const len = Math.floor(note.d * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const i = start + k;
    if (i >= N) break;
    const t = i / SR;
    const vib = 1 + 0.005 * Math.sin(2 * Math.PI * 4.8 * t);
    phase += (2 * Math.PI * note.f * vib) / SR;
    const rel = k / len;
    const env = Math.min(1, rel * 12) * Math.min(1, (1 - rel) * 6);
    const v = lp(saw(phase, 4)) * 0.2 * note.g * env * fade(t);
    add(i, v, -0.12);
    add(i, v * 0.5, 0.4);
  }
}

// --- 5. War drums: the heartbeat of the first battle ----------------------
function drum(i0, strength, dur, pitch) {
  let phase = 0;
  const lp = lowpass(320);
  for (let k = 0; k < dur; k++) {
    const i = i0 + k;
    if (i >= N) return;
    const t = k / SR;
    const f = pitch * (1 + 5 * Math.exp(-t * 38));
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 7.5);
    const noise = lp(rnd()) * 0.35 * Math.exp(-t * 55);
    add(i, (Math.sin(phase) * 0.8 + noise) * strength * env, 0);
  }
}
const BEAT = 60 / 72; // 72 BPM
for (let b = 0; b * BEAT < 40; b++) {
  const t = 7.5 + b * BEAT;
  if (t > DUR - 4) break;
  const i0 = Math.floor(t * SR);
  const onBeat = b % 4 === 0;
  const heavy = onBeat || b % 4 === 2;
  // The last stretch is the assault itself: denser and louder.
  const late = t > 30;
  drum(i0, (heavy ? 0.95 : 0.5) * (late ? 1.15 : 1), 0.42, heavy ? 62 : 82);
  if (late || b % 4 === 3) {
    drum(i0 + Math.floor(BEAT * 0.5 * SR), 0.34, 0.3, 92);
  }
}

// --- 6. Cannon fire from the fleet -----------------------------------------
for (const t of [19.5, 24.0, 29.5, 34.0, 38.5]) {
  const i0 = Math.floor(t * SR);
  const lp = lowpass(180);
  let phase = 0;
  for (let k = 0; k < SR * 2.2; k++) {
    const i = i0 + k;
    if (i >= N) break;
    const tt = k / SR;
    const env = Math.exp(-tt * 2.1);
    const body = Math.sin(2 * Math.PI * 44 * tt) * 0.9 + Math.sin(2 * Math.PI * 31 * tt) * 0.5;
    phase += (2 * Math.PI * 44) / SR;
    const v = (lp(rnd()) * 0.7 + body * 0.5) * env * 0.55;
    add(i, v, 0.05);
  }
}

// --- 7. Master: normalise and write ---------------------------------------
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = peak > 0 ? 0.88 / peak : 1;

const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * gain));
  const r = Math.max(-1, Math.min(1, R[i] * gain));
  data.writeInt16LE(Math.round(l * 32767), i * 4);
  data.writeInt16LE(Math.round(r * 32767), i * 4 + 2);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);          // PCM
header.writeUInt16LE(2, 22);          // stereo
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);     // byte rate
header.writeUInt16LE(4, 32);          // block align
header.writeUInt16LE(16, 34);         // bits
header.write('data', 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log('WROTE ' + OUT + ' (' + DUR + 's, ' + (44 + data.length) + ' bytes, peak ' + peak.toFixed(3) + ')');
