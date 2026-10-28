/* ==========================================================================
   PRUMO CRM — regras de negócio (núcleo compartilhado)
   --------------------------------------------------------------------------
   Este mesmo arquivo roda em dois lugares:
     1) no Google Apps Script (servidor real, dados na planilha);
     2) no navegador, no modo demonstração (dados no localStorage).
   Tudo o que depende do lugar (ler/gravar dados, chamar URLs, cache, hora)
   chega pelo objeto P ("plataforma"). Nada aqui conhece planilha ou navegador.
   ========================================================================== */
var PRUMO_VERSAO = '1.3.0';

var PRUMO_ESQUEMA = {
  Usuarios: ['id', 'nome', 'email', 'senha_hash', 'salt', 'perfil', 'ativo', 'recebe_leads', 'cor', 'ultimo_acesso', 'criado_em', 'meta_valor', 'meta_reunioes', 'permissoes'],
  Contatos: ['id', 'nome', 'telefone', 'email', 'empresa', 'cargo', 'cidade', 'origem', 'tags', 'responsavel_id', 'status', 'campos', 'notas',
    'optout', 'bot_pausado_ate', 'ultima_msg', 'ultima_msg_em', 'ultima_direcao', 'nao_lidas', 'total_msgs', 'criado_em', 'atualizado_em',
    'canal', 'ig_id', 'ig_usuario', 'janela_ate', 'gratis_ate', 'sdr_id', 'pontos', 'email_optout', 'ultima_visita', 'chat_id'],
  Funis: ['id', 'nome', 'ordem'],
  Etapas: ['id', 'funil_id', 'nome', 'cor', 'ordem', 'tipo'],
  Negocios: ['id', 'titulo', 'contato_id', 'funil_id', 'etapa_id', 'valor', 'responsavel_id', 'status', 'motivo_perda', 'previsao', 'notas',
    'criado_em', 'atualizado_em', 'fechado_em', 'sdr_id', 'passado_em', 'reuniao_em', 'reuniao_status'],
  Tarefas: ['id', 'titulo', 'tipo', 'contato_id', 'negocio_id', 'responsavel_id', 'vence_em', 'feita', 'notas', 'criado_em'],
  Mensagens: ['id', 'contato_id', 'direcao', 'tipo', 'texto', 'midia_url', 'status', 'erro', 'usuario_id', 'origem', 'wa_id', 'criado_em', 'canal', 'cobranca'],
  Modelos: ['id', 'titulo', 'atalho', 'texto', 'midia_url', 'midia_tipo', 'categoria'],
  Automacoes: ['id', 'nome', 'ativo', 'gatilho', 'passos', 'uma_vez', 'disparos', 'concluidas', 'criado_em', 'atualizado_em'],
  Execucoes: ['id', 'automacao_id', 'contato_id', 'passo_id', 'status', 'acordar_em', 'tentativas', 'criado_em', 'atualizado_em', 'dados'],
  Campanhas: ['id', 'nome', 'destino', 'filtro', 'grupos', 'texto', 'midia_url', 'midia_tipo', 'meta_modelo', 'velocidade', 'status',
    'agendar_em', 'total', 'enviados', 'erros', 'respostas', 'criado_por', 'criado_em', 'iniciada_em', 'concluida_em', 'economia'],
  Fila: ['id', 'tipo', 'ref_id', 'contato_id', 'destino', 'texto', 'midia_url', 'midia_tipo', 'enviar_em', 'status', 'erro', 'criado_em', 'enviado_em', 'variante', 'aberto_em', 'clicado_em'],
  Emails: ['id', 'nome', 'tipo', 'assunto', 'assunto_b', 'preheader', 'blocos', 'filtro', 'status', 'total', 'enviados', 'aberturas', 'cliques', 'descadastros', 'erros',
    'agendar_em', 'criado_por', 'criado_em', 'iniciada_em', 'concluida_em', 'aberturas_b', 'enviados_b'],
  Grupos: ['id', 'nome', 'jid', 'link', 'slug', 'limite', 'cliques', 'ordem', 'ativo', 'criado_em'],
  Historico: ['id', 'data', 'contato_id', 'negocio_id', 'usuario_nome', 'acao', 'detalhe', 'ref_id'],
  Arquivos: ['id', 'mes', 'planilha_id', 'url', 'linhas', 'criado_em', 'atualizado_em'],
  Cobrancas: ['id', 'tipo', 'ref_id', 'contato_id', 'negocio_id', 'descricao', 'valor', 'vencimento', 'status', 'pago_em', 'forma', 'parcela', 'parcelas', 'link', 'mp_id',
    'origem', 'lembrete_em', 'atraso_avisado', 'reembolsado_em', 'reembolso_valor', 'criado_em', 'atualizado_em'],
  Config: ['chave', 'valor']
};

/** Abas que vão para a planilha do mês quando o mês vira: [aba, coluna de data, linha pode sair?] */
var PRUMO_ARQUIVAVEIS = [
  ['Mensagens', 'criado_em', function () { return true; }],
  ['Historico', 'data', function () { return true; }],
  ['Fila', 'criado_em', function (o) { return o.status !== 'pendente'; }],
  ['Execucoes', 'atualizado_em', function (o) { return !/esperando|rodando/.test(o.status); }],
  ['Tarefas', 'criado_em', function (o) { return o.feita === 'SIM'; }],
  ['Negocios', 'fechado_em', function (o) { return o.status !== 'aberto' && !!o.fechado_em; }]
];
var PRUMO_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

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
  VENDAS_CHAVE: '',             // só Hotmart/Kiwify: eventos de compra exigem esta chave (a de captação é pública)
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
  // Equipe comercial (SDR passa o lead qualificado para o closer)
  PASSAR_ETAPA: '',             // etapa do funil onde o negócio fica quando o SDR passa o lead
  LEMBRETE_REUNIAO: 'SIM',      // avisa o lead antes da reunião
  LEMBRETE_TEXTO: 'Oi {primeiro_nome}! Passando para lembrar da nossa conversa hoje às {hora_reuniao}. Até já!',
  LEMBRETE_HORAS: '2',
  LEMBRETE_MODELO: '',          // API oficial: nome do modelo (utilidade) usado quando a janela de 24h está fechada
  SLA_MINUTOS: '15',            // tempo máximo para responder um lead (alerta no painel)
  // API oficial da Meta: custos estimados por mensagem (R$) e janela grátis de anúncio
  META_PRECO_MARKETING: '0.35', META_PRECO_UTILITY: '0.05', META_PRECO_SERVICO: '0.02',
  META_FRANQUIA_SERVICO: '1000', META_GRATIS_HORAS: '72',
  // Instagram (API do Instagram com login do Instagram)
  IG_TOKEN: '', IG_ID: '', IG_VERSAO: 'v21.0',
  // ActiveCampaign
  AC_URL: '', AC_TOKEN: '', AC_LISTA: '',
  API_CHAVE: '',                // chave da API para outros sistemas (secreta)
  // E-mail marketing: Gmail da própria conta (grátis) e Brevo (plano grátis) para somar volume
  EMAIL_PROVEDOR: 'gmail',      // gmail | brevo | ambos (Gmail primeiro, depois Brevo)
  EMAIL_NOME: '', EMAIL_RESPONDER: '', EMAIL_RODAPE: '',
  EMAIL_LIMITE_GMAIL: '95', BREVO_APIKEY: '', BREVO_REMETENTE: '', BREVO_LIMITE: '295',
  EMAIL_CONTAGEM: '',           // AAAA-MM-DD|gmail|brevo (enviados hoje)
  SITE_URL: '',                 // endereço do site do sistema (GitHub Pages), usado nos links rastreados
  RASTREIO_SEGREDO: '',
  // Financeiro e Mercado Pago
  MP_TOKEN: '', MP_CHAVE: '', MP_RETORNO: '',
  LEMBRETE_COBRANCA_DIAS: '3',  // quantos dias antes do vencimento dispara o gatilho "cobrança perto de vencer"
  FIN_VERIFICADO: '',
  // Chat do site
  CHAT_ATIVO: 'NAO', CHAT_TITULO: 'Fale com a gente', CHAT_SAUDACAO: 'Oi! Deixe seu nome e WhatsApp e já te respondemos por aqui.', CHAT_PEDIR: 'nome, whatsapp',
  // Plano de suporte (código que vem com a compra)
  SUPORTE_CODIGO: '',
  // Arquivo mensal no Google Drive
  ARQUIVO_AUTO: 'SIM', ARQUIVO_FEITO: '', ARQUIVO_PASTA: '',
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
  function hist(contatoId, negocioId, user, acao, detalhe, ref) {
    try {
      P.inserir('Historico', {
        id: P.id('H'), data: P.agora(), contato_id: contatoId || '', negocio_id: negocioId || '',
        usuario_nome: user ? user.nome : 'Sistema', acao: acao, detalhe: U.cap(detalhe, 500), ref_id: ref || ''
      });
    } catch (e) { /* o histórico nunca derruba a operação principal */ }
  }

  /* ======================================================== autenticação */
  function publicoUsuario(u) {
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, ativo: u.ativo, recebe_leads: u.recebe_leads, cor: u.cor, ultimo_acesso: u.ultimo_acesso, meta_valor: u.meta_valor || '', meta_reunioes: u.meta_reunioes || '', permissoes: u.permissoes || '' };
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

  /* Perfis:
     admin   cria as contas da equipe e configura tudo
     gestor  vê tudo, dispara, cria automações e relatórios
     sdr     atende os leads novos (fila sem dono + os seus) e passa os qualificados para um closer
     closer  recebe os leads passados e fecha a venda (vê só os seus)
     atendente perfil antigo, funciona como sdr */
  var PERM = {
    admin: { equipe: 1, integracoes: 1, ajustes: 1, excluir: 1, disparos: 1, automacoes: 1, todos: 1, relatorios: 1, passar: 1 },
    gestor: { excluir: 1, disparos: 1, automacoes: 1, todos: 1, relatorios: 1, passar: 1 },
    sdr: { passar: 1, fila: 1 },
    closer: {},
    atendente: { passar: 1, fila: 1 },
    personalizado: {}
  };
  PERM.admin.financeiro = 1; PERM.gestor.financeiro = 1;
  var PERFIS = Object.keys(PERM);
  /** Áreas que dá para liberar uma a uma no perfil "personalizado" (gestor de tráfego, marketing, financeiro...). */
  var AREAS = {
    todos: 'Ver todos os contatos e negócios', fila: 'Atender leads sem dono', passar: 'Passar leads para closer',
    disparos: 'Disparos de WhatsApp e e-mail marketing', automacoes: 'Automações', relatorios: 'Relatórios',
    financeiro: 'Financeiro (cobranças e recebimentos)', integracoes: 'Integrações', ajustes: 'Ajustes do sistema',
    excluir: 'Excluir registros', equipe: 'Equipe (criar contas)'
  };
  function permissoesDe(user) {
    if (user.perfil !== 'personalizado') return PERM[user.perfil] || {};
    var o = {};
    U.lista(user.permissoes).forEach(function (k) { if (AREAS[k]) o[k] = 1; });
    return o;
  }
  function pode(user, area) { return !!permissoesDe(user)[area]; }
  function exige(user, area) { if (!pode(user, area)) throw new Error('Seu perfil não tem acesso a esta área.'); }
  function veTodos(user) { return pode(user, 'todos') || cfg().ATENDENTE_VE_TODOS === 'SIM'; }
  function podeContato(user, c) {
    if (veTodos(user) || c.responsavel_id === user.id || c.sdr_id === user.id) return true;
    return !c.responsavel_id && pode(user, 'fila'); // closer não pega lead sem dono
  }

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
  function contatoPorIg(igId) { return igId ? P.tabela('Contatos').filter(function (c) { return c.ig_id === igId; })[0] || null : null; }
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
    var igId = U.str(dados.ig_id).trim();
    var existente = (dados.id && contatoPorId(dados.id)) || (igId && contatoPorIg(igId)) || (tel && contatoPorTel(tel)) || (email && contatoPorEmail(email));
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
      if (igId && !existente.ig_id) mud.ig_id = igId;
      if (dados.ig_usuario && !existente.ig_usuario) mud.ig_usuario = U.cap(dados.ig_usuario, 60);
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
    if (!tel && !email && !igId && !U.str(dados.nome).trim()) throw new Error('Informe pelo menos nome, telefone ou e-mail.');
    var c = {
      id: P.id('C'), nome: U.cap(U.str(dados.nome).trim() || (tel ? '+' + tel : email || (dados.ig_usuario ? '@' + dados.ig_usuario : 'Instagram')), 120), telefone: tel, email: email,
      canal: dados.canal || (igId && !tel ? 'instagram' : 'whatsapp'), ig_id: igId, ig_usuario: U.cap(dados.ig_usuario, 60), janela_ate: '', gratis_ate: '', sdr_id: '', pontos: '0',
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

  /** Quem recebe o próximo lead. perfis: lista opcional (ex.: ['closer']). Sem perfis, lead novo vai
      primeiro para SDRs; se não houver SDR no rodízio, para qualquer pessoa que recebe leads. */
  function proximoDoRodizio(perfis) {
    var todos = P.tabela('Usuarios').filter(function (u) { return u.ativo === 'SIM' && u.recebe_leads === 'SIM'; });
    var us = perfis ? todos.filter(function (u) { return perfis.indexOf(u.perfil) >= 0; }) : todos.filter(function (u) { return u.perfil === 'sdr' || u.perfil === 'atendente'; });
    if (!us.length && !perfis) us = todos;
    if (!us.length) return '';
    var abertos = {};
    us.forEach(function (u) { abertos[u.id] = 0; });
    P.tabela('Contatos').forEach(function (c) { if (c.responsavel_id in abertos && c.status === 'lead') abertos[c.responsavel_id]++; });
    var chave = 'rodizio_ult_' + (perfis ? perfis.join('_') : 'lead');
    var ult = U.str(P.cache.get(chave));
    us.sort(function (a, b) { return abertos[a.id] - abertos[b.id] || (a.id === ult ? 1 : 0) - (b.id === ult ? 1 : 0); });
    P.cache.put(chave, us[0].id, 21600);
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
  var ctxVars = null; // variáveis da execução de automação em andamento (ex.: dados da cobrança)
  function montarTexto(texto, c, user, extra) {
    c = c || {};
    var cp = camposDe(c);
    var v = {
      nome: c.nome || '', primeiro_nome: U.primeiroNome(c.nome), telefone: c.telefone || '', email: c.email || '',
      empresa: c.empresa || '', cidade: c.cidade || '', atendente: user ? U.primeiroNome(user.nome) : '',
      minha_empresa: cfg().NOME, saudacao: saudacao(), data: P.agora().slice(0, 10).split('-').reverse().join('/')
    };
    if (extra) Object.keys(extra).forEach(function (k) { v[k] = extra[k]; });
    if (ctxVars) Object.keys(ctxVars).forEach(function (k) { if (!(k in v)) v[k] = ctxVars[k]; });
    if (c.id && !('valor_parcela' in v) && ['valor_parcela', 'vencimento', 'link_pagamento', 'parcela', 'descricao_cobranca'].some(function (x) { return U.str(texto).indexOf('{' + x + '}') >= 0; })) {
      var fv = FIN.vars(FIN.proximaDoContato(c));
      Object.keys(fv).forEach(function (k) { v[k] = fv[k]; });
    }
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

  function req(url, metodo, corpo, cab, servico) {
    contarHttp();
    var r = P.http(url, { method: metodo || 'get', headers: cab || {}, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    var dados = U.json(r.text, null);
    if (r.code >= 300) {
      var msg = dados && (dados.message || dados.error || (dados.response && dados.response.message) || (dados.error && dados.error.message));
      if (Array.isArray(msg)) msg = msg.join('; ');
      if (msg && typeof msg === 'object') msg = JSON.stringify(msg);
      throw new Error((servico || 'WhatsApp') + ' (' + r.code + '): ' + U.cap(msg || r.text || 'sem resposta', 220));
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
      } else if (extra.flow && extra.flow.flow_id) {
        // WhatsApp Flow: um formulário dentro do WhatsApp (1 mensagem em vez de várias perguntas)
        var pf = { flow_message_version: '3', flow_token: extra.flow.token || 'prumo', flow_id: String(extra.flow.flow_id), flow_cta: U.cap(extra.flow.botao || 'Preencher', 30), flow_action: 'navigate' };
        if (extra.flow.tela) pf.flow_action_payload = { screen: extra.flow.tela };
        corpo.type = 'interactive';
        corpo.interactive = { type: 'flow', body: { text: U.cap(texto || 'Preencha rapidinho:', 1024) }, action: { name: 'flow', parameters: pf } };
      } else if (extra.opcoes && extra.opcoes.length) {
        // menu com botões (até 3) ou lista (até 10): a pessoa toca em vez de digitar
        corpo.type = 'interactive';
        if (extra.opcoes.length <= 3) {
          corpo.interactive = { type: 'button', body: { text: U.cap(texto, 1024) }, action: { buttons: extra.opcoes.map(function (o, i) { return { type: 'reply', reply: { id: 'op' + (i + 1), title: U.cap(o, 20) } }; }) } };
        } else {
          corpo.interactive = { type: 'list', body: { text: U.cap(texto, 4096) }, action: { button: 'Ver opções', sections: [{ title: 'Opções', rows: extra.opcoes.slice(0, 10).map(function (o, i) { return { id: 'op' + (i + 1), title: U.cap(o, 24), description: o.length > 24 ? U.cap(o, 72) : undefined }; }) }] } };
        }
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
            var it = mm.interactive || {};
            var resp = it.button_reply || it.list_reply || null;
            var t = (mm.text && mm.text.body) || (mm.button && mm.button.text) || (resp && resp.title) || (mm[mm.type] && mm[mm.type].caption) || '';
            var tp = { image: 'imagem', audio: 'audio', video: 'video', document: 'documento', sticker: 'figurinha' }[mm.type] || 'texto';
            var m = { telefone: mm.from, nome: nomes[mm.from] || '', texto: t, tipo: tp, wa_id: mm.id, deMim: false, canal: 'whatsapp' };
            if (resp && resp.id) m.escolha = resp.id;
            if (it.type === 'nfm_reply' && it.nfm_reply) { // resposta de WhatsApp Flow
              m.formulario = U.json(it.nfm_reply.response_json, {}) || {};
              m.texto = 'Formulário preenchido: ' + Object.keys(m.formulario).filter(function (k) { return k !== 'flow_token'; }).map(function (k) { return k + ': ' + U.str(m.formulario[k]); }).join(', ');
            }
            if (mm.referral) m.anuncio = { id: U.str(mm.referral.source_id), titulo: U.str(mm.referral.headline), url: U.str(mm.referral.source_url), tipo: U.str(mm.referral.source_type) };
            out.push(m);
          });
        });
      });
    }
    // Instagram (Direct e comentários)
    if (body.object === 'instagram' && body.entry) {
      var meuIg = U.str(cfg().IG_ID);
      body.entry.forEach(function (en) {
        (en.messaging || []).forEach(function (ev) {
          var msg = ev.message;
          if (!msg || !ev.sender) return;
          var eco = !!msg.is_echo || (meuIg && ev.sender.id === meuIg);
          var outro = eco ? ev.recipient && ev.recipient.id : ev.sender.id;
          if (!outro) return;
          var anexo = (msg.attachments || [])[0];
          out.push({
            canal: 'instagram', ig_id: U.str(outro), nome: '', texto: msg.text || '', tipo: anexo ? ({ image: 'imagem', audio: 'audio', video: 'video' }[anexo.type] || 'documento') : 'texto',
            wa_id: msg.mid || '', deMim: eco, escolha: msg.quick_reply && msg.quick_reply.payload
          });
        });
        (en.changes || []).forEach(function (ch) {
          if (ch.field !== 'comments' || !ch.value || !ch.value.from) return;
          var v = ch.value;
          if (meuIg && v.from.id === meuIg) return; // comentário da própria conta
          out.push({ canal: 'instagram', ig_id: U.str(v.from.id), ig_usuario: U.str(v.from.username), nome: '', texto: U.str(v.text), tipo: 'texto', wa_id: 'cm_' + v.id, deMim: false,
            comentario: { id: U.str(v.id), texto: U.str(v.text), post: U.str(v.media && v.media.id) } });
        });
      });
    }
    return out;
  };

  /* ============================================================ Instagram */
  var IG = {};
  IG.ativo = function () { var c = cfg(); return !!(c.IG_TOKEN && c.IG_ID); };
  IG.base = function () { return 'https://graph.instagram.com/' + (cfg().IG_VERSAO || 'v21.0'); };
  IG.cab = function () { return { Authorization: 'Bearer ' + cfg().IG_TOKEN }; };
  /** Envia DM. destino: {id} de quem conversa ou {comment_id} para responder um comentário no privado. */
  IG.enviar = function (destino, texto, midiaUrl, midiaTipo, opcoes) {
    if (!IG.ativo()) throw new Error('Instagram não configurado (Integrações > Instagram).');
    var msg = {};
    if (midiaUrl) msg.attachment = { type: { image: 'image', video: 'video', audio: 'audio' }[midiaTipo] || 'file', payload: { url: midiaUrl } };
    else msg.text = U.cap(texto, 1000);
    if (opcoes && opcoes.length && !midiaUrl) msg.quick_replies = opcoes.slice(0, 13).map(function (o, i) { return { content_type: 'text', title: U.cap(o, 20), payload: 'op' + (i + 1) }; });
    var r = req(IG.base() + '/' + cfg().IG_ID + '/messages', 'post', { recipient: destino, message: msg }, IG.cab());
    if (midiaUrl && texto) req(IG.base() + '/' + cfg().IG_ID + '/messages', 'post', { recipient: destino, message: { text: U.cap(texto, 1000) } }, IG.cab());
    return (r && (r.message_id || r.mid)) || '';
  };
  IG.responderComentario = function (comentarioId, texto) {
    return req(IG.base() + '/' + encodeURIComponent(comentarioId) + '/replies', 'post', { message: U.cap(texto, 2000) }, IG.cab());
  };
  IG.perfil = function (igsid) {
    try { var r = req(IG.base() + '/' + encodeURIComponent(igsid) + '?fields=username,name', 'get', undefined, IG.cab()); return { usuario: r.username || '', nome: r.name || '' }; }
    catch (e) { return { usuario: '', nome: '' }; }
  };
  IG.status = function () {
    if (!IG.ativo()) return { conectado: false, texto: 'Não configurado' };
    try { var r = req(IG.base() + '/me?fields=username,name', 'get', undefined, IG.cab()); return { conectado: true, texto: 'Conectado: @' + (r.username || '') }; }
    catch (e) { return { conectado: false, texto: e.message }; }
  };

  /* ============================================================ mensagens */
  function registrarMsg(c, m) {
    var reg = {
      id: P.id('M'), contato_id: c.id, direcao: m.direcao, tipo: m.tipo || 'texto', texto: U.cap(m.texto, 4000), midia_url: m.midia_url || '',
      status: m.status || '', erro: U.cap(m.erro, 300), usuario_id: m.usuario_id || '', origem: m.origem || '', wa_id: m.wa_id || '', criado_em: P.agora(),
      canal: m.canal || canalDe(c), cobranca: m.cobranca || ''
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

  function canalDe(c) { return c.canal === 'site' ? 'site' : c.canal === 'instagram' || (!c.telefone && c.ig_id) ? 'instagram' : 'whatsapp'; }
  /** Janela de atendimento de 24h (API oficial): aberta quando o contato escreveu nas últimas 24h. */
  function janelaAte(c) {
    if (c.janela_ate) return c.janela_ate;
    return c.ultima_direcao === 'in' && c.ultima_msg_em ? U.somaTempo(c.ultima_msg_em, 1440) : '';
  }
  function janelaAberta(c) { return janelaAte(c) > P.agora(); }
  function gratisAgora(c) { return !!(c.gratis_ate && c.gratis_ate > P.agora()); }
  function usaMeta() { return WA.provedor() === 'meta'; }

  /** Envia uma mensagem a um contato agora e registra na conversa.
      opc: user, origem, midia_url, midia_tipo, metaModelo, opcoes (menu com botões), flow, comentario_id */
  function enviarParaContato(c, texto, opc) {
    opc = opc || {};
    var canal = canalDe(c);
    var reg = { direcao: 'out', texto: texto, tipo: opc.midia_url ? ({ image: 'imagem', video: 'video', audio: 'audio', document: 'documento' }[opc.midia_tipo] || 'imagem') : 'texto', midia_url: opc.midia_url || '', usuario_id: opc.user ? opc.user.id : '', origem: opc.origem || 'manual', canal: canal };
    if (opc.metaModelo && opc.metaModelo.nome && !texto) reg.texto = '[modelo ' + opc.metaModelo.nome + ']';
    if (canal === 'site') { // a resposta fica guardada e a janela de chat do site busca
      reg.status = 'enviada';
      registrarMsg(c, reg);
      return { ok: true };
    }
    if (canal === 'instagram') {
      try {
        if (!opc.comentario_id && !janelaAberta(c)) throw new Error('O Instagram só deixa responder até 24 horas depois da última mensagem do contato.');
        reg.wa_id = IG.enviar(opc.comentario_id ? { comment_id: opc.comentario_id } : { id: c.ig_id }, texto, opc.midia_url, opc.midia_tipo, opc.opcoes);
        reg.status = 'enviada';
        registrarMsg(c, reg);
        if (reg.wa_id) P.cache.put('wa_' + reg.wa_id, '1', 3600);
        return { ok: true };
      } catch (e0) { reg.status = 'erro'; reg.erro = e0.message; registrarMsg(c, reg); throw e0; }
    }
    if (!c.telefone) { reg.status = 'erro'; reg.erro = 'Contato sem telefone'; registrarMsg(c, reg); throw new Error('Contato sem telefone.'); }
    if (!WA.temApi()) {
      reg.status = 'link';
      registrarMsg(c, reg);
      return { link: 'https://wa.me/' + U.telWa(c.telefone) + '?text=' + encodeURIComponent(texto || '') };
    }
    var temModelo = !!(opc.metaModelo && opc.metaModelo.nome);
    if (usaMeta()) { // classifica o custo da mensagem na API oficial
      if (gratisAgora(c)) reg.cobranca = 'gratis';
      else if (temModelo) reg.cobranca = opc.metaModelo.categoria === 'utility' ? 'utility' : 'marketing';
      else if (janelaAberta(c)) reg.cobranca = 'servico';
      else {
        reg.status = 'erro'; reg.erro = 'Janela de 24h fechada';
        registrarMsg(c, reg);
        throw new Error('A janela de 24 horas deste contato está fechada. Na API oficial, só um modelo aprovado pela Meta pode reabrir a conversa.');
      }
    }
    try {
      reg.wa_id = WA.enviar(c.telefone, texto, opc.midia_url, opc.midia_tipo, { metaModelo: temModelo ? opc.metaModelo : null, opcoes: usaMeta() ? opc.opcoes : null, flow: usaMeta() ? opc.flow : null });
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
    var ehIg = m.canal === 'instagram', ehSite = m.canal === 'site';
    if (!m.telefone && !(ehIg && m.ig_id) && !(ehSite && m.contato_id)) return null;
    if (m.wa_id && P.cache.get('wa_' + m.wa_id)) return null; // eco de algo que o próprio sistema enviou
    if (m.wa_id) P.cache.put('wa_' + m.wa_id, '1', 3600);
    var dados = ehIg ? { ig_id: m.ig_id, ig_usuario: m.ig_usuario, origem: 'Instagram', canal: 'instagram' } : { telefone: m.telefone, nome: m.deMim ? '' : m.nome, origem: m.anuncio ? 'Anúncio (WhatsApp)' : 'WhatsApp' };
    if (ehIg && !contatoPorIg(m.ig_id) && !m.deMim && IG.ativo()) { // busca @ e nome só na primeira vez
      var pf = IG.perfil(m.ig_id);
      dados.ig_usuario = dados.ig_usuario || pf.usuario;
      dados.nome = pf.nome || (dados.ig_usuario ? '@' + dados.ig_usuario : '');
    }
    var r = ehSite ? { contato: contatoPorId(m.contato_id), novo: !!m.primeira } : gravarContato(dados, null, { naoSobrescrever: true, silencioso: true, semGatilhos: true });
    if (!r.contato) return null;
    var c = r.contato;
    if (r.novo && !ehSite) hist(c.id, '', null, 'contato_criado', ehIg ? 'Chegou pelo Instagram' : m.anuncio ? 'Chegou por anúncio: ' + (m.anuncio.titulo || m.anuncio.id) : 'Chegou pelo WhatsApp');
    if (m.deMim) { // enviada pelo celular da empresa (ou pelo app do Instagram)
      registrarMsg(c, { direcao: 'out', texto: m.texto, tipo: m.tipo, status: 'enviada', origem: 'celular', wa_id: m.wa_id, canal: m.canal });
      pausarRobo(c);
      return c;
    }
    // comentário no Instagram: não abre janela de DM, mas pode disparar automação (comentou, recebe no Direct)
    if (m.comentario) {
      hist(c.id, '', null, 'comentario', '"' + U.cap(m.comentario.texto, 200) + '"');
      P.atualizar('Contatos', c.id, { atualizado_em: P.agora() });
      if (!roboPausado(c)) gatilho('comentario', c, { texto: m.comentario.texto, comentario_id: m.comentario.id, post: m.comentario.post });
      return c;
    }
    var mud = { janela_ate: U.somaTempo(P.agora(), 1440) };
    if (ehSite && c.canal !== 'site') mud.canal = 'site';
    else if (!ehSite && !ehIg && c.canal === 'site') mud.canal = 'whatsapp'; // voltou a falar pelo WhatsApp
    if (m.anuncio && usaMeta()) { // clique em anúncio para o WhatsApp: mensagens grátis por um período
      mud.gratis_ate = U.somaTempo(P.agora(), (U.num(cfg().META_GRATIS_HORAS) || 72) * 60);
      var cpA = camposDe(c); cpA.anuncio = m.anuncio.titulo || m.anuncio.id; cpA.anuncio_id = m.anuncio.id; mud.campos = JSON.stringify(cpA);
    }
    P.atualizar('Contatos', c.id, mud);
    Object.keys(mud).forEach(function (k) { c[k] = mud[k]; });
    registrarMsg(c, { direcao: 'in', texto: m.texto, tipo: m.tipo, status: 'recebida', origem: m.canal || 'whatsapp', wa_id: m.wa_id, canal: m.canal });
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
    if (esperando) { continuarComResposta(esperando, c, m.texto, m); return c; }
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
      if (tipo === 'palavra' || tipo === 'comentario') {
        var t = U.norm(info.texto);
        var pal = U.lista(g.palavras).map(U.norm);
        ok = pal.some(function (p) { return g.modo === 'exata' ? t === p : (p && t.indexOf(p) >= 0); });
        if (!pal.length && (g.qualquer || tipo === 'comentario')) ok = !!t;
        if (ok && tipo === 'comentario' && g.post) ok = U.str(g.post).trim() === info.post;
      } else if (tipo === 'email_aberto' || tipo === 'email_clicou') {
        ok = (!g.email_id || g.email_id === info.email_id) && (!g.link || U.norm(info.url).indexOf(U.norm(g.link)) >= 0);
      } else if (tipo === 'visitou') {
        ok = !g.url || U.norm(info.url).indexOf(U.norm(g.url)) >= 0;
      } else if (tipo === 'evento') {
        ok = g.evento === info.evento && (!g.produto || U.norm(info.produto).indexOf(U.norm(g.produto)) >= 0);
      } else if (tipo === 'tag') ok = U.norm(g.tag) === U.norm(info.tag);
      else if (tipo === 'etapa') ok = g.etapa_id === info.etapa_id;
      else if (tipo === 'novo_contato') ok = !g.origem || U.norm(g.origem) === U.norm(info.origem);
      else if (tipo === 'webhook') ok = !g.origem || U.norm(g.origem) === U.norm(info.origem);
      else ok = true;
      if (ok) iniciarAutomacao(x.reg, c, info);
    });
  }

  function iniciarAutomacao(a, c, info) {
    if (!c.telefone && !c.ig_id && passosDe(a).some(function (s) { return s.tipo === 'mensagem' || s.tipo === 'pergunta' || s.tipo === 'menu' || s.tipo === 'formulario'; })) return null;
    var execs = P.tabela('Execucoes').filter(function (e) { return e.automacao_id === a.id && e.contato_id === c.id; });
    if (execs.some(function (e) { return e.status === 'esperando_tempo' || e.status === 'esperando_resposta' || e.status === 'rodando'; })) return null;
    if (a.uma_vez === 'SIM' && execs.length) return null;
    // um contato só fica preso a uma pergunta por vez
    if (passosDe(a).some(function (s) { return s.tipo === 'pergunta' || s.tipo === 'menu' || s.tipo === 'formulario'; })) {
      P.tabela('Execucoes').filter(function (e) { return e.contato_id === c.id && e.status === 'esperando_resposta'; })
        .forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'substituida', atualizado_em: P.agora() }); });
    }
    var passos = passosDe(a);
    if (!passos.length) return null;
    var dadosEx = {};
    if (info && info.comentario_id) dadosEx.comentario_id = info.comentario_id;
    if (info && info.cobranca_id) dadosEx.cobranca_id = info.cobranca_id;
    var ex = { id: P.id('E'), automacao_id: a.id, contato_id: c.id, passo_id: passos[0].id, status: 'rodando', acordar_em: '', tentativas: '0', criado_em: P.agora(), atualizado_em: P.agora(), dados: JSON.stringify(dadosEx) };
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
    if (i >= 0 && passos[i].prox) return passos[i].prox; // ligação feita no construtor visual
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
    if (s.se === 'email') {
      var acao = s.op === 'clicou' || s.op === 'nao_clicou' ? 'email_clicou' : 'email_aberto';
      var fez = P.filtrar('Historico', 'contato_id', c.id).some(function (h) { return h.acao === acao && (!s.valor || h.ref_id === s.valor); });
      return s.op === 'nao_abriu' || s.op === 'nao_clicou' ? !fez : fez;
    }
    if (s.se === 'horario') {
      var hm = U.horaMin(P.agora());
      var ini = U.horaMin('T' + (s.inicio || '08:00')), fim = U.horaMin('T' + (s.fim || '18:00'));
      var dentro = hm >= ini && hm < fim && U.lista(s.dias || '1,2,3,4,5').indexOf(String(U.diaSemana(P.agora()))) >= 0;
      return dentro;
    }
    v = s.campo in c && ['nome', 'email', 'empresa', 'cidade', 'cargo', 'origem', 'status', 'pontos'].indexOf(s.campo) >= 0 ? c[s.campo] : cp[s.campo];
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
    var antes = ctxVars;
    var d = U.json(ex.dados, {}) || {};
    ctxVars = d.cobranca_id ? FIN.vars(FIN.porId(d.cobranca_id)) : null;
    try { return rodarPassos(ex, c, a); } finally { ctxVars = antes; }
  }
  function rodarPassos(ex, c, a) {
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
        if (s.tipo === 'mensagem' || s.tipo === 'pergunta' || s.tipo === 'menu' || s.tipo === 'formulario') {
          if (c.optout === 'SIM') { concluir(ex, a, 'cancelada'); return; }
          if (enviadas++ && P.dormir) P.dormir(1200);
          if (s.tipo === 'formulario') {
            if (enviarFormulario(ex, c, s, 0)) return; // ficou esperando a resposta
            atual = prox; P.atualizar('Execucoes', ex.id, { passo_id: atual, status: 'rodando', atualizado_em: P.agora() });
            continue;
          }
          var botoes = s.tipo === 'menu' && (usaMeta() || canalDe(c) === 'instagram');
          var txt = s.tipo === 'menu' && !botoes ? textoMenu(s) : s.texto;
          enviarDoRobo(ex, c, s, montarTexto(txt, c), { opcoes: botoes ? (s.opcoes || []).map(function (o) { return o.rotulo; }) : null });
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
        } else if (s.tipo === 'pontos') {
          var pts = U.num(c.pontos) + (s.acao === 'zerar' ? -U.num(c.pontos) : U.num(s.valor));
          P.atualizar('Contatos', c.id, { pontos: String(pts), atualizado_em: P.agora() }); c.pontos = String(pts);
        } else if (s.tipo === 'responder_comentario') {
          var dc = U.json(ex.dados, {}) || {};
          if (dc.comentario_id && s.texto) IG.responderComentario(dc.comentario_id, montarTexto(s.texto, c));
        } else if (s.tipo === 'passar') {
          passarParaCloser(c, { closer_id: s.modo === 'usuario' ? s.usuario_id : '', nota: s.nota ? montarTexto(s.nota, c) : '' }, null);
        } else if (s.tipo === 'email') {
          enfileirarEmail(c, s.email_id);
        } else if (s.tipo === 'activecampaign') {
          INT.acSincronizar(c, U.lista(s.tags));
        } else if (s.tipo === 'atribuir') {
          var resp = s.modo === 'usuario' ? s.usuario_id : s.modo === 'closer' ? proximoDoRodizio(['closer']) : proximoDoRodizio();
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

  /** Mensagem de robô: respeita o canal, a resposta privada a comentário e a janela de 24h da API oficial. */
  function enviarDoRobo(ex, c, s, texto, extra) {
    extra = extra || {};
    var opc = { origem: 'robo', midia_url: s.midia_url, midia_tipo: s.midia_tipo, opcoes: extra.opcoes, flow: extra.flow };
    if (canalDe(c) === 'instagram') {
      var d = U.json(ex.dados, {}) || {};
      if (d.comentario_id && !d.dm_feita) { // primeira mensagem depois de um comentário vai como resposta privada
        opc.comentario_id = d.comentario_id;
        d.dm_feita = 1;
        ex.dados = JSON.stringify(d);
        P.atualizar('Execucoes', ex.id, { dados: ex.dados });
      }
      return enviarParaContato(c, texto, opc);
    }
    if (!WA.temApi()) return registrarMsg(c, { direcao: 'out', texto: texto, status: 'pendente_link', origem: 'robo' });
    if (usaMeta() && !janelaAberta(c) && !gratisAgora(c)) {
      if (!s.meta_modelo) throw new Error('Janela de 24h fechada e o passo não tem modelo da Meta. Mensagem não enviada.');
      opc.metaModelo = { nome: s.meta_modelo, idioma: s.meta_idioma || 'pt_BR', categoria: s.meta_categoria || 'marketing', parametros: U.lista(s.meta_variaveis).map(function (v) { return montarTexto(v, c); }) };
      opc.opcoes = null; opc.flow = null;
    }
    return enviarParaContato(c, texto, opc);
  }

  /** Passo "formulário": na API oficial com Flow vai numa mensagem só; nos outros casos, pergunta campo a campo.
      Devolve true quando ficou esperando resposta. */
  function enviarFormulario(ex, c, s, idx) {
    var d = U.json(ex.dados, {}) || {};
    var espera = function () {
      var mud = { passo_id: s.id, status: 'esperando_resposta', acordar_em: s.expira_horas ? U.somaTempo(P.agora(), U.num(s.expira_horas) * 60) : '', tentativas: '0', atualizado_em: P.agora(), dados: JSON.stringify(d) };
      ex.dados = mud.dados;
      P.atualizar('Execucoes', ex.id, mud);
      if (mud.acordar_em) marcarTrabalho(mud.acordar_em);
      return true;
    };
    if (s.flow_id && usaMeta() && canalDe(c) === 'whatsapp') {
      d.fi = -1;
      enviarDoRobo(ex, c, s, montarTexto(s.texto || 'Preencha rapidinho:', c), { flow: { flow_id: s.flow_id, botao: s.botao, tela: s.tela, token: ex.id } });
      return espera();
    }
    var perguntas = (s.perguntas || []).filter(function (q) { return q && q.texto; });
    if (idx >= perguntas.length) return false;
    d.fi = idx;
    var q = perguntas[idx];
    enviarDoRobo(ex, c, s, montarTexto((idx === 0 && s.texto ? s.texto + '\n\n' : '') + q.texto, c));
    return espera();
  }

  /** Respostas de um WhatsApp Flow: grava nos campos do contato (nome, email, campos personalizados...). */
  function gravarFormulario(c, s, resp) {
    var mapa = {};
    (s.mapa || []).forEach(function (x) { if (x && x.de && x.para) mapa[x.de] = x.para; });
    Object.keys(resp || {}).forEach(function (k) {
      if (k === 'flow_token') return;
      var v = resp[k];
      if (Array.isArray(v)) v = v.join(', ');
      if (v === null || v === undefined || typeof v === 'object') return;
      var destino = mapa[k] || U.norm(k).replace(/[^a-z0-9_]/g, '_');
      if (destino === 'telefone' || destino === 'whatsapp') return;
      gravarCampo(c, destino, U.str(v));
    });
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

  function respostaValida(validar, resp) {
    if (validar === 'email') return U.emailOk(resp);
    if (validar === 'numero') return /\d/.test(resp);
    if (validar === 'telefone') return U.dig(resp).length >= 10;
    return true;
  }
  function tentarDeNovo(ex, c, texto) {
    var t = U.num(ex.tentativas) + 1;
    if (t >= 3) return false;
    P.atualizar('Execucoes', ex.id, { tentativas: String(t), atualizado_em: P.agora() });
    try { enviarParaContato(c, texto, { origem: 'robo' }); } catch (e) { /* segue */ }
    return true;
  }

  function continuarComResposta(ex, c, texto, m) {
    m = m || {};
    var a = P.tabela('Automacoes').filter(function (x) { return x.id === ex.automacao_id; })[0];
    if (!a) { P.atualizar('Execucoes', ex.id, { status: 'cancelada' }); return; }
    var passos = passosDe(a);
    var s = passos.filter(function (x) { return x.id === ex.passo_id; })[0];
    if (!s) { concluir(ex, a); return; }
    var prox = proximoId(passos, s.id);
    var resp = U.str(texto).trim();
    if (s.tipo === 'formulario') {
      var d = U.json(ex.dados, {}) || {};
      if (m.formulario) gravarFormulario(c, s, m.formulario);
      else if (d.fi === -1) { if (tentarDeNovo(ex, c, s.erro_texto || 'Toque no botão da mensagem acima para preencher, por favor.')) return; }
      else {
        var q = (s.perguntas || []).filter(function (x) { return x && x.texto; })[U.num(d.fi)];
        if (q) {
          if (!respostaValida(q.validar, resp)) { if (tentarDeNovo(ex, c, q.erro_texto || 'Não entendi. Pode responder de novo?')) return; }
          else if (q.campo) gravarCampo(c, q.campo, q.validar === 'telefone' ? U.telWa(resp) : resp);
          P.atualizar('Execucoes', ex.id, { tentativas: '0' });
          try { if (enviarFormulario(ex, c, s, U.num(d.fi) + 1)) return; } catch (e1) { hist(c.id, '', null, 'automacao_erro', a.nome + ': ' + e1.message); }
        }
      }
    } else if (s.tipo === 'pergunta') {
      if (!respostaValida(s.validar, resp)) {
        if (tentarDeNovo(ex, c, s.erro_texto || 'Não entendi. Pode responder de novo?')) return;
      } else if (s.campo) gravarCampo(c, s.campo, s.validar === 'telefone' ? U.telWa(resp) : resp);
    } else if (s.tipo === 'menu') {
      var ops = s.opcoes || [];
      var n = /^op\d+$/.test(U.str(m.escolha)) ? Number(m.escolha.slice(2)) : parseInt(U.dig(resp.slice(0, 3)), 10);
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

  /* ================================================== SDR -> closer */
  function nomeUsuario(id) { var u = P.tabela('Usuarios').filter(function (x) { return x.id === id; })[0]; return u ? u.nome : ''; }
  function fmtDataHora(iso) { iso = U.str(iso); return iso.slice(8, 10) + '/' + iso.slice(5, 7) + ' às ' + iso.slice(11, 16); }

  /** O SDR qualificou o lead: entrega para um closer (escolhido ou no rodízio), com reunião opcional. */
  function passarParaCloser(c, o, user) {
    o = o || {};
    var closer = o.closer_id || proximoDoRodizio(['closer']);
    var uc = P.tabela('Usuarios').filter(function (x) { return x.id === closer && x.ativo === 'SIM'; })[0];
    if (!uc) throw new Error('Nenhum closer disponível. Cadastre um closer em Equipe e marque "recebe leads".');
    var sdr = user ? user.id : (c.responsavel_id || '');
    var etapaAlvo = o.etapa_id || cfg().PASSAR_ETAPA;
    var neg = (o.negocio_id && P.tabela('Negocios').filter(function (n) { return n.id === o.negocio_id; })[0]) ||
      P.tabela('Negocios').filter(function (n) { return n.contato_id === c.id && n.status === 'aberto'; })[0];
    if (!neg) {
      var et = (etapaAlvo && P.tabela('Etapas').filter(function (e) { return e.id === etapaAlvo; })[0]) || (funisCompletos()[0] || { etapas: [] }).etapas.filter(function (e) { return e.tipo === 'aberto'; })[0];
      if (!et) throw new Error('Crie um funil antes de passar leads.');
      neg = moverContatoParaEtapa(c, et.id, user);
    } else if (etapaAlvo && neg.etapa_id !== etapaAlvo) moverNegocio(neg, etapaAlvo, user);
    var mud = { responsavel_id: closer, sdr_id: neg.sdr_id || sdr, passado_em: P.agora(), atualizado_em: P.agora() };
    if (o.valor) mud.valor = String(U.num(o.valor));
    if (o.reuniao_em) { mud.reuniao_em = U.str(o.reuniao_em).slice(0, 16) + ':00'; mud.reuniao_status = 'agendada'; }
    P.atualizar('Negocios', neg.id, mud);
    Object.keys(mud).forEach(function (k) { neg[k] = mud[k]; });
    P.atualizar('Contatos', c.id, { responsavel_id: closer, sdr_id: c.sdr_id || sdr, atualizado_em: P.agora() });
    c.responsavel_id = closer; c.sdr_id = c.sdr_id || sdr;
    hist(c.id, neg.id, user, 'passado', (user ? user.nome : 'Robô') + ' passou para ' + uc.nome + (mud.reuniao_em ? ' com reunião em ' + fmtDataHora(mud.reuniao_em) : ''));
    if (o.nota) hist(c.id, neg.id, user, 'nota', U.cap(o.nota, 2000));
    if (mud.reuniao_em) agendarReuniao(c, neg, user);
    else P.inserir('Tarefas', { id: P.id('T'), titulo: 'Lead qualificado: falar com ' + c.nome, tipo: 'whatsapp', contato_id: c.id, negocio_id: neg.id, responsavel_id: closer, vence_em: U.somaTempo(P.agora(), 120), feita: 'NAO', notas: o.nota || '', criado_em: P.agora() });
    saida('lead.passado', { contato: contatoPublico(c), negocio: neg, closer: uc.nome, sdr: nomeUsuario(neg.sdr_id) });
    return neg;
  }

  /** Cria a tarefa do closer e agenda o lembrete automático para o lead (reduz faltas). */
  function agendarReuniao(c, neg, user) {
    var quando = neg.reuniao_em;
    P.inserir('Tarefas', { id: P.id('T'), titulo: 'Reunião com ' + c.nome, tipo: 'reuniao', contato_id: c.id, negocio_id: neg.id, responsavel_id: neg.responsavel_id, vence_em: quando, feita: 'NAO', notas: 'Agendada por ' + (user ? user.nome : 'Robô'), criado_em: P.agora() });
    var antigos = {};
    P.tabela('Fila').forEach(function (f) { if (f.tipo === 'lembrete' && f.ref_id === neg.id && f.status === 'pendente') antigos[f.id] = { status: 'cancelado' }; });
    P.atualizarVarios('Fila', antigos);
    if (cfg().LEMBRETE_REUNIAO !== 'SIM' || (!c.telefone && !c.ig_id)) return;
    var envio = U.somaTempo(quando, -(U.num(cfg().LEMBRETE_HORAS) || 2) * 60);
    if (envio <= P.agora()) return;
    P.inserir('Fila', { id: P.id('F'), tipo: 'lembrete', ref_id: neg.id, contato_id: c.id, destino: c.telefone, texto: montarTexto(cfg().LEMBRETE_TEXTO, c, null, { hora_reuniao: quando.slice(11, 16), data_reuniao: quando.slice(8, 10) + '/' + quando.slice(5, 7) }), midia_url: '', midia_tipo: '', enviar_em: envio, status: 'pendente', erro: '', criado_em: P.agora(), enviado_em: '' });
    marcarTrabalho(envio);
    saida('reuniao.agendada', { contato: contatoPublico(c), negocio: neg });
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
    // virou o mês: arquiva o mês anterior de madrugada (ou a partir do dia 3 a qualquer hora), um pouco por rodada
    var k0 = cfg();
    if (P.arquivo && k0.ARQUIVO_AUTO === 'SIM' && U.str(k0.ARQUIVO_FEITO) < mesAtual() && (Number(agora.slice(11, 13)) < 6 || Number(agora.slice(8, 10)) >= 3)) {
      try { arquivar(null, 20000); } catch (e) { hist('', '', null, 'arquivo_erro', e.message); }
    }
    try { FIN.verificarDia(); } catch (e) { hist('', '', null, 'automacao_erro', 'Financeiro: ' + e.message); }
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
      var pend = P.tabela('Fila').filter(function (f) { return f.status === 'pendente' && f.tipo !== 'email' && f.enviar_em <= agora; })
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
        if (c && c.optout === 'SIM' && f.tipo !== 'lembrete') { P.atualizar('Fila', f.id, { status: 'cancelado', erro: 'Pediu para sair' }); continue; }
        if (f.tipo === 'lembrete') {
          var ng = P.tabela('Negocios').filter(function (n) { return n.id === f.ref_id; })[0];
          if (!c || !ng || ng.reuniao_status !== 'agendada') { P.atualizar('Fila', f.id, { status: 'cancelado', erro: 'Reunião desmarcada' }); continue; }
        }
        var texto = montarTexto(f.texto || (camp ? camp.texto : ''), c || {});
        try {
          if (enviados + erros > 0 && P.dormir) P.dormir(1000 + Math.floor(Math.random() * 1500));
          if (c) {
            var meta = camp && U.json(camp.meta_modelo, null);
            if (f.tipo === 'lembrete' && usaMeta() && cfg().LEMBRETE_MODELO) meta = { nome: cfg().LEMBRETE_MODELO, categoria: 'utility', variaveis: ['{primeiro_nome}', texto.match(/\d\d:\d\d/) ? texto.match(/\d\d:\d\d/)[0] : ''] };
            // economia na API oficial: quem está com a janela aberta recebe texto comum (sem cobrança de modelo)
            if (meta && meta.nome && usaMeta() && (janelaAberta(c) || gratisAgora(c)) && texto.trim() && (!camp || camp.economia !== 'NAO')) meta = null;
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

    // 4) e-mails (campanhas agendadas e fila)
    P.tabela('Emails').filter(function (e) { return e.status === 'agendada' && e.agendar_em && e.agendar_em <= agora; })
      .forEach(function (e) { try { iniciarEmail(e); } catch (er) { P.atualizar('Emails', e.id, { status: 'erro' }); } });
    var re = trabalharEmails(agora, 25);
    enviados += re.enviados; erros += re.erros;

    // 5) quando é o próximo trabalho?
    var futuros = [];
    P.tabela('Fila').forEach(function (f) { if (f.status === 'pendente') futuros.push(f.enviar_em); });
    P.tabela('Execucoes').forEach(function (e) { if ((e.status === 'esperando_tempo' || e.status === 'esperando_resposta') && e.acordar_em) futuros.push(e.acordar_em); });
    P.tabela('Campanhas').forEach(function (c) { if (c.status === 'agendada' && c.agendar_em) futuros.push(c.agendar_em); });
    P.tabela('Emails').forEach(function (e) { if (e.status === 'agendada' && e.agendar_em) futuros.push(e.agendar_em); });
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
    // lista de pares {name, value} (Lead Ads do Facebook/Instagram, TikTok, Typebot...): vira {name: value}
    if (Array.isArray(obj) && obj.length && obj.every(function (x) { return x && typeof x === 'object' && (x.name || x.field_name || x.key || x.question || x.label) !== undefined && ('value' in x || 'values' in x || 'answer' in x); })) {
      obj.forEach(function (x) {
        var k = U.str(x.name || x.field_name || x.key || x.question || x.label);
        var v = 'values' in x ? (Array.isArray(x.values) ? x.values.join(', ') : x.values) : ('value' in x ? x.value : x.answer);
        out[pref ? pref + '.' + k : k] = Array.isArray(v) ? v.join(', ') : v;
      });
      return out;
    }
    Object.keys(obj).forEach(function (k) {
      var chave = pref ? pref + '.' + k : k;
      if (obj[k] && typeof obj[k] === 'object') achatar(obj[k], chave, out, nivel + 1);
      else out[chave] = obj[k];
    });
    return out;
  }
  var ALVOS = {
    nome: ['nome', 'name', 'full_name', 'fullname', 'nome_completo', 'buyer.name', 'customer.full_name', 'contact.name', 'your-name'],
    email: ['email', 'e-mail', 'mail', 'buyer.email', 'customer.email', 'contact.email', 'your-email', 'email_address'],
    telefone: ['telefone', 'phone', 'whatsapp', 'celular', 'fone', 'tel', 'mobile', 'phone_number', 'checkout_phone', 'buyer.checkout_phone', 'customer.mobile', 'contact.phone_number', 'your-phone', 'mobile_phone'],
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
        if ((k === a || k.slice(-(a.length + 1)) === '.' + a || k.slice(-(a.length + 2)) === '[' + a + ']') && U.str(plano[chaves[j]]).trim()) return U.str(plano[chaves[j]]).trim();
      }
    }
    return '';
  }

  function webhookEntrada(body, p, vendas) {
    var plano = achatar(body);
    var d = {};
    Object.keys(ALVOS).forEach(function (k) { d[k] = acharValor(plano, ALVOS[k]); });
    if (!d.nome) { var fn = acharValor(plano, ['first_name', 'primeiro_nome']), ln = acharValor(plano, ['last_name', 'sobrenome']); if (fn) d.nome = (fn + ' ' + ln).trim(); }
    if (!d.telefone && !d.email) throw new Error('Não encontrei telefone nem e-mail no que chegou.');
    var ev = INT.evento(body, plano, p.fonte);
    if (ev && !vendas) ev = { plataforma: ev.plataforma }; // na URL pública de captação, compra não vale (evita venda falsa)
    d.origem = p.origem || (ev && ev.plataforma) || acharValor(plano, ['origem', 'utm_source', 'source']) || 'Webhook';
    d.tags = U.lista(p.tags);
    if (ev && ev.tag) d.tags.push(ev.tag);
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
    if (ev) INT.aplicarEvento(r.contato, ev);
    if (p.etapa) moverContatoParaEtapa(r.contato, p.etapa, null);
    gatilho('webhook', r.contato, { origem: d.origem });
    if (p.automacao) {
      var a = P.tabela('Automacoes').filter(function (x) { return x.id === p.automacao; })[0];
      if (a) iniciarAutomacao(a, r.contato, {});
    }
    return { ok: true, contato_id: r.contato.id, novo: r.novo };
  }

  /* ===================================================== e-mail marketing */
  // Envio pelo Gmail da própria conta Google (grátis: ~100/dia em conta comum, 1.500 no Workspace)
  // e, se configurado, pelo plano grátis do Brevo (300/dia). Aberturas, cliques, descadastro e
  // visitas ao site são registrados pelo próprio servidor, com links assinados (não dá para forjar).
  var EM = {};
  EM.esc = function (s) { return U.str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  EM.segredo = function () {
    var s = cfg().RASTREIO_SEGREDO;
    if (!s) { s = P.uuid().replace(/-/g, '') + P.uuid().replace(/-/g, ''); salvarCfg({ RASTREIO_SEGREDO: s }); }
    return s;
  };
  EM.assinar = function (v) { return P.hash(String(v), EM.segredo()).slice(0, 16); };
  EM.confere = function (v, s) { return !!v && !!s && EM.assinar(v) === s; };
  EM.pcid = function (c) { return c.id + '.' + EM.assinar('c' + c.id); };
  EM.dePcid = function (pc) { var m = U.str(pc).split('.'); return m.length === 2 && m[0] && EM.assinar('c' + m[0]) === m[1] ? contatoPorId(m[0]) : null; };
  EM.podeReceber = function (c) { return !!c && U.emailOk(c.email) && c.email_optout !== 'SIM'; };

  /** Monta o e-mail para um contato. opc.fila_id liga o rastreio; sem ele (prévia/teste) os links ficam diretos. */
  EM.montar = function (em, c, opc) {
    opc = opc || {};
    c = c || {};
    var k = cfg(), cor = /^#[0-9a-f]{6}$/i.test(k.COR_PRIMARIA) ? k.COR_PRIMARIA : '#1F6FEB';
    var fid = opc.fila_id || '', base = P.urlApp(), sig = fid ? EM.assinar(fid) : '';
    var link = function (url) {
      url = U.str(url).trim();
      if (!/^https?:\/\//i.test(url) || !fid) return url;
      if (k.SITE_URL) return k.SITE_URL.replace(/\/?$/, '/') + 'r.html?f=' + fid + '&s=' + sig + '&a=' + encodeURIComponent(base) + '&u=' + encodeURIComponent(url);
      return base + '?t=c&f=' + fid + '&s=' + sig + '&u=' + encodeURIComponent(url);
    };
    var txt = function (t) {
      return EM.esc(montarTexto(t, c)).replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
        .replace(/(https?:\/\/[^\s<]+)/g, function (u) { return '<a href="' + EM.esc(link(u.replace(/&amp;/g, '&'))) + '" style="color:' + cor + '">' + u + '</a>'; })
        .replace(/\n/g, '<br>');
    };
    var corpo = '', plano = [];
    (U.json(em.blocos, []) || []).forEach(function (b) {
      if (!b || !b.tipo) return;
      if (b.tipo === 'titulo') { corpo += '<h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#111827;font-weight:700">' + txt(b.texto) + '</h1>'; plano.push(montarTexto(b.texto, c)); }
      else if (b.tipo === 'texto') { corpo += '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151">' + txt(b.texto) + '</p>'; plano.push(montarTexto(b.texto, c)); }
      else if (b.tipo === 'botao' && b.url) {
        corpo += '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:' + cor + ';border-radius:8px"><a href="' + EM.esc(link(montarTexto(b.url, c))) + '" style="display:inline-block;padding:14px 26px;color:#ffffff;font-weight:700;font-size:16px;text-decoration:none">' + EM.esc(montarTexto(b.texto || 'Saiba mais', c)) + '</a></td></tr></table>';
        plano.push(montarTexto(b.texto || 'Saiba mais', c) + ': ' + montarTexto(b.url, c));
      } else if (b.tipo === 'imagem' && /^https:\/\//i.test(U.str(b.url))) {
        var img = '<img src="' + EM.esc(b.url) + '" alt="' + EM.esc(b.alt || '') + '" width="536" style="width:100%;max-width:536px;height:auto;border:0;border-radius:8px;display:block">';
        corpo += '<div style="margin:0 0 16px">' + (b.link ? '<a href="' + EM.esc(link(b.link)) + '">' + img + '</a>' : img) + '</div>';
      } else if (b.tipo === 'divisor') corpo += '<hr style="border:0;border-top:1px solid #E5E7EB;margin:24px 0">';
      else if (b.tipo === 'espaco') corpo += '<div style="height:24px;line-height:24px">&nbsp;</div>';
    });
    var sair = fid ? base + '?t=sair&f=' + fid + '&s=' + sig : '#';
    var logo = /^https:\/\//i.test(U.str(k.LOGO_URL)) ? '<img src="' + EM.esc(k.LOGO_URL) + '" alt="' + EM.esc(k.NOME) + '" height="40" style="height:40px;border:0;display:block">' : '<span style="font-size:20px;font-weight:800;color:' + cor + '">' + EM.esc(k.NOME) + '</span>';
    var assunto = montarTexto(opc.variante === 'B' && em.assunto_b ? em.assunto_b : em.assunto, c);
    var html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + EM.esc(assunto) + '</title></head>' +
      '<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif">' +
      (em.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + EM.esc(montarTexto(em.preheader, c)) + '</div>' : '') +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">' +
      '<tr><td style="padding:0 8px 16px">' + logo + '</td></tr>' +
      '<tr><td style="background:#ffffff;border-radius:12px;padding:32px">' + corpo + '</td></tr>' +
      '<tr><td style="padding:20px 8px;font-size:12px;line-height:1.5;color:#6B7280;text-align:center">' + (k.EMAIL_RODAPE ? EM.esc(k.EMAIL_RODAPE) + '<br>' : '') +
      'Você recebe estes e-mails porque se cadastrou com a ' + EM.esc(k.NOME) + '. <a href="' + EM.esc(sair) + '" style="color:#6B7280">Não quero mais receber</a></td></tr>' +
      '</table></td></tr></table>' +
      (fid ? '<img src="' + EM.esc(base + '?t=o&f=' + fid + '&s=' + sig) + '" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0">' : '') +
      '</body></html>';
    var texto = plano.join('\n\n') + '\n\n--\n' + (k.EMAIL_RODAPE ? k.EMAIL_RODAPE + '\n' : '') + 'Para não receber mais: ' + sair;
    return { assunto: assunto, html: html, texto: texto, descadastro: sair };
  };

  /** Quantos e-mails já saíram hoje por provedor. */
  EM.contagem = function () {
    var h = P.agora().slice(0, 10), x = U.str(cfg().EMAIL_CONTAGEM).split('|');
    return x[0] === h ? { dia: h, gmail: U.num(x[1]), brevo: U.num(x[2]) } : { dia: h, gmail: 0, brevo: 0 };
  };
  EM.cota = function (n) {
    var k = cfg(), prov = k.EMAIL_PROVEDOR || 'gmail';
    n = n || EM.contagem();
    var g = prov === 'brevo' ? 0 : Math.max(0, U.num(k.EMAIL_LIMITE_GMAIL) - n.gmail);
    if (g && P.email && P.email.cotaGmail) { try { g = Math.min(g, P.email.cotaGmail()); } catch (e) { /* segue com o limite configurado */ } }
    var b = prov === 'gmail' || !k.BREVO_APIKEY || !k.BREVO_REMETENTE ? 0 : Math.max(0, U.num(k.BREVO_LIMITE) - n.brevo);
    var porDia = (prov === 'brevo' ? 0 : U.num(k.EMAIL_LIMITE_GMAIL)) + (prov === 'gmail' || !k.BREVO_APIKEY ? 0 : U.num(k.BREVO_LIMITE));
    return { gmail: g, brevo: b, total: g + b, enviados_hoje: n.gmail + n.brevo, por_dia: porDia, provedor: prov };
  };
  /** Envia um e-mail pelo provedor com saldo. n = contagem do dia (o chamador grava no fim). */
  EM.enviar = function (m, n) {
    var k = cfg(), q = EM.cota(n);
    if (q.gmail > 0) {
      if (!P.email || !P.email.gmail) throw new Error('Envio pelo Gmail indisponível aqui.');
      P.email.gmail({ para: m.para, assunto: m.assunto, html: m.html, texto: m.texto, nome: k.EMAIL_NOME || k.NOME, responder: k.EMAIL_RESPONDER });
      n.gmail++;
      return 'gmail';
    }
    if (q.brevo > 0) {
      var corpo = { sender: { name: k.EMAIL_NOME || k.NOME, email: k.BREVO_REMETENTE }, to: [{ email: m.para, name: m.nome || undefined }], subject: m.assunto, htmlContent: m.html, textContent: m.texto };
      if (k.EMAIL_RESPONDER) corpo.replyTo = { email: k.EMAIL_RESPONDER };
      if (m.descadastro && m.descadastro !== '#') corpo.headers = { 'List-Unsubscribe': '<' + m.descadastro + '>' };
      req('https://api.brevo.com/v3/smtp/email', 'post', corpo, { 'api-key': k.BREVO_APIKEY, accept: 'application/json' }, 'Brevo');
      n.brevo++;
      return 'brevo';
    }
    throw new Error('LIMITE_DIA');
  };

  function publicoEmail(e) { return filtrarContatos(U.json(e.filtro, {}) || {}).filter(EM.podeReceber); }
  function iniciarEmail(e) {
    var alvo = publicoEmail(e);
    if (!alvo.length) throw new Error('Nenhum contato com e-mail válido (e sem descadastro) neste público.');
    var inicio = e.agendar_em && e.agendar_em > P.agora() ? e.agendar_em : P.agora();
    var linhas = alvo.map(function (c, i) {
      return { id: P.id('F') + i, tipo: 'email', ref_id: e.id, contato_id: c.id, destino: c.email, texto: '', midia_url: '', midia_tipo: '', enviar_em: inicio, status: 'pendente', erro: '', criado_em: P.agora(), enviado_em: '', variante: e.assunto_b && i % 2 ? 'B' : 'A', aberto_em: '', clicado_em: '' };
    });
    P.inserirVarios('Fila', linhas);
    P.atualizar('Emails', e.id, { status: 'enviando', total: String(linhas.length), enviados: '0', enviados_b: '0', erros: '0', iniciada_em: P.agora() });
    marcarTrabalho(inicio);
    var q = EM.cota();
    return { total: linhas.length, por_dia: q.por_dia, dias: q.por_dia ? Math.ceil(Math.max(0, linhas.length - q.total) / q.por_dia) + 1 : 0 };
  }
  /** Passo de automação "Enviar e-mail": entra na fila e sai na próxima rodada (respeita o limite do dia). */
  function enfileirarEmail(c, emailId) {
    var em = P.tabela('Emails').filter(function (x) { return x.id === emailId; })[0];
    if (!em) throw new Error('E-mail da automação não encontrado.');
    if (!EM.podeReceber(c)) { hist(c.id, '', null, 'automacao_erro', 'E-mail não enviado: contato sem e-mail válido ou descadastrado'); return; }
    P.inserir('Fila', { id: P.id('F'), tipo: 'email', ref_id: em.id, contato_id: c.id, destino: c.email, texto: '', midia_url: '', midia_tipo: '', enviar_em: P.agora(), status: 'pendente', erro: '', criado_em: P.agora(), enviado_em: '', variante: 'A', aberto_em: '', clicado_em: '' });
    P.atualizar('Emails', em.id, { total: String(U.num(em.total) + 1) });
    marcarTrabalho(P.agora());
  }
  /** Parte do trabalho de 1 minuto: envia e-mails da fila até o limite do dia. */
  function trabalharEmails(agora, max) {
    var pend = P.tabela('Fila').filter(function (f) { return f.tipo === 'email' && f.status === 'pendente' && f.enviar_em <= agora; })
      .sort(function (a, b) { return a.enviar_em < b.enviar_em ? -1 : 1; });
    if (!pend.length) return { enviados: 0, erros: 0 };
    var ems = {};
    P.tabela('Emails').forEach(function (e) { ems[e.id] = e; });
    var n = EM.contagem(), enviados = 0, erros = 0, mudE = {}, sem = false;
    var marca = function (em, k, v) { mudE[em.id] = mudE[em.id] || {}; em[k] = String(U.num(em[k]) + v); mudE[em.id][k] = em[k]; };
    for (var i = 0; i < pend.length && enviados + erros < (max || 25); i++) {
      var f = pend[i], em = ems[f.ref_id];
      if (!em || em.status === 'cancelada') { P.atualizar('Fila', f.id, { status: 'cancelado' }); continue; }
      if (em.tipo !== 'automacao' && em.status !== 'enviando') continue;
      var c = contatoPorId(f.contato_id);
      if (!EM.podeReceber(c)) { P.atualizar('Fila', f.id, { status: 'cancelado', erro: 'Sem e-mail ou descadastrado' }); continue; }
      try {
        var r = EM.montar(em, c, { fila_id: f.id, variante: f.variante });
        EM.enviar({ para: c.email, nome: c.nome, assunto: r.assunto, html: r.html, texto: r.texto, descadastro: r.descadastro }, n);
        P.atualizar('Fila', f.id, { status: 'enviado', enviado_em: P.agora() });
        marca(em, 'enviados', 1);
        if (f.variante === 'B') marca(em, 'enviados_b', 1);
        hist(c.id, '', null, 'email_enviado', r.assunto, em.id);
        enviados++;
      } catch (e) {
        if (e.message === 'LIMITE_DIA') { sem = true; break; }
        P.atualizar('Fila', f.id, { status: 'erro', erro: U.cap(e.message, 300), enviado_em: P.agora() });
        marca(em, 'erros', 1);
        erros++;
      }
    }
    if (sem) { // acabou o limite de hoje: o resto sai amanhã às 8h
      var amanha = U.somaTempo(agora.slice(0, 10) + 'T08:00:00', 1440), adiar = {};
      pend.forEach(function (f) { if (f.status === 'pendente') adiar[f.id] = { enviar_em: amanha }; });
      P.atualizarVarios('Fila', adiar);
    }
    Object.keys(ems).forEach(function (id) {
      var e = ems[id];
      if (e.tipo !== 'automacao' && e.status === 'enviando' && U.num(e.total) > 0 && U.num(e.enviados) + U.num(e.erros) >= U.num(e.total)) { mudE[id] = mudE[id] || {}; mudE[id].status = 'concluida'; mudE[id].concluida_em = P.agora(); }
    });
    P.atualizarVarios('Emails', mudE);
    if (enviados) salvarCfg({ EMAIL_CONTAGEM: n.dia + '|' + n.gmail + '|' + n.brevo });
    return { enviados: enviados, erros: erros, limite: sem };
  }

  function filaPorId(id) { return id ? P.filtrar('Fila', 'id', id)[0] || null : null; }
  function emailDaFila(f) { return P.tabela('Emails').filter(function (e) { return e.id === f.ref_id; })[0] || null; }
  EM.abriu = function (fid, s) {
    if (!EM.confere(fid, s)) return false;
    var f = filaPorId(fid);
    if (!f || f.tipo !== 'email' || f.aberto_em) return false;
    P.atualizar('Fila', f.id, { aberto_em: P.agora() });
    var em = emailDaFila(f);
    if (em) { var m = { aberturas: String(U.num(em.aberturas) + 1) }; if (f.variante === 'B') m.aberturas_b = String(U.num(em.aberturas_b) + 1); P.atualizar('Emails', em.id, m); }
    var c = contatoPorId(f.contato_id);
    if (c) { hist(c.id, '', null, 'email_aberto', em ? em.assunto : '', f.ref_id); gatilho('email_aberto', c, { email_id: f.ref_id }); }
    return true;
  };
  EM.clicou = function (fid, s, url) {
    if (!EM.confere(fid, s)) return null;
    var f = filaPorId(fid);
    if (!f || f.tipo !== 'email') return null;
    if (!f.aberto_em) { EM.abriu(fid, s); f = filaPorId(fid); } // imagens bloqueadas: o clique prova a abertura
    var em = emailDaFila(f);
    if (!f.clicado_em) { P.atualizar('Fila', f.id, { clicado_em: P.agora() }); if (em) P.atualizar('Emails', em.id, { cliques: String(U.num(em.cliques) + 1) }); }
    var c = contatoPorId(f.contato_id);
    if (!c) return { pcid: '' };
    hist(c.id, '', null, 'email_clicou', U.cap(url, 300), f.ref_id);
    gatilho('email_clicou', c, { email_id: f.ref_id, url: url });
    return { pcid: EM.pcid(c) };
  };
  EM.sair = function (fid, s) {
    if (!EM.confere(fid, s)) throw new Error('Link inválido.');
    var f = filaPorId(fid);
    var c = f && contatoPorId(f.contato_id);
    if (!c) return { ok: true };
    if (c.email_optout !== 'SIM') {
      P.atualizar('Contatos', c.id, { email_optout: 'SIM', atualizado_em: P.agora() });
      hist(c.id, '', null, 'email_descadastro', 'Pediu para não receber mais e-mails', f.ref_id);
      var em = emailDaFila(f);
      if (em) P.atualizar('Emails', em.id, { descadastros: String(U.num(em.descadastros) + 1) });
      var canc = {};
      P.tabela('Fila').forEach(function (x) { if (x.tipo === 'email' && x.contato_id === c.id && x.status === 'pendente') canc[x.id] = { status: 'cancelado', erro: 'Descadastrado' }; });
      P.atualizarVarios('Fila', canc);
    }
    return { ok: true, email: U.str(c.email).replace(/^(.).*(@.*)$/, '$1***$2') };
  };
  /** Visita a uma página do site de quem já clicou num e-mail (o script de rastreio manda o pcid). */
  EM.visita = function (b) {
    var ce = cfg().ENTRADA_CHAVE || cfg().WEBHOOK_CHAVE;
    if (!b.k || b.k !== ce) throw new Error('Chave inválida.');
    var c = EM.dePcid(b.pcid);
    if (!c) return { ok: false };
    var url = U.cap(U.str(b.url).split('#')[0], 300);
    var chave = 'vis_' + c.id + '_' + EM.assinar(url);
    if (P.cache.get(chave)) return { ok: true, repetida: true };
    P.cache.put(chave, '1', 1800);
    P.atualizar('Contatos', c.id, { ultima_visita: P.agora() });
    hist(c.id, '', null, 'visitou', (b.titulo ? U.cap(b.titulo, 120) + ' - ' : '') + url);
    gatilho('visitou', c, { url: url });
    return { ok: true };
  };
  /** Entrada dos links de rastreio que chegam direto no servidor (?t=o abertura, ?t=c clique, ?t=sair). */
  function receberRastreio(p) {
    if (p.t === 'o') { EM.abriu(p.f, p.s); return { ok: true }; }
    if (p.t === 'c') { var r = EM.clicou(p.f, p.s, p.u); return { ok: !!r, url: /^https?:\/\//i.test(U.str(p.u)) ? p.u : '' }; }
    if (p.t === 'sair') return EM.sair(p.f, p.s);
    throw new Error('Rastreio desconhecido.');
  }

  /* ========================================================= financeiro */
  // Cobranças: cada parcela de uma venda é uma linha. Pagas = faturamento real (entradas);
  // pendentes = valor a receber no futuro; pendentes vencidas = inadimplência.
  var FIN = {};
  FIN.hoje = function () { return P.agora().slice(0, 10); };
  FIN.atrasada = function (x) { return x.status === 'pendente' && x.vencimento && x.vencimento < FIN.hoje(); };
  FIN.brl = function (v) { var n = U.num(v); var s = n.toFixed(2).split('.'); return 'R$ ' + s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + s[1]; };
  FIN.data = function (d) { d = U.str(d); return d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4); };
  FIN.somaMes = function (dia, n) {
    var a = Number(dia.slice(0, 4)), m = Number(dia.slice(5, 7)) - 1 + n, d = Number(dia.slice(8, 10));
    a += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var ult = new Date(a, m + 1, 0).getDate();
    return a + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + Math.min(d, ult)).slice(-2);
  };
  FIN.porId = function (id) { return P.tabela('Cobrancas').filter(function (x) { return x.id === id; })[0] || null; };
  /** Variáveis de cobrança para mensagens: {valor_parcela} {vencimento} {link_pagamento} {parcela} {descricao_cobranca} */
  FIN.vars = function (cob) {
    if (!cob) return {};
    return { valor_parcela: FIN.brl(cob.valor), vencimento: FIN.data(cob.vencimento), link_pagamento: cob.link || '', parcela: cob.parcelas > 1 ? cob.parcela + '/' + cob.parcelas : cob.parcela + '/' + (cob.parcelas || 1), descricao_cobranca: cob.descricao };
  };
  FIN.proximaDoContato = function (c) {
    return P.tabela('Cobrancas').filter(function (x) { return x.contato_id === c.id && x.status === 'pendente' && x.tipo !== 'link'; })
      .sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : 1; })[0] || null;
  };

  /** Cria as parcelas de uma venda. o: valor_total, parcelas, primeiro_vencimento, descricao, forma, negocio_id, entrada_paga, gerar_link */
  FIN.criar = function (c, o, user) {
    var total = U.num(o.valor_total), n = Math.max(1, Math.min(60, Math.floor(U.num(o.parcelas) || 1)));
    if (total <= 0) throw new Error('Informe o valor.');
    var venc1 = /^\d{4}-\d{2}-\d{2}$/.test(U.str(o.primeiro_vencimento)) ? o.primeiro_vencimento : FIN.hoje();
    var base = Math.floor(total / n * 100) / 100, linhas = [];
    for (var i = 0; i < n; i++) {
      var v = i === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base;
      var paga = i === 0 && o.entrada_paga;
      linhas.push({
        id: P.id('CB') + i, tipo: 'parcela', ref_id: '', contato_id: c ? c.id : '', negocio_id: o.negocio_id || '', descricao: U.cap(o.descricao || 'Venda', 120),
        valor: String(v), vencimento: FIN.somaMes(venc1, i), status: paga ? 'paga' : 'pendente', pago_em: paga ? P.agora() : '', forma: U.cap(o.forma, 40),
        parcela: String(i + 1), parcelas: String(n), link: '', mp_id: '', origem: o.origem || 'manual', lembrete_em: '', atraso_avisado: '', reembolsado_em: '', reembolso_valor: '',
        criado_em: P.agora(), atualizado_em: P.agora()
      });
    }
    P.inserirVarios('Cobrancas', linhas);
    if (c) {
      hist(c.id, o.negocio_id || '', user, 'cobranca', n + 'x de ' + FIN.brl(base) + ' (' + FIN.brl(total) + ') - ' + (o.descricao || 'Venda'));
      if (o.entrada_paga) FIN.depoisDePagar(c, linhas[0], user);
    }
    if (o.gerar_link && cfg().MP_TOKEN) linhas.forEach(function (x) { if (x.status === 'pendente') { try { FIN.gerarLink(x, c); } catch (e) { hist(c ? c.id : '', '', null, 'integracao', 'Mercado Pago: ' + e.message); } } });
    return linhas;
  };
  FIN.depoisDePagar = function (c, cob, user) {
    if (!c) return;
    if (c.status !== 'cliente') { P.atualizar('Contatos', c.id, { status: 'cliente', atualizado_em: P.agora() }); c.status = 'cliente'; }
    if (!P.tabela('Cobrancas').some(function (x) { return x.contato_id === c.id && FIN.atrasada(x); })) remTag(c, 'Inadimplente', null);
    hist(c.id, cob.negocio_id, user, 'pagamento', FIN.brl(cob.valor) + ' - ' + cob.descricao + ' (parcela ' + cob.parcela + '/' + cob.parcelas + ')', cob.id);
    saida('cobranca.paga', { contato: contatoPublico(c), cobranca: cob });
    gatilho('pagamento', c, { cobranca_id: cob.id });
  };
  FIN.pagar = function (cob, o, user) {
    if (cob.status === 'paga') return cob;
    if (cob.status !== 'pendente') throw new Error('Esta cobrança está ' + cob.status + '.');
    var mud = { status: 'paga', pago_em: o && o.pago_em ? U.str(o.pago_em).slice(0, 10) + 'T12:00:00' : P.agora(), forma: U.cap((o && o.forma) || cob.forma, 40), atualizado_em: P.agora() };
    if (o && o.mp_id) mud.mp_id = o.mp_id;
    P.atualizar('Cobrancas', cob.id, mud);
    Object.keys(mud).forEach(function (k) { cob[k] = mud[k]; });
    FIN.depoisDePagar(contatoPorId(cob.contato_id), cob, user);
    return cob;
  };
  FIN.reembolsar = function (cob, o, user) {
    if (cob.status !== 'paga') throw new Error('Só dá para reembolsar uma cobrança paga.');
    var valor = U.num(o && o.valor) || U.num(cob.valor);
    var mud = { status: 'reembolsada', reembolsado_em: P.agora(), reembolso_valor: String(Math.min(valor, U.num(cob.valor))), atualizado_em: P.agora() };
    P.atualizar('Cobrancas', cob.id, mud);
    Object.keys(mud).forEach(function (k) { cob[k] = mud[k]; });
    var c = contatoPorId(cob.contato_id);
    if (c) {
      addTag(c, 'Reembolso', null);
      hist(c.id, cob.negocio_id, user, 'reembolso', FIN.brl(mud.reembolso_valor) + ' - ' + cob.descricao + (o && o.motivo ? ' (' + U.cap(o.motivo, 200) + ')' : ''), cob.id);
      saida('cobranca.reembolsada', { contato: contatoPublico(c), cobranca: cob });
      gatilho('reembolso', c, { cobranca_id: cob.id });
    }
    return cob;
  };

  /** Uma vez por dia: avisa o que está perto de vencer e marca quem atrasou (tag Inadimplente). */
  FIN.verificarDia = function () {
    var hoje = FIN.hoje();
    if (cfg().FIN_VERIFICADO === hoje) return 0;
    salvarCfg({ FIN_VERIFICADO: hoje });
    var dias = U.num(cfg().LEMBRETE_COBRANCA_DIAS) || 3, limite = U.somaTempo(hoje + 'T00:00:00', dias * 1440).slice(0, 10), n = 0, mud = {};
    P.tabela('Cobrancas').forEach(function (x) {
      if (x.status !== 'pendente' || x.tipo === 'link' || !x.contato_id) return;
      var c = contatoPorId(x.contato_id);
      if (!c) return;
      if (x.vencimento < hoje && !x.atraso_avisado) {
        mud[x.id] = { atraso_avisado: P.agora() };
        addTag(c, 'Inadimplente', null);
        hist(c.id, x.negocio_id, null, 'atraso', FIN.brl(x.valor) + ' venceu em ' + FIN.data(x.vencimento), x.id);
        saida('cobranca.atrasada', { contato: contatoPublico(c), cobranca: x });
        gatilho('cobranca_atrasada', c, { cobranca_id: x.id }); n++;
      } else if (x.vencimento >= hoje && x.vencimento <= limite && !x.lembrete_em) {
        mud[x.id] = { lembrete_em: P.agora() };
        gatilho('cobranca_vencendo', c, { cobranca_id: x.id }); n++;
      }
    });
    P.atualizarVarios('Cobrancas', mud);
    return n;
  };

  /** Painel financeiro de um mês (AAAA-MM). */
  FIN.resumo = function (mes) {
    mes = /^\d{4}-\d{2}$/.test(U.str(mes)) ? mes : FIN.hoje().slice(0, 7);
    var hoje = FIN.hoje(), em7 = U.somaTempo(hoje + 'T00:00:00', 7 * 1440).slice(0, 10);
    var r = { mes: mes, recebido: 0, recebido_qtd: 0, reembolsos: 0, reembolsos_qtd: 0, a_receber: 0, a_receber_mes: 0, atraso: 0, atraso_qtd: 0, inadimplentes: 0, vencendo7: 0, vencendo7_qtd: 0, previsao: {}, historico: {}, formas: {} };
    var devedores = {};
    for (var k = -5; k <= 0; k++) r.historico[FIN.somaMes(mes + '-01', k).slice(0, 7)] = 0;
    for (var j = 0; j < 12; j++) r.previsao[FIN.somaMes(hoje.slice(0, 7) + '-01', j).slice(0, 7)] = 0;
    P.tabela('Cobrancas').forEach(function (x) {
      if (x.tipo === 'link') return;
      var v = U.num(x.valor);
      if (x.status === 'paga' || x.status === 'reembolsada') {
        var pm = U.str(x.pago_em).slice(0, 7);
        if (pm === mes) { r.recebido += v; r.recebido_qtd++; r.formas[x.forma || 'Não informado'] = (r.formas[x.forma || 'Não informado'] || 0) + v; }
        if (pm in r.historico) r.historico[pm] += v;
      }
      if (x.status === 'reembolsada' && U.str(x.reembolsado_em).slice(0, 7) === mes) { r.reembolsos += U.num(x.reembolso_valor) || v; r.reembolsos_qtd++; }
      if (x.status === 'pendente') {
        r.a_receber += v;
        if (x.vencimento.slice(0, 7) === mes) r.a_receber_mes += v;
        if (x.vencimento < hoje) { r.atraso += v; r.atraso_qtd++; devedores[x.contato_id] = 1; }
        else if (x.vencimento <= em7) { r.vencendo7 += v; r.vencendo7_qtd++; }
        var vm = x.vencimento.slice(0, 7);
        if (vm in r.previsao) r.previsao[vm] += v;
      }
    });
    r.inadimplentes = Object.keys(devedores).length;
    r.liquido = r.recebido - r.reembolsos;
    var cs = P.tabela('Contatos');
    r.clientes = cs.filter(function (c) { return c.status === 'cliente'; }).length;
    r.base = cs.length;
    return r;
  };

  /* ---------------------------------------------------- Mercado Pago */
  FIN.mpReq = function (url, metodo, corpo) {
    var tk = cfg().MP_TOKEN;
    if (!tk) throw new Error('Mercado Pago não configurado (Integrações > Mercado Pago).');
    return req('https://api.mercadopago.com' + url, metodo, corpo, { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json', 'X-Idempotency-Key': P.uuid() }, 'Mercado Pago');
  };
  FIN.urlNotificacao = function () { return P.urlApp() + '?src=mp&k=' + encodeURIComponent(cfg().MP_CHAVE); };
  /** Link de pagamento (Checkout Pro) para uma cobrança ou para um link de venda reutilizável. */
  FIN.gerarLink = function (cob, c) {
    var titulo = cob.descricao + (U.num(cob.parcelas) > 1 ? ' (parcela ' + cob.parcela + '/' + cob.parcelas + ')' : '');
    var corpo = {
      items: [{ id: cob.id, title: U.cap(titulo, 120), quantity: 1, unit_price: Math.round(U.num(cob.valor) * 100) / 100, currency_id: 'BRL' }],
      external_reference: cob.id, notification_url: FIN.urlNotificacao(), statement_descriptor: U.cap(cfg().NOME, 22)
    };
    if (c && U.emailOk(c.email)) corpo.payer = { email: c.email, name: U.primeiroNome(c.nome) };
    if (cfg().MP_RETORNO) corpo.back_urls = { success: cfg().MP_RETORNO, pending: cfg().MP_RETORNO, failure: cfg().MP_RETORNO };
    if (cob.tipo !== 'link' && cob.vencimento) corpo.date_of_expiration = U.somaTempo(cob.vencimento + 'T23:59:00', 30 * 1440) + '.000-03:00';
    var r = FIN.mpReq('/checkout/preferences', 'post', corpo);
    var link = r && (r.init_point || r.sandbox_init_point);
    if (!link) throw new Error('O Mercado Pago não devolveu o link.');
    P.atualizar('Cobrancas', cob.id, { link: link, atualizado_em: P.agora() });
    cob.link = link;
    return link;
  };
  /** Notificação do Mercado Pago: confere o pagamento direto na API (não confia no que chegou). */
  FIN.notificacao = function (p, body) {
    var tipo = U.str((body && (body.type || body.topic)) || p.type || p.topic);
    var id = U.str((body && body.data && body.data.id) || p['data.id'] || p.id);
    if (!/payment/.test(tipo) || !/^\d+$/.test(id)) return { ok: true, ignorado: true };
    var pg = FIN.mpReq('/v1/payments/' + id, 'get');
    var ref = U.str(pg.external_reference);
    var cob = FIN.porId(ref);
    if (!cob) return { ok: true, ignorado: true };
    var st = U.str(pg.status);
    var ja = P.tabela('Cobrancas').filter(function (x) { return x.mp_id === id; })[0];
    if (st === 'approved') {
      if (cob.tipo === 'link') { // link reutilizável: cada pagamento vira uma entrada nova com o comprador
        if (ja) return { ok: true, repetido: true };
        var pay = pg.payer || {};
        var nome = ((pay.first_name || '') + ' ' + (pay.last_name || '')).trim();
        var tel = pay.phone && pay.phone.number ? U.dig(U.str(pay.phone.area_code) + U.str(pay.phone.number)) : '';
        var c = null;
        if (U.emailOk(pay.email) || tel) c = gravarContato({ nome: nome, email: pay.email, telefone: tel, origem: 'Mercado Pago', tags: ['Comprou: ' + cob.descricao] }, null, {}).contato;
        var nova = FIN.criar(c, { valor_total: pg.transaction_amount || cob.valor, parcelas: 1, descricao: cob.descricao, forma: pg.payment_method_id || 'Mercado Pago', origem: 'Mercado Pago' }, null)[0];
        FIN.pagar(nova, { mp_id: id, forma: pg.payment_method_id }, null);
        P.atualizar('Cobrancas', cob.id, { parcela: String(U.num(cob.parcela) + 1), atualizado_em: P.agora() }); // contador de vendas do link
        if (c) { gatilho('evento', c, { evento: 'compra_aprovada', produto: cob.descricao }); saida('compra.compra_aprovada', { contato: contatoPublico(c), produto: cob.descricao, valor: pg.transaction_amount, plataforma: 'Mercado Pago' }); }
        return { ok: true, nova: nova.id };
      }
      FIN.pagar(cob, { mp_id: id, forma: pg.payment_method_id || 'Mercado Pago' }, null);
      return { ok: true, paga: cob.id };
    }
    if (st === 'refunded' || st === 'charged_back') {
      var alvo = ja || (cob.status === 'paga' ? cob : null);
      if (alvo && alvo.status === 'paga') FIN.reembolsar(alvo, { motivo: st === 'charged_back' ? 'Chargeback no Mercado Pago' : 'Reembolso no Mercado Pago' }, null);
      return { ok: true, reembolso: true };
    }
    return { ok: true, status: st };
  };

  /* ===================================================== chat do site */
  // Janela de chat para colar no site: o visitante deixa nome e contato antes de começar,
  // a conversa cai na caixa de Conversas (canal "site") e a equipe responde por lá.
  var CHAT = {};
  CHAT.token = function (v) { return EM.assinar('chat' + v); };
  CHAT.confere = function (b) {
    var ce = cfg().ENTRADA_CHAVE || cfg().WEBHOOK_CHAVE;
    if (!b.k || b.k !== ce) throw new Error('Chat não autorizado.');
    if (cfg().CHAT_ATIVO !== 'SIM') throw new Error('O chat está desligado.');
    if (!/^[\w-]{12,40}$/.test(U.str(b.v))) throw new Error('Visitante inválido.');
  };
  CHAT.contato = function (b) {
    if (b.t !== CHAT.token(b.v)) throw new Error('Sessão do chat inválida.');
    var c = P.tabela('Contatos').filter(function (x) { return x.chat_id === b.v; })[0];
    if (!c) throw new Error('Conversa não encontrada.');
    return c;
  };
  CHAT.limite = function (v) {
    var k = 'chatlim_' + v, n = Number(P.cache.get(k) || 0);
    if (n > 20) throw new Error('Muitas mensagens seguidas. Espere um minuto.');
    P.cache.put(k, String(n + 1), 60);
  };
  CHAT.config = function () {
    var k = cfg();
    return { ativo: k.CHAT_ATIVO === 'SIM', titulo: k.CHAT_TITULO, saudacao: k.CHAT_SAUDACAO, pedir: U.lista(k.CHAT_PEDIR), cor: k.COR_PRIMARIA, nome: k.NOME, logo: /^https:/.test(U.str(k.LOGO_URL)) ? k.LOGO_URL : '' };
  };
  CHAT.iniciar = function (b) {
    CHAT.confere(b); CHAT.limite(b.v);
    var pedir = U.lista(cfg().CHAT_PEDIR);
    var email = U.str(b.email).trim(), tel = U.telWa(b.telefone);
    if (pedir.indexOf('nome') >= 0 && !U.str(b.nome).trim()) throw new Error('Informe seu nome.');
    if (pedir.indexOf('email') >= 0 && !U.emailOk(email)) throw new Error('Informe um e-mail válido.');
    if (pedir.indexOf('whatsapp') >= 0 && U.dig(tel).length < 12) throw new Error('Informe o WhatsApp com DDD.');
    var c = P.tabela('Contatos').filter(function (x) { return x.chat_id === b.v; })[0];
    var novo = false;
    if (!c) {
      var r = gravarContato({ nome: U.cap(b.nome, 80) || 'Visitante do site', email: email, telefone: tel, origem: 'Chat do site', canal: 'site' }, null, { naoSobrescrever: true, silencioso: true, semGatilhos: true });
      c = r.contato; novo = r.novo;
      P.atualizar('Contatos', c.id, { chat_id: b.v, canal: 'site', atualizado_em: P.agora() });
      c.chat_id = b.v; c.canal = 'site';
      hist(c.id, '', null, novo ? 'contato_criado' : 'chat', 'Iniciou conversa pelo chat do site' + (b.pagina ? ': ' + U.cap(b.pagina, 200) : ''));
      if (novo) gatilho('novo_contato', c, { origem: 'Chat do site' });
    }
    return { t: CHAT.token(b.v), nome: U.primeiroNome(c.nome) };
  };
  CHAT.enviar = function (b) {
    CHAT.confere(b); CHAT.limite(b.v);
    var c = CHAT.contato(b);
    var texto = U.cap(U.str(b.texto).trim(), 2000);
    if (!texto) throw new Error('Escreva uma mensagem.');
    var primeira = !P.filtrar('Mensagens', 'contato_id', c.id).some(function (m) { return m.direcao === 'in' && m.canal === 'site'; });
    receber({ canal: 'site', contato_id: c.id, texto: texto, tipo: 'texto', wa_id: 'site_' + P.uuid(), primeira: primeira });
    return { ok: true };
  };
  CHAT.receber = function (b) {
    CHAT.confere(b);
    var c = CHAT.contato(b);
    var desde = U.str(b.desde);
    var us = {};
    P.tabela('Usuarios').forEach(function (u) { us[u.id] = U.primeiroNome(u.nome); });
    return {
      agora: P.agora(),
      mensagens: P.filtrar('Mensagens', 'contato_id', c.id).filter(function (m) { return m.canal === 'site' && (!desde || m.criado_em > desde) && m.status !== 'erro'; })
        .map(function (m) { return { de: m.direcao === 'in' ? 'eu' : (m.origem === 'robo' ? 'robo' : 'equipe'), autor: us[m.usuario_id] || '', texto: m.texto, em: m.criado_em }; })
    };
  };

  /* ===================================================== limites e uso */
  function contarHttp() {
    var k = 'http_' + P.agora().slice(0, 10), n = Number(P.cache.get(k) || 0) + 1;
    P.cache.put(k, String(n), 21600);
  }
  function limites() {
    var k = cfg(), hoje = P.agora().slice(0, 10);
    var uso = P.uso ? P.uso() : null;
    var cs = P.tabela('Contatos'), msgs = P.tabela('Mensagens');
    var disparosHoje = P.tabela('Fila').filter(function (f) { return f.tipo === 'campanha' && f.status === 'enviado' && U.str(f.enviado_em).slice(0, 10) === hoje; }).length;
    var capContatos = uso ? Math.max(0, Math.floor((uso.limite - uso.celulas) / (PRUMO_ESQUEMA.Contatos.length + 6))) : null;
    return {
      planilha: uso, usuarios: P.tabela('Usuarios').filter(function (u) { return u.ativo === 'SIM'; }).length,
      contatos: cs.length, contatos_capacidade: capContatos, mensagens_mes: msgs.length, disparos_hoje: disparosHoje,
      email: EM.cota(), chamadas_hoje: Number(P.cache.get('http_' + hoje) || 0), provedor: WA.provedor(), instagram: IG.ativo(),
      arquivo: { feito: k.ARQUIVO_FEITO, auto: k.ARQUIVO_AUTO }, workspace: U.num(k.EMAIL_LIMITE_GMAIL) > 200
    };
  }

  /* ============================================== plano de suporte */
  // O código de suporte vem com a compra: diz o plano, até quando vale e o contato do suporte.
  // O sistema funciona do mesmo jeito com ou sem suporte ativo; o código só informa.
  var SUP = {};
  SUP.soma = function (s) { var h = 2166136261; s = 'prumo-suporte|' + s; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); };
  SUP.b64 = function (s, ida) {
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    if (ida) {
      var bytes = unescape(encodeURIComponent(s)), o = '';
      for (var i = 0; i < bytes.length; i += 3) {
        var a = bytes.charCodeAt(i), b = bytes.charCodeAt(i + 1), c = bytes.charCodeAt(i + 2), n = (a << 16) | ((b || 0) << 8) | (c || 0);
        o += A[(n >> 18) & 63] + A[(n >> 12) & 63] + (i + 1 < bytes.length ? A[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? A[n & 63] : '');
      }
      return o;
    }
    var out = '', bits = 0, val = 0;
    for (var j = 0; j < s.length; j++) {
      var x = A.indexOf(s[j]);
      if (x < 0) throw new Error('Código inválido.');
      val = (val << 6) | x; bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((val >> bits) & 255); }
    }
    return decodeURIComponent(escape(out));
  };
  SUP.ler = function (codigo) {
    codigo = U.str(codigo).trim().replace(/\s+/g, '');
    var p = codigo.split('.');
    if (p.length !== 2) throw new Error('Código de suporte inválido.');
    var json = SUP.b64(p[0]);
    if (SUP.soma(json) !== p[1]) throw new Error('Código de suporte inválido.');
    var d = U.json(json, null);
    if (!d || !d.p || !/^\d{4}-\d{2}-\d{2}$/.test(U.str(d.a))) throw new Error('Código de suporte inválido.');
    return d;
  };
  SUP.PLANOS = { mensal: 'Essencial (1 mês de suporte)', anual: 'Anual (1 ano de suporte e atualizações)', cinco: 'Cinco anos (5 anos de suporte e atualizações)' };
  SUP.estado = function () {
    var cod = cfg().SUPORTE_CODIGO;
    var hoje = P.agora().slice(0, 10);
    if (!cod) return { tem: false, versao: PRUMO_VERSAO };
    try {
      var d = SUP.ler(cod);
      var dias = Math.round((new Date(d.a + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
      return { tem: true, plano: d.p, nome_plano: SUP.PLANOS[d.p] || d.p, ate: d.a, cliente: d.n || '', contato: d.c || '', compra: d.d || '', dias: dias, ativo: dias >= 0, versao: PRUMO_VERSAO };
    } catch (e) { return { tem: false, erro: e.message, versao: PRUMO_VERSAO }; }
  };

  /* ===================================================== integrações */
  var INT = {};
  var EVENTO_ROTULO = { compra_aprovada: 'Comprou', carrinho_abandonado: 'Carrinho abandonado', boleto_gerado: 'Boleto gerado', pix_gerado: 'Pix gerado', reembolso: 'Reembolso', cancelado: 'Cancelou', recusado: 'Pagamento recusado' };
  /** Reconhece eventos de venda da Hotmart e da Kiwify (e de outras com campos parecidos). */
  INT.evento = function (body, plano, fonte) {
    var ev = '', plataforma = '', produto = '', valor = 0;
    var hot = U.str(body.event).toUpperCase();
    if (fonte === 'hotmart' || /^PURCHASE_|^SUBSCRIPTION_/.test(hot)) {
      plataforma = 'Hotmart';
      ev = { PURCHASE_APPROVED: 'compra_aprovada', PURCHASE_COMPLETE: 'compra_aprovada', PURCHASE_OUT_OF_SHOPPING_CART: 'carrinho_abandonado', PURCHASE_BILLET_PRINTED: 'boleto_gerado',
        PURCHASE_REFUNDED: 'reembolso', PURCHASE_CHARGEBACK: 'reembolso', PURCHASE_CANCELED: 'cancelado', PURCHASE_EXPIRED: 'cancelado', SUBSCRIPTION_CANCELLATION: 'cancelado', PURCHASE_DELAYED: 'recusado' }[hot] || '';
      produto = acharValor(plano, ['data.product.name', 'product.name', 'prod_name']);
      valor = U.num(acharValor(plano, ['data.purchase.price.value', 'purchase.price.value', 'price']));
    } else if (fonte === 'kiwify' || body.webhook_event_type || body.order_status || (body.Customer && body.Product)) {
      plataforma = 'Kiwify';
      var tk = U.str(body.webhook_event_type || body.order_status || body.status).toLowerCase();
      ev = { order_approved: 'compra_aprovada', paid: 'compra_aprovada', approved: 'compra_aprovada', abandoned: 'carrinho_abandonado', abandoned_cart: 'carrinho_abandonado', billet_created: 'boleto_gerado', waiting_payment: 'boleto_gerado',
        pix_created: 'pix_gerado', order_refunded: 'reembolso', refunded: 'reembolso', chargeback: 'reembolso', chargedback: 'reembolso', subscription_canceled: 'cancelado', order_rejected: 'recusado', refused: 'recusado' }[tk] || '';
      if (tk === 'waiting_payment' && /pix/i.test(U.str(body.payment_method))) ev = 'pix_gerado';
      produto = acharValor(plano, ['Product.product_name', 'product_name']);
      var cent = U.num(acharValor(plano, ['Commissions.product_base_price', 'Commissions.charge_amount']));
      valor = cent ? cent / 100 : U.num(acharValor(plano, ['amount', 'price']));
    } else if (fonte) plataforma = { activecampaign: 'ActiveCampaign', tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook' }[fonte] || '';
    if (!ev) return plataforma ? { plataforma: plataforma } : null;
    return { plataforma: plataforma, evento: ev, produto: produto, valor: valor, tag: plataforma + ': ' + EVENTO_ROTULO[ev] };
  };
  INT.aplicarEvento = function (c, ev) {
    if (!ev.evento) return;
    hist(c.id, '', null, 'compra', ev.plataforma + ' - ' + EVENTO_ROTULO[ev.evento] + (ev.produto ? ': ' + ev.produto : '') + (ev.valor ? ' (R$ ' + ev.valor.toFixed(2).replace('.', ',') + ')' : ''));
    if (ev.evento === 'compra_aprovada') {
      if (c.status !== 'cliente') { P.atualizar('Contatos', c.id, { status: 'cliente', atualizado_em: P.agora() }); c.status = 'cliente'; }
      // registra a venda como negócio ganho (usa o negócio aberto, se houver)
      var aberto = P.tabela('Negocios').filter(function (n) { return n.contato_id === c.id && n.status === 'aberto'; })[0];
      var f = aberto ? funisCompletos().filter(function (x) { return x.id === aberto.funil_id; })[0] : funisCompletos()[0];
      var ganho = f && f.etapas.filter(function (e) { return e.tipo === 'ganho'; })[0];
      if (ganho) {
        var n = aberto || { id: P.id('N'), titulo: U.cap(ev.produto || 'Compra ' + ev.plataforma, 150), contato_id: c.id, funil_id: f.id, etapa_id: ganho.id, valor: '0', responsavel_id: c.responsavel_id || '', status: 'aberto', motivo_perda: '', previsao: '', notas: 'Venda registrada pela ' + ev.plataforma, criado_em: P.agora(), atualizado_em: P.agora(), fechado_em: '' };
        if (!aberto) P.inserir('Negocios', n);
        if (ev.valor) P.atualizar('Negocios', n.id, { valor: String(ev.valor) });
        moverNegocio(n, ganho.id, null);
      }
      // quem comprou sai das automações de recuperação (carrinho, boleto, pix)
      var recup = {};
      P.tabela('Automacoes').forEach(function (a) { var g = U.json(a.gatilho, {}) || {}; if (g.tipo === 'evento' && /carrinho|boleto|pix/.test(g.evento)) recup[a.id] = 1; });
      P.tabela('Execucoes').filter(function (e) { return e.contato_id === c.id && recup[e.automacao_id] && /esperando|rodando/.test(e.status); })
        .forEach(function (e) { P.atualizar('Execucoes', e.id, { status: 'cancelada', atualizado_em: P.agora() }); });
    }
    if (ev.evento === 'compra_aprovada' && ev.valor) {
      var en = FIN.criar(c, { valor_total: ev.valor, parcelas: 1, descricao: ev.produto || 'Compra ' + ev.plataforma, forma: ev.plataforma, origem: ev.plataforma }, null)[0];
      P.atualizar('Cobrancas', en.id, { status: 'paga', pago_em: P.agora() });
    }
    if (ev.evento === 'reembolso') {
      var pg = P.tabela('Cobrancas').filter(function (x) { return x.contato_id === c.id && x.status === 'paga' && x.origem === ev.plataforma; }).sort(function (a, b) { return a.pago_em < b.pago_em ? 1 : -1; })[0];
      if (pg) FIN.reembolsar(pg, { motivo: ev.plataforma }, null);
    }
    saida('compra.' + ev.evento, { contato: contatoPublico(c), produto: ev.produto, valor: ev.valor, plataforma: ev.plataforma });
    gatilho('evento', c, { evento: ev.evento, produto: ev.produto });
  };

  /** ActiveCampaign: cria/atualiza o contato, coloca na lista e aplica tags. */
  INT.acSincronizar = function (c, tags) {
    var k = cfg();
    if (!k.AC_URL || !k.AC_TOKEN) throw new Error('ActiveCampaign não configurado.');
    if (!c.email) throw new Error('ActiveCampaign precisa do e-mail do contato.');
    var b = WA.base(k.AC_URL) + '/api/3', h = { 'Api-Token': k.AC_TOKEN };
    var partes = U.str(c.nome).trim().split(/\s+/);
    var r = req(b + '/contact/sync', 'post', { contact: { email: c.email, firstName: partes[0] || '', lastName: partes.slice(1).join(' '), phone: c.telefone ? '+' + c.telefone : '' } }, h);
    var acId = r && r.contact && r.contact.id;
    if (!acId) return;
    if (k.AC_LISTA) req(b + '/contactLists', 'post', { contactList: { list: Number(k.AC_LISTA), contact: Number(acId), status: 1 } }, h);
    (tags || []).forEach(function (t) {
      var achadas = req(b + '/tags?search=' + encodeURIComponent(t), 'get', undefined, h);
      var tg = ((achadas && achadas.tags) || []).filter(function (x) { return U.norm(x.tag) === U.norm(t); })[0];
      if (!tg) tg = (req(b + '/tags', 'post', { tag: { tag: t, tagType: 'contact', description: 'Criada pelo ' + k.NOME } }, h) || {}).tag;
      if (tg && tg.id) req(b + '/contactTags', 'post', { contactTag: { contact: Number(acId), tag: Number(tg.id) } }, h);
    });
    hist(c.id, '', null, 'integracao', 'Enviado ao ActiveCampaign' + (tags && tags.length ? ' com tags ' + tags.join(', ') : ''));
  };

  /** API para outros sistemas: POST ...exec?src=api&k=CHAVE com {"acao": "...", ...}. */
  function apiExterna(b) {
    var acao = U.str(b.acao);
    var achar = function () {
      var c = (b.contato_id && contatoPorId(b.contato_id)) || (b.telefone && contatoPorTel(b.telefone)) || (b.email && contatoPorEmail(b.email));
      if (!c) throw new Error('Contato não encontrado (informe contato_id, telefone ou email).');
      return c;
    };
    if (acao === 'contato.salvar') { var r = gravarContato({ nome: b.nome, telefone: b.telefone, email: b.email, empresa: b.empresa, cidade: b.cidade, origem: b.origem || 'API', tags: b.tags, campos: b.campos, notas: b.notas }, null, {}); return { ok: true, contato: contatoPublico(r.contato), novo: r.novo }; }
    if (acao === 'contato.buscar') return { ok: true, contato: contatoPublico(achar()) };
    if (acao === 'tag.adicionar') { var c1 = achar(); U.lista(b.tags || b.tag).forEach(function (t) { addTag(c1, t, null); }); return { ok: true }; }
    if (acao === 'tag.remover') { var c2 = achar(); U.lista(b.tags || b.tag).forEach(function (t) { remTag(c2, t, null); }); return { ok: true }; }
    if (acao === 'mensagem.enviar') { var c3 = achar(); if (!U.str(b.texto).trim()) throw new Error('Informe o texto.'); enviarParaContato(c3, montarTexto(b.texto, c3), { origem: 'api', midia_url: U.urlMidia(b.midia_url), midia_tipo: b.midia_tipo }); return { ok: true }; }
    if (acao === 'automacao.iniciar') {
      var c4 = achar();
      var a = P.tabela('Automacoes').filter(function (x) { return x.id === b.automacao_id || U.norm(x.nome) === U.norm(b.automacao); })[0];
      if (!a) throw new Error('Automação não encontrada.');
      return { ok: !!iniciarAutomacao(a, c4, {}) };
    }
    if (acao === 'negocio.etapa') { var c5 = achar(); var n = moverContatoParaEtapa(c5, b.etapa_id, null); return { ok: !!n, negocio_id: n ? n.id : '' }; }
    throw new Error('Ação da API desconhecida. Use: contato.salvar, contato.buscar, tag.adicionar, tag.remover, mensagem.enviar, automacao.iniciar, negocio.etapa');
  }

  /** Ponto de entrada de tudo que chega de fora (webhooks). p = parâmetros da URL. */
  function receberWebhook(p, body) {
    var c = cfg();
    var chave = p.src === 'wa' ? c.WEBHOOK_CHAVE : p.src === 'api' ? c.API_CHAVE : p.src === 'mp' ? c.MP_CHAVE : p.src === 'vendas' ? c.VENDAS_CHAVE : (c.ENTRADA_CHAVE || c.WEBHOOK_CHAVE);
    if (!chave || p.k !== chave) throw new Error('Chave do webhook inválida.');
    if (p.src === 'api') return apiExterna(body || {});
    if (p.src === 'mp') return FIN.notificacao(p, body || {});
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
    if (p.src === 'entrada') return webhookEntrada(body, p, false);
    if (p.src === 'vendas') return webhookEntrada(body, p, true);
    throw new Error('Webhook desconhecido.');
  }

  /* ===================================================== arquivo mensal */
  // Quando o mês vira, o que já está fechado do mês anterior (mensagens, histórico, envios, execuções,
  // tarefas feitas e negócios fechados) vai para uma planilha própria no Drive do dono do sistema,
  // chamada "<Nome> - Arquivo AAAA-MM (Mês Ano)". A planilha principal fica só com o mês atual e os
  // contatos/negócios em aberto, então nunca chega no limite de células do Google.
  function mesAtual() { return P.agora().slice(0, 7); }
  function nomeDoMes(mes) { return PRUMO_MESES[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4); }
  function registrosArquivo() { return P.tabela('Arquivos').slice().sort(function (a, b) { return a.mes < b.mes ? 1 : -1; }); }
  function arquivoDoMes(mes, criar) {
    var reg = P.tabela('Arquivos').filter(function (x) { return x.mes === mes; })[0];
    if (reg || !criar) return reg || null;
    var r = P.arquivo.criar(cfg().NOME + ' - Arquivo ' + mes + ' (' + nomeDoMes(mes) + ')', cfg().NOME + ' - Arquivos');
    reg = { id: P.id('AR'), mes: mes, planilha_id: r.id, url: r.url, linhas: '0', criado_em: P.agora(), atualizado_em: P.agora() };
    P.inserir('Arquivos', reg);
    return reg;
  }
  function arquivar(user, limiteMs) {
    if (!P.arquivo) throw new Error('O arquivo mensal só funciona no servidor (planilha Google).');
    var corte = mesAtual(), inicio = Date.now(), resumo = {}, parcial = false;
    for (var i = 0; i < PRUMO_ARQUIVAVEIS.length; i++) {
      if (Date.now() - inicio > (limiteMs || 240000)) { parcial = true; break; }
      var aba = PRUMO_ARQUIVAVEIS[i][0], col = PRUMO_ARQUIVAVEIS[i][1], podeSair = PRUMO_ARQUIVAVEIS[i][2];
      var sai = {}, fica = [], n = 0;
      P.tabela(aba).forEach(function (o) {
        var d = U.str(o[col]).slice(0, 7);
        if (d && d < corte && podeSair(o)) { (sai[d] = sai[d] || []).push(o); n++; } else fica.push(o);
      });
      if (!n) continue;
      Object.keys(sai).sort().forEach(function (mes) {
        var reg = arquivoDoMes(mes, true);
        P.arquivo.anexar(reg.planilha_id, aba, PRUMO_ESQUEMA[aba], sai[mes]);
        P.atualizar('Arquivos', reg.id, { linhas: String(U.num(reg.linhas) + sai[mes].length), atualizado_em: P.agora() });
        reg.linhas = String(U.num(reg.linhas) + sai[mes].length);
      });
      P.substituir(aba, fica); // só apaga da principal depois de gravar no arquivo
      resumo[aba] = n;
    }
    if (!parcial) salvarCfg({ ARQUIVO_FEITO: corte });
    var total = Object.keys(resumo).reduce(function (s, k) { return s + resumo[k]; }, 0);
    if (total) hist('', '', user, 'arquivo', total + ' linhas movidas para o arquivo mensal' + (parcial ? ' (continua na próxima rodada)' : ''));
    return { movidas: resumo, total: total, parcial: parcial };
  }
  /** Linhas de uma aba no período: a principal + as planilhas arquivadas dos meses do período. */
  function tabelaPeriodo(aba, de, ate) {
    var linhas = P.tabela(aba);
    if (!P.arquivo) return linhas;
    var m1 = U.str(de).slice(0, 7), m2 = U.str(ate || P.agora()).slice(0, 7);
    registrosArquivo().forEach(function (r) {
      if (r.mes >= m1 && r.mes <= m2) { try { linhas = linhas.concat(P.arquivo.ler(r.planilha_id, aba)); } catch (e) { /* planilha apagada ou sem acesso */ } }
    });
    return linhas;
  }

  /* ========================================================= relatórios */
  function relatorio(user, b) {
    var de = b.de || U.somaTempo(P.agora(), -30 * 1440).slice(0, 10);
    var ate = b.ate || P.agora().slice(0, 10);
    var dentro = function (s) { s = U.str(s).slice(0, 10); return s >= de && s <= ate; };
    var contatos = P.tabela('Contatos'), negocios = tabelaPeriodo('Negocios', de, ate), msgs = tabelaPeriodo('Mensagens', de, ate);
    var vistos = {};
    negocios = negocios.filter(function (n) { if (vistos[n.id]) return false; vistos[n.id] = 1; return true; });
    var porDia = {};
    var dia = function (s) { return U.str(s).slice(0, 10); };
    var add = function (k, campo) { if (!porDia[k]) porDia[k] = { dia: k, contatos: 0, recebidas: 0, enviadas: 0, ganhos: 0, valor: 0 }; porDia[k][campo]++; };
    contatos.forEach(function (c) { if (dentro(c.criado_em)) add(dia(c.criado_em), 'contatos'); });
    var tempos = [];
    var ultimaEntrada = {};
    var custo = { servico: 0, marketing: 0, utility: 0, gratis: 0 };
    msgs.sort(function (a, b2) { return a.criado_em < b2.criado_em ? -1 : 1; }).forEach(function (m) {
      if (!dentro(m.criado_em)) return;
      add(dia(m.criado_em), m.direcao === 'in' ? 'recebidas' : 'enviadas');
      if (m.direcao === 'out' && m.cobranca && m.status !== 'erro' && m.cobranca in custo) custo[m.cobranca]++;
      if (m.direcao === 'in' && !ultimaEntrada[m.contato_id]) ultimaEntrada[m.contato_id] = m.criado_em;
      else if (m.direcao === 'out' && m.usuario_id && ultimaEntrada[m.contato_id]) {
        var dt = (new Date(m.criado_em) - new Date(ultimaEntrada[m.contato_id])) / 60000;
        if (dt >= 0 && dt < 1440) tempos.push(dt);
        ultimaEntrada[m.contato_id] = '';
      }
    });
    var porUsuario = {};
    var users = P.tabela('Usuarios');
    users.forEach(function (u) {
      porUsuario[u.id] = { id: u.id, nome: u.nome, perfil: u.perfil, enviadas: 0, ganhos: 0, valor: 0, perdidos: 0, abertos: 0,
        passados: 0, reunioes: 0, realizadas: 0, faltas: 0, recebidos: 0, meta_valor: U.num(u.meta_valor), meta_reunioes: U.num(u.meta_reunioes) };
    });
    msgs.forEach(function (m) { if (m.direcao === 'out' && m.usuario_id && porUsuario[m.usuario_id] && dentro(m.criado_em)) porUsuario[m.usuario_id].enviadas++; });
    var motivos = {};
    negocios.forEach(function (n) {
      var pu = porUsuario[n.responsavel_id], ps = porUsuario[n.sdr_id];
      if (n.status === 'aberto' && pu) pu.abertos++;
      if (dentro(n.passado_em)) {
        if (ps) ps.passados++;
        if (pu) pu.recebidos++;
        if (n.reuniao_em && ps) ps.reunioes++;
      }
      if (n.reuniao_em && dentro(n.reuniao_em) && ps) {
        if (n.reuniao_status === 'realizada') ps.realizadas++;
        if (n.reuniao_status === 'no_show') ps.faltas++;
      }
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
    // custo estimado da API oficial (a franquia gratuita de mensagens de atendimento é mensal)
    var k = cfg();
    var meses = Math.max(1, Math.round((new Date(ate) - new Date(de)) / (30 * 86400000)));
    var servicoPago = Math.max(0, custo.servico - U.num(k.META_FRANQUIA_SERVICO) * meses);
    custo.estimado = servicoPago * U.num(k.META_PRECO_SERVICO) + custo.marketing * U.num(k.META_PRECO_MARKETING) + custo.utility * U.num(k.META_PRECO_UTILITY);
    custo.sem_economia = (custo.servico + custo.gratis + custo.marketing + custo.utility) * U.num(k.META_PRECO_MARKETING);
    custo.provedor = WA.provedor();
    return {
      de: de, ate: ate,
      dias: Object.keys(porDia).sort().map(function (kk) { return porDia[kk]; }),
      usuarios: Object.keys(porUsuario).map(function (kk) { return porUsuario[kk]; }),
      motivos: motivos, origens: origens, tempo_resposta_min: Math.round(tempoMedio), campanhas: camps, automacoes: autos, custo: custo,
      arquivados: P.arquivo ? registrosArquivo().filter(function (r) { return r.mes >= de.slice(0, 7) && r.mes <= ate.slice(0, 7); }).length : 0
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
      horario: { inicio: c.HORARIO_INICIO, fim: c.HORARIO_FIM, dias: c.DIAS_ENVIO }, segmento: c.SEGMENTO,
      sla_minutos: U.num(c.SLA_MINUTOS), instagram: IG.ativo(), activecampaign: !!(c.AC_URL && c.AC_TOKEN), passar_etapa: c.PASSAR_ETAPA,
      arquivo: !!P.arquivo, site_url: c.SITE_URL, email_provedor: c.EMAIL_PROVEDOR, mercadopago: !!c.MP_TOKEN, chat: c.CHAT_ATIVO === 'SIM'
    };
  }
  function configAdmin() {
    var c = cfg();
    var o = {};
    Object.keys(PRUMO_CONFIG_PADRAO).forEach(function (k) { o[k] = c[k]; });
    ['EVOLUTION_APIKEY', 'WAHA_APIKEY', 'META_TOKEN', 'IG_TOKEN', 'AC_TOKEN', 'BREVO_APIKEY', 'MP_TOKEN'].forEach(function (k) { o[k] = c[k] ? '••••••••' + U.str(c[k]).slice(-4) : ''; });
    delete o.API_CHAVE; delete o.RASTREIO_SEGREDO; delete o.MP_CHAVE;
    o.URL_WEBHOOK_MP = c.MP_CHAVE ? FIN.urlNotificacao() : '';
    o.URL_APP = P.urlApp();
    o.URL_WEBHOOK_WA = WA.urlWebhook();
    o.URL_WEBHOOK_ENTRADA = P.urlApp() + '?src=entrada&k=' + encodeURIComponent(c.ENTRADA_CHAVE || c.WEBHOOK_CHAVE);
    o.URL_WEBHOOK_VENDAS = c.VENDAS_CHAVE ? P.urlApp() + '?src=vendas&k=' + encodeURIComponent(c.VENDAS_CHAVE) : '';
    delete o.VENDAS_CHAVE;
    o.URL_API = c.API_CHAVE ? P.urlApp() + '?src=api&k=' + encodeURIComponent(c.API_CHAVE) : '';
    o.VERSAO = PRUMO_VERSAO;
    o.URL_PLANILHA = P.urlPlanilha ? P.urlPlanilha() : '';
    return o;
  }

  var CHAVES_EDITAVEIS = Object.keys(PRUMO_CONFIG_PADRAO).filter(function (k) { return ['PROX_TRABALHO', 'WEBHOOK_CHAVE', 'ENTRADA_CHAVE', 'API_CHAVE', 'VENDAS_CHAVE', 'ARQUIVO_FEITO', 'ARQUIVO_PASTA', 'EMAIL_CONTAGEM', 'RASTREIO_SEGREDO', 'SITE_URL', 'MP_CHAVE', 'FIN_VERIFICADO', 'SUPORTE_CODIGO'].indexOf(k) < 0; });

  function bootstrap(user) {
    var contatos = filtraContatosDoUsuario(user, P.tabela('Contatos'));
    var ids = {};
    contatos.forEach(function (c) { ids[c.id] = 1; });
    var negocios = P.tabela('Negocios').filter(function (n) { return veTodos(user) || ids[n.contato_id] || n.responsavel_id === user.id; });
    // tarefas são de cada pessoa; quem vê tudo pode filtrar por responsável na tela
    var tarefas = P.tabela('Tarefas').filter(function (t) { return veTodos(user) || t.responsavel_id === user.id || (!t.responsavel_id && ids[t.contato_id]); });
    return {
      agora: P.agora(), usuario: publicoUsuario(user), config: configPublica(),
      permissoes: permissoesDe(user), areas: AREAS, suporte: SUP.estado(),
      usuarios: P.tabela('Usuarios').map(publicoUsuario),
      funis: funisCompletos(),
      contatos: contatos.map(contatoLeve), negocios: negocios, tarefas: tarefas,
      modelos: P.tabela('Modelos'),
      automacoes: pode(user, 'automacoes') ? P.tabela('Automacoes') : [],
      campanhas: pode(user, 'disparos') ? P.tabela('Campanhas') : [],
      emails: pode(user, 'disparos') || pode(user, 'automacoes') ? P.tabela('Emails') : [],
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
    if (pode(u, 'disparos')) r.campanhas = P.tabela('Campanhas').filter(function (x) { return x.status === 'enviando' || x.status === 'agendada' || (desde && x.concluida_em >= desde); });
    if (pode(u, 'disparos')) r.emails = P.tabela('Emails').filter(function (x) { return x.status === 'enviando' || x.status === 'agendada' || x.tipo === 'automacao' || (desde && x.concluida_em >= desde) || (x.status === 'concluida' && x.concluida_em >= U.somaTempo(P.agora(), -2 * 1440)); });
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
    if (!texto.trim() && !b.midia_url && !(b.meta_modelo && b.meta_modelo.nome)) throw new Error('Escreva uma mensagem.');
    if (!c.responsavel_id) { P.atualizar('Contatos', c.id, { responsavel_id: u.id }); c.responsavel_id = u.id; }
    var modelo = b.meta_modelo && b.meta_modelo.nome ? { nome: U.str(b.meta_modelo.nome).trim(), idioma: b.meta_modelo.idioma || 'pt_BR', categoria: b.meta_modelo.categoria || 'marketing', parametros: U.lista(b.meta_modelo.variaveis).map(function (v) { return montarTexto(v, c, u); }) } : null;
    var r = enviarParaContato(c, texto, { user: u, origem: 'manual', midia_url: U.urlMidia(b.midia_url), midia_tipo: b.midia_tipo, metaModelo: modelo });
    pausarRobo(c);
    P.atualizar('Contatos', c.id, { nao_lidas: '0' });
    return r;
  };

  // ---- equipe comercial: SDR passa para o closer
  R['negocio.passar'] = function (u, b) {
    exige(u, 'passar');
    var c = exigeContato(u, b.contato_id);
    if (b.closer_id) { var uc = P.tabela('Usuarios').filter(function (x) { return x.id === b.closer_id; })[0]; if (!uc) throw new Error('Closer não encontrado.'); }
    if (b.reuniao_em && U.str(b.reuniao_em).slice(0, 16) < P.agora().slice(0, 16)) throw new Error('A reunião precisa ser numa data futura.');
    return passarParaCloser(c, { closer_id: b.closer_id, reuniao_em: b.reuniao_em, nota: b.nota, valor: b.valor, negocio_id: b.negocio_id, etapa_id: b.etapa_id }, u);
  };
  R['negocio.reuniao'] = function (u, b) {
    var n = P.tabela('Negocios').filter(function (x) { return x.id === b.id; })[0];
    if (!n) throw new Error('Negócio não encontrado.');
    var c = exigeContato(u, n.contato_id);
    var mud = { atualizado_em: P.agora() };
    if (b.quando) { mud.reuniao_em = U.str(b.quando).slice(0, 16) + ':00'; mud.reuniao_status = 'agendada'; }
    else if (['realizada', 'no_show', 'cancelada'].indexOf(b.status) >= 0) mud.reuniao_status = b.status;
    else throw new Error('Informe a nova data ou o resultado da reunião.');
    P.atualizar('Negocios', n.id, mud);
    Object.keys(mud).forEach(function (k) { n[k] = mud[k]; });
    hist(c.id, n.id, u, 'reuniao', b.quando ? 'Reunião remarcada para ' + fmtDataHora(mud.reuniao_em) : { realizada: 'Reunião realizada', no_show: 'Lead faltou na reunião', cancelada: 'Reunião cancelada' }[mud.reuniao_status]);
    if (b.quando) agendarReuniao(c, n, u);
    return n;
  };

  // ---- custo de um disparo pela API oficial (antes de enviar)
  R['campanha.custo'] = function (u, b) {
    exige(u, 'disparos');
    var alvo = filtrarContatos(b.filtro || {}).filter(function (c) { return c.telefone && c.optout !== 'SIM'; });
    var k = cfg(), r = { total: alvo.length, gratis: 0, janela: 0, modelo: 0, provedor: WA.provedor() };
    alvo.forEach(function (c) { if (gratisAgora(c)) r.gratis++; else if (janelaAberta(c)) r.janela++; else r.modelo++; });
    var precoModelo = U.num(b.categoria === 'utility' ? k.META_PRECO_UTILITY : k.META_PRECO_MARKETING);
    r.com_economia = r.modelo * precoModelo + r.janela * U.num(k.META_PRECO_SERVICO);
    r.sem_economia = (r.modelo + r.janela + r.gratis) * precoModelo;
    return r;
  };

  // ---- e-mail marketing
  function exigeEmail(id) { var e = P.tabela('Emails').filter(function (x) { return x.id === id; })[0]; if (!e) throw new Error('E-mail não encontrado.'); return e; }
  function blocosLimpos(bl) {
    return (Array.isArray(bl) ? bl : U.json(bl, []) || []).slice(0, 40).map(function (b) {
      var o = { tipo: U.str(b.tipo) };
      if (['titulo', 'texto', 'botao'].indexOf(o.tipo) >= 0) o.texto = U.cap(b.texto, 5000);
      if (o.tipo === 'botao') o.url = U.cap(b.url, 1000);
      if (o.tipo === 'imagem') { o.url = U.urlMidia(b.url); o.link = U.cap(b.link, 1000); o.alt = U.cap(b.alt, 120); }
      return o;
    }).filter(function (b) { return ['titulo', 'texto', 'botao', 'imagem', 'divisor', 'espaco'].indexOf(b.tipo) >= 0; });
  }
  R['email.salvar'] = function (u, b) {
    var d = b.email || {};
    exige(u, d.tipo === 'automacao' ? 'automacoes' : 'disparos');
    var tipoE = ['automacao', 'modelo'].indexOf(d.tipo) >= 0 ? d.tipo : 'campanha';
    if (!U.str(d.nome).trim()) throw new Error('Dê um nome para o e-mail.');
    if (!U.str(d.assunto).trim()) throw new Error('Escreva o assunto.');
    var reg = { nome: U.cap(d.nome, 100), tipo: tipoE, assunto: U.cap(d.assunto, 200), assunto_b: U.cap(d.assunto_b, 200), preheader: U.cap(d.preheader, 200),
      blocos: JSON.stringify(blocosLimpos(d.blocos)), filtro: JSON.stringify(d.filtro || {}), agendar_em: d.agendar_em || '' };
    if (d.id) {
      var at = exigeEmail(d.id);
      if (at.tipo === 'campanha' && ['rascunho', 'agendada'].indexOf(at.status) < 0) throw new Error('Este e-mail já foi enviado e não pode ser editado. Use Duplicar.');
      P.atualizar('Emails', d.id, reg);
      return exigeEmail(d.id);
    }
    reg.id = P.id('EM'); reg.status = reg.tipo === 'automacao' ? 'ativo' : reg.tipo === 'modelo' ? 'modelo' : 'rascunho';
    ['total', 'enviados', 'aberturas', 'cliques', 'descadastros', 'erros', 'aberturas_b', 'enviados_b'].forEach(function (k) { reg[k] = '0'; });
    reg.criado_por = u.nome; reg.criado_em = P.agora();
    P.inserir('Emails', reg);
    return reg;
  };
  R['email.excluir'] = function (u, b) {
    exige(u, 'disparos');
    var e = exigeEmail(b.id);
    if (e.status === 'enviando') throw new Error('Cancele o envio antes de excluir.');
    if (P.tabela('Automacoes').some(function (a) { return (U.json(a.passos, []) || []).some(function (st) { return st.tipo === 'email' && st.email_id === e.id; }); })) throw new Error('Este e-mail é usado numa automação. Tire o passo da automação antes.');
    P.excluirVarios('Fila', P.tabela('Fila').filter(function (f) { return f.ref_id === e.id && f.status === 'pendente'; }).map(function (f) { return f.id; }));
    P.excluir('Emails', e.id);
    return true;
  };
  R['email.duplicar'] = function (u, b) {
    exige(u, 'disparos');
    var e = exigeEmail(b.id), n = {};
    Object.keys(e).forEach(function (k) { n[k] = e[k]; });
    n.id = P.id('EM'); n.nome = U.cap(e.nome + ' (cópia)', 100); n.status = e.tipo === 'automacao' ? 'ativo' : 'rascunho'; n.agendar_em = ''; n.iniciada_em = ''; n.concluida_em = '';
    ['total', 'enviados', 'aberturas', 'cliques', 'descadastros', 'erros', 'aberturas_b', 'enviados_b'].forEach(function (k) { n[k] = '0'; });
    n.criado_por = u.nome; n.criado_em = P.agora();
    P.inserir('Emails', n);
    return n;
  };
  R['email.publico'] = function (u, b) { exige(u, 'disparos'); var t = publicoEmail({ filtro: b.filtro || {} }).length; return { total: t, cota: EM.cota() }; };
  R['email.cota'] = function (u) { exige(u, 'disparos'); return EM.cota(); };
  R['email.previa'] = function (u, b) {
    var d = b.email || {};
    var c = (b.contato_id && contatoPorId(b.contato_id)) || { nome: 'Maria Silva', email: 'maria@exemplo.com.br', primeiro_nome: 'Maria' };
    var r = EM.montar({ assunto: d.assunto, assunto_b: d.assunto_b, preheader: d.preheader, blocos: JSON.stringify(blocosLimpos(d.blocos)) }, c, { variante: b.variante });
    return { assunto: r.assunto, html: r.html };
  };
  R['email.testar'] = function (u, b) {
    exige(u, 'disparos');
    var para = U.str(b.para || u.email).trim().toLowerCase();
    if (!U.emailOk(para)) throw new Error('Informe um e-mail válido para o teste.');
    var d = b.email || {};
    var r = EM.montar({ assunto: d.assunto, preheader: d.preheader, blocos: JSON.stringify(blocosLimpos(d.blocos)) }, { nome: u.nome, email: para });
    var n = EM.contagem();
    var via = EM.enviar({ para: para, nome: u.nome, assunto: '[Teste] ' + r.assunto, html: r.html, texto: r.texto }, n);
    salvarCfg({ EMAIL_CONTAGEM: n.dia + '|' + n.gmail + '|' + n.brevo });
    return { ok: true, via: via };
  };
  R['email.iniciar'] = function (u, b) {
    exige(u, 'disparos');
    var e = exigeEmail(b.id);
    if (e.tipo === 'automacao') throw new Error('E-mails de automação saem pelo passo "Enviar e-mail" da automação.');
    if (['rascunho', 'agendada'].indexOf(e.status) < 0) throw new Error('Este e-mail já foi iniciado.');
    if (e.agendar_em && e.agendar_em > P.agora() && !b.agora) { P.atualizar('Emails', e.id, { status: 'agendada' }); marcarTrabalho(e.agendar_em); return { agendada: true, quando: e.agendar_em }; }
    return iniciarEmail(e);
  };
  R['email.pausar'] = function (u, b) { exige(u, 'disparos'); P.atualizar('Emails', exigeEmail(b.id).id, { status: 'pausada' }); return true; };
  R['email.retomar'] = function (u, b) { exige(u, 'disparos'); P.atualizar('Emails', exigeEmail(b.id).id, { status: 'enviando' }); marcarTrabalho(P.agora()); return true; };
  R['email.cancelar'] = function (u, b) {
    exige(u, 'disparos');
    var e = exigeEmail(b.id), ids = {};
    P.atualizar('Emails', e.id, { status: 'cancelada' });
    P.tabela('Fila').forEach(function (f) { if (f.ref_id === e.id && f.status === 'pendente') ids[f.id] = { status: 'cancelado' }; });
    P.atualizarVarios('Fila', ids);
    return true;
  };
  R['email.envios'] = function (u, b) {
    exige(u, 'disparos');
    var cs = {};
    P.tabela('Contatos').forEach(function (c) { cs[c.id] = c.nome; });
    return P.tabela('Fila').filter(function (f) { return f.ref_id === b.id && f.tipo === 'email'; }).slice(-2000).map(function (f) {
      return { nome: cs[f.contato_id] || '', email: f.destino, status: f.status, erro: f.erro, variante: f.variante, enviado_em: f.enviado_em, aberto_em: f.aberto_em, clicado_em: f.clicado_em };
    });
  };
  R['site.registrar'] = function (u, b) {
    exige(u, 'ajustes');
    var url = U.str(b.url).trim();
    if (!/^https:\/\/[^\s"'<>]+\/$/.test(url)) return { ok: false };
    if (cfg().SITE_URL !== url) salvarCfg({ SITE_URL: url });
    return { ok: true };
  };

  // ---- financeiro
  function exigeCobranca(u, id, area) {
    var x = FIN.porId(id);
    if (!x) throw new Error('Cobrança não encontrada.');
    if (!pode(u, 'financeiro')) { if (area === 'financeiro') exige(u, 'financeiro'); if (x.contato_id) exigeContato(u, x.contato_id); else exige(u, 'financeiro'); }
    return x;
  }
  function cobrancaPublica(x, nomes) {
    var o = {}; Object.keys(x).forEach(function (k) { o[k] = x[k]; });
    o.contato_nome = nomes[x.contato_id] || '';
    o.atrasada = FIN.atrasada(x);
    return o;
  }
  R['financeiro.resumo'] = function (u, b) { exige(u, 'financeiro'); return FIN.resumo(b.mes); };
  R['cobranca.listar'] = function (u, b) {
    if (b.contato_id) exigeContato(u, b.contato_id); else exige(u, 'financeiro');
    var nomes = {}, hoje = FIN.hoje(), em7 = U.somaTempo(hoje + 'T00:00:00', 7 * 1440).slice(0, 10);
    P.tabela('Contatos').forEach(function (c) { nomes[c.id] = c.nome; });
    var f = U.str(b.filtro || 'pendente');
    return P.tabela('Cobrancas').filter(function (x) {
      if (b.contato_id) return x.contato_id === b.contato_id && x.tipo !== 'link';
      if (f === 'links') return x.tipo === 'link';
      if (x.tipo === 'link') return false;
      if (f === 'atraso') return FIN.atrasada(x);
      if (f === 'vencendo') return x.status === 'pendente' && x.vencimento >= hoje && x.vencimento <= em7;
      if (f === 'pendente') return x.status === 'pendente';
      if (f === 'paga') return x.status === 'paga' && (!b.mes || U.str(x.pago_em).slice(0, 7) === b.mes);
      if (f === 'reembolsada') return x.status === 'reembolsada';
      return true;
    }).sort(function (a, c2) { return (a.vencimento || a.criado_em) < (c2.vencimento || c2.criado_em) ? -1 : 1; }).slice(0, 1000).map(function (x) { return cobrancaPublica(x, nomes); });
  };
  R['cobranca.criar'] = function (u, b) {
    var c = exigeContato(u, b.contato_id);
    if (b.negocio_id) { var n = P.tabela('Negocios').filter(function (x) { return x.id === b.negocio_id; })[0]; if (!n || n.contato_id !== c.id) throw new Error('Negócio não encontrado.'); }
    return FIN.criar(c, { valor_total: b.valor_total, parcelas: b.parcelas, primeiro_vencimento: b.primeiro_vencimento, descricao: b.descricao, forma: b.forma, negocio_id: b.negocio_id, entrada_paga: !!b.entrada_paga, gerar_link: !!b.gerar_link }, u);
  };
  R['cobranca.pagar'] = function (u, b) { return FIN.pagar(exigeCobranca(u, b.id), { pago_em: b.pago_em, forma: b.forma }, u); };
  R['cobranca.reembolsar'] = function (u, b) { return FIN.reembolsar(exigeCobranca(u, b.id, 'financeiro'), { valor: b.valor, motivo: b.motivo }, u); };
  R['cobranca.cancelar'] = function (u, b) {
    var x = exigeCobranca(u, b.id, 'financeiro');
    if (x.status !== 'pendente' && x.tipo !== 'link') throw new Error('Só dá para cancelar cobranças em aberto.');
    P.atualizar('Cobrancas', x.id, { status: 'cancelada', atualizado_em: P.agora() });
    if (x.contato_id) hist(x.contato_id, x.negocio_id, u, 'cobranca', 'Cancelada: ' + FIN.brl(x.valor) + ' - ' + x.descricao, x.id);
    return true;
  };
  R['cobranca.vencimento'] = function (u, b) {
    var x = exigeCobranca(u, b.id);
    if (x.status !== 'pendente' || !/^\d{4}-\d{2}-\d{2}$/.test(U.str(b.vencimento))) throw new Error('Informe a nova data.');
    P.atualizar('Cobrancas', x.id, { vencimento: b.vencimento, lembrete_em: '', atraso_avisado: '', atualizado_em: P.agora() });
    return true;
  };
  R['cobranca.link'] = function (u, b) { var x = exigeCobranca(u, b.id); if (x.status !== 'pendente' && x.tipo !== 'link') throw new Error('Esta cobrança não está em aberto.'); return { link: FIN.gerarLink(x, x.contato_id ? contatoPorId(x.contato_id) : null) }; };
  R['venda.link'] = function (u, b) {
    exige(u, 'financeiro');
    if (!U.str(b.descricao).trim() || U.num(b.valor) <= 0) throw new Error('Informe o produto e o valor.');
    var x = { id: P.id('LK'), tipo: 'link', ref_id: '', contato_id: '', negocio_id: '', descricao: U.cap(b.descricao, 120), valor: String(U.num(b.valor)), vencimento: '', status: 'ativo', pago_em: '', forma: '',
      parcela: '0', parcelas: '1', link: '', mp_id: '', origem: 'link', lembrete_em: '', atraso_avisado: '', reembolsado_em: '', reembolso_valor: '', criado_em: P.agora(), atualizado_em: P.agora() };
    P.inserir('Cobrancas', x);
    try { FIN.gerarLink(x, null); } catch (e) { P.excluir('Cobrancas', x.id); throw e; }
    return x;
  };
  R['mp.testar'] = function (u) { exige(u, 'integracoes'); var r = FIN.mpReq('/users/me', 'get'); return { ok: true, texto: 'Conectado: ' + (r.nickname || r.email || r.id) }; };

  // ---- limites, suporte e chat
  R['limites'] = function (u) { exige(u, 'equipe'); return limites(); };
  R['suporte.ver'] = function () { return SUP.estado(); };
  R['suporte.salvar'] = function (u, b) { exige(u, 'equipe'); if (U.str(b.codigo).trim()) SUP.ler(b.codigo); salvarCfg({ SUPORTE_CODIGO: U.str(b.codigo).trim().replace(/\s+/g, '') }); return SUP.estado(); };

  // ---- arquivo mensal
  R['arquivo.listar'] = function (u) {
    exige(u, 'relatorios');
    return { arquivos: registrosArquivo(), feito: cfg().ARQUIVO_FEITO, auto: cfg().ARQUIVO_AUTO, disponivel: !!P.arquivo, mes_atual: mesAtual() };
  };
  R['arquivo.arquivar'] = function (u) { exige(u, 'equipe'); return arquivar(u, 150000); };
  R['arquivo.contato'] = function (u, b) {
    var c = exigeContato(u, b.contato_id);
    if (!P.arquivo) return { mes: '', mensagens: [], historico: [], negocios: [], mais: false };
    var antes = U.str(b.antes_de) || mesAtual();
    var regs = registrosArquivo().filter(function (r) { return r.mes < antes; });
    for (var i = 0; i < regs.length && i < 6; i++) { // procura no máximo 6 meses por chamada
      var r = regs[i];
      var achou = { mes: r.mes, nome_mes: nomeDoMes(r.mes), url: pode(u, 'equipe') ? r.url : '' };
      try {
        achou.mensagens = P.arquivo.filtrar(r.planilha_id, 'Mensagens', 'contato_id', c.id);
        achou.historico = P.arquivo.filtrar(r.planilha_id, 'Historico', 'contato_id', c.id);
        achou.negocios = P.arquivo.filtrar(r.planilha_id, 'Negocios', 'contato_id', c.id);
      } catch (e) { continue; }
      achou.mais = i + 1 < regs.length;
      if (achou.mensagens.length || achou.historico.length || achou.negocios.length) return achou;
      antes = r.mes;
    }
    return { mes: antes, mensagens: [], historico: [], negocios: [], mais: regs.length > 6 };
  };

  // ---- integrações: testes
  R['integracao.testar'] = function (u, b) {
    exige(u, 'integracoes');
    if (b.qual === 'instagram') return IG.status();
    if (b.qual === 'activecampaign') {
      var k = cfg();
      if (!k.AC_URL || !k.AC_TOKEN) throw new Error('Preencha a URL e a chave do ActiveCampaign.');
      var r = req(WA.base(k.AC_URL) + '/api/3/lists?limit=50', 'get', undefined, { 'Api-Token': k.AC_TOKEN });
      return { conectado: true, texto: 'Conectado', listas: ((r && r.lists) || []).map(function (l) { return { id: l.id, nome: l.name }; }) };
    }
    throw new Error('Integração desconhecida.');
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
      velocidade: c.velocidade || 'normal', agendar_em: c.agendar_em || '', economia: c.economia === 'NAO' ? 'NAO' : 'SIM'
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
    m[b.qual === 'wa' ? 'WEBHOOK_CHAVE' : b.qual === 'api' ? 'API_CHAVE' : b.qual === 'vendas' ? 'VENDAS_CHAVE' : 'ENTRADA_CHAVE'] = P.uuid().replace(/-/g, '') + (b.qual === 'api' ? P.uuid().replace(/-/g, '').slice(0, 12) : '');
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
    var perfil = PERFIS.indexOf(d.perfil) >= 0 ? d.perfil : 'sdr';
    var perms = perfil === 'personalizado' ? U.lista(d.permissoes).filter(function (k) { return AREAS[k]; }).join(',') : '';
    var reg = { nome: U.cap(d.nome, 80), email: email, perfil: perfil, ativo: d.ativo === 'NAO' ? 'NAO' : 'SIM', recebe_leads: d.recebe_leads === 'SIM' ? 'SIM' : 'NAO', cor: /^#[0-9a-f]{6}$/i.test(d.cor) ? d.cor : '',
      meta_valor: String(U.num(d.meta_valor) || ''), meta_reunioes: String(U.num(d.meta_reunioes) || ''), permissoes: perms };
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
    if (!cfg().VENDAS_CHAVE) salvarCfg({ VENDAS_CHAVE: P.uuid().replace(/-/g, '') });
    if (!cfg().MP_CHAVE) salvarCfg({ MP_CHAVE: P.uuid().replace(/-/g, '') });
    if (!cfg().RASTREIO_SEGREDO) salvarCfg({ RASTREIO_SEGREDO: P.uuid().replace(/-/g, '') + P.uuid().replace(/-/g, '') });
    if (!cfg().ARQUIVO_FEITO && !P.tabela('Mensagens').length) salvarCfg({ ARQUIVO_FEITO: mesAtual() });
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
    if (acao === 'publico.chat.config') return CHAT.config();
    if (acao === 'publico.chat.iniciar') return CHAT.iniciar(b);
    if (acao === 'publico.chat.enviar') return CHAT.enviar(b);
    if (acao === 'publico.chat.receber') return CHAT.receber(b);
    if (acao === 'publico.clique') { var rc = EM.clicou(b.f, b.s, b.u); return { ok: !!rc, pcid: rc ? rc.pcid : '' }; }
    if (acao === 'publico.sair') return EM.sair(b.f, b.s);
    if (acao === 'publico.visita') return EM.visita(b);
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
    U: U, WA: WA, IG: IG, INT: INT, EM: EM, FIN: FIN, CHAT: CHAT, SUP: SUP, cfg: cfg, arquivar: arquivar, receberRastreio: receberRastreio, salvarCfg: salvarCfg, rotear: rotear, receberWebhook: receberWebhook, trabalhar: trabalhar,
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
