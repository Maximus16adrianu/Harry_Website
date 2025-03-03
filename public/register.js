document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('message');
    
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validierung
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('passwordConfirm').value;
      const termsAccepted = document.getElementById('terms').checked;
      
      // Zurücksetzen von Fehlermeldungen
      resetValidationErrors();
      
      // Überprüfen der Eingaben
      if (username.length < 3) {
        showValidationError('username', 'Der Benutzername muss mindestens 3 Zeichen lang sein');
        return;
      }
      
      if (password.length < 8) {
        showValidationError('password', 'Das Passwort muss mindestens 8 Zeichen lang sein');
        return;
      }
      
      if (password !== passwordConfirm) {
        showValidationError('passwordConfirm', 'Die Passwörter stimmen nicht überein');
        return;
      }
      
      if (!termsAccepted) {
        showMessage('Bitte akzeptieren Sie die Nutzungsbedingungen', 'error');
        return;
      }
      
      // Formulardaten sammeln
      const formData = new FormData(registerForm);
      const data = Object.fromEntries(formData.entries());
      data.requestedAt = new Date().toISOString();
      
      // UI aktualisieren
      const submitButton = registerForm.querySelector('button[type="submit"]');
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = 'Wird verarbeitet...';
      
      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        if (res.ok) {
          showMessage('Registrierung erfolgreich! Bitte warten Sie auf die Freigabe.', 'success');
          registerForm.reset();
        } else {
          showMessage(result.message || 'Bei der Registrierung ist ein Fehler aufgetreten.', 'error');
        }
      } catch (error) {
        console.error('Fehler bei der Registrierung:', error);
        showMessage('Verbindungsfehler. Bitte überprüfen Sie Ihre Internetverbindung.', 'error');
      } finally {
        // UI zurücksetzen
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    });
    
    // Hilfsfunktionen
    function showMessage(text, type) {
      messageDiv.textContent = text;
      messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
      messageDiv.classList.remove('hidden');
      
      // Zum Nachrichtenbereich scrollen
      messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    function showValidationError(fieldId, message) {
      const field = document.getElementById(fieldId);
      field.classList.add('error');
      
      // Fehlermeldung unter dem Feld hinzufügen
      const errorElement = document.createElement('div');
      errorElement.className = 'validation-error';
      errorElement.textContent = message;
      
      const parent = field.parentElement;
      // Vorhandene Fehlermeldungen entfernen
      const existingError = parent.querySelector('.validation-error');
      if (existingError) {
        parent.removeChild(existingError);
      }
      
      parent.appendChild(errorElement);
      field.focus();
    }
    
    function resetValidationErrors() {
      // Alle Fehlerhervorhebungen entfernen
      document.querySelectorAll('.error').forEach(el => {
        el.classList.remove('error');
      });
      
      // Alle Fehlermeldungen entfernen
      document.querySelectorAll('.validation-error').forEach(el => {
        el.parentElement.removeChild(el);
      });
      
      // Nachrichtenbereich zurücksetzen
      messageDiv.className = 'hidden';
      messageDiv.textContent = '';
    }
    
    // Live-Validierung für Passwort-Übereinstimmung
    document.getElementById('passwordConfirm').addEventListener('input', function() {
      const password = document.getElementById('password').value;
      const confirmPassword = this.value;
      
      if (confirmPassword && password !== confirmPassword) {
        this.setCustomValidity('Die Passwörter stimmen nicht überein');
      } else {
        this.setCustomValidity('');
      }
    });
  });