// Language Switcher
const langBtns = document.querySelectorAll('.lang-btn');
let currentLang = 'en';

function switchLanguage(lang) {
  currentLang = lang;
  
  // Update buttons
  langBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  
  // Update all elements with data-en and data-ru attributes
  document.querySelectorAll('[data-en][data-ru]').forEach(el => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      // Check if element has HTML content
      if (text.includes('<')) {
        el.innerHTML = text;
      } else {
        // For elements that might have child elements, only update text nodes
        if (el.children.length === 0) {
          el.textContent = text;
        } else {
          // Find direct text content and replace it
          const textNodes = Array.from(el.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
          if (textNodes.length > 0) {
            textNodes[0].textContent = text;
          } else {
            el.innerHTML = text + el.innerHTML;
          }
        }
      }
    }
  });
  
  // Update HTML lang attribute
  document.documentElement.lang = lang;
  
  // Save preference
  localStorage.setItem('preferredLang', lang);
}

// Initialize language switcher
langBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    switchLanguage(btn.dataset.lang);
  });
});

// Load saved preference
const savedLang = localStorage.getItem('preferredLang');
if (savedLang && savedLang !== 'en') {
  switchLanguage(savedLang);
}

// Particle Background
const canvas = document.getElementById('particle-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    const particleCount = Math.min(50, Math.floor(window.innerWidth / 30));
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
  }

  function animateParticles() {
    ctx.fillStyle = 'rgba(5, 5, 10, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach((particle, i) => {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 136, 204, ${particle.opacity})`;
      ctx.fill();

      // Draw connections
      particles.slice(i + 1).forEach((other) => {
        const dx = particle.x - other.x;
        const dy = particle.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 150) {
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(other.x, other.y);
          ctx.strokeStyle = `rgba(0, 136, 204, ${0.15 * (1 - distance / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });

    animationId = requestAnimationFrame(animateParticles);
  }

  resizeCanvas();
  createParticles();
  animateParticles();

  window.addEventListener('resize', () => {
    resizeCanvas();
    createParticles();
  });
}

// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(button => {
  button.addEventListener('click', () => {
    const item = button.parentElement;
    const isActive = item.classList.contains('active');
    
    // Close all items
    document.querySelectorAll('.faq-item').forEach(faq => {
      faq.classList.remove('active');
    });
    
    // Open clicked item if it wasn't active
    if (!isActive) {
      item.classList.add('active');
    }
  });
});

// Examples Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabIndex = tab.dataset.tab;
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Update active panel
    document.querySelectorAll('.example-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    document.querySelector(`.example-panel[data-panel="${tabIndex}"]`).classList.add('active');
  });
});

// Scroll Reveal Animation
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
    }
  });
}, observerOptions);

document.querySelectorAll('.step, .plugin-card, .security-card, .pricing-card, .team-stat, .faq-item, .dev-stage').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Add revealed styles
const style = document.createElement('style');
style.textContent = `
  .revealed {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Counter animation for stats
function animateCounter(element, target, duration = 1600) {
  const current = parseInt(element.dataset.current || '0');
  const delta = target - current;
  if (delta === 0) return;
  const start = performance.now();
  function updateCounter(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(current + delta * eased);
    element.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(updateCounter);
    else element.dataset.current = String(target);
  }
  requestAnimationFrame(updateCounter);
}

// Load real platform stats from API and auto-refresh every 30s
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://tonagentplatform.com';
let statsLoaded = false;

async function loadPlatformStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;

    const fields = {
      'stat-agents-created': data.agentsCreated ?? 0,
      'stat-active-agents':  data.activeAgents  ?? 0,
      'stat-total-users':    data.totalUsers     ?? 0,
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (!statsLoaded) {
        // First load: just set, animation fires when scrolled into view
        el.dataset.real = String(value);
        el.dataset.current = '0';
        el.textContent = '--'; // keep placeholder until visible
      } else {
        // Subsequent refresh: animate to new value
        animateCounter(el, value);
      }
    }
    statsLoaded = true;
  } catch { /* API unreachable — keep placeholder */ }
}

// Animate counters when they come into view (uses real data if loaded)
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
      entry.target.classList.add('counted');
      const real = parseInt(entry.target.dataset.real || '');
      const fallback = parseInt(entry.target.textContent.replace(/,/g, ''));
      const target = !isNaN(real) ? real : (!isNaN(fallback) ? fallback : 0);
      if (target > 0) animateCounter(entry.target, target);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.stat-value[id]').forEach(stat => {
  statsObserver.observe(stat);
});

// Initial load + refresh every 30 seconds
loadPlatformStats();
setInterval(loadPlatformStats, 30_000);

// Spotlight effect for plugin cards
document.querySelectorAll('.plugin-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  });
});

// Add spotlight CSS
const spotlightStyle = document.createElement('style');
spotlightStyle.textContent = `
  .plugin-card::before {
    content: '';
    position: absolute;
    top: var(--mouse-y, 50%);
    left: var(--mouse-x, 50%);
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(0, 136, 204, 0.15) 0%, transparent 70%);
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
  }
  
  .plugin-card:hover::before {
    opacity: 1;
  }
`;
document.head.appendChild(spotlightStyle);

console.log('TON Agent Platform - Website loaded successfully!');
