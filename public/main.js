document.addEventListener("DOMContentLoaded", function () {
    // Galerie-Funktionalität
    const images = [];
    for (let i = 1; i <= 16; i++) {
      images.push(`bild${i}.png`);
    }
  
    let currentIndex = 0;
    const galleryImage = document.getElementById('gallery-image');
  
    function updateGallery() {
      galleryImage.src = images[currentIndex];
      galleryImage.classList.add('fade');
      setTimeout(() => {
        galleryImage.classList.remove('fade');
      }, 300);
    }
  
    document.getElementById('prev').addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateGallery();
    });
  
    document.getElementById('next').addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      updateGallery();
    });
  
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') {
        document.getElementById('prev').click();
      } else if (e.key === 'ArrowRight') {
        document.getElementById('next').click();
      }
    });
  
    // Video-Autoplay-Handling
    document.addEventListener("click", function () {
      const video = document.getElementById("intro-video");
      if (video.paused) {
        video.play().then(() => {
          video.muted = false;
        }).catch(error => {
          console.error("Autoplay mit Ton wurde blockiert:", error);
        });
      }
    });
  
    // Aktive Navigation-Markierung
    const navLinks = document.querySelectorAll('.sidebar a');
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
  });
  