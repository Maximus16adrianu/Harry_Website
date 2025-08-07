// Deutsche Demo Newsletter - JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM ELEMENTS =====
  const newsletterForm = document.getElementById('newsletterForm');
  const emailInput = document.getElementById('emailInput');
  const messageContainer = document.getElementById('message');
  const successModal = document.getElementById('successModal');
  const closeSuccessModalBtn = document.getElementById('closeSuccessModal');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const notificationContainer = document.getElementById('notificationContainer');
  const subscribeBtn = newsletterForm?.querySelector('button[type="submit"]');

  // ===== STATE VARIABLES =====
  let isSubmitting = false;
  let validationTimeout = null;

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

  function showMessage(text, type) {
    if (!messageContainer) return;
    
    messageContainer.textContent = text;
    messageContainer.className = `message-container ${type}`;
    messageContainer.classList.remove('hidden');
    
    // Scroll to message
    messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto hide after 8 seconds
    setTimeout(() => {
      messageContainer.classList.add('hidden');
    }, 8000);
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

  // ===== EMAIL VALIDATION =====
  function validateEmail(email) {
    const errors = [];
    
    // Basic format validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      errors.push('Bitte geben Sie eine gültige E-Mail-Adresse ein');
    }
    
    // Length validation
    if (email.length > 254) {
      errors.push('E-Mail-Adresse ist zu lang');
    }
    
    // Domain validation
    const domain = email.split('@')[1];
    if (domain) {
      if (domain.length > 253) {
        errors.push('Domain-Name ist zu lang');
      }
      
      // Check for valid TLD
      if (!domain.includes('.') || domain.endsWith('.')) {
        errors.push('Ungültiger Domain-Name');
      }
    }
    
    // Check for common typos
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'web.de', 'gmx.de', 't-online.de'];
    const suggestions = [];
    
    if (domain && !commonDomains.includes(domain)) {
      // Check for common typos in popular domains
      const typoChecks = [
        { typo: 'gmial.com', correct: 'gmail.com' },
        { typo: 'gmai.com', correct: 'gmail.com' },
        { typo: 'gmail.co', correct: 'gmail.com' },
        { typo: 'yahooo.com', correct: 'yahoo.com' },
        { typo: 'hotmial.com', correct: 'hotmail.com' },
        { typo: 'outlok.com', correct: 'outlook.com' }
      ];
      
      const suggestion = typoChecks.find(check => check.typo === domain);
      if (suggestion) {
        suggestions.push(`Meinten Sie ${email.replace(domain, suggestion.correct)}?`);
      }
    }
    
    return { errors, suggestions };
  }

  function showEmailValidation(result) {
    // Remove existing validation messages
    const existingMessages = emailInput.parentElement.parentElement.querySelectorAll('.validation-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Remove error styling
    emailInput.classList.remove('error');
    
    if (result.errors.length > 0) {
      emailInput.classList.add('error');
      
      result.errors.forEach(error => {
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-message error';
        errorElement.innerHTML = `⚠️ ${error}`;
        emailInput.parentElement.parentElement.appendChild(errorElement);
      });
    }
    
    if (result.suggestions.length > 0) {
      result.suggestions.forEach(suggestion => {
        const suggestionElement = document.createElement('div');
        suggestionElement.className = 'validation-message suggestion';
        suggestionElement.innerHTML = `💡 ${suggestion}`;
        emailInput.parentElement.parentElement.appendChild(suggestionElement);
      });
    }
  }

  // ===== REAL-TIME VALIDATION =====
  function setupRealTimeValidation() {
    if (!emailInput) return;
    
    emailInput.addEventListener('input', () => {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        const email = emailInput.value.trim();
        if (email) {
          const result = validateEmail(email);
          showEmailValidation(result);
        } else {
          // Clear validation when empty
          showEmailValidation({ errors: [], suggestions: [] });
        }
      }, 500);
    });
    
    // Clear validation on focus
    emailInput.addEventListener('focus', () => {
      showEmailValidation({ errors: [], suggestions: [] });
    });
  }

  // ===== FORM SUBMISSION =====
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (isSubmitting) return;
      
      const email = emailInput.value.trim();
      
      // Validate email
      const validationResult = validateEmail(email);
      if (validationResult.errors.length > 0) {
        showEmailValidation(validationResult);
        showNotification('Bitte korrigieren Sie Ihre E-Mail-Adresse.', 'error');
        emailInput.focus();
        return;
      }
      
      // Start submission
      isSubmitting = true;
      showLoading();
      
      // Update button
      const originalButtonText = subscribeBtn?.innerHTML;
      if (subscribeBtn) {
        subscribeBtn.innerHTML = '⏳ Wird verarbeitet...';
        subscribeBtn.disabled = true;
      }
      
      try {
        const response = await fetch('/newsletter/subscribe', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          // Success
          showSuccessModal();
          newsletterForm.reset();
          showEmailValidation({ errors: [], suggestions: [] });
          showNotification('Newsletter erfolgreich abonniert!', 'success');
          
          // Track success
          trackEvent('newsletter_subscribe_success', { email_domain: email.split('@')[1] });
          
        } else {
          // Server error
          const errorMessage = data.message || 'Fehler bei der Newsletter-Anmeldung.';
          showMessage(errorMessage, 'error');
          showNotification(errorMessage, 'error');
          
          // Handle specific errors
          if (errorMessage.includes('bereits') || errorMessage.includes('already')) {
            showMessage('Diese E-Mail-Adresse ist bereits für den Newsletter registriert.', 'warning');
          } else if (errorMessage.includes('Stunde') || errorMessage.includes('hour')) {
            showMessage('Sie können nur eine E-Mail pro Stunde absenden. Bitte versuchen Sie es später erneut.', 'warning');
          }
          
          trackEvent('newsletter_subscribe_error', { 
            error: errorMessage,
            email_domain: email.split('@')[1] 
          });
        }
        
      } catch (error) {
        console.error('Newsletter subscription error:', error);
        const errorMessage = 'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
        showMessage(errorMessage, 'error');
        showNotification(errorMessage, 'error');
        
        trackEvent('newsletter_subscribe_network_error', {
          error: error.message,
          email_domain: email.split('@')[1]
        });
      } finally {
        // Reset UI
        isSubmitting = false;
        hideLoading();
        
        if (subscribeBtn) {
          subscribeBtn.innerHTML = originalButtonText || '📧 Jetzt abonnieren';
          subscribeBtn.disabled = false;
        }
      }
    });
  }

  // ===== SUCCESS MODAL =====
  function showSuccessModal() {
    if (successModal) {
      successModal.classList.remove('hidden');
      
      // Focus close button
      setTimeout(() => {
        if (closeSuccessModalBtn) {
          closeSuccessModalBtn.focus();
        }
      }, 300);
    }
  }

  function closeSuccessModal() {
    if (successModal) {
      successModal.classList.add('hidden');
    }
  }

  if (closeSuccessModalBtn) {
    closeSuccessModalBtn.addEventListener('click', closeSuccessModal);
  }

  // ===== MODAL CLOSE HANDLERS =====
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSuccessModal();
    }
  });

  // Close modal when clicking outside
  if (successModal) {
    successModal.addEventListener('click', (e) => {
      if (e.target === successModal) {
        closeSuccessModal();
      }
    });
  }

  // ===== ACCESSIBILITY ENHANCEMENTS =====
  function setupAccessibility() {
    // Add ARIA labels
    if (emailInput) {
      emailInput.setAttribute('aria-describedby', 'email-hint');
      emailInput.setAttribute('autocomplete', 'email');
      emailInput.setAttribute('spellcheck', 'false');
    }
    
    // Create hint element
    if (emailInput) {
      const emailHint = document.createElement('div');
      emailHint.id = 'email-hint';
      emailHint.className = 'sr-only';
      emailHint.textContent = 'E-Mail-Adresse für Newsletter-Anmeldung eingeben';
      emailInput.parentElement.appendChild(emailHint);
    }
    
    // Add skip link
    const skipLink = document.createElement('a');
    skipLink.href = '#newsletterForm';
    skipLink.textContent = 'Zum Newsletter-Formular springen';
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
  }

  // ===== ENHANCED UX FEATURES =====
  function setupEnhancedUX() {
    // Auto-focus email input
    if (emailInput) {
      setTimeout(() => {
        emailInput.focus();
      }, 500);
    }
    
    // Add ripple effect to subscribe button
    if (subscribeBtn) {
      subscribeBtn.addEventListener('click', function(e) {
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
    }
    
    // Add CSS for animations
    if (!document.querySelector('#newsletter-styles')) {
      const style = document.createElement('style');
      style.id = 'newsletter-styles';
      style.textContent = `
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        .validation-message {
          margin-top: 0.5rem;
          padding: 0.5rem;
          border-radius: 6px;
          font-size: 0.85rem;
          animation: fadeIn 0.3s ease;
        }
        
        .validation-message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
        
        .validation-message.suggestion {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }
        
        .input-container input.error {
          border-color: #dc3545;
          background-color: rgba(220, 53, 69, 0.05);
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
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
        
        .notification {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        
        .notification-close {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        .notification-close:hover {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ===== ANALYTICS & TRACKING =====
  function trackEvent(eventName, properties = {}) {
    console.log('Event:', eventName, properties);
    
    // Simple analytics tracking to localStorage
    try {
      const events = JSON.parse(localStorage.getItem('newsletter_events') || '[]');
      events.push({
        event: eventName,
        properties,
        timestamp: new Date().toISOString(),
        page: 'newsletter'
      });
      
      // Keep only last 50 events
      if (events.length > 50) {
        events.splice(0, events.length - 50);
      }
      
      localStorage.setItem('newsletter_events', JSON.stringify(events));
    } catch (error) {
      console.warn('Could not save analytics event:', error);
    }
  }

  // ===== ERROR HANDLING =====
  function setupErrorHandling() {
    // Global error handler for this page
    window.addEventListener('error', (e) => {
      console.error('Newsletter page error:', e.error);
      
      if (e.message && !e.message.includes('Script error')) {
        showNotification('Ein unerwarteter Fehler ist aufgetreten.', 'error');
        
        trackEvent('javascript_error', {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno
        });
      }
    });
    
    // Network status monitoring
    window.addEventListener('online', () => {
      showNotification('Verbindung wiederhergestellt.', 'success');
    });
    
    window.addEventListener('offline', () => {
      showNotification('Keine Internetverbindung.', 'warning');
    });
  }

  // ===== INITIALIZATION =====
  function init() {
    try {
      setupRealTimeValidation();
      setupAccessibility();
      setupEnhancedUX();
      setupErrorHandling();
      
      // Track page view
      trackEvent('newsletter_page_view', {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      });
      
      console.log('📧 Deutsche Demo Newsletter initialized successfully');
      
    } catch (error) {
      console.error('Newsletter initialization error:', error);
      showNotification('Fehler beim Laden der Seite.', 'error');
    }
  }

  // ===== PUBLIC API =====
  window.NewsletterApp = {
    subscribe: (email) => {
      if (emailInput) {
        emailInput.value = email;
        newsletterForm?.dispatchEvent(new Event('submit'));
      }
    },
    
    validateEmail: validateEmail,
    
    utils: {
      showNotification,
      trackEvent,
      escapeHtml
    }
  };
  
  // Initialize the application
  init();
});