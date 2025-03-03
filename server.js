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
    // Prüfe, ob der User (bereits durch authMiddleware gesetzt) Admin ist.
    if (req.user && req.user.isAdmin) {
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
   Middleware: Auth & Admin-Auth
----------------------------*/

// Middleware: Prüft Cookie-Login und Sperrstatus
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
      adminUser.isAdmin = true; // Markieren
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

// Zusätzliche Middleware für Endpunkte, die ausschließlich Admins vorbehalten sind
function adminOnlyMiddleware(req, res, next) {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({ message: 'Nur Admins dürfen diese Aktion ausführen' });
  }
}

/* ---------------------------
   Neuer API-Endpunkt: Userinfo
----------------------------*/

app.get('/api/userinfo', authMiddleware, (req, res) => {
  res.json({ username: req.user.username, isAdmin: req.user.isAdmin });
});

/* ---------------------------
   Login / Logout / Signup
----------------------------*/

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

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

  if (user) {
    if (user.locked) {
      return res.status(403).json({ message: 'Account gesperrt' });
    }
    // Cookies setzen
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

  // Prüfen, ob der Username schon existiert
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

    // Admin_chat nur für Admins sichtbar
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

// Standard-Textnachricht senden (mit Rate Limiting für normale Nutzer)
app.post('/api/chats/:chatName', authMiddleware, (req, res) => {
  const chatName = req.params.chatName;
  if (chatName === 'Admin_chat' && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Kein Zugriff auf Admin Chat' });
  }
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: 'Nachricht fehlt' });
  }

  // Rate Limiting und Zeichenlimit für normale Nutzer (nicht Admin)
  if (!req.user.isAdmin) {
    if (message.length > 1000) {
      return res.status(400).json({ message: 'Nachricht zu lang (maximal 1000 Zeichen erlaubt)' });
    }
    const now = Date.now();
    if (!userMessageTimestamps[req.user.username]) {
      userMessageTimestamps[req.user.username] = [];
    }
    // Entferne Einträge älter als 60 Sekunden
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
    timestamp: new Date().toISOString()
  };

  chatData.push(newMessage);
  writeJSON(filePath, chatData);

  res.json({ message: 'Nachricht gesendet', newMessage });
});

// Endpoint für Bild-Uploads (nur für Admins)
// Hier wird Multer innerhalb der Routenfunktion aufgerufen, sodass wir Fehler (z. B. vom fileFilter) abfangen können.
app.post('/api/chats/:chatName/image', authMiddleware, (req, res) => {
  // Direkt vor Multer prüfen: Ist der User Admin?
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Nur Admins dürfen Bilder hochladen' });
  }
  
  // Nur wenn der Admin-Check erfolgreich war, wird Multer ausgeführt.
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
      timestamp: new Date().toISOString()
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

  // Nur löschen, wenn selbst verfasst oder Admin
  if (msg.user !== req.user.username && !req.user.isAdmin) {
    return res.status(403).json({ message: 'Nicht berechtigt, diese Nachricht zu löschen' });
  }

  chatData.splice(index, 1);
  writeJSON(filePath, chatData);
  res.json({ message: 'Nachricht gelöscht' });
});

/* ---------------------------
   Admin-Endpunkte
   (Hier erhalten die meisten Endpunkte den Schutz durch authMiddleware und adminOnlyMiddleware)
----------------------------*/

// Bann-Endpunkt: Nur Admins dürfen bannen. 
// Reg. Nutzer werden ohne API-Key gebannt, Admins nur bei gültigem API-Key.
app.post('/api/admin/ban', authMiddleware, (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Nur Admins dürfen diese Aktion ausführen' });
  }
  
  const { username, apiKey } = req.body;
  
  // Suche zuerst in users.json (normale Nutzer)
  let users = readJSON(usersFile);
  let target = users.find(u => u.username === username);
  let targetIsAdmin = false;
  
  // Falls nicht gefunden, in admins.json suchen
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
  
  // Wenn das Ziel ein Admin ist, muss ein API-Key übergeben werden und sich Admins dürfen nicht gegenseitig bannen
  if (targetIsAdmin) {
    if (apiKey !== '1234') {
      return res.status(403).json({ message: 'Ungültiger API Key' });
    }
    if (req.user.username === username) {
      return res.status(403).json({ message: 'Admins können sich nicht selbst bannen' });
    }
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

app.post('/api/admin/unban', authMiddleware, adminOnlyMiddleware, (req, res) => {
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

app.get('/api/admin/requests', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const pending = readJSON(requestAccessFile);
  res.json(pending);
});

app.post('/api/admin/reject', authMiddleware, adminOnlyMiddleware, (req, res) => {
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

app.post('/api/admin/approve', authMiddleware, adminOnlyMiddleware, (req, res) => {
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

app.get('/api/admin/users', authMiddleware, adminOnlyMiddleware, (req, res) => {
  const users = readJSON(usersFile).map(u => ({ ...u, isAdmin: false }));
  const admins = readJSON(adminsFile).map(a => ({ ...a, isAdmin: true }));
  res.json(users.concat(admins));
});

app.post('/api/admin/promote', authMiddleware, adminOnlyMiddleware, (req, res) => {
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

app.post('/api/admin/demote', authMiddleware, adminOnlyMiddleware, (req, res) => {
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
// Temporäres Upload-Verzeichnis erstellen, falls nicht vorhanden
const tempUploadsDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

// Multer-Konfiguration für Medien-Uploads (Video und Bilder)
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

// Endpunkt: Ersetzt die Medien im Public-Ordner
// Erwartete Felder: "video", "image1", "image2"
// Mapping: video -> video1.mp4, image1 -> bild1.png, image2 -> bild2.png
app.post('/api/admin/update-media', authMiddleware, adminOnlyMiddleware, mediaUpload.fields([
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