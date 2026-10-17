/*
 * Liste d'attente iPhone (lancement Android d'abord).
 * Tant que l'identifiant App Store n'est pas renseigné (APP_STORE_ID dans la page), un iPhone ne voit pas de lien
 * vers un App Store vide : il voit « bientôt sur iphone. » et laisse son email (fonction Supabase « waitlist »).
 * Utilisé par /f/ (lecture d'un mot par lien) et /u/ (invitation). Même DA que la page : variables CSS --ink, --paper, --card, --fr.
 */
(function () {
  'use strict';
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  window.sweetinIosPending = function (storeUrl) {
    return ios && /APP_STORE_ID/.test(storeUrl || '');
  };

  var css =
    '.wl{width:100%;max-width:380px;margin:0 auto calc(16px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;text-align:center}' +
    '.wl h2{font-family:"Sweetin Display","Arial Black",sans-serif;font-weight:400;font-size:24px;line-height:1.1;margin:0}' +
    '.wl p{margin:0;font-size:15px;line-height:1.4;color:var(--muted)}' +
    '.wl form{display:flex;gap:8px;margin-top:4px}' +
    '.wl input{flex:1;min-width:0;height:54px;border-radius:27px;border:0;padding:0 20px;background:var(--card);color:var(--ink);font:700 16px "Sweetin Text",system-ui,sans-serif;outline:none}' +
    '.wl input:focus{box-shadow:0 0 0 3px var(--fr)}' +
    '.wl button{height:54px;padding:0 20px;border-radius:27px;border:0;background:var(--ink);color:var(--paper);font:800 16px "Sweetin Text",system-ui,sans-serif;white-space:nowrap}' +
    '.wl button:active{transform:scale(.97)}.wl button[disabled]{opacity:.5}' +
    '.wl .ok{color:var(--ink);font-weight:800}';

  /**
   * Remplace l'élément `anchor` (le bouton vers le store) par le formulaire.
   * opts : { api, src, ref, fr }
   */
  window.sweetinWaitlist = function (anchor, opts) {
    if (!anchor || document.getElementById('wl')) return;
    var fr = opts.fr !== false;
    var T = fr
      ? { title: 'bientôt sur iphone.', sub: opts.ref ? 'laisse ton email : on te prévient le jour j. en attendant, @' + opts.ref + ' peut t’envoyer ses mots par lien.' : 'laisse ton email : on te prévient le jour j.', ph: 'ton email', go: 'préviens-moi', ok: 'c’est noté. à très vite.', bad: 'cet email ne marche pas.', err: 'oups. réessaie.' }
      : { title: 'coming soon to iphone.', sub: opts.ref ? 'leave your email and we’ll tell you on launch day. until then, @' + opts.ref + ' can send you words by link.' : 'leave your email and we’ll tell you on launch day.', ph: 'your email', go: 'notify me', ok: 'got it. see you soon.', bad: 'that email doesn’t work.', err: 'oops. try again.' };
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var box = document.createElement('div'); box.className = 'wl'; box.id = 'wl';
    box.innerHTML = '<h2></h2><p class="sub"></p><form novalidate><input type="email" inputmode="email" autocomplete="email" required><button type="submit"></button></form><p class="msg" aria-live="polite"></p>';
    box.querySelector('h2').textContent = T.title;
    box.querySelector('.sub').textContent = T.sub;
    var input = box.querySelector('input'), btn = box.querySelector('button'), msg = box.querySelector('.msg');
    input.placeholder = T.ph; input.setAttribute('aria-label', T.ph); btn.textContent = T.go;
    anchor.replaceWith(box);
    box.querySelector('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = input.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = T.bad; return; }
      btn.disabled = true; msg.textContent = '';
      fetch((opts.api || '') + '/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, platform: 'ios', src: opts.src || '', ref: opts.ref || '', lang: fr ? 'fr' : 'en' })
      }).then(function (r) {
        if (!r.ok) throw new Error();
        box.querySelector('form').remove(); msg.className = 'ok'; msg.textContent = T.ok;
      }).catch(function () { btn.disabled = false; msg.textContent = T.err; });
    });
  };
})();
