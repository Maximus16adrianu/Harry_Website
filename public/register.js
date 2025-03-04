document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const messageDiv = document.getElementById('message');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Eingaben validieren
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('passwordConfirm').value;
        const termsAccepted = document.getElementById('terms').checked;
        
        // Vorherige Fehlermeldungen entfernen
        resetValidationErrors();
        
        // Validierung der Eingaben
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
        
        // UI-Feedback: Button deaktivieren und Text ändern
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
                // Popup anzeigen statt der herkömmlichen Nachricht
                showPopup();
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
    
    // Hilfsfunktion: Nachricht anzeigen
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
        messageDiv.classList.remove('hidden');
        
        // Automatisch zum Nachrichtenbereich scrollen
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Hilfsfunktion: Validierungsfehler anzeigen
    function showValidationError(fieldId, message) {
        const field = document.getElementById(fieldId);
        field.classList.add('error');
        
        const errorElement = document.createElement('div');
        errorElement.className = 'validation-error';
        errorElement.textContent = message;
        
        const parent = field.parentElement;
        const existingError = parent.querySelector('.validation-error');
        if (existingError) {
            parent.removeChild(existingError);
        }
        
        parent.appendChild(errorElement);
        field.focus();
    }
    
    // Alle Validierungsfehler zurücksetzen
    function resetValidationErrors() {
        document.querySelectorAll('.error').forEach(el => {
            el.classList.remove('error');
        });
        
        document.querySelectorAll('.validation-error').forEach(el => {
            el.parentElement.removeChild(el);
        });
        
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
    
    // Popup-Funktionalität
    function showPopup() {
        const popup = document.getElementById('popup');
        popup.classList.remove('hidden');
    }
    
    // Event-Listener zum Schließen des Popups
    document.getElementById('closePopup').addEventListener('click', () => {
        document.getElementById('popup').classList.add('hidden');
    });
  });