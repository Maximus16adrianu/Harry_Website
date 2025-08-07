// Deutsche Demo Organisator Chat - JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // ===== DOM ELEMENTS =====
  const loginSection = document.getElementById('login-section');
  const chatSection = document.getElementById('chat-section');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const pinnedBtn = document.getElementById('pinned-btn');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const imageInput = document.getElementById('imageInput');
  const uploadBtn = document.getElementById('upload-btn');
  const uploadForm = document.getElementById('upload-form');
  const loadingOverlay = document.getElementById('loading-overlay');
  const notificationContainer = document.getElementById('notification-container');

  // Modal Elements
  const pinnedContainer = document.getElementById('pinned-container');
  const closePinnedBtn = document.getElementById('close-pinned');
  const pinnedMessages = document.getElementById('pinned-messages');
  const imageModal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-img');
  const closeImageModal = document.getElementById('close-image-modal');

  // ===== STATE VARIABLES =====
  let oldestTimestamp = null;
  let loadingOlder = false;
  let currentOrgaUsername = null;
  let isLoggedIn = false;
  let messageLoadInterval = null;

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
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  function showError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
    setTimeout(() => {
      loginError.classList.add('hidden');
    }, 5000);
  }

  function isScrolledToBottom() {
    const threshold = 10;
    return (chatMessages.scrollTop + chatMessages.clientHeight) >= (chatMessages.scrollHeight - threshold);
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ===== AUTHENTICATION =====
  function checkAutoLogin() {
    const storedUsername = localStorage.getItem('orgaUsername');
    const storedPassword = localStorage.getItem('orgaPassword');
    
    if (storedUsername && storedPassword) {
      currentOrgaUsername = storedUsername;
      showLoginSuccess();
      loadInitialMessages();
    }
  }

  function showLoginSuccess() {
    isLoggedIn = true;
    loginSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    logoutBtn.classList.remove('hidden');
    pinnedBtn.classList.remove('hidden');
    
    // Start periodic message loading
    startMessageRefresh();
  }

  function startMessageRefresh() {
    // Load messages every 2 seconds
    messageLoadInterval = setInterval(() => {
      if (isScrolledToBottom()) {
        loadNewMessages(false);
      }
    }, 2000);
  }

  function stopMessageRefresh() {
    if (messageLoadInterval) {
      clearInterval(messageLoadInterval);
      messageLoadInterval = null;
    }
  }

  // ===== LOGIN HANDLING =====
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    
    const orgaUsername = document.getElementById('orgaUsername').value.trim();
    const orgaPassword = document.getElementById('orgaPassword').value.trim();

    if (!orgaUsername || !orgaPassword) {
      hideLoading();
      showError('Bitte geben Sie sowohl Benutzername als auch Passwort ein.');
      return;
    }

    try {
      const response = await fetch('/api/orga/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: orgaUsername, password: orgaPassword })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Store credentials for auto-login
        localStorage.setItem('orgaUsername', orgaUsername);
        localStorage.setItem('orgaPassword', orgaPassword);
        currentOrgaUsername = orgaUsername;
        
        showLoginSuccess();
        loadInitialMessages();
        showNotification('Erfolgreich als Organisator angemeldet!');
      } else {
        showError(data.message || 'Login fehlgeschlagen. Überprüfen Sie Ihre Zugangsdaten.');
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Verbindungsfehler. Bitte versuchen Sie es erneut.');
    }
    
    hideLoading();
  });

  // ===== LOGOUT HANDLING =====
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear stored credentials
    localStorage.removeItem('orgaUsername');
    localStorage.removeItem('orgaPassword');
    
    // Reset state
    isLoggedIn = false;
    currentOrgaUsername = null;
    stopMessageRefresh();
    
    // Show login section
    chatSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    pinnedBtn.classList.add('hidden');
    
    // Clear form
    loginForm.reset();
    chatInput.value = '';
    imageInput.value = '';
    
    showNotification('Erfolgreich abgemeldet.');
  });

  // ===== MESSAGE SENDING =====
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const message = chatInput.value.trim();
    if (!message) return;

    const wasAtBottom = isScrolledToBottom();
    
    try {
      const response = await fetch('/api/orga/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });

      const data = await response.json();
      
      if (response.ok) {
        chatInput.value = '';
        if (wasAtBottom) {
          setTimeout(() => loadNewMessages(true), 100);
        }
        showNotification('Nachricht gesendet!');
      } else {
        showNotification(data.message || 'Fehler beim Senden der Nachricht.', 'error');
      }
    } catch (error) {
      console.error('Send message error:', error);
      showNotification('Verbindungsfehler beim Senden der Nachricht.', 'error');
    }
  });

  // ===== IMAGE UPLOAD =====
  uploadBtn.addEventListener('click', async () => {
    if (!imageInput.files || imageInput.files.length === 0) {
      showNotification('Bitte wählen Sie erst ein Bild aus.', 'warning');
      return;
    }

    const file = imageInput.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      showNotification('Bitte wählen Sie eine gültige Bilddatei aus.', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showNotification('Das Bild ist zu groß. Maximal 5MB erlaubt.', 'error');
      return;
    }

    showLoading();
    const wasAtBottom = isScrolledToBottom();
    
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/orga/chats/image', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (response.ok) {
        imageInput.value = '';
        if (wasAtBottom) {
          setTimeout(() => loadNewMessages(true), 100);
        }
        showNotification('Bild erfolgreich hochgeladen!');
      } else {
        showNotification(data.message || 'Fehler beim Hochladen des Bildes.', 'error');
      }
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('Verbindungsfehler beim Hochladen des Bildes.', 'error');
    }
    
    hideLoading();
  });

  // ===== MESSAGE LOADING =====
  async function loadInitialMessages() {
    try {
      const response = await fetch('/api/orga/chats?limit=50');
      if (response.ok) {
        const messages = await response.json();
        renderMessages(messages, false);
      }
    } catch (error) {
      console.error('Load initial messages error:', error);
      showNotification('Fehler beim Laden der Nachrichten.', 'error');
    }
  }

  async function loadNewMessages(scrollDown = false) {
    try {
      const response = await fetch('/api/orga/chats?limit=20');
      if (response.ok) {
        const messages = await response.json();
        renderMessages(messages, false);
        if (scrollDown) {
          scrollToBottom();
        }
      }
    } catch (error) {
      console.error('Load new messages error:', error);
    }
  }

  async function loadOlderMessages() {
    if (loadingOlder || !oldestTimestamp) return;
    
    loadingOlder = true;
    
    try {
      const response = await fetch(`/api/orga/chats?limit=20&olderThan=${encodeURIComponent(oldestTimestamp)}`);
      if (response.ok) {
        const olderMessages = await response.json();
        if (olderMessages.length > 0) {
          renderMessages(olderMessages, true);
        }
      }
    } catch (error) {
      console.error('Load older messages error:', error);
    }
    
    loadingOlder = false;
  }

  // ===== MESSAGE RENDERING =====
  function renderMessages(messages, prepend = false) {
    if (!messages || messages.length === 0) return;

    // Update oldest timestamp
    if (messages.length > 0) {
      const newOldest = messages[0].timestamp;
      if (!oldestTimestamp || new Date(newOldest) < new Date(oldestTimestamp)) {
        oldestTimestamp = newOldest;
      }
    }

    if (prepend) {
      // Prepend older messages
      const currentScroll = chatMessages.scrollTop;
      const currentHeight = chatMessages.scrollHeight;
      
      messages.reverse().forEach(msg => {
        const msgElement = createMessageElement(msg);
        chatMessages.insertBefore(msgElement, chatMessages.firstChild);
      });
      
      // Maintain scroll position
      const newHeight = chatMessages.scrollHeight;
      chatMessages.scrollTop = currentScroll + (newHeight - currentHeight);
    } else {
      // Replace all messages
      chatMessages.innerHTML = '';
      
      if (messages.length === 0) {
        chatMessages.innerHTML = `
          <div class="welcome-message">
            <h3>🏛️ Willkommen im Organisator Chat</h3>
            <p>Hier können Sie sich mit anderen Organisatoren austauschen und wichtige Nachrichten anpinnen.</p>
          </div>
        `;
        return;
      }
      
      messages.forEach(msg => {
        const msgElement = createMessageElement(msg);
        chatMessages.appendChild(msgElement);
      });
      
      scrollToBottom();
    }
  }

  function createMessageElement(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message orga';
    msgDiv.dataset.messageId = msg.id;

    // Create message content
    let content = `
      <div class="meta">
        <strong>${escapeHtml(msg.user)}</strong>
        ${msg.bundesland ? `(${escapeHtml(msg.bundesland)})` : ''}
        ${msg.rank ? `- ${escapeHtml(msg.rank)}` : ''}
      </div>
    `;

    if (msg.message) {
      content += `<div class="content">${escapeHtml(msg.message)}</div>`;
    }

    if (msg.image) {
      content += `<img src="/pictures/${escapeHtml(msg.image)}" alt="Bild" onclick="openImageModal(this.src)">`;
    }

    content += `<div class="timestamp">${formatTimestamp(msg.timestamp)}</div>`;

    // Add action buttons
    content += `
      <div class="message-actions">
        <button class="pin-btn ${msg.pinned ? 'pinned' : ''}" onclick="togglePin('${msg.id}', ${!msg.pinned})">
          ${msg.pinned ? '📌 Lösen' : '📌 Anpinnen'}
        </button>
    `;

    if (msg.user === currentOrgaUsername) {
      content += `
        <button class="delete-btn" onclick="deleteMessage('${msg.id}')">
          🗑️ Löschen
        </button>
      `;
    }

    content += '</div>';
    msgDiv.innerHTML = content;

    return msgDiv;
  }

  // ===== MESSAGE ACTIONS =====
  window.togglePin = async function(messageId, pin) {
    try {
      const response = await fetch('/api/orga/chats/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, pin })
      });

      const data = await response.json();
      
      if (response.ok) {
        loadNewMessages();
        showNotification(pin ? 'Nachricht angepinnt!' : 'Nachricht gelöst!');
      } else {
        showNotification(data.message || 'Fehler beim Ändern des Pin-Status.', 'error');
      }
    } catch (error) {
      console.error('Toggle pin error:', error);
      showNotification('Verbindungsfehler beim Ändern des Pin-Status.', 'error');
    }
  };

  window.deleteMessage = async function(messageId) {
    if (!confirm('Möchten Sie diese Nachricht wirklich löschen?')) return;

    try {
      const response = await fetch('/api/orga/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });

      const data = await response.json();
      
      if (response.ok) {
        loadNewMessages();
        showNotification('Nachricht gelöscht!');
      } else {
        showNotification(data.message || 'Fehler beim Löschen der Nachricht.', 'error');
      }
    } catch (error) {
      console.error('Delete message error:', error);
      showNotification('Verbindungsfehler beim Löschen der Nachricht.', 'error');
    }
  };

  // ===== PINNED MESSAGES =====
  pinnedBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/orga/chats/pinned');
      if (response.ok) {
        const pinned = await response.json();
        renderPinnedMessages(pinned);
        pinnedContainer.classList.remove('hidden');
      } else {
        showNotification('Fehler beim Laden der angepinnten Nachrichten.', 'error');
      }
    } catch (error) {
      console.error('Load pinned messages error:', error);
      showNotification('Verbindungsfehler beim Laden der angepinnten Nachrichten.', 'error');
    }
  });

  closePinnedBtn.addEventListener('click', () => {
    pinnedContainer.classList.add('hidden');
  });

  function renderPinnedMessages(messages) {
    pinnedMessages.innerHTML = '';
    
    if (messages.length === 0) {
      pinnedMessages.innerHTML = `
        <div class="welcome-message">
          <h3>📌 Keine angepinnten Nachrichten</h3>
          <p>Es sind derzeit keine Nachrichten angepinnt.</p>
        </div>
      `;
      return;
    }

    messages.forEach(msg => {
      const msgElement = createMessageElement(msg);
      pinnedMessages.appendChild(msgElement);
    });
  }

  // ===== IMAGE MODAL =====
  window.openImageModal = function(src) {
    modalImg.src = src;
    imageModal.classList.remove('hidden');
  };

  closeImageModal.addEventListener('click', () => {
    imageModal.classList.add('hidden');
  });

  // Close modals when clicking outside
  pinnedContainer.addEventListener('click', (e) => {
    if (e.target === pinnedContainer) {
      pinnedContainer.classList.add('hidden');
    }
  });

  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.classList.add('hidden');
    }
  });

  // ===== SCROLL HANDLING =====
  chatMessages.addEventListener('scroll', () => {
    if (chatMessages.scrollTop < 100) {
      loadOlderMessages();
    }
  });

  // ===== UTILITY FUNCTIONS =====
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

  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ===== KEYBOARD SHORTCUTS =====
  document.addEventListener('keydown', (e) => {
    // Escape key closes modals
    if (e.key === 'Escape') {
      pinnedContainer.classList.add('hidden');
      imageModal.classList.add('hidden');
    }
    
    // Ctrl+Enter sends message
    if (e.ctrlKey && e.key === 'Enter' && isLoggedIn) {
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // ===== INITIALIZATION =====
  checkAutoLogin();
});