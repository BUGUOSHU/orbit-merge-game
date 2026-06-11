let homeAudioContext;
let homeChimePlayed = false;

function playHomeChime() {
  if (homeChimePlayed) return;
  try {
    homeAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (homeAudioContext.state === "suspended") homeAudioContext.resume();
    homeChimePlayed = true;
    const now = homeAudioContext.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 987.77];

    notes.forEach((frequency, index) => {
      const start = now + index * 0.13;
      const oscillator = homeAudioContext.createOscillator();
      const gain = homeAudioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.48);
      oscillator.connect(gain).connect(homeAudioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.5);
    });
  } catch (_) {
    homeChimePlayed = false;
  }
}

window.addEventListener("pointerdown", playHomeChime, { once: true });
window.addEventListener("keydown", playHomeChime, { once: true });
