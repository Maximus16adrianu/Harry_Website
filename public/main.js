// Deutsche Demo Homepage - JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM ELEMENTS =====
  
  // Navigation
  const mobileNav = document.getElementById('mobileNav');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNavClose = document.querySelector('.mobile-nav-close');
  const sidebarLinks = document.querySelectorAll('.sidebar a');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav a');
  
  // Gallery
  const galleryImage = document.getElementById('gallery-image');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const currentImageSpan = document.getElementById('currentImage');
  const totalImagesSpan = document.getElementById('totalImages');
  const galleryDots = document.getElementById('galleryDots');
  
  // Video
  const introVideo = document.getElementById('intro-video');
  const playButton = document.getElementById('playButton');
  
  // Modals
  const reportModal = document.getElementById('reportModal');
  const impressumModal = document.getElementById('impressumModal');
  const imageModal = document.getElementById('imageModal');
  const reportForm = document.getElementById('reportForm');
  const dynamicQuestions = document.getElementById('dynamicQuestions');
  const impressumContent = document.getElementById('impressumContent');
  const modalImage = document.getElementById('modalImage');
  
  // Notifications
  const notificationContainer = document.getElementById('notificationContainer');
  const loadingOverlay = document.getElementById('loadingOverlay');

  // ===== STATE VARIABLES =====
  let isSubmitting = false;
  let currentGalleryIndex = 0;
  let galleryImages = [];
  let isVideoPlaying = false;

  // ===== UTILITY FUNCTIONS =====
  function showLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
    }
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  function showNotification(message, type = 'success') {
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = '';
    switch (type) {
      case 'success': icon = '✅'; break;
      case 'error': icon = '❌'; break;
      case 'warning': icon = '⚠️'; break;
      default: icon = 'ℹ️';
    }
    
    notification.innerHTML = `
      <span>${icon} ${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto remove after 5 seconds
    const autoRemove = setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
    
    // Manual close
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemove);
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      });
    }
  }

  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // ===== NAVIGATION FUNCTIONS =====
  window.toggleMobileNav = function(event) {
    if (event) {
      event.stopPropagation();
    }
    
    if (mobileNav) {
      mobileNav.classList.toggle('active');
      
      // Prevent body scroll when nav is open
      if (mobileNav.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  };

  function closeMobileNav() {
    if (mobileNav && mobileNav.classList.contains('active')) {
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Close mobile nav when clicking outside
  document.addEventListener('click', (e) => {
    if (mobileNav && mobileNav.classList.contains('active')) {
      if (!mobileNav.contains(e.target) && !mobileMenuBtn?.contains(e.target)) {
        closeMobileNav();
      }
    }
  });

  // Close mobile nav when clicking on a link
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMobileNav();
    });
  });

  // Close mobile nav when resizing to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 992) {
      closeMobileNav();
    }
  });

  // ===== ACTIVE NAVIGATION HIGHLIGHTING =====
  function updateActiveNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = [...sidebarLinks, ...mobileNavLinks];
    
    let current = '';
    const scrollPosition = window.pageYOffset + 150;
    
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });
    
    navLinks.forEach(link => {
      const parent = link.parentElement;
      parent.classList.remove('active');
      
      if (link.getAttribute('href') === `#${current}`) {
        parent.classList.add('active');
      }
    });
  }

  // Update navigation on scroll
  window.addEventListener('scroll', updateActiveNavigation);

  // ===== GALLERY FUNCTIONALITY =====
  function initializeGallery() {
    // Generate gallery images array (images 3-19)
    galleryImages = [];
    for (let i = 3; i <= 19; i++) {
      galleryImages.push(`/api/media/image/bild${i}.png`);
    }
    
    if (totalImagesSpan) {
      totalImagesSpan.textContent = galleryImages.length;
    }
    
    createGalleryDots();
    updateGallery();
  }

  function createGalleryDots() {
    if (!galleryDots) return;
    
    galleryDots.innerHTML = '';
    
    galleryImages.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = 'gallery-dot';
      dot.setAttribute('aria-label', `Bild ${index + 1} anzeigen`);
      
      if (index === currentGalleryIndex) {
        dot.classList.add('active');
      }
      
      dot.addEventListener('click', () => {
        currentGalleryIndex = index;
        updateGallery();
      });
      
      galleryDots.appendChild(dot);
    });
  }

  function updateGallery() {
    if (!galleryImage) return;
    
    // Add fade effect
    galleryImage.style.opacity = '0';
    
    setTimeout(() => {
      galleryImage.src = galleryImages[currentGalleryIndex];
      galleryImage.alt = `Bundesland Bild ${currentGalleryIndex + 1}`;
      galleryImage.style.opacity = '1';
      
      // Update counter
      if (currentImageSpan) {
        currentImageSpan.textContent = currentGalleryIndex + 1;
      }
      
      // Update dots
      const dots = galleryDots?.querySelectorAll('.gallery-dot');
      if (dots) {
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === currentGalleryIndex);
        });
      }
      
      // Update button states
      if (prevBtn) {
        prevBtn.disabled = currentGalleryIndex === 0;
      }
      if (nextBtn) {
        nextBtn.disabled = currentGalleryIndex === galleryImages.length - 1;
      }
    }, 150);
  }

  function navigateGallery(direction) {
    if (direction === 'prev' && currentGalleryIndex > 0) {
      currentGalleryIndex--;
    } else if (direction === 'next' && currentGalleryIndex < galleryImages.length - 1) {
      currentGalleryIndex++;
    } else if (direction === 'prev' && currentGalleryIndex === 0) {
      // Wrap to last image
      currentGalleryIndex = galleryImages.length - 1;
    } else if (direction === 'next' && currentGalleryIndex === galleryImages.length - 1) {
      // Wrap to first image
      currentGalleryIndex = 0;
    }
    
    updateGallery();
  }

  // Gallery event listeners
  if (prevBtn) {
    prevBtn.addEventListener('click', () => navigateGallery('prev'));
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => navigateGallery('next'));
  }

  // Keyboard navigation for gallery
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateGallery('prev');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateGallery('next');
    }
  });

  // ===== VIDEO FUNCTIONALITY =====
  function initializeVideo() {
    if (!introVideo) return;
    
    // Handle autoplay restrictions
    const playPromise = introVideo.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isVideoPlaying = true;
          if (playButton) {
            playButton.style.display = 'none';
          }
        })
        .catch(error => {
          console.log('Autoplay was prevented:', error);
          isVideoPlaying = false;
          if (playButton) {
            playButton.style.display = 'flex';
          }
        });
    }
    
    // Play button click handler
    if (playButton) {
      playButton.addEventListener('click', () => {
        if (introVideo.paused) {
          introVideo.play().then(() => {
            introVideo.muted = false;
            isVideoPlaying = true;
            playButton.style.display = 'none';
          }).catch(error => {
            console.error('Video play failed:', error);
            showNotification('Video konnte nicht abgespielt werden.', 'error');
          });
        }
      });
    }
    
    // Video event listeners
    introVideo.addEventListener('play', () => {
      isVideoPlaying = true;
      if (playButton) {
        playButton.style.display = 'none';
      }
    });
    
    introVideo.addEventListener('pause', () => {
      isVideoPlaying = false;
      if (playButton) {
        playButton.style.display = 'flex';
      }
    });
    
    // Unmute video on first user interaction
    let userInteracted = false;
    
    const handleFirstInteraction = () => {
      if (!userInteracted && introVideo && !introVideo.paused) {
        introVideo.muted = false;
        userInteracted = true;
      }
    };
    
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true });
  }

  // ===== IMAGE MODAL FUNCTIONALITY =====
  window.openImageModal = function(src) {
    if (imageModal && modalImage) {
      // Create a temporary image to get dimensions
      const tempImg = new Image();
      
      tempImg.onload = function() {
        const imgWidth = this.naturalWidth;
        const imgHeight = this.naturalHeight;
        const aspectRatio = imgWidth / imgHeight;
        
        // Calculate optimal modal size based on image dimensions
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.8;
        
        let modalWidth, modalHeight;
        
        if (aspectRatio > 1) {
          // Landscape image
          modalWidth = Math.min(maxWidth, imgWidth);
          modalHeight = modalWidth / aspectRatio;
          
          if (modalHeight > maxHeight) {
            modalHeight = maxHeight;
            modalWidth = modalHeight * aspectRatio;
          }
        } else {
          // Portrait image
          modalHeight = Math.min(maxHeight, imgHeight);
          modalWidth = modalHeight * aspectRatio;
          
          if (modalWidth > maxWidth) {
            modalWidth = maxWidth;
            modalHeight = modalWidth / aspectRatio;
          }
        }
        
        // Apply dimensions to modal content
        const modalContent = imageModal.querySelector('.modal-content');
        modalContent.style.width = `${modalWidth + 40}px`; // Add padding
        modalContent.style.height = 'auto';
        modalContent.style.maxWidth = '95vw';
        modalContent.style.maxHeight = '95vh';
        
        // Set image source and show modal
        modalImage.src = src;
        imageModal.classList.remove('hidden');
        
        // Focus trap
        const closeBtn = imageModal.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.focus();
        }
      };
      
      tempImg.onerror = function() {
        // Fallback if image fails to load
        modalImage.src = src;
        imageModal.classList.remove('hidden');
        
        const closeBtn = imageModal.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.focus();
        }
      };
      
      tempImg.src = src;
    }
  };

  window.closeImageModal = function() {
    if (imageModal) {
      imageModal.classList.add('hidden');
      
      // Reset modal content size
      const modalContent = imageModal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.style.width = '';
        modalContent.style.height = '';
      }
    }
  };

  // ===== REPORT ERROR MODAL =====
  window.openReportModal = function() {
    if (reportModal) {
      reportModal.classList.remove('hidden');
      
      // Focus first input
      const firstInput = reportModal.querySelector('select, input');
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  };

  window.closeReportModal = function() {
    if (reportModal) {
      reportModal.classList.add('hidden');
      
      // Reset form
      if (reportForm) {
        reportForm.reset();
      }
      if (dynamicQuestions) {
        dynamicQuestions.innerHTML = '';
      }
    }
  };

  // ===== DYNAMIC FORM QUESTIONS =====
  window.handleAreaChange = function() {
    const area = document.getElementById('errorArea')?.value;
    
    if (!dynamicQuestions || !area) {
      if (dynamicQuestions) {
        dynamicQuestions.innerHTML = '';
      }
      return;
    }
    
    let questionsHTML = '';
    
    switch (area) {
      case 'login':
        questionsHTML = `
          <div class="form-group">
            <label>Haben Sie sichergestellt, dass Nutzername und Passwort korrekt eingegeben wurden?</label>
            <select id="loginCorrect" name="loginCorrect" required onchange="handleLoginCorrectChange()">
              <option value="">Bitte auswählen</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </div>
          <div id="loginAdditional"></div>
        `;
        break;
        
      case 'registration':
        questionsHTML = `
          <div class="form-group">
            <label>Haben Sie das Kästchen "Ich bin kein Hater" angekreuzt?</label>
            <select id="regHater" name="regHater" required onchange="handleRegHaterChange()">
              <option value="">Bitte auswählen</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </div>
          <div id="regAdditional"></div>
        `;
        break;
        
      case 'homepage':
        questionsHTML = `
          <div class="form-group">
            <label>Handelt es sich um einen Fehler beim Video oder bei den Bildern?</label>
            <select id="homepageMedia" name="homepageMedia" required>
              <option value="">Bitte auswählen</option>
              <option value="video">📹 Video</option>
              <option value="images">🖼️ Bilder</option>
              <option value="navigation">🧭 Navigation</option>
              <option value="other">🔧 Anderes</option>
            </select>
          </div>
          <div class="form-group">
            <label>Beschreiben Sie bitte kurz Ihr Problem:</label>
            <textarea name="homepageDescription" required maxlength="250" placeholder="Bitte beschreiben Sie das Problem so detailliert wie möglich..."></textarea>
          </div>
        `;
        break;
        
      case 'chat':
        questionsHTML = `
          <div class="form-group">
            <label>Welche Fehlermeldung haben Sie erhalten?</label>
            <select id="chatError" name="chatError" required onchange="handleChatErrorChange()">
              <option value="">Bitte auswählen</option>
              <option value="notLoggedIn">🔑 Nicht eingeloggt</option>
              <option value="noChatSelected">💬 Kein Chat ausgewählt</option>
              <option value="chatsLocked">🔒 Chats sind gesperrt</option>
              <option value="connectionError">🌐 Verbindungsfehler</option>
              <option value="other">🔧 Andere</option>
            </select>
          </div>
          <div id="chatAdditional"></div>
        `;
        break;
        
      case 'orga':
        questionsHTML = `
          <div class="form-group">
            <label>Haben Sie einen Organisator-Account?</label>
            <select id="orgaAccount" name="orgaAccount" required>
              <option value="">Bitte auswählen</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </div>
          <div class="form-group">
            <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; border-left: 4px solid #2196f3;">
              <p><strong>💡 Hinweis:</strong> Ein Organisator-Account kann nur vom Administrator erstellt werden. Falls Sie sich als normaler Nutzer registriert haben, melden Sie sich im normalen Chat an oder kontaktieren Sie den Admin.</p>
            </div>
          </div>
        `;
        break;
        
      case 'newsletter':
        questionsHTML = `
          <div class="form-group">
            <label>Erhalten Sie die Fehlermeldung, dass nur eine E-Mail pro Stunde gesendet werden kann?</label>
            <select id="newsletterLimit" name="newsletterLimit" required onchange="handleNewsletterChange()">
              <option value="">Bitte auswählen</option>
              <option value="yes">Ja</option>
              <option value="invalid_email">📧 Ungültige E-Mail-Adresse</option>
              <option value="other">🔧 Andere Fehlermeldung</option>
            </select>
          </div>
          <div id="newsletterAdditional"></div>
        `;
        break;
    }
    
    dynamicQuestions.innerHTML = questionsHTML;
  };

  // Additional handlers for dynamic questions
  window.handleLoginCorrectChange = function() {
    const value = document.getElementById('loginCorrect')?.value;
    const container = document.getElementById('loginAdditional');
    
    if (!container) return;
    
    if (value === 'yes') {
      container.innerHTML = `
        <div class="form-group">
          <label>Erinnern Sie sich daran, eventuell etwas Verwerfliches gemacht zu haben bzw. gebannt worden zu sein?</label>
          <select id="loginBanned" name="loginBanned" required onchange="handleLoginBannedChange()">
            <option value="">Bitte auswählen</option>
            <option value="yes">Ja</option>
            <option value="no">Nein</option>
          </select>
        </div>
        <div id="loginBannedAdditional"></div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte, wie der Fehler aufgetreten ist:</label>
          <textarea name="loginDescription" required maxlength="250" placeholder="Bitte beschreiben Sie den Ablauf so detailliert wie möglich..."></textarea>
        </div>
      `;
    }
  };

  window.handleLoginBannedChange = function() {
    const value = document.getElementById('loginBanned')?.value;
    const container = document.getElementById('loginBannedAdditional');
    
    if (!container) return;
    
    if (value === 'no') {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte in welcher Reihenfolge mit welchem Nutzer und Passwort Sie sich eingeloggt haben:</label>
          <textarea name="loginDescription" required maxlength="250" placeholder="Schritt-für-Schritt Beschreibung des Login-Versuchs..."></textarea>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte, wie der Fehler aufgetreten ist:</label>
          <textarea name="loginDescription" required maxlength="250" placeholder="Bitte beschreiben Sie das Problem..."></textarea>
        </div>
      `;
    }
  };

  window.handleRegHaterChange = function() {
    const value = document.getElementById('regHater')?.value;
    const container = document.getElementById('regAdditional');
    
    if (!container) return;
    
    if (value === 'yes') {
      container.innerHTML = `
        <div class="form-group">
          <label>Hat Ihr Passwort 8-20 Zeichen und Ihr Nutzername 3-20 Zeichen?</label>
          <select id="regLength" name="regLength" required onchange="handleRegLengthChange()">
            <option value="">Bitte auswählen</option>
            <option value="yes">Ja</option>
            <option value="no">Nein</option>
          </select>
        </div>
        <div id="regLengthAdditional"></div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte, wie der Fehler aufgetreten ist:</label>
          <textarea name="regDescription" required maxlength="250" placeholder="Bitte beschreiben Sie das Problem..."></textarea>
        </div>
      `;
    }
  };

  window.handleRegLengthChange = function() {
    const value = document.getElementById('regLength')?.value;
    const container = document.getElementById('regLengthAdditional');
    
    if (!container) return;
    
    if (value === 'no') {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte Ihr Problem:</label>
          <textarea name="regDescription" required maxlength="250" placeholder="Welche Fehlermeldung erhalten Sie?"></textarea>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; border-left: 4px solid #4caf50;">
          <p><strong>✅ Überprüfung:</strong> Bitte überprüfen Sie nochmals Ihre Eingaben und versuchen Sie es erneut.</p>
        </div>
      `;
    }
  };

  window.handleChatErrorChange = function() {
    const value = document.getElementById('chatError')?.value;
    const container = document.getElementById('chatAdditional');
    
    if (!container) return;
    
    let html = '';
    
    switch (value) {
      case 'notLoggedIn':
        html = `
          <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p><strong>💡 Hinweis:</strong> Bitte loggen Sie sich aus und wieder ein.</p>
          </div>
        `;
        break;
      case 'noChatSelected':
        html = `
          <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; border-left: 4px solid #ffc107;">
            <p><strong>💡 Hinweis:</strong> Bitte wählen Sie einen Chat aus der Seitenleiste aus.</p>
          </div>
        `;
        break;
      case 'chatsLocked':
        html = `
          <div style="background: #f8d7da; padding: 1rem; border-radius: 8px; border-left: 4px solid #dc3545;">
            <p><strong>🔒 Hinweis:</strong> Chats sind momentan gesperrt – nur Admins oder Organisatoren können schreiben, da wichtige Informationen anstehen.</p>
          </div>
        `;
        break;
      case 'other':
      case 'connectionError':
        html = `
          <div class="form-group">
            <label>Beschreiben Sie bitte Ihr Problem:</label>
            <textarea name="chatDescription" required maxlength="250" placeholder="Welche Fehlermeldung erscheint? Was haben Sie versucht?"></textarea>
          </div>
        `;
        break;
    }
    
    container.innerHTML = html;
  };

  window.handleNewsletterChange = function() {
    const value = document.getElementById('newsletterLimit')?.value;
    const container = document.getElementById('newsletterAdditional');
    
    if (!container) return;
    
    if (value === 'other' || value === 'invalid_email') {
      container.innerHTML = `
        <div class="form-group">
          <label>Beschreiben Sie bitte Ihr Problem:</label>
          <textarea name="newsletterDescription" required maxlength="250" placeholder="Welche Fehlermeldung erhalten Sie? Welche E-Mail-Adresse haben Sie verwendet?"></textarea>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p><strong>🛡️ Hinweis:</strong> Diese Regelung dient dem Schutz vor Spam und sorgt für eine faire Nutzung.</p>
        </div>
      `;
    }
  };

  // ===== FORM SUBMISSION =====
  if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (isSubmitting) return;
      
      const errorArea = document.getElementById('errorArea')?.value;
      const textareaEl = reportForm.querySelector('textarea');
      const description = textareaEl ? textareaEl.value.trim() : '';
      
      if (!errorArea) {
        showNotification('Bitte wählen Sie einen Bereich aus.', 'error');
        return;
      }
      
      if (textareaEl && !description) {
        showNotification('Bitte füllen Sie alle erforderlichen Felder aus.', 'error');
        textareaEl.focus();
        return;
      }
      
      isSubmitting = true;
      showLoading();
      
      const submitBtn = reportForm.querySelector('button[type="submit"]');
      const originalText = submitBtn?.innerHTML;
      if (submitBtn) {
        submitBtn.innerHTML = '⏳ Wird gesendet...';
        submitBtn.disabled = true;
      }
      
      try {
        const dataToSend = {
          report: {
            errorArea: errorArea,
            details: {
              description: description || 'Keine zusätzliche Beschreibung angegeben'
            }
          }
        };
        
        const response = await fetch('/bugreport', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataToSend)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          showNotification('Vielen Dank! Ihr Fehlerbericht wurde erfolgreich übermittelt.', 'success');
          closeReportModal();
        } else {
          showNotification(result.message || 'Beim Senden ist ein Fehler aufgetreten.', 'error');
        }
        
      } catch (error) {
        console.error('Error submitting report:', error);
        showNotification('Verbindungsfehler. Bitte versuchen Sie es später erneut.', 'error');
      } finally {
        isSubmitting = false;
        hideLoading();
        
        if (submitBtn) {
          submitBtn.innerHTML = originalText || '📤 Fehler absenden';
          submitBtn.disabled = false;
        }
      }
    });
  }

  // ===== IMPRESSUM MODAL =====
  window.openImpressumModal = function() {
    if (impressumModal) {
      impressumModal.classList.remove('hidden');
      loadImpressum();
    }
  };

  window.closeImpressumModal = function() {
    if (impressumModal) {
      impressumModal.classList.add('hidden');
    }
  };

  async function loadImpressum() {
    if (!impressumContent) return;
    
    try {
      const response = await fetch('/api/impressum');
      
      if (response.ok) {
        const data = await response.json();
        
        impressumContent.innerHTML = `
          <div class="impressum-content">
            <p><strong>Vorname:</strong> ${escapeHtml(data.Vorname || 'Nicht angegeben')}</p>
            <p><strong>Nachname:</strong> ${escapeHtml(data.Nachname || 'Nicht angegeben')}</p>
            <p><strong>Adresse:</strong> ${escapeHtml(data.Adresse || 'Nicht angegeben')}</p>
            <p><strong>Adresszusatz:</strong> ${escapeHtml(data.Adresszusatz || 'Nicht angegeben')}</p>
            <p><strong>Stadt:</strong> ${escapeHtml(data.Stadt || 'Nicht angegeben')}</p>
            <p><strong>E-Mail:</strong> <a href="mailto:${escapeHtml(data.Email || '')}">${escapeHtml(data.Email || 'Nicht angegeben')}</a></p>
          </div>
        `;
      } else {
        impressumContent.innerHTML = `
          <div class="impressum-content">
            <p style="text-align: center; color: #666;">
              ⚠️ Impressum konnte nicht geladen werden.
            </p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading impressum:', error);
      impressumContent.innerHTML = `
        <div class="impressum-content">
          <p style="text-align: center; color: #666;">
            ❌ Fehler beim Laden des Impressums.
          </p>
        </div>
      `;
    }
  }

  // ===== MODAL CLOSE HANDLERS =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeReportModal();
      closeImpressumModal();
      closeImageModal();
      closeMobileNav();
    }
  });

  // Close modals when clicking outside
  [reportModal, impressumModal, imageModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal === reportModal) closeReportModal();
          if (modal === impressumModal) closeImpressumModal();
          if (modal === imageModal) closeImageModal();
        }
      });
    }
  });

  // ===== SMOOTH SCROLLING =====
  function setupSmoothScrolling() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        
        if (href === '#' || href === '#top') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          
          const headerHeight = 100; // Account for fixed header
          const targetPosition = target.offsetTop - headerHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
          
          // Close mobile nav if open
          closeMobileNav();
        }
      });
    });
  }

  // ===== PERFORMANCE OPTIMIZATIONS =====
  function optimizeImages() {
    const images = document.querySelectorAll('img');
    
    // Simple image loading - only for gallery images, not main images
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            
            // Only apply loading effect to gallery images, not main section images
            if (img.id === 'gallery-image') {
              img.addEventListener('load', () => {
                img.style.opacity = '1';
              });
            }
            
            observer.unobserve(img);
          }
        });
      });
      
      images.forEach(img => {
        // Only observe gallery image, let main images load normally
        if (img.id === 'gallery-image' && img.src) {
          img.style.opacity = '0';
          img.style.transition = 'opacity 0.3s ease';
          imageObserver.observe(img);
        }
      });
    }
  }

  // ===== ACCESSIBILITY ENHANCEMENTS =====
  function setupAccessibility() {
    // Add skip links
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.textContent = 'Zum Hauptinhalt springen';
    skipLink.className = 'skip-link';
    skipLink.style.cssText = `
      position: absolute;
      top: -40px;
      left: 6px;
      background: #000;
      color: #fff;
      padding: 8px;
      text-decoration: none;
      border-radius: 4px;
      z-index: 1000;
      transition: top 0.3s;
    `;
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '6px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-40px';
    });
    
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Add main landmark
    const main = document.querySelector('main');
    if (main && !main.id) {
      main.id = 'main';
    }
    
    // Enhance button accessibility
    const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
    buttons.forEach(button => {
      if (!button.textContent.trim()) {
        button.setAttribute('aria-label', 'Button');
      }
    });
    
    // Add ARIA labels to gallery controls
    if (prevBtn) prevBtn.setAttribute('aria-label', 'Vorheriges Bild');
    if (nextBtn) nextBtn.setAttribute('aria-label', 'Nächstes Bild');
    
    // Add live region for gallery updates
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    liveRegion.id = 'gallery-live-region';
    document.body.appendChild(liveRegion);
  }

  // ===== ENHANCED USER INTERACTIONS =====
  function setupEnhancedInteractions() {
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('button, .chat-button');
    
    buttons.forEach(button => {
      button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          transform: scale(0);
          animation: ripple 0.6s linear;
          pointer-events: none;
        `;
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });
    
    // Add CSS for ripple animation
    if (!document.querySelector('#ripple-styles')) {
      const style = document.createElement('style');
      style.id = 'ripple-styles';
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        @keyframes slideOut {
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ===== ANALYTICS & TRACKING =====
  function trackEvent(eventName, properties = {}) {
    // Simple analytics tracking
    console.log('Event:', eventName, properties);
    
    // Here you could integrate with analytics services
    // Example: gtag('event', eventName, properties);
    
    // Track to localStorage for development
    try {
      const events = JSON.parse(localStorage.getItem('demo_events') || '[]');
      events.push({
        event: eventName,
        properties,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('demo_events', JSON.stringify(events));
    } catch (error) {
      console.warn('Could not save analytics event:', error);
    }
  }

  // ===== ERROR HANDLING =====
  function setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
      
      // Don't show error notifications for script loading errors
      if (e.message && e.message.includes('Script error')) {
        return;
      }
      
      showNotification('Ein unerwarteter Fehler ist aufgetreten.', 'error');
      
      trackEvent('javascript_error', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno
      });
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason);
      
      showNotification('Ein Verbindungsfehler ist aufgetreten.', 'error');
      
      trackEvent('promise_rejection', {
        reason: e.reason?.message || 'Unknown error'
      });
    });
  }

  // ===== NETWORK STATUS =====
  function setupNetworkStatus() {
    function updateOnlineStatus() {
      if (navigator.onLine) {
        showNotification('Verbindung wiederhergestellt.', 'success');
      } else {
        showNotification('Keine Internetverbindung.', 'warning');
      }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  // ===== PERFORMANCE MONITORING =====
  function setupPerformanceMonitoring() {
    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        if ('performance' in window) {
          const navigation = performance.getEntriesByType('navigation')[0];
          
          trackEvent('page_load_performance', {
            loadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
            firstContentfulPaint: Math.round(navigation.responseEnd - navigation.fetchStart)
          });
        }
      }, 0);
    });
    
    // Monitor resource loading
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.duration > 1000) { // Log slow resources
            trackEvent('slow_resource', {
              name: entry.name,
              duration: Math.round(entry.duration),
              type: entry.initiatorType
            });
          }
        });
      });
      
      observer.observe({ entryTypes: ['resource'] });
    }
  }

  // ===== INITIALIZATION =====
  function init() {
    try {
      // Core functionality
      initializeGallery();
      initializeVideo();
      setupSmoothScrolling();
      
      // Enhancements
      setupAccessibility();
      setupEnhancedInteractions();
      setupErrorHandling();
      setupNetworkStatus();
      setupPerformanceMonitoring();
      optimizeImages();
      
      // Update navigation highlight
      updateActiveNavigation();
      
      // Track page view
      trackEvent('page_view', {
        page: 'homepage',
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      });
      
      console.log('🇩🇪 Deutsche Demo Homepage initialized successfully');
      
    } catch (error) {
      console.error('Initialization error:', error);
      showNotification('Fehler beim Laden der Seite.', 'error');
    }
  }

  // ===== PUBLIC API =====
  window.DemoHomepage = {
    // Gallery API
    gallery: {
      next: () => navigateGallery('next'),
      prev: () => navigateGallery('prev'),
      goto: (index) => {
        if (index >= 0 && index < galleryImages.length) {
          currentGalleryIndex = index;
          updateGallery();
        }
      },
      getCurrentIndex: () => currentGalleryIndex,
      getImageCount: () => galleryImages.length
    },
    
    // Video API
    video: {
      play: () => introVideo?.play(),
      pause: () => introVideo?.pause(),
      isPlaying: () => isVideoPlaying
    },
    
    // Navigation API
    navigation: {
      openMobileNav: () => toggleMobileNav(),
      closeMobileNav: closeMobileNav,
      scrollToSection: (sectionId) => {
        const target = document.getElementById(sectionId);
        if (target) {
          const headerHeight = 100;
          const targetPosition = target.offsetTop - headerHeight;
          window.scrollTo({ top: targetPosition, behavior: 'smooth' });
        }
      }
    },
    
    // Utility API
    utils: {
      showNotification,
      trackEvent,
      escapeHtml
    }
  };
  
  // Initialize everything
  init();
});