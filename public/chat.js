// Deutsche Demo Chat - JavaScript Überarbeitet
class DemoChatApp {
  constructor() {
    // State Management
    this.state = {
      currentChannel: null,
      currentExtraChat: null,
      isAdmin: false,
      isOrga: false,
      userBundesland: null,
      lastMessageTimestamp: null,
      autoScrollEnabled: true,
      isConnected: false,
      isLoggedIn: false
    };

    // Configuration
    this.config = {
      messageLimit: 30,
      pollingInterval: 2000,
      maxMessageLength: 1000,
      reconnectAttempts: 3,
      reconnectDelay: 1000
    };

    // Polling
    this.pollingInterval = null;
    this.reconnectAttempts = 0;

    // Bundesländer Liste
    this.allBundeslaender = [
      "Baden-Württemberg", "Bayern", "Berlin", "Brandenburg",
      "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern",
      "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz",
      "Saarland", "Sachsen", "Sachsen-Anhalt", 
      "Schleswig-Holstein", "Thüringen", "Admin_chat"
    ];

    this.init();
  }

  // ===== INITIALIZATION =====
  init() {
    this.bindElements();
    this.bindEvents();
    this.checkLoginStatus();
  }

  bindElements() {
    // Login Elements
    this.loginSection = document.getElementById('loginSection');
    this.chatInterface = document.getElementById('chatInterface');
    this.loginForm = document.getElementById('loginForm');
    this.toRegisterButton = document.getElementById('toRegisterButton');
    this.logoutBtn = document.getElementById('logoutBtn');

    // Mobile Navigation
    this.mobileNav = document.getElementById('mobileNav');
    this.mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    this.mobileNavClose = document.querySelector('.mobile-nav-close');
    this.mobileChannelList = document.getElementById('mobileChannelList');

    // Chat Elements
    this.channelList = document.getElementById('channelList');
    this.chatHeader = document.getElementById('chatHeader');
    this.chatContainer = document.getElementById('chatContainer');
    this.messageForm = document.getElementById('messageForm');
    this.messageInput = document.getElementById('messageInput');
    this.imageForm = document.getElementById('imageForm');
    this.imageInput = document.getElementById('imageInput');

    // UI Elements
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.notificationContainer = document.getElementById('notificationContainer');
  }

  bindEvents() {
    // Login Events
    if (this.loginForm) {
      this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    if (this.logoutBtn) {
      this.logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    if (this.toRegisterButton) {
      this.toRegisterButton.addEventListener('click', () => this.handleRegisterRedirect());
    }

    // Mobile Navigation Events - only bind once, not multiple ways
    this.bindMobileNavEvents();

    // Message Events
    if (this.messageForm) {
      this.messageForm.addEventListener('submit', (e) => this.handleSendMessage(e));
    }

    if (this.imageForm) {
      this.imageForm.addEventListener('submit', (e) => this.handleSendImage(e));
    }

    // File Input Events
    if (this.imageInput) {
      this.imageInput.addEventListener('change', (e) => this.handleFileSelection(e));
    }

    // Scroll Events
    if (this.chatContainer) {
      this.chatContainer.addEventListener('scroll', () => this.handleScroll());
    }

    // Window Events
    window.addEventListener('beforeunload', () => this.cleanup());
    window.addEventListener('focus', () => this.handleWindowFocus());
    window.addEventListener('blur', () => this.handleWindowBlur());
    window.addEventListener('resize', () => this.handleWindowResize());

    // Keyboard Events
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
  }

  bindMobileNavEvents() {
    // Remove any existing event listeners to prevent duplicates
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.removeEventListener('click', this.mobileMenuClickHandler);
      this.mobileMenuClickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Mobile menu button clicked via direct binding');
        this.toggleMobileNav(e);
      };
      this.mobileMenuBtn.addEventListener('click', this.mobileMenuClickHandler);
    }

    if (this.mobileNavClose) {
      this.mobileNavClose.removeEventListener('click', this.mobileNavCloseHandler);
      this.mobileNavCloseHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Mobile nav close clicked via direct binding');
        this.closeMobileNav();
      };
      this.mobileNavClose.addEventListener('click', this.mobileNavCloseHandler);
    }

    // Close mobile nav when clicking outside (but not on the menu button)
    document.addEventListener('click', (e) => {
      if (this.mobileNav && this.mobileNav.classList.contains('active')) {
        if (!this.mobileNav.contains(e.target) && 
            !e.target.classList.contains('mobile-menu-btn') &&
            !e.target.closest('.mobile-menu-btn')) {
          console.log('Clicking outside mobile nav, closing...');
          this.closeMobileNav();
        }
      }
    });
  }

  // ===== LOGIN STATUS CHECK =====
  async checkLoginStatus() {
    try {
      // Zuerst schauen ob ein Cookie vorhanden ist
      const username = this.getCookie('username');
      if (!username) {
        this.showLoginInterface();
        return;
      }

      // Prüfen ob der Benutzer tatsächlich eingeloggt ist
      const response = await this.makeRequest('/api/userinfo');
      if (response.ok) {
        const userInfo = await response.json();
        this.state.isLoggedIn = true;
        this.state.isAdmin = Boolean(userInfo.isAdmin);
        this.state.isOrga = (userInfo.rank === 'Organisator');
        
        if (this.state.isOrga) {
          this.state.userBundesland = userInfo.bundesland;
        }

        await this.initializeChat();
      } else {
        // Session ungültig, Cookie löschen und Login anzeigen
        this.clearCookies();
        this.showLoginInterface();
      }
    } catch (error) {
      console.error('Error checking login status:', error);
      this.showLoginInterface();
    }
  }

  // ===== AUTHENTICATION =====
  async handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(this.loginForm);
    const credentials = Object.fromEntries(formData.entries());

    if (!credentials.username?.trim() || !credentials.password?.trim()) {
      this.showNotification('Bitte füllen Sie alle Felder aus', 'error');
      return;
    }

    try {
      this.showLoading('Anmeldung läuft...');
      
      const response = await this.makeRequest('/api/login', {
        method: 'POST',
        body: credentials
      });

      if (response.ok) {
        const result = await response.json();
        this.state.isLoggedIn = true;
        this.state.isAdmin = Boolean(result.isAdmin);
        this.state.isOrga = Boolean(result.isOrga);
        
        if (this.state.isOrga) {
          this.state.userBundesland = result.bundesland;
        }

        this.showNotification('Erfolgreich angemeldet!', 'success');
        await this.initializeChat();
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Anmeldung fehlgeschlagen', 'error');
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showNotification('Verbindungsfehler bei der Anmeldung', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async handleLogout() {
    try {
      this.showLoading('Abmeldung läuft...');
      
      await this.makeRequest('/api/logout', { method: 'POST' });
      
      // Clear cookies
      this.clearCookies();
      
      // Reset state
      this.resetState();
      
      // Redirect
      window.location.href = 'main.html';
    } catch (error) {
      console.error('Logout error:', error);
      this.showNotification('Fehler beim Ausloggen', 'error');
    } finally {
      this.hideLoading();
    }
  }

  handleRegisterRedirect() {
    window.location.href = 'register.html';
  }

  // ===== CHAT INITIALIZATION =====
  async initializeChat() {
    // Nur initialisieren wenn eingeloggt
    if (!this.state.isLoggedIn) {
      this.showLoginInterface();
      return;
    }

    try {
      this.showLoading('Chat wird geladen...');
      
      // Show image form for admins/orgas
      if ((this.state.isAdmin || this.state.isOrga) && this.imageForm) {
        this.imageForm.classList.remove('hidden');
      }

      // Get channels
      const channelsResponse = await this.makeRequest('/api/channels');
      if (channelsResponse.ok) {
        let channels = await channelsResponse.json();
        
        // Filter to only show Bundesländer
        channels = channels.filter(channel => this.allBundeslaender.includes(channel));
        
        // Add admin chat for admins
        if (this.state.isAdmin && !channels.includes('Admin_chat')) {
          channels.push('Admin_chat');
        }

        this.state.isConnected = true;
        this.showChatInterface();
        this.renderMainChannels(channels);
        this.startPolling();
        
        this.showNotification('Chat erfolgreich geladen', 'success');
      } else {
        throw new Error('Fehler beim Laden der Kanäle');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      this.showLoginInterface();
      this.showNotification('Fehler beim Laden des Chats', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== UI STATE MANAGEMENT =====
  showChatInterface() {
    if (this.chatInterface) this.chatInterface.classList.remove('hidden');
    if (this.loginSection) this.loginSection.classList.add('hidden');
    
    // Logout-Button anzeigen
    if (this.logoutBtn) this.logoutBtn.style.display = 'flex';
    
    // Ensure mobile nav is properly set up
    this.setupMobileNav();
  }

  showLoginInterface() {
    if (this.loginSection) this.loginSection.classList.remove('hidden');
    if (this.chatInterface) this.chatInterface.classList.add('hidden');
    
    // Logout-Button verstecken
    if (this.logoutBtn) this.logoutBtn.style.display = 'none';
    
    this.state.isLoggedIn = false;
  }

  // ===== MOBILE NAVIGATION =====
  toggleMobileNav(event) {
    if (event) {
      event.stopPropagation();
    }
    
    console.log('toggleMobileNav called, mobileNav element:', this.mobileNav);
    
    if (this.mobileNav) {
      const isActive = this.mobileNav.classList.contains('active');
      console.log('Mobile nav currently active:', isActive);
      
      this.mobileNav.classList.toggle('active');
      
      // Prevent body scroll when nav is open
      if (this.mobileNav.classList.contains('active')) {
        document.body.style.overflow = 'hidden';
        console.log('Mobile nav opened');
      } else {
        document.body.style.overflow = '';
        console.log('Mobile nav closed');
      }
    } else {
      console.error('Mobile nav element not found!');
      // Try to find it again
      this.mobileNav = document.getElementById('mobileNav');
      if (this.mobileNav) {
        console.log('Found mobile nav on retry');
        this.mobileNav.classList.toggle('active');
      }
    }
  }

  closeMobileNav() {
    if (this.mobileNav && this.mobileNav.classList.contains('active')) {
      this.mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  handleWindowResize() {
    // Close mobile nav when resizing to desktop
    if (window.innerWidth > 768) {
      this.closeMobileNav();
    }
  }

  setupMobileNav() {
    // Ensure mobile nav elements are properly bound
    if (!this.mobileNav) {
      this.mobileNav = document.getElementById('mobileNav');
    }
    if (!this.mobileChannelList) {
      this.mobileChannelList = document.getElementById('mobileChannelList');
    }
    if (!this.mobileMenuBtn) {
      this.mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    }
    if (!this.mobileNavClose) {
      this.mobileNavClose = document.querySelector('.mobile-nav-close');
    }

    // Re-bind mobile nav events after elements are found
    this.bindMobileNavEvents();

    // Debug logging
    console.log('Mobile nav setup:', {
      mobileNav: !!this.mobileNav,
      mobileChannelList: !!this.mobileChannelList,
      mobileMenuBtn: !!this.mobileMenuBtn,
      mobileNavClose: !!this.mobileNavClose
    });

    // If we have channels already loaded, render them to mobile
    if (this.mobileChannelList && this.channelList) {
      const existingChannels = Array.from(this.channelList.querySelectorAll('.main-channel-btn')).map(btn => btn.textContent);
      if (existingChannels.length > 0) {
        console.log('Re-rendering existing channels to mobile:', existingChannels);
        this.renderMobileChannels(existingChannels);
      }
    }
  }

  // ===== CHANNEL RENDERING =====
  renderMainChannels(channels) {
    if (!this.channelList) return;

    this.channelList.innerHTML = '';
    this.hideChatHeader();

    channels.forEach(channel => {
      const button = this.createChannelButton(channel);
      this.channelList.appendChild(button);
    });

    // Also render mobile channels
    this.renderMobileChannels(channels);
  }

  renderMobileChannels(channels) {
    if (!this.mobileChannelList) {
      console.log('Mobile channel list not found, trying to find it...');
      this.mobileChannelList = document.getElementById('mobileChannelList');
    }
    
    if (!this.mobileChannelList) {
      console.error('Mobile channel list element not found!');
      return;
    }

    console.log('Rendering mobile channels:', channels);
    this.mobileChannelList.innerHTML = '';

    if (!channels || channels.length === 0) {
      this.mobileChannelList.innerHTML = '<p style="color: white; padding: 1rem; text-align: center;">Keine Kanäle verfügbar</p>';
      return;
    }

    channels.forEach(channel => {
      const button = this.createMobileChannelButton(channel);
      this.mobileChannelList.appendChild(button);
    });

    console.log('Mobile channels rendered:', this.mobileChannelList.children.length);
  }

  createMobileChannelButton(channel) {
    const button = document.createElement('button');
    button.classList.add('mobile-channel-btn');
    button.textContent = channel;
    
    console.log('Creating mobile channel button for:', channel);
    
    button.addEventListener('click', async () => {
      console.log('Mobile channel button clicked:', channel);
      this.state.currentChannel = channel;
      this.state.currentExtraChat = null;
      this.state.lastMessageTimestamp = null;
      
      this.updateMobileChannelActive(channel);
      this.updateMainChannelActive(channel);
      await this.loadChat(channel);

      if (this.allBundeslaender.includes(channel) && channel !== 'Admin_chat') {
        const extraChats = await this.loadExtraChats(channel);
        this.renderChatHeader(channel, extraChats);
      } else {
        this.hideChatHeader();
      }

      // Close mobile nav after selection
      this.closeMobileNav();
    });

    return button;
  }

  updateMobileChannelActive(activeChannel) {
    const buttons = this.mobileChannelList?.querySelectorAll('.mobile-channel-btn');
    buttons?.forEach(btn => {
      btn.classList.toggle('active', btn.textContent === activeChannel);
    });
  }

  createChannelButton(channel) {
    const button = document.createElement('button');
    button.classList.add('main-channel-btn');
    button.textContent = channel;
    
    button.addEventListener('click', async () => {
      this.state.currentChannel = channel;
      this.state.currentExtraChat = null;
      this.state.lastMessageTimestamp = null;
      
      this.updateMainChannelActive(channel);
      this.updateMobileChannelActive(channel);
      await this.loadChat(channel);

      if (this.allBundeslaender.includes(channel) && channel !== 'Admin_chat') {
        const extraChats = await this.loadExtraChats(channel);
        this.renderChatHeader(channel, extraChats);
      } else {
        this.hideChatHeader();
      }
    });

    return button;
  }

  updateMainChannelActive(activeChannel) {
    const buttons = this.channelList?.querySelectorAll('.main-channel-btn');
    buttons?.forEach(btn => {
      btn.classList.toggle('active', btn.textContent === activeChannel);
    });
  }

  // ===== CHAT HEADER MANAGEMENT =====
  renderChatHeader(bundesland, extraChats) {
    if (!this.chatHeader) return;

    const chatTabsContainer = this.chatHeader.querySelector('.chat-tabs') || 
                             this.createChatTabsContainer();

    chatTabsContainer.innerHTML = '';

    // Normal chat button
    const normalButton = this.createNormalChatButton(bundesland);
    chatTabsContainer.appendChild(normalButton);

    // Extra chat buttons
    if (extraChats?.length > 0) {
      extraChats.forEach(chat => {
        const extraButton = this.createExtraChatButton(chat, bundesland);
        chatTabsContainer.appendChild(extraButton);
      });
    }

    // Add extra chat button (for orgas)
    if (this.state.isOrga) {
      const addButton = this.createAddExtraChatButton(bundesland);
      chatTabsContainer.appendChild(addButton);
    }

    this.showChatHeader();
    this.updateChatHeaderActive();
  }

  createChatTabsContainer() {
    let container = this.chatHeader.querySelector('.chat-tabs');
    if (!container) {
      container = document.createElement('div');
      container.className = 'chat-tabs';
      this.chatHeader.appendChild(container);
    }
    return container;
  }

  createNormalChatButton(bundesland) {
    const button = document.createElement('button');
    button.classList.add('normal-chat-btn');
    button.textContent = `${bundesland} Normal`;
    
    button.addEventListener('click', async () => {
      this.state.currentExtraChat = null;
      this.state.lastMessageTimestamp = null;
      await this.loadChat(bundesland);
      this.updateChatHeaderActive();
    });

    return button;
  }

  createExtraChatButton(chat, bundesland) {
    const button = document.createElement('button');
    button.classList.add('extra-chat-btn');
    button.textContent = chat.name;
    button.setAttribute('data-chat-file', chat.file);

    button.addEventListener('click', async () => {
      this.state.currentExtraChat = chat.file;
      this.state.lastMessageTimestamp = null;
      await this.loadExtraChat(chat.file);
      this.updateChatHeaderActive();
    });

    if (this.state.isOrga) {
      const deleteButton = this.createDeleteExtraChatButton(chat, bundesland);
      button.appendChild(deleteButton);
    }

    return button;
  }

  createDeleteExtraChatButton(chat, bundesland) {
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-extra-btn');
    deleteBtn.textContent = 'X';
    
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      if (confirm(`Extra-Chat "${chat.name}" wirklich löschen? (Alle Nachrichten gehen verloren)`)) {
        await this.deleteExtraChat(chat.file, bundesland);
      }
    });

    return deleteBtn;
  }

  createAddExtraChatButton(bundesland) {
    const button = document.createElement('button');
    button.classList.add('add-extra-btn');
    button.textContent = '+ Neuer Chat';
    
    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const name = prompt('Name für den neuen Extra-Chat:');
      if (!name?.trim()) return;

      await this.createExtraChat(bundesland, name.trim());
    });

    return button;
  }

  showChatHeader() {
    if (this.chatHeader) this.chatHeader.classList.remove('hidden');
  }

  hideChatHeader() {
    if (this.chatHeader) this.chatHeader.classList.add('hidden');
  }

  updateChatHeaderActive() {
    const normalBtn = this.chatHeader?.querySelector('.normal-chat-btn');
    const extraBtns = this.chatHeader?.querySelectorAll('.extra-chat-btn');

    if (normalBtn) {
      normalBtn.classList.toggle('active', !this.state.currentExtraChat);
    }

    extraBtns?.forEach(btn => {
      const isActive = btn.getAttribute('data-chat-file') === this.state.currentExtraChat;
      btn.classList.toggle('active', isActive);
    });
  }

  // ===== EXTRA CHAT MANAGEMENT =====
  async loadExtraChats(bundesland) {
    try {
      const response = await this.makeRequest(`/api/extra-chats/${encodeURIComponent(bundesland)}`);
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (error) {
      console.error('Error loading extra chats:', error);
      return [];
    }
  }

  async createExtraChat(bundesland, name) {
    try {
      this.showLoading('Extra-Chat wird erstellt...');
      
      const response = await this.makeRequest(`/api/extra-chats/${encodeURIComponent(bundesland)}`, {
        method: 'POST',
        body: { name }
      });

      if (response.ok) {
        const extraChats = await this.loadExtraChats(bundesland);
        this.renderChatHeader(bundesland, extraChats);
        this.showNotification('Extra-Chat erfolgreich erstellt', 'success');
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Erstellen des Extra-Chats', 'error');
      }
    } catch (error) {
      console.error('Error creating extra chat:', error);
      this.showNotification('Fehler beim Erstellen des Extra-Chats', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async deleteExtraChat(chatFile, bundesland) {
    try {
      this.showLoading('Extra-Chat wird gelöscht...');
      
      const response = await this.makeRequest(`/api/extra-chats/${encodeURIComponent(chatFile)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        if (this.state.currentExtraChat === chatFile) {
          this.state.currentExtraChat = null;
          await this.loadChat(bundesland);
        }
        
        const extraChats = await this.loadExtraChats(bundesland);
        this.renderChatHeader(bundesland, extraChats);
        this.showNotification('Extra-Chat erfolgreich gelöscht', 'success');
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Löschen des Extra-Chats', 'error');
      }
    } catch (error) {
      console.error('Error deleting extra chat:', error);
      this.showNotification('Fehler beim Löschen des Extra-Chats', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // ===== MESSAGE LOADING =====
  async loadChat(channel) {
    try {
      const url = `/api/chats/${encodeURIComponent(channel)}?limit=${this.config.messageLimit}`;
      const response = await this.makeRequest(url);
      
      if (response.ok) {
        const messages = await response.json();
        this.renderMessages(messages, true);
        this.scrollToBottomIfEnabled();
      } else {
        this.showError('Fehler beim Laden des Chats');
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      this.showError('Verbindungsfehler beim Laden des Chats');
    }
  }

  async loadExtraChat(chatFile) {
    try {
      const url = `/api/extra-chats/messages/${encodeURIComponent(chatFile)}?limit=${this.config.messageLimit}`;
      const response = await this.makeRequest(url);
      
      if (response.ok) {
        const messages = await response.json();
        this.renderMessages(messages, true);
        this.scrollToBottomIfEnabled();
      } else {
        this.showError('Fehler beim Laden des Extra-Chats');
      }
    } catch (error) {
      console.error('Error loading extra chat:', error);
      this.showError('Verbindungsfehler beim Laden des Extra-Chats');
    }
  }

  // ===== MESSAGE RENDERING =====
  renderMessages(messages, replace = false) {
    if (!this.chatContainer) return;

    if (replace) {
      this.chatContainer.innerHTML = '';
    }

    if (!messages || messages.length === 0) {
      if (replace) {
        this.showWelcomeMessage();
      }
      return;
    }

    messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      this.chatContainer.appendChild(messageElement);
    });
  }

  createMessageElement(msg) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.dataset.messageId = msg.id;

    // Admin styling
    if (msg.rank === 'Admin' || msg.isAdmin) {
      div.classList.add('admin');
    }

    // Meta information
    const meta = this.createMessageMeta(msg);
    div.appendChild(meta);

    // Message content
    if (msg.message) {
      const content = document.createElement('div');
      content.classList.add('message-content');
      content.textContent = msg.message;
      div.appendChild(content);
    }

    // Image content
    if (msg.image) {
      const img = this.createMessageImage(msg.image);
      div.appendChild(img);
    }

    // Action buttons
    const actions = this.createMessageActions(msg);
    if (actions.children.length > 0) {
      div.appendChild(actions);
    }

    return div;
  }

  createMessageMeta(msg) {
    const meta = document.createElement('div');
    meta.classList.add('meta');

    let roleText = 'User';
    if (msg.rank) {
      roleText = msg.rank;
    } else if (msg.isAdmin) {
      roleText = 'Admin';
    }

    const timestamp = new Date(msg.timestamp).toLocaleString();
    meta.textContent = `${roleText}: ${msg.user} | ${timestamp}`;

    return meta;
  }

  createMessageImage(imageName) {
    const img = document.createElement('img');
    img.src = `/pictures/${imageName}`;
    img.alt = 'Hochgeladenes Bild';
    img.loading = 'lazy';
    
    // Click to enlarge
    img.addEventListener('click', () => this.openImageModal(img.src));
    
    return img;
  }

  createMessageActions(msg) {
    const actions = document.createElement('div');
    actions.classList.add('message-actions');

    const currentUsername = this.getCookie('username');

    // Delete button (own messages or admin)
    if (msg.user === currentUsername || this.state.isAdmin) {
      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('deleteBtn');
      deleteBtn.textContent = '🗑️ Löschen';
      deleteBtn.addEventListener('click', () => this.deleteMessage(msg.id));
      actions.appendChild(deleteBtn);
    }

    // Ban button (admin only, not own messages)
    if (this.state.isAdmin && msg.user !== currentUsername) {
      const banBtn = document.createElement('button');
      banBtn.classList.add('banBtn');
      banBtn.textContent = '🚫 Bannen';
      banBtn.addEventListener('click', () => this.banUser(msg.user));
      actions.appendChild(banBtn);
    }

    return actions;
  }

  showWelcomeMessage() {
    if (!this.chatContainer) return;
    
    this.chatContainer.innerHTML = `
      <div class="welcome-message">
        <h3>🇩🇪 Willkommen im Demo Chat!</h3>
        <p>Wählen Sie ein Bundesland aus, um zu beginnen.</p>
      </div>
    `;
  }

  showError(message) {
    if (!this.chatContainer) return;
    
    this.chatContainer.innerHTML = `
      <div class="error-message">
        <h3>❌ Fehler</h3>
        <p>${message}</p>
      </div>
    `;
  }

  // ===== MESSAGE SENDING =====
  async handleSendMessage(e) {
    e.preventDefault();
    
    if (!this.state.currentChannel && !this.state.currentExtraChat) {
      this.showNotification('Bitte wählen Sie einen Chat-Kanal aus', 'error');
      return;
    }

    const message = this.messageInput?.value?.trim();
    if (!message) return;

    if (message.length > this.config.maxMessageLength) {
      this.showNotification(`Nachricht zu lang (max. ${this.config.maxMessageLength} Zeichen)`, 'error');
      return;
    }

    try {
      const endpoint = this.state.currentExtraChat 
        ? `/api/extra-chats/messages/${encodeURIComponent(this.state.currentExtraChat)}`
        : `/api/chats/${encodeURIComponent(this.state.currentChannel)}`;

      const response = await this.makeRequest(endpoint, {
        method: 'POST',
        body: { message }
      });

      if (response.ok) {
        this.messageInput.value = '';
        await this.reloadCurrentChat();
        this.scrollToBottom();
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Senden der Nachricht', 'error');
        
        // Handle chat lock
        if (error.message?.includes('gesperrt')) {
          this.disableMessageInput();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.showNotification('Verbindungsfehler beim Senden der Nachricht', 'error');
    }
  }

  async handleSendImage(e) {
    e.preventDefault();
    
    if (!this.state.currentChannel && !this.state.currentExtraChat) {
      this.showNotification('Bitte wählen Sie einen Chat-Kanal aus', 'error');
      return;
    }

    const file = this.imageInput?.files[0];
    if (!file) {
      this.showNotification('Bitte wählen Sie ein Bild aus', 'error');
      return;
    }

    // Validate file
    if (!this.validateImageFile(file)) return;

    try {
      this.showLoading('Bild wird hochgeladen...');
      
      const formData = new FormData();
      formData.append('image', file);

      const endpoint = this.state.currentExtraChat 
        ? `/api/extra-chats/messages/image/${encodeURIComponent(this.state.currentExtraChat)}`
        : `/api/chats/${encodeURIComponent(this.state.currentChannel)}/image`;

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        this.imageInput.value = '';
        this.updateFileLabel();
        await this.reloadCurrentChat();
        this.scrollToBottom();
        this.showNotification('Bild erfolgreich gesendet', 'success');
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Hochladen des Bildes', 'error');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      this.showNotification('Verbindungsfehler beim Hochladen des Bildes', 'error');
    } finally {
      this.hideLoading();
    }
  }

  validateImageFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      this.showNotification('Bild zu groß (max. 5MB)', 'error');
      return false;
    }

    if (!allowedTypes.includes(file.type)) {
      this.showNotification('Ungültiger Dateityp (nur JPEG, PNG, GIF, WebP)', 'error');
      return false;
    }

    return true;
  }

  // ===== MESSAGE ACTIONS =====
  async deleteMessage(messageId) {
    if (!confirm('Nachricht wirklich löschen?')) return;

    try {
      const endpoint = this.state.currentExtraChat 
        ? `/api/extra-chats/messages/${encodeURIComponent(this.state.currentExtraChat)}`
        : `/api/chats/${encodeURIComponent(this.state.currentChannel)}`;

      const response = await this.makeRequest(endpoint, {
        method: 'DELETE',
        body: { messageId }
      });

      if (response.ok) {
        await this.reloadCurrentChat();
        this.showNotification('Nachricht gelöscht', 'success');
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Löschen der Nachricht', 'error');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      this.showNotification('Verbindungsfehler beim Löschen der Nachricht', 'error');
    }
  }

  async banUser(username) {
    if (!confirm(`Benutzer "${username}" wirklich sperren?`)) return;

    try {
      const response = await this.makeRequest('/api/admin/ban', {
        method: 'POST',
        body: { username }
      });

      if (response.ok) {
        const result = await response.json();
        this.showNotification(result.message || 'Benutzer wurde gesperrt', 'success');
        await this.reloadCurrentChat();
      } else {
        const error = await response.json();
        this.showNotification(error.message || 'Fehler beim Sperren des Benutzers', 'error');
      }
    } catch (error) {
      console.error('Error banning user:', error);
      this.showNotification('Verbindungsfehler beim Sperren des Benutzers', 'error');
    }
  }

  // ===== POLLING & AUTO-REFRESH =====
  startPolling() {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      if (this.state.autoScrollEnabled && this.state.isConnected && this.state.isLoggedIn) {
        this.reloadCurrentChat();
      }
    }, this.config.pollingInterval);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async reloadCurrentChat() {
    try {
      if (this.state.currentExtraChat) {
        await this.loadExtraChat(this.state.currentExtraChat);
      } else if (this.state.currentChannel) {
        await this.loadChat(this.state.currentChannel);
      }
    } catch (error) {
      console.error('Error reloading chat:', error);
      this.handleConnectionError();
    }
  }

  // ===== SCROLL MANAGEMENT =====
  handleScroll() {
    if (!this.chatContainer) return;

    const threshold = 50;
    const position = this.chatContainer.scrollTop + this.chatContainer.clientHeight;
    const height = this.chatContainer.scrollHeight;
    
    this.state.autoScrollEnabled = position >= height - threshold;
  }

  scrollToBottom() {
    if (this.chatContainer) {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }
  }

  scrollToBottomIfEnabled() {
    if (this.state.autoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  // ===== EVENT HANDLERS =====
  handleFileSelection(e) {
    this.updateFileLabel();
  }

  updateFileLabel() {
    const label = document.querySelector('.file-label');
    if (label && this.imageInput) {
      const fileName = this.imageInput.files[0]?.name;
      if (fileName) {
        label.textContent = `📎 ${fileName}`;
      } else {
        label.innerHTML = '<span>🖼️</span> Bild auswählen';
      }
    }
  }

  handleWindowFocus() {
    if (this.state.isConnected && this.state.isLoggedIn) {
      this.startPolling();
    }
  }

  handleWindowBlur() {
    // Continue polling but maybe reduce frequency
  }

  handleKeyboardShortcuts(e) {
    // Enter to send message (if focused on input)
    if (e.key === 'Enter' && e.target === this.messageInput && !e.shiftKey) {
      e.preventDefault();
      this.messageForm?.dispatchEvent(new Event('submit'));
    }

    // Escape to clear input or close mobile nav
    if (e.key === 'Escape') {
      if (this.mobileNav && this.mobileNav.classList.contains('active')) {
        this.closeMobileNav();
      } else if (this.messageInput) {
        this.messageInput.value = '';
        this.messageInput.blur();
      }
    }

    // Ctrl+R to reload chat
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      this.reloadCurrentChat();
    }
  }

  // ===== CONNECTION MANAGEMENT =====
  async handleConnectionError() {
    this.state.isConnected = false;
    this.stopPolling();

    if (this.reconnectAttempts < this.config.reconnectAttempts) {
      this.reconnectAttempts++;
      this.showNotification(`Verbindung unterbrochen. Neuversuch ${this.reconnectAttempts}/${this.config.reconnectAttempts}...`, 'warning');
      
      setTimeout(async () => {
        try {
          await this.checkLoginStatus();
          this.reconnectAttempts = 0;
          this.showNotification('Verbindung wiederhergestellt', 'success');
        } catch (error) {
          console.error('Reconnection failed:', error);
          this.handleConnectionError();
        }
      }, this.config.reconnectDelay * this.reconnectAttempts);
    } else {
      this.showNotification('Verbindung verloren. Bitte laden Sie die Seite neu.', 'error');
    }
  }

  // ===== UI UTILITIES =====
  showLoading(message = 'Lädt...') {
    if (this.loadingOverlay) {
      const spinner = this.loadingOverlay.querySelector('.loading-spinner p');
      if (spinner) spinner.textContent = message;
      this.loadingOverlay.classList.remove('hidden');
    }
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
  }

  showNotification(message, type = 'info') {
    if (!this.notificationContainer) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = this.getNotificationIcon(type);
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${this.escapeHtml(message)}</span>
    `;

    this.notificationContainer.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  openImageModal(src) {
    // Create simple image modal
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-backdrop">
        <div class="image-modal-content">
          <img src="${src}" alt="Vergrößertes Bild">
          <button class="image-modal-close">&times;</button>
        </div>
      </div>
    `;

    // Add styles if not exist
    if (!document.querySelector('#image-modal-styles')) {
      const styles = document.createElement('style');
      styles.id = 'image-modal-styles';
      styles.textContent = `
        .image-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .image-modal-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .image-modal-content {
          position: relative;
          max-width: 90%;
          max-height: 90%;
        }
        .image-modal img {
          max-width: 100%;
          max-height: 100%;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        }
        .image-modal-close {
          position: absolute;
          top: -40px;
          right: -40px;
          background: rgba(255, 255, 255, 0.9);
          color: #333;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `;
      document.head.appendChild(styles);
    }

    // Close handlers
    const closeModal = () => modal.remove();
    modal.querySelector('.image-modal-close').addEventListener('click', closeModal);
    modal.querySelector('.image-modal-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.addEventListener('keydown', function escapeHandler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    });

    document.body.appendChild(modal);
  }

  disableMessageInput() {
    if (this.messageInput) {
      this.messageInput.disabled = true;
      this.messageInput.placeholder = 'Chats sind gesperrt';
    }
    
    const submitBtn = this.messageForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Gesperrt';
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

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    
    // Handle common HTTP errors
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  }

  getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return null;
  }

  clearCookies() {
    const cookies = ['username', 'password', 'orgaUsername', 'orgaPassword'];
    cookies.forEach(cookie => {
      document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  resetState() {
    this.state = {
      currentChannel: null,
      currentExtraChat: null,
      isAdmin: false,
      isOrga: false,
      userBundesland: null,
      lastMessageTimestamp: null,
      autoScrollEnabled: true,
      isConnected: false,
      isLoggedIn: false
    };
    this.stopPolling();
    this.reconnectAttempts = 0;
  }

  cleanup() {
    this.stopPolling();
    
    // Remove event listeners if needed
    if (this.chatContainer) {
      this.chatContainer.removeEventListener('scroll', this.handleScroll);
    }
  }

  // ===== ERROR HANDLING =====
  handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    let message = 'Ein unerwarteter Fehler ist aufgetreten';
    if (error.message?.includes('fetch')) {
      message = 'Verbindungsfehler zum Server';
    } else if (error.message?.includes('401')) {
      message = 'Sitzung abgelaufen. Bitte melden Sie sich erneut an';
      this.showLoginInterface();
    }
    
    this.showNotification(message, 'error');
  }
}

// ===== GLOBAL FUNCTIONS FOR HTML ONCLICK =====
// Remove the global onclick handler to prevent double-firing
// window.toggleMobileNav = function(event) {
//   if (window.chatApp && typeof window.chatApp.toggleMobileNav === 'function') {
//     window.chatApp.toggleMobileNav(event);
//   } else {
//     console.error('chatApp not found or toggleMobileNav not available');
//   }
// };

// ===== GLOBAL ERROR HANDLERS =====
window.addEventListener('error', (e) => {
  console.error('Global JavaScript error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled Promise rejection:', e.reason);
});

// ===== APPLICATION INITIALIZATION =====
let chatApp;

document.addEventListener('DOMContentLoaded', () => {
  try {
    chatApp = new DemoChatApp();
    
    // Global access for debugging
    if (typeof window !== 'undefined') {
      window.chatApp = chatApp;
    }
  } catch (error) {
    console.error('Failed to initialize chat app:', error);
    
    // Fallback error display
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        flex-direction: column;
        font-family: Arial, sans-serif;
        background: #f8f9fa;
        color: #333;
      ">
        <h1 style="color: #d4182a;">⚠️ Fehler beim Laden</h1>
        <p>Der Chat konnte nicht geladen werden.</p>
        <button onclick="window.location.reload()" style="
          background: #d4182a;
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
        ">Seite neu laden</button>
      </div>
    `;
  }
});