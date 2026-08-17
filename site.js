(function () {
  'use strict';

  const Site = {};
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  Site.onReady = function (callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }
    callback();
  };

  Site.prefersReducedMotion = function () {
    return reducedMotionQuery.matches;
  };

  Site.initTypewriter = function () {
    const elements = Array.from(document.querySelectorAll('[data-typewriter-speed]'));
    if (!elements.length) return;

    const items = elements.map((element) => ({
      element,
      text: element.textContent.replace(/\s+/g, ' ').trim(),
      speed: Number(element.dataset.typewriterSpeed) || 40,
      independent: element.hasAttribute('data-typewriter-independent')
    }));

    items.forEach(({ element, text }) => {
      element.setAttribute('aria-label', text);
      element.textContent = '';
    });

    const typeItem = function (item, onComplete) {
      const visualText = document.createElement('span');
      let characterIndex = 0;

      visualText.setAttribute('aria-hidden', 'true');
      item.element.appendChild(visualText);
      item.element.classList.add('is-typing');

      const typeCharacter = function () {
        if (characterIndex < item.text.length) {
          visualText.textContent += item.text.charAt(characterIndex);
          characterIndex += 1;
          window.setTimeout(typeCharacter, item.speed);
          return;
        }

        item.element.classList.remove('is-typing');
        item.element.classList.add('is-typed');
        if (onComplete) onComplete();
      };

      typeCharacter();
    };

    const sequence = items.filter((item) => !item.independent);
    const typeNext = function (itemIndex) {
      if (itemIndex >= sequence.length) return;
      typeItem(sequence[itemIndex], () => {
        window.setTimeout(() => typeNext(itemIndex + 1), 300);
      });
    };

    items
      .filter((item) => item.independent)
      .forEach((item) => typeItem(item));

    typeNext(0);
  };

  Site.observeVisible = function (elements, options) {
    const list = Array.from(elements || []);
    if (!list.length) return;

    const settings = options || {};
    const visibleClass = settings.visibleClass || 'visible';
    const onEnter = typeof settings.onEnter === 'function' ? settings.onEnter : null;

    if (Site.prefersReducedMotion() || !('IntersectionObserver' in window)) {
      list.forEach((element) => {
        if (visibleClass) element.classList.add(visibleClass);
        if (onEnter) onEnter(element);
      });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        if (visibleClass) entry.target.classList.add(visibleClass);
        if (onEnter) onEnter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: settings.threshold || 0.1 });

    list.forEach((element) => observer.observe(element));
  };

  Site.initCurrentYear = function () {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
      element.textContent = year;
    });
  };

  Site.initNavbar = function () {
    const navbar = document.querySelector('.sticky-navbar');
    const toggle = document.querySelector('.nav-toggle');
    const linksContainer = document.querySelector('.sticky-nav-links');
    if (!navbar || !linksContainer) return;

    const currentPage = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    linksContainer.querySelectorAll('.sticky-nav-link').forEach((link) => {
      const linkPage = (link.getAttribute('href') || '').split('/').pop().split('?')[0].toLowerCase();
      const active = linkPage === currentPage;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    if (!toggle) return;

    const setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      navbar.classList.toggle('nav-open', open);
      document.body.classList.toggle('nav-menu-open', open);
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    linksContainer.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia('(min-width: 769px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  };

  Site.initFilters = function () {
    const buttons = Array.from(document.querySelectorAll('.filter-btn'));
    const cards = Array.from(document.querySelectorAll('#projetos-container .card'));
    const status = document.querySelector('#filter-status');
    if (!buttons.length || !cards.length) return;

    const applyFilter = function (filter) {
      let visibleCount = 0;

      buttons.forEach((button) => {
        const active = button.dataset.filter === filter;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      cards.forEach((card) => {
        const categories = (card.dataset.category || '').split(/\s+/);
        const visible = filter === 'all' || categories.includes(filter);
        card.hidden = !visible;
        card.setAttribute('aria-hidden', String(!visible));
        if (visible) visibleCount += 1;
      });

      if (status) {
        status.textContent = visibleCount + (visibleCount === 1 ? ' projeto exibido.' : ' projetos exibidos.');
      }
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => applyFilter(button.dataset.filter || 'all'));
    });

    applyFilter('all');
  };

  Site.initCarousels = function () {
    document.querySelectorAll('.project-carousel').forEach((carousel) => {
      const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
      if (slides.length < 2) return;

      const previousButton = carousel.querySelector('.carousel-control--previous');
      const nextButton = carousel.querySelector('.carousel-control--next');
      const status = carousel.querySelector('.carousel-status');
      const autoplayEnabled = carousel.dataset.autoplay !== 'false';
      const autoplayInterval = Math.max(2500, Number(carousel.dataset.autoplayInterval) || 5000);
      let currentIndex = 0;
      let autoplayTimer = null;
      let touchStartX = 0;
      let visible = true;

      const update = function (nextIndex) {
        currentIndex = (nextIndex + slides.length) % slides.length;
        slides.forEach((slide, index) => {
          const active = index === currentIndex;
          slide.classList.toggle('active', active);
          slide.setAttribute('aria-hidden', String(!active));
        });
        if (status) status.textContent = 'Imagem ' + (currentIndex + 1) + ' de ' + slides.length;
      };

      const stopAutoplay = function () {
        if (autoplayTimer) window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      };

      const startAutoplay = function () {
        if (!autoplayEnabled || Site.prefersReducedMotion() || autoplayTimer || !visible || document.hidden) return;
        autoplayTimer = window.setInterval(() => update(currentIndex + 1), autoplayInterval);
      };

      const restartAutoplay = function () {
        stopAutoplay();
        startAutoplay();
      };

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          visible = entries[0].isIntersecting;
          if (visible) startAutoplay();
          else stopAutoplay();
        }, { threshold: 0.15 });
        observer.observe(carousel);
      } else {
        startAutoplay();
      }

      if (previousButton) previousButton.addEventListener('click', () => {
        update(currentIndex - 1);
        restartAutoplay();
      });

      if (nextButton) nextButton.addEventListener('click', () => {
        update(currentIndex + 1);
        restartAutoplay();
      });

      carousel.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        update(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
        restartAutoplay();
      });

      carousel.addEventListener('touchstart', (event) => {
        touchStartX = event.touches[0].clientX;
      }, { passive: true });

      carousel.addEventListener('touchend', (event) => {
        const difference = touchStartX - event.changedTouches[0].clientX;
        if (Math.abs(difference) < 50) return;
        update(currentIndex + (difference > 0 ? 1 : -1));
        restartAutoplay();
      }, { passive: true });

      carousel.addEventListener('mouseenter', stopAutoplay);
      carousel.addEventListener('mouseleave', startAutoplay);
      carousel.addEventListener('focusin', stopAutoplay);
      carousel.addEventListener('focusout', startAutoplay);
      document.addEventListener('visibilitychange', () => document.hidden ? stopAutoplay() : startAutoplay());
      reducedMotionQuery.addEventListener('change', () => Site.prefersReducedMotion() ? stopAutoplay() : startAutoplay());

      update(0);
      startAutoplay();
    });
  };

  Site.initSkillBars = function () {
    const bars = Array.from(document.querySelectorAll('.skill-progress[data-level]'));
    if (!bars.length) return;

    const reveal = function (bar) {
      const level = Math.max(0, Math.min(100, Number(bar.dataset.level) || 0));
      const label = bar.dataset.label || 'Em desenvolvimento';
      bar.style.width = level + '%';
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(level));
      bar.setAttribute('aria-valuetext', label);
      const percentage = bar.closest('.skill-level')?.querySelector('.skill-percentage');
      if (percentage) percentage.textContent = label;
    };

    bars.forEach((bar) => {
      bar.style.width = '0%';
      bar.setAttribute('role', 'progressbar');
    });

    if (Site.prefersReducedMotion() || !('IntersectionObserver' in window)) {
      bars.forEach(reveal);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    bars.forEach((bar) => observer.observe(bar));
  };

  Site.initReveals = function () {
    const experienceItems = Array.from(document.querySelectorAll('.experience-item'));
    if (!experienceItems.length) return;

    if (Site.prefersReducedMotion() || !('IntersectionObserver' in window)) {
      experienceItems.forEach((item) => item.classList.add('visible', 'reveal-complete'));
      return;
    }

    document.documentElement.classList.add('experience-reveal-ready');

    experienceItems.forEach((item) => {
      const completeReveal = function (event) {
        if (event.target !== item || (event.propertyName !== 'opacity' && event.propertyName !== 'transform')) return;
        item.classList.add('reveal-complete');
        item.removeEventListener('transitionend', completeReveal);
      };
      item.addEventListener('transitionend', completeReveal);
    });

    window.requestAnimationFrame(() => {
      Site.observeVisible(experienceItems, {
        threshold: 0.1,
        visibleClass: 'visible'
      });
    });
  };

  Site.initContactForm = function () {
    const form = document.querySelector('#contact-form');
    if (!form) return;

    const status = form.querySelector('.form-status');
    const submitButton = form.querySelector('button[type="submit"]');
    const successFromRedirect = new URLSearchParams(window.location.search).get('status') === 'success';

    if (successFromRedirect && status) {
      status.dataset.state = 'success';
      status.textContent = 'Mensagem enviada com sucesso.';
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      const originalLabel = submitButton?.textContent || 'Enviar mensagem';
      const endpoint = form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/');
      const payload = Object.fromEntries(new FormData(form).entries());

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando…';
      }
      form.setAttribute('aria-busy', 'true');
      if (status) {
        status.removeAttribute('data-state');
        status.textContent = 'Enviando mensagem…';
      }

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        if (!response.ok) throw new Error('Falha no serviço de envio.');
        form.reset();
        if (status) {
          status.dataset.state = 'success';
          status.textContent = 'Mensagem enviada com sucesso.';
        }
      } catch (error) {
        if (status) {
          status.dataset.state = 'error';
          status.textContent = error.name === 'AbortError'
            ? 'O envio demorou mais que o esperado. Tente novamente.'
            : 'Não foi possível enviar agora. Tente novamente ou use o e-mail acima.';
        }
      } finally {
        window.clearTimeout(timeout);
        form.removeAttribute('aria-busy');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalLabel;
        }
      }
    });
  };

  Site.initAll = function () {
    Site.initCurrentYear();
    Site.initTypewriter();
    Site.initNavbar();
    Site.initFilters();
    Site.initCarousels();
    Site.initSkillBars();
    Site.initReveals();
    Site.initContactForm();
  };

  window.Site = Site;
  Site.onReady(Site.initAll);
})();
