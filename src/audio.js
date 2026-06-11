export class AudioManager {
  constructor() {
    this.ctx = null;
    this.droneOscs = [];
    this.droneGain = null;
    this.masterGain = null;
    this.isMuted = false;
    this.isMusicMuted = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master volume control
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // Keep overall volume comfortable
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startAmbientDrone() {
    this.init();
    this.resume();
    if (this.isMuted || this.isMusicMuted || this.droneOscs.length > 0) return;

    // Create a low ambient synth drone with a low-pass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(150, this.ctx.currentTime);
    filter.Q.setValueAtTime(1, this.ctx.currentTime);
    filter.connect(this.masterGain);

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.droneGain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 3); // Smooth fade in
    this.droneGain.connect(filter);

    // Oscillator 1 - Root Note (C2 - 65.41 Hz)
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(65.41, this.ctx.currentTime);
    osc1.connect(this.droneGain);
    osc1.start();
    this.droneOscs.push(osc1);

    // Oscillator 2 - Detuned fifth (G2 - 98.00 Hz)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(98.00, this.ctx.currentTime);
    osc2.detune.setValueAtTime(12, this.ctx.currentTime);
    osc2.connect(this.droneGain);
    osc2.start();
    this.droneOscs.push(osc2);

    // Oscillator 3 - Sub-octave (C1 - 32.70 Hz)
    const osc3 = this.ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(32.70, this.ctx.currentTime);
    osc3.connect(this.droneGain);
    osc3.start();
    this.droneOscs.push(osc3);

    // LFO to slowly modulate filter frequency for an organic feeling
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, this.ctx.currentTime); // 0.15 Hz slow oscillation

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(45, this.ctx.currentTime); // Modulate by 45 Hz

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.droneOscs.push(lfo);
  }

  stopAmbientDrone() {
    if (this.droneGain) {
      try {
        const currentGain = this.droneGain.gain.value;
        this.droneGain.gain.setValueAtTime(currentGain, this.ctx.currentTime);
        this.droneGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5); // Fade out
        
        const oscs = this.droneOscs;
        this.droneOscs = [];
        
        setTimeout(() => {
          oscs.forEach(osc => {
            try { osc.stop(); } catch(e) {}
          });
        }, 600);
      } catch(e) {
        console.error(e);
      }
    }
  }

  toggleMusic() {
    this.isMusicMuted = !this.isMusicMuted;
    if (this.isMusicMuted) {
      this.stopAmbientDrone();
    } else {
      this.startAmbientDrone();
    }
    return this.isMusicMuted;
  }

  playCollectSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Glowing retro-futuristic chime arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const duration = 0.06; // Fast note transitions
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * duration);
      
      // Add chorus/thickness with a detuned triangle wave
      const chorusOsc = this.ctx.createOscillator();
      chorusOsc.type = 'triangle';
      chorusOsc.frequency.setValueAtTime(freq * 1.006, t + idx * duration);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0, t + idx * duration);
      gain.gain.linearRampToValueAtTime(0.18, t + idx * duration + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * duration + 0.25);
      
      osc.connect(gain);
      chorusOsc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start(t + idx * duration);
      chorusOsc.start(t + idx * duration);
      
      osc.stop(t + idx * duration + 0.3);
      chorusOsc.stop(t + idx * duration + 0.3);
    });
  }

  playJumpSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }

  playDoubleJumpSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(680, t + 0.14);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  playGuideToggleSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.setValueAtTime(900, t + 0.05);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playRespawnSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.45);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + 0.45);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  playAlarmSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.15);
    osc.frequency.linearRampToValueAtTime(800, t + 0.3);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.45);
    osc.frequency.linearRampToValueAtTime(800, t + 0.6);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, t);

    gain.gain.setValueAtTime(0.04, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.8);
  }

  playBoosterSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.35);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  playPlatformFadeSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.setValueAtTime(1500, t + 0.05);
    osc.frequency.setValueAtTime(1000, t + 0.1);
    osc.frequency.setValueAtTime(600, t + 0.15);

    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  playGameOverSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Ascending sweep followed by long, fading, descending bass sweep
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.linearRampToValueAtTime(40, t + 1.8);

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, t);
    subOsc.frequency.linearRampToValueAtTime(20, t + 1.8);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.linearRampToValueAtTime(80, t + 1.8);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.4);
    gain.gain.linearRampToValueAtTime(0.0001, t + 1.8);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    subOsc.start(t);
    osc.stop(t + 1.9);
    subOsc.stop(t + 1.9);
  }

  playVictorySound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Energetic synth fanfare arpeggio (C major, F major, G major, C major)
    const chords = [
      { notes: [261.63, 329.63, 392.00], delay: 0.0 }, // C4
      { notes: [349.23, 440.00, 523.25], delay: 0.25 }, // F4
      { notes: [392.00, 489.99, 587.33], delay: 0.50 }, // G4
      { notes: [523.25, 659.25, 783.99, 1046.50], delay: 0.75 } // C5 (climax)
    ];

    chords.forEach((chord) => {
      chord.notes.forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + chord.delay);

        gain.gain.setValueAtTime(0, t);
        gain.gain.setValueAtTime(0, t + chord.delay);
        gain.gain.linearRampToValueAtTime(0.12, t + chord.delay + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + chord.delay + 0.85);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t + chord.delay);
        osc.stop(t + chord.delay + 0.9);
      });
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAmbientDrone();
    } else {
      this.startAmbientDrone();
    }
    return this.isMuted;
  }

  playLaserHitSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(55, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.35);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  playGuardAlertSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const duration = 0.08;
    const delays = [0.0, 0.12];

    delays.forEach(delay => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, t + delay);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + delay);
      osc.stop(t + delay + duration + 0.02);
    });
  }

  playGuardHitSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.linearRampToValueAtTime(30, t + 0.55);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(60, t);
    sub.frequency.linearRampToValueAtTime(20, t + 0.55);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    sub.start(t);
    osc.stop(t + 0.6);
    sub.stop(t + 0.6);
  }

  playPortalWarpSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.45);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  playLevelClearSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const delay = 0.07;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * delay);

      gain.gain.setValueAtTime(0, t);
      gain.gain.setValueAtTime(0, t + idx * delay);
      gain.gain.linearRampToValueAtTime(0.15, t + idx * delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * delay + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * delay);
      osc.stop(t + idx * delay + 0.45);
    });
  }

  playLaserShootSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.12);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playEmptyClipSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);

    gain.gain.setValueAtTime(0.06, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  playAmmoCollectSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, t); // D5
    osc.frequency.setValueAtTime(880.00, t + 0.06); // A5

    gain.gain.setValueAtTime(0.07, t);
    gain.gain.setValueAtTime(0.07, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  playGuardDamageSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(290, t);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(320, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.Q.setValueAtTime(3, t);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  playGuardExplosionSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(180, t);
    osc1.frequency.linearRampToValueAtTime(30, t + 0.55);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(350, t);
    osc2.frequency.linearRampToValueAtTime(80, t + 0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.65);
  }

  playGlitchDecoySound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.15);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.16);
  }

  playGravityInvertSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.35);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  playBarrierBreakSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(350, t);
    osc1.frequency.linearRampToValueAtTime(60, t + 0.4);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(520, t);
    osc2.frequency.linearRampToValueAtTime(80, t + 0.25);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.45);
    osc2.stop(t + 0.45);
  }

  playBossHomingSound() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.setValueAtTime(740, t + 0.08);

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.18);
  }
}

