document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const chatContainer = document.getElementById('chat-container');
    const pinnedContainer = document.getElementById('pinned-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');
    const imageInput = document.getElementById('imageInput');
    const uploadBtn = document.getElementById('upload-btn');
    const pinnedBtn = document.getElementById('pinned-btn');
    const closePinnedBtn = document.getElementById('close-pinned');
    const pinnedMessages = document.getElementById('pinned-messages');
    const modal = document.getElementById('modal');
    const modalImg = document.getElementById('modal-img');
    const closeModal = document.getElementById('close-modal');
  
    let oldestTimestamp = null;
    let loadingOlder = false;
  
    // Prüfen, ob der Chat-Bereich am unteren Ende ist
    function isScrolledToBottom() {
      return (chatMessages.scrollTop + chatMessages.clientHeight) >= (chatMessages.scrollHeight - 5);
    }
  
    // Automatischer Login (Flag in localStorage)
    if (localStorage.getItem('orgaLoggedIn') === 'true') {
      loginContainer.style.display = 'none';
      chatContainer.style.display = 'block';
      loadNewMessages();
    }
  
    // Orga Login
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const orgaUsername = document.getElementById('orgaUsername').value;
      const orgaPassword = document.getElementById('orgaPassword').value;
  
      const res = await fetch('/api/orga/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: orgaUsername, password: orgaPassword })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('orgaLoggedIn', 'true');
        loginContainer.style.display = 'none';
        chatContainer.style.display = 'block';
        loadNewMessages();
      } else {
        loginError.textContent = data.message || 'Login fehlgeschlagen';
      }
    });
  
    // Orga Logout
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/orga/logout', { method: 'POST' });
      localStorage.removeItem('orgaLoggedIn');
      location.reload();
    });
  
    // Sende Textnachricht
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = chatInput.value.trim();
      if (!message) return;
      const res = await fetch('/api/orga/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      if (res.ok) {
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        loadNewMessages();
      } else {
        alert(data.message || 'Fehler beim Senden der Nachricht');
      }
    });
  
    // Sende Bildnachricht
    uploadBtn.addEventListener('click', async () => {
      if (!imageInput.files || imageInput.files.length === 0) return;
      const formData = new FormData();
      formData.append('image', imageInput.files[0]);
  
      const res = await fetch('/api/orga/chats/image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        imageInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;
        loadNewMessages();
      } else {
        alert(data.message || 'Fehler beim Hochladen des Bildes');
      }
    });
  
    // Bildvergrößerung: Öffne Modal beim Klick auf ein Bild
    chatMessages.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'img') {
        modal.style.display = 'block';
        modalImg.src = e.target.src;
      }
    });
  
    // Schließe Modal
    closeModal.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  
    // Laden neuer Nachrichten (limit 20)
    async function loadNewMessages() {
      if (!isScrolledToBottom()) return;
      const res = await fetch('/api/orga/chats?limit=20');
      if (res.ok) {
        const messages = await res.json();
        renderMessages(messages, false);
      }
    }
  
    // Laden älterer Nachrichten (beim Scrollen nach oben)
    async function loadOlderMessages() {
      if (loadingOlder) return;
      loadingOlder = true;
      if (!oldestTimestamp) {
        loadingOlder = false;
        return;
      }
      const res = await fetch(`/api/orga/chats?limit=20&olderThan=${encodeURIComponent(oldestTimestamp)}`);
      if (res.ok) {
        const olderMessages = await res.json();
        if (olderMessages.length > 0) {
          renderMessages(olderMessages, true);
        }
      }
      loadingOlder = false;
    }
  
    // Rendert Nachrichten – prepend bei älteren Nachrichten
    function renderMessages(messages, prepend) {
      if (messages.length > 0) {
        const newOldest = messages[0].timestamp;
        if (!oldestTimestamp || new Date(newOldest) < new Date(oldestTimestamp)) {
          oldestTimestamp = newOldest;
        }
      }
      if (prepend) {
        const currentScroll = chatMessages.scrollTop;
        const currentHeight = chatMessages.scrollHeight;
        messages.forEach(msg => {
          const msgDiv = createMessageDiv(msg);
          chatMessages.insertBefore(msgDiv, chatMessages.firstChild);
        });
        const newHeight = chatMessages.scrollHeight;
        chatMessages.scrollTop = currentScroll + (newHeight - currentHeight);
      } else {
        chatMessages.innerHTML = '';
        messages.forEach(msg => {
          const msgDiv = createMessageDiv(msg);
          chatMessages.appendChild(msgDiv);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    }
  
    // Erzeugt ein Message-DIV inklusive Pin-Button
    function createMessageDiv(msg) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'message';
      let content = `<strong>${msg.user} (${msg.bundesland}):</strong><br>`;
      if (msg.image) {
        content += `<img src="/pictures/${msg.image}" alt="Bild"> <br>`;
      }
      if (msg.message) {
        content += msg.message;
      }
      content += `<div class="timestamp">${new Date(msg.timestamp).toLocaleString()}</div>`;
      msgDiv.innerHTML = content;
      // Füge für Organisatoren den Pin-Button hinzu
      const pinBtn = document.createElement('button');
      pinBtn.className = 'pin-btn';
      pinBtn.textContent = msg.pinned ? 'Lösen' : 'Anpinnen';
      pinBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newPinStatus = !msg.pinned;
        const res = await fetch('/api/orga/chats/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: msg.id, pin: newPinStatus })
        });
        if (res.ok) {
          msg.pinned = newPinStatus;
          pinBtn.textContent = msg.pinned ? 'Lösen' : 'Anpinnen';
        } else {
          alert('Fehler beim Ändern des Pin-Status');
        }
      });
      msgDiv.appendChild(pinBtn);
      return msgDiv;
    }
  
    // Event-Listener für Scrollen: Laden älterer Nachrichten, wenn nach oben gescrollt wird
    chatMessages.addEventListener('scroll', () => {
      if (chatMessages.scrollTop < 50) {
        loadOlderMessages();
      } else if (isScrolledToBottom()) {
        loadNewMessages();
      }
    });
  
    // Periodisches Neuladen neuer Nachrichten (jede Sekunde), wenn unten gescrollt wird
    setInterval(loadNewMessages, 1000);
  
    // Pinned Nachrichten anzeigen
    pinnedBtn.addEventListener('click', async () => {
      const res = await fetch('/api/orga/chats/pinned');
      if (res.ok) {
        const pinned = await res.json();
        renderPinnedMessages(pinned);
        pinnedContainer.style.display = 'block';
      }
    });
  
    // Schließen der Pinned Nachrichten Ansicht
    closePinnedBtn.addEventListener('click', () => {
      pinnedContainer.style.display = 'none';
    });
  
    // Rendert angepinnte Nachrichten in einem separaten Container
    function renderPinnedMessages(messages) {
      pinnedMessages.innerHTML = '';
      messages.forEach(msg => {
        const msgDiv = createMessageDiv(msg);
        pinnedMessages.appendChild(msgDiv);
      });
    }
  });
  