// Diese Funktion wird global verfügbar gemacht, damit sie vom Button im HTML aufgerufen werden kann
function toggleMobileNav(event) {
  event.stopPropagation();
  const mobileNav = document.getElementById("mobileNav");
  if (mobileNav) {
    mobileNav.classList.toggle("active");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Galerie-Funktionalität: Bilder 3 bis 19
  const images = [];
  for (let i = 3; i <= 19; i++) {
    images.push(`/api/media/image/bild${i}.png`);
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

  // "Click Outside" – Schließt das mobile Menü, wenn außerhalb geklickt wird
  document.addEventListener('click', function(e) {
    const mobileNav = document.getElementById("mobileNav");
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileNav.classList.contains('active')) {
      if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileNav.classList.remove('active');
      }
    }
  });

  // Falls das Browserfenster von Mobil- zu PC-Ansicht wechselt, mobile Navigation schließen
  window.addEventListener("resize", function() {
    if (window.innerWidth > 768) {
      const mobileNav = document.getElementById("mobileNav");
      if (mobileNav) {
        mobileNav.classList.remove("active");
      }
    }
  });
});
