document.addEventListener('DOMContentLoaded', () => {
  let currentChannel = null;       // z.B. "Berlin"
  let currentExtraChat = null;     // Dateiname des Extra-Chats
  let pollingInterval = null;
  let isAdmin = false;
  let isOrga = false;
  let userBundesland = null;
  const messageLimit = 30;
  let lastMessageTimestamp = null;
  let autoScrollEnabled = true; // Wird true gesetzt, wenn der Nutzer am unteren Rand ist

  // DOM-Elemente
  const loginSection = document.getElementById('loginSection');
  const chatInterface = document.getElementById('chatInterface');
  const loginForm = document.getElementById('loginForm');
  const toRegisterButton = document.getElementById('toRegisterButton');
  const logoutBtn = document.getElementById('logoutBtn');
  const channelList = document.getElementById('channelList');
  const chatHeader = document.getElementById('chatHeader');
  const chatContainer = document.getElementById('chatContainer');
  const messageForm = document.getElementById('messageForm');
  const messageInput = document.getElementById('messageInput');
  const imageForm = document.getElementById('imageForm');
  const imageInput = document.getElementById('imageInput');

  // Liste aller 16 Bundesländer, die als Hauptkanäle angezeigt werden sollen
  const allBundeslaender = [
    "Baden-Württemberg",
    "Bayern",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hessen",
    "Mecklenburg-Vorpommern",
    "Niedersachsen",
    "Nordrhein-Westfalen",
    "Rheinland-Pfalz",
    "Saarland",
    "Sachsen",
    "Sachsen-Anhalt",
    "Schleswig-Holstein",
    "Thüringen"
  ];

  // --------------------------
  // Initialisierung
  // --------------------------
  async function initializeChat() {
    try {
      // Hole User-Infos (z.B. ob Admin oder Orga)
      const userinfoRes = await fetch('/api/userinfo');
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        isAdmin = Boolean(userinfo.isAdmin);
        isOrga = (userinfo.rank === 'Organisator');
        if (isOrga) {
          userBundesland = userinfo.bundesland;
        }
        // Nur für Admins Bild-Upload sichtbar machen
        if (isAdmin && imageForm) {
          imageForm.classList.remove('hidden');
        }
      }

      // Hole Channels von der API
      const res = await fetch('/api/channels');
      if (res.ok) {
        let channels = await res.json();

        // 1) Nur die 16 Bundesländer sollen in der Liste bleiben ...
        channels = channels.filter(channel => allBundeslaender.includes(channel));

        // 2) ... und wenn isAdmin == true, fügen wir den Admin-Channel hinzu
        if (isAdmin) {
          const adminChannelName = 'admin_chat';
          if (!channels.includes(adminChannelName)) {
            channels.push(adminChannelName);
          }
        }

        chatInterface.classList.remove('hidden');
        loginSection.classList.add('hidden');
        renderMainChannels(channels);
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

  // --------------------------
  // Rendering der Hauptchats (Kanalliste)
  // --------------------------
  function renderMainChannels(channels) {
    channelList.innerHTML = '';
    chatHeader.classList.add('hidden'); // Chat-Header erst verstecken

    channels.forEach(channel => {
      const btn = document.createElement('button');
      btn.classList.add('main-channel-btn');
      btn.textContent = channel;
      btn.addEventListener('click', () => {
        currentChannel = channel;
        currentExtraChat = null;
        lastMessageTimestamp = null;
        updateMainChannelActive(channel);
        loadChat(channel);

        // Lade Extra-Chats für diesen Hauptchat (z.B. bei "Berlin" aus extrachats.json)
        if (allBundeslaender.includes(channel)) {
          loadExtraChats(channel).then(extraChats => {
            renderChatHeader(channel, extraChats);
          });
        } else {
          chatHeader.innerHTML = '';
          chatHeader.classList.add('hidden');
        }
      });
      channelList.appendChild(btn);
    });
  }

  function updateMainChannelActive(activeChannel) {
    const mainBtns = channelList.querySelectorAll('.main-channel-btn');
    mainBtns.forEach(btn => {
      btn.classList.toggle('active', btn.textContent === activeChannel);
    });
  }

  // --------------------------
  // Chat-Header: Normaler Chat und Extra-Chats
  // --------------------------
  function renderChatHeader(bundesland, extraChats) {
    chatHeader.innerHTML = '';
    chatHeader.classList.remove('hidden');

    // Normaler Chat-Button
    const normalBtn = document.createElement('button');
    normalBtn.classList.add('normal-chat-btn');
    normalBtn.textContent = `${bundesland} Normal`;
    normalBtn.addEventListener('click', () => {
      currentExtraChat = null;
      lastMessageTimestamp = null;
      loadChat(bundesland);
      updateChatHeaderActive();
    });
    chatHeader.appendChild(normalBtn);

    // Falls Extra-Chats existieren, werden diese angezeigt
    if (extraChats && extraChats.length > 0) {
      extraChats.forEach(chat => {
        const extraBtn = createExtraChatButton(chat, bundesland);
        chatHeader.appendChild(extraBtn);
      });
    }

    // Plus-Button zum Hinzufügen (nur für Orga)
    if (isOrga) {
      const plusBtn = document.createElement('button');
      plusBtn.classList.add('add-extra-btn');
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const name = prompt('Name für den neuen Extra-Chat:');
        if (!name) return;
        try {
          const res = await fetch(`/api/extra-chats/${encodeURIComponent(bundesland)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
          });
          const result = await res.json();
          if (res.ok) {
            loadExtraChats(bundesland).then(chats => {
              renderChatHeader(bundesland, chats);
            });
          } else {
            alert(result.message);
          }
        } catch (error) {
          console.error(error);
        }
      });
      chatHeader.appendChild(plusBtn);
    }

    updateChatHeaderActive();
  }

  function updateChatHeaderActive() {
    const normalBtn = chatHeader.querySelector('.normal-chat-btn');
    if (!currentExtraChat) {
      normalBtn.classList.add('active');
    } else {
      normalBtn.classList.remove('active');
    }
    const extraBtns = chatHeader.querySelectorAll('.extra-chat-btn');
    extraBtns.forEach(btn => {
      if (btn.getAttribute('data-chat-file') === currentExtraChat) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function createExtraChatButton(chat, bundesland) {
    const extraBtn = document.createElement('button');
    extraBtn.classList.add('extra-chat-btn');
    extraBtn.textContent = chat.name;
    extraBtn.setAttribute('data-chat-file', chat.file);

    extraBtn.addEventListener('click', () => {
      currentExtraChat = chat.file;
      lastMessageTimestamp = null;
      loadExtraChat(chat.file);
      updateChatHeaderActive();
    });

    if (isOrga) {
      const delBtn = document.createElement('button');
      delBtn.classList.add('delete-extra-btn');
      delBtn.textContent = 'X';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const confirmation = prompt('Zum Löschen bitte "JA" eingeben:');
        if (confirmation === 'JA') {
          deleteExtraChat(chat.file, bundesland);
        }
      });
      extraBtn.appendChild(delBtn);
    }
    return extraBtn;
  }

  // --------------------------
  // Laden von Extra-Chats per API
  // --------------------------
  async function loadExtraChats(bundesland) {
    try {
      const res = await fetch(`/api/extra-chats/${encodeURIComponent(bundesland)}`);
      if (res.ok) {
        return await res.json();
      }
      return [];
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  // --------------------------
  // Laden von Nachrichten (Haupt- vs. Extra-Chat)
  // --------------------------
  async function loadChat(channel) {
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(channel)}?limit=${messageLimit}`);
      if (res.ok) {
        const messages = await res.json();
        renderMessages(messages, true);
        if (autoScrollEnabled) scrollToBottom();
      } else {
        chatContainer.innerHTML = `<p>Fehler: ${await res.text()}</p>`;
      }
    } catch (error) {
      console.error(error);
      chatContainer.innerHTML = `<p>Fehler beim Laden des Chats</p>`;
    }
  }

  async function loadExtraChat(chatFile) {
    try {
      const res = await fetch(`/api/extra-chats/messages/${encodeURIComponent(chatFile)}?limit=${messageLimit}`);
      if (res.ok) {
        const messages = await res.json();
        renderMessages(messages, true);
        if (autoScrollEnabled) scrollToBottom();
      } else {
        chatContainer.innerHTML = `<p>Fehler: ${await res.text()}</p>`;
      }
    } catch (error) {
      console.error(error);
      chatContainer.innerHTML = `<p>Fehler beim Laden des Extra-Chats</p>`;
    }
  }

  // --------------------------
  // Automatisch an den unteren Rand scrollen
  // --------------------------
  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // --------------------------
  // Nachrichten rendern
  // --------------------------
  function renderMessages(messages, replace = false) {
    if (replace) {
      chatContainer.innerHTML = '';
    }
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.classList.add('message');

      if (msg.rank === 'Admin') {
        div.classList.add('admin');
      }

      const meta = document.createElement('span');
      meta.classList.add('meta');

      if (msg.rank) {
        meta.textContent = `${msg.rank}: ${msg.user} | ${new Date(msg.timestamp).toLocaleString()}`;
      } else if (msg.isAdmin) {
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
        div.appendChild(img);
      }

      const currentUsername = getCookie('username');

      if (msg.user === currentUsername || isAdmin) {
        const delBtn = document.createElement('button');
        delBtn.classList.add('deleteBtn');
        delBtn.textContent = 'Löschen';
        delBtn.addEventListener('click', () => {
          if (currentExtraChat) {
            deleteExtraChatMessage(currentExtraChat, msg.id);
          } else if (currentChannel) {
            deleteMessage(currentChannel, msg.id);
          }
        });
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
  }

  // --------------------------
  // Nachrichten löschen
  // --------------------------
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

  async function deleteExtraChatMessage(chatFile, messageId) {
    try {
      const res = await fetch(`/api/extra-chats/messages/${encodeURIComponent(chatFile)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.message || 'Fehler beim Löschen der Nachricht');
      } else {
        loadExtraChat(chatFile);
      }
    } catch (error) {
      console.error(error);
    }
  }

  // --------------------------
  // Extra-Chat komplett löschen (API-Endpunkt)
  // --------------------------
  async function deleteExtraChat(chatFile, bundesland) {
    try {
      const res = await fetch(`/api/extra-chats/${encodeURIComponent(chatFile)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (!res.ok) {
        alert(result.message || 'Fehler beim Löschen des Extra-Chats');
      } else {
        if (currentExtraChat === chatFile) {
          currentExtraChat = null;
          loadChat(bundesland);
        }
        loadExtraChats(bundesland).then(chats => {
          renderChatHeader(bundesland, chats);
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  // --------------------------
  // Polling: Nachrichten werden alle 2 Sekunden neu geladen,
  // aber nur, wenn der Nutzer (nahe) ganz unten ist
  // --------------------------
  function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
      if (autoScrollEnabled) {
        if (currentExtraChat) {
          loadExtraChat(currentExtraChat);
        } else if (currentChannel) {
          loadChat(currentChannel);
        }
      }
    }, 2000);
  }

  // --------------------------
  // Scroll-Listener: Prüfe, ob der Nutzer am unteren Rand ist
  // --------------------------
  chatContainer.addEventListener('scroll', () => {
    // Schwellenwert, um zu bestimmen, ob wir "am Ende" sind
    const threshold = 50;
    const position = chatContainer.scrollTop + chatContainer.clientHeight;
    const height = chatContainer.scrollHeight;
    if (position >= height - threshold) {
      autoScrollEnabled = true;
    } else {
      autoScrollEnabled = false;
    }
  });

  // --------------------------
  // Ban-Funktion
  // --------------------------
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

  // --------------------------
  // Bild hochladen (nur Admins)
  // --------------------------
  if (imageForm) {
    imageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentChannel && !currentExtraChat) {
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
        // Unterscheide, ob es sich um einen Extra-Chat handelt oder nicht:
        const endpoint = currentExtraChat 
          ? `/api/extra-chats/messages/image/${encodeURIComponent(currentExtraChat)}`
          : `/api/chats/${encodeURIComponent(currentChannel)}/image`;
        const res = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        if (res.ok) {
          imageInput.value = '';
          if (currentExtraChat) {
            loadExtraChat(currentExtraChat);
          } else {
            loadChat(currentChannel);
          }
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // --------------------------
  // Nachricht absenden
  // --------------------------
  if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentChannel && !currentExtraChat) {
        alert('Bitte wählen Sie einen Chat-Kanal aus.');
        return;
      }
      const message = messageInput.value;
      if (!message) return;
      try {
        let endpoint = '';
        if (currentExtraChat) {
          endpoint = `/api/extra-chats/messages/${encodeURIComponent(currentExtraChat)}`;
        } else {
          endpoint = `/api/chats/${encodeURIComponent(currentChannel)}`;
        }
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const result = await res.json();
        if (res.ok) {
          messageInput.value = '';
          if (currentExtraChat) {
            loadExtraChat(currentExtraChat);
          } else {
            loadChat(currentChannel);
          }
        } else {
          alert(result.message);
          if (result.message.includes('gesperrt')) {
            messageInput.disabled = true;
            const submitBtn = messageForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
          }
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  // --------------------------
  // Login / Logout
  // --------------------------
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
          isOrga = result.isOrga;
          if (isOrga) userBundesland = result.bundesland;
          initializeChat();
        } else {
          alert(result.message);
        }
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/logout', { method: 'POST' });
        const result = await res.json();
        alert(result.message);
        document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = 'password=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = 'orgaUsername=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = 'orgaPassword=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        window.location.href = 'main.html';
      } catch (error) {
        console.error(error);
      }
    });
  }

  if (toRegisterButton) {
    toRegisterButton.addEventListener('click', () => {
      window.location.href = 'register.html';
    });
  }

  // --------------------------
  // Hilfsfunktion: Cookie auslesen
  // --------------------------
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
  }

  // --------------------------
  // Start-Polling
  // --------------------------
  initializeChat();
  startPolling();
});
