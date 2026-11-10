// Shared canvas double for the model builders: they paint procedural stone
// and flag textures, so the stub must expose the 2D calls they use.
function context2d() {
  return {
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect() {},
    strokeRect() {},
    clearRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    stroke() {},
    fill() {},
    fillText() {},
    strokeText() {},
    measureText: () => ({ width: 10 }),
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    createRadialGradient: () => ({ addColorStop() {} }),
    createLinearGradient: () => ({ addColorStop() {} }),
    getImageData: (x, y, w, h) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData() {},
  };
}

function createCanvas(tag) {
  return { tagName: tag, width: 0, height: 0, getContext: () => context2d() };
}

module.exports = { context2d, createCanvas };
