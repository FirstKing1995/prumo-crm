// Testes da lógica do servidor com uma plataforma em memória.
// Uso: node ferramentas/testar.js
const { PrumoLogica } = require('../app/js/logica.js');
const crypto = require('crypto');

let falhas = 0, total = 0;
function ok(cond, nome) { total++; if (!cond) { falhas++; console.log('FALHOU: ' + nome); } }
function lanca(fn, nome) { total++; try { fn(); falhas++; console.log('FALHOU (não lançou erro): ' + nome); } catch (e) { /* esperado */ } }

const db = {}, cfg = {}, cache = {}, enviados = [];
const t = (n) => (db[n] = db[n] || []);
const iso = () => new Date().toISOString().slice(0, 19);
let seq = 0;
const P = {
  tabela: (n) => t(n),
  filtrar: (n, c, v) => t(n).filter((o) => o[c] === v),
  inserir: (n, o) => P.inserirVarios(n, [o]),
  inserirVarios: (n, arr) => arr.forEach((o) => { const c = {}; Object.keys(o).forEach((k) => { c[k] = o[k] == null ? '' : String(o[k]); }); t(n).push(c); }),
  atualizar: (n, id, c) => P.atualizarVarios(n, { [id]: c }),
  atualizarVarios: (n, m) => t(n).forEach((o) => { if (m[o.id]) Object.keys(m[o.id]).forEach((k) => { o[k] = m[o.id][k] == null ? '' : String(m[o.id][k]); }); }),
  excluir: (n, id) => P.excluirVarios(n, [id]),
  excluirVarios: (n, ids) => { db[n] = t(n).filter((o) => ids.indexOf(o.id) < 0); },
  config: () => cfg,
  salvarConfig: (o) => Object.assign(cfg, o),
  agora: iso,
  id: (p) => p + (++seq),
  uuid: () => crypto.randomUUID(),
  hash: (s, salt) => crypto.createHash('sha256').update(salt + '|' + s).digest('hex'),
  cache: { get: (k) => cache[k] || null, put: (k, v) => { cache[k] = String(v); }, del: (k) => { delete cache[k]; } },
  http: (url, o) => {
    if (/connectionState/.test(url)) return { code: 200, text: '{"instance":{"state":"open"}}' };
    enviados.push({ url, body: o.body ? JSON.parse(o.body) : null });
    // Mercado Pago simulado
    if (/api\.mercadopago\.com\/checkout\/preferences/.test(url)) return { code: 201, text: JSON.stringify({ id: 'PREF' + enviados.length, init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=PREF' + enviados.length }) };
    if (/api\.mercadopago\.com\/v1\/payments\//.test(url)) return { code: 200, text: JSON.stringify(mpPagamentos[url.split('/').pop()] || {}) };
    if (/api\.mercadopago\.com\/users\/me/.test(url)) return { code: 200, text: '{"nickname":"LOJA_TESTE"}' };
    return { code: 201, text: JSON.stringify({ key: { id: 'OUT' + enviados.length } }) };
  },
  urlApp: () => 'https://script.google.com/macros/s/TESTE/exec',
  substituir: (n, objs) => { db[n] = objs.slice(); },
  email: { gmail: (m) => emailsSaidos.push(m), cotaGmail: () => 100 },
  arquivo: {
    criar: (nome) => { const id = 'ARQ' + (++seq); arq[id] = { nome, t: {} }; return { id, url: 'https://docs.google.com/' + id }; },
    anexar: (id, aba, cab, objs) => { const a = arq[id].t[aba] = arq[id].t[aba] || []; objs.forEach((o) => { if (!a.some((x) => x.id === o.id)) a.push(Object.assign({}, o)); }); },
    ler: (id, aba) => (arq[id].t[aba] || []).slice(),
    filtrar: (id, aba, c, v) => (arq[id].t[aba] || []).filter((o) => o[c] === v)
  }
};
const arq = {};
const emailsSaidos = [];
const mpPagamentos = {};

const L = PrumoLogica(P);
L.semear({ nome: 'Admin', email: 'admin@teste.com', senha: 'senha-forte-1' });
ok(t('Usuarios').length === 1, 'admin criado');
ok(t('Funis').length === 1 && t('Etapas').length === 6, 'funil padrão');
ok(t('Automacoes').length === 3, 'automações de exemplo');

// login
lanca(() => L.rotear({ action: 'login', email: 'admin@teste.com', senha: 'errada' }), 'senha errada');
const s = L.rotear({ action: 'login', email: 'admin@teste.com', senha: 'senha-forte-1' });
ok(!!s.token, 'login ok');
const api = (action, b) => L.rotear(Object.assign({ action, token: s.token }, b || {}));
lanca(() => L.rotear({ action: 'bootstrap', token: 'falso' }), 'token inválido');

// configura Evolution e liga a automação de menu
api('config.salvar', { config: { WA_PROVEDOR: 'evolution', EVOLUTION_URL: 'https://evo.teste', EVOLUTION_APIKEY: 'k', EVOLUTION_INSTANCIA: 'atend', HORARIO_INICIO: '00:00', HORARIO_FIM: '23:59', DIAS_ENVIO: '0,1,2,3,4,5,6' } });
api('automacao.ativar', { id: 'A1', ativo: 'SIM' });
const kWa = cfg.WEBHOOK_CHAVE, kEnt = cfg.ENTRADA_CHAVE;
ok(kWa && kEnt && kWa !== kEnt, 'chaves separadas');

// webhook Evolution (mensagem nova) -> cria contato e manda o menu
const evo = (texto, id) => ({ event: 'messages.upsert', instance: 'atend', data: { key: { remoteJid: '5511988887777@s.whatsapp.net', fromMe: false, id }, pushName: 'Joana Lima', message: { conversation: texto }, messageType: 'conversation' } });
lanca(() => L.receberWebhook({ src: 'wa', k: kEnt }, evo('oi', 'X0')), 'chave de captação não serve no WhatsApp');
L.receberWebhook({ src: 'wa', k: kWa }, evo('Oi, boa tarde', 'IN1'));
const joana = t('Contatos').find((c) => c.telefone === '5511988887777');
ok(joana && joana.nome === 'Joana Lima', 'contato criado pelo webhook');
ok(enviados.length === 1 && /sendText\/atend/.test(enviados[0].url) && /\*1\* - Quero um orçamento/.test(enviados[0].body.text), 'menu enviado');
ok(t('Execucoes')[0].status === 'esperando_resposta', 'robô esperando resposta');

// eco do próprio envio é ignorado; mensagem repetida também
L.receberWebhook({ src: 'wa', k: kWa }, evo('Oi, boa tarde', 'IN1'));
ok(t('Mensagens').filter((m) => m.direcao === 'in').length === 1, 'mensagem duplicada ignorada');

// responde 1 -> pergunta nome -> e-mail inválido -> e-mail válido
L.receberWebhook({ src: 'wa', k: kWa }, evo('1', 'IN2'));
ok(/qual é o seu nome/i.test(enviados[enviados.length - 1].body.text), 'pergunta de nome');
L.receberWebhook({ src: 'wa', k: kWa }, evo('Joana Maria Lima', 'IN3'));
L.receberWebhook({ src: 'wa', k: kWa }, evo('joana@', 'IN4'));
ok(/incompleto/.test(enviados[enviados.length - 1].body.text), 'validação de e-mail');
L.receberWebhook({ src: 'wa', k: kWa }, evo('joana@empresa.com.br', 'IN5'));
const j2 = t('Contatos').find((c) => c.id === joana.id);
ok(j2.nome === 'Joana Maria Lima' && j2.email === 'joana@empresa.com.br', 'dados salvos pela conversa');
ok(/Lead quente/.test(j2.tags) && j2.bot_pausado_ate > iso(), 'tag e passagem para humano');
ok(t('Tarefas').some((x) => x.contato_id === joana.id), 'tarefa criada para a equipe');

// descadastro
L.receberWebhook({ src: 'wa', k: kWa }, evo('SAIR', 'IN6'));
ok(t('Contatos').find((c) => c.id === joana.id).optout === 'SIM', 'optout');

// LID: número vem em remoteJidAlt
L.receberWebhook({ src: 'wa', k: kWa }, { event: 'messages.upsert', data: { key: { remoteJid: '123456@lid', remoteJidAlt: '5521977776666@s.whatsapp.net', fromMe: false, id: 'L1' }, pushName: 'Carlos', message: { extendedTextMessage: { text: 'qual o preço?' } } } });
ok(t('Contatos').some((c) => c.telefone === '5521977776666'), 'endereço LID resolvido');

// WAHA e Meta
ok(L.WA.ler({ event: 'message', session: 'default', payload: { id: 'w1', from: '5531966665555@c.us', fromMe: false, body: 'olá', _data: { notifyName: 'Ana' } } })[0].telefone === '5531966665555', 'WAHA lido');
const meta = L.WA.ler({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ wa_id: '5541955554444', profile: { name: 'Bia' } }], messages: [{ from: '5541955554444', id: 'm1', type: 'text', text: { body: 'oi' } }] } }] }] });
ok(meta[0].nome === 'Bia' && meta[0].texto === 'oi', 'Meta lido');
ok(L.WA.ler({ event: 'messages.upsert', data: { key: { remoteJid: '1203@g.us', id: 'g' }, message: { conversation: 'grupo' } } }).length === 0, 'mensagem de grupo ignorada');

// webhook de captação
const r = L.receberWebhook({ src: 'entrada', k: kEnt, origem: 'Site', tags: 'Promo' }, { data: { buyer: { name: 'Rui Alves', email: 'RUI@X.COM', checkout_phone: '(48) 99123-4567' } }, utm_source: 'insta' });
const rui = t('Contatos').find((c) => c.id === r.contato_id);
ok(rui.nome === 'Rui Alves' && rui.email === 'rui@x.com' && rui.telefone === '5548991234567' && /Promo/.test(rui.tags) && /insta/.test(rui.campos), 'captação reconhece campos aninhados');
lanca(() => L.receberWebhook({ src: 'entrada', k: 'errada' }, { email: 'a@b.com' }), 'chave errada na captação');
lanca(() => api('mensagem.enviar', { id: rui.id, texto: 'x', midia_url: 'javascript:alert(1)' }), 'mídia sem https bloqueada');

// disparo com fila espaçada
const camp = api('campanha.salvar', { campanha: { nome: 'Teste', destino: 'contatos', filtro: {}, texto: '{Oi|Olá} {primeiro_nome}', velocidade: 'rapida' } });
const ini = api('campanha.iniciar', { id: camp.id });
ok(ini.total === 2, 'público exclui quem pediu para sair (2 de 3)');
const fila = t('Fila').filter((f) => f.ref_id === camp.id);
ok(fila[1].enviar_em > fila[0].enviar_em, 'envios espaçados');
cfg.PROX_TRABALHO = '';
const tr = L.trabalhar(4);
ok(tr.enviados === 1, 'worker envia só o que já venceu');
ok(/^(Oi|Olá) /.test(enviados[enviados.length - 1].body.text), 'spintax aplicado');

// permissões do atendente
api('usuario.salvar', { usuario: { nome: 'Ate', email: 'ate@teste.com', perfil: 'atendente', senha: 'senha-ate-1' } });
const sa = L.rotear({ action: 'login', email: 'ate@teste.com', senha: 'senha-ate-1' });
const apiA = (action, b) => L.rotear(Object.assign({ action, token: sa.token }, b || {}));
lanca(() => apiA('config.ver'), 'atendente não vê configurações');
lanca(() => apiA('campanha.salvar', { campanha: { nome: 'x', texto: 'y' } }), 'atendente não dispara');
api('contato.massa', { ids: [rui.id], acao: 'atribuir', valor: 'U1' });
lanca(() => apiA('contato.ver', { id: rui.id }), 'atendente não abre contato de outro');
ok(JSON.stringify(api('config.ver')).indexOf('"k"') < 0 && api('config.ver').EVOLUTION_APIKEY.indexOf('••') === 0, 'segredos mascarados');

require('./testar-novos.js')({ L, P, t, cfg, cache, enviados, api, ok, lanca, arq, iso });
require('./testar-email.js')({ L, P, t, cfg, enviados, api, ok, lanca, emailsSaidos });
require('./testar-v13.js')({ L, P, t, cfg, enviados, api, ok, lanca, mpPagamentos });
console.log((total - falhas) + '/' + total + ' testes passaram');
process.exit(falhas ? 1 : 0);
