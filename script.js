// KOKIN · Shared site scripts

(function () {
  // Nav scroll state
  const nav = document.querySelector('.main-nav');
  if (nav) {
    const onScroll = () => {
      if (window.scrollY > 60) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile menu
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.main-nav ul');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      menu.classList.toggle('open');
    });
    menu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        menu.classList.remove('open');
      });
    });
  }

  // Reveal on scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -80px 0px' });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();
