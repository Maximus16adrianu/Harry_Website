// Deutsche Demo Registration - JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM ELEMENTS =====
  const registerForm = document.getElementById('registerForm');
  const messageContainer = document.getElementById('message');
  const popup = document.getElementById('popup');
  const closePopupBtn = document.getElementById('closePopup');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const notificationContainer = document.getElementById('notificationContainer');
  
  // Form elements
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const passwordConfirmInput = document.getElementById('passwordConfirm');
  const termsCheckbox = document.getElementById('terms');
  const submitButton = registerForm.querySelector('button[type="submit"]');

  // ===== STATE VARIABLES =====
  let isSubmitting = false;
  let validationTimeout = null;

  // ===== UTILITY FUNCTIONS =====
  function showLoading() {
    loadingOverlay.classList.remove('hidden');
    submitButton.disabled = true;
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
    submitButton.disabled = false;
  }

  function showNotification(message, type = 'success') {
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
    closeBtn.addEventListener('click', () => {
      clearTimeout(autoRemove);
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    });
  }

  function showMessage(text, type) {
    messageContainer.textContent = text;
    messageContainer.className = `message-container ${type === 'success' ? 'success-message' : 'error-message'}`;
    messageContainer.classList.remove('hidden');
    
    // Scroll to message
    messageContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Auto hide after 10 seconds
    setTimeout(() => {
      messageContainer.classList.add('hidden');
    }, 10000);
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

  // ===== VALIDATION FUNCTIONS =====
  function validateUsername(username) {
    const errors = [];
    
    if (username.length < 3) {
      errors.push('Der Benutzername muss mindestens 3 Zeichen lang sein');
    }
    
    if (username.length > 20) {
      errors.push('Der Benutzername darf maximal 20 Zeichen lang sein');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Der Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten');
    }
    
    // Check for banned words
    const bannedWords = ['admin', 'root', 'moderator', 'fuck', 'shit', 'nazi', 'hitler'];
    const normalizedUsername = username.toLowerCase();
    
    if (bannedWords.some(word => normalizedUsername.includes(word))) {
      errors.push('Der Benutzername enthält unzulässige Wörter');
    }
    
    return errors;
  }

  function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Das Passwort muss mindestens 8 Zeichen lang sein');
    }
    
    if (password.length > 20) {
      errors.push('Das Passwort darf maximal 20 Zeichen lang sein');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Das Passwort muss mindestens einen Kleinbuchstaben enthalten');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Das Passwort muss mindestens einen Großbuchstaben enthalten');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Das Passwort muss mindestens eine Zahl enthalten');
    }
    
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
      errors.push('Das Passwort muss mindestens ein Sonderzeichen enthalten');
    }
    
    return errors;
  }

  function validatePasswordMatch(password, confirmPassword) {
    if (password !== confirmPassword) {
      return ['Die Passwörter stimmen nicht überein'];
    }
    return [];
  }

  function showValidationError(fieldId, messages) {
    const field = document.getElementById(fieldId);
    field.classList.add('error');
    
    // Remove existing error messages
    const parent = field.parentElement;
    const existingErrors = parent.querySelectorAll('.validation-error');
    existingErrors.forEach(error => error.remove());
    
    // Add new error messages
    messages.forEach(message => {
      const errorElement = document.createElement('div');
      errorElement.className = 'validation-error';
      errorElement.textContent = message;
      parent.appendChild(errorElement);
    });
    
    // Focus the field
    field.focus();
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearValidationError(fieldId) {
    const field = document.getElementById(fieldId);
    field.classList.remove('error');
    
    const parent = field.parentElement;
    const existingErrors = parent.querySelectorAll('.validation-error');
    existingErrors.forEach(error => error.remove());
  }

  function resetAllValidationErrors() {
    ['username', 'password', 'passwordConfirm'].forEach(fieldId => {
      clearValidationError(fieldId);
    });
    messageContainer.classList.add('hidden');
  }

  // ===== REAL-TIME VALIDATION =====
  function setupRealTimeValidation() {
    // Username validation
    usernameInput.addEventListener('input', () => {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        const username = usernameInput.value.trim();
        if (username) {
          const errors = validateUsername(username);
          if (errors.length > 0) {
            showValidationError('username', errors);
          } else {
            clearValidationError('username');
          }
        } else {
          clearValidationError('username');
        }
      }, 500);
    });

    // Password validation
    passwordInput.addEventListener('input', () => {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        const password = passwordInput.value;
        if (password) {
          const errors = validatePassword(password);
          if (errors.length > 0) {
            showValidationError('password', errors);
          } else {
            clearValidationError('password');
          }
        } else {
          clearValidationError('password');
        }
        
        // Also check password confirmation if it has a value
        if (passwordConfirmInput.value) {
          validatePasswordConfirmation();
        }
      }, 500);
    });

    // Password confirmation validation
    passwordConfirmInput.addEventListener('input', validatePasswordConfirmation);
    
    function validatePasswordConfirmation() {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        const password = passwordInput.value;
        const confirmPassword = passwordConfirmInput.value;
        
        if (confirmPassword) {
          const errors = validatePasswordMatch(password, confirmPassword);
          if (errors.length > 0) {
            showValidationError('passwordConfirm', errors);
          } else {
            clearValidationError('passwordConfirm');
          }
        } else {
          clearValidationError('passwordConfirm');
        }
      }, 300);
    }
  }

  // ===== FORM SUBMISSION =====
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    // Clear previous errors
    resetAllValidationErrors();
    
    // Get form values
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;
    const termsAccepted = termsCheckbox.checked;
    
    // Validate all fields
    let hasErrors = false;
    
    // Username validation
    const usernameErrors = validateUsername(username);
    if (usernameErrors.length > 0) {
      showValidationError('username', usernameErrors);
      hasErrors = true;
    }
    
    // Password validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      showValidationError('password', passwordErrors);
      hasErrors = true;
    }
    
    // Password confirmation validation
    const passwordMatchErrors = validatePasswordMatch(password, passwordConfirm);
    if (passwordMatchErrors.length > 0) {
      showValidationError('passwordConfirm', passwordMatchErrors);
      hasErrors = true;
    }
    
    // Terms validation
    if (!termsAccepted) {
      showMessage('Bitte bestätigen Sie, dass Sie kein Hater sind und die Demo-Bewegung unterstützen.', 'error');
      termsCheckbox.focus();
      hasErrors = true;
    }
    
    if (hasErrors) {
      showNotification('Bitte korrigieren Sie die Fehler im Formular.', 'error');
      return;
    }
    
    // Start submission
    isSubmitting = true;
    showLoading();
    
    // Update button text
    const originalButtonText = submitButton.innerHTML;
    submitButton.innerHTML = '⏳ Konto wird erstellt...';
    
    try {
      // Prepare form data
      const formData = {
        username: username,
        password: password,
        requestedAt: new Date().toISOString()
      };
      
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        // Success
        showSuccessPopup();
        registerForm.reset();
        resetAllValidationErrors();
        showNotification('Registrierung erfolgreich eingereicht!', 'success');
      } else {
        // Error from server
        const errorMessage = result.message || 'Bei der Registrierung ist ein Fehler aufgetreten.';
        showMessage(errorMessage, 'error');
        showNotification(errorMessage, 'error');
        
        // Handle specific errors
        if (errorMessage.includes('Username') || errorMessage.includes('Benutzername')) {
          showValidationError('username', [errorMessage]);
        }
      }
      
    } catch (error) {
      console.error('Registrierungsfehler:', error);
      const errorMessage = 'Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.';
      showMessage(errorMessage, 'error');
      showNotification(errorMessage, 'error');
    } finally {
      // Reset UI
      isSubmitting = false;
      hideLoading();
      submitButton.innerHTML = originalButtonText;
      submitButton.disabled = false;
    }
  });

  // ===== POPUP HANDLING =====
  function showSuccessPopup() {
    popup.classList.remove('hidden');
    
    // Focus the close button for accessibility
    setTimeout(() => {
      closePopupBtn.focus();
    }, 300);
  }

  closePopupBtn.addEventListener('click', () => {
    popup.classList.add('hidden');
    window.location.href = 'main.html';
  });

  // Close popup with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popup.classList.contains('hidden')) {
      popup.classList.add('hidden');
      window.location.href = 'main.html';
    }
  });

  // Close popup when clicking outside
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.classList.add('hidden');
      window.location.href = 'main.html';
    }
  });

  // ===== ACCESSIBILITY ENHANCEMENTS =====
  function setupAccessibility() {
    // Add ARIA labels
    usernameInput.setAttribute('aria-describedby', 'username-hint');
    passwordInput.setAttribute('aria-describedby', 'password-hint');
    passwordConfirmInput.setAttribute('aria-describedby', 'password-confirm-hint');
    
    // Create hint elements
    const usernameHint = document.createElement('div');
    usernameHint.id = 'username-hint';
    usernameHint.className = 'sr-only';
    usernameHint.textContent = 'Benutzername muss 3-20 Zeichen lang sein und darf nur Buchstaben, Zahlen, Unterstriche und Bindestriche enthalten';
    usernameInput.parentElement.appendChild(usernameHint);
    
    const passwordHint = document.createElement('div');
    passwordHint.id = 'password-hint';
    passwordHint.className = 'sr-only';
    passwordHint.textContent = 'Passwort muss 8-20 Zeichen lang sein und Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen enthalten';
    passwordInput.parentElement.appendChild(passwordHint);
    
    const passwordConfirmHint = document.createElement('div');
    passwordConfirmHint.id = 'password-confirm-hint';
    passwordConfirmHint.className = 'sr-only';
    passwordConfirmHint.textContent = 'Passwort zur Bestätigung wiederholen';
    passwordConfirmInput.parentElement.appendChild(passwordConfirmHint);
  }

  // ===== SECURITY ENHANCEMENTS =====
  function setupSecurity() {
    // Prevent form from being submitted multiple times
    registerForm.addEventListener('submit', (e) => {
      if (isSubmitting) {
        e.preventDefault();
        return false;
      }
    });
    
    // Clear password fields on page unload for security
    window.addEventListener('beforeunload', () => {
      passwordInput.value = '';
      passwordConfirmInput.value = '';
    });
    
    // Disable autocomplete on password fields in production
    passwordInput.setAttribute('autocomplete', 'new-password');
    passwordConfirmInput.setAttribute('autocomplete', 'new-password');
  }

  // ===== ENHANCED UX FEATURES =====
  function setupEnhancedUX() {
    // Show password strength indicator
    const passwordStrengthIndicator = document.createElement('div');
    passwordStrengthIndicator.className = 'password-strength';
    passwordStrengthIndicator.innerHTML = `
      <div class="strength-bar">
        <div class="strength-fill"></div>
      </div>
      <div class="strength-text">Passwortstärke: <span>Schwach</span></div>
    `;
    passwordInput.parentElement.appendChild(passwordStrengthIndicator);
    
    passwordInput.addEventListener('input', () => {
      const password = passwordInput.value;
      const strength = calculatePasswordStrength(password);
      updatePasswordStrengthIndicator(strength);
    });
    
    // Auto-focus first field
    setTimeout(() => {
      usernameInput.focus();
    }, 300);
    
    // Add smooth transitions for form elements
    const style = document.createElement('style');
    style.textContent = `
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
      
      .password-strength {
        margin-top: 0.5rem;
      }
      
      .strength-bar {
        width: 100%;
        height: 4px;
        background: #e0e0e0;
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 0.5rem;
      }
      
      .strength-fill {
        height: 100%;
        transition: all 0.3s ease;
        border-radius: 2px;
      }
      
      .strength-text {
        font-size: 0.85rem;
        color: #666;
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
      
      @keyframes slideOut {
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function calculatePasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/\d/.test(password)) strength += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 1;
    
    return Math.min(strength, 5);
  }

  function updatePasswordStrengthIndicator(strength) {
    const strengthFill = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text span');
    
    if (!strengthFill || !strengthText) return;
    
    const colors = ['#dc3545', '#fd7e14', '#ffc107', '#28a745', '#20c997'];
    const texts = ['Sehr schwach', 'Schwach', 'Mittel', 'Stark', 'Sehr stark'];
    const widths = ['20%', '40%', '60%', '80%', '100%'];
    
    const index = Math.max(0, strength - 1);
    
    strengthFill.style.width = strength > 0 ? widths[index] : '0%';
    strengthFill.style.backgroundColor = strength > 0 ? colors[index] : '#e0e0e0';
    strengthText.textContent = strength > 0 ? texts[index] : 'Schwach';
    strengthText.style.color = strength > 0 ? colors[index] : '#666';
  }

  // ===== ANALYTICS & TRACKING =====
  function trackEvent(eventName, properties = {}) {
    // Simple analytics tracking
    console.log('Event:', eventName, properties);
    
    // Here you could integrate with analytics services
    // Example: gtag('event', eventName, properties);
  }

  // ===== INITIALIZATION =====
  function init() {
    setupRealTimeValidation();
    setupAccessibility();
    setupSecurity();
    setupEnhancedUX();
    
    // Track page load
    trackEvent('registration_page_loaded');
    
    console.log('Deutsche Demo Registration initialized');
  }

  // Initialize the application
  init();
});