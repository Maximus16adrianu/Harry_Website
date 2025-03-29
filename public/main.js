/* Globale Navigation und Galerie */
function toggleMobileNav(event) {
  event.stopPropagation();
  const mobileNav = document.getElementById("mobileNav");
  if (mobileNav) {
    mobileNav.classList.toggle("active");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Galerie-Funktionalität: Bilder 3 bis 19
  const images = [];
  for (let i = 3; i <= 19; i++) {
    images.push(`/api/media/image/bild${i}.png`);
  }
  let currentIndex = 0;
  const galleryImage = document.getElementById('gallery-image');

  function updateGallery() {
    if (galleryImage) {
      galleryImage.style.opacity = 0;
      setTimeout(() => {
        galleryImage.src = images[currentIndex];
        galleryImage.style.opacity = 1;
      }, 300);
    }
  }

  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateGallery();
    });
    nextBtn.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % images.length;
      updateGallery();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft' && prevBtn) {
      prevBtn.click();
    } else if (e.key === 'ArrowRight' && nextBtn) {
      nextBtn.click();
    }
  });

  // Video-Autoplay-Handling
  document.addEventListener("click", function () {
    const video = document.getElementById("intro-video");
    if (video && video.paused) {
      video.play().then(() => {
        video.muted = false;
      }).catch(error => {
        console.error("Autoplay mit Ton wurde blockiert:", error);
      });
    }
  });

  // Aktive Navigation-Markierung
  const navLinks = document.querySelectorAll('.sidebar a, .mobile-nav a');
  const sections = document.querySelectorAll('section');
  window.addEventListener('scroll', function () {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      if (pageYOffset >= (sectionTop - 200)) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(link => {
      link.parentElement.classList.remove('active');
      if (link.getAttribute('href').substring(1) === current) {
        link.parentElement.classList.add('active');
      }
    });
  });

  // "Click Outside" – Schließt das mobile Menü, wenn außerhalb geklickt wird
  document.addEventListener('click', function(e) {
    const mobileNav = document.getElementById("mobileNav");
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileNav && mobileNav.classList.contains('active')) {
      if (!mobileNav.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        mobileNav.classList.remove('active');
      }
    }
  });

  // Falls das Browserfenster von Mobil- zu PC-Ansicht wechselt, mobile Navigation schließen
  window.addEventListener("resize", function() {
    if (window.innerWidth > 768) {
      const mobileNav = document.getElementById("mobileNav");
      if (mobileNav) {
        mobileNav.classList.remove("active");
      }
    }
  });
});

/* Fehler melden Modal und dynamisches Formular */

// Öffnet das Modal
function openReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.style.display = "block";
  }
}

// Schließt das Modal
function closeReportModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.style.display = "none";
  }
  // Zurücksetzen des Formulars
  document.getElementById("reportForm").reset();
  document.getElementById("dynamicQuestions").innerHTML = "";
}

// Dynamisches Einblenden der weiteren Fragen basierend auf der Bereichsauswahl
function handleAreaChange() {
  const area = document.getElementById("errorArea").value;
  const container = document.getElementById("dynamicQuestions");
  container.innerHTML = ""; // Reset
  container.style.display = "block";

  if (area === "login") {
    container.innerHTML = `
      <label>Hast du 100%ig sichergestellt, dass dein Nutzername und Passwort korrekt eingegeben wurden?</label>
      <select id="loginCorrect" name="loginCorrect" required onchange="handleLoginCorrectChange()">
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
      <div id="loginAdditional"></div>
    `;
  }
  else if (area === "registration") {
    container.innerHTML = `
      <label>Hast du unten das Kästchen "Ich bin kein Hater" angekreuzt?</label>
      <select id="regHater" name="regHater" required onchange="handleRegHaterChange()">
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
      <div id="regAdditional"></div>
    `;
  }
  else if (area === "homepage") {
    container.innerHTML = `
      <label>Handelt es sich um einen Fehler beim Video oder bei den Bildern?</label>
      <select id="homepageMedia" name="homepageMedia" required>
        <option value="">Bitte auswählen</option>
        <option value="video">Video</option>
        <option value="images">Bilder</option>
      </select>
      <label>Beschreibe bitte kurz dein Problem:</label>
      <textarea name="homepageDescription" required maxlength="250"></textarea>
    `;
  }
  else if (area === "chat") {
    container.innerHTML = `
      <label>Welche Fehlermeldung hast du erhalten?</label>
      <select id="chatError" name="chatError" required onchange="handleChatErrorChange()">
        <option value="">Bitte auswählen</option>
        <option value="notLoggedIn">Nicht eingeloggt</option>
        <option value="noChatSelected">Kein Chat ausgewählt</option>
        <option value="chatsLocked">Chats sind gesperrt (nur Admin/Orga können schreiben)</option>
        <option value="other">Andere</option>
      </select>
      <div id="chatAdditional"></div>
    `;
  }
  else if (area === "orga") {
    container.innerHTML = `
      <label>Hast du einen Organisator-Account?</label>
      <select id="orgaAccount" name="orgaAccount" required>
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
      <p>Hinweis: Ein Organisator-Account kann nur vom Seiten-Admin erstellt werden. Falls du dich als normaler Nutzer registriert hast, melde dich im normalen Chat an oder kontaktiere den Admin.</p>
    `;
  }
  else if (area === "newsletter") {
    container.innerHTML = `
      <label>Erhältst du die Fehlermeldung, dass nur eine E-Mail pro Runde gesendet werden kann?</label>
      <select id="newsletterLimit" name="newsletterLimit" required onchange="handleNewsletterChange()">
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="other">Andere Fehlermeldung</option>
      </select>
      <div id="newsletterAdditional"></div>
    `;
  }
  // Kein Fallback-Textfeld mehr einfügen!
}

// Dynamik für Login-Zweig
function handleLoginCorrectChange() {
  const value = document.getElementById("loginCorrect").value;
  const container = document.getElementById("loginAdditional");
  container.innerHTML = "";
  container.style.display = "block";

  if (value === "yes") {
    container.innerHTML = `
      <label>Erinnerst du dich daran, ob du eventuell etwas Verwerfliches gemacht hast bzw. gebannt wurdest?</label>
      <select id="loginBanned" name="loginBanned" required onchange="handleLoginBannedChange()">
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
      <div id="loginBannedAdditional"></div>
    `;
  } else {
    container.innerHTML = `
      <label>Beschreibe bitte, wie der Fehler aufgetreten ist:</label>
      <textarea name="loginDescription" required maxlength="250"></textarea>
    `;
  }
}

function handleLoginBannedChange() {
  const value = document.getElementById("loginBanned").value;
  const container = document.getElementById("loginBannedAdditional");
  container.innerHTML = "";
  container.style.display = "block";

  if (value === "no") {
    container.innerHTML = `
      <label>Beschreibe bitte in welcher Reihenfolge mit welchem Nutzer und Passwort du dich eingeloggt hast:</label>
      <textarea name="loginDescription" required maxlength="250"></textarea>
    `;
  } else {
    container.innerHTML = `
      <label>Beschreibe bitte, wie der Fehler aufgetreten ist:</label>
      <textarea name="loginDescription" required maxlength="250"></textarea>
    `;
  }
}

// Dynamik für Registrierung
function handleRegHaterChange() {
  const value = document.getElementById("regHater").value;
  const container = document.getElementById("regAdditional");
  container.innerHTML = "";
  container.style.display = "block";

  if (value === "yes") {
    container.innerHTML = `
      <label>Hat dein Passwort mehr als 8 Zeichen (Zahlen/Buchstaben) und dein Nutzername mehr als 15 Zeichen?</label>
      <select id="regLength" name="regLength" required>
        <option value="">Bitte auswählen</option>
        <option value="yes">Ja</option>
        <option value="no">Nein</option>
      </select>
      <div id="regLengthAdditional"></div>
    `;
    document.getElementById("regLength").addEventListener("change", function() {
      const val = this.value;
      const addContainer = document.getElementById("regLengthAdditional");
      addContainer.innerHTML = "";
      addContainer.style.display = "block";

      if (val === "no") {
        addContainer.innerHTML = `
          <label>Beschreibe bitte dein Problem:</label>
          <textarea name="regDescription" required maxlength="250"></textarea>
        `;
      } else {
        addContainer.innerHTML = `<p>Bitte überprüfe nochmals deine Eingaben.</p>`;
      }
    });
  } else {
    container.innerHTML = `
      <label>Beschreibe bitte, wie der Fehler aufgetreten ist:</label>
      <textarea name="regDescription" required maxlength="250"></textarea>
    `;
  }
}

// Dynamik für Chat
function handleChatErrorChange() {
  const value = document.getElementById("chatError").value;
  const container = document.getElementById("chatAdditional");
  container.innerHTML = "";
  container.style.display = "block";

  if (value === "notLoggedIn") {
    container.innerHTML = `<p>Hinweis: Bitte logge dich aus und wieder ein.</p>`;
  }
  else if (value === "noChatSelected") {
    container.innerHTML = `<p>Hinweis: Bitte wähle einen Chat aus.</p>`;
  }
  else if (value === "chatsLocked") {
    container.innerHTML = `<p>Hinweis: Chats sind momentan gesperrt – nur Admins oder Organisatoren können schreiben, da wichtige Informationen anstehen.</p>`;
  }
  else if (value === "other") {
    container.innerHTML = `
      <label>Beschreibe bitte dein Problem:</label>
      <textarea name="chatDescription" required maxlength="250"></textarea>
    `;
  } else {
    container.innerHTML = `
      <label>Beschreibe bitte, wie der Fehler aufgetreten ist:</label>
      <textarea name="chatDescription" required maxlength="250"></textarea>
    `;
  }
}

// Dynamik für Newsletter
function handleNewsletterChange() {
  const value = document.getElementById("newsletterLimit").value;
  const container = document.getElementById("newsletterAdditional");
  container.innerHTML = "";
  container.style.display = "block";

  if (value === "other") {
    container.innerHTML = `
      <label>Beschreibe bitte dein Problem:</label>
      <textarea name="newsletterDescription" required maxlength="250"></textarea>
    `;
  } else {
    container.innerHTML = `<p>Hinweis: Diese Regelung dient dem Schutz vor Spam.</p>`;
  }
}

// Formular abschicken per Fetch
document.getElementById("reportForm").addEventListener("submit", function(e) {
  e.preventDefault();
  
  // Hole den errorArea-Wert
  const errorArea = document.getElementById("errorArea").value;
  
  // Falls ein Textfeld vorhanden ist, prüfe dessen Inhalt. Andernfalls wird description als leer akzeptiert.
  const textareaEl = document.querySelector("#reportForm textarea");
  const description = textareaEl ? textareaEl.value : "";
  
  if (!errorArea) {
    alert("Bitte füllen Sie alle erforderlichen Felder aus.");
    return;
  }
  if (textareaEl && !description) {
    alert("Bitte füllen Sie alle erforderlichen Felder aus.");
    return;
  }
  
  // Baue das korrekte JSON-Objekt für den Bugreport
  const dataToSend = {
    report: {
      errorArea: errorArea,
      details: {
        description: description
      }
    }
  };
  
  fetch("/bugreport", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(dataToSend)
  })
    .then(response => response.json())
    .then(result => {
      console.log("Erfolg:", result);
      alert("Danke, dein Fehlerbericht wurde übermittelt!");
      closeReportModal();
    })
    .catch(error => {
      console.error("Fehler beim Senden:", error);
      alert("Beim Senden ist ein Fehler aufgetreten.");
    });
});
