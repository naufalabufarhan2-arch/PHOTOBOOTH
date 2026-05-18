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
const filterCards = document.querySelectorAll('.filter-card');
const stickerCards = document.querySelectorAll('.sticker-card');

const ctx = canvas.getContext('2d');

// Configurations
let activeTemplate = 'polaroid';
let activeLayout = 'four-cuts';
let activeFilter = 'normal';
let activeSticker = 'none';
let countdownInterval = null;
let stream = null;
let photosTaken = []; // Array of offscreen canvases holding intermediate shots
let isDemoMode = false;

// Layout definitions (Dynamic canvas sizes)
const LAYOUTS = {
  'four-cuts': { photosNeeded: 4, width: 360, height: 1150 },
  'grid-2x2': { photosNeeded: 4, width: 640, height: 820 },
  'three-cuts': { photosNeeded: 3, width: 360, height: 880 },
  'single-shot': { photosNeeded: 1, width: 600, height: 750 },
  // Advanced layouts
  'combo-grid': { photosNeeded: 4, width: 600, height: 920 },      // 1 Big, 3 Small
  'grid-2x3': { photosNeeded: 6, width: 640, height: 1050 },      // 2x3 grid
  'double-landscape': { photosNeeded: 2, width: 600, height: 750 },// 2 wide photos
  'double-portrait': { photosNeeded: 2, width: 360, height: 680 }, // 2 narrow photos
  
  // 4 New extra layouts
  'trio-combo': { photosNeeded: 3, width: 600, height: 850 },       // 1 Big, 2 Small
  'grid-2x2-wide': { photosNeeded: 4, width: 640, height: 820 },   // 2x2 Landscape
  'trio-portrait': { photosNeeded: 3, width: 360, height: 880 },   // 3 square slots stacked
  'double-strip-3': { photosNeeded: 6, width: 640, height: 950 }   // 2 strips of 3 side-by-side
};

// Expanded Pose Recommendations for up to 6 poses
const POSE_IDEAS = [
  "Pose 1: Smile! 😃",
  "Pose 2: Give a Heart! 🫶",
  "Pose 3: Wink! 😉",
  "Pose 4: Go Crazy! 🤪",
  "Pose 5: Cool Swag! 😎",
  "Pose 6: Peace Sign! ✌️"
];

// Initialize camera with automatic Demo Fallback for local files & blocked permissions
async function initCamera() {
  try {
    // If raw local file is detected, browser blocks webcam by default due to Chromium sandbox rules
    if (window.location.protocol === 'file:') {
      console.warn("Raw local file protocol detected. Activating Premium Demo Fallback Mode.");
      enableDemoMode("DEMO MODE (Local File Fallback)");
      return;
    }

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
    isDemoMode = false;
  } catch (e) {
    console.error("Camera access failed, falling back to Demo Mode:", e);
    enableDemoMode("DEMO MODE (Webcam Blocked)");
  }
}

// Activates highly graphical, automated simulated pose generator
function enableDemoMode(statusText) {
  isDemoMode = true;
  statusBadge.textContent = statusText;
  statusBadge.style.color = '#fbbf24'; // Golden warning
  
  // Hide live video feed and activate beautiful custom animated wrapper
  video.style.display = 'none';
  const wrapper = document.querySelector('.camera-wrapper');
  if (wrapper) {
    wrapper.classList.add('demo-active');
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

// Bind Filter selectors (Dynamic Live Video Feed and Canvas rendering)
filterCards.forEach(card => {
  card.addEventListener('click', () => {
    filterCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeFilter = card.dataset.filter;
    
    // Apply real-time visual filter class to live camera
    video.className = 'filter-' + activeFilter;
    
    // Live update final canvas preview
    if (photosTaken.length > 0) {
      renderFinalLayout();
    }
  });
});

// Bind Cute Sticker selectors (Live Canvas rendering)
stickerCards.forEach(card => {
  card.addEventListener('click', () => {
    stickerCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeSticker = card.dataset.sticker;
    
    // Live update final canvas preview
    if (photosTaken.length > 0) {
      renderFinalLayout();
    }
  });
});

// Start sequential capture based on active layout limits
function startCaptureSequence() {
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

// Grabs and stores high-resolution raw camera frame (with procedural generator for Demo Fallback)
function grabVideoFrame() {
  const offscreen = document.createElement('canvas');
  const oCtx = offscreen.getContext('2d');
  
  if (isDemoMode) {
    // Generate an incredibly premium, cute stylized avatar frame!
    offscreen.width = 640;
    offscreen.height = 480;
    
    // 1. Beautiful vibrant linear gradient background based on photo index
    const count = photosTaken.length;
    const grads = [
      ['#f43f5e', '#ec4899'], // Red-Pink
      ['#3b82f6', '#06b6d4'], // Blue-Cyan
      ['#10b981', '#34d399'], // Green
      ['#8b5cf6', '#a78bfa'], // Purple
      ['#f59e0b', '#fbbf24'], // Orange-Gold
      ['#6366f1', '#a855f7']  // Indigo-Purple
    ];
    const activeGrad = grads[count % grads.length];
    
    const g = oCtx.createLinearGradient(0, 0, 640, 480);
    g.addColorStop(0, activeGrad[0]);
    g.addColorStop(1, activeGrad[1]);
    oCtx.fillStyle = g;
    oCtx.fillRect(0, 0, 640, 480);
    
    // 2. Draw modern vector smiley mascot character
    oCtx.save();
    oCtx.shadowColor = 'rgba(0,0,0,0.3)';
    oCtx.shadowBlur = 10;
    
    // Avatar Body
    oCtx.fillStyle = '#ffffff';
    oCtx.beginPath();
    oCtx.arc(320, 240, 90, 0, 2 * Math.PI);
    oCtx.fill();
    
    // Cute blush cheeks
    oCtx.fillStyle = '#fca5a5';
    oCtx.beginPath();
    oCtx.arc(260, 255, 14, 0, 2 * Math.PI);
    oCtx.arc(380, 255, 14, 0, 2 * Math.PI);
    oCtx.fill();
    
    // Eyes
    oCtx.fillStyle = '#1e293b';
    oCtx.beginPath();
    oCtx.arc(270, 230, 8, 0, 2 * Math.PI);
    oCtx.arc(370, 230, 8, 0, 2 * Math.PI);
    oCtx.fill();
    
    // Cute smile
    oCtx.strokeStyle = '#1e293b';
    oCtx.lineWidth = 6;
    oCtx.lineCap = 'round';
    oCtx.beginPath();
    oCtx.arc(320, 250, 40, 0, Math.PI); // Half circle smile
    oCtx.stroke();
    
    // Bottom banner tag
    oCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    oCtx.fillRect(0, 400, 640, 80);
    oCtx.fillStyle = '#ffffff';
    oCtx.font = 'bold 22px monospace';
    oCtx.textAlign = 'center';
    oCtx.fillText(`TRE-PAGI A • POSE RECOMMENDED: POSE ${count + 1}`, 320, 445);
    
    oCtx.restore();
    return offscreen;
  }
  
  // Store high resolution raw frame matching input video dimensions
  offscreen.width = video.videoWidth || 1280;
  offscreen.height = video.videoHeight || 720;
  oCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
  return offscreen;
}

// Dynamic slot crop algorithm: crops snapshot to perfectly fit target dimensions
function drawPhotoToSlot(snapshot, targetX, targetY, targetWidth, targetHeight) {
  const sourceAspectRatio = snapshot.width / snapshot.height;
  const targetAspectRatio = targetWidth / targetHeight;

  let sx, sy, sWidth, sHeight;
  if (sourceAspectRatio > targetAspectRatio) {
    sHeight = snapshot.height;
    sWidth = snapshot.height * targetAspectRatio;
    sx = (snapshot.width - sWidth) / 2;
    sy = 0;
  } else {
    sWidth = snapshot.width;
    sHeight = snapshot.width / targetAspectRatio;
    sx = 0;
    sy = (snapshot.height - sHeight) / 2;
  }

  // Determine Canvas filter
  let canvasFilter = 'none';
  if (activeFilter === 'grayscale') canvasFilter = 'grayscale(1)';
  else if (activeFilter === 'vintage') canvasFilter = 'sepia(0.7) contrast(1.15) brightness(0.95)';
  else if (activeFilter === 'cyan') canvasFilter = 'hue-rotate(180deg) saturate(1.2)';
  else if (activeFilter === 'blush') canvasFilter = 'sepia(0.15) saturate(1.25) hue-rotate(330deg)';
  else if (activeFilter === 'vivid') canvasFilter = 'saturate(1.6) contrast(1.15)';

  ctx.save();
  ctx.filter = canvasFilter;
  ctx.drawImage(snapshot, sx, sy, sWidth, sHeight, targetX, targetY, targetWidth, targetHeight);
  ctx.restore();

  // Draw cute emojis and stickers on top of the slot
  drawStickersToSlot(targetX, targetY, targetWidth, targetHeight);
}

// Draws cute high-resolution emoji stickers programmatically over photo slots
function drawStickersToSlot(x, y, w, h) {
  if (activeSticker === 'none') return;
  
  ctx.save();
  // Ensure cute modern emojis display on Windows, iOS, Android, and macOS beautifully
  ctx.font = '36px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  
  // High contrast shadow drop for stickers readability on any lighting
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  if (activeSticker === 'cat') {
    // Cute Cat Ears Dekorasii
    ctx.fillText('🐱', x + w / 2, y + 25);
    ctx.font = '22px "Segoe UI Emoji"';
    ctx.fillText('🌸', x + 25, y + h - 25);
    ctx.fillText('🌸', x + w - 25, y + h - 25);

  } else if (activeSticker === 'crown') {
    // Golden crown floating
    ctx.fillText('👑', x + w / 2, y + 25);
    ctx.font = '20px "Segoe UI Emoji"';
    ctx.fillText('✨', x + w / 2 - 35, y + 35);
    ctx.fillText('✨', x + w / 2 + 35, y + 35);

  } else if (activeSticker === 'sparkles') {
    // Magic glowing sparkles
    ctx.font = '28px "Segoe UI Emoji"';
    ctx.fillText('✨', x + 25, y + 25);
    ctx.fillText('✨', x + w - 25, y + h - 25);
    ctx.fillText('💫', x + w - 28, y + 30);
    ctx.fillText('🌟', x + 28, y + h - 30);

  } else if (activeSticker === 'glasses') {
    // Funny retro cool shades worn in face area
    ctx.font = '42px "Segoe UI Emoji"';
    ctx.fillText('🕶️', x + w / 2, y + h * 0.45);

  } else if (activeSticker === 'hearts') {
    // Lovely hearts
    ctx.font = '28px "Segoe UI Emoji"';
    ctx.fillText('💖', x + 25, y + 25);
    ctx.fillText('💝', x + w - 25, y + 25);
    ctx.fillText('💕', x + w / 2, y + h - 30);

  } else if (activeSticker === 'devil') {
    // Cute little devil
    ctx.fillText('😈', x + w / 2, y + 25);
    ctx.font = '22px "Segoe UI Emoji"';
    ctx.fillText('🔥', x + 25, y + h - 25);
    ctx.fillText('🔥', x + w - 25, y + h - 25);

  } else if (activeSticker === 'blush') {
    // Blushing sweet face cheeks
    ctx.font = '30px "Segoe UI Emoji"';
    ctx.fillText('😊', x + 35, y + h - 35);
    ctx.fillText('😊', x + w - 35, y + h - 35);
  }

  ctx.restore();
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
      if (photosTaken[i]) {
        drawPhotoToSlot(photosTaken[i], borderOffset, targetY, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(borderOffset, targetY, slotWidth, slotHeight);
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
        drawPhotoToSlot(photosTaken[i], coord.x, coord.y, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(coord.x, coord.y, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'single-shot') {
    // Single Polaroid
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = canvas.height - borderOffset - bottomOffset;
    if (photosTaken[0]) {
      drawPhotoToSlot(photosTaken[0], borderOffset, borderOffset, slotWidth, slotHeight);
    }
    drawInnerFrameOutline(borderOffset, borderOffset, slotWidth, slotHeight);

  } else if (activeLayout === 'combo-grid') {
    // 1 Big + 3 Small (4 photos)
    const bigWidth = canvas.width - (borderOffset * 2);
    const bigHeight = (canvas.height - borderOffset - bottomOffset - gap) * 0.55;
    
    const smallWidth = (canvas.width - (borderOffset * 2) - (2 * gap)) / 3;
    const smallHeight = canvas.height - borderOffset - bottomOffset - gap - bigHeight;

    // Big Photo slot
    if (photosTaken[0]) {
      drawPhotoToSlot(photosTaken[0], borderOffset, borderOffset, bigWidth, bigHeight);
    }
    drawInnerFrameOutline(borderOffset, borderOffset, bigWidth, bigHeight);

    // Small photo slots
    for (let i = 0; i < 3; i++) {
      const targetX = borderOffset + i * (smallWidth + gap);
      const targetY = borderOffset + bigHeight + gap;
      if (photosTaken[i + 1]) {
        drawPhotoToSlot(photosTaken[i + 1], targetX, targetY, smallWidth, smallHeight);
      }
      drawInnerFrameOutline(targetX, targetY, smallWidth, smallHeight);
    }

  } else if (activeLayout === 'grid-2x3') {
    // 6 slots in a 2x3 Grid
    const slotWidth = (canvas.width - (borderOffset * 2) - gap) / 2;
    const slotHeight = (canvas.height - borderOffset - bottomOffset - (2 * gap)) / 3;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const i = row * 2 + col;
        const targetX = borderOffset + col * (slotWidth + gap);
        const targetY = borderOffset + row * (slotHeight + gap);
        if (photosTaken[i]) {
          drawPhotoToSlot(photosTaken[i], targetX, targetY, slotWidth, slotHeight);
        }
        drawInnerFrameOutline(targetX, targetY, slotWidth, slotHeight);
      }
    }

  } else if (activeLayout === 'double-landscape') {
    // 2 Wide Landscape Photos stacked vertically
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = (canvas.height - borderOffset - bottomOffset - gap) / 2;

    for (let i = 0; i < 2; i++) {
      const targetY = borderOffset + i * (slotHeight + gap);
      if (photosTaken[i]) {
        drawPhotoToSlot(photosTaken[i], borderOffset, targetY, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(borderOffset, targetY, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'double-portrait') {
    // 2 Narrow Portrait Photos stacked vertically
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = (canvas.height - borderOffset - bottomOffset - gap) / 2;

    for (let i = 0; i < 2; i++) {
      const targetY = borderOffset + i * (slotHeight + gap);
      if (photosTaken[i]) {
        drawPhotoToSlot(photosTaken[i], borderOffset, targetY, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(borderOffset, targetY, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'trio-combo') {
    // 1 Big + 2 Small (3 photos)
    const bigWidth = canvas.width - (borderOffset * 2);
    const bigHeight = (canvas.height - borderOffset - bottomOffset - gap) * 0.55;
    
    const smallWidth = (canvas.width - (borderOffset * 2) - gap) / 2;
    const smallHeight = canvas.height - borderOffset - bottomOffset - gap - bigHeight;

    // Big Photo slot
    if (photosTaken[0]) {
      drawPhotoToSlot(photosTaken[0], borderOffset, borderOffset, bigWidth, bigHeight);
    }
    drawInnerFrameOutline(borderOffset, borderOffset, bigWidth, bigHeight);

    // 2 Small slots
    for (let i = 0; i < 2; i++) {
      const targetX = borderOffset + i * (smallWidth + gap);
      const targetY = borderOffset + bigHeight + gap;
      if (photosTaken[i + 1]) {
        drawPhotoToSlot(photosTaken[i + 1], targetX, targetY, smallWidth, smallHeight);
      }
      drawInnerFrameOutline(targetX, targetY, smallWidth, smallHeight);
    }

  } else if (activeLayout === 'grid-2x2-wide') {
    // 2x2 Landscape grid
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
        drawPhotoToSlot(photosTaken[i], coord.x, coord.y, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(coord.x, coord.y, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'trio-portrait') {
    // 3 Square slots stacked vertically
    const slotWidth = canvas.width - (borderOffset * 2);
    const slotHeight = (canvas.height - borderOffset - bottomOffset - (2 * gap)) / 3;

    for (let i = 0; i < 3; i++) {
      const targetY = borderOffset + i * (slotHeight + gap);
      if (photosTaken[i]) {
        drawPhotoToSlot(photosTaken[i], borderOffset, targetY, slotWidth, slotHeight);
      }
      drawInnerFrameOutline(borderOffset, targetY, slotWidth, slotHeight);
    }

  } else if (activeLayout === 'double-strip-3') {
    // 2 strips of 3 side-by-side (6 Poses)
    const slotWidth = (canvas.width - (borderOffset * 2) - gap) / 2;
    const slotHeight = (canvas.height - borderOffset - bottomOffset - (2 * gap)) / 3;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const i = col * 3 + row; // Column-major indexing for dual strips
        const targetX = borderOffset + col * (slotWidth + gap);
        const targetY = borderOffset + row * (slotHeight + gap);
        if (photosTaken[i]) {
          drawPhotoToSlot(photosTaken[i], targetX, targetY, slotWidth, slotHeight);
        }
        drawInnerFrameOutline(targetX, targetY, slotWidth, slotHeight);
      }
    }
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

// Inner frame outline outline
function drawInnerFrameOutline(x, y, w, h) {
  ctx.strokeStyle = activeTemplate === 'minimalist' ? '#d4af37' : 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = activeTemplate === 'minimalist' ? 1.5 : 1;
  ctx.strokeRect(x, y, w, h);
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
  } else if (activeTemplate === 'cherry') {
    // Cherry blossom pink solid bg
    ctx.fillStyle = '#fff6f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'filmstrip') {
    // Solid dark film charcoal
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'vaporwave') {
    // Hot retro sunset neon
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(0.7, '#ff007f');
    grad.addColorStop(1, '#6b21a8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'y2k') {
    // Silver metallic chrome radial
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, canvas.height*0.7);
    grad.addColorStop(0, '#f1f5f9');
    grad.addColorStop(0.6, '#cbd5e1');
    grad.addColorStop(1, '#475569');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'newspaper') {
    // Retro Newsprint Cream
    ctx.fillStyle = '#fdfaf2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'matrix') {
    // Dark binary digital code black
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'sunset') {
    // Warm Golden Sunset gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#f97316'); // Orange
    grad.addColorStop(0.6, '#facc15'); // Gold
    grad.addColorStop(1, '#eab308'); // Amber
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (activeTemplate === 'denim') {
    // Indigo Denim fabric blue
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Overlay decoratives and text watermarks
function drawTemplateOverlay(margin, width, caption, dateTime) {
  const textY = canvas.height - 55;

  if (activeTemplate === 'polaroid') {
    ctx.fillStyle = '#222222';
    ctx.font = 'bold 32px "Satisfy", cursive, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(caption || "Happy Moments ✨", margin + 10, textY);

    ctx.font = '500 14px "Outfit", sans-serif';
    ctx.fillStyle = '#777777';
    ctx.textAlign = 'right';
    ctx.fillText(dateTime, margin + width - 10, textY + 5);

  } else if (activeTemplate === 'pastel') {
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 26px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "Lovely Day 💕", canvas.width / 2, textY);

    ctx.font = '600 13px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(79, 70, 229, 0.6)';
    ctx.fillText(`MALL PHOTOBOX • ${dateTime}`, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'cyberpunk') {
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
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption.toUpperCase() || "M E M O R I E S", canvas.width / 2, textY);

    ctx.font = 'italic 13px serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(dateTime, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'cherry') {
    // Cherry Blossom frame - programmatically draw branches/petals in margins
    ctx.save();
    
    // Top Branch
    ctx.beginPath();
    ctx.strokeStyle = '#653b2a';
    ctx.lineWidth = 3;
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(canvas.width/4, 25, canvas.width/2, 10);
    ctx.stroke();

    // Draw little cherry blossom petals
    ctx.fillStyle = '#fbcfe8';
    ctx.strokeStyle = '#db2777';
    ctx.lineWidth = 1;
    
    // Draw 4 circular cherry blossom circles
    const flowerX = [20, 60, 110, canvas.width - 50];
    const flowerY = [15, 25, 20, 20];
    
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(flowerX[i], flowerY[i], 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Typography
    ctx.fillStyle = '#db2777';
    ctx.font = 'bold 28px "Satisfy", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "Spring Bliss 🌸", canvas.width / 2, textY);

    ctx.font = '500 13px "Outfit", sans-serif';
    ctx.fillStyle = '#f472b6';
    ctx.fillText(dateTime, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'filmstrip') {
    // Vintage filmstrip - draw sprocket holes along margins
    ctx.save();
    ctx.fillStyle = '#ffffff';
    
    // Loop sprocket holes vertically
    const startY = margin;
    const endY = canvas.height - bottomOffset - 10;
    
    for (let y = startY; y < endY; y += 32) {
      // Left sprocket hole
      ctx.fillRect(margin/2 - 4, y, 8, 12);
      // Right sprocket hole
      ctx.fillRect(canvas.width - margin/2 - 4, y, 8, 12);
    }
    ctx.restore();

    // Vintage Typography
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🎞️ ${caption.toUpperCase() || "KODAK 400TX"}`, margin + 10, textY);

    ctx.font = '500 13px monospace';
    ctx.fillStyle = '#d97706';
    ctx.textAlign = 'right';
    ctx.fillText(`FRAME #24 - ${dateTime}`, margin + width - 10, textY + 5);

  } else if (activeTemplate === 'vaporwave') {
    // 80s Grid lines overlay in bottom panel
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
    ctx.lineWidth = 1;
    // Draw 3 horizontal grid lines near the bottom
    for (let gridY = canvas.height - bottomOffset; gridY < canvas.height; gridY += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gridY);
      ctx.lineTo(canvas.width, gridY);
      ctx.stroke();
    }
    ctx.restore();

    // Outrun typography
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 26px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "OUTRUN RETRO 🌴", canvas.width / 2, textY);
    ctx.restore();

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.fillText(`EST. 198X • ${dateTime}`, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'y2k') {
    // Y2K Metallic sparkly stars
    ctx.save();
    ctx.fillStyle = '#ffffff';
    
    // Draw 4-point Y2K sparkles
    const drawSparkle = (cx, cy, size) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - size);
      ctx.quadraticCurveTo(cx, cy, cx + size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy + size);
      ctx.quadraticCurveTo(cx, cy, cx - size, cy);
      ctx.quadraticCurveTo(cx, cy, cx, cy - size);
      ctx.fill();
    };

    drawSparkle(margin + 20, textY - 10, 10);
    drawSparkle(canvas.width - margin - 20, textY + 15, 8);
    ctx.restore();

    // Futurist blue text
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 25px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "STARRY DREAM ✨", canvas.width / 2, textY);

    ctx.font = '800 13px "Outfit", sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText(`Y2K SPACE • ${dateTime}`, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'newspaper') {
    // Newspaper border styling (vintage cream and black ink lines)
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    // Draw horizontal separator line above bottom panel
    ctx.beginPath();
    ctx.moveTo(margin, canvas.height - bottomOffset + 10);
    ctx.lineTo(canvas.width - margin, canvas.height - bottomOffset + 10);
    ctx.stroke();

    // Newspaper Typography
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 24px "Outfit", serif, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🗞️ TRE DAILY PRESS: ${caption.toUpperCase() || "CLASSIC EDITION"}`, canvas.width / 2, textY);

    ctx.font = 'bold italic 12px serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(`PUBLISHED ON ${dateTime} • PRICE: FREE`, canvas.width / 2, textY + 25);
    ctx.restore();

  } else if (activeTemplate === 'matrix') {
    // Matrix neon binary code drop down graphics
    ctx.save();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.font = '10px monospace';
    // Draw columns of binary code inside vertical borders
    for (let x = 6; x < margin; x += 10) {
      for (let y = margin; y < canvas.height - 20; y += 14) {
        if (Math.random() > 0.4) {
          ctx.fillText(Math.random() > 0.5 ? "1" : "0", x, y);
          ctx.fillText(Math.random() > 0.5 ? "0" : "1", canvas.width - x - 4, y);
        }
      }
    }
    
    // Digital green glowing text
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`> ${caption.toUpperCase() || "MAINFRAME_"}`, margin + 10, textY);

    ctx.font = '13px monospace';
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'right';
    ctx.fillText(`SEC_PORT: ${dateTime}`, margin + width - 10, textY + 5);
    ctx.restore();

  } else if (activeTemplate === 'sunset') {
    // Warm Sunset glow sparkles
    ctx.save();
    ctx.fillStyle = '#78350f';
    
    // Sparkles
    const drawSunsetSparkle = (x, y, r) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
    };
    ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
    drawSunsetSparkle(margin + 20, textY - 10, 6);
    drawSunsetSparkle(canvas.width - margin - 20, textY + 10, 4);

    // Warm elegant calligraphy text
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 30px "Satisfy", cursive, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "Golden Hour 🌅", canvas.width / 2, textY);

    ctx.font = '600 13px "Outfit", sans-serif';
    ctx.fillStyle = '#92400e';
    ctx.fillText(`SUNSET VIBES • ${dateTime}`, canvas.width / 2, textY + 25);
    ctx.restore();

  } else if (activeTemplate === 'denim') {
    // Denim jeans stitches along borders
    ctx.save();
    ctx.strokeStyle = '#fbbf24'; // Yellow stitching thread
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]); // Dashed stitch effect!
    
    // Outer border stitch
    const stitchOffset = 8;
    ctx.strokeRect(stitchOffset, stitchOffset, canvas.width - (stitchOffset * 2), canvas.height - (stitchOffset * 2));
    
    // Stitch around bottom text panel
    ctx.beginPath();
    ctx.moveTo(stitchOffset, canvas.height - bottomOffset + 10);
    ctx.lineTo(canvas.width - stitchOffset, canvas.height - bottomOffset + 10);
    ctx.stroke();
    
    // Denim Typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`👖 ${caption.toUpperCase() || "DENIM CLASSICS"}`, canvas.width / 2, textY);

    ctx.font = '800 13px monospace';
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`90S ED. // ${dateTime}`, canvas.width / 2, textY + 25);
    ctx.restore();
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
