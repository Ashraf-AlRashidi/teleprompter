// State Variables
let isPlaying = false;
let scrollSpeed = 5;
let animationFrameId = null;

// Recording Variables
let mediaRecorder;
let recordedChunks = [];
let stream;

// DOM Elements
const textContainer = document.querySelector('.prompter-container');
const prompterText = document.getElementById('prompter-text');
const speedSlider = document.getElementById('speed-slider');
const fontSlider = document.getElementById('font-size-slider');
const playPauseBtn = document.getElementById('play-pause-btn');
const webcam = document.getElementById('webcam');
const mirrorBtn = document.getElementById('mirror-btn');
const recordBtn = document.getElementById('record-btn');
const downloadBtn = document.getElementById('download-btn');

// --- 1. Camera Initialization ---
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }, 
      audio: true // Recording needs audio typically, even if video is muted on playback
    });
    webcam.srcObject = stream;
  } catch (error) {
    console.error('Error accessing media devices.', error);
    alert('تعذر الوصول للكاميرا والميكروفون. يرجى التأكد من الصلاحيات.');
  }
}

// --- 2. Mirror Functionality ---
let isMirrored = false;
mirrorBtn.addEventListener('click', () => {
  isMirrored = !isMirrored;
  webcam.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
});

// --- 3. Teleprompter Controls ---
speedSlider.addEventListener('input', (e) => {
  scrollSpeed = parseInt(e.target.value, 10);
});

fontSlider.addEventListener('input', (e) => {
  prompterText.style.fontSize = `${e.target.value}px`;
});

// --- 4. Scrolling Logic ---
function scrollText() {
  if (isPlaying) {
    // Scroll down mathematically (meaning text goes UP on screen)
    // The higher the speed, the larger the step
    const step = scrollSpeed * 0.2;
    textContainer.scrollTop += step;
    
    // Stop if reached the bottom
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
    // Remove focus from editable area so spacebar doesn't add spaces
    prompterText.blur(); 
    animationFrameId = requestAnimationFrame(scrollText);
  } else {
    playPauseBtn.innerHTML = '▶ تشغيل (Space)';
    cancelAnimationFrame(animationFrameId);
  }
}

playPauseBtn.addEventListener('click', togglePlayPause);

// Spacebar to play/pause (if text area is not focused)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && document.activeElement !== prompterText) {
    e.preventDefault(); // Prevent default scroll
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
  
  // Use webm format
  let options = { mimeType: 'video/webm;codecs=vp9,opus' };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) {
    options = { mimeType: 'video/webm;codecs=vp8,opus' };
  }

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    return;
  }

  mediaRecorder.onstop = (event) => {
    // Show download button when recording stops
    downloadBtn.classList.remove('hidden');
  };

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.start();
  
  // UI update
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
  a.download = `teleprompter-recording-${timestamp}.webm`;
  
  a.click();
  window.URL.revokeObjectURL(url);
});

// Initialize
startCamera();
