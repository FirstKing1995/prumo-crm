// Testes da versão 1.4: instalação pela tela "Ligar o sistema" (servidor novo, sem ninguém
// cadastrado), textos editáveis da tela de entrada e o que a tela pública pode ver.
module.exports = function ({ P, ok, lanca }) {
  const { PrumoLogica } = require('../app/js/logica.js');
  // banco novo e vazio, como numa planilha recém-copiada
  const db = {}, cfg = {}, cache = {};
  const t = (n) => (db[n] = db[n] || []);
  const P2 = Object.assign({}, P, {
    tabela: (n) => t(n),
    filtrar: (n, c, v) => t(n).filter((o) => o[c] === v),
    inserir: (n, o) => P2.inserirVarios(n, [o]),
    inserirVarios: (n, arr) => arr.forEach((o) => { const c = {}; Object.keys(o).forEach((k) => { c[k] = o[k] == null ? '' : String(o[k]); }); t(n).push(c); }),
    atualizar: (n, id, c) => P2.atualizarVarios(n, { [id]: c }),
    atualizarVarios: (n, m) => t(n).forEach((o) => { if (m[o.id]) Object.keys(m[o.id]).forEach((k) => { o[k] = m[o.id][k] == null ? '' : String(m[o.id][k]); }); }),
    excluir: (n, id) => P2.excluirVarios(n, [id]),
    excluirVarios: (n, ids) => { db[n] = t(n).filter((o) => ids.indexOf(o.id) < 0); },
    config: () => cfg,
    salvarConfig: (o) => Object.assign(cfg, o),
    cache: { get: (k) => cache[k] || null, put: (k, v) => { cache[k] = String(v); }, del: (k) => { delete cache[k]; } }
  });
  const L = PrumoLogica(P2);
  const chama = (action, b) => L.rotear(Object.assign({ action }, b || {}));

  const e0 = chama('publico.estado');
  ok(e0.instalado === false && e0.versao === L.versao, 'servidor novo: ainda não instalado');
  ok(e0.marca.nome && e0.marca.titulo && e0.marca.itens.length === 4, 'tela de entrada tem textos padrão');
  ok(!('API_CHAVE' in e0) && !JSON.stringify(e0).match(/CHAVE|senha|token/i), 'estado público não expõe segredos');

  lanca(() => chama('publico.instalar', { nome: 'Ana', email: 'ana@loja.com', senha: '123' }), 'senha curta recusada');
  lanca(() => chama('publico.instalar', { nome: 'Ana', email: 'ana@', senha: 'boa-senha-1' }), 'e-mail inválido recusado');
  lanca(() => chama('publico.instalar', { nome: '', email: 'ana@loja.com', senha: 'boa-senha-1' }), 'nome vazio recusado');
  lanca(() => chama('publico.instalar', { nome: 'Ana', email: 'ana@loja.com', senha: '12345678' }), 'senha óbvia recusada');
  ok(t('Usuarios').length === 0, 'tentativas recusadas não criam usuário');

  const r = chama('publico.instalar', { nome: 'Ana Dona', email: 'Ana@Loja.com ', senha: 'boa-senha-1', servidor: 'https://script.google.com/macros/s/X/exec' });
  ok(r.token && r.usuario.perfil === 'admin' && r.usuario.email === 'ana@loja.com', 'primeiro acesso cria o administrador e já entra');
  ok(t('Funis').length === 1 && t('Automacoes').length >= 3 && cfg.WEBHOOK_CHAVE && cfg.ENTRADA_CHAVE, 'base inicial semeada (funil, modelos, chaves)');
  ok(cfg.INSTALADO_EM, 'data da instalação guardada');
  ok(chama('publico.estado').instalado === true, 'depois de ligar: instalado');

  lanca(() => chama('publico.instalar', { nome: 'Intruso', email: 'x@x.com', senha: 'outra-senha-9' }), 'segunda instalação recusada');
  ok(t('Usuarios').length === 1, 'ninguém consegue criar outro administrador pela tela pública');

  const boot = L.rotear({ action: 'bootstrap', token: r.token });
  ok(boot.usuario.id === r.usuario.id && boot.config.marca.configurado === false, 'bootstrap pede o assistente de marca');

  // textos da tela de entrada
  L.rotear({ action: 'config.salvar', token: r.token, config: { LOGIN_TITULO: 'Seu salão organizado', LOGIN_ITENS: 'Agenda\n\nClientes\nCobrança', LOGIN_RODAPE: '', CONTATO_AJUDA: 'Ajuda: (11) 90000-0000' } });
  const m = chama('publico.marca');
  ok(m.titulo === 'Seu salão organizado' && m.itens.join('|') === 'Agenda|Clientes|Cobrança' && m.contato === 'Ajuda: (11) 90000-0000', 'textos da tela de entrada editáveis');
  L.rotear({ action: 'config.salvar', token: r.token, config: { INSTALADO_EM: 'x' } });
  ok(cfg.INSTALADO_EM !== 'x', 'data de instalação protegida');
};
