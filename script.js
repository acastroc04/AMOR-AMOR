const dial = document.querySelector('#dial');
const safe = document.querySelector('#safe');
const hint = document.querySelector('#hint');
const dots = [...document.querySelectorAll('.turn-dot')];
const albumButton = document.querySelector('#albumButton');
const albumScene = document.querySelector('#albumScene');
const albumBook = document.querySelector('#albumBook');
const hearts = document.querySelector('#hearts');
const currentNumberElement = document.querySelector('#currentNumber');
const verifyState = document.querySelector('#verifyState');
const dialFeedback = document.querySelector('.dial-feedback');
const photoTray = document.querySelector('#photoTray');
const trayPhotos = [...document.querySelectorAll('.tray-photo')];
const photoSlots = [...document.querySelectorAll('.photo-slot')];
const puzzleInstruction = document.querySelector('.puzzle-instruction');
const memoryModal = document.querySelector('#memoryModal');
const memoryImage = document.querySelector('#memoryImage');
const memoryMessage = document.querySelector('#memoryMessage');
const memoryClose = document.querySelector('#memoryClose');
const continueButton = document.querySelector('#continueButton');
const turntableScene = document.querySelector('#turntableScene');
const turntable = document.querySelector('#turntable');
const auroraAudio = document.querySelector('#auroraAudio');
const playButton = document.querySelector('#playButton');
const seekBar = document.querySelector('#seekBar');
const currentTimeDisplay = document.querySelector('#currentTime');
const durationDisplay = document.querySelector('#duration');
const audioStatus = document.querySelector('#audioStatus');
const fifteenHint = document.querySelector('#fifteenHint');
const musicContinue = document.querySelector('#musicContinue');

const combination = [20, 18, 45];
const degreesPerNumber = 360 / 60;
let sequenceIndex = 0;
let dragging = false;
let lastTouchAngle = 0;
let rotation = 0;
let currentNumber = 0;
let verificationTimer = null;
let unlocked = false;
let soundPlayer = null;
let soundsUnlocked = false;
let activeTrayPhoto = null;
let dragGhost = null;
let activeSlot = null;
let placedPhotos = 0;
let puzzleFinished = false;
const loveMomentLatestStart = 89.99;
const loveMomentEnd = 103;
let loveMomentEligible = false;
let loveMomentUnlocked = false;

const memoryMessages = {
  1: 'Ese día contigo ♡',
  2: 'Mi lugar favorito',
  3: 'Tú y tu sonrisa',
  4: 'Siempre nosotros'
};

function createWavDataUrl(kind) {
  const rate = 22050;
  const duration = kind === 'success' ? .62 : .5;
  const length = Math.floor(rate * duration);
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  const write = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);

  let noiseSeed = 9187;
  for (let i = 0; i < length; i += 1) {
    const time = i / rate;
    noiseSeed = (noiseSeed * 16807) % 2147483647;
    const noise = (noiseSeed / 1073741823.5) - 1;
    let sample = 0;
    if (kind === 'success') {
      const note = time < .18 ? 523.25 : time < .36 ? 659.25 : 783.99;
      const localTime = time < .18 ? time : time < .36 ? time - .18 : time - .36;
      sample = (Math.sin(2 * Math.PI * note * localTime) + .32 * Math.sin(4 * Math.PI * note * localTime)) * .3 * Math.exp(-localTime * 4.5);
    } else {
      const frequency = time < .23 ? 190 : 125;
      sample = (Math.sin(2 * Math.PI * frequency * time) + .24 * Math.sin(2 * Math.PI * frequency * 2.03 * time)) * .3 * Math.exp(-time * 2.3);
    }
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const soundUrls = {
  success: createWavDataUrl('success'),
  error: createWavDataUrl('error')
};
soundPlayer = new Audio(soundUrls.success);
soundPlayer.preload = 'auto';
soundPlayer.load();

function playSound(name) {
  try {
    if (!soundPlayer) soundPlayer = new Audio();
    soundPlayer.pause();
    soundPlayer.src = soundUrls[name];
    soundPlayer.currentTime = 0;
    soundPlayer.volume = .8;
    soundPlayer.play().catch(() => {});
  } catch (_) {}
}

function successSound() { playSound('success'); }
function errorSound() { playSound('error'); }

function touchAngle(touch) {
  const box = dial.getBoundingClientRect();
  return Math.atan2(touch.clientY - box.top - box.height / 2, touch.clientX - box.left - box.width / 2) * 180 / Math.PI;
}

function normalizedNumber() {
  const normalized = ((-rotation % 360) + 360) % 360;
  return Math.round(normalized / degreesPerNumber) % 60;
}

function updateDial(delta) {
  rotation += delta;
  const nextNumber = normalizedNumber();
  dial.style.setProperty('--rotation', `${rotation}deg`);
  if (nextNumber !== currentNumber) {
    currentNumber = nextNumber;
    currentNumberElement.textContent = currentNumber;
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
  if (!soundsUnlocked) {
    soundsUnlocked = true;
    const originalVolume = soundPlayer.volume;
    soundPlayer.volume = 0;
    soundPlayer.play().then(() => {
      soundPlayer.pause();
      soundPlayer.currentTime = 0;
      soundPlayer.volume = originalVolume;
    }).catch(() => { soundPlayer.volume = originalVolume; });
  }
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
    setTimeout(() => albumScene.classList.add('puzzle-ready'), 2450);
  });
  makeHearts();
});

function moveGhost(touch) {
  if (!dragGhost) return;
  dragGhost.style.left = `${touch.clientX}px`;
  dragGhost.style.top = `${touch.clientY}px`;
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  const target = elementBelow ? elementBelow.closest('.photo-slot') : null;
  if (target !== activeSlot) {
    if (activeSlot) activeSlot.classList.remove('target');
    activeSlot = target;
    if (activeSlot) activeSlot.classList.add('target');
  }
}

function startPhotoDrag(event) {
  if (!event.touches.length || this.classList.contains('placed')) return;
  event.preventDefault();
  activeTrayPhoto = this;
  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.innerHTML = `<img src="${this.querySelector('img').src}" alt="">`;
  document.body.appendChild(dragGhost);
  moveGhost(event.touches[0]);
}

function dragPhoto(event) {
  if (!activeTrayPhoto || !event.touches.length) return;
  event.preventDefault();
  moveGhost(event.touches[0]);
}

function finishPhotoDrag(event) {
  if (!activeTrayPhoto) return;
  const touch = event.changedTouches && event.changedTouches[0];
  if (touch) moveGhost(touch);
  const photoNumber = activeTrayPhoto.dataset.photo;

  if (activeSlot && !activeSlot.classList.contains('correct') && activeSlot.dataset.slot === photoNumber) {
    const source = activeTrayPhoto.querySelector('img').src;
    const slotImage = activeSlot.querySelector('.photo-frame img');
    slotImage.src = source;
    activeSlot.classList.add('correct');
    activeTrayPhoto.classList.add('placed');
    placedPhotos += 1;
    puzzleInstruction.textContent = placedPhotos === 4 ? 'Todos los recuerdos están en su lugar' : `${placedPhotos} de 4 recuerdos colocados`;
    showMemory(photoNumber, source);
    successSound();
    if (placedPhotos === 4) photoTray.classList.add('complete');
  } else {
    const wrongSlot = activeSlot;
    if (wrongSlot) wrongSlot.classList.add('wrong');
    puzzleInstruction.textContent = 'Ese recuerdo no va ahí · prueba otra vez';
    errorSound();
    setTimeout(() => {
      if (wrongSlot) wrongSlot.classList.remove('wrong');
      if (placedPhotos < 4) puzzleInstruction.textContent = 'Arrastra cada recuerdo hasta su lugar';
    }, 900);
  }

  if (activeSlot) activeSlot.classList.remove('target');
  if (dragGhost) dragGhost.remove();
  dragGhost = null;
  activeSlot = null;
  activeTrayPhoto = null;
}

function showMemory(number, source) {
  memoryImage.src = source;
  memoryMessage.textContent = memoryMessages[number];
  memoryModal.classList.add('visible');
  memoryModal.setAttribute('aria-hidden', 'false');
}

function closeMemory() {
  memoryModal.classList.remove('visible');
  memoryModal.setAttribute('aria-hidden', 'true');
  if (placedPhotos === 4 && !puzzleFinished) {
    setTimeout(() => albumScene.classList.add('puzzle-complete'), 320);
  }
}

function finishAlbumPuzzle() {
  puzzleFinished = true;
  albumScene.classList.remove('puzzle-ready');
  albumScene.classList.remove('puzzle-complete');
  albumBook.classList.add('closing');
  setTimeout(() => {
    albumBook.classList.add('leaving');
    turntableScene.classList.add('visible');
    turntableScene.setAttribute('aria-hidden', 'false');
  }, 900);
  setTimeout(() => { albumBook.style.visibility = 'hidden'; }, 2100);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function updatePlayerTime() {
  currentTimeDisplay.textContent = formatTime(auroraAudio.currentTime);
  if (Number.isFinite(auroraAudio.duration)) {
    seekBar.max = auroraAudio.duration;
    seekBar.value = auroraAudio.currentTime;
  }

  if (!loveMomentUnlocked && !auroraAudio.paused) {
    const currentTime = auroraAudio.currentTime;
    if (currentTime <= loveMomentLatestStart) loveMomentEligible = true;
    if (loveMomentEligible && currentTime >= loveMomentEnd) unlockLoveMoment();
  }
}

function unlockLoveMoment() {
  loveMomentUnlocked = true;
  fifteenHint.classList.add('completed');
  musicContinue.classList.add('visible');
  musicContinue.setAttribute('aria-hidden', 'false');
  musicContinue.disabled = false;
  audioStatus.textContent = 'Has encontrado nuestros 15 segundos';
}

function togglePlayback() {
  if (auroraAudio.paused) {
    auroraAudio.play().then(() => {
      turntable.classList.add('playing');
      playButton.setAttribute('aria-label', 'Pausar canción');
      audioStatus.textContent = 'Reproduciendo nuestra canción';
    }).catch(() => {
      audioStatus.textContent = 'Añade el archivo audio/aurora.mp3';
    });
  } else {
    auroraAudio.pause();
  }
}

playButton.addEventListener('click', togglePlayback);
auroraAudio.addEventListener('loadedmetadata', () => {
  seekBar.max = auroraAudio.duration;
  durationDisplay.textContent = formatTime(auroraAudio.duration);
  audioStatus.textContent = 'Pulsa para escuchar';
});
auroraAudio.addEventListener('timeupdate', updatePlayerTime);
auroraAudio.addEventListener('pause', () => {
  turntable.classList.remove('playing');
  playButton.setAttribute('aria-label', 'Reproducir canción');
  if (!auroraAudio.ended) audioStatus.textContent = 'En pausa';
});
auroraAudio.addEventListener('ended', () => {
  turntable.classList.remove('playing');
  seekBar.value = 0;
  currentTimeDisplay.textContent = '0:00';
  audioStatus.textContent = 'La canción ha terminado';
});
auroraAudio.addEventListener('error', () => {
  audioStatus.textContent = 'Añade el archivo audio/aurora.mp3';
});
seekBar.addEventListener('input', () => {
  if (Number.isFinite(auroraAudio.duration)) {
    auroraAudio.currentTime = Number(seekBar.value);
    loveMomentEligible = auroraAudio.currentTime <= loveMomentLatestStart;
    currentTimeDisplay.textContent = formatTime(auroraAudio.currentTime);
  }
});

trayPhotos.forEach((photo) => photo.addEventListener('touchstart', startPhotoDrag, { passive: false }));
trayPhotos.forEach((photo) => photo.addEventListener('dragstart', (event) => event.preventDefault()));
trayPhotos.forEach((photo) => photo.addEventListener('contextmenu', (event) => event.preventDefault()));
document.addEventListener('touchmove', dragPhoto, { passive: false });
document.addEventListener('touchend', finishPhotoDrag, { passive: true });
document.addEventListener('touchcancel', finishPhotoDrag, { passive: true });
memoryClose.addEventListener('click', closeMemory);
continueButton.addEventListener('click', () => {
  if (placedPhotos === 4 && !puzzleFinished) finishAlbumPuzzle();
});

dial.addEventListener('touchstart', startTouch, { passive: false });
dial.addEventListener('touchmove', moveTouch, { passive: false });
dial.addEventListener('touchend', finishTouch, { passive: true });
dial.addEventListener('touchcancel', finishTouch, { passive: true });

document.querySelectorAll('.photo-frame img').forEach((image) => {
  image.addEventListener('error', () => image.classList.add('broken'));
});
