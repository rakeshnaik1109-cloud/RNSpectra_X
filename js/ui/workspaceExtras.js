/* ═══════════════════════════════════════════════════════════
   RNSpectraX™ — workspace extras
   Three small conveniences that sit on top of the analysis engine
   without touching it:
     · drag spectra anywhere onto the window to load them
     · a toast helper other modules can call
     · the keyboard reference overlay (press ?)
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Toast ───────────────────────────────────────────── */
  var toastEl = null, toastTimer = null;

  window.rxToast = function (message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'rx-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2600);
  };

  /* ── Drag and drop ───────────────────────────────────── */
  var SPECTRAL = /\.(txt|csv|dat|asc|spc|dpt|jdx|dx|tsv)$/i;
  var veil = null, depth = 0;

  function getVeil() {
    if (!veil) {
      veil = document.createElement('div');
      veil.className = 'drop-veil';
      veil.innerHTML =
        '<div class="drop-veil-card">' +
        '<strong>Drop to load spectra</strong>' +
        '<span>.txt .csv .dat .asc .spc .dpt .jdx .tsv</span>' +
        '</div>';
      document.body.appendChild(veil);
    }
    return veil;
  }

  function hasFiles(e) {
    return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1;
  }

  window.addEventListener('dragenter', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    getVeil().classList.add('is-active');
  });

  window.addEventListener('dragover', function (e) {
    if (hasFiles(e)) e.preventDefault();
  });

  window.addEventListener('dragleave', function (e) {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) getVeil().classList.remove('is-active');
  });

  window.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    getVeil().classList.remove('is-active');

    var files = Array.prototype.filter.call(e.dataTransfer.files, function (f) { return SPECTRAL.test(f.name); });
    if (!files.length) {
      window.rxToast('That file type is not a spectrum RNSpectraX can read');
      return;
    }

    // The loaders read from an event-shaped object, so hand them one.
    var shim = { target: { files: files, value: '' } };
    var mode = (typeof currentMode !== 'undefined') ? currentMode : 'ocean';

    if (mode === 'xy' && typeof readXYFiles === 'function') {
      readXYFiles(shim);
    } else if (typeof addFiles === 'function') {
      addFiles(shim);
    } else {
      window.rxToast('Loader not ready — try the Add files button');
      return;
    }
    window.rxToast('Loading ' + files.length + (files.length === 1 ? ' file' : ' files'));
  });

  /* ── Keyboard reference ──────────────────────────────── */
  window.toggleShortcutSheet = function (force) {
    var modal = document.getElementById('shortcutSheet');
    if (!modal) return;
    var open = force === undefined ? !modal.classList.contains('is-open') : force;
    modal.classList.toggle('is-open', open);
    if (open) {
      var close = modal.querySelector('.rx-modal-close');
      if (close) close.focus();
    }
  };

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      window.toggleShortcutSheet(false);
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === '?') {
      e.preventDefault();
      window.toggleShortcutSheet();
    }
  });
})();
