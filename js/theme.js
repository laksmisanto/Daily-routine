/* ==========================================================================
   Theme
   Loaded in <head> (not deferred) so the saved theme is applied before the
   first paint. Falls back to the system preference on first visit.
   ========================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'routine-theme';
  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function readSaved() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'dark' || value === 'light' ? value : null;
    } catch (error) {
      return null; // Storage can be blocked (private mode, file:// in some browsers).
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* Preference just won't persist. */
    }
  }

  function systemTheme() {
    return media && media.matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    const button = document.getElementById('theme-toggle');
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  apply(readSaved() || systemTheme());

  function init() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    apply(root.getAttribute('data-theme') || 'light'); // sync aria-pressed

    button.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      save(next);
    });

    // Follow the system setting until the user picks a theme themselves.
    if (media && media.addEventListener) {
      media.addEventListener('change', () => {
        if (!readSaved()) apply(systemTheme());
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
