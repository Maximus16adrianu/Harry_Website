document.addEventListener('DOMContentLoaded', () => {
  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminPanel = document.getElementById('adminPanel');
  const requestListDiv = document.getElementById('requestList');
  const toggleRequestsBtn = document.getElementById('toggleRequests');
  const userListDiv = document.getElementById('userList');
  const toggleUsersBtn = document.getElementById('toggleUsers');
  const orgaListDiv = document.getElementById('orgaList');

  const filterUsernameInput = document.getElementById('filterUsername');
  const filterBannedSelect = document.getElementById('filterBanned');
  const filterAdminSelect = document.getElementById('filterAdmin');
  const applyFiltersBtn = document.getElementById('applyFilters');
  
  let currentApiKey = null;
  let fullRequestList = [];
  let requestListExpanded = false;
  let fullUserList = [];
  let userListExpanded = false;
  let fullOrgaList = [];

  // Neuen Button "Sperre Chats" initialisieren (HTML muss ein Element mit id="lockChatsBtn" enthalten)
  const lockChatsBtn = document.getElementById('lockChatsBtn');
  let chatsLockedState = false; // Lokaler Zustand – Standardmäßig entsperrt

  if (lockChatsBtn) {
    lockChatsBtn.addEventListener('click', async () => {
      const newState = !chatsLockedState; // Umschalten
      try {
        const res = await fetch('/api/admin/chats-lock?apiKey=' + encodeURIComponent(currentApiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lock: newState })
        });
        const result = await res.json();
        if (res.ok) {
          chatsLockedState = newState;
          // Button-Beschriftung je nach Status ändern
          lockChatsBtn.textContent = chatsLockedState ? 'Chats entsperren' : 'Sperre Chats';
          alert(result.message);
        } else {
          alert(result.message);
        }
      } catch (err) {
        console.error(err);
        alert('Fehler beim Ändern des Chat-Status');
      }
    });
  }
  
  // API-Key Login
  const loginForm = document.getElementById('adminLoginForm');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const enteredKey = formData.get('apiKey');
  
    try {
      const testUrl = '/api/admin/requests?apiKey=' + encodeURIComponent(enteredKey);
      const testRes = await fetch(testUrl);
      if (!testRes.ok) {
        alert('Ungültiger API Key');
        return;
      }
      currentApiKey = enteredKey;
      adminLoginSection.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadRequests();
      loadUsers();
      loadOrgas();
    } catch (err) {
      console.error(err);
      alert('Fehler beim Prüfen des API Keys');
    }
  });
  
  // Requests laden
  async function loadRequests() {
    try {
      const res = await fetch('/api/admin/requests?apiKey=' + encodeURIComponent(currentApiKey));
      if (res.ok) {
        fullRequestList = await res.json();
        requestListExpanded = false;
        renderRequestList();
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  // Nutzer laden
  async function loadUsers() {
    try {
      const res = await fetch('/api/admin/users?apiKey=' + encodeURIComponent(currentApiKey));
      if (res.ok) {
        fullUserList = await res.json();
        userListExpanded = false;
        renderUserList();
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  // Orga-Konten laden
  async function loadOrgas() {
    try {
      const res = await fetch('/api/admin/orgas?apiKey=' + encodeURIComponent(currentApiKey));
      if (res.ok) {
        fullOrgaList = await res.json();
        renderOrgaList();
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  // Rendern der Request-Liste (mit Expand/Collapse)
  function renderRequestList() {
    // Zähler aktualisieren
    document.getElementById('requestCount').textContent = fullRequestList.length;
    requestListDiv.innerHTML = '';
    const listToRender = requestListExpanded ? fullRequestList : fullRequestList.slice(0, 10);
    listToRender.forEach(req => {
      const div = document.createElement('div');
      div.className = 'request-item';
      div.innerHTML = `
          <strong>${req.username}</strong> (${new Date(req.requestedAt).toLocaleString()}) - ${req.password}
          <button onclick="approveRequest('${req.username}')">Annehmen</button>
          <button class="danger" onclick="rejectRequest('${req.username}')">Ablehnen</button>
      `;
      requestListDiv.appendChild(div);
    });
    if (fullRequestList.length > 10) {
      toggleRequestsBtn.classList.remove('hidden');
      toggleRequestsBtn.textContent = requestListExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen';
    } else {
      toggleRequestsBtn.classList.add('hidden');
    }
  }
  
  toggleRequestsBtn.addEventListener('click', () => {
    requestListExpanded = !requestListExpanded;
    renderRequestList();
  });
  
  // Filterfunktion für Nutzerliste
  function filterUserList(users) {
    const usernameFilter = filterUsernameInput.value.toLowerCase();
    const bannedFilter = filterBannedSelect.value;
    const adminFilter = filterAdminSelect.value;
  
    return users.filter(user => {
      let match = true;
      if (usernameFilter && !user.username.toLowerCase().includes(usernameFilter)) {
        match = false;
      }
      if (bannedFilter === 'banned' && !user.locked) {
        match = false;
      }
      if (bannedFilter === 'active' && user.locked) {
        match = false;
      }
      if (adminFilter === 'admin' && !user.isAdmin) {
        match = false;
      }
      if (adminFilter === 'user' && user.isAdmin) {
        match = false;
      }
      return match;
    });
  }
  
  // Rendern der Nutzerliste (mit Expand/Collapse und Filter)
  function renderUserList() {
    // Zähler aktualisieren
    document.getElementById('userCount').textContent = fullUserList.length;
    userListDiv.innerHTML = '';
    const filtered = filterUserList(fullUserList);
    const listToRender = userListExpanded ? filtered : filtered.slice(0, 10);
    listToRender.forEach(user => {
      const div = document.createElement('div');
      div.className = 'user-item';
      if (user.isAdmin) {
        div.innerHTML = `
            <strong>${user.username}</strong> (Admin)
            <button class="secondary" onclick="demoteUser('${user.username}')">Herabstufen</button>
        `;
      } else {
        if (user.locked) {
          div.innerHTML = `
              <strong>${user.username}</strong>
              <button onclick="promoteUser('${user.username}')">Befördern</button>
              <button onclick="unbanUser('${user.username}')">Entsperren</button>
          `;
        } else {
          div.innerHTML = `
              <strong>${user.username}</strong>
              <button onclick="promoteUser('${user.username}')">Befördern</button>
              <button class="danger" onclick="banUser('${user.username}')">Sperren</button>
          `;
        }
      }
      userListDiv.appendChild(div);
    });
    if (filterUserList(fullUserList).length > 10) {
      toggleUsersBtn.classList.remove('hidden');
      toggleUsersBtn.textContent = userListExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen';
    } else {
      toggleUsersBtn.classList.add('hidden');
    }
  }
  
  applyFiltersBtn.addEventListener('click', () => {
    userListExpanded = false;
    renderUserList();
  });
  
  toggleUsersBtn.addEventListener('click', () => {
    userListExpanded = !userListExpanded;
    renderUserList();
  });
  
  // Rendern der Orga-Liste im Popup
  function renderOrgaList() {
    orgaListDiv.innerHTML = '';
    fullOrgaList.forEach(orga => {
      const div = document.createElement('div');
      div.className = 'orga-item';
      div.innerHTML = `
        <strong>${orga.username}</strong> (${orga.bundesland})
        <div class="orga-actions">
          <button onclick="editOrga('${orga.username}')">Bearbeiten</button>
          <button class="danger" onclick="deleteOrga('${orga.username}')">Löschen</button>
        </div>
      `;
      orgaListDiv.appendChild(div);
    });
  }
  
  // Event Listener für das Öffnen des Orga-Popups
  const openOrgaPopupBtn = document.getElementById('openOrgaPopupBtn');
  const orgaPopupModal = document.getElementById('orgaPopupModal');
  const closeOrgaPopup = document.getElementById('closeOrgaPopup');
  openOrgaPopupBtn.addEventListener('click', () => {
    orgaPopupModal.style.display = 'flex';
    loadOrgas();
  });
  // Schließen des Orga-Popups (durch Klick auf Schließen-Button)
  closeOrgaPopup.addEventListener('click', () => {
    orgaPopupModal.style.display = 'none';
  });
  
  // Event Listener für das Erstellen eines neuen Orga-Kontos
  const orgaCreateForm = document.getElementById('orgaCreateForm');
  orgaCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('orgaUsernameInput').value;
    const password = document.getElementById('orgaPasswordInput').value;
    const bundesland = document.getElementById('orgaBundeslandSelect').value;
    try {
      const res = await fetch('/api/admin/orgas/create?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, bundesland })
      });
      const result = await res.json();
      alert(result.message);
      orgaCreateForm.reset();
      loadOrgas();
    } catch (err) {
      console.error(err);
    }
  });
  
  // Globale Funktionen für Admin-Operationen (über window)
  window.approveRequest = async (username) => {
    try {
      const res = await fetch('/api/admin/approve?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      alert(result.message);
      loadRequests();
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };
  
  window.rejectRequest = async (username) => {
    try {
      const res = await fetch('/api/admin/reject?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      alert(result.message);
      loadRequests();
    } catch (err) {
      console.error(err);
    }
  };
  
  window.promoteUser = async (username) => {
    try {
      const res = await fetch('/api/admin/promote?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      alert(result.message);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };
  
  window.demoteUser = async (username) => {
    try {
      const res = await fetch('/api/admin/demote?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      alert(result.message);
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };
  
  window.banUser = async (username) => {
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
  };
  
  window.unbanUser = async (username) => {
    try {
      const res = await fetch('/api/admin/unban?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const result = await res.json();
      alert(result.message);
    } catch (error) {
      console.error(error);
    }
  };

  // Globale Funktionen für Orga-Konten Bearbeitung
  window.editOrga = async (username) => {
    // Öffne das Bearbeitungs-Popup und fülle die Felder
    document.getElementById('orgaEditUsername').value = username;
    // Setze evtl. vorhandene Werte (hier aus fullOrgaList)
    const orga = fullOrgaList.find(o => o.username === username);
    if (orga) {
      document.getElementById('orgaEditPassword').value = orga.password;
      document.getElementById('orgaEditBundesland').value = orga.bundesland;
    }
    document.getElementById('orgaEditModal').style.display = 'flex';
  };

  window.deleteOrga = async (username) => {
    if (!confirm(`Soll das Orga-Konto ${username} wirklich gelöscht werden?`)) return;
    try {
      const res = await fetch('/api/admin/orgas/' + encodeURIComponent(username) + '?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'DELETE'
      });
      const result = await res.json();
      alert(result.message);
      loadOrgas();
    } catch (err) {
      console.error(err);
    }
  };

  // Event Listener für das Orga-Bearbeitungs-Popup
  const orgaEditModal = document.getElementById('orgaEditModal');
  const closeOrgaEditModal = document.getElementById('closeOrgaEditModal');
  const orgaEditForm = document.getElementById('orgaEditForm');
  closeOrgaEditModal.addEventListener('click', () => {
    orgaEditModal.style.display = 'none';
  });
  orgaEditForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('orgaEditUsername').value;
    const password = document.getElementById('orgaEditPassword').value;
    const bundesland = document.getElementById('orgaEditBundesland').value;
    try {
      const res = await fetch('/api/admin/orgas/' + encodeURIComponent(username) + '?apiKey=' + encodeURIComponent(currentApiKey), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, bundesland })
      });
      const result = await res.json();
      alert(result.message);
      orgaEditModal.style.display = 'none';
      loadOrgas();
    } catch (err) {
      console.error(err);
    }
  });

  // Modal-Logik für den Medien-Update-Bereich
  const openMediaModalBtn = document.getElementById('openMediaModal');
  const mediaModal = document.getElementById('mediaUpdateModal');
  const closeMediaModalBtn = document.getElementById('closeMediaModal');

  openMediaModalBtn.addEventListener('click', () => {
    mediaModal.style.display = 'flex';
    updateMediaPreview();
  });

  closeMediaModalBtn.addEventListener('click', () => {
    mediaModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === mediaModal) {
      mediaModal.style.display = 'none';
    }
    if (e.target === document.getElementById('orgaPopupModal')) {
      document.getElementById('orgaPopupModal').style.display = 'none';
    }
  });

  function updateMediaPreview() {
    document.getElementById('currentVideo').src = '/video1.mp4?' + new Date().getTime();
    document.getElementById('currentImage1').src = '/bild1.png?' + new Date().getTime();
    document.getElementById('currentImage2').src = '/bild2.png?' + new Date().getTime();
  }

  const mediaUpdateForm = document.getElementById('mediaUpdateForm');
  if (mediaUpdateForm) {
    mediaUpdateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(mediaUpdateForm);
      try {
        const res = await fetch('/api/admin/update-media?apiKey=' + encodeURIComponent(currentApiKey), {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        alert(result.message);
        updateMediaPreview();
      } catch (err) {
        console.error(err);
        alert('Fehler beim Aktualisieren der Medien');
      }
    });
  }
});
