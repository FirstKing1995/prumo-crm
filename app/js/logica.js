/* ==========================================================================
   PRUMO CRM — regras de negócio (núcleo compartilhado)
   --------------------------------------------------------------------------
   Este mesmo arquivo roda em dois lugares:
     1) no Google Apps Script (servidor real, dados na planilha);
     2) no navegador, no modo demonstração (dados no localStorage).
   Tudo o que depende do lugar (ler/gravar dados, chamar URLs, cache, hora)
   chega pelo objeto P ("plataforma"). Nada aqui conhece planilha ou navegador.
   ========================================================================== */
var PRUMO_VERSAO = '1.0.0';

var PRUMO_ESQUEMA = {
  Usuarios: ['id', 'nome', 'email', 'senha_hash', 'salt', 'perfil', 'ativo', 'recebe_leads', 'cor', 'ultimo_acesso', 'criado_em'],
  Contatos: ['id', 'nome', 'telefone', 'email', 'empresa', 'cargo', 'cidade', 'origem', 'tags', 'responsavel_id', 'status', 'campos', 'notas',
    'optout', 'bot_pausado_ate', 'ultima_msg', 'ultima_msg_em', 'ultima_direcao', 'nao_lidas', 'total_msgs', 'criado_em', 'atualizado_em'],
  Funis: ['id', 'nome', 'ordem'],
  Etapas: ['id', 'funil_id', 'nome', 'cor', 'ordem', 'tipo'],
  Negocios: ['id', 'titulo', 'contato_id', 'funil_id', 'etapa_id', 'valor', 'responsavel_id', 'status', 'motivo_perda', 'previsao', 'notas',
    'criado_em', 'atualizado_em', 'fechado_em'],
  Tarefas: ['id', 'titulo', 'tipo', 'contato_id', 'negocio_id', 'responsavel_id', 'vence_em', 'feita', 'notas', 'criado_em'],
  Mensagens: ['id', 'contato_id', 'direcao', 'tipo', 'texto', 'midia_url', 'status', 'erro', 'usuario_id', 'origem', 'wa_id', 'criado_em'],
  Modelos: ['id', 'titulo', 'atalho', 'texto', 'midia_url', 'midia_tipo', 'categoria'],
  Automacoes: ['id', 'nome', 'ativo', 'gatilho', 'passos', 'uma_vez', 'disparos', 'concluidas', 'criado_em', 'atualizado_em'],
  Execucoes: ['id', 'automacao_id', 'contato_id', 'passo_id', 'status', 'acordar_em', 'tentativas', 'criado_em', 'atualizado_em'],
  Campanhas: ['id', 'nome', 'destino', 'filtro', 'grupos', 'texto', 'midia_url', 'midia_tipo', 'meta_modelo', 'velocidade', 'status',
    'agendar_em', 'total', 'enviados', 'erros', 'respostas', 'criado_por', 'criado_em', 'iniciada_em', 'concluida_em'],
  Fila: ['id', 'tipo', 'ref_id', 'contato_id', 'destino', 'texto', 'midia_url', 'midia_tipo', 'enviar_em', 'status', 'erro', 'criado_em', 'enviado_em'],
  Grupos: ['id', 'nome', 'jid', 'link', 'slug', 'limite', 'cliques', 'ordem', 'ativo', 'criado_em'],
  Historico: ['id', 'data', 'contato_id', 'negocio_id', 'usuario_nome', 'acao', 'detalhe'],
  Config: ['chave', 'valor']
};

var PRUMO_CONFIG_PADRAO = {
  NOME: 'Prumo CRM',
  SLOGAN: 'Relacionamento que vende',
  LOGO_URL: '',
  COR_PRIMARIA: '#1F6FEB',
  COR_DESTAQUE: '#F2A900',
  MOEDA: 'BRL',
  SEGMENTO: 'geral',
  CONFIGURADO: 'NAO',
  WA_PROVEDOR: 'link',          // link | evolution | waha | meta
  WA_NUMERO: '',                // número da empresa (só para exibir e montar links)
  EVOLUTION_URL: '', EVOLUTION_APIKEY: '', EVOLUTION_INSTANCIA: '',
  WAHA_URL: '', WAHA_APIKEY: '', WAHA_SESSAO: 'default',
  META_TOKEN: '', META_PHONE_ID: '', META_VERIFY: '', META_VERSAO: 'v21.0',
  WEBHOOK_CHAVE: '',            // vai só na URL do webhook do WhatsApp
  ENTRADA_CHAVE: '',            // vai na URL dos formulários e webhooks de captação (pode ficar pública)
  WEBHOOKS_SAIDA: '[]',         // [{url, eventos:[...]}]
  HORARIO_INICIO: '08:00',      // disparos só dentro deste horário
  HORARIO_FIM: '20:00',
  DIAS_ENVIO: '1,2,3,4,5,6',    // 0 = domingo
  BOT_PAUSA_HORAS: '2',         // quando um humano responde, o robô pausa por X horas
  DISTRIBUIR_AUTO: 'NAO',       // novos contatos vão em rodízio para quem recebe leads
  ATENDENTE_VE_TODOS: 'NAO',
  OPTOUT_PALAVRAS: 'sair, parar, cancelar inscricao, nao quero mais',
  OPTOUT_RESPOSTA: 'Pronto, você não vai mais receber nossas mensagens automáticas. Se mudar de ideia, é só mandar OI.',
  MOTIVOS_PERDA: 'Preço, Sem resposta, Comprou do concorrente, Sem orçamento agora, Não era o perfil, Outro',
  CAMPOS_PERSONALIZADOS: '[]',  // [{chave, rotulo, tipo}]
  TAGS: 'Lead quente, Cliente, Indicação, Retornar',
  ORIGENS: 'WhatsApp, Instagram, Site, Indicação, Anúncio, Evento',
  PROX_TRABALHO: ''
};

var PRUMO_STATUS_CONTATO = ['lead', 'cliente', 'inativo'];

function PrumoLogica(P) {
  'use strict';

  /* ======================================================== utilitários */
  var U = {};
  U.str = function (v) { return v === undefined || v === null ? '' : String(v); };
  U.norm = function (s) { return U.str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); };
  U.dig = function (s) { return U.str(s).replace(/\.0$/, '').replace(/\D/g, ''); };
  U.json = function (s, padrao) {
    if (s && typeof s === 'object') return s;
    try { var v = JSON.parse(s); return v === null || v === undefined ? padrao : v; } catch (e) { return padrao; }
  };
  U.lista = function (s) { return U.str(s).split(/[,;\n]/).map(function (x) { return x.trim(); }).filter(Boolean); };
  U.tags = function (s) { return Array.isArray(s) ? s.filter(Boolean) : U.lista(s); };
  U.num = function (v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    var s = String(v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isNaN(n) ? 0 : n;
  };
  /** Telefone para o WhatsApp: só dígitos, com 55 quando parecer número brasileiro sem DDI. */
  U.telWa = function (t) {
    var d = U.dig(t);
    if (!d) return '';
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d;
  };
  /** Chave para achar duplicados: DDD + 8 últimos dígitos (ignora 55 e o nono dígito). */
  U.telChave = function (t) {
    var d = U.dig(t);
    if (d.length >= 12 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length < 10) return d;
    return d.slice(0, 2) + d.slice(-8);
  };
  U.urlMidia = function (u) { u = U.str(u).trim(); if (u && !/^https:\/\/[^\s"'<>]+$/i.test(u)) throw new Error('O link da mídia precisa começar com https://'); return u; };
  U.emailOk = function (e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(U.str(e).trim()); };
  U.somaTempo = function (iso, minutos) {
    var d = new Date(iso.replace(' ', 'T'));
    d = new Date(d.getTime() + minutos * 60000);
    var p = function (n) { return ('0' + n).slice(-2); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  };
  U.horaMin = function (iso) { var m = U.str(iso).match(/T(\d\d):(\d\d)/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
  U.diaSemana = function (iso) { return new Date(U.str(iso).slice(0, 10) + 'T12:00:00').getDay(); };
  U.primeiroNome = function (n) { return U.str(n).trim().split(/\s+/)[0] || ''; };
  U.cap = function (s, n) { s = U.str(s); return s.length > n ? s.slice(0, n) : s; };

  /* ======================================================= configuração */
  var cfgMemo = null;
  function cfg() {
    if (cfgMemo) return cfgMemo;
    var salvo = P.config();
    var c = {};
    Object.keys(PRUMO_CONFIG_PADRAO).forEach(function (k) { c[k] = PRUMO_CONFIG_PADRAO[k]; });
    Object.keys(salvo).forEach(function (k) { if (salvo[k] !== '' || !(k in c)) c[k] = salvo[k]; });
    cfgMemo = c;
    return c;
  }
  function salvarCfg(obj) { P.salvarConfig(obj); cfgMemo = null; }

  function marca() {
    var c = cfg();
    return { nome: c.NOME, slogan: c.SLOGAN, logo: c.LOGO_URL, cor: c.COR_PRIMARIA, destaque: c.COR_DESTAQUE, configurado: c.CONFIGURADO === 'SIM' };
  }

  /* ====================================================== histórico/log */
  function hist(contatoId, negocioId, user, acao, detalhe) {
    try {
      P.inserir('Historico', {
        id: P.id('H'), data: P.agora(), contato_id: contatoId || '', negocio_id: negocioId || '',
        usuario_nome: user ? user.nome : 'Sistema', acao: acao, detalhe: U.cap(detalhe, 500)
      });
    } catch (e) { /* o histórico nunca derruba a operação principal */ }
  }

  /* ======================================================== autenticação */
  function publicoUsuario(u) {
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, recebe_leads: u.recebe_leads, cor: u.cor, ultimo_acesso: u.ultimo_acesso };
  }

  function login(email, senha) {
    email = U.str(email).trim().toLowerCase();
    var chave = 'tent_' + email;
    var tent = Number(P.cache.get(chave) || 0);
    if (tent >= 8) throw new Error('Muitas tentativas. Aguarde 10 minutos e tente de novo.');
    var u = P.tabela('Usuarios').filter(function (x) { return U.str(x.email).toLowerCase() === email; })[0];
    if (!u || u.ativo !== 'SIM' || P.hash(U.str(senha), u.salt) !== u.senha_hash) {
      P.cache.put(chave, String(tent + 1), 600);
      throw new Error('E-mail ou senha incorretos.');
    }
    P.cache.del(chave);
    var token = P.uuid() + P.uuid();
    P.cache.put('s_' + token, u.id, 21600);
    P.atualizar('Usuarios', u.id, { ultimo_acesso: P.agora() });
    return { token: token, usuario: publicoUsuario(u) };
  }

  function autenticar(token) {
    if (!token) throw new Error('SESSAO_EXPIRADA');
    var id = P.cache.get('s_' + token);
    if (!id) throw new Error('SESSAO_EXPIRADA');
    var u = P.tabela('Usuarios').filter(function (x) { return x.id === id; })[0];
    if (!u || u.ativo !== 'SIM') throw new Error('SESSAO_EXPIRADA');
    P.cache.put('s_' + token, id, 21600);
    return u;
  }

  var PERM = {
    admin: { equipe: 1, integracoes: 1, ajustes: 1, excluir: 1, disparos: 1, automacoes: 1, todos: 1, relatorios: 1 },
    gestor: { excluir: 1, disparos: 1, automacoes: 1, todos: 1, relatorios: 1 },
    atendente: {}
  };
  function pode(user, area) { return !!(PERM[user.perfil] || {})[area]; }
  function exige(user, area) { if (!pode(user, area)) throw new Error('Seu perfil não tem acesso a esta área.'); }
  function veTodos(user) { return pode(user, 'todos') || cfg().ATENDENTE_VE_TODOS === 'SIM'; }
  function podeContato(user, c) { return veTodos(user) || !c.responsavel_id || c.responsavel_id === user.id; }

  /* =============================================================== dados */
  function contatoPorId(id) { return P.tabela('Contatos').filter(function (c) { return c.id === id; })[0] || null; }
  function contatoPorTel(tel) {
    var k = U.telChave(tel);
    if (!k || k.length < 8) return null;
    return P.tabela('Contatos').filter(function (c) { return c.telefone && U.telChave(c.telefone) === k; })[0] || null;
  }
  function contatoPorEmail(email) {
    email = U.str(email).trim().toLowerCase();
    if (!email) return null;
    return P.tabela('Contatos').filter(function (c) { return U.str(c.email).toLowerCase() === email; })[0] || null;
  }
  function camposDe(c) { return U.json(c.campos, {}) || {}; }

  function funisCompletos() {
    var etapas = P.tabela('Etapas').slice().sort(function (a, b) { return U.num(a.ordem) - U.num(b.ordem); });
    return P.tabela('Funis').slice().sort(function (a, b) { return U.num(a.ordem) - U.num(b.ordem); }).map(function (f) {
      return { id: f.id, nome: f.nome, ordem: f.ordem, etapas: etapas.filter(function (e) { return e.funil_id === f.id; }) };
    });
  }

  /** Cria ou atualiza um contato a partir de dados soltos (formulário, webhook, importação). */
  function gravarContato(dados, user, opcoes) {
    opcoes = opcoes || {};
    var tel = U.telWa(dados.telefone);
    var email = U.str(dados.email).trim().toLowerCase();
    var existente = (dados.id && contatoPorId(dados.id)) || (tel && contatoPorTel(tel)) || (email && contatoPorEmail(email));
    var agora = P.agora();
    var tagsNovas = U.tags(dados.tags);
    var tagsAntes = existente ? U.tags(existente.tags) : [];
    if (existente) {
      var mud = {};
      ['nome', 'email', 'empresa', 'cargo', 'cidade', 'origem', 'notas', 'status', 'responsavel_id'].forEach(function (k) {
        if (dados[k] === undefined || dados[k] === null || dados[k] === '') return;
        if (opcoes.naoSobrescrever && existente[k]) return;
        if (U.str(dados[k]) !== U.str(existente[k])) mud[k] = k === 'email' ? U.str(dados[k]).toLowerCase() : U.cap(dados[k], 500);
      });
      if (tel && !existente.telefone) mud.telefone = tel;
      if (opcoes.substituirTags) mud.tags = tagsNovas.join(', ');
      else if (tagsNovas.length) {
        var t = U.tags(existente.tags);
        tagsNovas.forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); });
        if (t.join(', ') !== existente.tags) mud.tags = t.join(', ');
      }
      if (dados.campos) {
        var cp = camposDe(existente);
        var cn = U.json(dados.campos, {});
        Object.keys(cn).forEach(function (k) { if (cn[k] !== '' && cn[k] !== undefined) cp[k] = cn[k]; });
        mud.campos = JSON.stringify(cp);
      }
      if (Object.keys(mud).length) {
        mud.atualizado_em = agora;
        P.atualizar('Contatos', existente.id, mud);
        Object.keys(mud).forEach(function (k) { existente[k] = mud[k]; });
        if (!opcoes.silencioso) hist(existente.id, '', user, 'contato_atualizado', Object.keys(mud).join(', '));
        if (!opcoes.semGatilhos) tagsNovas.filter(function (tg) { return tagsAntes.indexOf(tg) < 0; }).forEach(function (tg) { gatilho('tag', existente, { tag: tg }); });
      }
      return { contato: existente, novo: false };
    }
    if (!tel && !email && !U.str(dados.nome).trim()) throw new Error('Informe pelo menos nome, telefone ou e-mail.');
    var c = {
      id: P.id('C'), nome: U.cap(U.str(dados.nome).trim() || (tel ? '+' + tel : email), 120), telefone: tel, email: email,
      empresa: U.cap(dados.empresa, 120), cargo: U.cap(dados.cargo, 80), cidade: U.cap(dados.cidade, 80),
      origem: U.cap(dados.origem || 'Manual', 80), tags: tagsNovas.join(', '), responsavel_id: dados.responsavel_id || '',
      status: PRUMO_STATUS_CONTATO.indexOf(dados.status) >= 0 ? dados.status : 'lead',
      campos: dados.campos ? JSON.stringify(U.json(dados.campos, {})) : '{}', notas: U.cap(dados.notas, 2000),
      optout: 'NAO', bot_pausado_ate: '', ultima_msg: '', ultima_msg_em: '', ultima_direcao: '', nao_lidas: '0', total_msgs: '0',
      criado_em: agora, atualizado_em: agora
    };
    if (!c.responsavel_id && cfg().DISTRIBUIR_AUTO === 'SIM' && !opcoes.semDistribuir) c.responsavel_id = proximoDoRodizio();
    P.inserir('Contatos', c);
    if (!opcoes.silencioso) hist(c.id, '', user, 'contato_criado', 'Origem: ' + c.origem);
    saida('contato.criado', { contato: c });
    if (!opcoes.semGatilhos) {
      gatilho('novo_contato', c, { origem: c.origem });
      tagsNovas.forEach(function (tg) { gatilho('tag', c, { tag: tg }); });
    }
    return { contato: c, novo: true };
  }

  function proximoDoRodizio() {
    var us = P.tabela('Usuarios').filter(function (u) { return u.ativo === 'SIM' && u.recebe_leads === 'SIM'; });
    if (!us.length) return '';
    var abertos = {};
    us.forEach(function (u) { abertos[u.id] = 0; });
    P.tabela('Contatos').forEach(function (c) { if (c.responsavel_id in abertos && c.status === 'lead') abertos[c.responsavel_id]++; });
    var ult = U.str(P.cache.get('rodizio_ult'));
    us.sort(function (a, b) { return abertos[a.id] - abertos[b.id] || (a.id === ult ? 1 : 0) - (b.id === ult ? 1 : 0); });
    P.cache.put('rodizio_ult', us[0].id, 21600);
    return us[0].id;
  }

  function addTag(c, tag, user) {
    var t = U.tags(c.tags);
    if (t.indexOf(tag) >= 0) return false;
    t.push(tag);
    c.tags = t.join(', ');
    P.atualizar('Contatos', c.id, { tags: c.tags, atualizado_em: P.agora() });
    hist(c.id, '', user, 'tag', '+ ' + tag);
    gatilho('tag', c, { tag: tag });
    return true;
  }
  function remTag(c, tag, user) {
    var t = U.tags(c.tags);
    var i = t.indexOf(tag);
    if (i < 0) return false;
    t.splice(i, 1);
    c.tags = t.join(', ');
    P.atualizar('Contatos', c.id, { tags: c.tags, atualizado_em: P.agora() });
    hist(c.id, '', user, 'tag', '- ' + tag);
    return true;
  }

  /* ======================================================= variáveis/texto */
  function saudacao() {
    var h = Math.floor(U.horaMin(P.agora()) / 60);
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }
  /** Troca {variaveis} e sorteia {opção A|opção B} (spintax, ajuda a variar disparos). */
  function montarTexto(texto, c, user) {
    c = c || {};
    var cp = camposDe(c);
    var v = {
      nome: c.nome || '', primeiro_nome: U.primeiroNome(c.nome), telefone: c.telefone || '', email: c.email || '',
      empresa: c.empresa || '', cidade: c.cidade || '', atendente: user ? U.primeiroNome(user.nome) : '',
      minha_empresa: cfg().NOME, saudacao: saudacao(), data: P.agora().slice(0, 10).split('-').reverse().join('/')
    };
    Object.keys(cp).forEach(function (k) { if (!(k in v)) v[k] = cp[k]; });
    var s = U.str(texto).replace(/\{([^{}|]+\|[^{}]*)\}/g, function (m, op) {
      var ops = op.split('|');
      return ops[Math.floor(Math.random() * ops.length)];
    });
    return s.replace(/\{\s*([a-z0-9_]+)\s*\}/gi, function (m, k) {
      k = k.toLowerCase();
      return k in v ? U.str(v[k]) : m;
    });
  }

  /* ============================================================ WhatsApp */
  var WA = {};
  WA.provedor = function () { return cfg().WA_PROVEDOR || 'link'; };
  WA.temApi = function () { return WA.provedor() !== 'link'; };
  WA.urlWebhook = function () { return P.urlApp() + '?src=wa&k=' + encodeURIComponent(cfg().WEBHOOK_CHAVE); };
  WA.base = function (u) { return U.str(u).trim().replace(/\/+$/, ''); };

  function req(url, metodo, corpo, cab) {
    var r = P.http(url, { method: metodo || 'get', headers: cab || {}, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    var dados = U.json(r.text, null);
    if (r.code >= 300) {
      var msg = dados && (dados.message || dados.error || (dados.response && dados.response.message) || (dados.error && dados.error.message));
      if (Array.isArray(msg)) msg = msg.join('; ');
      if (msg && typeof msg === 'object') msg = JSON.stringify(msg);
      throw new Error('WhatsApp (' + r.code + '): ' + U.cap(msg || r.text || 'sem resposta', 220));
    }
    return dados;
  }

  /** destino: número (5511...) ou id de grupo (...@g.us). Devolve o id da mensagem no WhatsApp. */
  WA.enviar = function (destino, texto, midiaUrl, midiaTipo, extra) {
    var c = cfg(), p = WA.provedor();
    extra = extra || {};
    if (p === 'link') throw new Error('Sem API de WhatsApp configurada (modo link).');
    var ehGrupo = /@g\.us$/.test(destino);
    var num = ehGrupo ? destino : U.telWa(destino);
    if (!num) throw new Error('Telefone inválido.');
    midiaTipo = midiaTipo || (midiaUrl ? 'image' : '');
    var r;
    if (p === 'evolution') {
      var b = WA.base(c.EVOLUTION_URL), inst = encodeURIComponent(c.EVOLUTION_INSTANCIA), h = { apikey: c.EVOLUTION_APIKEY };
      if (!midiaUrl) r = req(b + '/message/sendText/' + inst, 'post', { number: num, text: texto }, h);
      else if (midiaTipo === 'audio') r = req(b + '/message/sendWhatsAppAudio/' + inst, 'post', { number: num, audio: midiaUrl }, h);
      else r = req(b + '/message/sendMedia/' + inst, 'post', {
        number: num, mediatype: midiaTipo, media: midiaUrl, caption: texto || '',
        fileName: midiaTipo === 'document' ? (midiaUrl.split('/').pop().split('?')[0] || 'arquivo.pdf') : undefined
      }, h);
      return (r && r.key && r.key.id) || '';
    }
    if (p === 'waha') {
      var bw = WA.base(c.WAHA_URL), hw = { 'X-Api-Key': c.WAHA_APIKEY }, chat = ehGrupo ? num : num + '@c.us', ses = c.WAHA_SESSAO || 'default';
      if (!midiaUrl) r = req(bw + '/api/sendText', 'post', { session: ses, chatId: chat, text: texto }, hw);
      else if (midiaTipo === 'image') r = req(bw + '/api/sendImage', 'post', { session: ses, chatId: chat, file: { url: midiaUrl }, caption: texto || '' }, hw);
      else if (midiaTipo === 'audio') r = req(bw + '/api/sendVoice', 'post', { session: ses, chatId: chat, file: { url: midiaUrl } }, hw);
      else r = req(bw + '/api/sendFile', 'post', { session: ses, chatId: chat, file: { url: midiaUrl }, caption: texto || '' }, hw);
      return (r && (r.id && (r.id._serialized || r.id))) || '';
    }
    if (p === 'meta') {
      if (ehGrupo) throw new Error('A API oficial da Meta não envia para grupos.');
      var url = 'https://graph.facebook.com/' + (c.META_VERSAO || 'v21.0') + '/' + c.META_PHONE_ID + '/messages';
      var hm = { Authorization: 'Bearer ' + c.META_TOKEN };
      var corpo = { messaging_product: 'whatsapp', to: num };
      if (extra.metaModelo && extra.metaModelo.nome) {
        corpo.type = 'template';
        corpo.template = { name: extra.metaModelo.nome, language: { code: extra.metaModelo.idioma || 'pt_BR' } };
        var params = (extra.metaModelo.parametros || []).map(function (t) { return { type: 'text', text: t }; });
        if (params.length) corpo.template.components = [{ type: 'body', parameters: params }];
      } else if (!midiaUrl) { corpo.type = 'text'; corpo.text = { body: texto, preview_url: true }; }
      else {
        corpo.type = midiaTipo;
        corpo[midiaTipo] = { link: midiaUrl };
        if (texto && midiaTipo !== 'audio') corpo[midiaTipo].caption = texto;
      }
      r = req(url, 'post', corpo, hm);
      return (r && r.messages && r.messages[0] && r.messages[0].id) || '';
    }
    throw new Error('Provedor de WhatsApp desconhecido: ' + p);
  };

  WA.status = function () {
    var c = cfg(), p = WA.provedor();
    if (p === 'link') return { conectado: false, estado: 'modo_link', texto: 'Modo link: as mensagens abrem no seu WhatsApp e você envia manualmente.' };
    try {
      if (p === 'evolution') {
        var r = req(WA.base(c.EVOLUTION_URL) + '/instance/connectionState/' + encodeURIComponent(c.EVOLUTION_INSTANCIA), 'get', undefined, { apikey: c.EVOLUTION_APIKEY });
        var st = (r && r.instance && r.instance.state) || (r && r.state) || 'desconhecido';
        return { conectado: st === 'open', estado: st, texto: st === 'open' ? 'Conectado' : 'Desconectado (' + st + ')' };
      }
      if (p === 'waha') {
        var w = req(WA.base(c.WAHA_URL) + '/api/sessions/' + encodeURIComponent(c.WAHA_SESSAO || 'default'), 'get', undefined, { 'X-Api-Key': c.WAHA_APIKEY });
        var sw = (w && w.status) || 'desconhecido';
        return { conectado: sw === 'WORKING', estado: sw, texto: sw === 'WORKING' ? 'Conectado' : 'Sessão: ' + sw };
      }
      if (p === 'meta') {
        var m = req('https://graph.facebook.com/' + (c.META_VERSAO || 'v21.0') + '/' + c.META_PHONE_ID + '?fields=display_phone_number,verified_name,quality_rating', 'get', undefined, { Authorization: 'Bearer ' + c.META_TOKEN });
        return { conectado: true, estado: 'ok', texto: 'Conectado: ' + (m.verified_name || '') + ' ' + (m.display_phone_number || '') };
      }
    } catch (e) { return { conectado: false, estado: 'erro', texto: e.message }; }
    return { conectado: false, estado: 'desconhecido', texto: '' };
  };

  /** Liga o número: cria a instância/sessão se preciso, aponta o webhook e devolve o QR Code. */
  WA.conectar = function () {
    var c = cfg(), p = WA.provedor(), hook = WA.urlWebhook();
    if (p === 'evolution') {
      var b = WA.base(c.EVOLUTION_URL), h = { apikey: c.EVOLUTION_APIKEY }, inst = c.EVOLUTION_INSTANCIA;
      if (!b || !c.EVOLUTION_APIKEY || !inst) throw new Error('Preencha URL, chave (apikey) e nome da instância.');
      var eventos = ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'];
      var qr = null;
      try {
        var cr = req(b + '/instance/create', 'post', {
          instanceName: inst, qrcode: true, integration: 'WHATSAPP-BAILEYS',
          webhook: { url: hook, byEvents: false, base64: false, events: eventos }
        }, h);
        qr = cr && cr.qrcode && cr.qrcode.base64;
      } catch (e) { /* instância já existe: segue para conectar */ }
      try { req(b + '/webhook/set/' + encodeURIComponent(inst), 'post', { webhook: { enabled: true, url: hook, webhookByEvents: false, webhookBase64: false, events: eventos } }, h); } catch (e2) { /* versões antigas */ }
      var st = WA.status();
      if (st.conectado) return { conectado: true, texto: 'Este número já está conectado.' };
      if (!qr) {
        var cn = req(b + '/instance/connect/' + encodeURIComponent(inst), 'get', undefined, h);
        qr = cn && (cn.base64 || (cn.qrcode && cn.qrcode.base64));
        if (cn && cn.pairingCode && !qr) return { conectado: false, codigo: cn.pairingCode };
      }
      return { conectado: false, qr: qr || '' };
    }
    if (p === 'waha') {
      var bw = WA.base(c.WAHA_URL), hw = { 'X-Api-Key': c.WAHA_APIKEY }, ses = c.WAHA_SESSAO || 'default';
      if (!bw) throw new Error('Preencha a URL do WAHA.');
      var conf = { webhooks: [{ url: hook, events: ['message', 'message.any'] }] };
      try { req(bw + '/api/sessions', 'post', { name: ses, start: true, config: conf }, hw); }
      catch (e3) { try { req(bw + '/api/sessions/' + encodeURIComponent(ses), 'put', { name: ses, config: conf }, hw); req(bw + '/api/sessions/' + encodeURIComponent(ses) + '/start', 'post', {}, hw); } catch (e4) { /* já rodando */ } }
      var sw = WA.status();
      if (sw.conectado) return { conectado: true, texto: 'Este número já está conectado.' };
      var q = req(bw + '/api/' + encodeURIComponent(ses) + '/auth/qr?format=image', 'get', undefined, { 'X-Api-Key': c.WAHA_APIKEY, Accept: 'application/json' });
      return { conectado: false, qr: q && q.data ? 'data:' + (q.mimetype || 'image/png') + ';base64,' + q.data : '' };
    }
    if (p === 'meta') return { conectado: WA.status().conectado, texto: 'Na API oficial não existe QR Code: o número é ligado no painel da Meta. Veja o tutorial.' };
    return { conectado: false, texto: 'Modo link não precisa conectar.' };
  };

  WA.grupos = function () {
    var c = cfg(), p = WA.provedor();
    if (p === 'evolution') {
      var r = req(WA.base(c.EVOLUTION_URL) + '/group/fetchAllGroups/' + encodeURIComponent(c.EVOLUTION_INSTANCIA) + '?getParticipants=false', 'get', undefined, { apikey: c.EVOLUTION_APIKEY });
      return (r || []).map(function (g) { return { jid: g.id, nome: g.subject, membros: g.size || 0 }; });
    }
    if (p === 'waha') {
      var w = req(WA.base(c.WAHA_URL) + '/api/' + encodeURIComponent(c.WAHA_SESSAO || 'default') + '/groups', 'get', undefined, { 'X-Api-Key': c.WAHA_APIKEY });
      var arr = Array.isArray(w) ? w : Object.keys(w || {}).map(function (k) { return w[k]; });
      return arr.map(function (g) { return { jid: (g.id && (g.id._serialized || g.id)) || g.JID || '', nome: g.subject || g.name || (g.groupMetadata && g.groupMetadata.subject) || '', membros: (g.participants || []).length }; });
    }
    throw new Error('Importar grupos funciona com Evolution API ou WAHA.');
  };

  WA.linkGrupo = function (jid) {
    var c = cfg();
    if (WA.provedor() !== 'evolution') return '';
    try {
      var r = req(WA.base(c.EVOLUTION_URL) + '/group/inviteCode/' + encodeURIComponent(c.EVOLUTION_INSTANCIA) + '?groupJid=' + encodeURIComponent(jid), 'get', undefined, { apikey: c.EVOLUTION_APIKEY });
      return (r && (r.inviteUrl || (r.inviteCode ? 'https://chat.whatsapp.com/' + r.inviteCode : ''))) || '';
    } catch (e) { return ''; }
  };

  /** Traduz o webhook de cada provedor para uma lista única de mensagens. */
  WA.ler = function (body) {
    var out = [];
    if (!body) return out;
    // Evolution API
    if (body.event && /messages[._]upsert/i.test(body.event)) {
      var lista = Array.isArray(body.data) ? body.data : (body.data && body.data.messages) || [body.data];
      lista.forEach(function (d) {
        if (!d || !d.key) return;
        var jid = U.str(d.key.remoteJid);
        if (/@lid$/.test(jid)) jid = U.str(d.key.remoteJidAlt || d.key.senderPn || d.senderPn || '');
        if (!jid || /@g\.us$|@broadcast|status@/.test(jid)) return;
        var m = d.message || {};
        var texto = m.conversation || (m.extendedTextMessage && m.extendedTextMessage.text) ||
          (m.imageMessage && m.imageMessage.caption) || (m.videoMessage && m.videoMessage.caption) ||
          (m.documentMessage && (m.documentMessage.caption || m.documentMessage.fileName)) ||
          (m.buttonsResponseMessage && m.buttonsResponseMessage.selectedDisplayText) ||
          (m.listResponseMessage && m.listResponseMessage.title) ||
          (m.templateButtonReplyMessage && m.templateButtonReplyMessage.selectedDisplayText) || '';
        var tipo = m.imageMessage ? 'imagem' : m.audioMessage ? 'audio' : m.videoMessage ? 'video' : m.documentMessage ? 'documento' : m.stickerMessage ? 'figurinha' : 'texto';
        out.push({ telefone: jid.split('@')[0].split(':')[0], nome: d.pushName || '', texto: texto, tipo: tipo, wa_id: d.key.id || '', deMim: !!d.key.fromMe });
      });
      return out;
    }
    // WAHA
    if (body.event && /^message(\.any)?$/.test(body.event) && body.payload) {
      var pl = body.payload;
      var de = U.str(pl.fromMe ? pl.to : pl.from);
      if (!de || /@g\.us$|status@|@newsletter/.test(de)) return out;
      if (/@lid$/.test(de)) de = U.str((pl._data && pl._data.key && (pl._data.key.remoteJidAlt || pl._data.key.senderPn)) || '');
      if (!de) return out;
      out.push({
        telefone: de.split('@')[0], nome: (pl._data && (pl._data.notifyName || pl._data.pushName)) || '', texto: pl.body || '',
        tipo: pl.hasMedia ? 'imagem' : 'texto', wa_id: U.str(pl.id && (pl.id._serialized || pl.id)), deMim: !!pl.fromMe, evento: body.event
      });
      return out;
    }
    // Meta (API oficial)
    if (body.object === 'whatsapp_business_account' && body.entry) {
      body.entry.forEach(function (en) {
        (en.changes || []).forEach(function (ch) {
          var v = ch.value || {};
          var nomes = {};
          (v.contacts || []).forEach(function (ct) { nomes[ct.wa_id] = ct.profile && ct.profile.name; });
          (v.messages || []).forEach(function (mm) {
            var t = (mm.text && mm.text.body) || (mm.button && mm.button.text) ||
              (mm.interactive && ((mm.interactive.button_reply && mm.interactive.button_reply.title) || (mm.interactive.list_reply && mm.interactive.list_reply.title))) ||
              (mm[mm.type] && mm[mm.type].caption) || '';
            var tp = { image: 'imagem', audio: 'audio', video: 'video', document: 'documento', sticker: 'figurinha' }[mm.type] || 'texto';
            out.push({ telefone: mm.from, nome: nomes[mm.from] || '', texto: t, tipo: tp, wa_id: mm.id, deMim: false });
          });
        });
      });
    }
    return out;
  };

  /* ============================================================ mensagens */
  function registrarMsg(c, m) {
    var reg = {
      id: P.id('M'), contato_id: c.id, direcao: m.direcao, tipo: m.tipo || 'texto', texto: U.cap(m.texto, 4000), midia_url: m.midia_url || '',
      status: m.status || '', erro: U.cap(m.erro, 300), usuario_id: m.usuario_id || '', origem: m.origem || '', wa_id: m.wa_id || '', criado_em: P.agora()
    };
    P.inserir('Mensagens', reg);
    var resumo = reg.texto || ({ imagem: '[imagem]', audio: '[áudio]', video: '[vídeo]', documento: '[documento]', figurinha: '[figurinha]' }[reg.tipo] || '');
    var mud = {
      ultima_msg: U.cap(resumo, 140), ultima_msg_em: reg.criado_em, ultima_direcao: reg.direcao,
      total_msgs: String(U.num(c.total_msgs) + 1), atualizado_em: reg.criado_em
    };
    if (m.direcao === 'in') mud.nao_lidas = String(U.num(c.nao_lidas) + 1);
    P.atualizar('Contatos', c.id, mud);
    Object.keys(mud).forEach(function (k) { c[k] = mud[k]; });
    return reg;
  }

  /** Envia uma mensagem a um contato agora e registra na conversa. */
  function enviarParaContato(c, texto, opc) {
    opc = opc || {};
    var reg = { direcao: 'out', texto: texto, tipo: opc.midia_url ? ({ image: 'imagem', video: 'video', audio: 'audio', document: 'documento' }[opc.midia_tipo] || 'imagem') : 'texto', midia_url: opc.midia_url || '', usuario_id: opc.user ? opc.user.id : '', origem: opc.origem || 'manual' };
    if (!c.telefone) { reg.status = 'erro'; reg.erro = 'Contato sem telefone'; registrarMsg(c, reg); throw new Error('Contato sem telefone.'); }
    if (!WA.temApi()) {
      reg.status = 'link';
      registrarMsg(c, reg);
      return { link: 'https://wa.me/' + U.telWa(c.telefone) + '?text=' + encodeURIComponent(texto || '') };
    }
    try {
      reg.wa_id = WA.enviar(c.telefone, texto, opc.midia_url, opc.midia_tipo, { metaModelo: opc.metaModelo });
      reg.status = 'enviada';
      registrarMsg(c, reg);
      if (reg.wa_id) P.cache.put('wa_' + reg.wa_id, '1', 3600);
      return { ok: true };
    } catch (e) {
      reg.status = 'erro'; reg.erro = e.message;
      registrarMsg(c, reg);
      throw e;
    }
  }

  /** Mensagem que chegou pelo webhook do WhatsApp. */
  function receber(m) {
    if (!m.telefone) return null;
    if (m.wa_id && P.cache.get('wa_' + m.wa_id)) return null; // eco de algo que o próprio sistema enviou
    if (m.wa_id) P.cache.put('wa_' + m.wa_id, '1', 3600);
    var r = gravarContato({ telefone: m.telefone, nome: m.deMim ? '' : m.nome, origem: 'WhatsApp' }, null, { naoSobrescrever: true, silencioso: true, semGatilhos: true });
    var c = r.contato;
    if (r.novo) hist(c.id, '', null, 'contato_criado', 'Chegou pelo WhatsApp');
    if (m.deMim) { // enviada pelo celular da empresa
      registrarMsg(c, { direcao: 'out', texto: m.texto, tipo: m.tipo, status: 'enviada', origem: 'celular', wa_id: m.wa_id });
      pausarRobo(c);
      return c;
    }
    registrarMsg(c, { direcao: 'in', texto: m.texto, tipo: m.tipo, status: 'recebida', origem: 'whatsapp', wa_id: m.wa_id });
    saida('mensagem.recebida', { contato: c, texto: m.texto });
    respostaDeCampanha(c);

    // descadastro
    var tn = U.norm(m.texto);
    var palavrasSair = U.lista(cfg().OPTOUT_PALAVRAS).map(U.norm);
    if (tn && palavrasSair.indexOf(tn) >= 0) {
      P.atualizar('Contatos', c.id, { optout: 'SIM' });
      c.optout = 'SIM';
      cancelarExecucoes(c.id);
      hist(c.id, '', null, 'optout', 'Pediu para sair: ' + m.texto);
      try { enviarParaContato(c, cfg().OPTOUT_RESPOSTA, { origem: 'robo' }); } catch (e) { /* segue */ }
      return c;
    }
    if (c.optout === 'SIM' && tn) { P.atualizar('Contatos', c.id, { optout: 'NAO' }); c.optout = 'NAO'; }

    // uma automação esperando resposta tem prioridade
    var esperando = P.tabela('Execucoes').filter(function (e) { return e.contato_id === c.id && e.status === 'esperando_resposta'; })[0];
    if (esperando) { continuarComResposta(esperando, c, m.texto); return c; }
    if (roboPausado(c)) return c;
    if (r.novo) gatilho('primeira_mensagem', c, { texto: m.texto });
    gatilho('palavra', c, { texto: m.texto });
    return c;
  }

  function roboPausado(c) { return !!(c.bot_pausado_ate && c.bot_pausado_ate > P.agora()); }
  function pausarRobo(c) {
    var h = U.num(cfg().BOT_PAUSA_HORAS);
    if (!h) return;
    var ate = U.somaTempo(P.agora(), h * 60);
    P.atualizar('Contatos', c.id, { bot_pausado_ate: ate });
    c.bot_pausado_ate = ate;
  }

  function respostaDeCampanha(c) {
    // conta a primeira resposta do contato depois de um disparo das últimas 72h
    var limite = U.somaTempo(P.agora(), -72 * 60);
    var chave = 'resp_' + c.id;
    if (P.cache.get(chave)) return;
    var ult = P.tabela('Fila').filter(function (f) { return f.contato_id === c.id && f.tipo === 'campanha' && f.status === 'enviado' && f.enviado_em >= limite; })
      .sort(function (a, b) { return a.enviado_em < b.enviado_em ? 1 : -1; })[0];
    if (!ult) return;
    var camp = P.tabela('Campanhas').filter(function (x) { return x.id === ult.ref_id; })[0];
    if (!camp) return;
    P.atualizar('Campanhas', camp.id, { respostas: String(U.num(camp.respostas) + 1) });
    P.cache.put(chave, '1', 72 * 3600);
  }

  /* ======================================================== automações */
  function automacoesAtivas() {
    return P.tabela('Automacoes').filter(function (a) { return a.ativo === 'SIM'; }).map(function (a) {
      return { reg: a, g: U.json(a.gatilho, {}) || {} };
    });
  }

  function gatilho(tipo, c, info) {
    if (!c || c.optout === 'SIM') return;
    var lista = automacoesAtivas().filter(function (x) { return x.g.tipo === tipo; });
    lista.forEach(function (x) {
      var g = x.g, ok = false;
      if (tipo === 'palavra') {
        var t = U.norm(info.texto);
        var pal = U.lista(g.palavras).map(U.norm);
        ok = pal.some(function (p) { return g.modo === 'exata' ? t === p : (p && t.indexOf(p) >= 0); });
        if (!pal.length && g.qualquer) ok = !!t;
      } else if (tipo === 'tag') ok = U.norm(g.tag) === U.norm(info.tag);
      else if (tipo === 'etapa') ok = g.etapa_id === info.etapa_id;
      else if (tipo === 'novo_contato') ok = !g.origem || U.norm(g.origem) === U.norm(info.origem);
      else if (tipo === 'webhook') ok = !g.origem || U.norm(g.origem) === U.norm(info.origem);
      else ok = true;
      if (ok) iniciarAutomacao(x.reg, c, info);
    });
  }

  function iniciarAutomacao(a, c, info) {
    if (!c.telefone && passosDe(a).some(function (s) { return s.tipo === 'mensagem' || s.tipo === 'pergunta' || s.tipo === 'menu'; })) return null;
    var execs = P.tabela('Execucoes').filter(function (e) { return e.automacao_id === a.id && e.contato_id === c.id; });
    if (execs.some(function (e) { return e.status === 'esperando_tempo' || e.status === 'esperando_resposta' || e.status === 'rodando'; })) return null;
    if (a.uma_vez === 'SIM' && execs.length) return null;
    // um contato só fica preso a uma pergunta por vez
    if (passosDe(a).some(function (s) { return s.tipo === 'pergunta' || s.tipo === 'menu'; })) {
      P.tabela('Execucoes').filter(function (e) { return e.contato_id === c.id && e.status === 'esperando_resposta'; })
        .forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'substituida', atualizado_em: P.agora() }); });
    }
    var passos = passosDe(a);
    if (!passos.length) return null;
    var ex = { id: P.id('E'), automacao_id: a.id, contato_id: c.id, passo_id: passos[0].id, status: 'rodando', acordar_em: '', tentativas: '0', criado_em: P.agora(), atualizado_em: P.agora() };
    P.inserir('Execucoes', ex);
    P.atualizar('Automacoes', a.id, { disparos: String(U.num(a.disparos) + 1) });
    a.disparos = String(U.num(a.disparos) + 1);
    hist(c.id, '', null, 'automacao', 'Entrou em "' + a.nome + '"');
    rodar(ex, c, a);
    return ex;
  }

  function passosDe(a) { return (U.json(a.passos, []) || []).filter(function (s) { return s && s.id; }); }

  function cancelarExecucoes(contatoId) {
    P.tabela('Execucoes').filter(function (e) { return e.contato_id === contatoId && (e.status === 'esperando_tempo' || e.status === 'esperando_resposta' || e.status === 'rodando'); })
      .forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'cancelada', atualizado_em: P.agora() }); });
  }

  function proximoId(passos, atualId) {
    var i = passos.findIndex(function (s) { return s.id === atualId; });
    return i >= 0 && i + 1 < passos.length ? passos[i + 1].id : 'fim';
  }

  function concluir(ex, a, status) {
    P.atualizar('Execucoes', ex.id, { status: status || 'concluida', passo_id: '', acordar_em: '', atualizado_em: P.agora() });
    if (!status || status === 'concluida') P.atualizar('Automacoes', a.id, { concluidas: String(U.num(a.concluidas) + 1) });
  }

  function avaliarCondicao(s, c) {
    var cp = camposDe(c), v;
    if (s.se === 'tag') { var tem = U.tags(c.tags).map(U.norm).indexOf(U.norm(s.valor)) >= 0; return s.op === 'nao_tem' ? !tem : tem; }
    if (s.se === 'etapa') {
      var neg = P.tabela('Negocios').filter(function (n) { return n.contato_id === c.id && n.status === 'aberto'; });
      var esta = neg.some(function (n) { return n.etapa_id === s.valor; });
      return s.op === 'nao_tem' ? !esta : esta;
    }
    if (s.se === 'horario') {
      var hm = U.horaMin(P.agora());
      var ini = U.horaMin('T' + (s.inicio || '08:00')), fim = U.horaMin('T' + (s.fim || '18:00'));
      var dentro = hm >= ini && hm < fim && U.lista(s.dias || '1,2,3,4,5').indexOf(String(U.diaSemana(P.agora()))) >= 0;
      return dentro;
    }
    v = s.campo in c && ['nome', 'email', 'empresa', 'cidade', 'cargo', 'origem', 'status'].indexOf(s.campo) >= 0 ? c[s.campo] : cp[s.campo];
    v = U.norm(v);
    var alvo = U.norm(s.valor);
    if (s.op === 'vazio') return !v;
    if (s.op === 'preenchido') return !!v;
    if (s.op === 'igual') return v === alvo;
    if (s.op === 'diferente') return v !== alvo;
    if (s.op === 'contem') return v.indexOf(alvo) >= 0;
    if (s.op === 'maior') return U.num(v) > U.num(alvo);
    if (s.op === 'menor') return U.num(v) < U.num(alvo);
    return false;
  }

  function textoMenu(s) {
    var linhas = (s.opcoes || []).map(function (o, i) { return '*' + (i + 1) + '* - ' + o.rotulo; });
    return (s.texto || '') + (linhas.length ? '\n\n' + linhas.join('\n') : '');
  }

  /** Executa passos até precisar esperar (tempo ou resposta) ou terminar. */
  function rodar(ex, c, a) {
    var passos = passosDe(a);
    var atual = ex.passo_id;
    var limite = 25, enviadas = 0;
    var mapa = {};
    passos.forEach(function (s) { mapa[s.id] = s; });
    while (limite-- > 0) {
      if (!atual || atual === 'fim' || !mapa[atual]) { concluir(ex, a); return; }
      var s = mapa[atual];
      var prox = proximoId(passos, atual);
      try {
        if (s.tipo === 'mensagem' || s.tipo === 'pergunta' || s.tipo === 'menu') {
          if (c.optout === 'SIM') { concluir(ex, a, 'cancelada'); return; }
          if (enviadas++ && P.dormir) P.dormir(1200);
          var txt = s.tipo === 'menu' ? textoMenu(s) : s.texto;
          if (WA.temApi()) enviarParaContato(c, montarTexto(txt, c), { origem: 'robo', midia_url: s.midia_url, midia_tipo: s.midia_tipo });
          else registrarMsg(c, { direcao: 'out', texto: montarTexto(txt, c), status: 'pendente_link', origem: 'robo' });
          if (s.tipo !== 'mensagem') {
            var mudP = { passo_id: s.id, status: 'esperando_resposta', acordar_em: s.expira_horas ? U.somaTempo(P.agora(), U.num(s.expira_horas) * 60) : '', tentativas: '0', atualizado_em: P.agora() };
            P.atualizar('Execucoes', ex.id, mudP);
            if (mudP.acordar_em) marcarTrabalho(mudP.acordar_em);
            return;
          }
        } else if (s.tipo === 'esperar') {
          var min = U.num(s.valor) * ({ minutos: 1, horas: 60, dias: 1440 }[s.unidade] || 1);
          var acordar = U.somaTempo(P.agora(), Math.max(1, min));
          P.atualizar('Execucoes', ex.id, { passo_id: prox, status: 'esperando_tempo', acordar_em: acordar, atualizado_em: P.agora() });
          marcarTrabalho(acordar);
          return;
        } else if (s.tipo === 'tag') {
          if (s.acao === 'remover') remTag(c, s.tag, null); else addTag(c, s.tag, null);
        } else if (s.tipo === 'etapa') {
          moverContatoParaEtapa(c, s.etapa_id, null);
        } else if (s.tipo === 'atribuir') {
          var resp = s.modo === 'usuario' ? s.usuario_id : proximoDoRodizio();
          if (resp) { P.atualizar('Contatos', c.id, { responsavel_id: resp, atualizado_em: P.agora() }); c.responsavel_id = resp; hist(c.id, '', null, 'atribuido', resp); }
        } else if (s.tipo === 'status') {
          P.atualizar('Contatos', c.id, { status: s.valor, atualizado_em: P.agora() }); c.status = s.valor;
        } else if (s.tipo === 'campo') {
          gravarCampo(c, s.campo, montarTexto(s.valor, c));
        } else if (s.tipo === 'humano') {
          var hrs = U.num(s.horas) || 24;
          var ate = U.somaTempo(P.agora(), hrs * 60);
          P.atualizar('Contatos', c.id, { bot_pausado_ate: ate }); c.bot_pausado_ate = ate;
          P.inserir('Tarefas', { id: P.id('T'), titulo: s.titulo || 'Atender ' + c.nome + ' (pediu atendimento)', tipo: 'whatsapp', contato_id: c.id, negocio_id: '', responsavel_id: c.responsavel_id || '', vence_em: P.agora(), feita: 'NAO', notas: 'Criada pela automação "' + a.nome + '"', criado_em: P.agora() });
        } else if (s.tipo === 'tarefa') {
          P.inserir('Tarefas', { id: P.id('T'), titulo: montarTexto(s.titulo || 'Retornar contato', c), tipo: s.tipo_tarefa || 'whatsapp', contato_id: c.id, negocio_id: '', responsavel_id: c.responsavel_id || '', vence_em: U.somaTempo(P.agora(), (U.num(s.prazo_horas) || 24) * 60), feita: 'NAO', notas: 'Criada pela automação "' + a.nome + '"', criado_em: P.agora() });
        } else if (s.tipo === 'webhook') {
          if (s.url) try { P.http(s.url, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evento: 'automacao', automacao: a.nome, contato: contatoPublico(c) }) }); } catch (e) { /* segue */ }
        } else if (s.tipo === 'condicao') {
          var r = avaliarCondicao(s, c);
          var dest = r ? s.sim : s.nao;
          if (dest) prox = dest;
        } else if (s.tipo === 'ir') {
          prox = s.passo || 'fim';
        } else if (s.tipo === 'fim') {
          prox = 'fim';
        }
      } catch (err) {
        hist(c.id, '', null, 'automacao_erro', a.nome + ': ' + err.message);
      }
      atual = prox;
      P.atualizar('Execucoes', ex.id, { passo_id: atual, status: 'rodando', atualizado_em: P.agora() });
    }
    concluir(ex, a, 'interrompida');
  }

  function gravarCampo(c, campo, valor) {
    if (!campo) return;
    var padrao = ['nome', 'email', 'empresa', 'cidade', 'cargo', 'notas'];
    if (padrao.indexOf(campo) >= 0) {
      var m = {}; m[campo] = campo === 'email' ? U.str(valor).trim().toLowerCase() : U.cap(valor, 500); m.atualizado_em = P.agora();
      P.atualizar('Contatos', c.id, m); c[campo] = m[campo];
    } else {
      var cp = camposDe(c); cp[campo] = U.cap(valor, 500);
      c.campos = JSON.stringify(cp);
      P.atualizar('Contatos', c.id, { campos: c.campos, atualizado_em: P.agora() });
    }
  }

  function continuarComResposta(ex, c, texto) {
    var a = P.tabela('Automacoes').filter(function (x) { return x.id === ex.automacao_id; })[0];
    if (!a) { P.atualizar('Execucoes', ex.id, { status: 'cancelada' }); return; }
    var passos = passosDe(a);
    var s = passos.filter(function (x) { return x.id === ex.passo_id; })[0];
    if (!s) { concluir(ex, a); return; }
    var prox = proximoId(passos, s.id);
    var resp = U.str(texto).trim();
    if (s.tipo === 'pergunta') {
      var valido = true;
      if (s.validar === 'email') valido = U.emailOk(resp);
      else if (s.validar === 'numero') valido = /\d/.test(resp);
      else if (s.validar === 'telefone') valido = U.dig(resp).length >= 10;
      if (!valido) {
        var t = U.num(ex.tentativas) + 1;
        if (t < 3) {
          P.atualizar('Execucoes', ex.id, { tentativas: String(t), atualizado_em: P.agora() });
          try { enviarParaContato(c, s.erro_texto || 'Não entendi. Pode responder de novo?', { origem: 'robo' }); } catch (e) { /* segue */ }
          return;
        }
      } else if (s.campo) gravarCampo(c, s.campo, s.validar === 'telefone' ? U.telWa(resp) : resp);
    } else if (s.tipo === 'menu') {
      var ops = s.opcoes || [];
      var n = parseInt(U.dig(resp.slice(0, 3)), 10);
      var escolhida = (n >= 1 && n <= ops.length) ? ops[n - 1] : ops.filter(function (o) { return U.norm(o.rotulo) === U.norm(resp) || (U.norm(resp).length > 2 && U.norm(o.rotulo).indexOf(U.norm(resp)) >= 0); })[0];
      if (!escolhida) {
        var t2 = U.num(ex.tentativas) + 1;
        if (t2 < 3) {
          P.atualizar('Execucoes', ex.id, { tentativas: String(t2), atualizado_em: P.agora() });
          try { enviarParaContato(c, s.erro_texto || 'Responda só com o número da opção, por favor.', { origem: 'robo' }); } catch (e) { /* segue */ }
          return;
        }
      } else {
        if (s.campo) gravarCampo(c, s.campo, escolhida.rotulo);
        if (escolhida.ir) prox = escolhida.ir;
      }
    }
    ex.passo_id = prox;
    P.atualizar('Execucoes', ex.id, { passo_id: prox, status: 'rodando', acordar_em: '', tentativas: '0', atualizado_em: P.agora() });
    rodar(ex, c, a);
  }

  /* =========================================================== negócios */
  function moverContatoParaEtapa(c, etapaId, user) {
    var et = P.tabela('Etapas').filter(function (e) { return e.id === etapaId; })[0];
    if (!et) return null;
    var neg = P.tabela('Negocios').filter(function (n) { return n.contato_id === c.id && n.funil_id === et.funil_id && n.status === 'aberto'; })[0];
    if (neg) return moverNegocio(neg, etapaId, user);
    var n = {
      id: P.id('N'), titulo: c.nome, contato_id: c.id, funil_id: et.funil_id, etapa_id: et.id, valor: '0', responsavel_id: c.responsavel_id || '',
      status: et.tipo === 'ganho' ? 'ganho' : et.tipo === 'perdido' ? 'perdido' : 'aberto', motivo_perda: '', previsao: '', notas: '',
      criado_em: P.agora(), atualizado_em: P.agora(), fechado_em: et.tipo === 'ganho' || et.tipo === 'perdido' ? P.agora() : ''
    };
    P.inserir('Negocios', n);
    hist(c.id, n.id, user, 'negocio_criado', et.nome);
    gatilho('etapa', c, { etapa_id: et.id });
    return n;
  }

  function moverNegocio(n, etapaId, user, motivo) {
    var et = P.tabela('Etapas').filter(function (e) { return e.id === etapaId; })[0];
    if (!et) throw new Error('Etapa não encontrada.');
    var mud = { etapa_id: et.id, funil_id: et.funil_id, atualizado_em: P.agora() };
    if (et.tipo === 'ganho') { mud.status = 'ganho'; mud.fechado_em = P.agora(); }
    else if (et.tipo === 'perdido') { mud.status = 'perdido'; mud.fechado_em = P.agora(); mud.motivo_perda = motivo || n.motivo_perda || ''; }
    else { mud.status = 'aberto'; mud.fechado_em = ''; }
    P.atualizar('Negocios', n.id, mud);
    Object.keys(mud).forEach(function (k) { n[k] = mud[k]; });
    hist(n.contato_id, n.id, user, 'etapa', et.nome + (motivo ? ' (' + motivo + ')' : ''));
    var c = contatoPorId(n.contato_id);
    if (mud.status === 'ganho') {
      if (c && c.status !== 'cliente') { P.atualizar('Contatos', c.id, { status: 'cliente', atualizado_em: P.agora() }); c.status = 'cliente'; }
      saida('negocio.ganho', { negocio: n, contato: c ? contatoPublico(c) : null });
    }
    if (mud.status === 'perdido') saida('negocio.perdido', { negocio: n, contato: c ? contatoPublico(c) : null });
    if (c) gatilho('etapa', c, { etapa_id: et.id });
    return n;
  }

  /* ========================================================= disparos */
  var VELOCIDADE = { lenta: 90, normal: 45, rapida: 25 }; // segundos médios entre mensagens

  function filtrarContatos(f, base) {
    f = f || {};
    var negs = null;
    if (f.etapas && f.etapas.length) {
      negs = {};
      P.tabela('Negocios').forEach(function (n) { if (n.status === 'aberto' && f.etapas.indexOf(n.etapa_id) >= 0) negs[n.contato_id] = 1; });
    }
    var inc = (f.tags || []).map(U.norm), exc = (f.sem_tags || []).map(U.norm);
    var busca = U.norm(f.busca);
    var desde = f.criado_dias ? U.somaTempo(P.agora(), -U.num(f.criado_dias) * 1440) : '';
    var semConversa = f.sem_conversa_dias ? U.somaTempo(P.agora(), -U.num(f.sem_conversa_dias) * 1440) : '';
    return (base || P.tabela('Contatos')).filter(function (c) {
      var t = U.tags(c.tags).map(U.norm);
      if (inc.length && (f.tags_modo === 'todas' ? !inc.every(function (x) { return t.indexOf(x) >= 0; }) : !inc.some(function (x) { return t.indexOf(x) >= 0; }))) return false;
      if (exc.some(function (x) { return t.indexOf(x) >= 0; })) return false;
      if (f.status && f.status.length && f.status.indexOf(c.status) < 0) return false;
      if (f.origens && f.origens.length && f.origens.map(U.norm).indexOf(U.norm(c.origem)) < 0) return false;
      if (f.responsavel_id && (f.responsavel_id === '_sem' ? c.responsavel_id : c.responsavel_id !== f.responsavel_id)) return false;
      if (negs && !negs[c.id]) return false;
      if (desde && c.criado_em < desde) return false;
      if (semConversa && c.ultima_msg_em && c.ultima_msg_em > semConversa) return false;
      if (busca && U.norm([c.nome, c.telefone, c.email, c.empresa].join(' ')).indexOf(busca) < 0) return false;
      return true;
    });
  }

  function publicoCampanha(camp) {
    if (camp.destino === 'grupos') {
      var ids = U.json(camp.grupos, []) || [];
      return P.tabela('Grupos').filter(function (g) { return ids.indexOf(g.id) >= 0 && g.jid; });
    }
    return filtrarContatos(U.json(camp.filtro, {})).filter(function (c) { return c.telefone && c.optout !== 'SIM'; });
  }

  function iniciarCampanha(camp) {
    var alvo = publicoCampanha(camp);
    if (!alvo.length) throw new Error('Nenhum destinatário com telefone válido para este público.');
    var media = VELOCIDADE[camp.velocidade] || VELOCIDADE.normal;
    var inicio = camp.agendar_em && camp.agendar_em > P.agora() ? camp.agendar_em : P.agora();
    var t = 0, linhas = [];
    alvo.forEach(function (x, i) {
      if (i) t += Math.round(media * (0.6 + Math.random() * 0.8));
      linhas.push({
        id: P.id('F') + i, tipo: 'campanha', ref_id: camp.id, contato_id: camp.destino === 'grupos' ? '' : x.id,
        destino: camp.destino === 'grupos' ? x.jid : x.telefone, texto: '', midia_url: camp.midia_url || '', midia_tipo: camp.midia_tipo || '',
        enviar_em: U.somaTempo(inicio, t / 60), status: 'pendente', erro: '', criado_em: P.agora(), enviado_em: ''
      });
    });
    P.inserirVarios('Fila', linhas);
    var mud = { status: 'enviando', total: String(linhas.length), enviados: '0', erros: '0', iniciada_em: P.agora() };
    P.atualizar('Campanhas', camp.id, mud);
    marcarTrabalho(linhas[0].enviar_em);
    return { total: linhas.length, previsao_fim: linhas[linhas.length - 1].enviar_em };
  }

  function dentroDoHorario(iso) {
    var c = cfg();
    var hm = U.horaMin(iso);
    var dias = U.lista(c.DIAS_ENVIO);
    return hm >= U.horaMin('T' + c.HORARIO_INICIO) && hm < U.horaMin('T' + c.HORARIO_FIM) && (!dias.length || dias.indexOf(String(U.diaSemana(iso))) >= 0);
  }

  function marcarTrabalho(quando) {
    var atual = cfg().PROX_TRABALHO;
    if (!atual || quando < atual || atual < P.agora()) salvarCfg({ PROX_TRABALHO: quando });
  }

  /** Roda a cada minuto (gatilho do Apps Script / intervalo no modo demo). */
  function trabalhar(maxEnvios) {
    var agora = P.agora();
    var prox = cfg().PROX_TRABALHO;
    if (prox && prox > agora) return { pulou: true };
    var enviados = 0, erros = 0, acordadas = 0;
    maxEnvios = maxEnvios || 8;

    // 1) campanhas agendadas que chegaram na hora
    P.tabela('Campanhas').filter(function (c) { return c.status === 'agendada' && c.agendar_em && c.agendar_em <= agora; })
      .forEach(function (c) { try { iniciarCampanha(c); } catch (e) { P.atualizar('Campanhas', c.id, { status: 'erro' }); } });

    // 2) automações que estavam esperando um tempo
    P.tabela('Execucoes').filter(function (e) { return (e.status === 'esperando_tempo' || e.status === 'esperando_resposta') && e.acordar_em && e.acordar_em <= agora; })
      .slice(0, 20).forEach(function (e) {
        var a = P.tabela('Automacoes').filter(function (x) { return x.id === e.automacao_id; })[0];
        var c = contatoPorId(e.contato_id);
        if (!a || !c) { P.atualizar('Execucoes', e.id, { status: 'cancelada' }); return; }
        if (e.status === 'esperando_resposta') { // pergunta sem resposta: segue o fluxo indicado ou encerra
          var passos = passosDe(a);
          var s = passos.filter(function (x) { return x.id === e.passo_id; })[0];
          var dest = (s && s.sem_resposta) || 'fim';
          e.passo_id = dest;
        }
        if (a.ativo !== 'SIM') { P.atualizar('Execucoes', e.id, { status: 'pausada' }); return; }
        acordadas++;
        P.atualizar('Execucoes', e.id, { status: 'rodando', acordar_em: '', passo_id: e.passo_id });
        rodar(e, c, a);
      });

    // 3) fila de envios (disparos)
    if (WA.temApi()) {
      var campanhas = {};
      P.tabela('Campanhas').forEach(function (c) { campanhas[c.id] = c; });
      var pend = P.tabela('Fila').filter(function (f) { return f.status === 'pendente' && f.enviar_em <= agora; })
        .sort(function (a, b) { return a.enviar_em < b.enviar_em ? -1 : 1; });
      var podeAgora = dentroDoHorario(agora);
      for (var i = 0; i < pend.length && enviados + erros < maxEnvios; i++) {
        var f = pend[i];
        var camp = campanhas[f.ref_id];
        if (f.tipo === 'campanha') {
          if (!camp || camp.status === 'cancelada') { P.atualizar('Fila', f.id, { status: 'cancelado' }); continue; }
          if (camp.status !== 'enviando' || !podeAgora) continue;
        }
        var c = f.contato_id ? contatoPorId(f.contato_id) : null;
        if (c && c.optout === 'SIM') { P.atualizar('Fila', f.id, { status: 'cancelado', erro: 'Pediu para sair' }); continue; }
        var texto = montarTexto(f.texto || (camp ? camp.texto : ''), c || {});
        try {
          if (enviados + erros > 0 && P.dormir) P.dormir(1000 + Math.floor(Math.random() * 1500));
          if (c) {
            var meta = camp && U.json(camp.meta_modelo, null);
            if (meta && meta.nome) meta.parametros = (meta.variaveis || []).map(function (v) { return montarTexto(v, c); });
            enviarParaContato(c, texto, { origem: f.tipo, midia_url: f.midia_url, midia_tipo: f.midia_tipo, metaModelo: meta && meta.nome ? meta : null });
          } else WA.enviar(f.destino, texto, f.midia_url, f.midia_tipo);
          P.atualizar('Fila', f.id, { status: 'enviado', enviado_em: P.agora() });
          if (camp) { camp.enviados = String(U.num(camp.enviados) + 1); P.atualizar('Campanhas', camp.id, { enviados: camp.enviados }); }
          enviados++;
        } catch (e) {
          P.atualizar('Fila', f.id, { status: 'erro', erro: U.cap(e.message, 300), enviado_em: P.agora() });
          if (camp) { camp.erros = String(U.num(camp.erros) + 1); P.atualizar('Campanhas', camp.id, { erros: camp.erros }); }
          erros++;
        }
      }
      // campanhas que terminaram
      Object.keys(campanhas).forEach(function (id) {
        var cp = campanhas[id];
        if (cp.status === 'enviando' && U.num(cp.enviados) + U.num(cp.erros) >= U.num(cp.total) && U.num(cp.total) > 0) {
          P.atualizar('Campanhas', id, { status: 'concluida', concluida_em: P.agora() });
        }
      });
    }

    // 4) quando é o próximo trabalho?
    var futuros = [];
    P.tabela('Fila').forEach(function (f) { if (f.status === 'pendente') futuros.push(f.enviar_em); });
    P.tabela('Execucoes').forEach(function (e) { if ((e.status === 'esperando_tempo' || e.status === 'esperando_resposta') && e.acordar_em) futuros.push(e.acordar_em); });
    P.tabela('Campanhas').forEach(function (c) { if (c.status === 'agendada' && c.agendar_em) futuros.push(c.agendar_em); });
    futuros.sort();
    var proxNovo = futuros[0] || '9999-12-31T00:00:00';
    if (proxNovo < P.agora()) proxNovo = '';
    salvarCfg({ PROX_TRABALHO: proxNovo });
    return { enviados: enviados, erros: erros, acordadas: acordadas };
  }

  /* ========================================================= webhooks */
  function contatoPublico(c) {
    return { id: c.id, nome: c.nome, telefone: c.telefone, email: c.email, empresa: c.empresa, origem: c.origem, tags: U.tags(c.tags), status: c.status, campos: camposDe(c) };
  }

  /** Avisa sistemas externos (n8n, Make, Zapier...) sobre eventos. */
  function saida(evento, dados) {
    var lista = U.json(cfg().WEBHOOKS_SAIDA, []) || [];
    lista.forEach(function (w) {
      if (!w || !w.url) return;
      if (w.eventos && w.eventos.length && w.eventos.indexOf(evento) < 0) return;
      try {
        if (dados && dados.contato && dados.contato.campos && typeof dados.contato.campos === 'string') dados.contato = contatoPublico(dados.contato);
        P.http(w.url, { method: 'post', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evento: evento, sistema: cfg().NOME, data: P.agora(), dados: dados }) });
      } catch (e) { /* não interrompe */ }
    });
  }

  /** Achata um JSON qualquer: {a:{b:1}} -> {'a.b':1}. Ajuda a achar nome/e-mail/telefone em qualquer formulário. */
  function achatar(obj, pref, out, nivel) {
    out = out || {}; nivel = nivel || 0;
    if (nivel > 6 || obj === null || obj === undefined) return out;
    if (typeof obj !== 'object') { out[pref || 'valor'] = obj; return out; }
    Object.keys(obj).forEach(function (k) {
      var chave = pref ? pref + '.' + k : k;
      if (obj[k] && typeof obj[k] === 'object') achatar(obj[k], chave, out, nivel + 1);
      else out[chave] = obj[k];
    });
    return out;
  }
  var ALVOS = {
    nome: ['nome', 'name', 'full_name', 'fullname', 'nome_completo', 'first_name', 'firstname', 'buyer.name', 'customer.full_name', 'contact.name', 'your-name'],
    email: ['email', 'e-mail', 'mail', 'buyer.email', 'customer.email', 'contact.email', 'your-email'],
    telefone: ['telefone', 'phone', 'whatsapp', 'celular', 'fone', 'tel', 'mobile', 'phone_number', 'checkout_phone', 'buyer.checkout_phone', 'customer.mobile', 'contact.phone_number', 'your-phone'],
    empresa: ['empresa', 'company', 'organizacao', 'company_name'],
    cidade: ['cidade', 'city'],
    cargo: ['cargo', 'job_title', 'role']
  };
  function acharValor(plano, alvos) {
    var chaves = Object.keys(plano);
    for (var i = 0; i < alvos.length; i++) {
      var a = U.norm(alvos[i]);
      for (var j = 0; j < chaves.length; j++) {
        var k = U.norm(chaves[j]);
        if ((k === a || k.slice(-(a.length + 1)) === '.' + a) && U.str(plano[chaves[j]]).trim()) return U.str(plano[chaves[j]]).trim();
      }
    }
    return '';
  }

  function webhookEntrada(body, p) {
    var plano = achatar(body);
    var d = {};
    Object.keys(ALVOS).forEach(function (k) { d[k] = acharValor(plano, ALVOS[k]); });
    if (!d.nome) { var fn = acharValor(plano, ['first_name', 'primeiro_nome']), ln = acharValor(plano, ['last_name', 'sobrenome']); if (fn) d.nome = (fn + ' ' + ln).trim(); }
    if (!d.telefone && !d.email) throw new Error('Não encontrei telefone nem e-mail no que chegou.');
    d.origem = p.origem || acharValor(plano, ['origem', 'utm_source', 'source']) || 'Webhook';
    d.tags = U.lista(p.tags);
    var conhecidos = {};
    Object.keys(ALVOS).forEach(function (k) { ALVOS[k].forEach(function (x) { conhecidos[U.norm(x)] = 1; }); });
    var extras = {};
    var camposPers = (U.json(cfg().CAMPOS_PERSONALIZADOS, []) || []).map(function (x) { return x.chave; });
    Object.keys(plano).forEach(function (k) {
      var ult = U.norm(k.split('.').pop());
      if (camposPers.indexOf(ult) >= 0 && U.str(plano[k]).trim()) extras[ult] = U.cap(plano[k], 300);
      if (/^utm_/.test(ult) && U.str(plano[k]).trim()) extras[ult] = U.cap(plano[k], 200);
    });
    if (Object.keys(extras).length) d.campos = extras;
    var r = gravarContato(d, null, {});
    if (p.etapa) moverContatoParaEtapa(r.contato, p.etapa, null);
    gatilho('webhook', r.contato, { origem: d.origem });
    if (p.automacao) {
      var a = P.tabela('Automacoes').filter(function (x) { return x.id === p.automacao; })[0];
      if (a) iniciarAutomacao(a, r.contato, {});
    }
    return { ok: true, contato_id: r.contato.id, novo: r.novo };
  }

  /** Ponto de entrada de tudo que chega de fora (webhooks). p = parâmetros da URL. */
  function receberWebhook(p, body) {
    var c = cfg();
    var chave = p.src === 'wa' ? c.WEBHOOK_CHAVE : (c.ENTRADA_CHAVE || c.WEBHOOK_CHAVE);
    if (!chave || p.k !== chave) throw new Error('Chave do webhook inválida.');
    if (p.src === 'wa') {
      var msgs = WA.ler(body);
      if (body && body.event && /connection[._]update/i.test(body.event)) {
        var st = body.data && body.data.state;
        if (st) P.cache.put('wa_estado', st, 21600);
      }
      var n = 0;
      msgs.forEach(function (m) { if (receber(m)) n++; });
      return { ok: true, mensagens: n };
    }
    if (p.src === 'entrada') return webhookEntrada(body, p);
    throw new Error('Webhook desconhecido.');
  }

  /* ========================================================= relatórios */
  function relatorio(user, b) {
    var de = b.de || U.somaTempo(P.agora(), -30 * 1440).slice(0, 10);
    var ate = b.ate || P.agora().slice(0, 10);
    var dentro = function (s) { s = U.str(s).slice(0, 10); return s >= de && s <= ate; };
    var contatos = P.tabela('Contatos'), negocios = P.tabela('Negocios'), msgs = P.tabela('Mensagens');
    var porDia = {};
    var dia = function (s) { return U.str(s).slice(0, 10); };
    var add = function (k, campo) { if (!porDia[k]) porDia[k] = { dia: k, contatos: 0, recebidas: 0, enviadas: 0, ganhos: 0, valor: 0 }; porDia[k][campo]++; };
    contatos.forEach(function (c) { if (dentro(c.criado_em)) add(dia(c.criado_em), 'contatos'); });
    var tempos = [];
    var ultimaEntrada = {};
    msgs.forEach(function (m) {
      if (!dentro(m.criado_em)) return;
      add(dia(m.criado_em), m.direcao === 'in' ? 'recebidas' : 'enviadas');
      if (m.direcao === 'in' && !ultimaEntrada[m.contato_id]) ultimaEntrada[m.contato_id] = m.criado_em;
      else if (m.direcao === 'out' && m.usuario_id && ultimaEntrada[m.contato_id]) {
        var dt = (new Date(m.criado_em) - new Date(ultimaEntrada[m.contato_id])) / 60000;
        if (dt >= 0 && dt < 1440) tempos.push(dt);
        ultimaEntrada[m.contato_id] = '';
      }
    });
    var porUsuario = {};
    var users = P.tabela('Usuarios');
    users.forEach(function (u) { porUsuario[u.id] = { id: u.id, nome: u.nome, enviadas: 0, ganhos: 0, valor: 0, perdidos: 0, abertos: 0 }; });
    msgs.forEach(function (m) { if (m.direcao === 'out' && m.usuario_id && porUsuario[m.usuario_id] && dentro(m.criado_em)) porUsuario[m.usuario_id].enviadas++; });
    var motivos = {};
    negocios.forEach(function (n) {
      var pu = porUsuario[n.responsavel_id];
      if (n.status === 'aberto' && pu) pu.abertos++;
      if (!dentro(n.fechado_em)) return;
      if (n.status === 'ganho') {
        add(dia(n.fechado_em), 'ganhos');
        porDia[dia(n.fechado_em)].valor += U.num(n.valor);
        if (pu) { pu.ganhos++; pu.valor += U.num(n.valor); }
      }
      if (n.status === 'perdido') { motivos[n.motivo_perda || 'Sem motivo'] = (motivos[n.motivo_perda || 'Sem motivo'] || 0) + 1; if (pu) pu.perdidos++; }
    });
    var origens = {};
    contatos.forEach(function (c) { if (dentro(c.criado_em)) origens[c.origem || 'Sem origem'] = (origens[c.origem || 'Sem origem'] || 0) + 1; });
    var tempoMedio = tempos.length ? tempos.reduce(function (a, b2) { return a + b2; }, 0) / tempos.length : 0;
    var camps = P.tabela('Campanhas').filter(function (c) { return dentro(c.iniciada_em || c.criado_em); }).map(function (c) {
      return { id: c.id, nome: c.nome, total: U.num(c.total), enviados: U.num(c.enviados), erros: U.num(c.erros), respostas: U.num(c.respostas), status: c.status };
    });
    var autos = P.tabela('Automacoes').map(function (a) { return { id: a.id, nome: a.nome, disparos: U.num(a.disparos), concluidas: U.num(a.concluidas), ativo: a.ativo }; });
    return {
      de: de, ate: ate,
      dias: Object.keys(porDia).sort().map(function (k) { return porDia[k]; }),
      usuarios: Object.keys(porUsuario).map(function (k) { return porUsuario[k]; }),
      motivos: motivos, origens: origens, tempo_resposta_min: Math.round(tempoMedio), campanhas: camps, automacoes: autos
    };
  }

  /* ============================================================ rotas */
  function filtraContatosDoUsuario(user, lista) { return veTodos(user) ? lista : lista.filter(function (c) { return podeContato(user, c); }); }
  function contatoLeve(c) {
    var o = {};
    Object.keys(c).forEach(function (k) { if (k !== 'notas') o[k] = c[k]; });
    return o;
  }
  function exigeContato(user, id) {
    var c = contatoPorId(id);
    if (!c) throw new Error('Contato não encontrado.');
    if (!podeContato(user, c)) throw new Error('Este contato é de outro atendente.');
    return c;
  }
  function configPublica() {
    var c = cfg();
    return {
      marca: marca(), wa_provedor: c.WA_PROVEDOR, wa_numero: c.WA_NUMERO, motivos_perda: U.lista(c.MOTIVOS_PERDA),
      campos: U.json(c.CAMPOS_PERSONALIZADOS, []) || [], tags: U.lista(c.TAGS), origens: U.lista(c.ORIGENS),
      horario: { inicio: c.HORARIO_INICIO, fim: c.HORARIO_FIM, dias: c.DIAS_ENVIO }, segmento: c.SEGMENTO
    };
  }
  function configAdmin() {
    var c = cfg();
    var o = {};
    Object.keys(PRUMO_CONFIG_PADRAO).forEach(function (k) { o[k] = c[k]; });
    ['EVOLUTION_APIKEY', 'WAHA_APIKEY', 'META_TOKEN'].forEach(function (k) { o[k] = c[k] ? '••••••••' + U.str(c[k]).slice(-4) : ''; });
    o.URL_APP = P.urlApp();
    o.URL_WEBHOOK_WA = WA.urlWebhook();
    o.URL_WEBHOOK_ENTRADA = P.urlApp() + '?src=entrada&k=' + encodeURIComponent(c.ENTRADA_CHAVE || c.WEBHOOK_CHAVE);
    o.VERSAO = PRUMO_VERSAO;
    o.URL_PLANILHA = P.urlPlanilha ? P.urlPlanilha() : '';
    return o;
  }

  var CHAVES_EDITAVEIS = Object.keys(PRUMO_CONFIG_PADRAO).filter(function (k) { return ['PROX_TRABALHO', 'WEBHOOK_CHAVE', 'ENTRADA_CHAVE'].indexOf(k) < 0; });

  function bootstrap(user) {
    var contatos = filtraContatosDoUsuario(user, P.tabela('Contatos'));
    var ids = {};
    contatos.forEach(function (c) { ids[c.id] = 1; });
    var negocios = P.tabela('Negocios').filter(function (n) { return veTodos(user) || ids[n.contato_id] || n.responsavel_id === user.id; });
    var tarefas = P.tabela('Tarefas').filter(function (t) { return veTodos(user) || t.responsavel_id === user.id || ids[t.contato_id]; });
    return {
      agora: P.agora(), usuario: publicoUsuario(user), config: configPublica(),
      permissoes: PERM[user.perfil] || {},
      usuarios: P.tabela('Usuarios').map(publicoUsuario),
      funis: funisCompletos(),
      contatos: contatos.map(contatoLeve), negocios: negocios, tarefas: tarefas,
      modelos: P.tabela('Modelos'),
      automacoes: pode(user, 'automacoes') ? P.tabela('Automacoes') : [],
      campanhas: pode(user, 'disparos') ? P.tabela('Campanhas') : [],
      grupos: P.tabela('Grupos')
    };
  }

  var R = {};
  R['bootstrap'] = function (u) { return bootstrap(u); };
  R['sync'] = function (u, b) {
    var desde = U.str(b.desde);
    var contatos = filtraContatosDoUsuario(u, P.tabela('Contatos')).filter(function (c) { return !desde || c.atualizado_em >= desde; });
    var r = { agora: P.agora(), contatos: contatos.map(contatoLeve) };
    if (b.contato_id) {
      var c = contatoPorId(b.contato_id);
      if (c && podeContato(u, c)) r.mensagens = P.filtrar('Mensagens', 'contato_id', c.id).filter(function (m) { return !desde || m.criado_em >= desde; });
    }
    if (pode(u, 'disparos')) r.campanhas = P.tabela('Campanhas').filter(function (x) { return x.status === 'enviando' || x.status === 'agendada'; });
    return r;
  };
  R['logout'] = function (u, b) { P.cache.del('s_' + b.token); return true; };
  R['perfil.senha'] = function (u, b) {
    if (P.hash(U.str(b.atual), u.salt) !== u.senha_hash) throw new Error('Senha atual incorreta.');
    if (U.str(b.nova).length < 8) throw new Error('A nova senha precisa de pelo menos 8 caracteres.');
    var salt = P.uuid();
    P.atualizar('Usuarios', u.id, { senha_hash: P.hash(b.nova, salt), salt: salt });
    return true;
  };

  // ---- contatos
  R['contato.ver'] = function (u, b) {
    var c = exigeContato(u, b.id);
    return {
      contato: c,
      negocios: P.tabela('Negocios').filter(function (n) { return n.contato_id === c.id; }),
      tarefas: P.tabela('Tarefas').filter(function (t) { return t.contato_id === c.id; }),
      historico: P.filtrar('Historico', 'contato_id', c.id).slice(-80).reverse(),
      execucoes: P.tabela('Execucoes').filter(function (e) { return e.contato_id === c.id; }).slice(-10).reverse()
    };
  };
  R['contato.salvar'] = function (u, b) {
    var d = b.contato || {};
    if (d.id) exigeContato(u, d.id);
    if (!pode(u, 'todos') && d.responsavel_id && d.responsavel_id !== u.id) d.responsavel_id = u.id;
    if (!d.id && !d.responsavel_id && !pode(u, 'todos')) d.responsavel_id = u.id;
    var r = gravarContato(d, u, { substituirTags: !!d.id });
    return contatoPorId(r.contato.id);
  };
  R['contato.excluir'] = function (u, b) {
    exige(u, 'excluir');
    (b.ids || [b.id]).forEach(function (id) {
      P.excluir('Contatos', id);
      cancelarExecucoes(id);
    });
    return true;
  };
  R['contato.massa'] = function (u, b) {
    var ids = b.ids || [];
    if (!ids.length) throw new Error('Selecione pelo menos um contato.');
    var mapa = {};
    P.tabela('Contatos').forEach(function (c) { mapa[c.id] = c; });
    var alterados = {};
    var n = 0;
    ids.forEach(function (id) {
      var c = mapa[id];
      if (!c || !podeContato(u, c)) return;
      n++;
      if (b.acao === 'tag_add') { var t = U.tags(c.tags); if (t.indexOf(b.valor) < 0) { t.push(b.valor); alterados[id] = { tags: t.join(', ') }; } }
      else if (b.acao === 'tag_rem') { alterados[id] = { tags: U.tags(c.tags).filter(function (x) { return x !== b.valor; }).join(', ') }; }
      else if (b.acao === 'atribuir') { exige(u, 'todos'); alterados[id] = { responsavel_id: b.valor }; }
      else if (b.acao === 'status') alterados[id] = { status: b.valor };
      else if (b.acao === 'optout') alterados[id] = { optout: b.valor === 'NAO' ? 'NAO' : 'SIM' };
      if (alterados[id]) alterados[id].atualizado_em = P.agora();
    });
    if (b.acao === 'etapa') ids.forEach(function (id) { if (mapa[id] && podeContato(u, mapa[id])) moverContatoParaEtapa(mapa[id], b.valor, u); });
    else if (b.acao === 'automacao') {
      exige(u, 'automacoes');
      var a = P.tabela('Automacoes').filter(function (x) { return x.id === b.valor; })[0];
      if (!a) throw new Error('Automação não encontrada.');
      ids.forEach(function (id) { if (mapa[id]) iniciarAutomacao(a, mapa[id], {}); });
    } else if (b.acao === 'excluir') { exige(u, 'excluir'); P.excluirVarios('Contatos', ids); }
    else P.atualizarVarios('Contatos', alterados);
    if (b.acao === 'tag_add') ids.forEach(function (id) { if (alterados[id] && mapa[id]) { mapa[id].tags = alterados[id].tags; gatilho('tag', mapa[id], { tag: b.valor }); } });
    return { afetados: n };
  };
  R['contato.importar'] = function (u, b) {
    var linhas = b.linhas || [];
    if (linhas.length > 5000) throw new Error('Importe no máximo 5.000 linhas por vez.');
    var novos = 0, atualizados = 0, ignorados = 0;
    var indiceTel = {}, indiceEmail = {};
    P.tabela('Contatos').forEach(function (c) { if (c.telefone) indiceTel[U.telChave(c.telefone)] = c; if (c.email) indiceEmail[U.str(c.email).toLowerCase()] = c; });
    var inserir = [], atualizar = {};
    var agora = P.agora();
    var tagsExtra = U.tags(b.tags);
    linhas.forEach(function (l, i) {
      var tel = U.telWa(l.telefone), email = U.str(l.email).trim().toLowerCase();
      if (!tel && !email) { ignorados++; return; }
      var ex = (tel && indiceTel[U.telChave(tel)]) || (email && indiceEmail[email]);
      var tags = U.tags(l.tags).concat(tagsExtra);
      if (ex) {
        var t = U.tags(ex.tags);
        tags.forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); });
        var m = atualizar[ex.id] || {};
        m.tags = t.join(', ');
        ['nome', 'email', 'empresa', 'cidade', 'cargo'].forEach(function (k) { if (l[k] && !ex[k]) m[k] = U.cap(l[k], 200); });
        m.atualizado_em = agora;
        atualizar[ex.id] = m; ex.tags = m.tags;
        atualizados++;
        return;
      }
      var c = {
        id: P.id('C') + i, nome: U.cap(U.str(l.nome).trim() || (tel ? '+' + tel : email), 120), telefone: tel, email: email, empresa: U.cap(l.empresa, 120),
        cargo: U.cap(l.cargo, 80), cidade: U.cap(l.cidade, 80), origem: U.cap(l.origem || b.origem || 'Importação', 80), tags: tags.join(', '),
        responsavel_id: b.responsavel_id || '', status: PRUMO_STATUS_CONTATO.indexOf(l.status) >= 0 ? l.status : 'lead', campos: '{}', notas: U.cap(l.notas, 1000),
        optout: 'NAO', bot_pausado_ate: '', ultima_msg: '', ultima_msg_em: '', ultima_direcao: '', nao_lidas: '0', total_msgs: '0', criado_em: agora, atualizado_em: agora
      };
      inserir.push(c);
      if (tel) indiceTel[U.telChave(tel)] = c;
      if (email) indiceEmail[email] = c;
      novos++;
    });
    if (b.simular) return { novos: novos, atualizados: atualizados, ignorados: ignorados };
    P.inserirVarios('Contatos', inserir);
    P.atualizarVarios('Contatos', atualizar);
    hist('', '', u, 'importacao', novos + ' novos, ' + atualizados + ' atualizados');
    return { novos: novos, atualizados: atualizados, ignorados: ignorados };
  };
  R['contato.publico'] = function (u, b) { return { total: filtrarContatos(b.filtro || {}).filter(function (c) { return c.telefone && c.optout !== 'SIM'; }).length }; };
  R['contato.robo'] = function (u, b) {
    var c = exigeContato(u, b.id);
    var ate = b.pausar ? U.somaTempo(P.agora(), (U.num(b.horas) || 24 * 365) * 60) : '';
    P.atualizar('Contatos', c.id, { bot_pausado_ate: ate, atualizado_em: P.agora() });
    if (b.pausar) cancelarExecucoes(c.id);
    return { bot_pausado_ate: ate };
  };
  R['contato.nota'] = function (u, b) {
    var c = exigeContato(u, b.id);
    hist(c.id, b.negocio_id || '', u, 'nota', U.cap(b.texto, 2000));
    P.atualizar('Contatos', c.id, { atualizado_em: P.agora() });
    return true;
  };

  // ---- conversas
  R['conversa.abrir'] = function (u, b) {
    var c = exigeContato(u, b.id);
    if (U.num(c.nao_lidas)) P.atualizar('Contatos', c.id, { nao_lidas: '0' });
    var msgs = P.filtrar('Mensagens', 'contato_id', c.id);
    return { mensagens: msgs.slice(-300), contato: c };
  };
  R['conversa.lida'] = function (u, b) { var c = exigeContato(u, b.id); P.atualizar('Contatos', c.id, { nao_lidas: '0' }); return true; };
  R['mensagem.enviar'] = function (u, b) {
    var c = exigeContato(u, b.id);
    var texto = montarTexto(b.texto, c, u);
    if (!texto.trim() && !b.midia_url) throw new Error('Escreva uma mensagem.');
    if (!c.responsavel_id) { P.atualizar('Contatos', c.id, { responsavel_id: u.id }); c.responsavel_id = u.id; }
    var r = enviarParaContato(c, texto, { user: u, origem: 'manual', midia_url: U.urlMidia(b.midia_url), midia_tipo: b.midia_tipo });
    pausarRobo(c);
    P.atualizar('Contatos', c.id, { nao_lidas: '0' });
    return r;
  };
  R['wa.status'] = function () { var s = WA.status(); s.provedor = WA.provedor(); return s; };

  // ---- negócios
  R['negocio.salvar'] = function (u, b) {
    var d = b.negocio || {};
    if (!d.contato_id) throw new Error('Escolha o contato do negócio.');
    var c = exigeContato(u, d.contato_id);
    var et = P.tabela('Etapas').filter(function (e) { return e.id === d.etapa_id; })[0] || P.tabela('Etapas').filter(function (e) { return e.funil_id === d.funil_id; })[0];
    if (!et) throw new Error('Escolha o funil e a etapa.');
    if (d.id) {
      var n = P.tabela('Negocios').filter(function (x) { return x.id === d.id; })[0];
      if (!n) throw new Error('Negócio não encontrado.');
      P.atualizar('Negocios', n.id, { titulo: U.cap(d.titulo || c.nome, 150), valor: String(U.num(d.valor)), responsavel_id: d.responsavel_id || '', previsao: d.previsao || '', notas: U.cap(d.notas, 2000), atualizado_em: P.agora() });
      if (n.etapa_id !== et.id) moverNegocio(n, et.id, u);
      return P.tabela('Negocios').filter(function (x) { return x.id === d.id; })[0];
    }
    var novo = {
      id: P.id('N'), titulo: U.cap(d.titulo || c.nome, 150), contato_id: c.id, funil_id: et.funil_id, etapa_id: et.id, valor: String(U.num(d.valor)),
      responsavel_id: d.responsavel_id || c.responsavel_id || u.id, status: 'aberto', motivo_perda: '', previsao: d.previsao || '', notas: U.cap(d.notas, 2000),
      criado_em: P.agora(), atualizado_em: P.agora(), fechado_em: ''
    };
    P.inserir('Negocios', novo);
    hist(c.id, novo.id, u, 'negocio_criado', novo.titulo + ' - ' + et.nome);
    if (et.tipo !== 'aberto' && et.tipo) moverNegocio(novo, et.id, u);
    else gatilho('etapa', c, { etapa_id: et.id });
    return novo;
  };
  R['negocio.mover'] = function (u, b) {
    var n = P.tabela('Negocios').filter(function (x) { return x.id === b.id; })[0];
    if (!n) throw new Error('Negócio não encontrado.');
    exigeContato(u, n.contato_id);
    return moverNegocio(n, b.etapa_id, u, b.motivo);
  };
  R['negocio.excluir'] = function (u, b) { exige(u, 'excluir'); P.excluir('Negocios', b.id); return true; };

  // ---- tarefas
  R['tarefa.salvar'] = function (u, b) {
    var t = b.tarefa || {};
    if (!U.str(t.titulo).trim()) throw new Error('Dê um título para a tarefa.');
    var reg = { titulo: U.cap(t.titulo, 200), tipo: t.tipo || 'outro', contato_id: t.contato_id || '', negocio_id: t.negocio_id || '', responsavel_id: t.responsavel_id || u.id, vence_em: t.vence_em || '', feita: t.feita === 'SIM' ? 'SIM' : 'NAO', notas: U.cap(t.notas, 1000) };
    if (t.id) { exigeTarefa(u, t.id); P.atualizar('Tarefas', t.id, reg); reg.id = t.id; return reg; }
    reg.id = P.id('T'); reg.criado_em = P.agora();
    P.inserir('Tarefas', reg);
    if (reg.contato_id) hist(reg.contato_id, '', u, 'tarefa', reg.titulo);
    return reg;
  };
  function exigeTarefa(u, id) {
    var t = P.tabela('Tarefas').filter(function (x) { return x.id === id; })[0];
    if (!t) throw new Error('Tarefa não encontrada.');
    if (!veTodos(u) && t.responsavel_id && t.responsavel_id !== u.id) throw new Error('Esta tarefa é de outra pessoa.');
    return t;
  }
  R['tarefa.feita'] = function (u, b) { exigeTarefa(u, b.id); P.atualizar('Tarefas', b.id, { feita: b.feita === 'NAO' ? 'NAO' : 'SIM' }); return true; };
  R['tarefa.excluir'] = function (u, b) { exigeTarefa(u, b.id); P.excluir('Tarefas', b.id); return true; };

  // ---- modelos (respostas rápidas)
  R['modelo.salvar'] = function (u, b) {
    var m = b.modelo || {};
    if (!U.str(m.texto).trim() && !m.midia_url) throw new Error('Escreva o texto do modelo.');
    var reg = { titulo: U.cap(m.titulo || U.str(m.texto).slice(0, 40), 80), atalho: U.norm(m.atalho).replace(/[^a-z0-9_-]/g, ''), texto: U.cap(m.texto, 4000), midia_url: U.urlMidia(m.midia_url), midia_tipo: m.midia_tipo || '', categoria: U.cap(m.categoria, 60) };
    if (m.id) { P.atualizar('Modelos', m.id, reg); reg.id = m.id; return reg; }
    reg.id = P.id('MD'); P.inserir('Modelos', reg); return reg;
  };
  R['modelo.excluir'] = function (u, b) { exige(u, 'excluir'); P.excluir('Modelos', b.id); return true; };

  // ---- automações
  R['automacao.salvar'] = function (u, b) {
    exige(u, 'automacoes');
    var a = b.automacao || {};
    if (!U.str(a.nome).trim()) throw new Error('Dê um nome para a automação.');
    var passos = (a.passos || []).map(function (s, i) { s.id = s.id || 's' + (i + 1) + P.uuid().slice(0, 4); return s; });
    var reg = { nome: U.cap(a.nome, 100), ativo: a.ativo === 'SIM' ? 'SIM' : 'NAO', gatilho: JSON.stringify(a.gatilho || { tipo: 'manual' }), passos: JSON.stringify(passos), uma_vez: a.uma_vez === 'SIM' ? 'SIM' : 'NAO', atualizado_em: P.agora() };
    if (a.id) { P.atualizar('Automacoes', a.id, reg); return P.tabela('Automacoes').filter(function (x) { return x.id === a.id; })[0]; }
    reg.id = P.id('A'); reg.disparos = '0'; reg.concluidas = '0'; reg.criado_em = P.agora();
    P.inserir('Automacoes', reg); return reg;
  };
  R['automacao.ativar'] = function (u, b) { exige(u, 'automacoes'); P.atualizar('Automacoes', b.id, { ativo: b.ativo === 'SIM' ? 'SIM' : 'NAO' }); return true; };
  R['automacao.excluir'] = function (u, b) {
    exige(u, 'automacoes');
    P.tabela('Execucoes').filter(function (e) { return e.automacao_id === b.id && /esperando|rodando/.test(e.status); }).forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'cancelada' }); });
    P.excluir('Automacoes', b.id); return true;
  };
  R['automacao.execucoes'] = function (u, b) {
    exige(u, 'automacoes');
    var cs = {};
    P.tabela('Contatos').forEach(function (c) { cs[c.id] = c.nome; });
    return P.tabela('Execucoes').filter(function (e) { return e.automacao_id === b.id; }).slice(-200).reverse().map(function (e) { e.contato_nome = cs[e.contato_id] || '(excluído)'; return e; });
  };
  R['automacao.testar'] = function (u, b) {
    exige(u, 'automacoes');
    var a = P.tabela('Automacoes').filter(function (x) { return x.id === b.id; })[0];
    var c = exigeContato(u, b.contato_id);
    if (!a) throw new Error('Automação não encontrada.');
    P.tabela('Execucoes').filter(function (e) { return e.automacao_id === a.id && e.contato_id === c.id && /esperando|rodando/.test(e.status); })
      .forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'cancelada' }); });
    var save = a.uma_vez; a.uma_vez = 'NAO';
    var ex = iniciarAutomacao(a, c, {});
    a.uma_vez = save;
    return { ok: !!ex };
  };

  // ---- campanhas (disparos)
  R['campanha.salvar'] = function (u, b) {
    exige(u, 'disparos');
    var c = b.campanha || {};
    if (!U.str(c.nome).trim()) throw new Error('Dê um nome para o disparo.');
    if (!U.str(c.texto).trim() && !c.midia_url && !(c.meta_modelo && c.meta_modelo.nome)) throw new Error('Escreva a mensagem.');
    var reg = {
      nome: U.cap(c.nome, 100), destino: c.destino === 'grupos' ? 'grupos' : 'contatos', filtro: JSON.stringify(c.filtro || {}), grupos: JSON.stringify(c.grupos || []),
      texto: U.cap(c.texto, 4000), midia_url: U.urlMidia(c.midia_url), midia_tipo: c.midia_tipo || '', meta_modelo: c.meta_modelo ? JSON.stringify(c.meta_modelo) : '',
      velocidade: c.velocidade || 'normal', agendar_em: c.agendar_em || ''
    };
    if (c.id) {
      var atual = P.tabela('Campanhas').filter(function (x) { return x.id === c.id; })[0];
      if (!atual) throw new Error('Disparo não encontrado.');
      if (['rascunho', 'agendada'].indexOf(atual.status) < 0) throw new Error('Este disparo já começou e não pode ser editado.');
      P.atualizar('Campanhas', c.id, reg);
      reg.id = c.id;
    } else {
      reg.id = P.id('D'); reg.status = 'rascunho'; reg.total = '0'; reg.enviados = '0'; reg.erros = '0'; reg.respostas = '0';
      reg.criado_por = u.nome; reg.criado_em = P.agora();
      P.inserir('Campanhas', reg);
    }
    return P.tabela('Campanhas').filter(function (x) { return x.id === reg.id; })[0];
  };
  R['campanha.iniciar'] = function (u, b) {
    exige(u, 'disparos');
    var c = P.tabela('Campanhas').filter(function (x) { return x.id === b.id; })[0];
    if (!c) throw new Error('Disparo não encontrado.');
    if (['rascunho', 'agendada'].indexOf(c.status) < 0) throw new Error('Este disparo já foi iniciado.');
    if (!WA.temApi()) {
      var alvo = publicoCampanha(c);
      P.atualizar('Campanhas', c.id, { status: 'assistido', total: String(alvo.length), iniciada_em: P.agora() });
      return { assistido: true, lista: alvo.map(function (x) { return { id: x.id, nome: x.nome, telefone: x.telefone, texto: montarTexto(c.texto, x, u) }; }) };
    }
    if (c.agendar_em && c.agendar_em > P.agora() && !b.agora) {
      P.atualizar('Campanhas', c.id, { status: 'agendada' });
      marcarTrabalho(c.agendar_em);
      return { agendada: true, quando: c.agendar_em };
    }
    return iniciarCampanha(c);
  };
  R['campanha.assistido'] = function (u, b) {
    exige(u, 'disparos');
    var c = P.tabela('Campanhas').filter(function (x) { return x.id === b.id; })[0];
    if (!c) throw new Error('Disparo não encontrado.');
    var ct = contatoPorId(b.contato_id);
    if (ct) registrarMsg(ct, { direcao: 'out', texto: montarTexto(c.texto, ct, u), status: 'link', origem: 'campanha', usuario_id: u.id });
    var env = U.num(c.enviados) + 1;
    P.atualizar('Campanhas', c.id, { enviados: String(env), status: env >= U.num(c.total) ? 'concluida' : 'assistido' });
    return true;
  };
  R['campanha.pausar'] = function (u, b) { exige(u, 'disparos'); P.atualizar('Campanhas', b.id, { status: 'pausada' }); return true; };
  R['campanha.retomar'] = function (u, b) { exige(u, 'disparos'); P.atualizar('Campanhas', b.id, { status: 'enviando' }); marcarTrabalho(P.agora()); return true; };
  R['campanha.cancelar'] = function (u, b) {
    exige(u, 'disparos');
    P.atualizar('Campanhas', b.id, { status: 'cancelada' });
    var ids = {};
    P.tabela('Fila').forEach(function (f) { if (f.ref_id === b.id && f.status === 'pendente') ids[f.id] = { status: 'cancelado' }; });
    P.atualizarVarios('Fila', ids);
    return true;
  };
  R['campanha.excluir'] = function (u, b) {
    exige(u, 'disparos');
    var c = P.tabela('Campanhas').filter(function (x) { return x.id === b.id; })[0];
    if (c && c.status === 'enviando') throw new Error('Cancele o disparo antes de excluir.');
    P.excluirVarios('Fila', P.tabela('Fila').filter(function (f) { return f.ref_id === b.id; }).map(function (f) { return f.id; }));
    P.excluir('Campanhas', b.id); return true;
  };
  R['campanha.duplicar'] = function (u, b) {
    exige(u, 'disparos');
    var c = P.tabela('Campanhas').filter(function (x) { return x.id === b.id; })[0];
    if (!c) throw new Error('Disparo não encontrado.');
    var n = {}; Object.keys(c).forEach(function (k) { n[k] = c[k]; });
    n.id = P.id('D'); n.nome = U.cap(c.nome + ' (cópia)', 100); n.status = 'rascunho'; n.total = '0'; n.enviados = '0'; n.erros = '0'; n.respostas = '0';
    n.criado_em = P.agora(); n.iniciada_em = ''; n.concluida_em = ''; n.agendar_em = ''; n.criado_por = u.nome;
    P.inserir('Campanhas', n); return n;
  };
  R['campanha.envios'] = function (u, b) {
    exige(u, 'disparos');
    var cs = {};
    P.tabela('Contatos').forEach(function (c) { cs[c.id] = c.nome; });
    return P.tabela('Fila').filter(function (f) { return f.ref_id === b.id; }).map(function (f) { return { nome: cs[f.contato_id] || f.destino, destino: f.destino, status: f.status, erro: f.erro, enviar_em: f.enviar_em, enviado_em: f.enviado_em }; });
  };
  R['fila.processar'] = function (u) { exige(u, 'disparos'); salvarCfg({ PROX_TRABALHO: '' }); return trabalhar(); };

  // ---- grupos
  R['grupo.salvar'] = function (u, b) {
    exige(u, 'disparos');
    var g = b.grupo || {};
    if (!U.str(g.nome).trim()) throw new Error('Dê um nome para o grupo.');
    var reg = { nome: U.cap(g.nome, 100), jid: U.str(g.jid).trim(), link: U.str(g.link).trim(), slug: U.norm(g.slug).replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'), limite: String(U.num(g.limite) || 1000), ordem: String(U.num(g.ordem)), ativo: g.ativo === 'NAO' ? 'NAO' : 'SIM' };
    if (reg.link && !/^https:\/\/chat\.whatsapp\.com\//.test(reg.link)) throw new Error('O link de convite precisa começar com https://chat.whatsapp.com/');
    if (g.id) { P.atualizar('Grupos', g.id, reg); reg.id = g.id; return reg; }
    reg.id = P.id('G'); reg.cliques = '0'; reg.criado_em = P.agora();
    P.inserir('Grupos', reg); return reg;
  };
  R['grupo.excluir'] = function (u, b) { exige(u, 'disparos'); P.excluir('Grupos', b.id); return true; };
  R['grupo.zerar'] = function (u, b) { exige(u, 'disparos'); P.atualizar('Grupos', b.id, { cliques: '0' }); return true; };
  R['grupo.importar'] = function (u) {
    exige(u, 'disparos');
    var lista = WA.grupos();
    var atuais = {};
    P.tabela('Grupos').forEach(function (g) { if (g.jid) atuais[g.jid] = g; });
    var novos = [];
    lista.forEach(function (g, i) {
      if (!g.jid || atuais[g.jid]) return;
      novos.push({ id: P.id('G') + i, nome: g.nome || g.jid, jid: g.jid, link: WA.linkGrupo(g.jid), slug: '', limite: '1000', cliques: '0', ordem: String(i), ativo: 'SIM', criado_em: P.agora() });
    });
    P.inserirVarios('Grupos', novos);
    return { encontrados: lista.length, novos: novos.length };
  };

  // ---- relatórios
  R['relatorio'] = function (u, b) { exige(u, 'relatorios'); return relatorio(u, b); };

  // ---- ajustes (admin)
  R['config.ver'] = function (u) { exige(u, 'ajustes'); return configAdmin(); };
  R['config.salvar'] = function (u, b) {
    exige(u, 'ajustes');
    var d = b.config || {};
    var limpo = {};
    Object.keys(d).forEach(function (k) {
      if (CHAVES_EDITAVEIS.indexOf(k) < 0) return;
      var v = U.str(d[k]);
      if (/^••••/.test(v)) return; // segredo mascarado: mantém o que já está salvo
      if (/^COR_/.test(k) && !/^#[0-9a-f]{6}$/i.test(v)) return;
      if (k === 'LOGO_URL' && v && !/^(https:\/\/|data:image\/(png|jpeg|webp|svg\+xml);base64,)/i.test(v)) throw new Error('A logo precisa ser um link https ou uma imagem enviada.');
      if (/_URL$/.test(k) && k !== 'LOGO_URL' && v && !/^https?:\/\//i.test(v)) throw new Error('O endereço precisa começar com http:// ou https://');
      if (['CAMPOS_PERSONALIZADOS', 'WEBHOOKS_SAIDA'].indexOf(k) >= 0 && !Array.isArray(U.json(v, null))) return;
      if (k === 'LOGO_URL' && v.length > 48000) throw new Error('Logo grande demais. Envie uma imagem menor.');
      limpo[k] = U.cap(v, k === 'LOGO_URL' ? 48000 : 5000);
    });
    if (limpo.WEBHOOKS_SAIDA) {
      (U.json(limpo.WEBHOOKS_SAIDA, []) || []).forEach(function (w) { if (w.url && !/^https:\/\//i.test(w.url)) throw new Error('Webhooks de saída precisam usar https://'); });
    }
    salvarCfg(limpo);
    return configAdmin();
  };
  R['config.chave'] = function (u, b) {
    exige(u, 'integracoes');
    var m = {};
    m[b.qual === 'wa' ? 'WEBHOOK_CHAVE' : 'ENTRADA_CHAVE'] = P.uuid().replace(/-/g, '');
    salvarCfg(m);
    return configAdmin();
  };
  R['wa.conectar'] = function (u) { exige(u, 'integracoes'); return WA.conectar(); };
  R['wa.testar'] = function (u, b) {
    exige(u, 'integracoes');
    var tel = U.telWa(b.telefone);
    if (!tel) throw new Error('Informe um número para o teste.');
    WA.enviar(tel, b.texto || ('Teste do ' + cfg().NOME + ': se você recebeu esta mensagem, a integração está funcionando.'));
    return true;
  };
  R['webhook.testar'] = function (u, b) { exige(u, 'integracoes'); return webhookEntrada(U.json(b.json, {}) || {}, { origem: 'Teste de webhook', tags: 'teste' }); };
  R['funil.salvar'] = function (u, b) {
    exige(u, 'ajustes');
    var f = b.funil || {};
    if (!U.str(f.nome).trim()) throw new Error('Dê um nome ao funil.');
    var etapas = (f.etapas || []).filter(function (e) { return U.str(e.nome).trim(); });
    if (etapas.length < 2) throw new Error('O funil precisa de pelo menos 2 etapas.');
    var fid = f.id || P.id('FU');
    if (f.id) P.atualizar('Funis', fid, { nome: U.cap(f.nome, 80), ordem: String(U.num(f.ordem)) });
    else P.inserir('Funis', { id: fid, nome: U.cap(f.nome, 80), ordem: String(P.tabela('Funis').length + 1) });
    var antigas = P.tabela('Etapas').filter(function (e) { return e.funil_id === fid; });
    var mantidas = {};
    etapas.forEach(function (e, i) {
      var reg = { funil_id: fid, nome: U.cap(e.nome, 60), cor: /^#[0-9a-f]{6}$/i.test(e.cor) ? e.cor : '#64748B', ordem: String(i + 1), tipo: ['ganho', 'perdido'].indexOf(e.tipo) >= 0 ? e.tipo : 'aberto' };
      if (e.id && antigas.some(function (a) { return a.id === e.id; })) { P.atualizar('Etapas', e.id, reg); mantidas[e.id] = 1; }
      else { reg.id = P.id('ET') + i; P.inserir('Etapas', reg); mantidas[reg.id] = 1; }
    });
    var removidas = antigas.filter(function (a) { return !mantidas[a.id]; });
    if (removidas.length) {
      var primeira = P.tabela('Etapas').filter(function (e) { return e.funil_id === fid && mantidas[e.id]; }).sort(function (a, b2) { return U.num(a.ordem) - U.num(b2.ordem); })[0];
      var mover = {};
      P.tabela('Negocios').forEach(function (n) { if (removidas.some(function (r) { return r.id === n.etapa_id; })) mover[n.id] = { etapa_id: primeira.id }; });
      P.atualizarVarios('Negocios', mover);
      P.excluirVarios('Etapas', removidas.map(function (r) { return r.id; }));
    }
    return funisCompletos();
  };
  R['funil.excluir'] = function (u, b) {
    exige(u, 'ajustes');
    if (P.tabela('Funis').length <= 1) throw new Error('O sistema precisa de pelo menos um funil.');
    if (P.tabela('Negocios').some(function (n) { return n.funil_id === b.id && n.status === 'aberto'; })) throw new Error('Mova ou feche os negócios abertos deste funil antes de excluir.');
    P.excluirVarios('Etapas', P.tabela('Etapas').filter(function (e) { return e.funil_id === b.id; }).map(function (e) { return e.id; }));
    P.excluir('Funis', b.id);
    return funisCompletos();
  };
  R['usuario.salvar'] = function (u, b) {
    exige(u, 'equipe');
    var d = b.usuario || {};
    var email = U.str(d.email).trim().toLowerCase();
    if (!U.str(d.nome).trim() || !U.emailOk(email)) throw new Error('Informe nome e e-mail válidos.');
    var outro = P.tabela('Usuarios').filter(function (x) { return U.str(x.email).toLowerCase() === email && x.id !== d.id; })[0];
    if (outro) throw new Error('Já existe um usuário com este e-mail.');
    var perfil = ['admin', 'gestor', 'atendente'].indexOf(d.perfil) >= 0 ? d.perfil : 'atendente';
    var reg = { nome: U.cap(d.nome, 80), email: email, perfil: perfil, ativo: d.ativo === 'NAO' ? 'NAO' : 'SIM', recebe_leads: d.recebe_leads === 'SIM' ? 'SIM' : 'NAO', cor: /^#[0-9a-f]{6}$/i.test(d.cor) ? d.cor : '' };
    if (d.id === u.id && (reg.perfil !== 'admin' || reg.ativo !== 'SIM')) throw new Error('Você não pode tirar o seu próprio acesso de administrador.');
    if (d.senha) {
      if (U.str(d.senha).length < 8) throw new Error('A senha precisa de pelo menos 8 caracteres.');
      reg.salt = P.uuid(); reg.senha_hash = P.hash(d.senha, reg.salt);
    }
    if (d.id) { P.atualizar('Usuarios', d.id, reg); reg.id = d.id; return publicoUsuario(P.tabela('Usuarios').filter(function (x) { return x.id === d.id; })[0]); }
    if (!d.senha) throw new Error('Defina uma senha inicial.');
    reg.id = P.id('U'); reg.criado_em = P.agora(); reg.ultimo_acesso = '';
    P.inserir('Usuarios', reg);
    return publicoUsuario(reg);
  };
  R['historico.limpar'] = function (u, b) {
    exige(u, 'ajustes');
    var corte = U.somaTempo(P.agora(), -(U.num(b.dias) || 90) * 1440);
    var fila = P.tabela('Fila').filter(function (f) { return f.status !== 'pendente' && f.criado_em < corte; }).map(function (f) { return f.id; });
    var ex = P.tabela('Execucoes').filter(function (e) { return !/esperando|rodando/.test(e.status) && e.atualizado_em < corte; }).map(function (e) { return e.id; });
    P.excluirVarios('Fila', fila);
    P.excluirVarios('Execucoes', ex);
    return { fila: fila.length, execucoes: ex.length };
  };
  R['setup.concluir'] = function (u, b) {
    exige(u, 'ajustes');
    var d = b.dados || {};
    var c = {};
    if (d.NOME) c.NOME = U.cap(d.NOME, 60);
    if (d.SLOGAN !== undefined) c.SLOGAN = U.cap(d.SLOGAN, 100);
    if (/^#[0-9a-f]{6}$/i.test(d.COR_PRIMARIA)) c.COR_PRIMARIA = d.COR_PRIMARIA;
    if (/^#[0-9a-f]{6}$/i.test(d.COR_DESTAQUE)) c.COR_DESTAQUE = d.COR_DESTAQUE;
    if (d.LOGO_URL !== undefined && (!d.LOGO_URL || (/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(d.LOGO_URL) && d.LOGO_URL.length <= 48000))) c.LOGO_URL = d.LOGO_URL;
    if (d.SEGMENTO) c.SEGMENTO = d.SEGMENTO;
    c.CONFIGURADO = 'SIM';
    salvarCfg(c);
    if (d.SEGMENTO && PRUMO_MODELOS_SEGMENTO[d.SEGMENTO] && !P.tabela('Negocios').length) {
      var mod = PRUMO_MODELOS_SEGMENTO[d.SEGMENTO];
      var f = P.tabela('Funis')[0];
      if (f) {
        P.atualizar('Funis', f.id, { nome: mod.funil });
        P.excluirVarios('Etapas', P.tabela('Etapas').filter(function (e) { return e.funil_id === f.id; }).map(function (e) { return e.id; }));
        P.inserirVarios('Etapas', mod.etapas.map(function (e, i) { return { id: P.id('ET') + i, funil_id: f.id, nome: e[0], cor: e[1], ordem: String(i + 1), tipo: e[2] || 'aberto' }; }));
      }
      if (mod.tags) salvarCfg({ TAGS: mod.tags });
    }
    return bootstrap(u);
  };

  /** Monta a base inicial (abas vazias + funil + automações de exemplo). */
  function semear(admin) {
    if (!P.tabela('Funis').length) {
      P.inserir('Funis', { id: 'FU1', nome: 'Vendas', ordem: '1' });
      P.inserirVarios('Etapas', PRUMO_MODELOS_SEGMENTO.geral.etapas.map(function (e, i) { return { id: 'ET' + (i + 1), funil_id: 'FU1', nome: e[0], cor: e[1], ordem: String(i + 1), tipo: e[2] || 'aberto' }; }));
    }
    if (!P.tabela('Modelos').length) P.inserirVarios('Modelos', PRUMO_MODELOS_INICIAIS.map(function (m, i) { return { id: 'MD' + (i + 1), titulo: m[0], atalho: m[1], texto: m[2], midia_url: '', midia_tipo: '', categoria: m[3] }; }));
    if (!P.tabela('Automacoes').length) {
      PRUMO_AUTOMACOES_INICIAIS().forEach(function (a, i) {
        P.inserir('Automacoes', { id: 'A' + (i + 1), nome: a.nome, ativo: 'NAO', gatilho: JSON.stringify(a.gatilho), passos: JSON.stringify(a.passos), uma_vez: a.uma_vez || 'NAO', disparos: '0', concluidas: '0', criado_em: P.agora(), atualizado_em: P.agora() });
      });
    }
    if (admin && !P.tabela('Usuarios').length) {
      var salt = P.uuid();
      P.inserir('Usuarios', { id: 'U1', nome: admin.nome || 'Administrador', email: U.str(admin.email).toLowerCase(), senha_hash: P.hash(admin.senha, salt), salt: salt, perfil: 'admin', ativo: 'SIM', recebe_leads: 'SIM', cor: '', ultimo_acesso: '', criado_em: P.agora() });
    }
    if (!cfg().WEBHOOK_CHAVE) salvarCfg({ WEBHOOK_CHAVE: P.uuid().replace(/-/g, '') });
    if (!cfg().ENTRADA_CHAVE) salvarCfg({ ENTRADA_CHAVE: P.uuid().replace(/-/g, '') });
  }

  /* =========================================================== público */
  function publico(acao, b) {
    if (acao === 'publico.marca') return marca();
    if (acao === 'publico.grupo') {
      var slug = U.norm(b.slug);
      var gs = P.tabela('Grupos').filter(function (g) { return g.slug === slug && g.ativo === 'SIM' && g.link; })
        .sort(function (a, c) { return U.num(a.ordem) - U.num(c.ordem); });
      var g = gs.filter(function (x) { return U.num(x.cliques) < U.num(x.limite); })[0];
      if (!g) return { link: '', cheio: gs.length > 0, nome: marca().nome };
      P.atualizar('Grupos', g.id, { cliques: String(U.num(g.cliques) + 1) });
      return { link: g.link, nome: g.nome, marca: marca().nome };
    }
    if (acao === 'publico.form') { // formulário de captura simples (página pública)
      var ce = cfg().ENTRADA_CHAVE || cfg().WEBHOOK_CHAVE;
      if (!b.k || b.k !== ce) throw new Error('Formulário inválido.');
      var nf = Number(P.cache.get('form_min') || 0);
      if (nf > 40) throw new Error('Muitos envios agora. Tente em um minuto.');
      P.cache.put('form_min', String(nf + 1), 60);
      return webhookEntrada({ nome: b.nome, email: b.email, telefone: b.telefone }, { origem: b.origem || 'Formulário', tags: b.tags || '', automacao: b.automacao || '' });
    }
    throw new Error('Ação desconhecida.');
  }

  /** Porta de entrada das chamadas do site. */
  function rotear(body) {
    var acao = U.str(body.action);
    if (acao === 'login') return login(body.email, body.senha);
    if (acao.indexOf('publico.') === 0) return publico(acao, body);
    var user = autenticar(body.token);
    var fn = R[acao];
    if (!fn) throw new Error('Ação desconhecida: ' + acao);
    return fn(user, body);
  }

  return {
    U: U, WA: WA, cfg: cfg, salvarCfg: salvarCfg, rotear: rotear, receberWebhook: receberWebhook, trabalhar: trabalhar,
    semear: semear, receber: receber, montarTexto: montarTexto, filtrarContatos: filtrarContatos, versao: PRUMO_VERSAO
  };
}

/* ---------------------------------------------------- modelos prontos */
var PRUMO_MODELOS_SEGMENTO = {
  geral: { funil: 'Vendas', tags: 'Lead quente, Cliente, Indicação, Retornar', etapas: [['Novo lead', '#3B82F6'], ['Em conversa', '#8B5CF6'], ['Proposta enviada', '#F59E0B'], ['Negociação', '#F97316'], ['Ganho', '#16A34A', 'ganho'], ['Perdido', '#DC2626', 'perdido']] },
  servicos: { funil: 'Orçamentos', tags: 'Orçamento, Urgente, Cliente, Indicação', etapas: [['Pedido de orçamento', '#3B82F6'], ['Visita / diagnóstico', '#8B5CF6'], ['Orçamento enviado', '#F59E0B'], ['Aprovação', '#F97316'], ['Fechado', '#16A34A', 'ganho'], ['Não fechou', '#DC2626', 'perdido']] },
  saude: { funil: 'Agendamentos', tags: 'Primeira consulta, Retorno, Convênio, Particular', etapas: [['Contato inicial', '#3B82F6'], ['Agendado', '#8B5CF6'], ['Confirmado', '#0EA5E9'], ['Compareceu', '#16A34A', 'ganho'], ['Faltou / desistiu', '#DC2626', 'perdido']] },
  imoveis: { funil: 'Imóveis', tags: 'Compra, Aluguel, Investidor, Financiamento', etapas: [['Lead', '#3B82F6'], ['Qualificado', '#8B5CF6'], ['Visita agendada', '#0EA5E9'], ['Proposta', '#F59E0B'], ['Contrato', '#16A34A', 'ganho'], ['Perdido', '#DC2626', 'perdido']] },
  infoprodutos: { funil: 'Lançamento', tags: 'Lista de espera, Comprador, Carrinho abandonado, Aluno', etapas: [['Inscrito', '#3B82F6'], ['Engajado', '#8B5CF6'], ['Carrinho abandonado', '#F59E0B'], ['Comprou', '#16A34A', 'ganho'], ['Não comprou', '#DC2626', 'perdido']] },
  varejo: { funil: 'Pedidos', tags: 'Cliente VIP, Primeira compra, Atacado, Recompra', etapas: [['Interessado', '#3B82F6'], ['Orçamento', '#F59E0B'], ['Pedido feito', '#8B5CF6'], ['Entregue', '#16A34A', 'ganho'], ['Desistiu', '#DC2626', 'perdido']] }
};

var PRUMO_MODELOS_INICIAIS = [
  ['Boas-vindas', 'oi', '{saudacao}, {primeiro_nome}! Aqui é {atendente}, da {minha_empresa}. Como posso te ajudar?', 'Atendimento'],
  ['Pedir dados', 'dados', 'Para eu preparar tudo certinho, me passa seu nome completo e e-mail?', 'Atendimento'],
  ['Follow-up', 'retorno', 'Oi {primeiro_nome}, tudo bem? Passando para saber se ficou alguma dúvida sobre o que conversamos.', 'Vendas'],
  ['Proposta enviada', 'proposta', '{primeiro_nome}, acabei de te enviar a proposta. Qualquer ponto que quiser ajustar, me fala aqui.', 'Vendas'],
  ['Agradecimento', 'obrigado', 'Muito obrigado pela confiança, {primeiro_nome}! Conte com a gente.', 'Pós-venda']
];

function PRUMO_AUTOMACOES_INICIAIS() {
  return [
    {
      nome: 'Atendimento automático com menu', gatilho: { tipo: 'primeira_mensagem' }, uma_vez: 'NAO',
      passos: [
        { id: 's1', tipo: 'menu', texto: '{saudacao}! Bem-vindo(a) à {minha_empresa}. Como podemos ajudar?', campo: 'interesse', expira_horas: 12,
          opcoes: [{ rotulo: 'Quero um orçamento', ir: 's2' }, { rotulo: 'Já sou cliente', ir: 's5' }, { rotulo: 'Falar com uma pessoa', ir: 's6' }] },
        { id: 's2', tipo: 'pergunta', texto: 'Ótimo! Qual é o seu nome?', campo: 'nome', validar: 'texto' },
        { id: 's3', tipo: 'pergunta', texto: 'Prazer, {primeiro_nome}! Qual o seu melhor e-mail?', campo: 'email', validar: 'email', erro_texto: 'Esse e-mail parece incompleto. Pode conferir?' },
        { id: 's4', tipo: 'tag', acao: 'add', tag: 'Lead quente' },
        { id: 's4b', tipo: 'humano', texto: '', horas: 24, titulo: 'Enviar orçamento' },
        { id: 's4c', tipo: 'mensagem', texto: 'Obrigado! Um especialista vai falar com você em instantes.' },
        { id: 's4d', tipo: 'fim' },
        { id: 's5', tipo: 'tag', acao: 'add', tag: 'Cliente' },
        { id: 's6', tipo: 'humano', horas: 24, titulo: 'Atendimento solicitado pelo WhatsApp' },
        { id: 's7', tipo: 'mensagem', texto: 'Certo! Já avisei nossa equipe. Em breve alguém responde por aqui.' }
      ]
    },
    {
      nome: 'Resposta para "preço"', gatilho: { tipo: 'palavra', palavras: 'preço, preco, valor, quanto custa', modo: 'contem' }, uma_vez: 'NAO',
      passos: [
        { id: 's1', tipo: 'mensagem', texto: 'Oi {primeiro_nome}! Os valores dependem do que você precisa. Vou te passar para um especialista que monta a melhor opção.' },
        { id: 's2', tipo: 'tag', acao: 'add', tag: 'Lead quente' },
        { id: 's3', tipo: 'tarefa', titulo: 'Enviar valores para {nome}', prazo_horas: 2 }
      ]
    },
    {
      nome: 'Follow-up de proposta (3 dias)', gatilho: { tipo: 'manual' }, uma_vez: 'NAO',
      passos: [
        { id: 's1', tipo: 'esperar', valor: 3, unidade: 'dias' },
        { id: 's2', tipo: 'condicao', se: 'tag', op: 'tem', valor: 'Cliente', sim: 'fim', nao: '' },
        { id: 's3', tipo: 'mensagem', texto: 'Oi {primeiro_nome}, tudo bem? Conseguiu olhar a proposta que te enviei?' },
        { id: 's4', tipo: 'esperar', valor: 2, unidade: 'dias' },
        { id: 's5', tipo: 'tarefa', titulo: 'Ligar para {nome} (proposta sem retorno)', prazo_horas: 24 }
      ]
    }
  ];
}

if (typeof module !== 'undefined') module.exports = { PrumoLogica: PrumoLogica, PRUMO_ESQUEMA: PRUMO_ESQUEMA };
