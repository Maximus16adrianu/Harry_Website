const express = require('express');
const app = express();
app.set('trust proxy', 1);
const PORT = 3000;
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');

const API_KEY = "QjT6CoRwXS";

let chatsLocked = true;
let bugReportIPData = {};  // <-- Hier hinzufügen

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Globaler Limiter: max. 50 Anfragen pro Minute, über alle IPs hinweg
const globalAccountLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 50,
  keyGenerator: () => 'global_account', // Alle Anfragen werden unter demselben Schlüssel gezählt
  message: { message: 'Account-Endpunkt ist vorübergehend wegen hoher Auslastung gesperrt.' }
});

// Pro-IP Limiter: max. 5 Anfragen pro Minute
const accountLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { message: 'Zu viele Anfragen von dieser IP. Maximal 5 pro Minute erlaubt.' }
});

// Pro-IP 5-Minuten Limiter: max. 20 Anfragen in 5 Minuten
const accountFiveMinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minuten
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { message: 'Ihre IP wurde wegen verdächtiger Aktivität blockiert.' }
});

// --------------------------------------------------------------------
// Neue Express-Rate-Limit Middleware-Konfiguration für Newsletter-Endpunkte

// Globaler Limiter: max. 5 Newsletter-Anfragen pro Minute, über alle IPs hinweg
const globalNewsletterLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 5,
  keyGenerator: () => 'global_newsletter',
  message: { message: 'Newsletter-Endpunkt ist vorübergehend wegen hoher Auslastung gesperrt.' }
});

// Pro-IP Limiter: max. 1 E-Mail pro Stunde
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 1,
  keyGenerator: (req) => req.ip,
  message: { message: 'Sie können nur eine E-Mail pro Stunde absenden.' }
});

// --------------------------------------------------------------------
// Verzeichnis-Pfade und weitere Initialisierung
const privateDir = path.join(__dirname, 'private');
const chatsDir = path.join(privateDir, 'bundes_chats');
const picturesDir = path.join(privateDir, 'pictures');
const reportsDir = path.join(privateDir, 'reports');
const extraChatsFile = path.join(chatsDir, 'extrachats.json');
const presseFile = path.join(privateDir, 'presse.json');

if (!fs.existsSync(picturesDir)) {
  fs.mkdirSync(picturesDir, { recursive: true });
}
if (!fs.existsSync(chatsDir)) {
  fs.mkdirSync(chatsDir, { recursive: true });
}
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

const usersFile = path.join(privateDir, 'users.json');
const adminsFile = path.join(privateDir, 'admins.json');
const orgaFile = path.join(privateDir, 'orgas.json');
const requestAccessFile = path.join(privateDir, 'request_access.json');
const reportsFile = path.join(reportsDir, 'reports.json');

function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8').trim();
      if (!data) return [];
      return JSON.parse(data);
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

const userMessageTimestamps = {}; // Für Chat-spezifisches Rate Limiting

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
    if ((req.user && req.user.isAdmin) || req.orga) {
      cb(null, true);
    } else {
      cb(new Error('Nur Admins oder Organisatoren dürfen Bilder hochladen'), false);
    }
  }
});

/* ---------------------------
   Middleware: Authentifizierung (Cookies)
----------------------------*/
function authMiddleware(req, res, next) {
  const { username, password } = req.cookies;
  if (username && password) {
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
      req.user = user;
      return next();
    }
  }
  const { orgaUsername, orgaPassword } = req.cookies;
  if (orgaUsername && orgaPassword) {
    let orgas = readJSON(orgaFile);
    const orga = orgas.find(o => o.username === orgaUsername && o.password === orgaPassword);
    if (orga) {
      req.user = { username: orga.username, isAdmin: true, isOrga: true, bundesland: orga.bundesland };
      return next();
    } else {
      return res.status(401).json({ message: 'Ungültige Organisator-Zugangsdaten' });
    }
  }
  return res.status(401).json({ message: 'Nicht eingeloggt' });
}

/* ---------------------------
   Middleware: Admin-Authentifizierung (API Key oder Cookies)
----------------------------*/
function adminAuth(req, res, next) {
  const now = Date.now();
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
  const info = { username: req.user.username, isAdmin: req.user.isAdmin };
  if (req.user.isOrga) {
    info.rank = 'Organisator';
    info.bundesland = req.user.bundesland;
  }
  res.json(info);
});

// --- Angepasste Endpunkte mit geänderter Middleware-Reihenfolge ---
// Bei /api/login, /api/orga/login und /api/signup kommen nun zuerst die lokalen Limiter, dann der globale Limiter.

app.post('/api/logout', (req, res) => {
  res.clearCookie('username');
  res.clearCookie('password');
  res.clearCookie('orgaUsername');
  res.clearCookie('orgaPassword');
  res.json({ message: 'Erfolgreich ausgeloggt' });
});

app.post('/api/login', accountLimiter, accountFiveMinLimiter, globalAccountLimiter, (req, res) => {
  const { username, password } = req.body;
  let user = null;
  let source = null;
  
  const users = readJSON(usersFile);
  user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    const admins = readJSON(adminsFile);
    user = admins.find(a => a.username === username && a.password === password);
    if (user) {
      user.isAdmin = true;
      source = 'admin';
    }
  }
  
  if (!user) {
    const orgas = readJSON(orgaFile);
    user = orgas.find(o => o.username === username && o.password === password);
    if (user) {
      user.isOrga = true;
      source = 'orga';
    }
  }
  
  if (user) {
    if (user.locked) {
      return res.status(403).json({ message: 'Account gesperrt' });
    }
    if (source === 'orga') {
      res.cookie('orgaUsername', username, { httpOnly: true });
      res.cookie('orgaPassword', password, { httpOnly: true });
      return res.json({ message: 'Organisator erfolgreich eingeloggt', isAdmin: true, isOrga: true, bundesland: user.bundesland });
    } else {
      res.cookie('username', username, { httpOnly: true });
      res.cookie('password', password, { httpOnly: true });
      return res.json({ message: 'Erfolgreich eingeloggt', isAdmin: !!user.isAdmin });
    }
  } else {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
});

app.post('/api/orga/login', accountLimiter, accountFiveMinLimiter, globalAccountLimiter, (req, res) => {
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

app.post('/api/signup', accountLimiter, accountFiveMinLimiter, globalAccountLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username und Passwort erforderlich' });
  }
  
  // Längenprüfung: Username und Passwort dürfen maximal 20 Zeichen lang sein
  if (username.length > 20 || password.length > 20) {
    return res.status(400).json({ message: 'Username und Passwort dürfen maximal 20 Zeichen lang sein.' });
  }

  // Passwort muss mindestens 8 Zeichen lang sein
  if (password.length < 8) {
    return res.status(400).json({ message: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }
  
  // Normalisiere den Username: alles in Kleinbuchstaben, entferne Sonderzeichen und Leerzeichen
  const normalizedUsername = username.toLowerCase().replace(/[\W_]+/g, '');
  
  // Liste verbotener Wörter (kann beliebig erweitert werden)
  const bannedWords = [
    'fuck',
    'nigger',
    'shit',
    'bitch',
    'asshole',
    'cunt',
    'dick',
    'whore',
    'slut',
    'fag',
    'motherfucker'
  ];
  
  // Prüfe, ob eines der verbotenen Wörter im normalisierten Username vorkommt
  if (bannedWords.some(word => normalizedUsername.includes(word))) {
    return res.status(400).json({ message: 'Der Benutzername enthält unzulässige Wörter.' });
  }
  
  const pending = readJSON(requestAccessFile);
  const users = readJSON(usersFile);
  const admins = readJSON(adminsFile);
  
  // Prüfe, ob der Benutzername bereits in einer der Listen existiert
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

// --------------------------------------
// Admin-Route, um alle Newsletter-E-Mails abzufragen
app.get('/api/admin/newsletter-emails', adminAuth, (req, res) => {
  const emailFilePath = path.join(__dirname, 'private', 'emails.json');
  if (!fs.existsSync(emailFilePath)) {
    return res.json([]);
  }
  try {
    const emails = JSON.parse(fs.readFileSync(emailFilePath, 'utf8'));
    if (!Array.isArray(emails)) {
      return res.json([]);
    }
    return res.json(emails);
  } catch (err) {
    console.error('Fehler beim Lesen der emails.json:', err);
    return res.status(500).json({ message: 'Fehler beim Lesen der E-Mail-Datei' });
  }
});


/* ---------------------------
   Chat-Endpunkte (für Nutzer, Admins, Orgas)
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
    channels = channels.filter(ch => ch !== 'orga_chat');
    res.json(channels);
  });
});

app.get('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  if (chatName === 'orga_chat') {
    return res.status(403).json({ message: 'Kein Zugriff auf Orga Chat. Bitte als Organisator einloggen.' });
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
  chatData = (function removeDisallowedMessages(filePath, chatData) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
    const phoneRegex = /(\+?\d[\d\s\-]{7,}\d)/;
    const cleanedData = chatData.filter(msg => {
      if (msg.rank && msg.rank.startsWith("Organisator")) {
        return true;
      }
      if (msg.message && (emailRegex.test(msg.message) || phoneRegex.test(msg.message))) {
        return false;
      }
      return true;
    });
    if (cleanedData.length !== chatData.length) {
      writeJSON(filePath, cleanedData);
    }
    return cleanedData;
  })(filePath, chatData);
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

app.get('/api/reports', adminAuth, (req, res) => {
  if (!fs.existsSync(reportsFile)) {
    return res.json([]);
  }
  try {
    const reports = JSON.parse(fs.readFileSync(reportsFile, 'utf8'));
    return res.json(reports);
  } catch (err) {
    console.error('Fehler beim Lesen der Reports:', err);
    return res.status(500).json({ message: 'Fehler beim Laden der Reports' });
  }
});

app.post('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  if (chatName === 'orga_chat') {
    return res.status(403).json({ message: 'Kein Zugriff auf Orga Chat. Bitte als Organisator einloggen.' });
  }
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }
  if (!req.user.isOrga) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
    const phoneRegex = /(\+?\d[\d\s\-]{7,}\d)/;
    if (emailRegex.test(message) || phoneRegex.test(message)) {
      return res.status(400).json({ message: 'Nachricht enthält unerlaubte Inhalte (Telefonnummer oder Email-Adresse)' });
    }
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
    message,
    timestamp: new Date().toISOString(),
    pinned: false
  };
  if (req.user.isOrga) {
    newMessage.rank = `Organisator (${req.user.bundesland})`;
  } else if (req.user.isAdmin) {
    newMessage.rank = 'Admin';
  }
  chatData.push(newMessage);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

app.post('/api/chats/:chatName/image', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  if (chatName === 'orga_chat') {
    return res.status(403).json({ message: 'Kein Zugriff auf Orga Chat. Bitte als Organisator einloggen.' });
  }
  upload.single('image')(req, res, function(err) {
    if (err) {
      return res.status(403).json({ message: err.message });
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
        console.error('Fehler beim Parsen des Chats', e);
      }
    }
    const newMessage = {
      id: Date.now() + '_' + Math.floor(Math.random() * 1000),
      user: req.user.username,
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    if (req.user.isOrga) {
      newMessage.rank = `Organisator (${req.user.bundesland})`;
    } else if (req.user.isAdmin) {
      newMessage.rank = 'Admin';
    }
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
  if (chatName === 'orga_chat') {
    return res.status(403).json({ message: 'Kein Zugriff auf Orga Chat. Bitte als Organisator einloggen.' });
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
    console.error('Fehler beim Parsen des Chats', e);
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
   Endpunkte für Organisatoren (Orga Chat)
----------------------------*/
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
  chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const limit = parseInt(req.query.limit, 10) || 20;
  if (req.query.olderThan) {
    const olderThanDate = new Date(req.query.olderThan);
    chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
  }
  chatData = chatData.slice(-limit);
  res.json(chatData);
});

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
    message,
    timestamp: new Date().toISOString(),
    pinned: false,
    bundesland: req.orga.bundesland
  };
  newMessage.rank = `Organisator (${req.orga.bundesland})`;
  chatData.push(newMessage);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

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
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    newMessage.rank = `Organisator (${req.orga.bundesland})`;
    chatData.push(newMessage);
    writeJSON(orgaChatFile, chatData);
    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});

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
  pinned.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(pinned);
});

app.delete('/api/orga/chats', orgaAuth, (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    return res.status(400).json({ message: 'messageId fehlt' });
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
  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) {
    return res.status(404).json({ message: 'Nachricht nicht gefunden' });
  }
  const msg = chatData[index];
  if (msg.user !== req.orga.username) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }
  chatData.splice(index, 1);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

/* ---------------------------
   Neue Endpunkte für Extra-Chats (Mini-Chats) für Organisatoren
   Diese Extra-Chats werden in der Datei extrachats.json verwaltet und
   ihre Nachrichten in separaten Dateien im chatsDir gespeichert.
----------------------------*/

// Hilfsfunktionen für Extra-Chats
function readExtraChats() {
  if (!fs.existsSync(extraChatsFile)) return [];
  try {
    const data = fs.readFileSync(extraChatsFile, 'utf8').trim();
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Fehler beim Lesen von extrachats.json", err);
    return [];
  }
}
function writeExtraChats(data) {
  try {
    fs.writeFileSync(extraChatsFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Fehler beim Schreiben von extrachats.json", err);
  }
}

// GET: Alle Extra-Chats für ein bestimmtes Bundesland
app.get('/api/extra-chats/:bundesland', authMiddleware, (req, res) => {
  const bundesland = req.params.bundesland;
  const extraChats = readExtraChats().filter(chat => chat.bundesland === bundesland);
  res.json(extraChats);
});

app.post('/api/extra-chats/messages/image/:chatFile', authMiddleware, (req, res) => {
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });
  }
  upload.single('image')(req, res, function(err) {
    if (err) {
      return res.status(403).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Kein Bild hochgeladen' });
    }
    let chatData = [];
    try {
      chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error('Fehler beim Parsen des Extra-Chats', e);
    }
    const newMessage = {
      id: Date.now() + '_' + Math.floor(Math.random() * 1000),
      user: req.user.username,
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    if (req.user.isOrga) {
      newMessage.rank = `Organisator (${req.user.bundesland})`;
    } else if (req.user.isAdmin) {
      newMessage.rank = 'Admin';
    }
    chatData.push(newMessage);
    writeJSON(filePath, chatData);
    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});


// DELETE Extra-Chat: Löscht einen Extra-Chat anhand des Dateinamens
app.delete('/api/extra-chats/:chatFile', orgaAuth, (req, res) => {
  const chatFile = req.params.chatFile;
  const extraChatsFile = path.join(chatsDir, 'extrachats.json');

  // Extrachats aus der Datei laden
  let extraChats = [];
  if (fs.existsSync(extraChatsFile)) {
    try {
      const data = fs.readFileSync(extraChatsFile, 'utf8').trim();
      extraChats = data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Fehler beim Lesen von extrachats.json:', err);
      return res.status(500).json({ message: 'Fehler beim Lesen der Extra-Chats' });
    }
  } else {
    return res.status(404).json({ message: 'Extra-Chats-Datei nicht gefunden' });
  }

  // Prüfen, ob der Extra-Chat existiert
  const chatIndex = extraChats.findIndex(chat => chat.file === chatFile);
  if (chatIndex === -1) {
    return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });
  }

  // Den Eintrag aus der Liste entfernen
  const removedChat = extraChats.splice(chatIndex, 1)[0];

  // Aktualisierte Liste speichern
  try {
    fs.writeFileSync(extraChatsFile, JSON.stringify(extraChats, null, 2), 'utf8');
  } catch (err) {
    console.error('Fehler beim Schreiben in extrachats.json:', err);
    return res.status(500).json({ message: 'Fehler beim Aktualisieren der Extra-Chats' });
  }

  // Optional: Lösche die zugehörige Chat-Datei, falls vorhanden
  const chatFilePath = path.join(chatsDir, chatFile);
  if (fs.existsSync(chatFilePath)) {
    try {
      fs.unlinkSync(chatFilePath);
    } catch (err) {
      console.error('Fehler beim Löschen der Chatdatei:', err);
    }
  }

  return res.json({ message: `Extra-Chat '${removedChat.name}' wurde gelöscht` });
});

// POST: Erstelle einen neuen Extra-Chat (max. 5 pro Bundesland, für alle Orgas)
app.post('/api/extra-chats/:bundesland', orgaAuth, (req, res) => {
  const bundesland = req.params.bundesland;
  // Der Check, ob das Orga-Bundesland übereinstimmt, wurde entfernt

  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Name des Extra-Chats fehlt.' });
  }

  let extraChats = readExtraChats();
  const chatsForLand = extraChats.filter(chat => chat.bundesland === bundesland);
  if (chatsForLand.length >= 5) {
    return res.status(400).json({ message: 'Maximal 5 Extra-Chats pro Bundesland erlaubt.' });
  }

  // Generiere einen eindeutigen Dateinamen für die Chat-Nachrichten
  const file = `extrachat_${bundesland}_${Date.now()}_${Math.floor(Math.random() * 1000)}.json`;


  // Erstelle leere Datei für Chat-Nachrichten
  fs.writeFileSync(path.join(chatsDir, file), JSON.stringify([]), 'utf8');

  const newChat = { bundesland, name, file };
  extraChats.push(newChat);
  writeExtraChats(extraChats);

  res.json({ message: 'Extra-Chat erstellt', chat: newChat });
});

// Endpunkte für Extra-Chat-Nachrichten (ähnlich wie /api/chats)
app.get('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });
  }
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Lesen des Extra-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Extra-Chats' });
  }
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

app.post('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }
  if (!req.user.isOrga) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
    const phoneRegex = /(\+?\d[\d\s\-]{7,}\d)/;
    if (emailRegex.test(message) || phoneRegex.test(message)) {
      return res.status(400).json({ message: 'Nachricht enthält unerlaubte Inhalte (Telefonnummer oder Email-Adresse)' });
    }
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
  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Extra-Chats', e);
  }
  const newMessage = {
    id: Date.now() + '_' + Math.floor(Math.random() * 1000),
    user: req.user.username,
    message,
    timestamp: new Date().toISOString(),
    pinned: false
  };
  if (req.user.isOrga) {
    newMessage.rank = `Organisator (${req.user.bundesland})`;
  } else if (req.user.isAdmin) {
    newMessage.rank = 'Admin';
  }
  chatData.push(newMessage);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

app.delete('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });
  }
  const { messageId } = req.body;
  if (!messageId) {
    return res.status(400).json({ message: 'messageId fehlt' });
  }
  let chatData;
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Extra-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Extra-Chats' });
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
  chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const limit = parseInt(req.query.limit, 10) || 20;
  if (req.query.olderThan) {
    const olderThanDate = new Date(req.query.olderThan);
    chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
  }
  chatData = chatData.slice(-limit);
  res.json(chatData);
});

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
    message,
    timestamp: new Date().toISOString(),
    pinned: false,
    bundesland: req.orga.bundesland
  };
  newMessage.rank = `Organisator (${req.orga.bundesland})`;
  chatData.push(newMessage);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

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
      image: req.file.filename,
      timestamp: new Date().toISOString(),
      pinned: false
    };
    newMessage.rank = `Organisator (${req.orga.bundesland})`;
    chatData.push(newMessage);
    writeJSON(orgaChatFile, chatData);
    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});

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
  pinned.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  res.json(pinned);
});

// Neuer Endpunkt: Organisatoren können ihre eigenen Nachrichten aus dem Orga-Chat löschen
app.delete('/api/orga/chats', orgaAuth, (req, res) => {
  const { messageId } = req.body;
  if (!messageId) {
    return res.status(400).json({ message: 'messageId fehlt' });
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
  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) {
    return res.status(404).json({ message: 'Nachricht nicht gefunden' });
  }
  const msg = chatData[index];
  if (msg.user !== req.orga.username) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }
  chatData.splice(index, 1);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

/* ---------------------------
   Neue Admin-Endpunkte für Orga-Konten
----------------------------*/
app.get('/api/admin/orgas', adminAuth, (req, res) => {
  const orgas = readJSON(orgaFile);
  res.json(orgas);
});

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
   Hilfsfunktion: Ermittelt den Anfragesteller für Bann-Requests.
   Prüft in folgender Reihenfolge:
   1. Organisator (orgas.json über Cookies)
   2. Admin (admins.json über Cookies)
   3. Normale Nutzer (users.json über Cookies) – diese werden später abgelehnt
   4. API Key (falls korrekt)
----------------------------*/
function getSender(req) {
  // Zuerst API Key prüfen – jetzt auch über den Header "x-api-key"
  const apiKey = (req.body.apiKey || req.query.apiKey || req.headers['x-api-key'] || "").trim();
  if (apiKey === API_KEY) {
    return { role: 'api', username: 'admin' };
  }
  // Organisator-Authentifizierung
  if (req.cookies.orgaUsername && req.cookies.orgaPassword) {
    let orgas = readJSON(orgaFile);
    let orga = orgas.find(o => o.username === req.cookies.orgaUsername && o.password === req.cookies.orgaPassword);
    if (orga) return { role: 'orga', username: orga.username };
  }
  // Admin-Authentifizierung
  if (req.cookies.username && req.cookies.password) {
    let admins = readJSON(adminsFile);
    let adminUser = admins.find(a => a.username === req.cookies.username && a.password === req.cookies.password);
    if (adminUser) return { role: 'admin', username: adminUser.username };
    // Falls der Benutzer nur in users.json steht, gilt er als normaler Nutzer (und darf keine Bann-Anfrage senden)
    let users = readJSON(usersFile);
    let normalUser = users.find(u => u.username === req.cookies.username && u.password === req.cookies.password);
    if (normalUser) return { role: 'normal', username: normalUser.username };
  }
  return null;
}

/* ---------------------------
   Hilfsfunktion: Löscht Nachrichten eines Nutzers in allen Chat-Dateien.
----------------------------*/
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

/* ---------------------------
   Neuer Endpunkt: Bann-Anfrage
   Angepasste Logik:
   - Organisatoren (orgas.json) dürfen ohne API Key bannen.
   - Falls nicht von Organisatoren, wird ein API Key geprüft.
   - Bann-Versuche von normalen Nutzern werden immer abgelehnt.
   - Wenn das Ziel ein Organisator ist, dürfen Admins bzw. API-Key-Anfragen das nicht bannen.
   - Selbstbann wird abgelehnt.
----------------------------*/
app.post('/api/admin/ban', (req, res) => {
  const sender = getSender(req);
  if (!sender) {
    return res.status(403).json({ message: 'Nicht berechtigt.' });
  }
  const targetUsername = req.body.username;
  if (!targetUsername) {
    return res.status(400).json({ message: 'Username fehlt.' });
  }
  // Normale Nutzer dürfen keine Bann-Anfragen senden
  if (sender.role === 'normal') {
    return res.status(403).json({ message: 'Normale Nutzer dürfen niemanden bannen.' });
  }
  
  // Suche Ziel in orgas.json, admins.json und users.json
  let target = null;
  let targetRole = null;
  const orgas = readJSON(orgaFile);
  const admins = readJSON(adminsFile);
  const users = readJSON(usersFile);
  
  target = orgas.find(o => o.username === targetUsername);
  if (target) {
    targetRole = 'orga';
  } else {
    target = admins.find(a => a.username === targetUsername);
    if (target) {
      targetRole = 'admin';
    } else {
      target = users.find(u => u.username === targetUsername);
      if (target) {
        targetRole = 'user';
      }
    }
  }
  
  if (!target) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  
  // Selbstbann verhindern
  if (sender.username === targetUsername) {
    return res.status(403).json({ message: 'Du kannst dich nicht selbst bannen.' });
  }
  
  // Falls der Anfragesteller kein Organisator ist, aber per API-Key oder Admin-Cookie agiert:
  // Admins bzw. API dürfen Organisatoren nicht bannen.
  if ((sender.role === 'admin' || sender.role === 'api') && targetRole === 'orga') {
    return res.status(403).json({ message: 'Admins oder API dürfen Organisatoren nicht bannen.' });
  }
  
  // Bann-Anfrage ist zulässig – setze "locked" auf true
  target.locked = true;
  
  // Speichere die Änderung in der entsprechenden Datei
  if (targetRole === 'orga') {
    const updatedOrgas = orgas.map(o => o.username === targetUsername ? target : o);
    writeJSON(orgaFile, updatedOrgas);
  } else if (targetRole === 'admin') {
    const updatedAdmins = admins.map(a => a.username === targetUsername ? target : a);
    writeJSON(adminsFile, updatedAdmins);
  } else if (targetRole === 'user') {
    const updatedUsers = users.map(u => u.username === targetUsername ? target : u);
    writeJSON(usersFile, updatedUsers);
  }
  
  deleteUserMessages(targetUsername);
  return res.json({ message: `${targetRole === 'orga' ? 'Organisator' : targetRole === 'admin' ? 'Admin' : 'Nutzer'} ${targetUsername} wurde gesperrt und alle Nachrichten wurden gelöscht` });
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
  ...Array.from({ length: 19 }, (_, i) => ({ name: `image${i + 1}`, maxCount: 1 }))
]), (req, res) => {
  const videoDir = path.join(__dirname, 'private', 'homepage', 'videos');
  const imagesDir = path.join(__dirname, 'private', 'homepage', 'images');
  if (!fs.existsSync(videoDir)) { fs.mkdirSync(videoDir, { recursive: true }); }
  if (!fs.existsSync(imagesDir)) { fs.mkdirSync(imagesDir, { recursive: true }); }
  
  const fileMapping = { video: 'video1.mp4' };
  for (let i = 1; i <= 19; i++) {
    fileMapping[`image${i}`] = `bild${i}.png`;
  }
  
  Object.entries(fileMapping).forEach(([field, targetFilename]) => {
    if (req.files && req.files[field]) {
      let targetDir;
      if (field === 'video') {
        targetDir = videoDir;
      } else if (field.startsWith('image')) {
        targetDir = imagesDir;
      }
      const targetPath = path.join(targetDir, targetFilename);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      const uploadedFile = req.files[field][0];
      fs.renameSync(uploadedFile.path, targetPath);
    }
  });
  res.json({ message: 'Medien erfolgreich aktualisiert' });
});

app.get('/api/media/video/:filename', (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(__dirname, 'private', 'homepage', 'videos', filename);
  if (fs.existsSync(videoPath)) {
    res.sendFile(videoPath);
  } else {
    res.status(404).json({ message: 'Video nicht gefunden' });
  }
});

app.get('/api/media/image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, 'private', 'homepage', 'images', filename);
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).json({ message: 'Bild nicht gefunden' });
  }
});

app.post('/api/admin/chats-lock', adminAuth, (req, res) => {
  const { lock } = req.body;
  if (typeof lock !== 'boolean') {
    return res.status(400).json({ message: 'Lock-Status als boolean erforderlich' });
  }
  chatsLocked = lock;
  res.json({ message: `Chats wurden ${lock ? 'gesperrt' : 'entsperrt'}` });
});

/* --------------------------------------
   Newsletter-Route: Hier wird der neue Newsletter-Rate Limiter verwendet
--------------------------------------*/
app.post('/newsletter/subscribe', newsletterLimiter, globalNewsletterLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Keine E-Mail-Adresse angegeben' });
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Ungültige E-Mail-Adresse' });
  }

  const emailFilePath = path.join(__dirname, 'private', 'emails.json');

  let emails = [];
  if (fs.existsSync(emailFilePath)) {
    try {
      emails = JSON.parse(fs.readFileSync(emailFilePath, 'utf8'));
    } catch (err) {
      console.error('Fehler beim Lesen der emails.json:', err);
    }
  }
  if (!Array.isArray(emails)) {
    emails = [];
  }
  if (!emails.includes(email)) {
    emails.push(email);
    fs.writeFileSync(emailFilePath, JSON.stringify(emails, null, 2), 'utf8');
  }
  return res.json({ message: 'E-Mail erfolgreich hinzugefügt' });
});

// --------------------------------------
// Admin-Route, um alle Newsletter-E-Mails abzufragen
app.get('/api/admin/newsletter-emails', adminAuth, (req, res) => {
  const emailFilePath = path.join(__dirname, 'private', 'emails.json');
  if (!fs.existsSync(emailFilePath)) {
    return res.json([]);
  }
  try {
    const emails = JSON.parse(fs.readFileSync(emailFilePath, 'utf8'));
    if (!Array.isArray(emails)) {
      return res.json([]);
    }
    return res.json(emails);
  } catch (err) {
    console.error('Fehler beim Lesen der emails.json:', err);
    return res.status(500).json({ message: 'Fehler beim Lesen der E-Mail-Datei' });
  }
});

/* ---------------------------
   Neuer Impressum-Endpunkt
----------------------------*/
const impressumFile = path.join(privateDir, 'impressum.json');

app.get('/api/impressum', (req, res) => {
  if (fs.existsSync(impressumFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(impressumFile, 'utf8'));
      return res.json(data);
    } catch (err) {
      console.error("Fehler beim Lesen der Impressum-Datei", err);
      return res.status(500).json({ message: 'Fehler beim Lesen der Impressum-Datei' });
    }
  } else {
    return res.status(404).json({ message: 'Impressum nicht gefunden' });
  }
});

app.post('/api/impressum', (req, res) => {
  const apiKey = (req.body.apiKey || req.query.apiKey || "").trim();
  if (apiKey !== API_KEY) {
    return res.status(403).json({ message: 'Ungültiger API Key' });
  }
  const { Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email } = req.body;
  if (!Vorname || !Nachname || !Adresse || !Adresszusatz || !Stadt || !Email) {
    return res.status(400).json({ message: 'Alle Felder (Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email) sind erforderlich' });
  }
  const impressumData = { Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email };
  try {
    fs.writeFileSync(impressumFile, JSON.stringify(impressumData, null, 2), 'utf8');
    return res.json({ message: 'Impressum erfolgreich aktualisiert', data: impressumData });
  } catch (err) {
    console.error("Fehler beim Schreiben der Impressum-Datei", err);
    return res.status(500).json({ message: 'Fehler beim Aktualisieren der Impressum-Datei' });
  }
});

// ---------------------------
// Neuer Bugreport-Endpunkt mit validierter, strukturierter Eingabe
app.post('/bugreport', (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  
  // Rate Limiting: maximal 1 Bugreport pro IP pro Stunde
  if (bugReportIPData[ip] && now - bugReportIPData[ip] < 60 * 60 * 1000) {
    return res.status(429).json({ message: 'Pro IP ist nur ein Bugreport pro Stunde erlaubt.' });
  }
  
  // Erwartet wird ein Objekt unter req.body.report
  const reportData = req.body.report;
  if (typeof reportData !== 'object' || reportData === null) {
    return res.status(400).json({ message: 'Ungültiger Bugreport-Inhalt.' });
  }
  
  // Fehlerbereich validieren
  const allowedAreas = ['login', 'registration', 'chat', 'orga', 'homepage', 'newsletter'];
  if (!reportData.errorArea || !allowedAreas.includes(reportData.errorArea)) {
    return res.status(400).json({ message: 'Ungültiger oder fehlender Fehlerbereich.' });
  }
  
  // Es muss ein "details"-Objekt mit einer "description" (max. 250 Zeichen) vorhanden sein.
  if (!reportData.details || typeof reportData.details.description !== 'string') {
    return res.status(400).json({ message: 'Fehlerbeschreibung fehlt.' });
  }
  if (reportData.details.description.length > 250) {
    return res.status(400).json({ message: 'Die Fehlerbeschreibung darf maximal 250 Zeichen lang sein.' });
  }
  
  // Aktualisiere den letzten Report-Timestamp für diese IP
  bugReportIPData[ip] = now;
  
  // Lade bestehende Reports und füge den neuen strukturierten Report hinzu
  let reports = readJSON(reportsFile);
  const newReport = {
    id: Date.now() + '_' + Math.floor(Math.random() * 1000),
    ip,
    timestamp: new Date().toISOString(),
    errorArea: reportData.errorArea,
    details: reportData.details
  };
  reports.push(newReport);
  writeJSON(reportsFile, reports);
  
  res.json({ message: 'Bugreport erfolgreich übermittelt', report: newReport });
});

// ---------------------------
// Neuer Endpunkt: Alles exportieren als ZIP
// Dieser Endpunkt wird ausschließlich über den API Key aufgerufen.
app.get('/api/export-all', (req, res) => {
  const apiKey = (req.body.apiKey || req.query.apiKey || "").trim();
  if (apiKey !== API_KEY) {
    return res.status(403).json({ message: 'Ungültiger API Key' });
  }
  
  res.attachment('export.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => res.status(500).send({ error: err.message }));
  archive.pipe(res);
  
  // Füge alle relevanten Dateien hinzu:
  if (fs.existsSync(reportsFile)) archive.file(reportsFile, { name: 'reports.json' });
  if (fs.existsSync(usersFile)) archive.file(usersFile, { name: 'users.json' });
  if (fs.existsSync(adminsFile)) archive.file(adminsFile, { name: 'admins.json' });
  if (fs.existsSync(orgaFile)) archive.file(orgaFile, { name: 'orgas.json' });
  if (fs.existsSync(requestAccessFile)) archive.file(requestAccessFile, { name: 'request_access.json' });
  const emailFilePath = path.join(__dirname, 'private', 'emails.json');
  if (fs.existsSync(emailFilePath)) archive.file(emailFilePath, { name: 'emails.json' });
  
  // Füge alle Chat-Dateien hinzu, inklusive Bilder aus den Chats
  const chatFiles = fs.readdirSync(chatsDir).filter(file => file.endsWith('.json'));
  chatFiles.forEach(file => {
    const chatFilePath = path.join(chatsDir, file);
    archive.file(chatFilePath, { name: 'chats/' + file });
    // Prüfe, ob in der Chat-Datei Bildreferenzen vorhanden sind
    try {
      const chatData = JSON.parse(fs.readFileSync(chatFilePath, 'utf8'));
      chatData.forEach(msg => {
        if (msg.image) {
          const imagePath = path.join(picturesDir, msg.image);
          if (fs.existsSync(imagePath)) {
            archive.file(imagePath, { name: 'chat_images/' + msg.image });
          }
        }
      });
    } catch (err) {
      console.error('Fehler beim Auslesen von', file, err);
    }
  });
  
  archive.finalize();
});

// GET: Lade den aktuellen Presseinhalt
app.get('/api/presse', (req, res) => {
  if (fs.existsSync(presseFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(presseFile, 'utf8'));
      return res.json(data);
    } catch (err) {
      console.error("Fehler beim Lesen der Presse-Datei:", err);
      return res.status(500).json({ message: 'Fehler beim Lesen der Presse-Datei' });
    }
  } else {
    // Standardwerte, falls die Datei noch nicht existiert
    return res.json({
      leftText: "Hier steht der linke Presseinhalt.",
      rightText: "Hier steht der rechte Presseinhalt.",
      mail: "Patrick-grossdemo@web.de"
    });
  }
});

// POST: Speichere Änderungen (nur für Orga)
app.post('/api/presse', orgaAuth, (req, res) => {
  const { leftText, rightText, mail } = req.body;
  if (!leftText || !rightText || !mail) {
    return res.status(400).json({ message: 'Alle Felder (leftText, rightText, mail) sind erforderlich.' });
  }
  const presseData = { leftText, rightText, mail };
  try {
    fs.writeFileSync(presseFile, JSON.stringify(presseData, null, 2), 'utf8');
    return res.json({ message: 'Presse-Inhalt erfolgreich aktualisiert', data: presseData });
  } catch (err) {
    console.error("Fehler beim Schreiben der Presse-Datei:", err);
    return res.status(500).json({ message: 'Fehler beim Aktualisieren der Presse-Datei' });
  }
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});