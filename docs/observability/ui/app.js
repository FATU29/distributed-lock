// Tab switching
function switchTab(target) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-target="${target}"]`).classList.add('active');
  document.getElementById(target).classList.add('active');
  window.scrollTo({ top: document.getElementById(target).offsetTop - 80, behavior: 'smooth' });
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.target));
});

// Sticky tabs shadow
const tabs = document.getElementById('tabs');
window.addEventListener('scroll', () => {
  tabs.style.boxShadow = window.scrollY > 200 ? '0 4px 20px rgba(0,0,0,.4)' : 'none';
});

// Animate elements on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.style.opacity = '1'; e.target.style.transform = 'translateY(0)'; } });
}, { threshold: 0.1 });

document.querySelectorAll('.card, .metric-card, .qa-card, .constraint, .debug-step').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity .4s ease, transform .4s ease';
  observer.observe(el);
});
