const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');

// ===== KONFIGURATION =====
app.set('trust proxy', 1);
const PORT = 3000;
const API_KEY = "QjT6CoRwXS";

// ===== KOMPRESSION KOMPLETT DEAKTIVIEREN =====
app.use((req, res, next) => {
  // Alle Kompression-Headers entfernen
  res.removeHeader('Content-Encoding');
  res.removeHeader('Transfer-Encoding');
  
  // Explizit keine Kompression
  res.set('Content-Encoding', 'identity');
  
  // Für API-Routen spezielle Headers
  if (req.path.startsWith('/api/')) {
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  
  next();
});

// Deaktiviere Express automatische Kompression falls vorhanden
app.disable('etag');
app.disable('x-powered-by');

// ===== GLOBALE VARIABLEN =====
let chatsLocked = true;
let bugReportIPData = {};
const userMessageTimestamps = {};

// ===== MIDDLEWARE SETUP =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===== RATE LIMITERS =====
const globalAccountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  keyGenerator: () => 'global_account',
  message: { message: 'Account-Endpunkt ist vorübergehend wegen hoher Auslastung gesperrt.' }
});

const accountLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.ip,
  message: { message: 'Zu viele Anfragen von dieser IP. Maximal 5 pro Minute erlaubt.' }
});

const accountFiveMinLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { message: 'Ihre IP wurde wegen verdächtiger Aktivität blockiert.' }
});

const globalNewsletterLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: () => 'global_newsletter',
  message: { message: 'Newsletter-Endpunkt ist vorübergehend wegen hoher Auslastung gesperrt.' }
});

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => req.ip,
  message: { message: 'Sie können nur eine E-Mail pro Stunde absenden.' }
});

// ===== VERZEICHNIS SETUP =====
const privateDir = path.join(__dirname, 'private');
const chatsDir = path.join(privateDir, 'bundes_chats');
const picturesDir = path.join(privateDir, 'pictures');
const reportsDir = path.join(privateDir, 'reports');
const tempUploadsDir = path.join(__dirname, 'temp_uploads');

// Verzeichnisse erstellen
[privateDir, chatsDir, picturesDir, reportsDir, tempUploadsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ===== DATEIPFADE =====
const files = {
  users: path.join(privateDir, 'users.json'),
  admins: path.join(privateDir, 'admins.json'),
  orgas: path.join(privateDir, 'orgas.json'),
  requestAccess: path.join(privateDir, 'request_access.json'),
  reports: path.join(reportsDir, 'reports.json'),
  extraChats: path.join(chatsDir, 'extrachats.json'),
  emails: path.join(privateDir, 'emails.json'),
  impressum: path.join(privateDir, 'impressum.json'),
  presse: path.join(privateDir, 'presse.json')
};

// ===== HILFSFUNKTIONEN =====
function readJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8').trim();
      return data ? JSON.parse(data) : [];
    }
    return [];
  } catch (err) {
    console.error("Fehler beim Lesen von", filePath, err);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    // Stelle sicher dass data ein Array ist
    if (!Array.isArray(data)) {
      console.error('writeJSON: Data ist kein Array:', typeof data);
      return;
    }
    
    // Erstelle Backup vor dem Schreiben
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.backup';
      try {
        fs.copyFileSync(filePath, backupPath);
      } catch (backupError) {
        console.warn('Konnte kein Backup erstellen:', backupError);
      }
    }
    
    // Schreibe neue Datei
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');
    
    // Verifiziere dass die geschriebene Datei gültig ist
    try {
      const verification = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(verification)) {
        throw new Error('Geschriebene Datei ist kein Array');
      }
    } catch (verifyError) {
      console.error('Verification failed für', filePath, verifyError);
      
      // Restore backup
      const backupPath = filePath + '.backup';
      if (fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, filePath);
          console.log('Backup wiederhergestellt für', filePath);
        } catch (restoreError) {
          console.error('Konnte Backup nicht wiederherstellen:', restoreError);
        }
      }
    }
  } catch (err) {
    console.error("Fehler beim Schreiben in", filePath, err);
  }
}

function deleteUserMessages(username) {
  try {
    const chatFiles = fs.readdirSync(chatsDir).filter(file => file.endsWith('.json'));
    chatFiles.forEach(file => {
      const filePath = path.join(chatsDir, file);
      let chatData = [];
      try {
        chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const filtered = chatData.filter(msg => msg.user !== username);
        fs.writeFileSync(filePath, JSON.stringify(filtered, null, 2), 'utf8');
      } catch (err) {
        console.error("Fehler beim Filtern der Datei", filePath, err);
      }
    });
  } catch (err) {
    console.error("Fehler beim Löschen der Nachrichten für", username, err);
  }
}

function getSender(req) {
  const apiKey = (req.body.apiKey || req.query.apiKey || req.headers['x-api-key'] || "").trim();
  if (apiKey === API_KEY) return { role: 'api', username: 'admin' };

  if (req.cookies.orgaUsername && req.cookies.orgaPassword) {
    const orgas = readJSON(files.orgas);
    const orga = orgas.find(o => o.username === req.cookies.orgaUsername && o.password === req.cookies.orgaPassword);
    if (orga) return { role: 'orga', username: orga.username };
  }

  if (req.cookies.username && req.cookies.password) {
    const admins = readJSON(files.admins);
    const adminUser = admins.find(a => a.username === req.cookies.username && a.password === req.cookies.password);
    if (adminUser) return { role: 'admin', username: adminUser.username };

    const users = readJSON(files.users);
    const normalUser = users.find(u => u.username === req.cookies.username && u.password === req.cookies.password);
    if (normalUser) return { role: 'normal', username: normalUser.username };
  }
  return null;
}

function removeDisallowedMessages(filePath, chatData) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const phoneRegex = /(\+?\d[\d\s\-]{7,}\d)/;
  const cleaned = chatData.filter(msg => {
    if (msg.rank && msg.rank.startsWith("Organisator")) return true;
    if (msg.message && (emailRegex.test(msg.message) || phoneRegex.test(msg.message))) return false;
    return true;
  });
  if (cleaned.length !== chatData.length) writeJSON(filePath, cleaned);
  return cleaned;
}

// ===== MULTER KONFIGURATION =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, picturesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const randomName = Date.now() + '_' + Math.floor(Math.random() * 1000) + ext;
    cb(null, randomName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if ((req.user && req.user.isAdmin) || req.orga) {
      cb(null, true);
    } else {
      cb(new Error('Nur Admins oder Organisatoren dürfen Bilder hochladen'), false);
    }
  }
});

const mediaUploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tempUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000) + ext);
  }
});
const mediaUpload = multer({ storage: mediaUploadStorage });

// ===== AUTHENTIFIZIERUNGS-MIDDLEWARE =====
function authMiddleware(req, res, next) {
  const { username, password } = req.cookies;
  if (username && password) {
    let users = readJSON(files.users);
    let user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      let admins = readJSON(files.admins);
      let adminUser = admins.find(a => a.username === username && a.password === password);
      if (adminUser) {
        adminUser.isAdmin = true;
        user = adminUser;
      }
    }
    if (user) {
      if (user.locked) return res.status(403).json({ message: 'Account gesperrt' });
      req.user = user;
      return next();
    }
  }

  const { orgaUsername, orgaPassword } = req.cookies;
  if (orgaUsername && orgaPassword) {
    const orgas = readJSON(files.orgas);
    const orga = orgas.find(o => o.username === orgaUsername && o.password === orgaPassword);
    if (orga) {
      req.user = { username: orga.username, isAdmin: true, isOrga: true, bundesland: orga.bundesland };
      return next();
    }
    return res.status(401).json({ message: 'Ungültige Organisator-Zugangsdaten' });
  }
  return res.status(401).json({ message: 'Nicht eingeloggt' });
}

function adminAuth(req, res, next) {
  const { username, password } = req.cookies;
  if (username && password) {
    let users = readJSON(files.users);
    let user = users.find(u => u.username === username && u.password === password);
    if (!user) {
      let admins = readJSON(files.admins);
      user = admins.find(a => a.username === username && a.password === password);
      if (user) user.isAdmin = true;
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

function orgaAuth(req, res, next) {
  const { orgaUsername, orgaPassword } = req.cookies;
  if (!orgaUsername || !orgaPassword) {
    return res.status(401).json({ message: 'Nicht als Organisator eingeloggt' });
  }
  const orgas = readJSON(files.orgas);
  const orga = orgas.find(o => o.username === orgaUsername && o.password === orgaPassword);
  if (!orga) {
    return res.status(401).json({ message: 'Ungültige Organisator-Zugangsdaten' });
  }
  req.orga = orga;
  next();
}

// ===== STATISCHE DATEIEN =====
app.use(express.static(path.join(__dirname, 'public'), { index: 'main.html' }));
app.use('/pictures', express.static(picturesDir));

// ===== BENUTZER-ENDPUNKTE =====
app.get('/api/userinfo', authMiddleware, (req, res) => {
  const info = { username: req.user.username, isAdmin: req.user.isAdmin };
  if (req.user.isOrga) {
    info.rank = 'Organisator';
    info.bundesland = req.user.bundesland;
  }
  res.json(info);
});

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

  const users = readJSON(files.users);
  user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    const admins = readJSON(files.admins);
    user = admins.find(a => a.username === username && a.password === password);
    if (user) {
      user.isAdmin = true;
      source = 'admin';
    }
  }

  if (!user) {
    const orgas = readJSON(files.orgas);
    user = orgas.find(o => o.username === username && o.password === password);
    if (user) {
      user.isOrga = true;
      source = 'orga';
    }
  }

  if (user) {
    if (user.locked) return res.status(403).json({ message: 'Account gesperrt' });
    if (source === 'orga') {
      res.cookie('orgaUsername', username, { httpOnly: true });
      res.cookie('orgaPassword', password, { httpOnly: true });
      return res.json({ message: 'Organisator erfolgreich eingeloggt', isAdmin: true, isOrga: true, bundesland: user.bundesland });
    } else {
      res.cookie('username', username, { httpOnly: true });
      res.cookie('password', password, { httpOnly: true });
      return res.json({ message: 'Erfolgreich eingeloggt', isAdmin: !!user.isAdmin });
    }
  }
  return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
});

app.post('/api/orga/login', accountLimiter, accountFiveMinLimiter, globalAccountLimiter, (req, res) => {
  const { username, password } = req.body;
  const orgas = readJSON(files.orgas);
  const orga = orgas.find(o => o.username === username && o.password === password);
  if (!orga) return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  res.cookie('orgaUsername', username, { httpOnly: true });
  res.cookie('orgaPassword', password, { httpOnly: true });
  res.json({ message: 'Organisator erfolgreich eingeloggt' });
});

app.post('/api/signup', accountLimiter, accountFiveMinLimiter, globalAccountLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username und Passwort erforderlich' });
  }

  if (username.length > 20 || password.length > 20) {
    return res.status(400).json({ message: 'Username und Passwort dürfen maximal 20 Zeichen lang sein.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  const normalizedUsername = username.toLowerCase().replace(/[\W_]+/g, '');
  const bannedWords = ['fuck', 'nigger', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'whore', 'slut', 'fag', 'motherfucker'];

  if (bannedWords.some(word => normalizedUsername.includes(word))) {
    return res.status(400).json({ message: 'Der Benutzername enthält unzulässige Wörter.' });
  }

  const pending = readJSON(files.requestAccess);
  const users = readJSON(files.users);
  const admins = readJSON(files.admins);

  if (pending.find(u => u.username === username) || users.find(u => u.username === username) || admins.find(a => a.username === username)) {
    return res.status(400).json({ message: 'Benutzer existiert bereits' });
  }

  pending.push({ username, password, requestedAt: new Date().toISOString() });
  writeJSON(files.requestAccess, pending);
  res.json({ message: 'Anfrage wurde gesendet. Bitte warten Sie auf die Freigabe.' });
});

// ===== CHAT-ENDPUNKTE - VERBESSERT =====
app.get('/api/channels', authMiddleware, (req, res) => {
  fs.readdir(chatsDir, (err, files) => {
    if (err) return res.status(500).json({ message: 'Fehler beim Lesen der Chat-Dateien' });
    let channels = files.filter(file => file.endsWith('.json')).map(file => path.basename(file, '.json'));
    if (!req.user.isAdmin) channels = channels.filter(ch => ch !== 'Admin_chat');
    channels = channels.filter(ch => ch !== 'orga_chat');
    res.json(channels);
  });
});

app.get('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  
  // Zugriffskontrolle
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  if (chatName === 'orga_chat') {
    return res.status(403).json({ message: 'Kein Zugriff auf Orga Chat. Bitte als Organisator einloggen.' });
  }

  const filePath = path.join(chatsDir, chatName + '.json');
  
  // Prüfe ob Datei existiert
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Chat nicht gefunden' });
  }

  let chatData = [];
  try {
    // Lese Datei mit Error-Handling
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (!fileContent.trim()) {
      // EXPLIZIT JSON HEADERS SETZEN
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Content-Encoding', 'identity');
      return res.json([]);
    }

    try {
      chatData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`JSON Parse Fehler in ${chatName}:`, parseError.message);
      
      // Versuche die Datei zu reparieren - mehrere Arrays kombinieren
      try {
        const arrayMatches = fileContent.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g);
        if (arrayMatches && arrayMatches.length > 1) {
          let combinedData = [];
          arrayMatches.forEach(match => {
            try {
              const parsed = JSON.parse(match);
              if (Array.isArray(parsed)) {
                combinedData = combinedData.concat(parsed);
              }
            } catch (e) {
              // Silent fail für einzelne Arrays
            }
          });
          
          // Schreibe reparierte Datei zurück
          writeJSON(filePath, combinedData);
          chatData = combinedData;
        } else {
          throw parseError;
        }
      } catch (repairError) {
        console.error(`Chat-Datei ${chatName} nicht reparierbar:`, repairError.message);
        // EXPLIZIT JSON HEADERS SETZEN
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Content-Encoding', 'identity');
        return res.status(500).json({ message: 'Chat-Datei beschädigt und nicht reparierbar' });
      }
    }

    // Entferne unerlaubte Nachrichten
    chatData = removeDisallowedMessages(filePath, chatData);
    
    // Sortiere nach Timestamp
    chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Filter für ältere Nachrichten
    if (req.query.olderThan) {
      const olderThanDate = new Date(req.query.olderThan);
      chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
    }
    
    // Limit anwenden
    if (req.query.limit) {
      const limit = parseInt(req.query.limit, 10);
      if (!isNaN(limit) && limit > 0) {
        chatData = chatData.slice(-limit);
      }
    }

    // EXPLIZIT JSON HEADERS SETZEN BEVOR ANTWORT
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Encoding', 'identity');
    res.set('Content-Length', Buffer.byteLength(JSON.stringify(chatData)));
    
    res.json(chatData);

  } catch (error) {
    console.error(`Fehler beim Lesen des Chats ${chatName}:`, error);
    // EXPLIZIT JSON HEADERS SETZEN
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Encoding', 'identity');
    res.status(500).json({ message: 'Fehler beim Lesen des Chats' });
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
  if (!message) return res.status(400).json({ message: 'Nachricht fehlt' });

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
    if (!userMessageTimestamps[req.user.username]) userMessageTimestamps[req.user.username] = [];
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
    if (err) return res.status(403).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Kein Bild hochgeladen' });

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
  if (!messageId) return res.status(400).json({ message: 'messageId fehlt' });

  const filePath = path.join(chatsDir, chatName + '.json');
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Chat nicht gefunden' });

  let chatData;
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Chats' });
  }

  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) return res.status(404).json({ message: 'Nachricht nicht gefunden' });

  const msg = chatData[index];
  if (msg.user !== req.user.username && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }

  chatData.splice(index, 1);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

// ===== ORGANISATOR CHAT-ENDPUNKTE =====
app.get('/api/orga/chats', orgaAuth, (req, res) => {
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) return res.json([]);

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
  if (!message) return res.status(400).json({ message: 'Nachricht fehlt' });

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
    bundesland: req.orga.bundesland,
    rank: `Organisator (${req.orga.bundesland})`
  };

  chatData.push(newMessage);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gesendet', newMessage });
});

app.post('/api/orga/chats/image', orgaAuth, (req, res) => {
  upload.single('image')(req, res, function(err) {
    if (err) return res.status(403).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Kein Bild hochgeladen' });

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
      pinned: false,
      rank: `Organisator (${req.orga.bundesland})`
    };

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
  if (!fs.existsSync(orgaChatFile)) return res.status(404).json({ message: 'Orga-Chat nicht gefunden' });

  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Orga-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Orga-Chats' });
  }

  const msg = chatData.find(m => m.id === messageId);
  if (!msg) return res.status(404).json({ message: 'Nachricht nicht gefunden' });

  msg.pinned = pin;
  writeJSON(orgaChatFile, chatData);
  res.json({ message: `Nachricht ${pin ? 'angepinnt' : 'abgelöst'}` });
});

app.get('/api/orga/chats/pinned', orgaAuth, (req, res) => {
  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) return res.json([]);

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
  if (!messageId) return res.status(400).json({ message: 'messageId fehlt' });

  const orgaChatFile = path.join(chatsDir, 'orga_chat.json');
  if (!fs.existsSync(orgaChatFile)) return res.status(404).json({ message: 'Orga-Chat nicht gefunden' });

  let chatData = [];
  try {
    chatData = JSON.parse(fs.readFileSync(orgaChatFile, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Orga-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Orga-Chats' });
  }

  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) return res.status(404).json({ message: 'Nachricht nicht gefunden' });

  const msg = chatData[index];
  if (msg.user !== req.orga.username) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }

  chatData.splice(index, 1);
  writeJSON(orgaChatFile, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

// ===== EXTRA-CHAT ENDPUNKTE =====
function readExtraChats() {
  if (!fs.existsSync(files.extraChats)) return [];
  try {
    const data = fs.readFileSync(files.extraChats, 'utf8').trim();
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Fehler beim Lesen von extrachats.json", err);
    return [];
  }
}

function writeExtraChats(data) {
  try {
    fs.writeFileSync(files.extraChats, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Fehler beim Schreiben von extrachats.json", err);
  }
}

app.get('/api/extra-chats/:bundesland', authMiddleware, (req, res) => {
  const bundesland = req.params.bundesland;
  const extraChats = readExtraChats().filter(chat => chat.bundesland === bundesland);
  res.json(extraChats);
});

app.post('/api/extra-chats/:bundesland', orgaAuth, (req, res) => {
  const bundesland = req.params.bundesland;
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name des Extra-Chats fehlt.' });

  let extraChats = readExtraChats();
  const chatsForLand = extraChats.filter(chat => chat.bundesland === bundesland);
  if (chatsForLand.length >= 5) {
    return res.status(400).json({ message: 'Maximal 5 Extra-Chats pro Bundesland erlaubt.' });
  }

  const file = `extrachat_${bundesland}_${Date.now()}_${Math.floor(Math.random() * 1000)}.json`;
  fs.writeFileSync(path.join(chatsDir, file), JSON.stringify([]), 'utf8');

  const newChat = { bundesland, name, file };
  extraChats.push(newChat);
  writeExtraChats(extraChats);
  res.json({ message: 'Extra-Chat erstellt', chat: newChat });
});

app.delete('/api/extra-chats/:chatFile', orgaAuth, (req, res) => {
  const chatFile = req.params.chatFile;
  let extraChats = readExtraChats();

  const chatIndex = extraChats.findIndex(chat => chat.file === chatFile);
  if (chatIndex === -1) return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });

  const removedChat = extraChats.splice(chatIndex, 1)[0];
  writeExtraChats(extraChats);

  const chatFilePath = path.join(chatsDir, chatFile);
  if (fs.existsSync(chatFilePath)) {
    try {
      fs.unlinkSync(chatFilePath);
    } catch (err) {
      console.error('Fehler beim Löschen der Chatdatei:', err);
    }
  }
  res.json({ message: `Extra-Chat '${removedChat.name}' wurde gelöscht` });
});

app.get('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });

  let chatData = [];
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    if (!fileContent.trim()) {
      // EXPLIZIT JSON HEADERS SETZEN
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.set('Content-Encoding', 'identity');
      return res.json([]);
    }
    
    try {
      chatData = JSON.parse(fileContent);
    } catch (parseError) {
      console.error(`JSON Parse Fehler in Extra-Chat ${chatFile}:`, parseError);
      
      // Versuche Reparatur wie bei normalen Chats
      try {
        const arrayMatches = fileContent.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/g);
        if (arrayMatches && arrayMatches.length > 1) {
          console.log(`Repariere Extra-Chat ${chatFile} mit ${arrayMatches.length} Arrays`);
          let combinedData = [];
          arrayMatches.forEach(match => {
            try {
              const parsed = JSON.parse(match);
              if (Array.isArray(parsed)) {
                combinedData = combinedData.concat(parsed);
              }
            } catch (e) {
              console.warn('Konnte Array nicht parsen:', e);
            }
          });
          
          writeJSON(filePath, combinedData);
          chatData = combinedData;
          console.log(`Extra-Chat ${chatFile} erfolgreich repariert`);
        } else {
          throw parseError;
        }
      } catch (repairError) {
        console.error(`Konnte Extra-Chat ${chatFile} nicht reparieren:`, repairError);
        // EXPLIZIT JSON HEADERS SETZEN
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.set('Content-Encoding', 'identity');
        return res.status(500).json({ message: 'Extra-Chat-Datei beschädigt' });
      }
    }
  } catch (e) {
    console.error('Fehler beim Lesen des Extra-Chats', e);
    // EXPLIZIT JSON HEADERS SETZEN
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Encoding', 'identity');
    return res.status(500).json({ message: 'Fehler beim Lesen des Extra-Chats' });
  }

  chatData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (req.query.olderThan) {
    const olderThanDate = new Date(req.query.olderThan);
    chatData = chatData.filter(msg => new Date(msg.timestamp) < olderThanDate);
  }
  if (req.query.limit) {
    const limit = parseInt(req.query.limit, 10);
    if (!isNaN(limit) && limit > 0) chatData = chatData.slice(-limit);
  }
  
  // EXPLIZIT JSON HEADERS SETZEN BEVOR ANTWORT
  res.set('Content-Type', 'application/json; charset=utf-8');
  res.set('Content-Encoding', 'identity');
  res.set('Content-Length', Buffer.byteLength(JSON.stringify(chatData)));
  
  res.json(chatData);
});

app.post('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }

  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ message: 'Nachricht fehlt' });

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
    if (!userMessageTimestamps[req.user.username]) userMessageTimestamps[req.user.username] = [];
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

app.post('/api/extra-chats/messages/image/:chatFile', authMiddleware, (req, res) => {
  if (chatsLocked && !req.user.isAdmin && !req.user.isOrga) {
    return res.status(403).json({ message: 'Chats sind gesperrt' });
  }

  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });

  upload.single('image')(req, res, function(err) {
    if (err) return res.status(403).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Kein Bild hochgeladen' });

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

app.delete('/api/extra-chats/messages/:chatFile', authMiddleware, (req, res) => {
  const chatFile = req.params.chatFile;
  const filePath = path.join(chatsDir, chatFile);
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Extra-Chat nicht gefunden' });

  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ message: 'messageId fehlt' });

  let chatData;
  try {
    chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Fehler beim Parsen des Extra-Chats', e);
    return res.status(500).json({ message: 'Fehler beim Lesen des Extra-Chats' });
  }

  const index = chatData.findIndex(msg => msg.id === messageId);
  if (index === -1) return res.status(404).json({ message: 'Nachricht nicht gefunden' });

  const msg = chatData[index];
  if (msg.user !== req.user.username && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }

  chatData.splice(index, 1);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

// ===== ADMIN-ENDPUNKTE =====
app.get('/api/reports', adminAuth, (req, res) => {
  if (!fs.existsSync(files.reports)) return res.json([]);
  try {
    const reports = JSON.parse(fs.readFileSync(files.reports, 'utf8'));
    res.json(reports);
  } catch (err) {
    console.error('Fehler beim Lesen der Reports:', err);
    res.status(500).json({ message: 'Fehler beim Laden der Reports' });
  }
});

app.get('/api/admin/orgas', adminAuth, (req, res) => {
  const orgas = readJSON(files.orgas);
  res.json(orgas);
});

app.post('/api/admin/orgas/create', adminAuth, (req, res) => {
  const { username, password, bundesland } = req.body;
  if (!username || !password || !bundesland) {
    return res.status(400).json({ message: 'Alle Felder (Username, Passwort, Bundesland) sind erforderlich' });
  }

  let orgas = readJSON(files.orgas);
  if (orgas.find(o => o.username === username)) {
    return res.status(400).json({ message: 'Ein Orga-Konto mit diesem Benutzernamen existiert bereits' });
  }

  orgas.push({ username, password, bundesland });
  writeJSON(files.orgas, orgas);
  res.json({ message: 'Orga-Konto erfolgreich erstellt' });
});

app.put('/api/admin/orgas/:username', adminAuth, (req, res) => {
  const targetUsername = req.params.username;
  const { password, bundesland } = req.body;
  let orgas = readJSON(files.orgas);
  const orga = orgas.find(o => o.username === targetUsername);
  if (!orga) return res.status(404).json({ message: 'Orga-Konto nicht gefunden' });

  if (password) orga.password = password;
  if (bundesland) orga.bundesland = bundesland;
  writeJSON(files.orgas, orgas);
  res.json({ message: 'Orga-Konto erfolgreich aktualisiert' });
});

app.delete('/api/admin/orgas/:username', adminAuth, (req, res) => {
  const targetUsername = req.params.username;
  let orgas = readJSON(files.orgas);
  const newOrgas = orgas.filter(o => o.username !== targetUsername);
  if (newOrgas.length === orgas.length) {
    return res.status(404).json({ message: 'Orga-Konto nicht gefunden' });
  }
  writeJSON(files.orgas, newOrgas);
  res.json({ message: 'Orga-Konto erfolgreich gelöscht' });
});

app.get('/api/admin/newsletter-emails', adminAuth, (req, res) => {
  if (!fs.existsSync(files.emails)) return res.json([]);
  try {
    const emails = JSON.parse(fs.readFileSync(files.emails, 'utf8'));
    res.json(Array.isArray(emails) ? emails : []);
  } catch (err) {
    console.error('Fehler beim Lesen der emails.json:', err);
    res.status(500).json({ message: 'Fehler beim Lesen der E-Mail-Datei' });
  }
});

app.post('/api/admin/ban', (req, res) => {
  const sender = getSender(req);
  if (!sender) return res.status(403).json({ message: 'Nicht berechtigt.' });

  const targetUsername = req.body.username;
  if (!targetUsername) return res.status(400).json({ message: 'Username fehlt.' });

  if (sender.role === 'normal') {
    return res.status(403).json({ message: 'Normale Nutzer dürfen niemanden bannen.' });
  }

  let target = null;
  let targetRole = null;
  const orgas = readJSON(files.orgas);
  const admins = readJSON(files.admins);
  const users = readJSON(files.users);

  target = orgas.find(o => o.username === targetUsername);
  if (target) {
    targetRole = 'orga';
  } else {
    target = admins.find(a => a.username === targetUsername);
    if (target) {
      targetRole = 'admin';
    } else {
      target = users.find(u => u.username === targetUsername);
      if (target) targetRole = 'user';
    }
  }

  if (!target) return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  if (sender.username === targetUsername) {
    return res.status(403).json({ message: 'Du kannst dich nicht selbst bannen.' });
  }
  if ((sender.role === 'admin' || sender.role === 'api') && targetRole === 'orga') {
    return res.status(403).json({ message: 'Admins oder API dürfen Organisatoren nicht bannen.' });
  }

  target.locked = true;

  if (targetRole === 'orga') {
    const updatedOrgas = orgas.map(o => o.username === targetUsername ? target : o);
    writeJSON(files.orgas, updatedOrgas);
  } else if (targetRole === 'admin') {
    const updatedAdmins = admins.map(a => a.username === targetUsername ? target : a);
    writeJSON(files.admins, updatedAdmins);
  } else if (targetRole === 'user') {
    const updatedUsers = users.map(u => u.username === targetUsername ? target : u);
    writeJSON(files.users, updatedUsers);
  }

  deleteUserMessages(targetUsername);
  res.json({ message: `${targetRole === 'orga' ? 'Organisator' : targetRole === 'admin' ? 'Admin' : 'Nutzer'} ${targetUsername} wurde gesperrt und alle Nachrichten wurden gelöscht` });
});

app.post('/api/admin/unban', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });

  let users = readJSON(files.users);
  let target = users.find(u => u.username === username);
  let targetIsAdmin = false;

  if (!target) {
    let admins = readJSON(files.admins);
    target = admins.find(a => a.username === username);
    if (target) targetIsAdmin = true;
  }

  if (!target) return res.status(404).json({ message: 'Nutzer nicht gefunden' });

  target.locked = false;

  if (targetIsAdmin) {
    let admins = readJSON(files.admins);
    admins = admins.map(a => a.username === username ? target : a);
    writeJSON(files.admins, admins);
    res.json({ message: `Admin ${username} wurde entsperrt` });
  } else {
    users = users.map(u => u.username === username ? target : u);
    writeJSON(files.users, users);
    res.json({ message: `Nutzer ${username} wurde entsperrt` });
  }
});

app.get('/api/admin/requests', adminAuth, (req, res) => {
  const pending = readJSON(files.requestAccess);
  res.json(pending);
});

app.post('/api/admin/reject', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });

  let pending = readJSON(files.requestAccess);
  const index = pending.findIndex(u => u.username === username);
  if (index === -1) return res.status(404).json({ message: 'Anfrage nicht gefunden' });

  pending.splice(index, 1);
  writeJSON(files.requestAccess, pending);
  res.json({ message: 'Anfrage abgelehnt und entfernt' });
});

app.post('/api/admin/approve', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });

  let pending = readJSON(files.requestAccess);
  const index = pending.findIndex(u => u.username === username);
  if (index === -1) return res.status(404).json({ message: 'Anfrage nicht gefunden' });

  let approvedUser = pending.splice(index, 1)[0];
  approvedUser.isAdmin = false;
  approvedUser.locked = false;

  let users = readJSON(files.users);
  users.push(approvedUser);
  writeJSON(files.users, users);
  writeJSON(files.requestAccess, pending);
  res.json({ message: 'Benutzer genehmigt und in users.json übernommen' });
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = readJSON(files.users).map(u => ({ ...u, isAdmin: false }));
  const admins = readJSON(files.admins).map(a => ({ ...a, isAdmin: true }));
  res.json(users.concat(admins));
});

app.post('/api/admin/promote', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });

  let users = readJSON(files.users);
  const index = users.findIndex(u => u.username === username);
  if (index === -1) return res.status(404).json({ message: 'Nutzer nicht gefunden oder bereits Admin' });

  let promotedUser = users.splice(index, 1)[0];
  promotedUser.isAdmin = true;

  let admins = readJSON(files.admins);
  admins.push(promotedUser);
  writeJSON(files.users, users);
  writeJSON(files.admins, admins);
  res.json({ message: `Nutzer ${username} wurde befördert` });
});

app.post('/api/admin/demote', adminAuth, (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });

  let admins = readJSON(files.admins);
  const index = admins.findIndex(a => a.username === username);
  if (index === -1) return res.status(404).json({ message: 'Admin nicht gefunden oder bereits normaler Nutzer' });

  let demotedUser = admins.splice(index, 1)[0];
  demotedUser.isAdmin = false;

  let users = readJSON(files.users);
  users.push(demotedUser);
  writeJSON(files.admins, admins);
  writeJSON(files.users, users);
  res.json({ message: `Admin ${username} wurde herabgestuft` });
});

app.post('/api/admin/update-media', adminAuth, mediaUpload.fields([
  { name: 'video', maxCount: 1 },
  ...Array.from({ length: 19 }, (_, i) => ({ name: `image${i + 1}`, maxCount: 1 }))
]), (req, res) => {
  try {
    // Korrekte Pfade: private/homepage/videos und private/homepage/images  
    const videoDir = path.join(__dirname, 'private', 'homepage', 'videos');
    const imagesDir = path.join(__dirname, 'private', 'homepage', 'images');
    
    // Erstelle Verzeichnisse falls sie nicht existieren
    [videoDir, imagesDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // File mapping für Ziel-Dateinamen
    const fileMapping = { 
      video: 'video1.mp4'
    };
    
    // Bilder 1-19
    for (let i = 1; i <= 19; i++) {
      fileMapping[`image${i}`] = `bild${i}.png`;
    }

    let filesProcessed = 0;
    const processedFiles = [];

    // Verarbeite jede hochgeladene Datei
    Object.entries(fileMapping).forEach(([fieldName, targetFileName]) => {
      if (req.files && req.files[fieldName] && req.files[fieldName][0]) {
        try {
          // Bestimme Ziel-Verzeichnis basierend auf Dateityp
          const isVideo = fieldName === 'video';
          const targetDirectory = isVideo ? videoDir : imagesDir;
          const fullTargetPath = path.join(targetDirectory, targetFileName);
          
          // Lösche alte Datei falls vorhanden
          if (fs.existsSync(fullTargetPath)) {
            fs.unlinkSync(fullTargetPath);
          }
          
          // Hole die hochgeladene Datei
          const uploadedFile = req.files[fieldName][0];
          
          // Verschiebe die Datei zum Ziel
          fs.renameSync(uploadedFile.path, fullTargetPath);
          
          filesProcessed++;
          processedFiles.push({
            field: fieldName,
            fileName: targetFileName,
            path: fullTargetPath
          });
          
        } catch (fileError) {
          console.error(`Fehler bei Media-Upload ${fieldName}:`, fileError.message);
        }
      }
    });

    // Antwort senden
    if (filesProcessed > 0) {
      res.json({ 
        message: `${filesProcessed} Datei(en) erfolgreich aktualisiert`,
        filesProcessed,
        files: processedFiles.map(f => f.fileName)
      });
    } else {
      res.status(400).json({ 
        message: 'Keine Dateien zum Verarbeiten gefunden' 
      });
    }
    
  } catch (error) {
    console.error('Fehler beim Media-Update:', error.message);
    res.status(500).json({ 
      message: 'Fehler beim Aktualisieren der Medien: ' + error.message 
    });
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

app.get('/api/export-all', (req, res) => {
  const apiKey = (req.body.apiKey || req.query.apiKey || "").trim();
  if (apiKey !== API_KEY) return res.status(403).json({ message: 'Ungültiger API Key' });

  res.attachment('export.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', err => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  try {
    function addDirectoryRecursively(dir, prefix = '') {
      const items = fs.readdirSync(dir);
      items.forEach(item => {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          addDirectoryRecursively(itemPath, prefix + item + '/');
        } else {
          archive.file(itemPath, { name: prefix + item });
        }
      });
    }

    addDirectoryRecursively(privateDir);
    
    const chatFiles = fs.readdirSync(chatsDir).filter(file => file.endsWith('.json'));
    chatFiles.forEach(file => {
      const chatFilePath = path.join(chatsDir, file);
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
  } catch (err) {
    console.error('Fehler beim Archivieren:', err);
  }

  archive.finalize();
});

// ===== MEDIA-ENDPUNKTE =====
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

// ===== NEWSLETTER-ENDPUNKT =====
app.post('/newsletter/subscribe', newsletterLimiter, globalNewsletterLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Keine E-Mail-Adresse angegeben' });

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({ message: 'Ungültige E-Mail-Adresse' });
  }

  let emails = [];
  if (fs.existsSync(files.emails)) {
    try {
      emails = JSON.parse(fs.readFileSync(files.emails, 'utf8'));
    } catch (err) {
      console.error('Fehler beim Lesen der emails.json:', err);
    }
  }
  if (!Array.isArray(emails)) emails = [];
  if (!emails.includes(email)) {
    emails.push(email);
    fs.writeFileSync(files.emails, JSON.stringify(emails, null, 2), 'utf8');
  }
  res.json({ message: 'E-Mail erfolgreich hinzugefügt' });
});

// ===== IMPRESSUM-ENDPUNKTE =====
app.get('/api/impressum', (req, res) => {
  if (fs.existsSync(files.impressum)) {
    try {
      const data = JSON.parse(fs.readFileSync(files.impressum, 'utf8'));
      res.json(data);
    } catch (err) {
      console.error("Fehler beim Lesen der Impressum-Datei", err);
      res.status(500).json({ message: 'Fehler beim Lesen der Impressum-Datei' });
    }
  } else {
    res.status(404).json({ message: 'Impressum nicht gefunden' });
  }
});

app.post('/api/impressum', (req, res) => {
  const apiKey = (req.body.apiKey || req.query.apiKey || "").trim();
  if (apiKey !== API_KEY) return res.status(403).json({ message: 'Ungültiger API Key' });

  const { Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email } = req.body;
  if (!Vorname || !Nachname || !Adresse || !Adresszusatz || !Stadt || !Email) {
    return res.status(400).json({ message: 'Alle Felder (Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email) sind erforderlich' });
  }

  const impressumData = { Vorname, Nachname, Adresse, Adresszusatz, Stadt, Email };
  try {
    fs.writeFileSync(files.impressum, JSON.stringify(impressumData, null, 2), 'utf8');
    res.json({ message: 'Impressum erfolgreich aktualisiert', data: impressumData });
  } catch (err) {
    console.error("Fehler beim Schreiben der Impressum-Datei", err);
    res.status(500).json({ message: 'Fehler beim Aktualisieren der Impressum-Datei' });
  }
});

// ===== PRESSE-ENDPUNKTE =====
app.get('/api/presse', (req, res) => {
  if (fs.existsSync(files.presse)) {
    try {
      const data = JSON.parse(fs.readFileSync(files.presse, 'utf8'));
      res.json(data);
    } catch (err) {
      console.error("Fehler beim Lesen der Presse-Datei:", err);
      res.status(500).json({ message: 'Fehler beim Lesen der Presse-Datei' });
    }
  } else {
    res.json({
      leftText: "Hier steht der linke Presseinhalt.",
      rightText: "Hier steht der rechte Presseinhalt.",
      mail: "Patrick-grossdemo@web.de"
    });
  }
});

app.post('/api/presse', orgaAuth, (req, res) => {
  const { leftText, rightText, mail } = req.body;
  if (!leftText || !rightText || !mail) {
    return res.status(400).json({ message: 'Alle Felder (leftText, rightText, mail) sind erforderlich.' });
  }

  const presseData = { leftText, rightText, mail };
  try {
    fs.writeFileSync(files.presse, JSON.stringify(presseData, null, 2), 'utf8');
    res.json({ message: 'Presse-Inhalt erfolgreich aktualisiert', data: presseData });
  } catch (err) {
    console.error("Fehler beim Schreiben der Presse-Datei:", err);
    res.status(500).json({ message: 'Fehler beim Aktualisieren der Presse-Datei' });
  }
});

// ===== BUGREPORT-ENDPUNKT =====
app.post('/bugreport', (req, res) => {
  const ip = req.ip;
  const now = Date.now();

  if (bugReportIPData[ip] && now - bugReportIPData[ip] < 60 * 60 * 1000) {
    return res.status(429).json({ message: 'Pro IP ist nur ein Bugreport pro Stunde erlaubt.' });
  }

  const reportData = req.body.report;
  if (typeof reportData !== 'object' || reportData === null) {
    return res.status(400).json({ message: 'Ungültiger Bugreport-Inhalt.' });
  }

  const allowedAreas = ['login', 'registration', 'chat', 'orga', 'homepage', 'newsletter'];
  if (!reportData.errorArea || !allowedAreas.includes(reportData.errorArea)) {
    return res.status(400).json({ message: 'Ungültiger oder fehlender Fehlerbereich.' });
  }

  if (!reportData.details || typeof reportData.details.description !== 'string') {
    return res.status(400).json({ message: 'Fehlerbeschreibung fehlt.' });
  }
  if (reportData.details.description.length > 250) {
    return res.status(400).json({ message: 'Die Fehlerbeschreibung darf maximal 250 Zeichen lang sein.' });
  }

  bugReportIPData[ip] = now;

  let reports = readJSON(files.reports);
  const newReport = {
    id: Date.now() + '_' + Math.floor(Math.random() * 1000),
    ip,
    timestamp: new Date().toISOString(),
    errorArea: reportData.errorArea,
    details: reportData.details
  };
  reports.push(newReport);
  writeJSON(files.reports, reports);

  res.json({ message: 'Bugreport erfolgreich übermittelt', report: newReport });
});

// ===== SERVER START =====
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});