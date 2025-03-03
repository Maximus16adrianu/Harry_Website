const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Verzeichnis-Pfade
const privateDir = path.join(__dirname, 'private');
const chatsDir = path.join(privateDir, 'bundes_chats');
const picturesDir = path.join(privateDir, 'pictures'); // Für Bilder

// Stelle sicher, dass das Bilder-Verzeichnis existiert
if (!fs.existsSync(picturesDir)) {
  fs.mkdirSync(picturesDir, { recursive: true });
}

const usersFile = path.join(privateDir, 'users.json');
const adminsFile = path.join(privateDir, 'admins.json');
const moderatorsFile = path.join(privateDir, 'moderators.json');
const requestAccessFile = path.join(privateDir, 'request_acces.json');

// Falls moderators.json noch nicht existiert, lege eine leere Datei an.
if (!fs.existsSync(moderatorsFile)) {
  fs.writeFileSync(moderatorsFile, '[]', 'utf8');
}

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

// Multer-Konfiguration für Bilder-Upload mit fileFilter
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
    // Nur Admins (und ggf. Moderatoren) dürfen Bilder hochladen – hier gilt: Nur Admins haben diese Option
    if (req.user && req.user.role === 'admin') {
      cb(null, true);
    } else {
      cb(new Error('Nur Admins dürfen Bilder hochladen'), false);
    }
  }
});

// Statische Dateien (inklusive Bilder, die unter /pictures erreichbar sind)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/pictures', express.static(picturesDir));

/* ---------------------------
   Middleware: Auth (inkl. Rollen)
----------------------------*/
function authMiddleware(req, res, next) {
  const { username, password } = req.cookies;
  if (!username || !password) {
    return res.status(401).json({ message: 'Nicht eingeloggt' });
  }

  // Zuerst in users.json
  let users = readJSON(usersFile);
  let user = users.find(u => u.username === username && u.password === password);
  if (user) {
    user.role = 'user';
  }

  // Dann in admins.json, falls nicht gefunden
  if (!user) {
    let admins = readJSON(adminsFile);
    let adminUser = admins.find(a => a.username === username && a.password === password);
    if (adminUser) {
      adminUser.role = 'admin';
      user = adminUser;
    }
  }

  // Dann in moderators.json, falls noch nicht gefunden
  if (!user) {
    let moderators = readJSON(moderatorsFile);
    let modUser = moderators.find(m => m.username === username && m.password === password);
    if (modUser) {
      modUser.role = 'moderator';
      user = modUser;
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
   API-Endpunkt: Userinfo
----------------------------*/
app.get('/api/userinfo', authMiddleware, (req, res) => {
  res.json({ 
    username: req.user.username, 
    role: req.user.role, 
    isAdmin: req.user.role === 'admin',
    isModerator: req.user.role === 'moderator'
  });
});

/* ---------------------------
   Login / Logout / Signup
----------------------------*/
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  let users = readJSON(usersFile);
  let user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    let admins = readJSON(adminsFile);
    let adminUser = admins.find(a => a.username === username && a.password === password);
    if (adminUser) {
      adminUser.role = 'admin';
      user = adminUser;
    }
  }

  if (!user) {
    let moderators = readJSON(moderatorsFile);
    let modUser = moderators.find(m => m.username === username && m.password === password);
    if (modUser) {
      modUser.role = 'moderator';
      user = modUser;
    }
  }

  if (user) {
    if (user.locked) {
      return res.status(403).json({ message: 'Account gesperrt' });
    }
    // Cookies setzen mit 24h Gültigkeit
    res.cookie('username', username, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.cookie('password', password, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    return res.json({ message: 'Erfolgreich eingeloggt', role: user.role, isAdmin: user.role === 'admin', isModerator: user.role === 'moderator' });
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
  const moderators = readJSON(moderatorsFile);

  if (
    pending.find(u => u.username === username) ||
    users.find(u => u.username === username) ||
    admins.find(a => a.username === username) ||
    moderators.find(m => m.username === username)
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
   Chat-Endpunkte
----------------------------*/
app.get('/api/channels', authMiddleware, (req, res) => {
  fs.readdir(chatsDir, (err, files) => {
    if (err) {
      return res.status(500).json({ message: 'Fehler beim Lesen der Chat-Dateien' });
    }
    let channels = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));

    // "Admin_chat" nur für Admins sichtbar
    if (req.user.role !== 'admin') {
      channels = channels.filter(ch => ch !== 'Admin_chat');
    }
    res.json(channels);
  });
});

app.get('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }

  const filePath = path.join(chatsDir, chatName + '.json');
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'Chat nicht gefunden' });
  }

  try {
    const chatData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(chatData);
  } catch (e) {
    console.error('Fehler beim Lesen des Chats', e);
    res.status(500).json({ message: 'Fehler beim Lesen des Chats' });
  }
});

// Hilfsfunktion: Löscht alle Nachrichten eines bestimmten Nutzers in jedem Chat
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

// Standard-Textnachricht senden (mit Rate Limiting & Muted-Check)
app.post('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  if (req.user.muted) {
    return res.status(403).json({ message: 'Du bist stummgeschaltet und kannst keine Nachrichten senden.' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }
  if (req.user.role !== 'admin') {
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
    role: req.user.role, // "admin", "moderator" oder "user"
    isAdmin: req.user.role === 'admin',
    isModerator: req.user.role === 'moderator',
    message,
    timestamp: new Date().toISOString()
  };

  chatData.push(newMessage);
  writeJSON(filePath, chatData);

  res.json({ message: 'Nachricht gesendet', newMessage });
});

// Endpoint für Bild-Uploads (nur Admins)
app.post('/api/chats/:chatName/image', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen Bilder hochladen' });
  }
  
  upload.single('image')(req, res, function(err) {
    if (err) {
      return res.status(403).json({ message: err.message });
    }
    const chatName = req.params.chatName;
    if (chatName === 'Admin_chat' && req.user.role !== 'admin') {
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
      role: req.user.role,
      isAdmin: req.user.role === 'admin',
      isModerator: req.user.role === 'moderator',
      image: req.file.filename,
      timestamp: new Date().toISOString()
    };

    chatData.push(newMessage);
    writeJSON(filePath, chatData);

    res.json({ message: 'Bild hochgeladen und Nachricht gesendet', newMessage });
  });
});

app.delete('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && req.user.role !== 'admin') {
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

  // Eigene Nachricht kann jeder löschen.
  if (msg.user !== req.user.username) {
    // Admins dürfen alles löschen.
    if (req.user.role === 'moderator') {
      // Moderatoren dürfen nur Nachrichten von normalen Nutzern löschen.
      const normalUsers = readJSON(usersFile);
      const targetNormal = normalUsers.find(u => u.username === msg.user);
      if (!targetNormal) {
        return res.status(403).json({ message: 'Moderatoren dürfen nur Nachrichten von normalen Nutzern löschen.' });
      }
    } else {
      return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
    }
  }

  chatData.splice(index, 1);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

/* ---------------------------
   Moderator-Endpunkte (Mute/Unmute)
   Nur Admins und Moderatoren dürfen Nutzer stummschalten – jedoch nur, wenn diese normale Nutzer sind.
----------------------------*/
app.post('/api/moderate/mute', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ message: 'Nicht berechtigt.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Nur normale Nutzer können stummgeschaltet werden.' });
  }
  target.muted = true;
  users = users.map(u => u.username === username ? target : u);
  writeJSON(usersFile, users);
  res.json({ message: `Nutzer ${username} wurde stummgeschaltet.` });
});

app.post('/api/moderate/unmute', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ message: 'Nicht berechtigt.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Nur normale Nutzer können entstummt werden.' });
  }
  target.muted = false;
  users = users.map(u => u.username === username ? target : u);
  writeJSON(usersFile, users);
  res.json({ message: `Nutzer ${username} wurde entstummt.` });
});

/* ---------------------------
   Admin-Endpunkte für Moderatoren
   - Moderatoren ernennen und entfernen
   - Liste der Moderatoren abrufen
----------------------------*/
app.post('/api/admin/appointModerator', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen Moderatoren ernennen.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden oder ist kein normaler Nutzer.' });
  }
  // Entferne aus users.json
  users = users.filter(u => u.username !== username);
  writeJSON(usersFile, users);
  let moderators = readJSON(moderatorsFile);
  if (moderators.find(m => m.username === username)) {
    return res.status(400).json({ message: 'Nutzer ist bereits Moderator.' });
  }
  target.appointedBy = req.user.username;
  target.role = 'moderator';
  moderators.push(target);
  writeJSON(moderatorsFile, moderators);
  res.json({ message: `Nutzer ${username} wurde zum Moderator ernannt.` });
});

app.post('/api/admin/removeModerator', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen Moderatoren entfernen.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  if (username === req.user.username) {
    return res.status(400).json({ message: 'Du kannst dich nicht selbst entfernen.' });
  }
  let moderators = readJSON(moderatorsFile);
  let target = moderators.find(m => m.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Moderator nicht gefunden.' });
  }
  // Hier wird die ursprüngliche Prüfbedingung entfernt, sodass jeder Admin Moderatoren entfernen kann.
  moderators = moderators.filter(m => m.username !== username);
  writeJSON(moderatorsFile, moderators);
  let users = readJSON(usersFile);
  target.muted = false;
  delete target.appointedBy;
  target.role = 'user';
  users.push(target);
  writeJSON(usersFile, users);
  res.json({ message: `Moderator ${username} wurde entfernt und zu Nutzer herabgestuft.` });
});

/* ---------------------------
   Neue Admin-Endpunkte für Rollenänderung
----------------------------*/
// Promotion: Moderator zu Admin befördern
app.post('/api/admin/promoteModerator', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen Moderatoren befördern.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  let moderators = readJSON(moderatorsFile);
  let target = moderators.find(m => m.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Moderator nicht gefunden.' });
  }
  // Entferne aus moderators.json
  moderators = moderators.filter(m => m.username !== username);
  writeJSON(moderatorsFile, moderators);
  
  // Füge zum admins.json hinzu
  let admins = readJSON(adminsFile);
  target.role = 'admin';
  delete target.appointedBy;
  admins.push(target);
  writeJSON(adminsFile, admins);
  res.json({ message: `Moderator ${username} wurde zu Admin befördert.` });
});

// Demotion: Moderator zu Nutzer herabstufen
app.post('/api/admin/demoteModerator', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen Moderatoren herabstufen.' });
  }
  const { username } = req.body;
  if (!username) return res.status(400).json({ message: 'Username erforderlich' });
  let moderators = readJSON(moderatorsFile);
  let target = moderators.find(m => m.username === username);
  if (!target) {
    return res.status(404).json({ message: 'Moderator nicht gefunden.' });
  }
  // Entferne aus moderators.json
  moderators = moderators.filter(m => m.username !== username);
  writeJSON(moderatorsFile, moderators);
  
  // Füge zum users.json hinzu
  let users = readJSON(usersFile);
  target.role = 'user';
  delete target.appointedBy;
  users.push(target);
  writeJSON(usersFile, users);
  res.json({ message: `Moderator ${username} wurde zu Nutzer herabgestuft.` });
});

app.get('/api/admin/moderators', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen diese Liste abrufen.' });
  }
  let moderators = readJSON(moderatorsFile);
  res.json(moderators);
});

/* ---------------------------
   Neuer Admin-Endpunkt: Update Media (Video und Bilder)
----------------------------*/
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

app.post('/api/admin/update-media', authMiddleware, mediaUpload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 }
]), (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen diesen Endpunkt nutzen' });
  }
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

// Alle Nutzer abrufen (inklusive Moderatoren)
app.get('/api/admin/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Nur Admins dürfen diesen Endpunkt nutzen.' });
  }
  const users = readJSON(usersFile).map(u => ({ ...u, role: 'user' }));
  const admins = readJSON(adminsFile).map(a => ({ ...a, role: 'admin' }));
  const moderators = readJSON(moderatorsFile).map(m => ({ ...m, role: 'moderator' }));
  res.json(users.concat(admins, moderators));
});

app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
