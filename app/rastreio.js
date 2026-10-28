/* ==========================================================================
   Rastreio do site (cole no site da empresa, antes de </body>):
   <script src="ENDERECO_DO_SISTEMA/rastreio.js" data-api="URL_DO_APPS_SCRIPT" data-k="CHAVE_DE_CAPTACAO" async></script>
   Só registra visitas de quem já é contato e chegou clicando num e-mail do sistema
   (o link traz o parâmetro pcid). Visitantes anônimos não são rastreados.
   ========================================================================== */
(function () {
  'use strict';
  var tag = document.currentScript;
  if (!tag) return;
  var api = tag.getAttribute('data-api') || '', k = tag.getAttribute('data-k') || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(api) || !k) return;
  var CH = 'prumo_pcid';
  var q = new URLSearchParams(location.search);
  var pcid = q.get('pcid');
  try {
    if (pcid && /^[\w-]+\.[0-9a-f]{16}$/.test(pcid)) localStorage.setItem(CH, pcid);
    else pcid = localStorage.getItem(CH);
  } catch (e) { /* navegador sem armazenamento */ }
  if (!pcid) return;
  var corpo = JSON.stringify({ action: 'publico.visita', k: k, pcid: pcid, url: location.origin + location.pathname, titulo: document.title });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon(api, new Blob([corpo], { type: 'text/plain' }));
    else fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: corpo, keepalive: true });
  } catch (e) { /* nada */ }
})();
