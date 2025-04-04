document.addEventListener("DOMContentLoaded", () => {
    let isOrga = false;

    // Elemente selektieren
    const loginOverlay = document.getElementById("loginOverlay");
    const openLoginBtn = document.getElementById("openLogin");
    const closeLoginBtn = document.getElementById("closeLogin");
    const loginBtn = document.getElementById("loginBtn");
    const editButtons = document.querySelectorAll(".edit-btn");
    const mailLink = document.getElementById("mailLink");
    const editMailBtn = document.getElementById("editMail");
    const defaultMail = document.getElementById("defaultMail");
    const gmailMail = document.getElementById("gmailMail");
    const infoBtn = document.getElementById("infoBtn");

    // Funktion zum Parsen von Farbcodes: Ersetzt Muster wie "#red:Text#"
    function parseColoredText(rawText) {
        return rawText.replace(/#(\w+):([^#]+)#/g, (match, color, text) => {
            return `<span style="color: ${color};">${text}</span>`;
        });
    }

    // Presseinhalt laden
    function loadPresse() {
      fetch('/api/presse')
        .then(res => res.json())
        .then(data => {
          const leftTextElem = document.getElementById('leftText');
          const rightTextElem = document.getElementById('rightText');

          leftTextElem.setAttribute("data-rawtext", data.leftText || 'Hier steht der linke Presseinhalt.');
          rightTextElem.setAttribute("data-rawtext", data.rightText || 'Hier steht der rechte Presseinhalt.');

          // Text-Commands parsen und anzeigen
          leftTextElem.innerHTML = parseColoredText(leftTextElem.getAttribute("data-rawtext"));
          rightTextElem.innerHTML = parseColoredText(rightTextElem.getAttribute("data-rawtext"));

          // E-Mail setzen
          const mail = data.mail || 'Patrick-grossdemo@web.de';
          mailLink.href = 'mailto:' + mail;
          mailLink.innerText = mail;
          defaultMail.href = 'mailto:' + mail;
          gmailMail.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + mail;
        })
        .catch(err => console.error("Fehler beim Laden des Presseinhalts:", err));
    }
    loadPresse();

    // Login-Overlay öffnen/schließen
    openLoginBtn.addEventListener("click", () => {
      loginOverlay.style.display = "flex";
    });
    closeLoginBtn.addEventListener("click", () => {
      loginOverlay.style.display = "none";
    });

    // Login-Versuch
    loginBtn.addEventListener("click", () => {
      const username = document.getElementById('orgaUsername').value.trim();
      const password = document.getElementById('orgaPassword').value.trim();

      if (!username || !password) {
        alert("Bitte beide Felder ausfüllen.");
        return;
      }

      fetch('/api/orga/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
        .then(res => res.json())
        .then(data => {
          if (data.message && data.message.includes('erfolgreich')) {
            isOrga = true;
            document.body.classList.add("orga-loggedin");
            loginOverlay.style.display = "none";
            alert("Organisator-Login erfolgreich!");
            infoBtn.style.display = "inline-block";
          } else {
            alert("Login fehlgeschlagen: " + data.message);
          }
        })
        .catch(err => console.error("Fehler beim Login:", err));
    });

    // Info-Button: Zeigt eine Anleitung zu den verfügbaren Text-Commands
    infoBtn.addEventListener("click", () => {
      if (!isOrga) return;
      alert(`Verfügbare Text-Commands:
- #Farbe:Text# → färbt "Text" in der angegebenen Farbe (z.B. #red:Hallo#).
Weitere Commands können in Zukunft hinzugefügt werden.`);
    });

    // Bearbeiten der Presseinhalte
    editButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        if (!isOrga) return;
        const targetId = btn.getAttribute("data-target");
        const pElem = document.getElementById(targetId);

        // Wechsel in den Bearbeitungsmodus
        if (pElem.getAttribute("data-editable") === "false") {
          pElem.innerText = pElem.getAttribute("data-rawtext");
          pElem.contentEditable = "true";
          pElem.focus();
          pElem.style.border = "1px dashed #002868";
          pElem.setAttribute("data-editable", "true");
          btn.innerText = "Speichern";
        } else {
          pElem.contentEditable = "false";
          pElem.style.border = "none";
          pElem.setAttribute("data-editable", "false");
          btn.innerText = "Bearbeiten";

          const rawText = pElem.innerText;
          pElem.setAttribute("data-rawtext", rawText);
          pElem.innerHTML = parseColoredText(rawText);

          const leftRaw = document.getElementById('leftText').getAttribute("data-rawtext");
          const rightRaw = document.getElementById('rightText').getAttribute("data-rawtext");
          const mail = mailLink.innerText;

          fetch('/api/presse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leftText: leftRaw, rightText: rightRaw, mail })
          })
            .then(res => res.json())
            .then(data => {
              alert(data.message);
            })
            .catch(err => console.error("Fehler beim Speichern:", err));
        }
      });
    });

    // E-Mail bearbeiten
    editMailBtn.addEventListener("click", () => {
      if (!isOrga) return;
      const currentMail = mailLink.innerText;
      const input = document.createElement("input");
      input.type = "email";
      input.value = currentMail;
      input.style.padding = "6px";
      input.style.borderRadius = "4px";
      input.style.border = "1px solid #ccc";

      mailLink.parentNode.insertBefore(input, mailLink);
      mailLink.style.display = "none";
      editMailBtn.style.display = "none";
      input.focus();

      input.addEventListener("blur", () => {
        const newMail = input.value.trim() || currentMail;
        mailLink.innerText = newMail;
        mailLink.href = 'mailto:' + newMail;
        defaultMail.href = 'mailto:' + newMail;
        gmailMail.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + newMail;
        mailLink.style.display = "inline";
        editMailBtn.style.display = "inline-block";
        input.remove();

        const leftRaw = document.getElementById('leftText').getAttribute("data-rawtext");
        const rightRaw = document.getElementById('rightText').getAttribute("data-rawtext");
        fetch('/api/presse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leftText: leftRaw, rightText: rightRaw, mail: newMail })
        })
          .then(res => res.json())
          .then(data => {
            alert(data.message);
          })
          .catch(err => console.error("Fehler beim Speichern der E-Mail:", err));
      });
    });
});
