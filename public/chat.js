document.addEventListener('DOMContentLoaded', () => {
  let currentChannel = null;
  let pollingInterval = null;
  let isAdmin = false;
  let isModerator = false;
  let currentUsername = ''; // Wird beim Login/Initialisieren gesetzt
  const messageLimit = 30; // Limit für die Pagination

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
  const imageForm = document.getElementById('imageForm'); // Bild-Upload (nur für Admins)
  const imageInput = document.getElementById('imageInput');
  const moderatorsPanel = document.getElementById('moderatorsPanel'); // Neuer Bereich für Moderatoren
  const moderatorsList = document.getElementById('moderatorsList');
  const appointModForm = document.getElementById('appointModForm'); // Formular zur Ernennung

  // Initialisiert den Chat und holt Userinfo
  async function initializeChat() {
    try {
      const userinfoRes = await fetch('/api/userinfo');
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        currentUsername = userinfo.username;
        isAdmin = userinfo.role === 'admin';
        isModerator = userinfo.role === 'moderator';
        // Falls Admin: Zeige Bild-Upload und Moderatoren-Panel
        if (isAdmin) {
          imageForm.classList.remove('hidden');
          moderatorsPanel.classList.remove('hidden');
          loadModerators();
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

  // Lädt Moderatoren, die der eingeloggte Admin ernannt hat
  async function loadModerators() {
    try {
      const res = await fetch('/api/admin/moderators');
      if (res.ok) {
        const mods = await res.json();
        renderModerators(mods);
      } else {
        moderatorsList.innerHTML = `<li>Fehler beim Laden der Moderatoren</li>`;
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Rendert die Liste der Moderatoren im Panel
  function renderModerators(mods) {
    moderatorsList.innerHTML = '';
    if (mods.length === 0) {
      moderatorsList.innerHTML = `<li>Keine Moderatoren ernannt</li>`;
      return;
    }
    mods.forEach(mod => {
      const li = document.createElement('li');
      li.textContent = mod.username;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Entfernen';
      removeBtn.addEventListener('click', () => removeModerator(mod.username));
      li.appendChild(removeBtn);
      moderatorsList.appendChild(li);
    });
  }

  // Entfernt einen Moderator (nur Admins)
  async function removeModerator(username) {
    if (!confirm(`Moderator ${username} wirklich entfernen?`)) return;
    try {
      const res = await fetch('/api/admin/removeModerator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (res.ok) {
        alert(result.message);
        loadModerators();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(error);
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
        renderChannels(channels);
        loadChat(channel);
      });
      channelList.appendChild(btn);
    });
  }

  // Lädt den Chat-Inhalt eines Kanals
  async function loadChat(channel) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(channel)}?limit=${messageLimit}`);
      if (res.ok) {
        const messages = await res.json();
        renderMessages(messages, true);
      } else {
        chatContainer.innerHTML = `<p>Fehler: ${await res.text()}</p>`;
      }
    } catch (error) {
      console.error(error);
      chatContainer.innerHTML = `<p>Fehler beim Laden des Chats</p>`;
    }
  }

  // Rendert Nachrichten im Chat
  function renderMessages(messages, replace = false) {
    if (replace) {
      const threshold = 50;
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
        if (msg.role === 'admin') {
          meta.textContent = `Admin: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('admin');
        } else if (msg.role === 'moderator') {
          meta.textContent = `Moderator: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('moderator');
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
        // Eigene Nachricht oder wenn Admin kann Löschen
        if (msg.user === currentUsername || isAdmin) {
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }
        // Moderator-Funktionen: Nur wenn eingeloggt als Moderator (aber nicht eigene Nachricht)
        if (isModerator && msg.user !== currentUsername && msg.role === 'user') {
          const muteBtn = document.createElement('button');
          muteBtn.classList.add('banBtn');
          // Je nach Muted-Status
          muteBtn.textContent = msg.muted ? 'Entstummt' : 'Stummschalten';
          muteBtn.addEventListener('click', () => toggleMute(msg.user, msg.muted));
          div.appendChild(muteBtn);
          // Moderatoren dürfen auch löschen (nur von normalen Usern)
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }
        // Admins können zusätzlich "Bannen" (hier nicht im UI für Moderatoren)
        if (isAdmin && msg.user !== currentUsername && msg.role === 'user') {
          const banBtn = document.createElement('button');
          banBtn.classList.add('banBtn');
          banBtn.textContent = 'Bannen';
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
        if (msg.role === 'admin') {
          meta.textContent = `Admin: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('admin');
        } else if (msg.role === 'moderator') {
          meta.textContent = `Moderator: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
          div.classList.add('moderator');
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
        if (msg.user === currentUsername || isAdmin) {
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }
        if (isModerator && msg.user !== currentUsername && msg.role === 'user') {
          const muteBtn = document.createElement('button');
          muteBtn.classList.add('banBtn');
          muteBtn.textContent = msg.muted ? 'Entstummt' : 'Stummschalten';
          muteBtn.addEventListener('click', () => toggleMute(msg.user, msg.muted));
          div.appendChild(muteBtn);
          const delBtn = document.createElement('button');
          delBtn.classList.add('deleteBtn');
          delBtn.textContent = 'Löschen';
          delBtn.addEventListener('click', () => deleteMessage(currentChannel, msg.id));
          div.appendChild(delBtn);
        }
        chatContainer.insertBefore(div, chatContainer.firstChild);
      });
    }
  }

  // Lädt ältere Nachrichten, wenn oben gescrollt wird
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

  chatContainer.addEventListener('scroll', () => {
    if (chatContainer.scrollTop === 0) {
      loadOlderMessages();
    }
  });

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

  // Bann-Funktion (nur Admins)
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

  // Mute/Unmute-Funktion (Admin und Moderator)
  async function toggleMute(username, currentlyMuted) {
    const endpoint = currentlyMuted ? '/api/moderate/unmute' : '/api/moderate/mute';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.message);
      } else {
        alert(result.message);
        loadChat(currentChannel);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // Bild-Upload (nur Admins)
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

  // Nachrichtenformular
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

  // Formular für Moderator-Ernennung (nur Admins)
  if (appointModForm) {
    appointModForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(appointModForm);
      const data = Object.fromEntries(formData.entries());
      try {
        const res = await fetch('/api/admin/appointModerator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
          alert(result.message);
          appointModForm.reset();
          loadModerators();
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // Login-Formular
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
          isAdmin = result.role === 'admin';
          isModerator = result.role === 'moderator';
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

  initializeChat();
  startPolling();

  const originalLoadChat = loadChat;
  loadChat = async (channel) => {
    await originalLoadChat(channel);
    startPolling();
  };
});
