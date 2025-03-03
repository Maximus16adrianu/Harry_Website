document.addEventListener("DOMContentLoaded", function () {
  // Galerie-Funktionalität
  const images = [];
  for (let i = 1; i <= 16; i++) {
    images.push(`bild${i}.png`);
  }
  let currentIndex = 0;
  const galleryImage = document.getElementById('gallery-image');

  function updateGallery() {
    if (galleryImage) {
      galleryImage.style.opacity = 0;
      setTimeout(() => {
        galleryImage.src = images[currentIndex];
        galleryImage.style.opacity = 1;
      }, 300);
    }
  }

  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateGallery();
    });

    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      updateGallery();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && prevBtn) {
      prevBtn.click();
    } else if (e.key === 'ArrowRight' && nextBtn) {
      nextBtn.click();
    }
  });

  // Video-Autoplay-Handling
  document.addEventListener("click", function () {
    const video = document.getElementById("intro-video");
    if (video && video.paused) {
      video.play().then(() => {
        video.muted = false;
      }).catch(error => {
        console.error("Autoplay mit Ton wurde blockiert:", error);
      });
    }
  });

  // Aktive Navigation-Markierung
  const navLinks = document.querySelectorAll('.sidebar a, .mobile-nav a');
  const sections = document.querySelectorAll('section');
  window.addEventListener('scroll', function () {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (pageYOffset >= (sectionTop - 200)) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.parentElement.classList.remove('active');
      if (link.getAttribute('href').substring(1) === current) {
        link.parentElement.classList.add('active');
      }
    });
  });

  // Mobile Menü-Toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', function () {
      mobileNav.classList.toggle('active');
    });
  }
});

// Falls das Browserfenster von Mobil- zu PC-Ansicht wechselt,
// wird die mobile Navigation (falls geöffnet) automatisch geschlossen.
window.addEventListener("resize", function() {
  if (window.innerWidth > 768) {
    const mobileNav = document.getElementById("mobileNav");
    if (mobileNav) {
      mobileNav.classList.remove("active");
    }
  }
});
