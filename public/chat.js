document.addEventListener('DOMContentLoaded', () => {
  let currentChannel = null;
  let pollingInterval = null;
  let isAdmin = false;
  const messageLimit = 30; // Limit für die Pagination
  let lastMessageTimestamp = null; // Zeitstempel der letzten Nachricht

  // DOM-Elemente
  const loginSection = document.getElementById('loginSection');
  const chatInterface = document.getElementById('chatInterface');
  const loginForm = document.getElementById('loginForm');
  const toRegisterButton = document.getElementById('toRegisterButton');
  const logoutBtn = document.getElementById('logoutBtn');
  const channelList = document.getElementById('channelList');
  const chatContainer = document.getElementById('chatContainer');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const imageForm = document.getElementById('imageForm'); // Bild-Upload-Formular (HTML hat initial "hidden")
  const imageInput = document.getElementById('imageInput');

  // Initialisiert den Chat und prüft, ob der User eingeloggt ist
  async function initializeChat() {
    try {
      // Userinfo abrufen
      const userinfoRes = await fetch('/api/userinfo');
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        isAdmin = Boolean(userinfo.isAdmin);
        // Falls Admin, entferne die "hidden"-Klasse vom Bild-Upload-Formular
        if (isAdmin && imageForm) {
          imageForm.classList.remove('hidden');
        }
      }
      // Kanäle laden
      const res = await fetch('/api/channels');
      if (res.ok) {
        const channels = await res.json();
        chatInterface.classList.remove('hidden');
        loginSection.classList.add('hidden');
        renderChannels(channels);
      } else {
        loginSection.classList.remove('hidden');
        chatInterface.classList.add('hidden');
      }
    } catch (error) {
      console.error(error);
      loginSection.classList.remove('hidden');
      chatInterface.classList.add('hidden');
    }
  }

  // Zeigt die Kanäle als Buttons an
  function renderChannels(channels) {
    channelList.innerHTML = '';
    channels.forEach(channel => {
      const btn = document.createElement('button');
      btn.textContent = channel;
      if (channel === currentChannel) {
        btn.classList.add('active');
      }
      btn.addEventListener('click', () => {
        currentChannel = channel;
        lastMessageTimestamp = null; // Reset beim Kanalwechsel
        renderChannels(channels);
        loadChat(channel);
      });
      channelList.appendChild(btn);
    });
  }

  // Lädt den Chat-Inhalt eines bestimmten Kanals (nur die neuesten 30 Nachrichten)
  async function loadChat(channel) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(channel)}?limit=${messageLimit}`);
      if (res.ok) {
        const messages = await res.json();
        // Falls bereits Nachrichten vorhanden sind, prüfen ob es neue gibt
        if (messages.length > 0) {
          const newestTimestamp = messages[messages.length - 1].timestamp;
          if (lastMessageTimestamp === newestTimestamp) {
            return; // Es gibt keine neuen Nachrichten, also abbrechen
          }
          lastMessageTimestamp = newestTimestamp;
        }
        renderMessages(messages, true);
      } else {
        chatContainer.innerHTML = `<p>Fehler: ${await res.text()}</p>`;
      }
    } catch (error) {
      console.error(error);
      chatContainer.innerHTML = `<p>Fehler beim Laden des Chats</p>`;
    }
  }

  // Rendert die Nachrichten im Chat
  function renderMessages(messages, replace = false) {
    if (replace) {
      const threshold = 50; // Pixel, um zu bestimmen, ob der Nutzer nahe dem unteren Rand ist
      const previousScrollTop = chatContainer.scrollTop;
      const previousScrollHeight = chatContainer.scrollHeight;
      const isAtBottom = previousScrollTop + chatContainer.clientHeight >= previousScrollHeight - threshold;

      chatContainer.innerHTML = '';
      messages.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add('message');
        div.setAttribute('data-timestamp', msg.timestamp);

        const meta = document.createElement('span');
        meta.classList.add('meta');
        if (msg.isAdmin) {
          meta.textContent = `Admin: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('admin');
        } else {
          meta.textContent = `User: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
        }
        div.appendChild(meta);

        if (msg.message) {
          const text = document.createElement('span');
          text.textContent = `: ${msg.message}`;
          div.appendChild(text);
        }

        if (msg.image) {
          const img = document.createElement('img');
          img.src = '/pictures/' + msg.image;
          img.alt = 'Hochgeladenes Bild';
          img.style.maxWidth = '500px';
          img.style.display = 'block';
          img.style.marginTop = '5px';
          div.appendChild(img);
        }

        const currentUsername = getCookie('username');
        if (msg.user === currentUsername || isAdmin) {
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }

        if (isAdmin && msg.user !== currentUsername) {
          const banBtn = document.createElement('button');
          banBtn.classList.add('banBtn');
          banBtn.textContent = 'Benutzer bannen';
          banBtn.addEventListener('click', () => banUser(msg.user));
          div.appendChild(banBtn);
        }

        chatContainer.appendChild(div);
      });

      const newScrollHeight = chatContainer.scrollHeight;
      if (isAtBottom) {
        chatContainer.scrollTop = newScrollHeight;
      } else {
        chatContainer.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight);
      }
    } else {
      messages.forEach(msg => {
        const div = document.createElement('div');
        div.classList.add('message');
        div.setAttribute('data-timestamp', msg.timestamp);

        const meta = document.createElement('span');
        meta.classList.add('meta');
        if (msg.isAdmin) {
          meta.textContent = `Admin: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('admin');
        } else {
          meta.textContent = `User: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
        }
        div.appendChild(meta);

        if (msg.message) {
          const text = document.createElement('span');
          text.textContent = `: ${msg.message}`;
          div.appendChild(text);
        }

        if (msg.image) {
          const img = document.createElement('img');
          img.src = '/pictures/' + msg.image;
          img.alt = 'Hochgeladenes Bild';
          img.style.maxWidth = '500px';
          img.style.display = 'block';
          img.style.marginTop = '5px';
          div.appendChild(img);
        }

        const currentUsername = getCookie('username');
        if (msg.user === currentUsername || isAdmin) {
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }

        if (isAdmin && msg.user !== currentUsername) {
          const banBtn = document.createElement('button');
          banBtn.classList.add('banBtn');
          banBtn.textContent = 'Benutzer bannen';
          banBtn.addEventListener('click', () => banUser(msg.user));
          div.appendChild(banBtn);
        }

        chatContainer.insertBefore(div, chatContainer.firstChild);
      });
    }
  }

  // Lädt ältere Nachrichten, wenn der User oben scrollt
  async function loadOlderMessages() {
    const firstMsgElement = chatContainer.firstElementChild;
    if (!firstMsgElement) return;
    const firstTimestamp = firstMsgElement.getAttribute('data-timestamp');

    try {
      const res = await fetch(
        `/api/chats/${encodeURIComponent(currentChannel)}?limit=${messageLimit}&olderThan=${firstTimestamp}`
      );
      if (res.ok) {
        const olderMessages = await res.json();
        if (olderMessages.length > 0) {
          const previousScrollHeight = chatContainer.scrollHeight;
          renderMessages(olderMessages, false);
          chatContainer.scrollTop = chatContainer.scrollHeight - previousScrollHeight;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Scroll-Event: Lädt ältere Nachrichten, wenn der Nutzer den oberen Rand erreicht
  chatContainer.addEventListener('scroll', () => {
    if (chatContainer.scrollTop === 0) {
      loadOlderMessages();
    }
  });

  // Startet das Polling für den aktuellen Chat
  function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    if (currentChannel) {
      pollingInterval = setInterval(() => {
        const threshold = 50;
        if (chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - threshold) {
          loadChat(currentChannel);
        }
      }, 1000);
    }
  }

  // Löscht eine Nachricht via API
  async function deleteMessage(channel, messageId) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(channel)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.message || 'Fehler beim Löschen der Nachricht');
      } else {
        loadChat(channel);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Bann-Funktion für Admins
  async function banUser(username) {
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.message || 'Fehler beim Sperren des Nutzers');
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Bild-Upload: Nur Admins können Bilder hochladen
  if (imageForm) {
    imageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentChannel) {
        alert('Bitte wählen Sie einen Chat-Kanal aus.');
        return;
      }
      const file = imageInput.files[0];
      if (!file) {
        alert('Bitte wählen Sie ein Bild aus.');
        return;
      }
      const formData = new FormData();
      formData.append('image', file);
      try {
        const res = await fetch(`/api/chats/${encodeURIComponent(currentChannel)}/image`, {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        if (res.ok) {
          imageInput.value = '';
          loadChat(currentChannel);
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Event-Listener für das Nachrichtenformular
  if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentChannel) {
        alert('Bitte wählen Sie einen Chat-Kanal aus.');
        return;
      }
      const message = messageInput.value;
      if (!message) return;
      try {
        const res = await fetch(`/api/chats/${encodeURIComponent(currentChannel)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const result = await res.json();
        if (res.ok) {
          messageInput.value = '';
          loadChat(currentChannel);
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Hilfsfunktion zum Auslesen von Cookies
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  // Login-Formular absenden
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const data = Object.fromEntries(formData.entries());
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
          isAdmin = Boolean(result.isAdmin);
          initializeChat();
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Logout-Button
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', { method: 'POST' });
        const result = await res.json();
        alert(result.message);
        document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = 'password=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        window.location.href = 'main.html';
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Wechsel zur Registrierungsseite
  if (toRegisterButton) {
    toRegisterButton.addEventListener('click', () => {
      window.location.href = 'register.html';
    });
  }

  // Chat initialisieren und Polling starten
  initializeChat();
  startPolling();

  // Beim Kanalwechsel das Polling neu starten
  const originalLoadChat = loadChat;
  loadChat = async (channel) => {
    await originalLoadChat(channel);
    startPolling();
  };
});
