// State Variables
let isPlaying = false;
let scrollSpeed = 5;
let animationFrameId = null;
let canvasAnimationId = null;

// Streams
let cameraStream = null;
let screenStream = null;

// Recording Variables
let mediaRecorder;
let recordedChunks = [];

// DOM Elements
const textContainer = document.querySelector('.prompter-container');
const prompterText = document.getElementById('prompter-text');
const speedSlider = document.getElementById('speed-slider');
const fontSlider = document.getElementById('font-size-slider');
const playPauseBtn = document.getElementById('play-pause-btn');

const composedCanvas = document.getElementById('composed-canvas');
const ctx = composedCanvas.getContext('2d');
const cameraVideo = document.getElementById('camera-video');
const screenVideo = document.getElementById('screen-video');

const mirrorBtn = document.getElementById('mirror-btn');
const shareScreenBtn = document.getElementById('share-screen-btn');
const recordBtn = document.getElementById('record-btn');
const downloadBtn = document.getElementById('download-btn');

// --- 0. Canvas & PiP State ---
// Canvas resolution is fixed to 1080p
const CANVAS_W = 1920;
const CANVAS_H = 1080;

let pip = {
  width: 480,
  height: 270,
  x: 1920 - 480 - 40, // bottom right with padding
  y: 1080 - 270 - 40,
  isDragging: false,
  offsetX: 0,
  offsetY: 0
};
let isMirrored = false;

// --- 1. Media Initialization ---
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
      audio: true 
    });
    cameraVideo.srcObject = cameraStream;
    cameraVideo.play();
  } catch (error) {
    console.error('Error accessing camera:', error);
    alert('تعذر الوصول للكاميرا والميكروفون. يرجى التأكد من الصلاحيات.');
  }
}

async function startScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: true // Optional: capture system audio
    });
    screenVideo.srcObject = screenStream;
    screenVideo.play();
    
    shareScreenBtn.innerHTML = '🛑 إيقاف المشاركة';
    shareScreenBtn.classList.replace('btn-primary', 'btn-record');

    // Handle user stopping stream from browser UI
    screenStream.getVideoTracks()[0].onended = stopScreenShare;
  } catch (error) {
    console.error('Error sharing screen:', error);
  }
}

function stopScreenShare() {
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
    screenVideo.srcObject = null;
    shareScreenBtn.innerHTML = '💻 مشاركة البرزنتيشن';
    shareScreenBtn.classList.replace('btn-record', 'btn-primary');
  }
}

shareScreenBtn.addEventListener('click', () => {
  if (screenStream) stopScreenShare();
  else startScreenShare();
});

mirrorBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
});

// --- 2. Canvas Rendering Engine ---
function drawCanvas() {
  // Clear and color background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw Screen
  if (screenStream && screenVideo.readyState >= 2) {
    // Fill canvas maintaining aspect ratio or let it stretch? Better to stretch or contain within 1080p
    // We'll draw it to fill the background
    ctx.drawImage(screenVideo, 0, 0, CANVAS_W, CANVAS_H);
  } else {
    // Placeholder if no screen shared
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#666';
    ctx.font = '60px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('الرجاء مشاركة الشاشة لعرض البرزنتيشن', CANVAS_W/2, CANVAS_H/2);
  }

  // Draw Camera (PiP)
  if (cameraStream && cameraVideo.readyState >= 2) {
    ctx.save();
    
    // Draw shadow/border for PiP
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#000';
    ctx.fillRect(pip.x, pip.y, pip.width, pip.height);
    
    ctx.shadowColor = 'transparent'; // Reset shadow for actual image
    
    // Handle Mirroring
    if (isMirrored) {
      ctx.translate(pip.x + pip.width / 2, pip.y + pip.height / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(cameraVideo, -pip.width / 2, -pip.height / 2, pip.width, pip.height);
    } else {
      ctx.drawImage(cameraVideo, pip.x, pip.y, pip.width, pip.height);
    }
    
    ctx.restore();
    
    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(pip.x, pip.y, pip.width, pip.height);
  }

  canvasAnimationId = requestAnimationFrame(drawCanvas);
}

// Start Rendering loop
drawCanvas();

// --- 3. Drag Logic for PiP ---
function getCanvasMousePos(e) {
  const rect = composedCanvas.getBoundingClientRect();
  const srcRatio = CANVAS_W / CANVAS_H;
  const dstRatio = rect.width / rect.height;
  
  let displayWidth = rect.width;
  let displayHeight = rect.height;
  let displayX = 0;
  let displayY = 0;
  
  if (srcRatio > dstRatio) {
    displayHeight = rect.width / srcRatio;
    displayY = (rect.height - displayHeight) / 2;
  } else {
    displayWidth = rect.height * srcRatio;
    displayX = (rect.width - displayWidth) / 2;
  }
  
  const x = ((e.clientX - rect.left - displayX) / displayWidth) * CANVAS_W;
  const y = ((e.clientY - rect.top - displayY) / displayHeight) * CANVAS_H;
  return { x, y };
}

function isInsidePiP(pos) {
  return pos.x >= pip.x && pos.x <= pip.x + pip.width &&
         pos.y >= pip.y && pos.y <= pip.y + pip.height;
}

composedCanvas.addEventListener('mousedown', (e) => {
  const pos = getCanvasMousePos(e);
  if (isInsidePiP(pos)) {
    pip.isDragging = true;
    pip.offsetX = pos.x - pip.x;
    pip.offsetY = pos.y - pip.y;
    composedCanvas.style.cursor = 'grabbing';
  }
});

window.addEventListener('mousemove', (e) => {
  if (pip.isDragging) {
    const pos = getCanvasMousePos(e);
    pip.x = pos.x - pip.offsetX;
    pip.y = pos.y - pip.offsetY;
    
    // Clamp to canvas bounds
    pip.x = Math.max(0, Math.min(pip.x, CANVAS_W - pip.width));
    pip.y = Math.max(0, Math.min(pip.y, CANVAS_H - pip.height));
  } else {
    const pos = getCanvasMousePos(e);
    if (isInsidePiP(pos)) {
      composedCanvas.style.cursor = 'grab';
    } else {
      composedCanvas.style.cursor = 'default';
    }
  }
});

window.addEventListener('mouseup', () => {
  pip.isDragging = false;
  composedCanvas.style.cursor = 'default';
});

// --- 4. Teleprompter Controls ---
speedSlider.addEventListener('input', (e) => {
  scrollSpeed = parseInt(e.target.value, 10);
});

fontSlider.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

function scrollText() {
  if (isPlaying) {
    const step = scrollSpeed * 0.2;
    textContainer.scrollTop += step;
    
    if (textContainer.scrollTop + textContainer.clientHeight >= textContainer.scrollHeight - 1) {
      togglePlayPause();
    } else {
      animationFrameId = requestAnimationFrame(scrollText);
    }
  }
}

function togglePlayPause() {
  isPlaying = !isPlaying;
  if (isPlaying) {
    playPauseBtn.innerHTML = '⏸ إيقاف مؤقت (Space)';
    prompterText.blur(); 
    animationFrameId = requestAnimationFrame(scrollText);
  } else {
    playPauseBtn.innerHTML = '▶ تشغيل (Space)';
    cancelAnimationFrame(animationFrameId);
  }
}

playPauseBtn.addEventListener('click', togglePlayPause);

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== prompterText) {
    e.preventDefault();
    togglePlayPause();
  }
});

// --- 5. Video Recording Logic ---
recordBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
});

function startRecording() {
  recordedChunks = [];
  
  // Combine Canvas Video Track with Camera Audio Track
  const outStream = new MediaStream();
  
  // 1. Get video from canvas
  const canvasStream = composedCanvas.captureStream(30); 
  if (canvasStream.getVideoTracks().length > 0) {
    outStream.addTrack(canvasStream.getVideoTracks()[0]);
  }
  
  // 2. Get audio from camera microphone
  if (cameraStream && cameraStream.getAudioTracks().length > 0) {
    outStream.addTrack(cameraStream.getAudioTracks()[0]);
  }

  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp8,opus' };
  }

  try {
    mediaRecorder = new MediaRecorder(outStream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    return;
  }

  mediaRecorder.onstop = (event) => {
    downloadBtn.classList.remove('hidden');
  };

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start();
  
  recordBtn.innerHTML = '⏹ إيقاف التسجيل';
  recordBtn.classList.add('recording');
  downloadBtn.classList.add('hidden');
}

function stopRecording() {
  if (mediaRecorder) {
    mediaRecorder.stop();
    recordBtn.innerHTML = '⏺ تسجيل مجدداً';
    recordBtn.classList.remove('recording');
  }
}

downloadBtn.addEventListener('click', () => {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  document.body.appendChild(a);
  a.style = 'display: none';
  a.href = url;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.download = `teleprompter-presentation-${timestamp}.webm`;
  
  a.click();
  window.URL.revokeObjectURL(url);
});

// Initialize Camera immediately
startCamera();
