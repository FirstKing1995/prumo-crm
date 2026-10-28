/* ==========================================================================
   PRUMO CRM — servidor (Google Apps Script)
   --------------------------------------------------------------------------
   PRIMEIRO USO (o passo a passo completo está em docs/INSTALACAO.md):
     1. Na planilha: Extensões > Apps Script. Apague tudo e cole este arquivo.
     2. Troque o e-mail e a senha logo abaixo (ADMIN_INICIAL).
     3. Selecione a função "instalar" no menu de cima e clique em Executar.
        Autorize o acesso quando o Google pedir.
     4. Implantar > Nova implantação > Tipo: App da Web
        Executar como: Eu | Quem pode acessar: Qualquer pessoa > Implantar.
     5. Copie a URL que termina em /exec e cole na tela inicial do sistema.
   ========================================================================== */

// ---- Primeiro acesso (troque antes de rodar "instalar") --------------------
var ADMIN_INICIAL = {
  nome: 'Administrador',
  email: 'admin@suaempresa.com.br',
  senha: 'troque-esta-senha'
};

/* --------------------------------------------------------- plataforma */
var FUSO = 'America/Sao_Paulo';
var memo_ = {};

var PLAT = {
  tabela: function (nome) {
    if (memo_[nome]) return memo_[nome].objs;
    var sh = aba_(nome);
    var lr = sh.getLastRow(), lc = sh.getLastColumn();
    var cab = lc ? sh.getRange(1, 1, 1, lc).getValues()[0].map(String) : [];
    var vals = lr > 1 ? sh.getRange(2, 1, lr - 1, lc).getDisplayValues() : [];
    var objs = vals.map(function (row) {
      var o = {};
      cab.forEach(function (c, i) { if (c) o[c] = row[i]; });
      return o;
    });
    memo_[nome] = { sh: sh, cab: cab, objs: objs };
    return objs;
  },
  /** Busca rápida por um valor exato numa coluna (usa o localizador da planilha). */
  filtrar: function (nome, campo, valor) {
    var sh = aba_(nome);
    var lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (lr < 2) return [];
    var cab = sh.getRange(1, 1, 1, lc).getValues()[0].map(String);
    var col = cab.indexOf(campo);
    if (col < 0) return [];
    var achados = sh.getRange(2, col + 1, lr - 1, 1).createTextFinder(String(valor)).matchEntireCell(true).findAll();
    if (achados.length > 400) {
      return PLAT.tabela(nome).filter(function (o) { return o[campo] === valor; });
    }
    return achados.map(function (rg) {
      var row = sh.getRange(rg.getRow(), 1, 1, lc).getDisplayValues()[0];
      var o = {};
      cab.forEach(function (c, i) { if (c) o[c] = row[i]; });
      return o;
    });
  },
  inserir: function (nome, obj) { PLAT.inserirVarios(nome, [obj]); },
  inserirVarios: function (nome, objs) {
    if (!objs || !objs.length) return;
    var sh = aba_(nome);
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var linhas = objs.map(function (o) { return cab.map(function (c) { return o[c] === undefined || o[c] === null ? '' : String(o[c]); }); });
    var rg = sh.getRange(sh.getLastRow() + 1, 1, linhas.length, cab.length);
    rg.setNumberFormat('@');
    rg.setValues(linhas);
    if (memo_[nome]) objs.forEach(function (o) { var c = {}; cab.forEach(function (k) { c[k] = o[k] === undefined || o[k] === null ? '' : String(o[k]); }); memo_[nome].objs.push(c); });
  },
  atualizar: function (nome, id, campos) {
    var m = {}; m[id] = campos;
    PLAT.atualizarVarios(nome, m);
  },
  atualizarVarios: function (nome, mapa) {
    var ids = Object.keys(mapa || {});
    if (!ids.length) return;
    PLAT.tabela(nome);
    var t = memo_[nome];
    var linhas = {};
    t.objs.forEach(function (o, i) { if (mapa[o.id]) linhas[i] = o; });
    var idx = Object.keys(linhas).map(Number);
    if (!idx.length) return;
    var aplicar = function (o) {
      var campos = mapa[o.id];
      Object.keys(campos).forEach(function (k) { if (t.cab.indexOf(k) >= 0) o[k] = campos[k] === undefined || campos[k] === null ? '' : String(campos[k]); });
      return t.cab.map(function (c) { return o[c] === undefined ? '' : o[c]; });
    };
    if (idx.length <= 15) {
      idx.forEach(function (i) {
        var rg = t.sh.getRange(i + 2, 1, 1, t.cab.length);
        rg.setNumberFormat('@');
        rg.setValues([aplicar(t.objs[i])]);
      });
    } else { // muitas linhas: regrava o bloco de uma vez
      var ini = Math.min.apply(null, idx), fim = Math.max.apply(null, idx);
      var bloco = [];
      for (var i = ini; i <= fim; i++) bloco.push(linhas[i] ? aplicar(t.objs[i]) : t.cab.map(function (c) { return t.objs[i][c]; }));
      var rg2 = t.sh.getRange(ini + 2, 1, bloco.length, t.cab.length);
      rg2.setNumberFormat('@');
      rg2.setValues(bloco);
    }
  },
  excluir: function (nome, id) { PLAT.excluirVarios(nome, [id]); },
  excluirVarios: function (nome, ids) {
    if (!ids || !ids.length) return;
    PLAT.tabela(nome);
    var t = memo_[nome];
    var alvo = {};
    ids.forEach(function (i) { alvo[i] = 1; });
    var linhas = [];
    t.objs.forEach(function (o, i) { if (alvo[o.id]) linhas.push(i + 2); });
    linhas.sort(function (a, b) { return b - a; });
    // apaga em blocos contínuos, de baixo para cima
    var k = 0;
    while (k < linhas.length) {
      var fim = linhas[k], ini = fim;
      while (k + 1 < linhas.length && linhas[k + 1] === ini - 1) { k++; ini = linhas[k]; }
      t.sh.deleteRows(ini, fim - ini + 1);
      k++;
    }
    delete memo_[nome];
  },
  config: function () {
    var sh = aba_('Config');
    var out = {};
    if (sh.getLastRow() < 2) return out;
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) { if (r[0]) out[r[0]] = r[1]; });
    return out;
  },
  salvarConfig: function (obj) {
    var sh = aba_('Config');
    var lr = sh.getLastRow();
    var chaves = lr > 1 ? sh.getRange(2, 1, lr - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
    Object.keys(obj).forEach(function (k) {
      var i = chaves.indexOf(k);
      if (i >= 0) sh.getRange(i + 2, 2).setNumberFormat('@').setValue(String(obj[k]));
      else { lr++; sh.getRange(lr, 1, 1, 2).setNumberFormat('@').setValues([[k, String(obj[k])]]); chaves.push(k); }
    });
  },
  agora: function () { return Utilities.formatDate(new Date(), FUSO, "yyyy-MM-dd'T'HH:mm:ss"); },
  id: function (pref) { return pref + Utilities.formatDate(new Date(), FUSO, 'yyMMddHHmmss') + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase(); },
  uuid: function () { return Utilities.getUuid(); },
  hash: function (senha, salt) {
    var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + senha, Utilities.Charset.UTF_8);
    return b.map(function (x) { return ('0' + (x & 0xff).toString(16)).slice(-2); }).join('');
  },
  cache: {
    get: function (k) { return CacheService.getScriptCache().get(k); },
    put: function (k, v, s) { CacheService.getScriptCache().put(k, String(v), Math.min(s || 600, 21600)); },
    del: function (k) { CacheService.getScriptCache().remove(k); }
  },
  http: function (url, o) {
    o = o || {};
    var opt = { method: o.method || 'get', headers: o.headers || {}, muteHttpExceptions: true, followRedirects: true };
    if (o.body !== undefined) { opt.payload = o.body; opt.contentType = 'application/json'; }
    var r = UrlFetchApp.fetch(url, opt);
    return { code: r.getResponseCode(), text: r.getContentText() };
  },
  /** Regrava a aba inteira só com as linhas que ficam (usado pelo arquivo mensal). */
  substituir: function (nome, objs) {
    var sh = aba_(nome);
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    var lr = sh.getLastRow();
    var linhas = objs.map(function (o) { return cab.map(function (c) { return o[c] === undefined || o[c] === null ? '' : String(o[c]); }); });
    if (linhas.length) {
      var rg = sh.getRange(2, 1, linhas.length, cab.length);
      rg.setNumberFormat('@');
      rg.setValues(linhas);
    }
    if (lr - 1 > linhas.length) sh.deleteRows(linhas.length + 2, lr - 1 - linhas.length);
    delete memo_[nome];
  },
  /** Planilhas mensais de arquivo, guardadas numa pasta do Drive de quem instalou. */
  arquivo: {
    criar: function (nome, nomePasta) {
      var props = PropertiesService.getScriptProperties();
      var pasta = null, idPasta = props.getProperty('PASTA_ARQUIVO');
      if (idPasta) { try { pasta = DriveApp.getFolderById(idPasta); if (pasta.isTrashed()) pasta = null; } catch (e) { pasta = null; } }
      if (!pasta) {
        var achadas = DriveApp.getFoldersByName(nomePasta);
        pasta = achadas.hasNext() ? achadas.next() : DriveApp.createFolder(nomePasta);
        props.setProperty('PASTA_ARQUIVO', pasta.getId());
      }
      var ss = SpreadsheetApp.create(nome);
      DriveApp.getFileById(ss.getId()).moveTo(pasta);
      ss.setSpreadsheetTimeZone(FUSO);
      return { id: ss.getId(), url: ss.getUrl() };
    },
    aba: function (id, nome, cab) {
      var ss = SpreadsheetApp.openById(id);
      var sh = ss.getSheetByName(nome);
      if (!sh) {
        sh = ss.insertSheet(nome);
        if (cab) { sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#E8EEF7'); sh.setFrozenRows(1); }
        var p1 = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
        if (p1 && ss.getSheets().length > 1 && p1.getLastRow() === 0) ss.deleteSheet(p1);
      }
      return sh;
    },
    anexar: function (id, nome, cab, objs) {
      var sh = PLAT.arquivo.aba(id, nome, cab);
      var lr = sh.getLastRow();
      var ja = {};
      if (lr > 1) sh.getRange(2, 1, lr - 1, 1).getValues().forEach(function (r) { ja[String(r[0])] = 1; }); // não duplica se a rodada anterior parou no meio
      var linhas = objs.filter(function (o) { return !ja[o.id]; }).map(function (o) { return cab.map(function (c) { return o[c] === undefined || o[c] === null ? '' : String(o[c]); }); });
      if (!linhas.length) return;
      var rg = sh.getRange(lr + 1, 1, linhas.length, cab.length);
      rg.setNumberFormat('@');
      rg.setValues(linhas);
    },
    ler: function (id, nome) {
      var sh = SpreadsheetApp.openById(id).getSheetByName(nome);
      if (!sh || sh.getLastRow() < 2) return [];
      var vals = sh.getDataRange().getDisplayValues();
      var cab = vals.shift();
      return vals.map(function (row) { var o = {}; cab.forEach(function (c, i) { if (c) o[c] = row[i]; }); return o; });
    },
    filtrar: function (id, nome, campo, valor) {
      var sh = SpreadsheetApp.openById(id).getSheetByName(nome);
      if (!sh || sh.getLastRow() < 2) return [];
      var lc = sh.getLastColumn();
      var cab = sh.getRange(1, 1, 1, lc).getValues()[0].map(String);
      var col = cab.indexOf(campo);
      if (col < 0) return [];
      return sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).createTextFinder(String(valor)).matchEntireCell(true).findAll().slice(0, 500).map(function (rg) {
        var row = sh.getRange(rg.getRow(), 1, 1, lc).getDisplayValues()[0];
        var o = {};
        cab.forEach(function (c, i) { if (c) o[c] = row[i]; });
        return o;
      });
    }
  },
  /** E-mail pelo Gmail da conta que instalou (grátis, dentro da cota diária do Google). */
  email: {
    gmail: function (m) {
      var o = { to: m.para, subject: m.assunto, htmlBody: m.html, body: m.texto || '', name: m.nome || '' };
      if (m.responder) o.replyTo = m.responder;
      MailApp.sendEmail(o);
    },
    cotaGmail: function () { return MailApp.getRemainingDailyQuota(); }
  },
  /** Células usadas na planilha principal (o Google aceita até 10 milhões). */
  uso: function () {
    var n = 0;
    SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach(function (sh) { n += sh.getMaxRows() * sh.getMaxColumns(); });
    return { celulas: n, limite: 10000000 };
  },
  dormir: function (ms) { Utilities.sleep(ms); },
  urlPlanilha: function () { return SpreadsheetApp.getActiveSpreadsheet().getUrl(); },
  urlApp: function () {
    var salva = PropertiesService.getScriptProperties().getProperty('URL_APP');
    if (salva) return salva;
    try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
  }
};

function aba_(nome) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('A aba "' + nome + '" não existe. Rode a função instalar().');
  return sh;
}

var LOGICA_ = null;
function logica_() { if (!LOGICA_) LOGICA_ = PrumoLogica(PLAT); return LOGICA_; }

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function comTrava_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('O sistema está ocupado. Tente de novo em alguns segundos.');
  try { return fn(); } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------ entradas */
function doGet(e) {
  var p = (e && e.parameter) || {};
  // Verificação do webhook da Meta (API oficial)
  if (p['hub.mode'] === 'subscribe') {
    var cfg = logica_().cfg();
    if (p['hub.verify_token'] && p['hub.verify_token'] === cfg.META_VERIFY) return ContentService.createTextOutput(p['hub.challenge'] || '');
    return ContentService.createTextOutput('token invalido');
  }
  // E-mail: abertura (?t=o), clique (?t=c) e descadastro (?t=sair)
  if (p.t === 'o') {
    try { comTrava_(function () { return logica_().receberRastreio(p); }); } catch (e) { /* nunca quebra a imagem */ }
    return ContentService.createTextOutput('');
  }
  if (p.t === 'c') {
    var rc = {};
    try { rc = comTrava_(function () { return logica_().receberRastreio(p); }); } catch (e) { rc = { url: /^https?:\/\//i.test(String(p.u || '')) ? p.u : '' }; }
    var destino = String(rc.url || '').replace(/"/g, '%22');
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px">' + (destino ? '<p>Abrindo o link...</p><a target="_top" style="display:inline-block;background:#1F6FEB;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold" href="' + destino + '">Continuar</a><script>try{window.top.location.href=' + JSON.stringify(destino) + '}catch(e){}</script>' : '<p>Link inválido.</p>') + '</div>');
  }
  if (p.t === 'sair') {
    var f = String(p.f || '').replace(/[^\w-]/g, ''), s = String(p.s || '').replace(/[^\w]/g, '');
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;max-width:420px;margin:40px auto;text-align:center"><h2>Não receber mais e-mails</h2><p>Confirme para sair da nossa lista. Você pode voltar quando quiser.</p>' +
      '<button id="b" style="background:#DC2626;color:#fff;border:0;padding:14px 22px;border-radius:10px;font-weight:bold;cursor:pointer" onclick="this.disabled=true;this.textContent=\'Saindo...\';google.script.run.withSuccessHandler(function(r){document.body.innerHTML=\'<div style=&quot;font-family:sans-serif;text-align:center;padding:40px&quot;><h2>Pronto</h2><p>Você não vai mais receber nossos e-mails.</p></div>\'}).withFailureHandler(function(){document.getElementById(\'b\').textContent=\'Tente de novo\';document.getElementById(\'b\').disabled=false}).sairDaLista(\'' + f + '\',\'' + s + '\')">Confirmar</button></div>')
      .setTitle('Descadastro');
  }
  // Link inteligente de grupos: ...exec?g=nome-do-link  (redireciona para o grupo com vaga)
  if (p.g) {
    var r = comTrava_(function () { return logica_().rotear({ action: 'publico.grupo', slug: p.g }); });
    if (r.link) return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;text-align:center;padding:40px"><p>Grupo com vaga encontrado.</p><a target="_top" style="display:inline-block;background:#1FAF53;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold" href="' + r.link + '">Entrar no grupo</a></div>');
    return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:24px">Todos os grupos estão cheios no momento. Tente mais tarde.</p>');
  }
  return json_({ ok: true, sistema: 'Prumo CRM', versao: PRUMO_VERSAO, hora: PLAT.agora() });
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  var bruto = (e && e.postData && e.postData.contents) || '';
  var body = {};
  try { body = JSON.parse(bruto || '{}'); } catch (err) { body = {}; }
  if ((!body || !Object.keys(body).length) && Object.keys(p).length) {
    body = {};
    Object.keys(p).forEach(function (k) { if (['src', 'k', 'tags', 'origem', 'automacao', 'etapa', 'fonte', 'type', 'topic', 'data.id', 'id'].indexOf(k) < 0) body[k] = p[k]; });
  }
  // Webhooks (WhatsApp e formulários)
  if (p.src) {
    try {
      var r = comTrava_(function () { return logica_().receberWebhook(p, body); });
      return json_(r);
    } catch (err2) {
      registrarErro_('webhook ' + p.src, err2, bruto);
      return json_({ ok: false, error: String(err2.message || err2) });
    }
  }
  // Chamadas do site
  try {
    var leitura = /^(bootstrap|sync|conversa\.abrir|contato\.ver|relatorio|config\.ver|wa\.status|campanha\.envios|campanha\.custo|automacao\.execucoes|contato\.publico|publico\.marca|arquivo\.listar|arquivo\.contato|integracao\.testar|financeiro\.resumo|cobranca\.listar|limites|suporte\.ver|publico\.chat\.config|publico\.chat\.receber)$/.test(body.action);
    var exec = function () { return logica_().rotear(body); };
    var dados = leitura ? exec() : comTrava_(exec);
    return json_({ ok: true, data: dados });
  } catch (err) {
    var msg = err && err.message ? err.message : String(err);
    return json_({ ok: false, error: msg, auth: msg === 'SESSAO_EXPIRADA' });
  }
}

/** Chamado pela página de descadastro (?t=sair). O link é assinado: não dá para descadastrar outra pessoa. */
function sairDaLista(f, s) {
  return comTrava_(function () { return logica_().receberRastreio({ t: 'sair', f: f, s: s }); });
}

/** Gatilho de 1 minuto: envia disparos e acorda automações que estavam esperando. */
function trabalhar() {
  try { comTrava_(function () { return logica_().trabalhar(4); }); }
  catch (e) { registrarErro_('trabalhar', e, ''); }
}

function registrarErro_(onde, err, bruto) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Erros') || ss.insertSheet('Erros');
    if (sh.getLastRow() === 0) sh.appendRow(['data', 'onde', 'erro', 'conteudo']);
    if (sh.getLastRow() > 2000) sh.deleteRows(2, 500);
    sh.appendRow([PLAT.agora(), onde, String(err && err.message ? err.message : err), String(bruto || '').slice(0, 2000)]);
  } catch (e) { /* nada */ }
}

/* ------------------------------------------------------------ instalação */
/** Rode UMA vez: cria as abas, o administrador, os modelos e o gatilho de 1 minuto. */
function instalar() {
  if (ADMIN_INICIAL.senha === 'troque-esta-senha' || ADMIN_INICIAL.senha.length < 8) {
    throw new Error('Antes de instalar, troque o e-mail e a senha em ADMIN_INICIAL (mínimo 8 caracteres).');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(FUSO);
  Object.keys(PRUMO_ESQUEMA).forEach(function (nome) {
    var cab = PRUMO_ESQUEMA[nome];
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var atual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
    var faltam = cab.filter(function (c) { return atual.indexOf(c) < 0; });
    if (!atual.filter(Boolean).length) {
      sh.getRange(1, 1, 1, cab.length).setValues([cab]);
    } else if (faltam.length) {
      sh.getRange(1, atual.length + 1, 1, faltam.length).setValues([faltam]);
    }
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#E8EEF7');
  });
  var p1 = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (p1 && ss.getSheets().length > 1 && p1.getLastRow() === 0) ss.deleteSheet(p1);
  memo_ = {};
  logica_().semear(ADMIN_INICIAL);
  instalarGatilho();
  Logger.log('Pronto! Agora publique: Implantar > Nova implantação > App da Web (Executar como: Eu, Acesso: Qualquer pessoa).');
  Logger.log('Login: ' + ADMIN_INICIAL.email);
}

function instalarGatilho() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'trabalhar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('trabalhar').timeBased().everyMinutes(1).create();
}

/** Arquivo mensal manual: move o que é de meses anteriores para as planilhas mensais no Drive.
    Roda sozinho todo mês; use esta função só se quiser adiantar. Pode rodar de novo se parar no meio. */
function arquivarAgora() {
  var r = comTrava_(function () { return logica_().arquivar(null, 300000); });
  Logger.log(JSON.stringify(r));
}

/** Se a URL de webhook aparecer vazia no sistema, rode esta função colando a URL /exec. */
function definirUrlDoApp() {
  var url = 'COLE_AQUI_A_URL_QUE_TERMINA_EM_/exec';
  if (!/\/exec$/.test(url)) throw new Error('Cole a URL completa do App da Web.');
  PropertiesService.getScriptProperties().setProperty('URL_APP', url);
}

/** Esqueceu a senha? Troque o e-mail/senha em ADMIN_INICIAL e rode esta função. */
function redefinirSenhaAdmin() {
  var u = PLAT.tabela('Usuarios').filter(function (x) { return x.email === ADMIN_INICIAL.email.toLowerCase(); })[0];
  if (!u) throw new Error('Não existe usuário com o e-mail ' + ADMIN_INICIAL.email);
  var salt = Utilities.getUuid();
  PLAT.atualizar('Usuarios', u.id, { senha_hash: PLAT.hash(ADMIN_INICIAL.senha, salt), salt: salt, ativo: 'SIM', perfil: 'admin' });
  Logger.log('Senha redefinida para ' + u.email);
}
