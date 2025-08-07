// Deutsche Demo Presseportal - JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // ===== DOM ELEMENTS =====
  const loginOverlay = document.getElementById("loginOverlay");
  const infoModal = document.getElementById("infoModal");
  const openLoginBtn = document.getElementById("openLogin");
  const closeLoginBtn = document.getElementById("closeLogin");
  const loginForm = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const loginError = document.getElementById("loginError");
  const editButtons = document.querySelectorAll(".edit-btn");
  const mailLink = document.getElementById("mailLink");
  const editMailBtn = document.getElementById("editMail");
  const defaultMail = document.getElementById("defaultMail");
  const gmailMail = document.getElementById("gmailMail");
  const infoBtn = document.getElementById("infoBtn");
  const closeInfoBtn = document.getElementById("closeInfo");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const notificationContainer = document.getElementById("notificationContainer");

  // ===== STATE VARIABLES =====
  let isOrga = false;
  let currentEditingElement = null;

  // ===== UTILITY FUNCTIONS =====
  function showLoading() {
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success': icon = '✅'; break;
      case 'error': icon = '❌'; break;
      case 'warning': icon = '⚠️'; break;
      default: icon = 'ℹ️';
    }
    
    notification.innerHTML = `${icon} ${message}`;
    notificationContainer.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Remove on click
    notification.addEventListener('click', () => {
      notification.remove();
    });
  }

  function showError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
    setTimeout(() => {
      loginError.classList.add('hidden');
    }, 5000);
  }

  // ===== TEXT PARSING FUNCTIONS =====
  function parseColoredText(rawText) {
    if (!rawText) return '';
    
    // Parse color commands: #color:text#
    return rawText.replace(/#(\w+|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}):([^#]+)#/g, (match, color, text) => {
      // Validate color
      if (isValidColor(color)) {
        return `<span style="color: ${color};">${escapeHtml(text)}</span>`;
      }
      return match; // Return original if invalid color
    });
  }

  function isValidColor(color) {
    // Check for common color names and hex colors
    const validColors = ['red', 'blue', 'green', 'orange', 'purple', 'black', 'white', 'yellow', 'pink', 'brown', 'gray', 'grey'];
    const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    
    return validColors.includes(color.toLowerCase()) || hexPattern.test(color);
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

  // ===== PRESS CONTENT LOADING =====
  async function loadPresse() {
    try {
      showLoading();
      const response = await fetch('/api/presse');
      const data = await response.json();

      const leftTextElem = document.getElementById('leftText');
      const rightTextElem = document.getElementById('rightText');

      // Set raw text data
      const leftText = data.leftText || 'Hier steht der linke Presseinhalt.';
      const rightText = data.rightText || 'Hier steht der rechte Presseinhalt.';

      leftTextElem.setAttribute("data-rawtext", leftText);
      rightTextElem.setAttribute("data-rawtext", rightText);

      // Parse and display formatted text
      leftTextElem.innerHTML = parseColoredText(leftText);
      rightTextElem.innerHTML = parseColoredText(rightText);

      // Set email
      const mail = data.mail || 'Patrick-grossdemo@web.de';
      updateEmailLinks(mail);

    } catch (err) {
      console.error("Fehler beim Laden des Presseinhalts:", err);
      showNotification('Fehler beim Laden des Presseinhalts.', 'error');
    } finally {
      hideLoading();
    }
  }

  function updateEmailLinks(mail) {
    mailLink.href = 'mailto:' + mail;
    mailLink.textContent = mail;
    defaultMail.href = 'mailto:' + mail;
    gmailMail.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + mail;
  }

  // ===== AUTHENTICATION =====
  function checkAutoLogin() {
    // Check if already logged in (you could use localStorage here if needed)
    // For now, we'll just load the content
    loadPresse();
  }

  function setOrgaLoggedIn() {
    isOrga = true;
    document.body.classList.add("orga-loggedin");
    
    // Show orga-only elements
    editButtons.forEach(btn => btn.classList.remove('hidden'));
    editMailBtn.classList.remove('hidden');
    infoBtn.classList.remove('hidden');
    
    // Change login button text
    openLoginBtn.innerHTML = '🚪 Ausloggen';
    openLoginBtn.onclick = logout;
  }

  function logout() {
    isOrga = false;
    document.body.classList.remove("orga-loggedin");
    
    // Hide orga-only elements
    editButtons.forEach(btn => btn.classList.add('hidden'));
    editMailBtn.classList.add('hidden');
    infoBtn.classList.add('hidden');
    
    // Reset login button
    openLoginBtn.innerHTML = '🏛️ Orga Login';
    openLoginBtn.onclick = () => loginOverlay.classList.remove('hidden');
    
    // Cancel any editing
    cancelAllEditing();
    
    showNotification('Erfolgreich abgemeldet.');
  }

  // ===== LOGIN HANDLING =====
  openLoginBtn.addEventListener("click", () => {
    if (!isOrga) {
      loginOverlay.classList.remove('hidden');
    }
  });

  closeLoginBtn.addEventListener("click", () => {
    loginOverlay.classList.add('hidden');
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showLoading();

    const username = document.getElementById('orgaUsername').value.trim();
    const password = document.getElementById('orgaPassword').value.trim();

    if (!username || !password) {
      hideLoading();
      showError("Bitte beide Felder ausfüllen.");
      return;
    }

    try {
      const response = await fetch('/api/orga/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.message && data.message.includes('erfolgreich')) {
        setOrgaLoggedIn();
        loginOverlay.classList.add('hidden');
        showNotification('Organisator-Login erfolgreich!');
        
        // Clear form
        loginForm.reset();
      } else {
        showError(data.message || "Login fehlgeschlagen. Überprüfen Sie Ihre Zugangsdaten.");
      }
    } catch (err) {
      console.error("Fehler beim Login:", err);
      showError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
    } finally {
      hideLoading();
    }
  });

  // ===== INFO MODAL =====
  infoBtn.addEventListener("click", () => {
    if (isOrga) {
      infoModal.classList.remove('hidden');
    }
  });

  closeInfoBtn.addEventListener("click", () => {
    infoModal.classList.add('hidden');
  });

  // ===== CONTENT EDITING =====
  function cancelAllEditing() {
    editButtons.forEach(btn => {
      const targetId = btn.getAttribute("data-target");
      const pElem = document.getElementById(targetId);
      
      if (pElem.getAttribute("data-editable") === "true") {
        cancelEditing(pElem, btn);
      }
    });
  }

  function cancelEditing(pElem, btn) {
    pElem.contentEditable = "false";
    pElem.style.border = "none";
    pElem.setAttribute("data-editable", "false");
    btn.textContent = "✏️ Bearbeiten";
    btn.classList.remove('saving');
    
    // Restore formatted text
    const rawText = pElem.getAttribute("data-rawtext");
    pElem.innerHTML = parseColoredText(rawText);
    
    currentEditingElement = null;
  }

  editButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!isOrga) return;

      const targetId = btn.getAttribute("data-target");
      const pElem = document.getElementById(targetId);

      // Check if switching between edit modes
      if (currentEditingElement && currentEditingElement !== pElem) {
        // Cancel other editing first
        const otherBtn = document.querySelector(`.edit-btn[data-target="${currentEditingElement.id}"]`);
        if (otherBtn) {
          cancelEditing(currentEditingElement, otherBtn);
        }
      }

      // Toggle edit mode
      if (pElem.getAttribute("data-editable") === "false") {
        // Enter edit mode
        pElem.textContent = pElem.getAttribute("data-rawtext");
        pElem.contentEditable = "true";
        pElem.focus();
        pElem.setAttribute("data-editable", "true");
        btn.textContent = "💾 Speichern";
        currentEditingElement = pElem;

        // Select all text for easier editing
        const range = document.createRange();
        range.selectNodeContents(pElem);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

      } else {
        // Save mode
        btn.classList.add('saving');
        btn.textContent = "💾 Speichert...";
        
        try {
          const rawText = pElem.textContent || pElem.innerText;
          pElem.setAttribute("data-rawtext", rawText);
          
          // Update display with parsed text
          pElem.innerHTML = parseColoredText(rawText);
          pElem.contentEditable = "false";
          pElem.setAttribute("data-editable", "false");

          // Collect all data for saving
          const leftRaw = document.getElementById('leftText').getAttribute("data-rawtext");
          const rightRaw = document.getElementById('rightText').getAttribute("data-rawtext");
          const mail = mailLink.textContent;

          const response = await fetch('/api/presse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leftText: leftRaw, rightText: rightRaw, mail })
          });

          const data = await response.json();

          if (response.ok) {
            showNotification('Änderungen erfolgreich gespeichert!');
          } else {
            showNotification(data.message || 'Fehler beim Speichern.', 'error');
          }

        } catch (err) {
          console.error("Fehler beim Speichern:", err);
          showNotification('Verbindungsfehler beim Speichern.', 'error');
        } finally {
          btn.classList.remove('saving');
          btn.textContent = "✏️ Bearbeiten";
          currentEditingElement = null;
        }
      }
    });
  });

  // ===== EMAIL EDITING =====
  editMailBtn.addEventListener("click", () => {
    if (!isOrga) return;

    const currentMail = mailLink.textContent;
    const input = document.createElement("input");
    input.type = "email";
    input.value = currentMail;
    input.className = "email-input";
    input.placeholder = "E-Mail-Adresse eingeben...";

    // Replace email link with input
    mailLink.parentNode.insertBefore(input, mailLink);
    mailLink.style.display = "none";
    editMailBtn.style.display = "none";
    input.focus();
    input.select();

    async function saveEmail() {
      const newMail = input.value.trim();
      
      // Validate email
      if (newMail && !isValidEmail(newMail)) {
        showNotification('Bitte geben Sie eine gültige E-Mail-Adresse ein.', 'error');
        input.focus();
        return;
      }

      const finalMail = newMail || currentMail;
      
      try {
        // Update UI
        updateEmailLinks(finalMail);
        mailLink.style.display = "inline";
        editMailBtn.style.display = "inline-flex";
        input.remove();

        // Save to server
        const leftRaw = document.getElementById('leftText').getAttribute("data-rawtext");
        const rightRaw = document.getElementById('rightText').getAttribute("data-rawtext");

        const response = await fetch('/api/presse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftText: leftRaw, rightText: rightRaw, mail: finalMail })
        });

        const data = await response.json();

        if (response.ok) {
          showNotification('E-Mail-Adresse erfolgreich aktualisiert!');
        } else {
          showNotification(data.message || 'Fehler beim Speichern der E-Mail.', 'error');
        }

      } catch (err) {
        console.error("Fehler beim Speichern der E-Mail:", err);
        showNotification('Verbindungsfehler beim Speichern der E-Mail.', 'error');
      }
    }

    // Save on blur or enter
    input.addEventListener("blur", saveEmail);
    input.addEventListener("keydown", (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEmail();
      }
      if (e.key === 'Escape') {
        mailLink.style.display = "inline";
        editMailBtn.style.display = "inline-flex";
        input.remove();
      }
    });
  });

  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ===== MODAL HANDLING =====
  // Close modals when clicking outside
  loginOverlay.addEventListener('click', (e) => {
    if (e.target === loginOverlay) {
      loginOverlay.classList.add('hidden');
    }
  });

  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) {
      infoModal.classList.add('hidden');
    }
  });

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
    // Escape key closes modals and cancels editing
    if (e.key === 'Escape') {
      loginOverlay.classList.add('hidden');
      infoModal.classList.add('hidden');
      
      if (currentEditingElement) {
        const btn = document.querySelector(`.edit-btn[data-target="${currentEditingElement.id}"]`);
        if (btn) {
          cancelEditing(currentEditingElement, btn);
        }
      }
    }
    
    // Ctrl+S saves current editing
    if (e.ctrlKey && e.key === 's' && currentEditingElement) {
      e.preventDefault();
      const btn = document.querySelector(`.edit-btn[data-target="${currentEditingElement.id}"]`);
      if (btn) {
        btn.click();
      }
    }
  });

  // ===== AUTO-SAVE ON PAGE UNLOAD =====
  window.addEventListener('beforeunload', (e) => {
    if (currentEditingElement) {
      e.preventDefault();
      e.returnValue = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
      return e.returnValue;
    }
  });

  // ===== INITIALIZATION =====
  checkAutoLogin();

  // ===== ADDITIONAL FEATURES =====
  
  // Auto-resize text areas when editing
  document.addEventListener('input', (e) => {
    if (e.target.contentEditable === 'true') {
      // Automatically adjust height if needed
      const minHeight = 200;
      if (e.target.scrollHeight > e.target.clientHeight) {
        e.target.style.minHeight = Math.max(minHeight, e.target.scrollHeight) + 'px';
      }
    }
  });

  // Prevent accidental navigation away while editing
  document.addEventListener('click', (e) => {
    if (currentEditingElement && e.target.tagName === 'A' && e.target !== mailLink) {
      if (!confirm('Sie haben ungespeicherte Änderungen. Möchten Sie wirklich fortfahren?')) {
        e.preventDefault();
      }
    }
  });

  // Add visual feedback for successful operations
  function addSuccessEffect(element) {
    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'scale(1.02)';
    element.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.3)';
    
    setTimeout(() => {
      element.style.transform = '';
      element.style.boxShadow = '';
    }, 300);
  }

  // Enhanced notification system
  function showAdvancedNotification(message, type = 'success', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = '';
    switch (type) {
      case 'success': icon = '✅'; break;
      case 'error': icon = '❌'; break;
      case 'warning': icon = '⚠️'; break;
      case 'info': icon = 'ℹ️'; break;
      default: icon = '📌';
    }
    
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto remove
    const autoRemove = setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
    
    // Manual close
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      clearTimeout(autoRemove);
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    });
  }

  // Add slideOut animation to CSS if needed
  if (!document.querySelector('style[data-notification-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notification-styles', 'true');
    style.textContent = `
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
});