const dial = document.querySelector('#dial');
const safe = document.querySelector('#safe');
const hint = document.querySelector('#hint');
const dots = [...document.querySelectorAll('.turn-dot')];
const albumButton = document.querySelector('#albumButton');
const albumScene = document.querySelector('#albumScene');
const albumBook = document.querySelector('#albumBook');
const hearts = document.querySelector('#hearts');
const dragHelp = document.querySelector('#dragHelp');
const currentNumberElement = document.querySelector('#currentNumber');
const verifyState = document.querySelector('#verifyState');
const dialFeedback = document.querySelector('.dial-feedback');

const combination = [20, 18, 45];
const degreesPerNumber = 360 / 61;
let sequenceIndex = 0;
let dragging = false;
let lastTouchAngle = 0;
let rotation = 0;
let currentNumber = 0;
let verificationTimer = null;
let unlocked = false;
let audioContext = null;

function getAudioContext() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function tone(frequency, duration, type = 'sine', volume = 0.035, delay = 0) {
  try {
    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
    gain.gain.setValueAtTime(volume, context.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + delay + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + delay);
    oscillator.stop(context.currentTime + delay + duration);
  } catch (_) {}
}

function tickSound() {
  tone(1250, 0.025, 'square', 0.012);
  tone(190, 0.035, 'triangle', 0.02);
}

function successSound() {
  tone(523, .14, 'sine', .045);
  tone(659, .14, 'sine', .045, .13);
  tone(784, .24, 'sine', .05, .26);
}

function errorSound() {
  tone(185, .18, 'sawtooth', .035);
  tone(135, .28, 'sawtooth', .03, .16);
}

function touchAngle(touch) {
  const box = dial.getBoundingClientRect();
  return Math.atan2(touch.clientY - box.top - box.height / 2, touch.clientX - box.left - box.width / 2) * 180 / Math.PI;
}

function normalizedNumber() {
  const normalized = ((-rotation % 360) + 360) % 360;
  return Math.round(normalized / degreesPerNumber) % 61;
}

function updateDial(delta) {
  rotation += delta;
  const nextNumber = normalizedNumber();
  dial.style.setProperty('--rotation', `${rotation}deg`);
  if (nextNumber !== currentNumber) {
    currentNumber = nextNumber;
    currentNumberElement.textContent = currentNumber;
    tickSound();
  }
  scheduleVerification();
}

function scheduleVerification() {
  clearTimeout(verificationTimer);
  dialFeedback.className = 'dial-feedback';
  verifyState.textContent = 'Déjala quieta 3 segundos para verificar';
  verificationTimer = setTimeout(verifyNumber, 3000);
}

function startTouch(event) {
  if (unlocked || !event.touches.length) return;
  event.preventDefault();
  getAudioContext();
  dragging = true;
  lastTouchAngle = touchAngle(event.touches[0]);
  dial.classList.add('touching');
  clearTimeout(verificationTimer);
}

function moveTouch(event) {
  if (!dragging || unlocked || !event.touches.length) return;
  event.preventDefault();
  const angle = touchAngle(event.touches[0]);
  let delta = angle - lastTouchAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  lastTouchAngle = angle;
  updateDial(delta);
}

function finishTouch() {
  if (!dragging || unlocked) return;
  dragging = false;
  dial.classList.remove('touching');
  scheduleVerification();
}

function resetDial() {
  rotation += currentNumber * degreesPerNumber;
  currentNumber = 0;
  currentNumberElement.textContent = '0';
  dial.style.transition = 'transform .65s cubic-bezier(.2,.8,.2,1)';
  dial.style.setProperty('--rotation', `${rotation}deg`);
  setTimeout(() => { dial.style.transition = ''; }, 700);
}

function verifyNumber() {
  if (dragging || unlocked) return;
  dialFeedback.className = 'dial-feedback checking';
  verifyState.textContent = 'Verificando…';
  const selected = currentNumber;

  setTimeout(() => {
    if (selected === combination[sequenceIndex]) {
      dots[sequenceIndex].classList.add('done');
      sequenceIndex += 1;
      dialFeedback.className = 'dial-feedback success';
      verifyState.textContent = sequenceIndex === 3 ? '¡Combinación correcta!' : 'Correcto · siguiente número';
      successSound();
      if (sequenceIndex === combination.length) {
        setTimeout(unlock, 800);
      } else {
        resetDial();
        hint.textContent = `${sequenceIndex} de 3 números correctos`;
      }
    } else {
      sequenceIndex = 0;
      dots.forEach((dot) => {
        dot.classList.remove('done');
        dot.classList.add('error');
      });
      dialFeedback.className = 'dial-feedback error';
      verifyState.textContent = 'Incorrecto · empieza de nuevo';
      hint.textContent = 'La secuencia vuelve a empezar';
      errorSound();
      resetDial();
      setTimeout(() => dots.forEach((dot) => dot.classList.remove('error')), 900);
    }
  }, 700);
}

function unlock() {
  unlocked = true;
  clearTimeout(verificationTimer);
  dial.setAttribute('aria-label', 'Caja fuerte abierta');
  hint.textContent = '¡Combinación correcta!';
  setTimeout(() => safe.classList.add('open'), 350);
  dragHelp.classList.add('hidden');
  document.querySelector('.combo-progress').style.opacity = '.45';
  dialFeedback.style.opacity = '0';
  setTimeout(() => {
    safe.classList.add('fully-open');
    hint.textContent = 'Toca el álbum para descubrirlo';
  }, 1500);
}

function makeHearts() {
  for (let i = 0; i < 22; i += 1) {
    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = '♥';
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.fontSize = `${10 + Math.random() * 18}px`;
    heart.style.setProperty('--time', `${3.5 + Math.random() * 3}s`);
    heart.style.setProperty('--drift', `${-50 + Math.random() * 100}px`);
    heart.style.animationDelay = `${Math.random() * 1.2}s`;
    hearts.appendChild(heart);
    heart.addEventListener('animationend', () => heart.remove());
  }
}

albumButton.addEventListener('click', () => {
  if (!safe.classList.contains('fully-open')) return;
  albumScene.classList.add('visible');
  albumScene.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    albumScene.classList.add('shown');
    requestAnimationFrame(() => albumScene.classList.add('zoomed'));
    setTimeout(() => albumBook.classList.add('open'), 1200);
  });
  makeHearts();
});

dial.addEventListener('touchstart', startTouch, { passive: false });
dial.addEventListener('touchmove', moveTouch, { passive: false });
dial.addEventListener('touchend', finishTouch, { passive: true });
dial.addEventListener('touchcancel', finishTouch, { passive: true });

document.querySelectorAll('.photo-frame img').forEach((image) => {
  image.addEventListener('error', () => image.classList.add('broken'));
});
