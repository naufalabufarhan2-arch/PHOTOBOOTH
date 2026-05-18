// Grab UI elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadLink = document.getElementById('downloadLink');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const poseIndicator = document.getElementById('poseIndicator');
const flashOverlay = document.getElementById('flashOverlay');
const statusBadge = document.getElementById('statusBadge');
const captionInput = document.getElementById('captionInput');
const templateCards = document.querySelectorAll('.template-card');
const layoutCards = document.querySelectorAll('.layout-card');

const ctx = canvas.getContext('2d');

// Configurations
let activeTemplate = 'polaroid';
let activeLayout = 'four-cuts';
let countdownInterval = null;
let stream = null;
let photosTaken = []; // Array of offscreen canvases holding intermediate shots

// Layout definitions
const LAYOUTS = {
  'four-cuts': { photosNeeded: 4, width: 360, height: 1150 },
  'grid-2x2': { photosNeeded: 4, width: 640, height: 820 },
  'three-cuts': { photosNeeded: 3, width: 360, height: 880 },
  'single-shot': { photosNeeded: 1, width: 600, height: 750 }
};

// Fun Pose Recommendations
const POSE_IDEAS = [
  "Pose 1: Smile! 😃",
  "Pose 2: Give a Heart! 🫶",
  "Pose 3: Wink! 😉",
  "Pose 4: Go Crazy! 🤪"
];

// Initialize camera
async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
      }, 
      audio: false 
    });
    video.srcObject = stream;
    statusBadge.textContent = "Ready to shoot";
  } catch (e) {
    statusBadge.textContent = "Camera Error";
    alert('Could not access your camera. Please make sure to grant camera permissions.');
    console.error(e);
  }
}

// Bind Template selectors
templateCards.forEach(card => {
  card.addEventListener('click', () => {
    templateCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeTemplate = card.dataset.template;
    // Re-render if there's already captured photos
    if (photosTaken.length > 0) {
      renderFinalLayout();
    }
  });
});

// Bind Layout selectors
layoutCards.forEach(card => {
  card.addEventListener('click', () => {
    layoutCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeLayout = card.dataset.layout;
    
    // Auto-adjust preview canvas size ratio in real time
    const layoutConfig = LAYOUTS[activeLayout];
    canvas.width = layoutConfig.width;
    canvas.height = layoutConfig.height;

    // Reset captured photos if layout changes to prevent mismatched grids
    resetPhoto();
  });
});

// Start sequential capture based on active layout limits
function startCaptureSequence() {
  // Hide UI buttons to prevent double click
  captureBtn.classList.add('hidden');
  resetBtn.classList.add('hidden');
  downloadLink.classList.add('hidden');
  
  photosTaken = [];
  const totalPhotos = LAYOUTS[activeLayout].photosNeeded;
  
  capturePose(0, totalPhotos);
}

// Recursive function to capture each pose sequentially
function capturePose(index, total) {
  countdownOverlay.classList.remove('hidden');
  
  // Update indicators
  poseIndicator.textContent = POSE_IDEAS[index] || `Pose ${index + 1} of ${total}`;
  statusBadge.textContent = `Capturing Pose ${index + 1}...`;
  statusBadge.classList.add('shooting');
  
  let timeLeft = 3;
  countdownText.textContent = timeLeft;
  playBeep(440, 100);

  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      countdownText.textContent = timeLeft;
      playBeep(440, 100);
    } else {
      clearInterval(countdownInterval);
      
      // Flash screen & Take Snapshot
      triggerCameraFlash(() => {
        // Save intermediate frame
        const snapshot = grabVideoFrame();
        photosTaken.push(snapshot);
        
        countdownOverlay.classList.add('hidden');
        
        // Check if we need more shots
        if (photosTaken.length < total) {
          statusBadge.textContent = "Prepare next pose!";
          setTimeout(() => {
            capturePose(index + 1, total);
          }, 1500); // 1.5 seconds gap to change pose
        } else {
          // All taken! Draw composite layout
          renderFinalLayout();
        }
      });
    }
  }, 1000);
}

// Audio feedback synthesiser
function playBeep(freq, duration) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration/1000);
    osc.start();
    osc.stop(audioCtx.currentTime + duration/1000);
  } catch (e) {
    console.log("Audio feedback skipped");
  }
}

// Camera Flash effect
function triggerCameraFlash(callback) {
  playBeep(880, 200);

  flashOverlay.style.opacity = '1';
  setTimeout(() => {
    flashOverlay.style.transition = 'opacity 0.6s ease';
    flashOverlay.style.opacity = '0';
    if (callback) callback();
  }, 100);
}

// Crops and captures the current video frame into an offscreen canvas
function grabVideoFrame() {
  const offscreen = document.createElement('canvas');
  const oCtx = offscreen.getContext('2d');
  
  // Standard slot size (portrait 4:3 or similar)
  offscreen.width = 400;
  offscreen.height = 300;
  
  // Crop the source video correctly to fill the 4:3 offscreen slot
  const sourceAspectRatio = video.videoWidth / video.videoHeight;
  const targetAspectRatio = offscreen.width / offscreen.height;

  let sx, sy, sWidth, sHeight;
  if (sourceAspectRatio > targetAspectRatio) {
    sHeight = video.videoHeight;
    sWidth = video.videoHeight * targetAspectRatio;
    sx = (video.videoWidth - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = video.videoWidth;
    sHeight = video.videoWidth / targetAspectRatio;
    sx = 0;
    sy = (video.videoHeight - sHeight) / 2;
  }

  oCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, offscreen.width, offscreen.height);
  return offscreen;
}

// Combines all captured poses onto the final Canvas with frame background and overlays
function renderFinalLayout() {
  const config = LAYOUTS[activeLayout];
  canvas.width = config.width;
  canvas.height = config.height;
  
  const customCaption = captionInput.value.trim();
  const dateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Template Frame Color/Gradient
  drawTemplateBackground();

  // 2. Draw slots based on Layout Selection
  const borderOffset = 24;
  const bottomOffset = 130;
  const gap = 16;
  const needed = config.photosNeeded;

  if (activeLayout === 'four-cuts' || activeLayout === 'three-cuts') {
    // Single Column vertical strip
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = (canvas.height - borderOffset - bottomOffset - ((needed - 1) * gap)) / needed;

    for (let i = 0; i < needed; i++) {
      const targetY = borderOffset + i * (slotHeight + gap);
      // Draw intermediate photo
      if (photosTaken[i]) {
        ctx.drawImage(photosTaken[i], borderOffset, targetY, slotWidth, slotHeight);
      }
      // Add thin outline around photo
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(borderOffset, targetY, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'grid-2x2') {
    // 2x2 grid slots
    const slotWidth = (canvas.width - (borderOffset * 2) - gap) / 2;
    const slotHeight = (canvas.height - borderOffset - bottomOffset - gap) / 2;

    const coordinates = [
      { x: borderOffset, y: borderOffset },
      { x: borderOffset + slotWidth + gap, y: borderOffset },
      { x: borderOffset, y: borderOffset + slotHeight + gap },
      { x: borderOffset + slotWidth + gap, y: borderOffset + slotHeight + gap }
    ];

    for (let i = 0; i < 4; i++) {
      const coord = coordinates[i];
      if (photosTaken[i]) {
        ctx.drawImage(photosTaken[i], coord.x, coord.y, slotWidth, slotHeight);
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(coord.x, coord.y, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'single-shot') {
    // Single Polaroid
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = canvas.height - borderOffset - bottomOffset;
    if (photosTaken[0]) {
      ctx.drawImage(photosTaken[0], borderOffset, borderOffset, slotWidth, slotHeight);
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(borderOffset, borderOffset, slotWidth, slotHeight);
  }

  // 3. Draw Watermark, captions, logos at bottom
  drawTemplateOverlay(borderOffset, canvas.width - (borderOffset * 2), customCaption, dateStr);

  // 4. Show final result
  canvas.style.opacity = '1';
  video.style.opacity = '0';
  statusBadge.classList.remove('shooting');
  statusBadge.textContent = "Strip Created Successfully!";

  // 5. Enable Save link
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  }, 'image/png');
}

// Background fills for frame templates
function drawTemplateBackground() {
  if (activeTemplate === 'polaroid') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'pastel') {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#ff9a9e');
    grad.addColorStop(0.5, '#fecfef');
    grad.addColorStop(1, '#a1c4fd');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'cyberpunk') {
    ctx.fillStyle = '#0a0516';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'minimalist') {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Overlay decoratives and text watermarks
function drawTemplateOverlay(margin, width, caption, dateTime) {
  const textY = canvas.height - 55;

  if (activeTemplate === 'polaroid') {
    ctx.fillStyle = '#222222';
    
    // Caption (left aligned)
    ctx.font = 'bold 32px "Satisfy", cursive, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(caption || "Happy Moments ✨", margin + 10, textY);

    // Timestamp (right aligned)
    ctx.font = '500 14px "Outfit", sans-serif';
    ctx.fillStyle = '#777777';
    ctx.textAlign = 'right';
    ctx.fillText(dateTime, margin + width - 10, textY + 5);

  } else if (activeTemplate === 'pastel') {
    ctx.fillStyle = '#4f46e5';
    
    // Caption (center)
    ctx.font = 'bold 26px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "Lovely Day 💕", canvas.width / 2, textY);

    // Watermark
    ctx.font = '600 13px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(79, 70, 229, 0.6)';
    ctx.fillText(`MALL PHOTOBOX • ${dateTime}`, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'cyberpunk') {
    // Neon neon glow borders on bottom text area
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`[ ${caption.toUpperCase() || "SYSTEM RUN"} ]`, margin, textY);

    ctx.fillStyle = '#ec4899';
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SYS.DATE: ${dateTime}`, margin + width, textY);
    ctx.fillText("STATUS: COMPOSITE_OK", margin + width, textY + 18);

  } else if (activeTemplate === 'minimalist') {
    ctx.fillStyle = '#d4af37';
    
    // Serif luxury lettering
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption.toUpperCase() || "M E M O R I E S", canvas.width / 2, textY);

    ctx.font = 'italic 13px serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(dateTime, canvas.width / 2, textY + 25);
  }
}

// Reset photobooth state
function resetPhoto() {
  canvas.style.opacity = '0';
  video.style.opacity = '1';
  
  captureBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');
  downloadLink.classList.add('hidden');
  
  photosTaken = [];
  statusBadge.textContent = "Ready to shoot";
  statusBadge.classList.remove('shooting');
  if (countdownInterval) clearInterval(countdownInterval);
  countdownOverlay.classList.add('hidden');
}

// Event bindings
captureBtn.addEventListener('click', startCaptureSequence);
resetBtn.addEventListener('click', resetPhoto);
window.addEventListener('load', () => {
  initCamera();
  // Set default canvas size
  const config = LAYOUTS[activeLayout];
  canvas.width = config.width;
  canvas.height = config.height;
});
