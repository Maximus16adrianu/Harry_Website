document.addEventListener('DOMContentLoaded', () => {
    const newsletterForm = document.getElementById('newsletterForm');
    const emailInput = document.getElementById('emailInput');
    const messageDiv = document.getElementById('message');
  
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
  
      // Einfache E-Mail-Validierung
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        messageDiv.textContent = 'Bitte eine gültige E-Mail-Adresse eingeben.';
        messageDiv.style.color = 'red';
        return;
      }
  
      try {
        // An den Server senden
        const res = await fetch('/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
  
        if (res.ok) {
          messageDiv.textContent = data.message || 'Erfolgreich abonniert!';
          messageDiv.style.color = 'green';
          emailInput.value = '';
        } else {
          messageDiv.textContent = data.message || 'Fehler bei der Anmeldung.';
          messageDiv.style.color = 'red';
        }
      } catch (error) {
        console.error(error);
        messageDiv.textContent = 'Serverfehler. Bitte später erneut versuchen.';
        messageDiv.style.color = 'red';
      }
    });
  });
  