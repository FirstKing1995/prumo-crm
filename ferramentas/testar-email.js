// Testes do e-mail marketing (versão 1.2): envio, limite diário, Brevo, rastreio,
// descadastro, visitas ao site e automações por e-mail.
module.exports = function ({ L, t, enviados, api, ok, lanca, emailsSaidos }) {
  const contato = (id) => t('Contatos').find((c) => c.id === id);
  const rastreio = (html, tipo) => { const m = html.match(new RegExp('t=' + tipo + '&amp;f=([\\w-]+)&amp;s=([0-9a-f]+)')); return m ? { f: m[1], s: m[2] } : null; };
  const kEnt = L.cfg().ENTRADA_CHAVE;

  api('site.registrar', { url: 'https://empresa.github.io/crm/' });
  ok(L.cfg().SITE_URL === 'https://empresa.github.io/crm/', 'endereço do site registrado para os links');
  api('config.salvar', { config: { EMAIL_PROVEDOR: 'gmail', EMAIL_LIMITE_GMAIL: '95', EMAIL_RODAPE: 'Empresa Teste - Rua A, 1' } });
  L.salvarCfg({ EMAIL_CONTAGEM: '' });

  const a = api('contato.salvar', { contato: { nome: 'Eva <b>Mail</b>', email: 'eva@x.com', tags: 'News' } });
  const b = api('contato.salvar', { contato: { nome: 'Edu Mail', email: 'edu@x.com', tags: 'News' } });
  const c = api('contato.salvar', { contato: { nome: 'Ema Mail', email: 'ema@x.com', tags: 'News' } });
  api('contato.salvar', { contato: { nome: 'Sem Email', telefone: '11912340000', tags: 'News' } });

  // automações por e-mail e por visita
  const fluxoClique = api('automacao.salvar', { automacao: { nome: 'Clicou', ativo: 'SIM', gatilho: { tipo: 'email_clicou', link: 'oferta' }, passos: [{ id: 'k1', tipo: 'tag', acao: 'add', tag: 'Clicou oferta' }] } });
  api('automacao.salvar', { automacao: { nome: 'Visitou preços', ativo: 'SIM', gatilho: { tipo: 'visitou', url: '/precos' }, passos: [{ id: 'v1', tipo: 'pontos', acao: 'somar', valor: 25 }] } });
  ok(!!fluxoClique.id, 'automação com gatilho de e-mail salva');

  const em = api('email.salvar', { email: { nome: 'News 1', assunto: 'Oi {primeiro_nome}', assunto_b: 'Novidade para {primeiro_nome}', preheader: 'Prévia',
    blocos: [{ tipo: 'titulo', texto: 'Olá {nome}' }, { tipo: 'texto', texto: 'Veja *agora*: https://loja.com/oferta' }, { tipo: 'botao', texto: 'Comprar', url: 'https://loja.com/oferta?x=1' }, { tipo: 'imagem', url: 'javascript:alert(1)' }].slice(0, 3),
    filtro: { tags: ['News'] } } });
  lanca(() => api('email.salvar', { email: { nome: 'X', assunto: 'Y', blocos: [{ tipo: 'imagem', url: 'javascript:alert(1)' }] } }), 'imagem sem https bloqueada');
  ok(api('email.publico', { filtro: { tags: ['News'] } }).total === 3, 'público só com e-mail válido');
  const pv = api('email.previa', { email: em });
  ok(/Olá Maria/.test(pv.html) && /https:\/\/loja\.com\/oferta/.test(pv.html) && !/t=o&amp;/.test(pv.html), 'prévia sem rastreio e com variáveis');

  const ini = api('email.iniciar', { id: em.id });
  ok(ini.total === 3 && t('Fila').filter((f) => f.ref_id === em.id && f.variante === 'B').length === 1, 'campanha na fila com teste A/B');
  L.salvarCfg({ PROX_TRABALHO: '' });
  L.trabalhar(4);
  ok(emailsSaidos.length === 3, 'três e-mails enviados pelo Gmail');
  const eEva = emailsSaidos.find((m) => m.para === 'eva@x.com');
  ok(eEva.html.indexOf('<b>Mail</b>') < 0 && eEva.html.indexOf('&lt;b&gt;Mail') >= 0, 'nome do contato escapado no HTML');
  ok(/r\.html\?f=/.test(eEva.html) && /t=sair/.test(eEva.html) && /Empresa Teste - Rua A, 1/.test(eEva.html), 'links rastreados, descadastro e rodapé');
  ok(/Para não receber mais/.test(eEva.texto), 'versão em texto com descadastro');
  const emR = t('Emails').find((x) => x.id === em.id);
  ok(emR.enviados === '3' && emR.status === 'concluida' && emR.enviados_b === '1', 'contadores e conclusão da campanha');

  // abertura
  const pxa = rastreio(eEva.html, 'o');
  L.receberRastreio({ t: 'o', f: pxa.f, s: 'errada000000000' });
  ok(t('Emails').find((x) => x.id === em.id).aberturas === '0', 'abertura com assinatura errada ignorada');
  L.receberRastreio({ t: 'o', f: pxa.f, s: pxa.s });
  L.receberRastreio({ t: 'o', f: pxa.f, s: pxa.s });
  ok(t('Emails').find((x) => x.id === em.id).aberturas === '1', 'abertura única por pessoa');

  // clique pela página r.html (ação pública) e automação disparada
  const eEdu = emailsSaidos.find((m) => m.para === 'edu@x.com');
  const pxe = rastreio(eEdu.html, 'o');
  const rc = L.rotear({ action: 'publico.clique', f: pxe.f, s: pxe.s, u: 'https://loja.com/oferta' });
  ok(rc.ok && /^C\w+\.[0-9a-f]{16}$/.test(rc.pcid), 'clique registrado e identificação do visitante');
  const emR2 = t('Emails').find((x) => x.id === em.id);
  ok(emR2.cliques === '1' && emR2.aberturas === '2', 'clique conta como abertura quando a imagem foi bloqueada');
  ok(/Clicou oferta/.test(contato(b.id).tags), 'gatilho "clicou no e-mail" roda a automação');

  // visita ao site
  lanca(() => L.rotear({ action: 'publico.visita', k: 'errada', pcid: rc.pcid, url: 'https://loja.com/precos' }), 'visita exige a chave de captação');
  ok(L.rotear({ action: 'publico.visita', k: kEnt, pcid: b.id + '.0000000000000000', url: 'https://loja.com/precos' }).ok === false, 'identificação forjada recusada');
  L.rotear({ action: 'publico.visita', k: kEnt, pcid: rc.pcid, url: 'https://loja.com/precos', titulo: 'Preços' });
  L.rotear({ action: 'publico.visita', k: kEnt, pcid: rc.pcid, url: 'https://loja.com/precos' });
  ok(contato(b.id).pontos === '25' && t('Historico').filter((h) => h.contato_id === b.id && h.acao === 'visitou').length === 1, 'visita registrada uma vez e automação de visita');

  // descadastro
  const eEma = emailsSaidos.find((m) => m.para === 'ema@x.com');
  const pxm = rastreio(eEma.html, 'o');
  lanca(() => L.receberRastreio({ t: 'sair', f: pxm.f, s: '0000000000000000' }), 'descadastro com link falso recusado');
  const rs = L.receberRastreio({ t: 'sair', f: pxm.f, s: pxm.s });
  ok(contato(c.id).email_optout === 'SIM' && /e\*\*\*@x\.com/.test(rs.email), 'descadastro pelo link do e-mail');
  ok(api('email.publico', { filtro: { tags: ['News'] } }).total === 2 && t('Emails').find((x) => x.id === em.id).descadastros === '1', 'quem saiu não entra nos próximos envios');

  // limite diário e Brevo
  api('config.salvar', { config: { EMAIL_LIMITE_GMAIL: '1' } });
  L.salvarCfg({ EMAIL_CONTAGEM: '' });
  const em2 = api('email.duplicar', { id: em.id });
  api('email.iniciar', { id: em2.id });
  L.salvarCfg({ PROX_TRABALHO: '' });
  const antes = emailsSaidos.length;
  L.trabalhar(4);
  const pend = t('Fila').filter((f) => f.ref_id === em2.id && f.status === 'pendente');
  ok(emailsSaidos.length === antes + 1 && pend.length === 1 && /T08:00:00$/.test(pend[0].enviar_em) && pend[0].enviar_em > new Date().toISOString().slice(0, 10), 'passou do limite: o resto vai para amanhã às 8h');
  api('config.salvar', { config: { EMAIL_PROVEDOR: 'ambos', BREVO_APIKEY: 'xkeysib-teste', BREVO_REMETENTE: 'news@empresa.com', BREVO_LIMITE: '300' } });
  pend[0].enviar_em = '2000-01-01T00:00:00';
  L.salvarCfg({ PROX_TRABALHO: '' });
  L.trabalhar(4);
  const brevo = enviados.filter((e) => /api\.brevo\.com/.test(e.url)).pop();
  ok(brevo && brevo.body.sender.email === 'news@empresa.com' && /List-Unsubscribe/.test(JSON.stringify(brevo.body.headers)), 'Gmail esgotado: envia pelo Brevo com descadastro no cabeçalho');
  ok(api('config.ver').BREVO_APIKEY.indexOf('••') === 0 && api('config.ver').RASTREIO_SEGREDO === undefined, 'chave do Brevo e segredo do rastreio protegidos');

  // automação: e-mail + condição "não abriu"
  api('config.salvar', { config: { EMAIL_PROVEDOR: 'gmail', EMAIL_LIMITE_GMAIL: '95' } });
  L.salvarCfg({ EMAIL_CONTAGEM: '' });
  const emA = api('email.salvar', { email: { tipo: 'automacao', nome: 'Boas-vindas', assunto: 'Bem-vindo {primeiro_nome}', blocos: [{ tipo: 'texto', texto: 'Oi' }] } });
  ok(emA.status === 'ativo', 'e-mail de automação criado');
  const au = api('automacao.salvar', { automacao: { nome: 'Nutrição', ativo: 'SIM', gatilho: { tipo: 'manual' }, passos: [{ id: 'n1', tipo: 'email', email_id: emA.id }, { id: 'n2', tipo: 'condicao', se: 'email', op: 'nao_abriu', valor: emA.id, sim: 'n3', nao: 'fim' }, { id: 'n3', tipo: 'tag', acao: 'add', tag: 'Não abriu' }] } });
  api('automacao.testar', { id: au.id, contato_id: a.id });
  ok(/Não abriu/.test(contato(a.id).tags), 'condição "não abriu" funciona');
  L.salvarCfg({ PROX_TRABALHO: '' });
  const n0 = emailsSaidos.length;
  L.trabalhar(4);
  ok(emailsSaidos.length === n0 + 1 && emailsSaidos[emailsSaidos.length - 1].assunto === 'Bem-vindo Eva', 'passo "Enviar e-mail" da automação');
  lanca(() => api('email.excluir', { id: emA.id }), 'não exclui e-mail usado em automação');
};
