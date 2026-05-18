// script.js
// Access DOM elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const downloadLink = document.getElementById('downloadLink');
const ctx = canvas.getContext('2d');

// Initialize webcam stream
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
  } catch (e) {
    alert('Unable to access the camera. Please grant permission and try again.');
    console.error(e);
  }
}

// Capture a photo from the video stream
function capturePhoto() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Visual feedback
  canvas.style.opacity = '1';
  video.style.opacity = '0.2';
  // Prepare download link
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.style.display = 'inline-block';
  }, 'image/png');
}

// Event listeners
captureBtn.addEventListener('click', capturePhoto);
window.addEventListener('load', initCamera);
