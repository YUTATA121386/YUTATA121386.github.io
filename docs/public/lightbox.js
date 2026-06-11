/* ============================================
   图片灯箱 Lightbox
   ============================================ */
(function() {
  var overlay = null;

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'img-lightbox';
    overlay.innerHTML = '<div class="img-lightbox-bg"></div><div class="img-lightbox-inner"><img src="" alt="" /><button class="img-lightbox-close" aria-label="关闭">&times;</button></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.img-lightbox-bg').addEventListener('click', close);
    overlay.querySelector('.img-lightbox-close').addEventListener('click', close);
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
  }

  function open(src, alt) {
    if (!overlay) createOverlay();
    overlay.querySelector('img').src = src;
    overlay.querySelector('img').alt = alt || '';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  document.addEventListener('click', function(e) {
    var img = e.target;
    if (img.tagName === 'IMG' && (img.closest('.img-row') || img.closest('figure.dish') || img.closest('.poster'))) {
      e.preventDefault();
      open(img.src, img.alt);
    }
  });
})();
