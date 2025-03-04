const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Definiere den API Key als Konstante (8-stellige zufällige alphanumerische Zeichenkette)
const API_KEY = "QjT6CoRwXS";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Verzeichnis-Pfade
const privateDir = path.join(__dirname, 'private');
const chatsDir = path.join(privateDir, 'bundes_chats');
const picturesDir = path.join(privateDir, 'pictures'); // Für Bilder

// Stelle sicher, dass die notwendigen Verzeichnisse existieren
if (!fs.existsSync(picturesDir)) {
  fs.mkdirSync(picturesDir, { recursive: true });
}
if (!fs.existsSync(chatsDir)) {
  fs.mkdirSync(chatsDir, { recursive: true });
}

const usersFile = path.join(privateDir, 'users.json');
const adminsFile = path.join(privateDir, 'admins.json');
const orgaFile = path.join(privateDir, 'orga.json'); // Für Organisatoren
const requestAccessFile = path.join(privateDir, 'request_acces.json');

// Hilfsfunktionen zum synchronen Lesen/Schreiben von JSON
function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } else {
      return [];
    }
  } catch (err) {
    console.error("Fehler beim Lesen von", filePath, err);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Fehler beim Schreiben in", filePath, err);
  }
}

// In-Memory-Store für Rate Limiting (nur für normale Nutzer)
const userMessageTimestamps = {};

// Multer-Konfiguration für Bilder-Upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, picturesDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const randomName = Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
    cb(null, randomName);
  }
});
const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    // Erlaubt Bild-Uploads für Admins (über req.user) und Organisatoren (über req.orga)
    if ((req.user && req.user.isAdmin) || req.orga) {
      cb(null, true);
    } else {
      cb(new Error('Nur Admins oder Organisatoren dürfen Bilder hochladen'), false);
    }
  }
});

/* ---------------------------
   Middleware: Authentifizierung (Cookies) für normale Nutzer und Admins
----------------------------*/
function authMiddleware(req, res, next) {
  const { username, password } = req.cookies;
  if (!username || !password) {
    return res.status(401).json({ message: 'Nicht eingeloggt' });
  }
  // Suche in users.json
  let users = readJSON(usersFile);
  let user = users.find(u => u.username === username && u.password === password);
  // Falls nicht gefunden, in admins.json suchen
  if (!user) {
    let admins = readJSON(adminsFile);
    let adminUser = admins.find(a => a.username === username && a.password === password);
    if (adminUser) {
      adminUser.isAdmin = true;
      user = adminUser;
    }
  }
  if (!user) {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
  if (user.locked) {
    return res.status(403).json({ message: 'Account gesperrt' });
  }
  req.user = user;
  next();
}

/* ---------------------------
   Middleware: Admin-Authentifizierung (API Key oder Cookies)
----------------------------*/
function adminAuth(req, res, next) {
  const { username, password } = req.cookies;
  if (username && password) {
    let users = readJSON(usersFile);
    let user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      let admins = readJSON(adminsFile);
      user = admins.find(a => a.username === username && a.password === password);
      if (user) {
        user.isAdmin = true;
      }
    }
    if (user && user.isAdmin && !user.locked) {
      req.user = user;
      return next();
    }
  }
  const apiKey = (req.body.apiKey || req.query.apiKey || "").trim();
  if (apiKey === API_KEY) {
    req.user = { username: "admin", isAdmin: true };
    return next();
  }
  return res.status(403).json({ message: 'Ungültiger API Key oder nicht angemeldet' });
}

/* ---------------------------
   Middleware: Organisator-Authentifizierung
   - Organisatoren haben eigene Cookies: "orgaUsername" und "orgaPassword"
----------------------------*/
function orgaAuth(req, res, next) {
  const { orgaUsername, orgaPassword } = req.cookies;
  if (!orgaUsername || !orgaPassword) {
    return res.status(401).json({ message: 'Nicht als Organisator eingeloggt' });
  }
  let orgas = readJSON(orgaFile);
  const orga = orgas.find(o => o.username === orgaUsername && o.password === orgaPassword);
  if (!orga) {
    return res.status(401).json({ message: 'Ungültige Organisator-Zugangsdaten' });
  }
  req.orga = orga;
  next();
}

/* ---------------------------
   Statische Dateien
----------------------------*/
app.use(express.static(path.join(__dirname, 'public'), { index: 'main.html' }));
app.use('/pictures', express.static(picturesDir));

/* ---------------------------
   Endpunkte für normale Nutzer, Login, Signup etc.
----------------------------*/
app.get('/api/userinfo', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, isAdmin: req.user.isAdmin });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  let users = readJSON(usersFile);
  let user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    let admins = readJSON(adminsFile);
    let adminUser = admins.find(a => a.username === username && a.password === password);
    if (adminUser) {
      adminUser.isAdmin = true;
      user = adminUser;
    }
  }
  if (user) {
    if (user.locked) {
      return res.status(403).json({ message: 'Account gesperrt' });
    }
    res.cookie('username', username, { httpOnly: true });
    res.cookie('password', password, { httpOnly: true });
    return res.json({ message: 'Erfolgreich eingeloggt', isAdmin: !!user.isAdmin });
  } else {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('username');
  res.clearCookie('password');
  res.json({ message: 'Erfolgreich ausgeloggt' });
});

app.post('/api/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username und Passwort erforderlich' });
  }
  const pending = readJSON(requestAccessFile);
  const users = readJSON(usersFile);
  const admins = readJSON(adminsFile);
  if (
    pending.find(u => u.username === username) ||
    users.find(u => u.username === username) ||
    admins.find(a => a.username === username)
  ) {
    return res.status(400).json({ message: 'Benutzer existiert bereits' });
  }
  pending.push({
    username,
    password,
    requestedAt: new Date().toISOString()
  });
  writeJSON(requestAccessFile, pending);
  res.json({ message: 'Anfrage wurde gesendet. Bitte warten Sie auf die Freigabe.' });
});

/* ---------------------------
   Chat-Endpunkte (für normale Nutzer und Admins)
----------------------------*/
app.get('/api/channels', authMiddleware, (req, res) => {
  fs.readdir(chatsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Fehler beim Lesen der Chat-Dateien' });
    }
    let channels = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
    if (!req.user.isAdmin) {
      channels = channels.filter(ch => ch !== 'Admin_chat');
    }
    res.json(channels);
  });
});

app.get('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  const filePath = path.join(chatsDir, chatName + '.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Chat nicht gefunden' });
  }
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Lesen des Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Chats' });
  }
  // Sortiere Nachrichten nach Timestamp (aufsteigend)
  chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (req.query.olderThan) {
    const olderThanDate = new Date(req.query.olderThan);
    chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
  }
  if (req.query.limit) {
    const limit = parseInt(req.query.limit, 10);
    if (!isNaN(limit) && limit > 0) {
      chatData = chatData.slice(-limit);
    }
  }
  res.json(chatData);
});

app.post('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }
  if (!req.user.isAdmin) {
    if (message.length > 1000) {
      return res.status(400).json({ message: 'Nachricht zu lang (maximal 1000 Zeichen erlaubt)' });
    }
    const now = Date.now();
    if (!userMessageTimestamps[req.user.username]) {
      userMessageTimestamps[req.user.username] = [];
    }
    userMessageTimestamps[req.user.username] = userMessageTimestamps[req.user.username].filter(ts => now - ts < 60000);
    if (userMessageTimestamps[req.user.username].length >= 20) {
      return res.status(429).json({ message: 'Rate limit überschritten (maximal 20 Nachrichten pro Minute)' });
    }
    userMessageTimestamps[req.user.username].push(now);
  }
  const filePath = path.join(chatsDir, chatName + '.json');
  let chatData = [];
  if (fs.existsSync(filePath)) {
    try {
      chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('Fehler beim Parsen', e);
    }
  }
  const newMessage = {
    id: Date.now() + '_' + Math.floor(Math.random() * 1000),
    user: req.user.username,
    isAdmin: !!req.user.isAdmin,
    message,
    timestamp: new Date().toISOString(),
    pinned: false
  };
  chatData.push(newMessage);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

app.post('/api/chats/:chatName/image', authMiddleware, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err) {
      return res.status(403).json({ message: err.message });
    }
    const chatName = req.params.chatName;
    if (chatName === 'Admin_chat' && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Kein Bild hochgeladen' });
    }
    const filePath = path.join(chatsDir, chatName + '.json');
    let chatData = [];
    if (fs.existsSync(filePath)) {
      try {
        chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.error('Fehler beim Parsen', e);
      }
    }
    const newMessage = {
      id: Date.now() + '_' + Math.floor(Math.random() * 1000),
      user: req.user.username,
      isAdmin: !!req.user.isAdmin,
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    chatData.push(newMessage);
    writeJSON(filePath, chatData);
    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});

app.delete('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  const { messageId } = req.body;
  if (!messageId) {
    return res.status(400).json({ message: 'messageId fehlt' });
  }
  const filePath = path.join(chatsDir, chatName + '.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Chat nicht gefunden' });
  }
  let chatData;
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Chats' });
  }
  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) {
    return res.status(404).json({ message: 'Nachricht nicht gefunden' });
  }
  const msg = chatData[index];
  if (msg.user !== req.user.username && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }
  chatData.splice(index, 1);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

/* ---------------------------
   Endpunkte für Organisatoren
----------------------------*/
// Organisator-Konto per API-Key erstellen (öffentliche Erstellung ist NICHT vorgesehen – siehe Admin)
app.post('/api/orga/create', (req, res) => {
  const { apiKey, username, password, bundesland } = req.body;
  if (apiKey !== API_KEY) {
    return res.status(403).json({ message: 'Ungültiger API Key' });
  }
  if (!username || !password || !bundesland) {
    return res.status(400).json({ message: 'Username, Passwort und Bundesland erforderlich' });
  }
  let orgas = readJSON(orgaFile);
  if (orgas.find(o => o.username === username)) {
    return res.status(400).json({ message: 'Organisator existiert bereits' });
  }
  orgas.push({ username, password, bundesland });
  writeJSON(orgaFile, orgas);
  res.json({ message: 'Organisator-Konto erstellt' });
});

// Orga Login
app.post('/api/orga/login', (req, res) => {
  const { username, password } = req.body;
  let orgas = readJSON(orgaFile);
  const orga = orgas.find(o => o.username === username && o.password === password);
  if (!orga) {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
  res.cookie('orgaUsername', username, { httpOnly: true });
  res.cookie('orgaPassword', password, { httpOnly: true });
  res.json({ message: 'Organisator erfolgreich eingeloggt' });
});

// Orga Logout
app.post('/api/orga/logout', (req, res) => {
  res.clearCookie('orgaUsername');
  res.clearCookie('orgaPassword');
  res.json({ message: 'Organisator erfolgreich ausgeloggt' });
});

// GET Orga-Chat: Liefert paginierte Nachrichten (limit, olderThan)
app.get('/api/orga/chats', orgaAuth, (req, res) => {
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) {
    return res.json([]);
  }
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Lesen des Orga-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Orga-Chats' });
  }
  // Sortiere Nachrichten aufsteigend (älteste zuerst)
  chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  
  // Standard-Limit = 20 Nachrichten
  const limit = parseInt(req.query.limit, 10) || 20;
  
  // Falls ein "olderThan"-Parameter gesetzt ist, filtere Nachrichten, die älter sind.
  if (req.query.olderThan) {
    const olderThanDate = new Date(req.query.olderThan);
    chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
  }
  
  // Gib nur die letzten "limit" Nachrichten aus.
  chatData = chatData.slice(-limit);
  res.json(chatData);
});

// POST Orga-Chat: Textnachricht senden
app.post('/api/orga/chats', orgaAuth, (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  let chatData = [];
  if (fs.existsSync(orgaChatFile)) {
    try {
      chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
    } catch (e) {
      console.error('Fehler beim Parsen des Orga-Chats', e);
    }
  }
  const newMessage = {
    id: Date.now() + '_' + Math.floor(Math.random() * 1000),
    user: req.orga.username,
    bundesland: req.orga.bundesland,
    message,
    timestamp: new Date().toISOString(),
    pinned: false
  };
  chatData.push(newMessage);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

// POST Orga-Chat: Bild hochladen und Nachricht senden
app.post('/api/orga/chats/image', orgaAuth, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err) {
      return res.status(403).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Kein Bild hochgeladen' });
    }
    const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
    let chatData = [];
    if (fs.existsSync(orgaChatFile)) {
      try {
        chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
      } catch (e) {
        console.error('Fehler beim Parsen des Orga-Chats', e);
      }
    }
    const newMessage = {
      id: Date.now() + '_' + Math.floor(Math.random() * 1000),
      user: req.orga.username,
      bundesland: req.orga.bundesland,
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    chatData.push(newMessage);
    writeJSON(orgaChatFile, chatData);
    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});

// Neue Endpunkte für das Anpinnen von Nachrichten im Orga-Chat
app.post('/api/orga/chats/pin', orgaAuth, (req, res) => {
  const { messageId, pin } = req.body;
  if (typeof messageId === 'undefined' || typeof pin === 'undefined') {
    return res.status(400).json({ message: 'messageId und pin-Status erforderlich' });
  }
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) {
    return res.status(404).json({ message: 'Orga-Chat nicht gefunden' });
  }
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Orga-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Orga-Chats' });
  }
  const msg = chatData.find(m => m.id === messageId);
  if (!msg) {
    return res.status(404).json({ message: 'Nachricht nicht gefunden' });
  }
  msg.pinned = pin;
  writeJSON(orgaChatFile, chatData);
  res.json({ message: `Nachricht ${pin ? 'angepinnt' : 'abgelöst'}` });
});

// GET Orga-Chat: Angepinnte Nachrichten abrufen
app.get('/api/orga/chats/pinned', orgaAuth, (req, res) => {
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) {
    return res.json([]);
  }
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Lesen des Orga-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Orga-Chats' });
  }
  const pinned = chatData.filter(m => m.pinned);
  // Sortiere angepinnte Nachrichten (älteste zuerst)
  pinned.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(pinned);
});

/* ---------------------------
   Neue Admin-Endpunkte für Orga-Konten
----------------------------*/

// GET: Liste aller Orga-Konten
app.get('/api/admin/orgas', adminAuth, (req, res) => {
  const orgas = readJSON(orgaFile);
  res.json(orgas);
});

// POST: Orga-Konto erstellen (Admin-Panel)
app.post('/api/admin/orgas/create', adminAuth, (req, res) => {
  const { username, password, bundesland } = req.body;
  if (!username || !password || !bundesland) {
    return res.status(400).json({ message: 'Alle Felder (Username, Passwort, Bundesland) sind erforderlich' });
  }
  let orgas = readJSON(orgaFile);
  if (orgas.find(o => o.username === username)) {
    return res.status(400).json({ message: 'Ein Orga-Konto mit diesem Benutzernamen existiert bereits' });
  }
  orgas.push({ username, password, bundesland });
  writeJSON(orgaFile, orgas);
  res.json({ message: 'Orga-Konto erfolgreich erstellt' });
});

// PUT: Orga-Konto aktualisieren (z. B. Passwort oder Bundesland ändern)
app.put('/api/admin/orgas/:username', adminAuth, (req, res) => {
  const targetUsername = req.params.username;
  const { password, bundesland } = req.body;
  let orgas = readJSON(orgaFile);
  const orga = orgas.find(o => o.username === targetUsername);
  if (!orga) {
    return res.status(404).json({ message: 'Orga-Konto nicht gefunden' });
  }
  if (password) {
    orga.password = password;
  }
  if (bundesland) {
    orga.bundesland = bundesland;
  }
  writeJSON(orgaFile, orgas);
  res.json({ message: 'Orga-Konto erfolgreich aktualisiert' });
});

// DELETE: Orga-Konto löschen
app.delete('/api/admin/orgas/:username', adminAuth, (req, res) => {
  const targetUsername = req.params.username;
  let orgas = readJSON(orgaFile);
  const newOrgas = orgas.filter(o => o.username !== targetUsername);
  if (newOrgas.length === orgas.length) {
    return res.status(404).json({ message: 'Orga-Konto nicht gefunden' });
  }
  writeJSON(orgaFile, newOrgas);
  res.json({ message: 'Orga-Konto erfolgreich gelöscht' });
});

/* ---------------------------
   Admin-Endpunkte (wie bisher)
----------------------------*/
// Hilfsfunktion zum Löschen aller Nachrichten eines bestimmten Nutzers in jedem Chat
function deleteUserMessages(username) {
  try {
    const chatFiles = fs.readdirSync(chatsDir).filter(file => file.endsWith('.json'));
    chatFiles.forEach(file => {
      const filePath = path.join(chatsDir, file);
      let chatData = [];
      try {
        chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        console.error("Fehler beim Parsen der Datei", filePath, err);
        return;
      }
      const filteredChatData = chatData.filter(msg => msg.user !== username);
      fs.writeFileSync(filePath, JSON.stringify(filteredChatData, null, 2), 'utf8');
    });
  } catch (err) {
    console.error("Fehler beim Löschen der Nachrichten für Benutzer", username, err);
  }
}

app.post('/api/admin/ban', adminAuth, (req, res) => {
  const { username } = req.body;
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  let targetIsAdmin = false;
  if (!target) {
    let admins = readJSON(adminsFile);
    target = admins.find(a => a.username === username);
    if (target) {
      targetIsAdmin = true;
    }
  }
  if (!target) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  if (targetIsAdmin && req.user.username === username) {
    return res.status(403).json({ message: 'Admins können sich nicht selbst bannen' });
  }
  target.locked = true;
  if (targetIsAdmin) {
    let admins = readJSON(adminsFile);
    admins = admins.map(a => a.username === username ? target : a);
    writeJSON(adminsFile, admins);
    deleteUserMessages(username);
    return res.json({ message: `Admin ${username} wurde gesperrt und alle Nachrichten wurden gelöscht` });
  } else {
    users = users.map(u => u.username === username ? target : u);
    writeJSON(usersFile, users);
    deleteUserMessages(username);
    return res.json({ message: `Nutzer ${username} wurde gesperrt und alle Nachrichten wurden gelöscht` });
  }
});

app.post('/api/admin/unban', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username erforderlich' });
  }
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  let targetIsAdmin = false;
  if (!target) {
    let admins = readJSON(adminsFile);
    target = admins.find(a => a.username === username);
    if (target) {
      targetIsAdmin = true;
    }
  }
  if (!target) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  target.locked = false;
  if (targetIsAdmin) {
    let admins = readJSON(adminsFile);
    admins = admins.map(a => a.username === username ? target : a);
    writeJSON(adminsFile, admins);
    return res.json({ message: `Admin ${username} wurde entsperrt` });
  } else {
    users = users.map(u => u.username === username ? target : u);
    writeJSON(usersFile, users);
    return res.json({ message: `Nutzer ${username} wurde entsperrt` });
  }
});

app.get('/api/admin/requests', adminAuth, (req, res) => {
  const pending = readJSON(requestAccessFile);
  res.json(pending);
});

app.post('/api/admin/reject', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username erforderlich' });
  }
  let pending = readJSON(requestAccessFile);
  const index = pending.findIndex(u => u.username === username);
  if (index === -1) {
    return res.status(404).json({ message: 'Anfrage nicht gefunden' });
  }
  pending.splice(index, 1);
  writeJSON(requestAccessFile, pending);
  res.json({ message: 'Anfrage abgelehnt und entfernt' });
});

app.post('/api/admin/approve', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username erforderlich' });
  }
  let pending = readJSON(requestAccessFile);
  const index = pending.findIndex(u => u.username === username);
  if (index === -1) {
    return res.status(404).json({ message: 'Anfrage nicht gefunden' });
  }
  let approvedUser = pending.splice(index, 1)[0];
  approvedUser.isAdmin = false;
  approvedUser.locked = false;
  let users = readJSON(usersFile);
  users.push(approvedUser);
  writeJSON(usersFile, users);
  writeJSON(requestAccessFile, pending);
  res.json({ message: 'Benutzer genehmigt und in users.json übernommen' });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = readJSON(usersFile).map(u => ({ ...u, isAdmin: false }));
  const admins = readJSON(adminsFile).map(a => ({ ...a, isAdmin: true }));
  res.json(users.concat(admins));
});

app.post('/api/admin/promote', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username erforderlich' });
  }
  let users = readJSON(usersFile);
  const index = users.findIndex(u => u.username === username);
  if (index === -1) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden oder bereits Admin' });
  }
  let promotedUser = users.splice(index, 1)[0];
  promotedUser.isAdmin = true;
  let admins = readJSON(adminsFile);
  admins.push(promotedUser);
  writeJSON(usersFile, users);
  writeJSON(adminsFile, admins);
  res.json({ message: `Nutzer ${username} wurde befördert` });
});

app.post('/api/admin/demote', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username erforderlich' });
  }
  let admins = readJSON(adminsFile);
  const index = admins.findIndex(a => a.username === username);
  if (index === -1) {
    return res.status(404).json({ message: 'Admin nicht gefunden oder bereits normaler Nutzer' });
  }
  let demotedUser = admins.splice(index, 1)[0];
  demotedUser.isAdmin = false;
  let users = readJSON(usersFile);
  users.push(demotedUser);
  writeJSON(adminsFile, admins);
  writeJSON(usersFile, users);
  res.json({ message: `Admin ${username} wurde herabgestuft` });
});

// Neuer Admin-Endpunkt: Update Media (Video und Bilder)
const tempUploadsDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}
const mediaUploadStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempUploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext);
  }
});
const mediaUpload = multer({ storage: mediaUploadStorage });

app.post('/api/admin/update-media', adminAuth, mediaUpload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]), (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const fileMapping = {
    video: 'video1.mp4',
    image1: 'bild1.png',
    image2: 'bild2.png'
  };
  Object.entries(fileMapping).forEach(([field, targetFilename]) => {
    if (req.files && req.files[field]) {
      const targetPath = path.join(publicDir, targetFilename);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      const uploadedFile = req.files[field][0];
      fs.renameSync(uploadedFile.path, targetPath);
    }
  });
  res.json({ message: 'Medien erfolgreich aktualisiert' });
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
