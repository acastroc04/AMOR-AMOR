const dial = document.querySelector('#dial');
const safe = document.querySelector('#safe');
const hint = document.querySelector('#hint');
const dots = [...document.querySelectorAll('.turn-dot')];
const albumButton = document.querySelector('#albumButton');
const albumScene = document.querySelector('#albumScene');
const albumBook = document.querySelector('#albumBook');
const hearts = document.querySelector('#hearts');

let dragging = false;
let lastAngle = 0;
let rotation = 0;
let distance = 0;
let completedTurns = 0;
let unlocked = false;

function pointerAngle(event) {
  const box = dial.getBoundingClientRect();
  return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180 / Math.PI;
}

function beginTurn(event) {
  if (unlocked) return;
  dragging = true;
  lastAngle = pointerAngle(event);
  dial.setPointerCapture?.(event.pointerId);
}

function turn(event) {
  if (!dragging || unlocked) return;
  const angle = pointerAngle(event);
  let delta = angle - lastAngle;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  rotation += delta;
  distance += Math.abs(delta);
  lastAngle = angle;
  dial.style.setProperty('--rotation', `${rotation}deg`);

  const newTurns = Math.min(3, Math.floor(distance / 360));
  if (newTurns !== completedTurns) {
    completedTurns = newTurns;
    dots.forEach((dot, index) => dot.classList.toggle('done', index < completedTurns));
    hint.textContent = completedTurns < 3 ? `${completedTurns} de 3 vueltas…` : '¡Combinación correcta!';
    if (completedTurns === 3) unlock();
  }
}

function endTurn(event) {
  dragging = false;
  if (event?.pointerId !== undefined && dial.hasPointerCapture?.(event.pointerId)) dial.releasePointerCapture(event.pointerId);
}

function unlock() {
  unlocked = true;
  endTurn();
  dial.setAttribute('aria-label', 'Caja fuerte abierta');
  setTimeout(() => safe.classList.add('open'), 350);
  setTimeout(() => { hint.textContent = 'Toca el álbum para descubrirlo'; }, 1450);
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
  albumScene.classList.add('visible');
  albumScene.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    albumScene.classList.add('shown');
    setTimeout(() => albumBook.classList.add('open'), 450);
  });
  makeHearts();
});

dial.addEventListener('pointerdown', beginTurn);
window.addEventListener('pointermove', turn, { passive: true });
window.addEventListener('pointerup', endTurn);
window.addEventListener('pointercancel', endTurn);
dial.addEventListener('keydown', (event) => {
  if (unlocked || !['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) return;
  event.preventDefault();
  distance += 90;
  rotation += event.key === 'ArrowLeft' ? -90 : 90;
  dial.style.setProperty('--rotation', `${rotation}deg`);
  const newTurns = Math.min(3, Math.floor(distance / 360));
  if (newTurns !== completedTurns) {
    completedTurns = newTurns;
    dots.forEach((dot, index) => dot.classList.toggle('done', index < completedTurns));
    if (completedTurns === 3) unlock();
  }
});

document.querySelectorAll('.photo-frame img').forEach((image) => {
  image.addEventListener('error', () => image.classList.add('broken'));
});
