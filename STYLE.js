(function(){
  "use strict";

  /* ===== Utilitaires de sécurité ===== */
  // Echappement HTML pour éviter toute injection (défense en profondeur,
  // même si aucune donnée n'est actuellement réinjectée en innerHTML).
  function escapeHTML(str){
    return String(str).replace(/[&<>"'`=\/]/g, function(ch){
      var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','=':'&#61;','/':'&#47;'};
      return map[ch];
    });
  }

  // Nettoyage basique des entrées texte : trim + suppression des caractères de contrôle.
  function sanitizeInput(value){
    return String(value)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim();
  }

  var EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  /* ===== Menu mobile ===== */
  var burger = document.getElementById('burgerBtn');
  var nav = document.getElementById('primary-nav');

  function closeMenu(){
    nav.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Ouvrir le menu');
  }
  function toggleMenu(){
    var isOpen = nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
  }
  if (burger && nav){
    burger.addEventListener('click', toggleMenu);
    nav.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', function(e){
      if (!nav.contains(e.target) && !burger.contains(e.target)){
        closeMenu();
      }
    });
  }

  /* ===== Navigation active au scroll ===== */
  var navLinks = document.querySelectorAll('[data-nav]');
  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));

  if ('IntersectionObserver' in window && sections.length){
    var navObserver = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          var id = entry.target.getAttribute('id');
          navLinks.forEach(function(link){
            var match = link.getAttribute('href') === ('#' + id);
            link.classList.toggle('active', match);
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function(s){ navObserver.observe(s); });
  }

  /* ===== Animations au scroll (reveal) ===== */
  var revealEls = document.querySelectorAll('.reveal');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !reduceMotion){
    var revealObserver = new IntersectionObserver(function(entries, obs){
      entries.forEach(function(entry){
        if (entry.isIntersecting){
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function(el){ revealObserver.observe(el); });
  } else {
    revealEls.forEach(function(el){ el.classList.add('in'); });
  }

  /* ===== Anneaux de compétences (SVG progress) ===== */
  document.querySelectorAll('.ring').forEach(function(ring){
    var pct = parseInt(ring.getAttribute('data-pct'), 10);
    pct = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
    var bar = ring.querySelector('.bar');
    var r = 34;
    var circumference = 2 * Math.PI * r;
    bar.style.strokeDasharray = circumference.toFixed(2);
    bar.style.strokeDashoffset = circumference.toFixed(2);
    if ('IntersectionObserver' in window){
      var obs = new IntersectionObserver(function(entries, o){
        entries.forEach(function(entry){
          if (entry.isIntersecting){
            var offset = circumference * (1 - pct / 100);
            requestAnimationFrame(function(){
              bar.style.strokeDashoffset = offset.toFixed(2);
            });
            o.unobserve(entry.target);
          }
        });
      }, { threshold: 0.4 });
      obs.observe(ring);
    } else {
      bar.style.strokeDashoffset = (circumference * (1 - pct / 100)).toFixed(2);
    }
  });

  /* ===== Génération de la roue de tontine (signature graphique) ===== */
  function buildWheel(svgGroupId, count, radius, activeIndex, dotSize){
    var group = document.getElementById(svgGroupId);
    if (!group) return;
    var cx = 120, cy = 120;
    if (svgGroupId === 'wheelDots'){ cx = 100; cy = 100; }
    for (var i = 0; i < count; i++){
      var angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      var x = cx + radius * Math.cos(angle);
      var y = cy + radius * Math.sin(angle);
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x.toFixed(2));
      circle.setAttribute('cy', y.toFixed(2));
      circle.setAttribute('r', dotSize);
      var isActive = (i === activeIndex);
      circle.setAttribute('class', (svgGroupId === 'wheelDots' ? 'dot' : 'member') + (isActive ? ' active turn' : ''));
      group.appendChild(circle);

      if (svgGroupId === 'tontineMembers'){
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', cx); line.setAttribute('y1', cy);
        line.setAttribute('x2', x.toFixed(2)); line.setAttribute('y2', y.toFixed(2));
        line.setAttribute('class', 'spoke');
        group.parentNode.insertBefore(line, group);
      }
    }
  }
  try{
    buildWheel('wheelDots', 14, 92, 3, 3.4);
    buildWheel('tontineMembers', 8, 86, 2, 8);
  }catch(err){
    console.error('Erreur lors de la génération du motif décoratif :', err);
  }

  /* ===== Année dynamique ===== */
  var yearEl = document.getElementById('year');
  if (yearEl){ yearEl.textContent = new Date().getFullYear(); }

  /* ===== Formulaire de contact : validation + sécurité ===== */
  var form = document.getElementById('contactForm');
  var submitBtn = document.getElementById('submitBtn');
  var formMsg = document.getElementById('formMsg');
  var lastSubmit = 0;

  function setFieldState(fieldId, isValid){
    var field = document.getElementById(fieldId).closest('.field');
    field.classList.toggle('invalid', !isValid);
  }

  function showMessage(text, type){
    formMsg.textContent = text; // textContent : jamais innerHTML, protège contre l'injection
    formMsg.className = 'form-msg show ' + type;
  }

  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();

      // Anti-spam : honeypot doit rester vide
      var honeypot = sanitizeInput(form.website.value);
      if (honeypot !== ''){
        // Requête silencieusement ignorée (probable robot)
        return;
      }

      // Anti-double-soumission (limite de fréquence côté client)
      var now = Date.now();
      if (now - lastSubmit < 4000){
        showMessage('Veuillez patienter avant de renvoyer le formulaire.', 'error');
        return;
      }

      var name = sanitizeInput(form['name'].value);
      var email = sanitizeInput(form['email'].value);
      var message = sanitizeInput(form['message'].value);

      var nameValid = name.length >= 2 && name.length <= 80;
      var emailValid = EMAIL_RE.test(email) && email.length <= 120;
      var messageValid = message.length >= 10 && message.length <= 1000;

      setFieldState('cf-name', nameValid);
      setFieldState('cf-email', emailValid);
      setFieldState('cf-message', messageValid);

      if (!nameValid || !emailValid || !messageValid){
        showMessage('Merci de corriger les champs indiqués en rouge.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours...';

      try{
        var subject = encodeURIComponent('Message depuis le portfolio — ' + name);
        var body = encodeURIComponent(
          'Nom : ' + name + '\n' +
          'Email : ' + email + '\n\n' +
          'Message :\n' + message
        );
        lastSubmit = now;
        window.location.href = 'mailto:Lauracfa078@gmail.com?subject=' + subject + '&body=' + body;
        showMessage('Votre client email va s\'ouvrir pour finaliser l\'envoi. Merci !', 'success');
        form.reset();
        ['cf-name','cf-email','cf-message'].forEach(function(id){ setFieldState(id, true); });
      }catch(err){
        console.error('Erreur lors de la préparation du message :', err);
        showMessage('Une erreur est survenue. Merci de réessayer ou de m\'écrire directement.', 'error');
      }finally{
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le message';
      }
    });

    // Validation live douce en sortie de champ
    ['cf-name','cf-email','cf-message'].forEach(function(id){
      var el = document.getElementById(id);
      el.addEventListener('blur', function(){
        var val = sanitizeInput(el.value);
        var valid = true;
        if (id === 'cf-name') valid = val.length >= 2 && val.length <= 80;
        if (id === 'cf-email') valid = EMAIL_RE.test(val) && val.length <= 120;
        if (id === 'cf-message') valid = val.length >= 10 && val.length <= 1000;
        setFieldState(id, valid || val.length === 0);
      });
    });
  }

})();