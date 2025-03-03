document.addEventListener('DOMContentLoaded', () => {
    const adminLoginSection = document.getElementById('adminLoginSection');
    const adminPanel = document.getElementById('adminPanel');
    const requestListDiv = document.getElementById('requestList');
    const toggleRequestsBtn = document.getElementById('toggleRequests');
    const userListDiv = document.getElementById('userList');
    const toggleUsersBtn = document.getElementById('toggleUsers');
    
    const filterUsernameInput = document.getElementById('filterUsername');
    const filterBannedSelect = document.getElementById('filterBanned');
    const filterAdminSelect = document.getElementById('filterAdmin');
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    let currentApiKey = null;
    let fullRequestList = [];
    let requestListExpanded = false;
    let fullUserList = [];
    let userListExpanded = false;
    
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
    
    // Rendern der Request-Liste (mit Expand/Collapse)
    function renderRequestList() {
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
      const bannedFilter = filterBannedSelect.value; // "all", "banned", "active"
      const adminFilter = filterAdminSelect.value;   // "all", "admin", "user"
    
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
    
    // Globale Funktionen für Admin-Operationen (über window, damit onClick im HTML funktioniert)
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
        const res = await fetch('/api/admin/ban?apiKey=' + encodeURIComponent(currentApiKey), {
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
  
    // Schließen des Modals, wenn außerhalb des Modal-Inhalts geklickt wird
    window.addEventListener('click', (e) => {
      if (e.target === mediaModal) {
        mediaModal.style.display = 'none';
      }
    });
  
    // Funktion zum Aktualisieren der Vorschaubilder (mit Cache-Buster)
    function updateMediaPreview() {
      document.getElementById('currentVideo').src = '/video1.mp4?' + new Date().getTime();
      document.getElementById('currentImage1').src = '/bild1.png?' + new Date().getTime();
      document.getElementById('currentImage2').src = '/bild2.png?' + new Date().getTime();
    }
  
    // Medien-Update Formular im Modal
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
  