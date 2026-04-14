// State Variables
let isPlaying = false;
let scrollSpeed = 5;
let animationFrameId = null;
let canvasAnimationId = null;

// Streams
let cameraStream = null;

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

const mirrorBtn = document.getElementById('mirror-btn');
const recordBtn = document.getElementById('record-btn');
const downloadBtn = document.getElementById('download-btn');

// --- 0. Canvas State ---
// Canvas resolution is fixed to 1080p
const CANVAS_W = 1920;
const CANVAS_H = 1080;

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



mirrorBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
});

// --- 2. Canvas Rendering Engine ---
function drawCanvas() {
  // Clear and color background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Draw Camera Full Screen
  if (cameraStream && cameraVideo.readyState >= 2) {
    ctx.save();
    
    // Handle Mirroring
    if (isMirrored) {
      ctx.translate(CANVAS_W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(cameraVideo, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.drawImage(cameraVideo, 0, 0, CANVAS_W, CANVAS_H);
    }
    
    ctx.restore();
  } else {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#666';
    ctx.font = '60px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('جاري تحميل الكاميرا...', CANVAS_W/2, CANVAS_H/2);
  }

  canvasAnimationId = requestAnimationFrame(drawCanvas);
}

// Start Rendering loop
drawCanvas();



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
