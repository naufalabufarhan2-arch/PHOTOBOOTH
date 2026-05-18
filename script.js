// Grab UI elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadLink = document.getElementById('downloadLink');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownText = document.getElementById('countdownText');
const flashOverlay = document.getElementById('flashOverlay');
const statusBadge = document.getElementById('statusBadge');
const captionInput = document.getElementById('captionInput');
const templateCards = document.querySelectorAll('.template-card');

const ctx = canvas.getContext('2d');

let activeTemplate = 'polaroid';
let countdownInterval = null;
let stream = null;

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

// Set active template
templateCards.forEach(card => {
  card.addEventListener('click', () => {
    templateCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    activeTemplate = card.dataset.template;
  });
});

// Trigger a realistic 3-second countdown before shooting
function startCaptureSequence() {
  // Hide UI buttons to prevent double click
  captureBtn.classList.add('hidden');
  resetBtn.classList.add('hidden');
  downloadLink.classList.add('hidden');
  
  // Show countdown UI
  countdownOverlay.classList.remove('hidden');
  statusBadge.textContent = "Smiling in 3...";
  statusBadge.classList.add('shooting');
  
  let timeLeft = 3;
  countdownText.textContent = timeLeft;

  // Sound effect alternative: simple audio synthesis
  playBeep(440, 100);

  countdownInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      countdownText.textContent = timeLeft;
      playBeep(440, 100);
    } else {
      clearInterval(countdownInterval);
      countdownOverlay.classList.add('hidden');
      triggerCameraFlash();
    }
  }, 1000);
}

// Synthesis audio beep using Web Audio API (adds immense premium feedback!)
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
    console.log("Audio not supported or allowed yet");
  }
}

// Flash effect & image acquisition
function triggerCameraFlash() {
  // Play capture sound
  playBeep(880, 200);

  // Flash UI
  flashOverlay.style.opacity = '1';
  setTimeout(() => {
    flashOverlay.style.transition = 'opacity 0.6s ease';
    flashOverlay.style.opacity = '0';
  }, 50);

  // Grab frame & render template
  captureAndProcessImage();
}

// Captures video frame, centers it to aspect-ratio, overlays gorgeous custom frames programmatically
function captureAndProcessImage() {
  const customCaption = captionInput.value.trim();
  const dateStr = new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Background Frame Color/Gradient first depending on template
  drawTemplateBackground();

  // 2. Draw Camera Image (centered & cropped appropriately)
  // Define photo borders/offset inside template
  const borderOffset = 30; // Space around photo frame
  const bottomOffset = 120; // Bottom space for text and decorative signature
  
  const targetX = borderOffset;
  const targetY = borderOffset;
  const targetWidth = canvas.width - (borderOffset * 2);
  const targetHeight = canvas.height - borderOffset - bottomOffset;

  // Crop the source video correctly to 4:5 ratio
  const sourceAspectRatio = video.videoWidth / video.videoHeight;
  const targetAspectRatio = targetWidth / targetHeight;

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

  // Draw scaled video frame onto canvas
  ctx.drawImage(video, sx, sy, sWidth, sHeight, targetX, targetY, targetWidth, targetHeight);

  // 3. Draw Overlay Designs / Frame borders & Custom Text
  drawTemplateOverlay(targetX, targetY, targetWidth, targetHeight, customCaption, dateStr);

  // 4. Update UI to show the picture
  canvas.style.opacity = '1';
  video.style.opacity = '0';
  statusBadge.classList.remove('shooting');
  statusBadge.textContent = "FOTO BERHASIL DISIMPAN DI BAWAH!";

  // 5. Update download link
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.classList.remove('hidden');
    resetBtn.classList.remove('hidden');
  }, 'image/png');
}

// Dynamic template backgrounds
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

// Draw overlays, captions, graphics on top of the image
function drawTemplateOverlay(imgX, imgY, imgW, imgH, caption, dateTime) {
  // Common inner border outline for photo frame
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 2;
  ctx.strokeRect(imgX, imgY, imgW, imgH);

  const textY = canvas.height - 50;

  if (activeTemplate === 'polaroid') {
    // Polaroid typography
    ctx.fillStyle = '#222222';
    
    // Draw caption (Left side)
    ctx.font = 'bold 36px "Satisfy", cursive, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(caption || "Happy Moments ✨", imgX + 15, textY);

    // Draw date (Right side)
    ctx.font = '500 16px "Outfit", sans-serif';
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'right';
    ctx.fillText(dateTime, imgX + imgW - 15, textY - 5);

  } else if (activeTemplate === 'pastel') {
    // Cute hearts in the corners
    ctx.font = '24px serif';
    ctx.fillText('💖', imgX + 15, imgY + 35);
    ctx.fillText('⭐', imgX + imgW - 35, imgY + 35);

    // Pastel Typography
    ctx.fillStyle = '#4f46e5';
    ctx.font = 'bold 30px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption || "Lovely Day 💕", canvas.width / 2, textY);

    // Cute watermark
    ctx.font = '500 14px "Outfit", sans-serif';
    ctx.fillStyle = 'rgba(79, 70, 229, 0.6)';
    ctx.fillText(`MALL PHOTOBOX • ${dateTime}`, canvas.width / 2, textY + 25);

  } else if (activeTemplate === 'cyberpunk') {
    // Cyber punk glow lines
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.strokeRect(imgX - 4, imgY - 4, imgW + 8, imgH + 8);

    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(imgX - 10, imgY - 10, imgW + 20, imgH + 20);

    // Digital text
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`[ ${caption.toUpperCase() || "SYSTEM RUN"} ]`, imgX, textY);

    ctx.fillStyle = '#ec4899';
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SYS.DATE: ${dateTime}`, imgX + imgW, textY - 5);
    ctx.fillText("STATUS: SECURE_CAP", imgX + imgW, textY + 15);

  } else if (activeTemplate === 'minimalist') {
    // Thin gold inner border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(imgX - 4, imgY - 4, imgW + 8, imgH + 8);

    // Elegant luxury serif font
    ctx.fillStyle = '#d4af37';
    ctx.font = 'bold 28px serif';
    ctx.textAlign = 'center';
    ctx.fillText(caption.toUpperCase() || "M E M O R I E S", canvas.width / 2, textY);

    ctx.font = 'italic 14px serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(dateTime, canvas.width / 2, textY + 25);
  }
}

// Reset photo status and camera views
function resetPhoto() {
  canvas.style.opacity = '0';
  video.style.opacity = '1';
  
  captureBtn.classList.remove('hidden');
  resetBtn.classList.add('hidden');
  downloadLink.classList.add('hidden');
  
  statusBadge.textContent = "Ready to shoot";
  statusBadge.classList.remove('shooting');
}

// Event bindings
captureBtn.addEventListener('click', startCaptureSequence);
resetBtn.addEventListener('click', resetPhoto);
window.addEventListener('load', initCamera);
