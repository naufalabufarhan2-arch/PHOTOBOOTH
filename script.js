// script.js
// Access DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const downloadLink = document.getElementById('downloadLink');
const resetBtn = document.getElementById('resetBtn');
const timeDisplay = document.getElementById('timeDisplay');
const placeholder = document.getElementById('placeholder');
const ctx = canvas.getContext('2d');

// Initialize webcam
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
  } catch (e) {
    alert('Unable to access the camera. Please grant permission and try again.');
    console.error(e);
  }
}

// Capture a photo
function capturePhoto() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.style.opacity = '1';
  video.style.opacity = '0.2';
  placeholder.classList.add('hidden');

  // Show timestamp
  const now = new Date();
  timeDisplay.textContent = now.toLocaleTimeString();
  timeDisplay.classList.remove('hidden');

  // Show download link
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.style.display = 'inline-block';
  }, 'image/png');

  // Show reset button
  resetBtn.classList.remove('hidden');
}

// Reset to initial state
function resetPhoto() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.style.opacity = '0';
  video.style.opacity = '1';
  placeholder.classList.remove('hidden');

  downloadLink.style.display = 'none';
  resetBtn.classList.add('hidden');
  timeDisplay.classList.add('hidden');
}

// Event listeners
captureBtn.addEventListener('click', capturePhoto);
resetBtn.addEventListener('click', resetPhoto);
window.addEventListener('load', initCamera);
