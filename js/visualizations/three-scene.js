export function initHeroScene(canvas) {
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (canvas) canvas.style.display = 'none';
    return null;
  }

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    canvas.style.display = 'none';
    return null;
  }

  const palette = ['#3b82f6', '#8b5cf6', '#10b981', '#06b6d4'];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 2 + 0.5,
    speed: Math.random() * 0.0008 + 0.0002,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));

  let frameId = 0;
  let last = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const animate = (now) => {
    const delta = Math.min(50, now - last);
    last = now;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const particle of particles) {
      particle.y -= particle.speed * delta;
      if (particle.y < -0.05) particle.y = 1.05;
      context.globalAlpha = 0.38;
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x * window.innerWidth, particle.y * window.innerHeight, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    frameId = requestAnimationFrame(animate);
  };

  resize();
  window.addEventListener('resize', resize);
  frameId = requestAnimationFrame(animate);

  return {
    dispose() {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    },
  };
}
