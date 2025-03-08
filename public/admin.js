document.addEventListener('DOMContentLoaded', () => {
  const adminLoginSection = document.getElementById('adminLoginSection');
  const adminPanel = document.getElementById('adminPanel');
  const requestListDiv = document.getElementById('requestList');
  const toggleRequestsBtn = document.getElementById('toggleRequests');
  const acceptAllBtn = document.getElementById('acceptAllBtn'); // New button for bulk approval
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
  let fullNewsletterList = [];

  // Lock Chats Button
  const lockChatsBtn = document.getElementById('lockChatsBtn');
  let chatsLockedState = false; // Standard: entsperrt

  if (lockChatsBtn) {
    lockChatsBtn.addEventListener('click', async () => {
      const newState = !chatsLockedState;
      try {
        const res = await fetch('/api/admin/chats-lock?apiKey=' + encodeURIComponent(currentApiKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lock: newState })
        });
        const result = await res.json();
        if (res.ok) {
          chatsLockedState = newState;
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

  // Admin Login
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

  // Requests rendern
  function renderRequestList() {
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

  // New "Accept All" button event listener
  if (acceptAllBtn) {
    acceptAllBtn.addEventListener('click', async () => {
      if (!confirm('Soll wirklich alle Anfragen akzeptiert werden?')) return;
      try {
        // Loop through each request and send an approval request
        for (const req of fullRequestList) {
          const res = await fetch('/api/admin/approve?apiKey=' + encodeURIComponent(currentApiKey), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: req.username })
          });
          if (!res.ok) {
            const result = await res.json();
            console.error('Fehler bei der Akzeptierung von', req.username, result.message);
          }
        }
        alert('Alle Anfragen wurden akzeptiert.');
        loadRequests();
        loadUsers();
      } catch (err) {
        console.error(err);
        alert('Fehler beim Akzeptieren aller Anfragen.');
      }
    });
  }

  // Filterfunktion für Nutzer
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

  // Nutzer rendern
  function renderUserList() {
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

  // Orga-Liste rendern
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

  // Orga-Popup
  const openOrgaPopupBtn = document.getElementById('openOrgaPopupBtn');
  const orgaPopupModal = document.getElementById('orgaPopupModal');
  const closeOrgaPopup = document.getElementById('closeOrgaPopup');
  openOrgaPopupBtn.addEventListener('click', () => {
    orgaPopupModal.style.display = 'flex';
    loadOrgas();
  });
  closeOrgaPopup.addEventListener('click', () => {
    orgaPopupModal.style.display = 'none';
  });

  // Neues Orga-Konto erstellen
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

  // Globale Funktionen für Admin-Operationen
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
    document.getElementById('orgaEditUsername').value = username;
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
    if (e.target === document.getElementById('newsletterModal')) {
      document.getElementById('newsletterModal').style.display = 'none';
    }
  });

  // Vorschau aktualisieren
  function updateMediaPreview() {
    document.getElementById('currentVideo').src = '/api/media/video/video1.mp4?' + new Date().getTime();
    for (let i = 1; i <= 19; i++) {
      const imgElement = document.getElementById('currentImage' + i);
      if (imgElement) {
        imgElement.src = '/api/media/image/bild' + i + '.png?' + new Date().getTime();
      }
    }
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

  // -------------------------------
  // NEU: Newsletter-Abonnenten
  // -------------------------------
  const loadNewsletterEmailsBtn = document.getElementById('loadNewsletterEmailsBtn');
  const newsletterModal = document.getElementById('newsletterModal');
  const closeNewsletterModal = document.getElementById('closeNewsletterModal');
  const newsletterListDiv = document.getElementById('newsletterList');
  const newsletterListContainer = document.getElementById('newsletterListContainer');
  const exportNewsletterBtn = document.getElementById('exportNewsletterBtn');

  if (loadNewsletterEmailsBtn) {
    loadNewsletterEmailsBtn.addEventListener('click', () => {
      loadNewsletterEmails();
    });
  }

  async function loadNewsletterEmails() {
    try {
      const res = await fetch('/api/admin/newsletter-emails?apiKey=' + encodeURIComponent(currentApiKey));
      if (res.ok) {
        fullNewsletterList = await res.json();
        renderNewsletterList();
        newsletterModal.style.display = 'flex';
      } else {
        alert('Fehler beim Laden der Newsletter-Abonnenten');
      }
    } catch (err) {
      console.error(err);
      alert('Serverfehler beim Laden der Newsletter-Abonnenten');
    }
  }

  function renderNewsletterList() {
    newsletterListDiv.innerHTML = '';
    fullNewsletterList.forEach(email => {
      const div = document.createElement('div');
      div.className = 'newsletter-item';
      div.textContent = email;
      newsletterListDiv.appendChild(div);
    });
  }

  if (closeNewsletterModal) {
    closeNewsletterModal.addEventListener('click', () => {
      newsletterModal.style.display = 'none';
    });
  }

  if (exportNewsletterBtn) {
    exportNewsletterBtn.addEventListener('click', () => {
      const text = JSON.stringify(fullNewsletterList, null, 2);
      downloadFile('newsletter_emails.txt', text);
    });
  }

  // -------------------------------
  // NEU: "Alle exportieren" Button (JSON-Export)
  // -------------------------------
  function downloadFile(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const exportAllBtn = document.getElementById('exportAllBtn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      // Orga-Konten exportieren (als JSON)
      const orgaJson = JSON.stringify(fullOrgaList, null, 2);
      downloadFile('orga.txt', orgaJson);

      // Admins exportieren (alle Nutzer mit isAdmin true als JSON)
      const adminsJson = JSON.stringify(fullUserList.filter(u => u.isAdmin), null, 2);
      downloadFile('admins.txt', adminsJson);

      // Newsletter-Abonnenten exportieren (als JSON)
      const newsletterJson = JSON.stringify(fullNewsletterList, null, 2);
      downloadFile('email.txt', newsletterJson);

      // Alle Nutzer exportieren (alle Nutzer mit isAdmin false als JSON)
      const usersJson = JSON.stringify(fullUserList.filter(u => !u.isAdmin), null, 2);
      downloadFile('users.txt', usersJson);

      // Request-Zugriffe exportieren (als JSON)
      const requestAccessJson = JSON.stringify(fullRequestList, null, 2);
      downloadFile('requestacces.txt', requestAccessJson);
    });
  }
});
