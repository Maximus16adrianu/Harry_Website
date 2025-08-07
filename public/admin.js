// Deutsche Demo Admin Panel - JavaScript Komplett Überarbeitet
class AdminPanel {
  constructor() {
    this.apiKey = null;
    this.data = {
      requests: [],
      users: [],
      orgas: [],
      newsletter: [],
      reports: []
    };
    this.ui = {
      requestsExpanded: false,
      usersExpanded: false,
      chatsLocked: true // Server default
    };
    this.init();
  }

  // ===== INITIALIZATION =====
  init() {
    this.setupEventListeners();
    this.fixViewport();
    this.initializeUI();
  }

  setupEventListeners() {
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
    
    // Chat Lock Button
    document.getElementById('chatLockBtn').addEventListener('click', () => this.toggleChatLock());
    
    // Forms
    document.getElementById('orgaForm').addEventListener('submit', (e) => this.createOrga(e));
    document.getElementById('orgaEditForm').addEventListener('submit', (e) => this.updateOrga(e));
    document.getElementById('mediaForm').addEventListener('submit', (e) => this.updateMedia(e));
    document.getElementById('impressumForm').addEventListener('submit', (e) => this.updateImpressum(e));
    
    // Toggle Buttons
    document.getElementById('toggleRequestsBtn').addEventListener('click', () => this.toggleRequests());
    document.getElementById('toggleUsersBtn').addEventListener('click', () => this.toggleUsers());
    document.getElementById('acceptAllBtn').addEventListener('click', () => this.acceptAllRequests());
    
    // Modal Events
    this.setupModalEvents();
    
    // File Input Events für Media
    this.setupMediaFileEvents();
  }

  setupModalEvents() {
    // Modal close events
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModal(e.target.id);
      }
    });

    // Close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) this.closeModal(modal.id);
      });
    });
  }

  setupMediaFileEvents() {
    // Video file input
    const videoInput = document.getElementById('video');
    if (videoInput) {
      videoInput.addEventListener('change', (e) => this.previewVideo(e));
    }

    // Image file inputs (1-19)
    for (let i = 1; i <= 19; i++) {
      const imageInput = document.getElementById(`image${i}`);
      if (imageInput) {
        imageInput.addEventListener('change', (e) => this.previewImage(e, i));
      }
    }
  }

  fixViewport() {
    const viewport = document.querySelector("meta[name=viewport]");
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
    
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }

  initializeUI() {
    this.updateChatButton(this.ui.chatsLocked);
  }

  // ===== AUTHENTICATION =====
  async handleLogin(e) {
    e.preventDefault();
    
    // API Key aus dem Input-Feld lesen - FIXED!
    const apiKeyInput = document.querySelector('input[name="apiKey"]');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : '';

    console.log('API Key eingegeben:', apiKey); // Debug log

    if (!apiKey) {
      this.showMessage('Bitte geben Sie einen API-Schlüssel ein', 'error');
      return;
    }

    try {
      this.showLoading('Anmeldung läuft...');
      
      // Test-Request mit API Key
      const testUrl = `/api/admin/requests?apiKey=${encodeURIComponent(apiKey)}`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Login Response Status:', response.status); // Debug log
      
      if (response.ok) {
        this.apiKey = apiKey;
        console.log('API Key gesetzt:', this.apiKey); // Debug log
        this.showPanel();
        await this.loadAllData();
        this.showMessage('Erfolgreich angemeldet!', 'success');
      } else {
        const errorText = await response.text();
        console.log('Login Error:', errorText); // Debug log
        this.showMessage('Ungültiger API-Schlüssel', 'error');
      }
    } catch (error) {
      console.error('Login Error:', error); // Debug log
      this.showMessage('Anmeldefehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  showPanel() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    this.fixViewport();
  }

  // ===== DATA LOADING =====
  async loadAllData() {
    try {
      await Promise.all([
        this.loadRequests(),
        this.loadUsers(),
        this.loadOrgas(),
        this.loadNewsletterCount()
      ]);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      this.showMessage('Fehler beim Laden einiger Daten', 'error');
    }
  }

  async loadRequests() {
    try {
      const response = await this.makeRequest('/api/admin/requests');
      if (response.ok) {
        this.data.requests = await response.json();
        this.updateCount('requestCount', this.data.requests.length);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Anfragen:', error);
    }
  }

  async loadUsers() {
    try {
      const response = await this.makeRequest('/api/admin/users');
      if (response.ok) {
        this.data.users = await response.json();
        this.updateCount('userCount', this.data.users.length);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Nutzer:', error);
    }
  }

  async loadOrgas() {
    try {
      const response = await this.makeRequest('/api/admin/orgas');
      if (response.ok) {
        this.data.orgas = await response.json();
        this.updateCount('orgaCount', this.data.orgas.length);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Organisatoren:', error);
    }
  }

  async loadNewsletterCount() {
    try {
      const response = await this.makeRequest('/api/admin/newsletter-emails');
      if (response.ok) {
        const emails = await response.json();
        this.data.newsletter = Array.isArray(emails) ? emails : [];
        this.updateCount('newsletterCount', this.data.newsletter.length);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Newsletter-Daten:', error);
    }
  }

  async loadReports() {
    try {
      const response = await this.makeRequest('/api/reports');
      if (response.ok) {
        this.data.reports = await response.json();
        return Array.isArray(this.data.reports) ? this.data.reports : [];
      } else {
        console.error('Fehler beim Laden der Reports - Response nicht OK');
        return [];
      }
    } catch (error) {
      console.error('Fehler beim Laden der Reports:', error);
      return [];
    }
  }

  // ===== CHAT MANAGEMENT =====
  async toggleChatLock() {
    const newState = !this.ui.chatsLocked;

    try {
      this.showLoading('Chat-Status wird geändert...');
      const response = await this.makeRequest('/api/admin/chats-lock', {
        method: 'POST',
        body: { lock: newState }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.ui.chatsLocked = newState;
        this.updateChatButton(newState);
        this.showMessage(result.message, 'success');
      } else {
        this.showMessage('Fehler beim Ändern des Chat-Status', 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  updateChatButton(isLocked) {
    const button = document.getElementById('chatLockBtn');
    if (button) {
      if (isLocked) {
        button.textContent = '🔓 Chats entsperren';
        button.classList.add('locked');
        button.classList.remove('unlocked');
      } else {
        button.textContent = '🔒 Chats sperren';
        button.classList.add('unlocked');
        button.classList.remove('locked');
      }
    }
  }

  // ===== MODAL MANAGEMENT =====
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }

  // ===== REQUEST MANAGEMENT =====
  async openRequestsModal() {
    await this.loadRequests();
    this.renderRequests();
    this.openModal('requestsModal');
  }

  renderRequests() {
    const container = document.getElementById('requestsList');
    if (!container) return;

    const list = this.ui.requestsExpanded ? this.data.requests : this.data.requests.slice(0, 10);
    
    if (list.length === 0) {
      container.innerHTML = '<div class="list-item">Keine Anfragen vorhanden</div>';
    } else {
      container.innerHTML = list.map(req => `
        <div class="list-item">
          <div class="list-item-content">
            <strong>${this.escapeHtml(req.username)}</strong>
            <div class="list-item-meta">${new Date(req.requestedAt).toLocaleString()}</div>
          </div>
          <div class="list-item-actions">
            <button class="btn-success" onclick="adminPanel.approveRequest('${this.escapeHtml(req.username)}')">
              ✓ Akzeptieren
            </button>
            <button class="btn-danger" onclick="adminPanel.rejectRequest('${this.escapeHtml(req.username)}')">
              ✗ Ablehnen
            </button>
          </div>
        </div>
      `).join('');
    }

    // Toggle button
    const toggleBtn = document.getElementById('toggleRequestsBtn');
    if (toggleBtn) {
      if (this.data.requests.length > 10) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.textContent = this.ui.requestsExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen';
      } else {
        toggleBtn.classList.add('hidden');
      }
    }
  }

  toggleRequests() {
    this.ui.requestsExpanded = !this.ui.requestsExpanded;
    this.renderRequests();
  }

  async acceptAllRequests() {
    if (!confirm('Alle Anfragen akzeptieren?')) return;

    try {
      this.showLoading('Anfragen werden akzeptiert...');
      for (const req of this.data.requests) {
        await this.makeRequest('/api/admin/approve', {
          method: 'POST',
          body: { username: req.username }
        });
      }
      this.showMessage('Alle Anfragen wurden akzeptiert', 'success');
      await this.loadRequests();
      await this.loadUsers();
      this.renderRequests();
    } catch (error) {
      this.showMessage('Fehler beim Akzeptieren: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async approveRequest(username) {
    try {
      const response = await this.makeRequest('/api/admin/approve', {
        method: 'POST',
        body: { username }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        await this.loadRequests();
        await this.loadUsers();
        this.renderRequests();
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    }
  }

  async rejectRequest(username) {
    try {
      const response = await this.makeRequest('/api/admin/reject', {
        method: 'POST',
        body: { username }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        await this.loadRequests();
        this.renderRequests();
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    }
  }

  // ===== USER MANAGEMENT =====
  async openUsersModal() {
    await this.loadUsers();
    this.renderUsers();
    this.openModal('usersModal');
  }

  renderUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;

    const filtered = this.filterUsers();
    const list = this.ui.usersExpanded ? filtered : filtered.slice(0, 10);
    
    if (list.length === 0) {
      container.innerHTML = '<div class="list-item">Keine Nutzer gefunden</div>';
    } else {
      container.innerHTML = list.map(user => `
        <div class="list-item">
          <div class="list-item-content">
            <strong>${this.escapeHtml(user.username)}</strong>
            <div class="list-item-meta">
              <span class="status-badge ${user.isAdmin ? 'admin' : (user.locked ? 'banned' : 'active')}">
                ${user.isAdmin ? 'Admin' : (user.locked ? 'Gesperrt' : 'Aktiv')}
              </span>
            </div>
          </div>
          <div class="list-item-actions">
            ${this.getUserActions(user)}
          </div>
        </div>
      `).join('');
    }

    // Toggle button
    const toggleBtn = document.getElementById('toggleUsersBtn');
    if (toggleBtn) {
      if (filtered.length > 10) {
        toggleBtn.classList.remove('hidden');
        toggleBtn.textContent = this.ui.usersExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen';
      } else {
        toggleBtn.classList.add('hidden');
      }
    }
  }

  getUserActions(user) {
    const username = this.escapeHtml(user.username);
    if (user.isAdmin) {
      return `<button class="btn-warning" onclick="adminPanel.demoteUser('${username}')">Herabstufen</button>`;
    } else {
      const promoteBtn = `<button class="btn-success" onclick="adminPanel.promoteUser('${username}')">Befördern</button>`;
      const banBtn = user.locked 
        ? `<button class="btn-secondary" onclick="adminPanel.unbanUser('${username}')">Entsperren</button>`
        : `<button class="btn-danger" onclick="adminPanel.banUser('${username}')">Sperren</button>`;
      return promoteBtn + banBtn;
    }
  }

  filterUsers() {
    const usernameFilter = document.getElementById('filterUsername')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('filterStatus')?.value || 'all';
    const roleFilter = document.getElementById('filterRole')?.value || 'all';

    return this.data.users.filter(user => {
      if (usernameFilter && !user.username.toLowerCase().includes(usernameFilter)) return false;
      if (statusFilter === 'active' && user.locked) return false;
      if (statusFilter === 'banned' && !user.locked) return false;
      if (roleFilter === 'admin' && !user.isAdmin) return false;
      if (roleFilter === 'user' && user.isAdmin) return false;
      return true;
    });
  }

  applyUserFilters() {
    this.ui.usersExpanded = false;
    this.renderUsers();
  }

  toggleUsers() {
    this.ui.usersExpanded = !this.ui.usersExpanded;
    this.renderUsers();
  }

  async promoteUser(username) {
    await this.userAction('/api/admin/promote', username, 'Nutzer befördert');
  }

  async demoteUser(username) {
    await this.userAction('/api/admin/demote', username, 'Admin herabgestuft');
  }

  async banUser(username) {
    await this.userAction('/api/admin/ban', username, 'Nutzer gesperrt');
  }

  async unbanUser(username) {
    await this.userAction('/api/admin/unban', username, 'Nutzer entsperrt');
  }

  async userAction(endpoint, username, successMessage) {
    try {
      this.showLoading('Bearbeitung läuft...');
      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: { username }
      });
      
      if (response.ok) {
        this.showMessage(successMessage, 'success');
        await this.loadUsers();
        this.renderUsers();
      } else {
        const error = await response.json();
        this.showMessage(error.message || 'Fehler bei der Aktion', 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== ORGA MANAGEMENT =====
  async openOrgaModal() {
    await this.loadOrgas();
    this.renderOrgas();
    this.openModal('orgaModal');
  }

  renderOrgas() {
    const container = document.getElementById('orgaList');
    if (!container) return;

    if (this.data.orgas.length === 0) {
      container.innerHTML = '<div class="list-item">Keine Organisatoren vorhanden</div>';
    } else {
      container.innerHTML = this.data.orgas.map(orga => `
        <div class="list-item">
          <div class="list-item-content">
            <strong>${this.escapeHtml(orga.username)}</strong>
            <div class="list-item-meta">${this.escapeHtml(orga.bundesland)}</div>
          </div>
          <div class="list-item-actions">
            <button class="btn-warning" onclick="adminPanel.editOrga('${this.escapeHtml(orga.username)}')">
              ✏️ Bearbeiten
            </button>
            <button class="btn-danger" onclick="adminPanel.deleteOrga('${this.escapeHtml(orga.username)}')">
              🗑️ Löschen
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  async createOrga(e) {
    e.preventDefault();
    const username = document.getElementById('orgaUsername').value.trim();
    const password = document.getElementById('orgaPassword').value.trim();
    const bundesland = document.getElementById('orgaBundesland').value;

    if (!username || !password || !bundesland) {
      this.showMessage('Alle Felder sind erforderlich', 'error');
      return;
    }

    try {
      this.showLoading('Orga-Konto wird erstellt...');
      const response = await this.makeRequest('/api/admin/orgas/create', {
        method: 'POST',
        body: { username, password, bundesland }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        e.target.reset();
        await this.loadOrgas();
        this.renderOrgas();
      } else {
        const error = await response.json();
        this.showMessage(error.message, 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  editOrga(username) {
    const orga = this.data.orgas.find(o => o.username === username);
    if (orga) {
      document.getElementById('orgaEditUsername').value = username;
      document.getElementById('orgaEditPassword').value = orga.password;
      document.getElementById('orgaEditBundesland').value = orga.bundesland;
      this.closeModal('orgaModal');
      this.openModal('orgaEditModal');
    }
  }

  async updateOrga(e) {
    e.preventDefault();
    const username = document.getElementById('orgaEditUsername').value;
    const password = document.getElementById('orgaEditPassword').value.trim();
    const bundesland = document.getElementById('orgaEditBundesland').value;

    if (!password || !bundesland) {
      this.showMessage('Passwort und Bundesland sind erforderlich', 'error');
      return;
    }

    try {
      this.showLoading('Orga-Konto wird aktualisiert...');
      const response = await this.makeRequest(`/api/admin/orgas/${encodeURIComponent(username)}`, {
        method: 'PUT',
        body: { password, bundesland }
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        this.closeModal('orgaEditModal');
        await this.loadOrgas();
        this.renderOrgas();
        this.openModal('orgaModal');
      } else {
        const error = await response.json();
        this.showMessage(error.message, 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  async deleteOrga(username) {
    if (!confirm(`Orga-Konto "${username}" wirklich löschen?`)) return;

    try {
      this.showLoading('Orga-Konto wird gelöscht...');
      const response = await this.makeRequest(`/api/admin/orgas/${encodeURIComponent(username)}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        await this.loadOrgas();
        this.renderOrgas();
      } else {
        const error = await response.json();
        this.showMessage(error.message, 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== MEDIA MANAGEMENT =====
  openMediaModal() {
    this.updateMediaPreview();
    this.openModal('mediaModal');
  }

  selectFile(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
      input.click();
    }
  }

  previewVideo(event) {
    const file = event.target.files[0];
    const video = document.getElementById('currentVideo');
    
    if (file && video) {
      const url = URL.createObjectURL(file);
      video.src = url;
      
      // Cleanup old URL when video loads
      video.addEventListener('loadeddata', () => {
        URL.revokeObjectURL(url);
      }, { once: true });
    }
  }

  previewImage(event, imageNumber) {
    const file = event.target.files[0];
    const img = document.getElementById(`currentImage${imageNumber}`);
    
    if (file && img) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  updateMediaPreview() {
    const timestamp = new Date().getTime();
    
    // Update video
    const video = document.getElementById('currentVideo');
    if (video) {
      video.src = `/api/media/video/video1.mp4?t=${timestamp}`;
      // Handle error if video doesn't exist
      video.addEventListener('error', () => {
        console.log('Video nicht gefunden - wird beim Upload erstellt');
      }, { once: true });
    }
    
    // Update images
    for (let i = 1; i <= 19; i++) {
      const img = document.getElementById(`currentImage${i}`);
      if (img) {
        img.src = `/api/media/image/bild${i}.png?t=${timestamp}`;
        // Handle error if image doesn't exist
        img.addEventListener('error', () => {
          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmaWxsPSIjOTk5IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QmlsZCAnICsgaSArICc8L3RleHQ+PC9zdmc+';
        }, { once: true });
      }
    }
  }

  async updateMedia(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Check if any files are selected
    let hasFiles = false;
    for (let [key, value] of formData.entries()) {
      if (value instanceof File && value.size > 0) {
        hasFiles = true;
        break;
      }
    }

    if (!hasFiles) {
      this.showMessage('Bitte wählen Sie mindestens eine Datei aus', 'error');
      return;
    }

    try {
      this.showLoading('Medien werden aktualisiert...');
      const response = await fetch(`/api/admin/update-media?apiKey=${encodeURIComponent(this.apiKey)}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        setTimeout(() => {
          this.updateMediaPreview();
        }, 1000);
      } else {
        const error = await response.json();
        this.showMessage(error.message || 'Fehler beim Aktualisieren der Medien', 'error');
      }
    } catch (error) {
      this.showMessage('Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== NEWSLETTER MANAGEMENT =====
  async loadNewsletter() {
    try {
      this.showLoading('Newsletter-Daten werden geladen...');
      await this.loadNewsletterCount();
      this.renderNewsletter();
      this.openModal('newsletterModal');
    } catch (error) {
      this.showMessage('Fehler beim Laden der Newsletter-Daten: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  renderNewsletter() {
    const container = document.getElementById('newsletterList');
    if (!container) return;

    if (this.data.newsletter.length === 0) {
      container.innerHTML = '<div class="list-item">Keine Newsletter-Abonnenten vorhanden</div>';
    } else {
      container.innerHTML = this.data.newsletter.map(email => `
        <div class="newsletter-item">${this.escapeHtml(email)}</div>
      `).join('');
    }
  }

  exportNewsletter() {
    const text = JSON.stringify(this.data.newsletter, null, 2);
    this.downloadFile('newsletter_emails.json', text);
  }

  // ===== REPORTS MANAGEMENT =====
  async loadReportsModal() {
    try {
      this.showLoading('Reports werden geladen...');
      const reports = await this.loadReports();
      this.renderReports(reports);
      this.openModal('reportsModal');
    } catch (error) {
      this.showMessage('Fehler beim Laden der Reports: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  renderReports(reports) {
    const container = document.getElementById('reportsList');
    if (!container) return;

    if (!Array.isArray(reports) || reports.length === 0) {
      container.innerHTML = '<div class="list-item">Keine Reports vorhanden</div>';
      return;
    }

    container.innerHTML = reports.map(report => `
      <div class="report-item">
        <strong>ID:</strong> ${this.escapeHtml(report.id)}<br>
        <strong>Bereich:</strong> ${this.escapeHtml(report.errorArea)}<br>
        <strong>Beschreibung:</strong> ${this.escapeHtml(report.details?.description || 'Keine Beschreibung')}<br>
        <div class="report-meta">
          ${new Date(report.timestamp).toLocaleString()} - IP: ${this.escapeHtml(report.ip)}
        </div>
      </div>
    `).join('');
  }

  // ===== IMPRESSUM MANAGEMENT =====
  async openImpressumModal() {
    try {
      this.showLoading('Impressum wird geladen...');
      const response = await fetch('/api/impressum');
      if (response.ok) {
        const data = await response.json();
        document.getElementById('impVorname').value = data.Vorname || '';
        document.getElementById('impNachname').value = data.Nachname || '';
        document.getElementById('impAdresse').value = data.Adresse || '';
        document.getElementById('impAdresszusatz').value = data.Adresszusatz || '';
        document.getElementById('impStadt').value = data.Stadt || '';
        document.getElementById('impEmail').value = data.Email || '';
      }
    } catch (error) {
      console.error('Fehler beim Laden des Impressums:', error);
    } finally {
      this.hideLoading();
    }
    this.openModal('impressumModal');
  }

  async updateImpressum(e) {
    e.preventDefault();
    const formData = {
      Vorname: document.getElementById('impVorname').value.trim(),
      Nachname: document.getElementById('impNachname').value.trim(),
      Adresse: document.getElementById('impAdresse').value.trim(),
      Adresszusatz: document.getElementById('impAdresszusatz').value.trim(),
      Stadt: document.getElementById('impStadt').value.trim(),
      Email: document.getElementById('impEmail').value.trim()
    };

    // Validation
    if (!formData.Vorname || !formData.Nachname || !formData.Adresse || 
        !formData.Adresszusatz || !formData.Stadt || !formData.Email) {
      this.showMessage('Alle Felder sind erforderlich', 'error');
      return;
    }

    try {
      this.showLoading('Impressum wird gespeichert...');
      const response = await this.makeRequest('/api/impressum', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        this.showMessage(result.message, 'success');
        this.closeModal('impressumModal');
      } else {
        const error = await response.json();
        this.showMessage(error.message, 'error');
      }
    } catch (error) {
      this.showMessage('Fehler beim Speichern: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== EXPORT FUNCTIONALITY =====
  async exportAll() {
    try {
      this.showLoading('Export wird erstellt...');
      const response = await fetch(`/api/export-all?apiKey=${encodeURIComponent(this.apiKey)}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `demo-export-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        this.showMessage('Export erfolgreich heruntergeladen', 'success');
      } else {
        const error = await response.json();
        this.showMessage(error.message || 'Fehler beim Export', 'error');
      }
    } catch (error) {
      this.showMessage('Export-Fehler: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== UTILITY FUNCTIONS =====
  async makeRequest(url, options = {}) {
    const config = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      ...options
    };

    // API Key zu URL hinzufügen - FIXED!
    if (!this.apiKey) {
      console.error('Kein API Key verfügbar!');
      throw new Error('Kein API Key verfügbar');
    }

    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}apiKey=${encodeURIComponent(this.apiKey)}`;

    console.log('Making request to:', fullUrl); // Debug log

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(fullUrl, config);
    
    // Log errors for debugging
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText} for ${fullUrl}`);
    }
    
    return response;
  }

  updateCount(elementId, count) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = count;
    }
  }

  showMessage(message, type = 'info') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;

    // Insert at top of main content
    const main = document.querySelector('main');
    if (main) {
      main.insertBefore(messageDiv, main.firstChild);
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, 5000);
  }

  showLoading(message = 'Lädt...') {
    this.hideLoading(); // Remove any existing loading message
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message loading-message';
    loadingDiv.id = 'loadingMessage';
    loadingDiv.innerHTML = `
      <span class="loading"></span>
      <span>${message}</span>
    `;

    const main = document.querySelector('main');
    if (main) {
      main.insertBefore(loadingDiv, main.firstChild);
    }
  }

  hideLoading() {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage) {
      loadingMessage.remove();
    }
  }

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// ===== GLOBAL INSTANCE =====
let adminPanel;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  adminPanel = new AdminPanel();
});

// ===== GLOBAL FUNCTIONS FOR HTML CALLBACKS =====
function openRequestsModal() {
  if (adminPanel) adminPanel.openRequestsModal();
}

function openUsersModal() {
  if (adminPanel) adminPanel.openUsersModal();
}

function openOrgaModal() {
  if (adminPanel) adminPanel.openOrgaModal();
}

function openMediaModal() {
  if (adminPanel) adminPanel.openMediaModal();
}

function openImpressumModal() {
  if (adminPanel) adminPanel.openImpressumModal();
}

function loadNewsletter() {
  if (adminPanel) adminPanel.loadNewsletter();
}

function loadReports() {
  if (adminPanel) adminPanel.loadReportsModal();
}

function exportAll() {
  if (adminPanel) adminPanel.exportAll();
}

function exportNewsletter() {
  if (adminPanel) adminPanel.exportNewsletter();
}

function closeModal(modalId) {
  if (adminPanel) adminPanel.closeModal(modalId);
}

function selectFile(inputId) {
  if (adminPanel) adminPanel.selectFile(inputId);
}

function applyUserFilters() {
  if (adminPanel) adminPanel.applyUserFilters();
}

// Global action functions for HTML callbacks
window.adminPanel = {
  approveRequest: (username) => adminPanel?.approveRequest(username),
  rejectRequest: (username) => adminPanel?.rejectRequest(username),
  promoteUser: (username) => adminPanel?.promoteUser(username),
  demoteUser: (username) => adminPanel?.demoteUser(username),
  banUser: (username) => adminPanel?.banUser(username),
  unbanUser: (username) => adminPanel?.unbanUser(username),
  editOrga: (username) => adminPanel?.editOrga(username),
  deleteOrga: (username) => adminPanel?.deleteOrga(username)
};

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (!adminPanel) return;

  // ESC to close modals
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal:not(.hidden)');
    if (openModal) {
      adminPanel.closeModal(openModal.id);
    }
  }
  
  // Ctrl+E for export
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    if (adminPanel.apiKey) {
      exportAll();
    }
  }
  
  // Ctrl+R for refresh data
  if (e.ctrlKey && e.key === 'r') {
    e.preventDefault();
    if (adminPanel.apiKey) {
      adminPanel.loadAllData();
      adminPanel.showMessage('Daten werden aktualisiert...', 'success');
    }
  }

  // F5 to refresh page (default behavior, but with message)
  if (e.key === 'F5') {
    if (adminPanel.apiKey) {
      adminPanel.showMessage('Seite wird neu geladen...', 'info');
    }
  }
});

// ===== AUTO REFRESH =====
let autoRefreshInterval;

function startAutoRefresh() {
  // Refresh data every 60 seconds (increased from 30)
  autoRefreshInterval = setInterval(() => {
    if (adminPanel?.apiKey) {
      adminPanel.loadAllData();
      console.log('Auto-refresh: Daten aktualisiert');
    }
  }, 60000);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// Start auto-refresh when panel is ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for admin panel to initialize
  setTimeout(() => {
    if (adminPanel?.apiKey) {
      startAutoRefresh();
    }
  }, 1000);
});

// Stop/Start auto-refresh when page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else if (adminPanel?.apiKey) {
    startAutoRefresh();
  }
});

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
  console.error('JavaScript Error:', e.error);
  if (adminPanel) {
    adminPanel.showMessage('Ein unerwarteter Fehler ist aufgetreten', 'error');
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise Rejection:', e.reason);
  if (adminPanel) {
    adminPanel.showMessage('Ein Netzwerkfehler ist aufgetreten', 'error');
  }
});

// ===== PERFORMANCE MONITORING =====
if ('performance' in window) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = performance.getEntriesByType('navigation')[0];
      if (perfData) {
        console.log(`Admin Panel geladen in ${Math.round(perfData.loadEventEnd - perfData.loadEventStart)}ms`);
      }
    }, 0);
  });
}