import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
};

const PARTICLE_DENSITY = 12000;
const LINK_DISTANCE = 10000;
const MOUSE_RADIUS = 120;

export const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) {
      return undefined;
    }

    let animationFrameId = 0;
    let particles: Particle[] = [];
    const mouse = {
      x: null as number | null,
      y: null as number | null,
    };

    const isDarkTheme = () => document.documentElement.classList.contains("dark");

    const setCanvasSize = () => {
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * pixelRatio);
      canvas.height = Math.floor(window.innerHeight * pixelRatio);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((window.innerWidth * window.innerHeight) / PARTICLE_DENSITY);

      for (let index = 0; index < particleCount; index += 1) {
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          dx: (Math.random() - 0.5) * 0.8,
          dy: (Math.random() - 0.5) * 0.8,
          size: Math.random() * 2 + 1,
        });
      }
    };

    const drawParticle = (particle: Particle, particleColor: string) => {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.fill();
    };

    const updateParticle = (particle: Particle, particleColor: string) => {
      if (particle.x + particle.size >= window.innerWidth || particle.x - particle.size <= 0) {
        particle.dx *= -1;
        particle.x = Math.max(particle.size, Math.min(particle.x, window.innerWidth - particle.size));
      }

      if (particle.y + particle.size >= window.innerHeight || particle.y - particle.size <= 0) {
        particle.dy *= -1;
        particle.y = Math.max(particle.size, Math.min(particle.y, window.innerHeight - particle.size));
      }

      if (mouse.x !== null && mouse.y !== null) {
        const mx = mouse.x - particle.x;
        const my = mouse.y - particle.y;
        const distance = Math.sqrt(mx * mx + my * my);

        if (distance < MOUSE_RADIUS && distance > 0) {
          const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
          particle.x -= (mx / distance) * force * 1.5;
          particle.y -= (my / distance) * force * 1.5;
        }
      }

      particle.x += particle.dx;
      particle.y += particle.dy;
      drawParticle(particle, particleColor);
    };

    const connectParticles = (lineColor: string) => {
      for (let a = 0; a < particles.length; a += 1) {
        for (let b = a + 1; b < particles.length; b += 1) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = dx * dx + dy * dy;

          if (distance < LINK_DISTANCE) {
            const opacity = 1 - distance / LINK_DISTANCE;
            ctx.strokeStyle = `rgba(${lineColor}, ${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      const darkTheme = isDarkTheme();
      const particleColor = darkTheme ? "#ffffff" : "#000000";
      const lineColor = darkTheme ? "255, 255, 255" : "0, 0, 0";

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particles.forEach((particle) => updateParticle(particle, particleColor));
      connectParticles(lineColor);

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      setCanvasSize();
      initParticles();
    };

    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    setCanvasSize();
    initParticles();
    animate();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-background-canvas" aria-hidden="true" />;
};
