/* ==========================================================================
   PRUMO CRM — Relatórios, Integrações (com tutoriais) e Ajustes
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;

  /* ============================================================ RELATÓRIOS */
  var periodo = 30;
  C.views.relatorios = {
    titulo: 'Relatórios',
    render: function (el) {
      el.innerHTML = '<div class="barra-ferr"><div class="seg">' + [[7, '7 dias'], [30, '30 dias'], [90, '90 dias'], [365, '12 meses']].map(function (p) { return '<button data-p="' + p[0] + '" class="' + (periodo === p[0] ? 'on' : '') + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        '<div class="dir"><button class="btn" id="r-csv">' + ic('download') + ' Exportar negócios</button></div></div><div id="rel"><div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div></div>';
      C.$$('[data-p]', el).forEach(function (b) { b.onclick = function () { periodo = Number(b.dataset.p); C.render(); }; });
      C.$('#r-csv').onclick = function () {
        C.baixarCsv('negocios-' + C.hoje() + '.csv', ['titulo', 'contato', 'funil', 'etapa', 'valor', 'status', 'motivo_perda', 'responsavel', 'criado_em', 'fechado_em'], S.negocios.map(function (n) {
          var c = C.contato(n.contato_id), e = C.etapa(n.etapa_id), f = C.funil(n.funil_id), u = C.usuario(n.responsavel_id);
          return [n.titulo, c ? c.nome : '', f ? f.nome : '', e ? e.nome : '', String(C.num(n.valor)).replace('.', ','), n.status, n.motivo_perda, u ? u.nome : '', n.criado_em, n.fechado_em];
        }));
      };
      C.api('relatorio', { de: C.diasAtras(periodo), ate: C.hoje() }).then(function (r) { pintar(r); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  function pintar(r) {
    var box = C.$('#rel');
    if (!box) return;
    var soma = function (k) { return r.dias.reduce(function (s, d) { return s + d[k]; }, 0); };
    var ganhos = soma('ganhos'), valor = soma('valor'), recebidas = soma('recebidas'), enviadas = soma('enviadas'), novos = soma('contatos');
    var perdidos = Object.keys(r.motivos).reduce(function (s, k) { return s + r.motivos[k]; }, 0);
    var h = '<div class="kpis">' +
      kpi('contatos', 'Novos contatos', C.inteiro(novos)) + kpi('trofeu', 'Negócios ganhos', C.inteiro(ganhos)) + kpi('dinheiro', 'Faturado', C.brlCurto(valor)) +
      kpi('raio', 'Conversão', C.pct(ganhos, ganhos + perdidos) + '%') + kpi('conversas', 'Mensagens recebidas', C.inteiro(recebidas)) + kpi('relogio', 'Tempo médio de resposta', r.tempo_resposta_min ? (r.tempo_resposta_min < 60 ? r.tempo_resposta_min + ' min' : Math.round(r.tempo_resposta_min / 60 * 10) / 10 + ' h') : '—') + '</div>';
    h += '<div class="grid-2"><div class="card"><div class="card-cab"><h3>Mensagens por dia</h3><span class="acoes small muted">recebidas · enviadas</span></div><div class="card-pad">' + barrasDuplas(r.dias, periodo) + '</div></div>';
    h += '<div class="card"><div class="card-cab"><h3>De onde vêm os contatos</h3></div><div class="card-pad">' + hbars(r.origens) + '</div></div></div>';
    h += '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-cab"><h3>Desempenho da equipe</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Pessoa</th><th>Mensagens</th><th>Ganhos</th><th>Valor</th><th>Em aberto</th></tr></thead><tbody>' +
      r.usuarios.sort(function (a, b) { return b.valor - a.valor; }).map(function (u) { return '<tr style="cursor:default"><td>' + esc(u.nome) + '</td><td class="num">' + u.enviadas + '</td><td class="num">' + u.ganhos + '</td><td class="num">' + C.brl(u.valor) + '</td><td class="num">' + u.abertos + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    h += '<div class="card"><div class="card-cab"><h3>Motivos de perda</h3></div><div class="card-pad">' + (perdidos ? hbars(r.motivos, 'var(--vermelho)') : '<p class="muted" style="margin:0">Nenhum negócio perdido no período.</p>') + '</div></div></div>';
    h += '<div class="grid-2" style="margin-top:16px"><div class="card"><div class="card-cab"><h3>Disparos</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Disparo</th><th>Enviados</th><th>Respostas</th><th>Taxa</th></tr></thead><tbody>' +
      (r.campanhas.length ? r.campanhas.map(function (c) { return '<tr style="cursor:default"><td>' + esc(c.nome) + '</td><td class="num">' + c.enviados + '/' + c.total + '</td><td class="num">' + c.respostas + '</td><td class="num">' + C.pct(c.respostas, c.enviados) + '%</td></tr>'; }).join('') : '<tr><td colspan="4" class="muted">Nenhum disparo no período.</td></tr>') + '</tbody></table></div></div>';
    h += '<div class="card"><div class="card-cab"><h3>Automações</h3></div><div class="tabela-wrap"><table class="tab"><thead><tr><th>Automação</th><th>Entradas</th><th>Concluídas</th><th>Situação</th></tr></thead><tbody>' +
      r.automacoes.map(function (a) { return '<tr style="cursor:default"><td>' + esc(a.nome) + '</td><td class="num">' + a.disparos + '</td><td class="num">' + a.concluidas + '</td><td><span class="status ' + (a.ativo === 'SIM' ? 'st-on' : 'st-off') + '">' + (a.ativo === 'SIM' ? 'Ativa' : 'Desligada') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div></div>';
    box.innerHTML = h;
  }
  function kpi(i, rot, val) { return '<div class="card kpi"><div class="rot">' + ic(i) + rot + '</div><div class="val">' + val + '</div></div>'; }
  function hbars(obj, cor) {
    var ks = Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }).slice(0, 8);
    if (!ks.length) return '<p class="muted" style="margin:0">Sem dados no período.</p>';
    var max = obj[ks[0]] || 1;
    return ks.map(function (k) { return '<div class="hbar"><span class="trunc">' + esc(k) + '</span><div class="trilho"><div style="width:' + (obj[k] / max * 100) + '%;' + (cor ? 'background:' + cor : '') + '"></div></div><b class="num small">' + obj[k] + '</b></div>'; }).join('');
  }
  function barrasDuplas(dias, n) {
    var mapa = {}; dias.forEach(function (d) { mapa[d.dia] = d; });
    var lista = [];
    var passo = n > 90 ? 7 : 1;
    for (var i = n - 1; i >= 0; i -= passo) {
      var r = 0, e = 0, rot = C.diasAtras(i);
      for (var k = 0; k < passo; k++) { var d = mapa[C.diasAtras(i - k)]; if (d) { r += d.recebidas; e += d.enviadas; } }
      lista.push({ d: rot, r: r, e: e });
    }
    var max = Math.max.apply(null, lista.map(function (x) { return Math.max(x.r, x.e); }).concat([1]));
    return '<div class="barras" style="gap:2px">' + lista.map(function (x) {
      return '<div style="flex:1;display:flex;gap:1px;align-items:flex-end;height:100%"><div class="b" style="height:' + Math.max(2, x.r / max * 100) + '%;background:var(--whats)" data-t="' + x.d.slice(8) + '/' + x.d.slice(5, 7) + ': ' + x.r + ' recebidas"></div><div class="b" style="height:' + Math.max(2, x.e / max * 100) + '%" data-t="' + x.e + ' enviadas"></div></div>';
    }).join('') + '</div><div class="eixo"><span>' + C.fmtData(lista[0].d, false) + '</span><span>hoje</span></div>';
  }

  /* ============================================================ INTEGRAÇÕES */
  var CFGA = null; // configuração completa (só admin)
  function carregarCfg() { return C.api('config.ver').then(function (c) { CFGA = c; return c; }); }

  C.views.integracoes = {
    titulo: 'Integrações',
    render: function (el) {
      el.innerHTML = '<div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div>';
      carregarCfg().then(function () { pintarIntegracoes(el); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  var INTEG = [
    { id: 'evolution', grupo: 'WhatsApp', nome: 'Evolution API', cor: '#16A34A', ic: 'whats', tag: 'Recomendado', desc: 'Gratuita e de código aberto. Conecta pelo QR Code, como o WhatsApp Web. Envia, recebe, grupos e mídia.' },
    { id: 'waha', grupo: 'WhatsApp', nome: 'WAHA', cor: '#0EA5E9', ic: 'whats', tag: 'Gratuito', desc: 'Alternativa gratuita (versão Core) à Evolution. Também conecta pelo QR Code.' },
    { id: 'meta', grupo: 'WhatsApp', nome: 'API oficial da Meta', cor: '#2563EB', ic: 'escudo', tag: 'Oficial', desc: 'WhatsApp Cloud API. Sem risco de bloqueio por uso de API não oficial. A Meta cobra por mensagem iniciada pela empresa.' },
    { id: 'link', grupo: 'WhatsApp', nome: 'Modo link (sem API)', cor: '#64748B', ic: 'link', tag: 'Sem instalar nada', desc: 'O sistema abre a conversa no seu WhatsApp com o texto pronto e você aperta enviar. Não recebe mensagens nem usa robôs.' },
    { id: 'entrada', grupo: 'Captação', nome: 'Formulários e sites', cor: '#7C3AED', ic: 'webhook', desc: 'Receba leads de Elementor, WordPress, Typebot, RD Station, Hotmart, Kiwify, Google Forms e qualquer ferramenta que envie webhook.' },
    { id: 'form', grupo: 'Captação', nome: 'Formulário pronto', cor: '#DB2777', ic: 'nota', desc: 'Código de formulário para colar no seu site ou página. Cada envio vira contato e pode iniciar uma automação.' },
    { id: 'saida', grupo: 'Automação externa', nome: 'n8n, Make e Zapier', cor: '#EA580C', ic: 'raio', desc: 'Avise outros sistemas quando um contato é criado, uma mensagem chega ou um negócio é ganho.' },
    { id: 'planilha', grupo: 'Dados', nome: 'Google Planilhas', cor: '#15803D', ic: 'planilha', tag: 'Conectado', desc: 'Todos os dados ficam numa planilha na sua conta Google. Você é dono deles e pode abrir, filtrar e fazer backup.' }
  ];

  function pintarIntegracoes(el) {
    var prov = CFGA.WA_PROVEDOR;
    var h = '<div class="aviso info">' + ic('info') + '<div>WhatsApp em uso agora: <b>' + esc((INTEG.filter(function (i) { return i.id === prov; })[0] || {}).nome || prov) + '</b>. ' + esc(S.waStatus ? S.waStatus.texto || '' : '') + '</div></div>';
    var grupos = {};
    INTEG.forEach(function (i) { (grupos[i.grupo] = grupos[i.grupo] || []).push(i); });
    Object.keys(grupos).forEach(function (g) {
      h += '<h3 style="font-size:14px;margin:22px 0 10px;color:var(--txt-2)">' + g + '</h3><div class="integ-grade">' + grupos[g].map(function (i) {
        var ativo = i.grupo === 'WhatsApp' && prov === i.id;
        return '<div class="card integ"><div class="integ-cab"><span class="integ-logo" style="background:' + i.cor + '1A;color:' + i.cor + '">' + ic(i.ic) + '</span><div><b>' + i.nome + '</b>' + (ativo ? ' <span class="status st-on">Em uso</span>' : i.tag ? ' <span class="status st-off">' + i.tag + '</span>' : '') + '</div></div>' +
          '<p>' + i.desc + '</p><button class="btn ' + (ativo ? 'pri' : '') + '" data-in="' + i.id + '">' + (i.grupo === 'WhatsApp' ? (ativo ? 'Configurar' : 'Usar e configurar') : 'Abrir') + ' ' + ic('dir') + '</button></div>';
      }).join('') + '</div>';
    });
    el.innerHTML = h;
    C.$$('[data-in]', el).forEach(function (b) { b.onclick = function () { abrirIntegracao(b.dataset.in); }; });
  }

  function salvarCfg(dados) {
    return C.api('config.salvar', { config: dados }).then(function (c) { CFGA = c; C.atualizarWa(); return c; });
  }

  function abrirIntegracao(id) {
    var i = INTEG.filter(function (x) { return x.id === id; })[0];
    var corpo = '', pe = '<button class="btn" data-fechar>Fechar</button>';
    var urlWa = CFGA.URL_WEBHOOK_WA, urlEnt = CFGA.URL_WEBHOOK_ENTRADA;
    var semUrl = !CFGA.URL_APP ? '<div class="aviso erro">' + ic('alerta') + '<div>O servidor ainda não sabe o próprio endereço. No Apps Script, rode a função <b>definirUrlDoApp</b> com a URL que termina em /exec (veja o guia de instalação).</div></div>' : '';
    if (id === 'evolution') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Tenha um servidor com a Evolution API</b>A Evolution é gratuita, mas precisa ficar ligada 24 horas num servidor. Opções: uma VPS barata (Hostinger, Contabo, Hetzner, a partir de uns R$ 25/mês) com o instalador de 1 clique da Evolution, ou um parceiro que já hospeda para você. O guia <b>docs/WHATSAPP_EVOLUTION.md</b> tem o passo a passo com Docker.</li>' +
        '<li><b>Copie 2 dados do servidor</b>O endereço (ex.: https://api.suaempresa.com.br) e a chave global (variável AUTHENTICATION_API_KEY).</li>' +
        '<li><b>Preencha ao lado e salve</b>O nome da instância pode ser qualquer palavra sem espaço, como "atendimento".</li>' +
        '<li><b>Clique em Conectar e leia o QR Code</b>No celular: WhatsApp > Aparelhos conectados > Conectar aparelho. O webhook é configurado sozinho.</li>' +
        '<li><b>Teste</b>Envie uma mensagem de teste para o seu celular e mande um "oi" do seu celular para o número conectado. Ela deve aparecer em Conversas.</li></ol></div>' +
        '<div><div class="campo"><label>URL da Evolution API</label><input class="inp" id="e-url" value="' + esc(CFGA.EVOLUTION_URL) + '" placeholder="https://api.suaempresa.com.br"></div>' +
        '<div class="campo"><label>Chave global (apikey)</label><input class="inp" id="e-key" value="' + esc(CFGA.EVOLUTION_APIKEY) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Nome da instância</label><input class="inp" id="e-inst" value="' + esc(CFGA.EVOLUTION_INSTANCIA || 'atendimento') + '"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="e-salvar" data-carregando=" Salvando...">Salvar e usar Evolution</button><button class="btn" id="e-con" data-carregando=" Gerando QR...">' + ic('qr') + ' Conectar</button></div>' +
        '<div id="e-qr" style="margin-top:14px"></div>' + blocoTeste() +
        '<details style="margin-top:14px"><summary class="small muted">Webhook (configurado automaticamente)</summary><div style="margin-top:8px">' + C.copiavel(urlWa) + '<p class="small muted">Eventos: MESSAGES_UPSERT e CONNECTION_UPDATE. Só configure manualmente se o automático falhar.</p></div></details></div></div>';
    } else if (id === 'waha') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Suba o WAHA num servidor</b>Com Docker: <code>docker run -it -p 3000:3000 -e WHATSAPP_API_KEY=suachave devlikeapro/waha</code>. Coloque um domínio com HTTPS na frente (o guia docs/WHATSAPP_WAHA.md mostra como).</li>' +
        '<li><b>Preencha URL e chave</b>A chave é o valor de WHATSAPP_API_KEY. A versão gratuita (Core) usa a sessão "default".</li>' +
        '<li><b>Clique em Conectar</b>O sistema cria a sessão, aponta o webhook e mostra o QR Code.</li>' +
        '<li><b>Leia o QR Code e teste</b>WhatsApp > Aparelhos conectados > Conectar aparelho.</li></ol></div>' +
        '<div><div class="campo"><label>URL do WAHA</label><input class="inp" id="w-url" value="' + esc(CFGA.WAHA_URL) + '" placeholder="https://waha.suaempresa.com.br"></div>' +
        '<div class="campo"><label>Chave (X-Api-Key)</label><input class="inp" id="w-key" value="' + esc(CFGA.WAHA_APIKEY) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Sessão</label><input class="inp" id="w-ses" value="' + esc(CFGA.WAHA_SESSAO || 'default') + '"></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn pri" id="w-salvar" data-carregando=" Salvando...">Salvar e usar WAHA</button><button class="btn" id="w-con" data-carregando=" Gerando QR...">' + ic('qr') + ' Conectar</button></div>' +
        '<div id="w-qr" style="margin-top:14px"></div>' + blocoTeste() +
        '<details style="margin-top:14px"><summary class="small muted">Webhook</summary><div style="margin-top:8px">' + C.copiavel(urlWa) + '<p class="small muted">Eventos: message e message.any.</p></div></details></div></div>';
    } else if (id === 'meta') {
      corpo = semUrl + '<div class="grid-2" style="align-items:start"><div><h3 style="font-size:15px;margin-bottom:12px">Tutorial</h3><ol class="passos-tut">' +
        '<li><b>Crie o app na Meta</b>Em developers.facebook.com > Meus apps > Criar app > tipo Empresa. Adicione o produto WhatsApp.</li>' +
        '<li><b>Adicione o número</b>Em WhatsApp > Configuração da API, cadastre e verifique o número da empresa (ele não pode estar em uso no app do WhatsApp).</li>' +
        '<li><b>Gere um token permanente</b>Configurações do negócio > Usuários do sistema > Adicionar (admin) > Gerar token com as permissões whatsapp_business_messaging e whatsapp_business_management.</li>' +
        '<li><b>Copie o ID do número</b>Em Configuração da API aparece o "Identificação do número de telefone" (Phone number ID).</li>' +
        '<li><b>Configure o webhook</b>Em WhatsApp > Configuração > Webhook: cole a URL de retorno e o token de verificação mostrados aqui. Depois assine o campo <b>messages</b>.</li>' +
        '<li><b>Modelos de mensagem</b>Para iniciar conversa (disparos), a Meta exige modelos aprovados. Crie em Gerenciador do WhatsApp > Modelos e use o nome deles nos disparos.</li></ol></div>' +
        '<div><div class="campo"><label>Token de acesso</label><input class="inp" id="m-token" value="' + esc(CFGA.META_TOKEN) + '" autocomplete="off"></div>' +
        '<div class="campo"><label>Phone number ID</label><input class="inp" id="m-phone" value="' + esc(CFGA.META_PHONE_ID) + '"></div>' +
        '<div class="campo"><label>Token de verificação do webhook (invente uma senha)</label><input class="inp" id="m-verify" value="' + esc(CFGA.META_VERIFY || '') + '"></div>' +
        '<button class="btn pri" id="m-salvar" data-carregando=" Salvando...">Salvar e usar API oficial</button>' +
        '<div style="margin-top:16px"><span class="rot">URL de retorno (webhook)</span>' + C.copiavel(urlWa) + '</div>' + blocoTeste() + '</div></div>';
    } else if (id === 'link') {
      corpo = '<p style="margin-top:0">No modo link o sistema não precisa de servidor nem de API. Ao enviar uma mensagem, o WhatsApp abre no seu celular ou computador com o texto pronto.</p><ul class="muted"><li>Funciona na hora, sem configurar nada.</li><li>Não recebe mensagens no sistema (as conversas ficam só no seu WhatsApp).</li><li>Robôs e disparos automáticos não funcionam. Disparos viram envio assistido, um por um.</li></ul>' +
        '<div class="campo"><label>Número do WhatsApp da empresa (opcional)</label><input class="inp" id="l-num" value="' + esc(CFGA.WA_NUMERO) + '" placeholder="5511999999999"></div>';
      pe = '<button class="btn" data-fechar>Fechar</button><button class="btn pri" id="l-salvar" data-carregando=" Salvando...">Usar modo link</button>';
    } else if (id === 'entrada') {
      var ex = urlEnt + '&origem=Site&tags=Lead%20site';
      corpo = '<p style="margin-top:0">Toda ferramenta que envia <b>webhook</b> (POST com JSON ou formulário) pode criar contatos aqui. O sistema reconhece sozinho os campos de nome, e-mail, telefone, empresa e cidade, mesmo com nomes diferentes (name, phone, whatsapp, celular...).</p>' +
        '<span class="rot">Sua URL de webhook</span>' + C.copiavel(urlEnt) +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Parâmetros opcionais (coloque no fim da URL)</h3><ul class="small" style="margin-top:0;padding-left:18px">' +
        '<li><b>&amp;origem=Site</b> registra a origem do lead (e pode filtrar automações)</li><li><b>&amp;tags=Lead%20site,Promo</b> adiciona tags</li>' +
        '<li><b>&amp;automacao=ID</b> inicia uma automação específica</li><li><b>&amp;etapa=ID</b> cria o negócio já numa etapa do funil</li></ul>' +
        '<span class="rot">Exemplo completo</span>' + C.copiavel(ex) +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">IDs úteis</h3><div class="grade2 small"><div><b>Automações</b>' + S.automacoes.map(function (a) { return '<div class="trunc">' + esc(a.nome) + ': <code>' + a.id + '</code></div>'; }).join('') + '</div><div><b>Etapas</b>' + S.funis.map(function (f) { return f.etapas.map(function (e) { return '<div class="trunc">' + esc(f.nome + ' > ' + e.nome) + ': <code>' + e.id + '</code></div>'; }).join(''); }).join('') + '</div></div>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Onde colar em cada ferramenta</h3><ol class="passos-tut">' +
        '<li><b>Elementor (WordPress)</b>No formulário: Ações após envio > Webhook. Cole a URL. Marque "Avançado" para mandar os campos com nome.</li>' +
        '<li><b>Typebot</b>Adicione o bloco HTTP request (POST) no fim do fluxo, com corpo JSON contendo nome, telefone e email.</li>' +
        '<li><b>Hotmart / Kiwify / Eduzz</b>Em Ferramentas > Webhooks (Postback), cole a URL com &amp;origem=Hotmart e as tags que quiser, como Comprador.</li>' +
        '<li><b>RD Station / ActiveCampaign</b>Na automação, use a ação Enviar webhook (ou Integração por webhook) com a URL.</li>' +
        '<li><b>Anúncios de cadastro do Facebook/Instagram</b>Use Make ou Zapier: gatilho "New Lead (Facebook Lead Ads)" e ação "HTTP / Webhook POST" para a URL.</li>' +
        '<li><b>Google Forms</b>Use o script pronto em docs/INTEGRACOES.md (copiar e colar no editor de script do formulário).</li></ol>' +
        '<h3 style="font-size:14.5px;margin:18px 0 8px">Testar agora</h3><textarea class="inp" id="t-json" rows="4">{"nome": "Teste Webhook", "email": "teste@exemplo.com", "telefone": "11999998888"}</textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn" id="t-env" data-carregando=" Enviando...">' + ic('play') + ' Enviar teste</button>' +
        '<button class="btn perigo" id="t-chave">' + ic('atualizar') + ' Gerar nova chave</button></div>';
    } else if (id === 'form') {
      var codigo = codigoFormulario();
      corpo = '<p style="margin-top:0">Cole este código no seu site (Elementor: widget HTML; WordPress: bloco HTML personalizado; Wix: Incorporar código). O visual usa as cores do sistema e você pode trocar os textos à vontade.</p>' +
        '<div class="grade2"><div class="campo"><label>Origem</label><input class="inp" id="f-origem" value="Site"></div><div class="campo"><label>Tags</label><input class="inp" id="f-tags" value="Lead site"></div>' +
        '<div class="campo"><label>Iniciar automação</label><select class="inp" id="f-auto"><option value="">Nenhuma</option>' + S.automacoes.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nome) + '</option>'; }).join('') + '</select></div>' +
        '<div class="campo"><label>Mensagem de sucesso</label><input class="inp" id="f-ok" value="Recebemos seus dados. Em instantes falamos com você no WhatsApp."></div></div>' +
        '<span class="rot">Código</span><textarea class="inp" id="f-cod" rows="9" readonly style="font-family:ui-monospace,Consolas,monospace;font-size:12px">' + esc(codigo) + '</textarea>' +
        '<button class="btn" id="f-copia" style="margin-top:8px">' + ic('copiar') + ' Copiar código</button>';
    } else if (id === 'saida') {
      var lista = C.json(CFGA.WEBHOOKS_SAIDA, []);
      corpo = '<p style="margin-top:0">Cadastre URLs que recebem um POST em JSON quando algo acontece. No n8n use o nó Webhook; no Make, o módulo Custom webhook; no Zapier, "Catch Hook".</p><div id="s-lista"></div><button class="btn peq" id="s-add">' + ic('plus') + ' Adicionar URL</button>' +
        '<h3 style="font-size:14px;margin:18px 0 6px">Exemplo do que chega</h3><code class="bloco">{\n  "evento": "contato.criado",\n  "sistema": "' + esc((S.config.marca || {}).nome) + '",\n  "data": "2026-10-27T14:30:00",\n  "dados": { "contato": { "nome": "...", "telefone": "...", "tags": [] } }\n}</code>';
      pe = '<button class="btn" data-fechar>Fechar</button><button class="btn pri" id="s-salvar" data-carregando=" Salvando...">Salvar</button>';
      var EVS = [['contato.criado', 'Contato criado'], ['mensagem.recebida', 'Mensagem recebida'], ['negocio.ganho', 'Negócio ganho'], ['negocio.perdido', 'Negócio perdido']];
      var el0;
      setTimeout(function () {
        el0 = C.$('#s-lista');
        var pinta = function () {
          el0.innerHTML = lista.map(function (w, k) {
            return '<div class="card" style="padding:12px;margin-bottom:10px"><div class="linha" style="align-items:center"><input class="inp" data-su="' + k + '" value="' + esc(w.url || '') + '" placeholder="https://..."><button class="btn fantasma ic perigo" data-sd="' + k + '" style="flex:0 0 38px" aria-label="Remover">' + ic('lixo') + '</button></div>' +
              '<div style="margin-top:8px">' + EVS.map(function (ev) { return '<label class="check" style="display:inline-flex;margin:0 14px 0 0"><input type="checkbox" data-se="' + k + '" value="' + ev[0] + '"' + (!w.eventos || !w.eventos.length || w.eventos.indexOf(ev[0]) >= 0 ? ' checked' : '') + '> ' + ev[1] + '</label>'; }).join('') + '</div></div>';
          }).join('') || '<p class="muted">Nenhuma URL cadastrada.</p>';
          C.$$('[data-su]', el0).forEach(function (x) { x.oninput = function () { lista[x.dataset.su].url = x.value.trim(); }; });
          C.$$('[data-sd]', el0).forEach(function (x) { x.onclick = function () { lista.splice(Number(x.dataset.sd), 1); pinta(); }; });
          C.$$('[data-se]', el0).forEach(function (x) { x.onchange = function () { var k = x.dataset.se; lista[k].eventos = C.$$('[data-se="' + k + '"]', el0).filter(function (y) { return y.checked; }).map(function (y) { return y.value; }); }; });
        };
        pinta();
        C.$('#s-add').onclick = function () { lista.push({ url: '', eventos: [] }); pinta(); };
        C.$('#s-salvar').onclick = function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WEBHOOKS_SAIDA: JSON.stringify(lista.filter(function (w) { return w.url; })) }).then(function () { C.toast('Webhooks salvos', 'ok'); }); }); };
      }, 0);
    } else if (id === 'planilha') {
      corpo = '<p style="margin-top:0">O sistema guarda tudo numa planilha do Google Planilhas na conta de quem instalou. Cada aba é uma tabela: Contatos, Negocios, Mensagens, Automacoes, Campanhas e assim por diante.</p><ul><li>Para fazer backup: Arquivo > Fazer uma cópia (ou Fazer download em Excel).</li><li>Evite apagar colunas ou mudar o nome das abas.</li><li>Pode criar abas novas com gráficos e fórmulas à vontade.</li></ul>' +
        (CFGA.URL_PLANILHA ? '<a class="btn pri" href="' + esc(CFGA.URL_PLANILHA) + '" target="_blank" rel="noopener">' + ic('externo') + ' Abrir minha planilha</a>' : '<p class="muted">No modo demonstração não existe planilha.</p>');
    }
    var el = C.modal({ titulo: i.nome, tamanho: 'xl', corpo: corpo, pe: pe });
    var on = function (sel, fn) { var x = el.querySelector(sel); if (x) x.onclick = fn; };
    var mostrarQr = function (box, r) {
      box.innerHTML = r.conectado ? '<div class="aviso ok">' + ic('check') + '<div>' + esc(r.texto || 'Conectado') + '</div></div>' :
        r.qr ? '<div class="qr"><img src="' + esc(r.qr.indexOf('data:') === 0 ? r.qr : 'data:image/png;base64,' + r.qr) + '" alt="QR Code"></div><p class="small muted" style="text-align:center">Leia com o WhatsApp do celular. O código expira em cerca de 40 segundos; clique em Conectar de novo se precisar.</p>' :
          r.codigo ? '<div class="aviso info">' + ic('info') + '<div>Código de pareamento: <b style="font-size:18px;letter-spacing:2px">' + esc(r.codigo) + '</b></div></div>' : '<div class="aviso">' + ic('alerta') + '<div>' + esc(r.texto || 'Não recebi o QR Code. Confira a URL e a chave.') + '</div></div>';
      if (!r.conectado) setTimeout(function () { if (box.isConnected) C.api('wa.status').then(function (s) { S.waStatus = s; if (s.conectado) { box.innerHTML = '<div class="aviso ok">' + ic('check') + '<div>WhatsApp conectado!</div></div>'; C.atualizarWa(); } }); }, 20000);
    };
    on('#e-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'evolution', EVOLUTION_URL: el.querySelector('#e-url').value.trim(), EVOLUTION_APIKEY: el.querySelector('#e-key').value.trim(), EVOLUTION_INSTANCIA: el.querySelector('#e-inst').value.trim().replace(/\s+/g, '-') }).then(function () { C.toast('Evolution salva. Agora clique em Conectar.', 'ok'); }); }); });
    on('#e-con', function () { var b = this; C.comBotao(b, function () { return C.api('wa.conectar').then(function (r) { mostrarQr(el.querySelector('#e-qr'), r); }); }); });
    on('#w-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'waha', WAHA_URL: el.querySelector('#w-url').value.trim(), WAHA_APIKEY: el.querySelector('#w-key').value.trim(), WAHA_SESSAO: el.querySelector('#w-ses').value.trim() || 'default' }).then(function () { C.toast('WAHA salvo. Agora clique em Conectar.', 'ok'); }); }); });
    on('#w-con', function () { var b = this; C.comBotao(b, function () { return C.api('wa.conectar').then(function (r) { mostrarQr(el.querySelector('#w-qr'), r); }); }); });
    on('#m-salvar', function () { var b = this; C.comBotao(b, function () { var v = el.querySelector('#m-verify').value.trim(); if (v.length < 8) throw new Error('Invente um token de verificação com pelo menos 8 caracteres.'); return salvarCfg({ WA_PROVEDOR: 'meta', META_TOKEN: el.querySelector('#m-token').value.trim(), META_PHONE_ID: el.querySelector('#m-phone').value.trim(), META_VERIFY: v }).then(function () { C.toast('API oficial salva', 'ok'); }); }); });
    on('#l-salvar', function () { var b = this; C.comBotao(b, function () { return salvarCfg({ WA_PROVEDOR: 'link', WA_NUMERO: el.querySelector('#l-num').value.replace(/\D/g, '') }).then(function () { C.toast('Modo link ativado', 'ok'); el.fechar(); C.render(); }); }); });
    on('#wt-env', function () { var b = this; C.comBotao(b, function () { return C.api('wa.testar', { telefone: el.querySelector('#wt-num').value }).then(function () { C.toast('Mensagem de teste enviada', 'ok'); }); }); });
    on('#t-env', function () { var b = this; C.comBotao(b, function () { return C.api('webhook.testar', { json: el.querySelector('#t-json').value }).then(function (r) { C.toast('Funcionou: contato ' + (r.novo ? 'criado' : 'atualizado'), 'ok'); C.recarregar(); }); }); });
    on('#t-chave', function () {
      C.confirmar('Gerar uma nova chave? <b>A URL dos formulários e webhooks de captação muda</b> e você precisa colar a nova em cada ferramenta e atualizar o código do formulário pronto. O WhatsApp não é afetado.', { perigo: true, botao: 'Gerar nova chave' }).then(function (ok) {
        if (!ok) return;
        return C.api('config.chave', { qual: 'entrada' }).then(function (c) { CFGA = c; el.fechar(); abrirIntegracao('entrada'); C.toast('Nova chave gerada', 'ok'); });
      }).catch(function (e) { C.toast(e.message, 'erro'); });
    });
    if (id === 'form') {
      var atual = function () { el.querySelector('#f-cod').value = codigoFormulario(el.querySelector('#f-origem').value, el.querySelector('#f-tags').value, el.querySelector('#f-auto').value, el.querySelector('#f-ok').value); };
      ['#f-origem', '#f-tags', '#f-auto', '#f-ok'].forEach(function (s) { el.querySelector(s).addEventListener('input', atual); el.querySelector(s).addEventListener('change', atual); });
      atual();
      on('#f-copia', function () { C.copiar(el.querySelector('#f-cod').value); });
    }
  }
  function blocoTeste() {
    return '<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--borda)"><span class="rot">Enviar mensagem de teste</span><div class="linha" style="margin-top:6px"><input class="inp" id="wt-num" placeholder="Seu WhatsApp com DDD"><button class="btn" id="wt-env" style="flex:0 0 auto" data-carregando=" Enviando...">' + ic('enviar') + ' Testar</button></div></div>';
  }
  function codigoFormulario(origem, tags, auto, ok) {
    var m = S.config.marca || {};
    var chave = (String(CFGA.URL_WEBHOOK_ENTRADA).match(/k=([^&]+)/) || [])[1] || '';
    var api = CFGA.URL_APP || 'URL_DO_SEU_APPS_SCRIPT';
    return '<form id="prumo-form" style="max-width:420px;font-family:system-ui,sans-serif;display:grid;gap:10px">\n' +
      '  <input name="nome" placeholder="Seu nome" required style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <input name="telefone" placeholder="WhatsApp com DDD" required style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <input name="email" type="email" placeholder="Seu e-mail" style="padding:12px;border:1px solid #ccc;border-radius:8px">\n' +
      '  <button style="padding:14px;border:0;border-radius:8px;background:' + (m.cor || '#1F6FEB') + ';color:#fff;font-weight:700;cursor:pointer">Quero ser atendido</button>\n' +
      '  <p id="prumo-ok" style="display:none;color:#15803D">' + esc(ok || 'Recebemos seus dados.') + '</p>\n</form>\n<script>\n' +
      'document.getElementById("prumo-form").addEventListener("submit", function (e) {\n  e.preventDefault();\n  var f = e.target, b = f.querySelector("button");\n  b.disabled = true; b.textContent = "Enviando...";\n' +
      '  fetch("' + api + '", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({\n    action: "publico.form", k: "' + chave + '", origem: ' + JSON.stringify(origem || 'Site') + ', tags: ' + JSON.stringify(tags || '') + ', automacao: ' + JSON.stringify(auto || '') + ',\n    nome: f.nome.value, telefone: f.telefone.value, email: f.email.value\n  }) }).then(function () {\n' +
      '    f.querySelectorAll("input,button").forEach(function (x) { x.style.display = "none"; });\n    document.getElementById("prumo-ok").style.display = "block";\n  }).catch(function () { b.disabled = false; b.textContent = "Tentar de novo"; });\n});\n</' + 'script>';
  }

  /* ================================================================ AJUSTES */
  var abaAj = 'marca';
  C.views.ajustes = {
    titulo: 'Ajustes',
    render: function (el) {
      var abas = [['marca', 'Marca e cores'], ['funis', 'Funis'], ['campos', 'Campos e listas'], ['modelos', 'Respostas rápidas'], ['regras', 'Regras de envio'], ['equipe', 'Equipe'], ['sistema', 'Sistema']];
      el.innerHTML = '<div class="abas">' + abas.map(function (a) { return '<button data-aj="' + a[0] + '" class="' + (abaAj === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') + '</div><div id="aj"><div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div></div>';
      C.$$('[data-aj]', el).forEach(function (b) { b.onclick = function () { abaAj = b.dataset.aj; C.render(); }; });
      carregarCfg().then(function () { ({ marca: ajMarca, funis: ajFunis, campos: ajCampos, modelos: ajModelos, regras: ajRegras, equipe: ajEquipe, sistema: ajSistema })[abaAj](C.$('#aj')); }).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  function botaoSalvar(id) { return '<button class="btn pri" id="' + id + '" data-carregando=" Salvando...">Salvar alterações</button>'; }

  function ajMarca(box) {
    var d = { NOME: CFGA.NOME, SLOGAN: CFGA.SLOGAN, COR_PRIMARIA: CFGA.COR_PRIMARIA, COR_DESTAQUE: CFGA.COR_DESTAQUE, LOGO_URL: CFGA.LOGO_URL };
    var cores = ['#1F6FEB', '#0F766E', '#16A34A', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#0EA5E9', '#334155', '#9A3412'];
    var pinta = function () {
      box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad">' +
        '<div class="campo"><label>Nome do sistema</label><input class="inp" id="mk-nome" maxlength="40" value="' + esc(d.NOME) + '"></div>' +
        '<div class="campo"><label>Frase curta</label><input class="inp" id="mk-slogan" maxlength="60" value="' + esc(d.SLOGAN) + '"></div>' +
        '<div class="campo"><label>Logo</label><div style="display:flex;gap:10px;align-items:center">' + C.logoHtml({ nome: d.NOME, logo: d.LOGO_URL }).replace('marca-logo', 'marca-logo" style="width:48px;height:48px;border-radius:12px') + '<input type="file" class="inp" id="mk-logo" accept="image/*">' + (d.LOGO_URL ? '<button class="btn peq" id="mk-tira">Remover</button>' : '') + '</div></div>' +
        '<div class="campo"><label>Cor principal</label><div class="cores-prontas">' + cores.map(function (c) { return '<button type="button" data-cor="' + c + '" style="background:' + c + '" class="' + (c.toLowerCase() === String(d.COR_PRIMARIA).toLowerCase() ? 'on' : '') + '" aria-label="' + c + '"></button>'; }).join('') + '<input type="color" class="inp-cor" id="mk-cor" value="' + esc(d.COR_PRIMARIA) + '"></div></div>' +
        '<div class="campo"><label>Cor de destaque</label><input type="color" class="inp-cor" id="mk-acc" value="' + esc(d.COR_DESTAQUE) + '"></div>' +
        botaoSalvar('mk-ok') + '</div><div><span class="rot">Prévia ao vivo</span><div class="previa-marca" style="margin-top:6px"><div class="ps"><i class="on"></i><i></i><i></i><i></i></div><div class="pc"><div class="card" style="padding:10px"><b style="font-size:12px">Vendido no mês</b><div style="font-size:20px;font-weight:800">R$ 18,4 mil</div></div><div style="display:flex;gap:6px"><span class="btn pri peq">Principal</span><span class="btn acc peq">Destaque</span></div></div></div>' +
        '<p class="small muted">As cores são aplicadas para toda a equipe assim que você salvar.</p></div></div>';
      var ler = function () { d.NOME = box.querySelector('#mk-nome').value.trim(); d.SLOGAN = box.querySelector('#mk-slogan').value.trim(); d.COR_DESTAQUE = box.querySelector('#mk-acc').value; };
      var previa = function () { C.aplicarMarca({ nome: d.NOME, slogan: d.SLOGAN, cor: d.COR_PRIMARIA, destaque: d.COR_DESTAQUE, logo: d.LOGO_URL }); };
      C.$$('[data-cor]', box).forEach(function (b) { b.onclick = function () { ler(); d.COR_PRIMARIA = b.dataset.cor; previa(); pinta(); }; });
      box.querySelector('#mk-cor').onchange = function () { ler(); d.COR_PRIMARIA = this.value; previa(); pinta(); };
      box.querySelector('#mk-acc').onchange = function () { ler(); previa(); };
      box.querySelector('#mk-logo').onchange = function () { ler(); C.reduzirImagem(this.files[0], 160).then(function (u) { d.LOGO_URL = u; previa(); pinta(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
      if (box.querySelector('#mk-tira')) box.querySelector('#mk-tira').onclick = function () { ler(); d.LOGO_URL = ''; previa(); pinta(); };
      box.querySelector('#mk-ok').onclick = function () {
        ler();
        var b = this;
        C.comBotao(b, function () {
          if (!d.NOME) throw new Error('Dê um nome ao sistema.');
          return salvarCfg(d).then(function () { S.config.marca = { nome: d.NOME, slogan: d.SLOGAN, cor: d.COR_PRIMARIA, destaque: d.COR_DESTAQUE, logo: d.LOGO_URL, configurado: true }; C.aplicarMarca(S.config.marca); C.renderNav(); C.toast('Marca salva', 'ok'); });
        });
      };
    };
    pinta();
  }

  function ajFunis(box) {
    box.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Crie quantos funis precisar (ex.: Vendas, Pós-venda, Parcerias). Etapas do tipo Ganho e Perdido fecham o negócio.</p><div class="dir"><button class="btn pri" id="fu-novo">' + ic('plus') + ' Novo funil</button></div></div>' +
      S.funis.map(function (f) { return '<div class="card item-card" style="margin-bottom:10px"><div class="meio"><h3>' + esc(f.nome) + '</h3><div class="chips" style="margin-top:6px">' + f.etapas.map(function (e) { return '<span class="chip"><span style="width:8px;height:8px;border-radius:50%;background:' + esc(e.cor) + '"></span>' + esc(e.nome) + (e.tipo !== 'aberto' ? ' (' + e.tipo + ')' : '') + '</span>'; }).join('') + '</div></div><button class="btn peq" data-fu="' + f.id + '">' + ic('lapis') + ' Editar</button></div>'; }).join('');
    C.$('#fu-novo').onclick = function () { formFunil({ nome: '', etapas: [{ nome: 'Novo', cor: '#3B82F6', tipo: 'aberto' }, { nome: 'Ganho', cor: '#16A34A', tipo: 'ganho' }, { nome: 'Perdido', cor: '#DC2626', tipo: 'perdido' }] }); };
    C.$$('[data-fu]', box).forEach(function (b) { b.onclick = function () { formFunil(JSON.parse(JSON.stringify(C.funil(b.dataset.fu)))); }; });
  }
  function formFunil(f) {
    var el = C.modal({
      titulo: f.id ? 'Editar funil' : 'Novo funil', tamanho: 'largo',
      corpo: '<div class="campo"><label>Nome do funil</label><input class="inp" id="ff-nome" value="' + esc(f.nome) + '"></div><span class="rot">Etapas (na ordem)</span><div id="ff-et" style="margin-top:8px"></div><button class="btn peq" id="ff-add">' + ic('plus') + ' Adicionar etapa</button>',
      pe: (f.id ? '<button class="btn perigo esq" id="ff-exc">' + ic('lixo') + ' Excluir funil</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ff-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    var pinta = function () {
      el.querySelector('#ff-et').innerHTML = f.etapas.map(function (e, i) {
        return '<div class="linha" style="margin-bottom:8px;align-items:center"><input type="color" class="inp-cor" data-ec="' + i + '" value="' + esc(e.cor || '#64748B') + '" style="flex:0 0 46px"><input class="inp" data-en="' + i + '" value="' + esc(e.nome) + '"><select class="inp" data-et="' + i + '" style="flex:0 0 130px">' + [['aberto', 'Em andamento'], ['ganho', 'Ganho'], ['perdido', 'Perdido']].map(function (t) { return '<option value="' + t[0] + '"' + ((e.tipo || 'aberto') === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
          '<button class="btn fantasma ic peq" data-eu="' + i + '" style="flex:0 0 30px" aria-label="Subir">' + ic('cima') + '</button><button class="btn fantasma ic peq perigo" data-ed="' + i + '" style="flex:0 0 30px" aria-label="Remover">' + ic('x') + '</button></div>';
      }).join('');
      C.$$('[data-en]', el).forEach(function (x) { x.oninput = function () { f.etapas[x.dataset.en].nome = x.value; }; });
      C.$$('[data-ec]', el).forEach(function (x) { x.onchange = function () { f.etapas[x.dataset.ec].cor = x.value; }; });
      C.$$('[data-et]', el).forEach(function (x) { x.onchange = function () { f.etapas[x.dataset.et].tipo = x.value; }; });
      C.$$('[data-ed]', el).forEach(function (x) { x.onclick = function () { f.etapas.splice(Number(x.dataset.ed), 1); pinta(); }; });
      C.$$('[data-eu]', el).forEach(function (x) { x.onclick = function () { var i = Number(x.dataset.eu); if (!i) return; var t = f.etapas.splice(i, 1)[0]; f.etapas.splice(i - 1, 0, t); pinta(); }; });
    };
    pinta();
    el.querySelector('#ff-add').onclick = function () { var i = f.etapas.findIndex(function (e) { return e.tipo !== 'aberto'; }); f.etapas.splice(i < 0 ? f.etapas.length : i, 0, { nome: 'Nova etapa', cor: '#8B5CF6', tipo: 'aberto' }); pinta(); };
    el.querySelector('#ff-ok').onclick = function () {
      f.nome = el.querySelector('#ff-nome').value;
      C.comBotao(this, function () { return C.api('funil.salvar', { funil: f }).then(function (r) { S.funis = r; el.fechar(); C.toast('Funil salvo', 'ok'); C.render(); }); });
    };
    var ex = el.querySelector('#ff-exc');
    if (ex) ex.onclick = function () {
      C.confirmar('Excluir o funil <b>' + esc(f.nome) + '</b>?', { perigo: true, botao: 'Excluir' }).then(function (ok) { if (ok) return C.api('funil.excluir', { id: f.id }).then(function (r) { S.funis = r; el.fechar(); C.render(); }); }).catch(function (e) { C.toast(e.message, 'erro'); });
    };
  }

  function ajCampos(box) {
    var campos = C.json(CFGA.CAMPOS_PERSONALIZADOS, []);
    var pinta = function () {
      box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:4px">Campos personalizados</h3><p class="small muted" style="margin-top:0">Informações extras do contato (ex.: data de aniversário, plano, CPF). Use nas mensagens com {chave}.</p><div id="cp-l"></div><button class="btn peq" id="cp-add">' + ic('plus') + ' Adicionar campo</button></div>' +
        '<div class="card card-pad"><div class="campo"><label>Tags sugeridas</label><textarea class="inp" id="ls-tags" rows="3">' + esc(CFGA.TAGS) + '</textarea><span class="ajuda">Separadas por vírgula. Novas tags também podem ser criadas na hora.</span></div>' +
        '<div class="campo"><label>Origens dos contatos</label><textarea class="inp" id="ls-orig" rows="2">' + esc(CFGA.ORIGENS) + '</textarea></div>' +
        '<div class="campo"><label>Motivos de perda</label><textarea class="inp" id="ls-mot" rows="3">' + esc(CFGA.MOTIVOS_PERDA) + '</textarea></div></div></div><div style="margin-top:14px">' + botaoSalvar('cp-ok') + '</div>';
      box.querySelector('#cp-l').innerHTML = campos.map(function (c, i) {
        return '<div class="linha" style="margin-bottom:8px;align-items:center"><input class="inp" data-cr="' + i + '" placeholder="Rótulo" value="' + esc(c.rotulo) + '"><input class="inp" data-ck="' + i + '" placeholder="chave" value="' + esc(c.chave) + '" style="flex:0 0 120px"><select class="inp" data-ct="' + i + '" style="flex:0 0 100px">' + [['texto', 'Texto'], ['numero', 'Número'], ['data', 'Data']].map(function (t) { return '<option value="' + t[0] + '"' + (c.tipo === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><button class="btn fantasma ic peq perigo" data-cd="' + i + '" style="flex:0 0 30px" aria-label="Remover">' + ic('x') + '</button></div>';
      }).join('') || '<p class="small muted">Nenhum campo.</p>';
      C.$$('[data-cr]', box).forEach(function (x) { x.oninput = function () { var c = campos[x.dataset.cr]; var autoKey = !c.chave || c.chave === slug(c.rotulo); c.rotulo = x.value; if (autoKey) { c.chave = slug(x.value); box.querySelector('[data-ck="' + x.dataset.cr + '"]').value = c.chave; } }; });
      C.$$('[data-ck]', box).forEach(function (x) { x.oninput = function () { campos[x.dataset.ck].chave = slug(x.value); }; });
      C.$$('[data-ct]', box).forEach(function (x) { x.onchange = function () { campos[x.dataset.ct].tipo = x.value; }; });
      C.$$('[data-cd]', box).forEach(function (x) { x.onclick = function () { campos.splice(Number(x.dataset.cd), 1); pinta(); }; });
      box.querySelector('#cp-add').onclick = function () { campos.push({ rotulo: '', chave: '', tipo: 'texto' }); pinta(); };
      box.querySelector('#cp-ok').onclick = function () {
        var b = this;
        C.comBotao(b, function () {
          var limpos = campos.filter(function (c) { return c.rotulo && c.chave; });
          return salvarCfg({ CAMPOS_PERSONALIZADOS: JSON.stringify(limpos), TAGS: box.querySelector('#ls-tags').value, ORIGENS: box.querySelector('#ls-orig').value, MOTIVOS_PERDA: box.querySelector('#ls-mot').value })
            .then(function () { return C.recarregar(); }).then(function () { C.toast('Salvo', 'ok'); });
        });
      };
    };
    pinta();
  }
  function slug(s) { return C.norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30); }

  function ajModelos(box) {
    box.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Na conversa, digite <b>/</b> e o atalho para usar uma resposta pronta.</p><div class="dir"><button class="btn pri" id="md-novo">' + ic('plus') + ' Nova resposta</button></div></div>' +
      '<div class="card">' + (S.modelos.length ? S.modelos.map(function (m) { return '<div style="display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--borda);cursor:pointer" data-md="' + m.id + '"><span class="chip">/' + esc(m.atalho || '—') + '</span><div class="trunc" style="flex:1"><b>' + esc(m.titulo) + '</b><div class="small muted trunc">' + esc(m.texto) + '</div></div>' + ic('dir') + '</div>'; }).join('') : '<div class="vazio">Nenhuma resposta rápida.</div>') + '</div>';
    C.$('#md-novo').onclick = function () { formModelo({}); };
    C.$$('[data-md]', box).forEach(function (b) { b.onclick = function () { formModelo(S.modelos.filter(function (m) { return m.id === b.dataset.md; })[0]); }; });
  }
  function formModelo(m) {
    var el = C.modal({
      titulo: m.id ? 'Editar resposta rápida' : 'Nova resposta rápida',
      corpo: '<div class="grade2"><div class="campo"><label>Título</label><input class="inp" id="mo-tit" value="' + esc(m.titulo || '') + '"></div><div class="campo"><label>Atalho (sem espaço)</label><input class="inp" id="mo-at" value="' + esc(m.atalho || '') + '" placeholder="preco"></div></div>' +
        '<div class="campo"><label>Texto</label><textarea class="inp" id="mo-txt" rows="5">' + esc(m.texto || '') + '</textarea><span class="ajuda">Pode usar {primeiro_nome}, {atendente}, {saudacao}...</span></div>' +
        '<div class="grade2"><div class="campo"><label>Mídia (opcional)</label><select class="inp" id="mo-mt">' + [['', 'Nenhuma'], ['image', 'Imagem'], ['document', 'Documento'], ['video', 'Vídeo'], ['audio', 'Áudio']].map(function (o) { return '<option value="' + o[0] + '"' + ((m.midia_tipo || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div><div class="campo"><label>Link da mídia</label><input class="inp" id="mo-mu" value="' + esc(m.midia_url || '') + '"></div></div>',
      pe: (m.id ? '<button class="btn perigo esq" id="mo-exc">' + ic('lixo') + '</button>' : '') + '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="mo-ok" data-carregando=" Salvando...">Salvar</button>'
    });
    el.querySelector('#mo-ok').onclick = function () {
      C.comBotao(this, function () {
        return C.api('modelo.salvar', { modelo: { id: m.id, titulo: el.querySelector('#mo-tit').value, atalho: el.querySelector('#mo-at').value, texto: el.querySelector('#mo-txt').value, midia_tipo: el.querySelector('#mo-mt').value, midia_url: C.driveDireto(el.querySelector('#mo-mu').value.trim()) } }).then(function (r) {
          var i = S.modelos.findIndex(function (x) { return x.id === r.id; });
          if (i >= 0) S.modelos[i] = r; else S.modelos.push(r);
          el.fechar(); C.render();
        });
      });
    };
    var ex = el.querySelector('#mo-exc');
    if (ex) ex.onclick = function () { C.api('modelo.excluir', { id: m.id }).then(function () { S.modelos = S.modelos.filter(function (x) { return x.id !== m.id; }); el.fechar(); C.render(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
  }

  function ajRegras(box) {
    var dias = C.tags(CFGA.DIAS_ENVIO.replace(/\s/g, ''));
    var nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:12px">Horário dos disparos</h3>' +
      '<div class="grade2"><div class="campo"><label>Começa às</label><input class="inp" type="time" id="rg-ini" value="' + esc(CFGA.HORARIO_INICIO) + '"></div><div class="campo"><label>Para às</label><input class="inp" type="time" id="rg-fim" value="' + esc(CFGA.HORARIO_FIM) + '"></div></div>' +
      '<div class="campo"><label>Dias</label><div class="chips">' + nomes.map(function (n, i) { return '<label class="chip" style="cursor:pointer"><input type="checkbox" data-dia="' + i + '"' + (dias.indexOf(String(i)) >= 0 ? ' checked' : '') + ' style="accent-color:var(--pri)"> ' + n + '</label>'; }).join('') + '</div></div>' +
      '<p class="small muted">Fora deste horário as mensagens de disparo ficam na fila e saem no próximo horário permitido. Respostas de robôs e mensagens manuais não são afetadas.</p></div>' +
      '<div class="card card-pad"><h3 style="font-size:15px;margin-bottom:12px">Atendimento</h3>' +
      '<div class="campo"><label>Quando um atendente responde, pausar o robô por (horas)</label><input class="inp" type="number" min="0" id="rg-pausa" value="' + esc(CFGA.BOT_PAUSA_HORAS) + '"></div>' +
      '<label class="check"><input type="checkbox" id="rg-dist"' + (CFGA.DISTRIBUIR_AUTO === 'SIM' ? ' checked' : '') + '> Distribuir novos contatos em rodízio entre quem "recebe leads"</label>' +
      '<label class="check"><input type="checkbox" id="rg-vertodos"' + (CFGA.ATENDENTE_VE_TODOS === 'SIM' ? ' checked' : '') + '> Atendentes veem todos os contatos (desmarcado: só os seus e os sem responsável)</label>' +
      '<div class="campo"><label>Palavras para sair da lista</label><input class="inp" id="rg-out" value="' + esc(CFGA.OPTOUT_PALAVRAS) + '"></div>' +
      '<div class="campo"><label>Resposta para quem pede para sair</label><textarea class="inp" id="rg-outr" rows="2">' + esc(CFGA.OPTOUT_RESPOSTA) + '</textarea></div></div></div><div style="margin-top:14px">' + botaoSalvar('rg-ok') + '</div>';
    C.$('#rg-ok').onclick = function () {
      var b = this;
      C.comBotao(b, function () {
        return salvarCfg({
          HORARIO_INICIO: C.$('#rg-ini').value, HORARIO_FIM: C.$('#rg-fim').value, DIAS_ENVIO: C.$$('[data-dia]').filter(function (x) { return x.checked; }).map(function (x) { return x.dataset.dia; }).join(','),
          BOT_PAUSA_HORAS: C.$('#rg-pausa').value, DISTRIBUIR_AUTO: C.$('#rg-dist').checked ? 'SIM' : 'NAO', ATENDENTE_VE_TODOS: C.$('#rg-vertodos').checked ? 'SIM' : 'NAO',
          OPTOUT_PALAVRAS: C.$('#rg-out').value, OPTOUT_RESPOSTA: C.$('#rg-outr').value
        }).then(function () { C.toast('Regras salvas', 'ok'); });
      });
    };
  }

  function ajEquipe(box) {
    var PERF = { admin: 'Administrador (tudo)', gestor: 'Gestor (tudo menos ajustes, equipe e integrações)', atendente: 'Atendente (conversas e seus contatos)' };
    box.innerHTML = '<div class="barra-ferr"><p class="muted" style="margin:0">Sem limite de usuários. Cada pessoa tem login próprio.</p><div class="dir"><button class="btn pri" id="eq-novo">' + ic('usuarioMais') + ' Adicionar pessoa</button></div></div>' +
      '<div class="card"><div class="tabela-wrap"><table class="tab"><thead><tr><th>Pessoa</th><th>Perfil</th><th class="esconde-mob">Recebe leads</th><th class="esconde-mob">Último acesso</th><th>Situação</th></tr></thead><tbody>' +
      S.usuarios.map(function (u) { return '<tr data-u="' + u.id + '"><td><div class="pessoa">' + C.av(u.nome, '', u.cor) + '<div class="trunc"><b>' + esc(u.nome) + '</b><span class="small muted">' + esc(u.email) + '</span></div></div></td><td>' + esc((PERF[u.perfil] || u.perfil).split(' (')[0]) + '</td><td class="esconde-mob">' + (u.recebe_leads === 'SIM' ? 'Sim' : 'Não') + '</td><td class="esconde-mob small muted">' + (u.ultimo_acesso ? C.fmtData(u.ultimo_acesso) : 'nunca') + '</td><td><span class="status ' + (u.ativo === 'SIM' ? 'st-on' : 'st-off') + '">' + (u.ativo === 'SIM' ? 'Ativo' : 'Bloqueado') + '</span></td></tr>'; }).join('') + '</tbody></table></div></div>';
    var form = function (u) {
      u = u || {};
      var el = C.modal({
        titulo: u.id ? 'Editar pessoa' : 'Adicionar pessoa',
        corpo: '<div class="campo"><label>Nome</label><input class="inp" id="u-nome" value="' + esc(u.nome || '') + '"></div><div class="campo"><label>E-mail (login)</label><input class="inp" type="email" id="u-email" value="' + esc(u.email || '') + '"></div>' +
          '<div class="campo"><label>Perfil</label><select class="inp" id="u-perfil">' + Object.keys(PERF).map(function (k) { return '<option value="' + k + '"' + ((u.perfil || 'atendente') === k ? ' selected' : '') + '>' + PERF[k] + '</option>'; }).join('') + '</select></div>' +
          '<div class="campo"><label>' + (u.id ? 'Nova senha (deixe em branco para manter)' : 'Senha inicial (mínimo 8 caracteres)') + '</label><input class="inp" type="text" id="u-senha" autocomplete="new-password"></div>' +
          '<div class="grade2"><label class="check"><input type="checkbox" id="u-recebe"' + (u.recebe_leads === 'SIM' ? ' checked' : '') + '> Recebe leads no rodízio</label><label class="check"><input type="checkbox" id="u-ativo"' + (u.ativo !== 'NAO' ? ' checked' : '') + '> Acesso liberado</label></div>' +
          '<div class="campo"><label>Cor do avatar</label><input type="color" class="inp-cor" id="u-cor" value="' + esc(u.cor || C.corDe(u.nome || 'x')) + '"></div>',
        pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="u-ok" data-carregando=" Salvando...">Salvar</button>'
      });
      el.querySelector('#u-ok').onclick = function () {
        C.comBotao(this, function () {
          return C.api('usuario.salvar', { usuario: { id: u.id, nome: el.querySelector('#u-nome').value, email: el.querySelector('#u-email').value, perfil: el.querySelector('#u-perfil').value, senha: el.querySelector('#u-senha').value, recebe_leads: el.querySelector('#u-recebe').checked ? 'SIM' : 'NAO', ativo: el.querySelector('#u-ativo').checked ? 'SIM' : 'NAO', cor: el.querySelector('#u-cor').value } })
            .then(function () { el.fechar(); C.toast('Equipe atualizada. Envie o e-mail e a senha para a pessoa.', 'ok'); return C.recarregar(); });
        });
      };
    };
    C.$('#eq-novo').onclick = function () { form(); };
    C.$$('tr[data-u]', box).forEach(function (tr) { tr.onclick = function () { form(C.usuario(tr.dataset.u)); }; });
  }

  function ajSistema(box) {
    box.innerHTML = '<div class="grid-2" style="align-items:start"><div class="card card-pad"><h3 style="font-size:15px;margin-bottom:10px">Sobre este sistema</h3>' +
      '<div class="dado">Versão: <b>' + esc(CFGA.VERSAO) + '</b></div><div class="dado">Servidor:</div>' + (CFGA.URL_APP ? C.copiavel(CFGA.URL_APP) : '<p class="small muted">Modo demonstração</p>') +
      '<p class="small muted">Para abrir o sistema em outro computador já conectado, use o link:</p>' + C.copiavel(location.origin + location.pathname + (CFGA.URL_APP ? '?api=' + encodeURIComponent(CFGA.URL_APP) : '?demo=1')) +
      (CFGA.URL_PLANILHA ? '<a class="btn" style="margin-top:12px" href="' + esc(CFGA.URL_PLANILHA) + '" target="_blank" rel="noopener">' + ic('planilha') + ' Abrir planilha de dados</a>' : '') + '</div>' +
      '<div class="card card-pad"><h3 style="font-size:15px;margin-bottom:10px">Manutenção</h3><p class="small muted" style="margin-top:0">Com o tempo a fila de envios e o registro das automações crescem. Limpar deixa o sistema mais rápido. Contatos, conversas e negócios não são apagados.</p>' +
      '<button class="btn" id="sy-limpa" data-carregando=" Limpando...">' + ic('lixo') + ' Limpar registros com mais de 90 dias</button>' +
      '<h3 style="font-size:15px;margin:20px 0 10px">Backup</h3><p class="small muted" style="margin-top:0">Exporte contatos em Contatos > Exportar e negócios em Relatórios. A cópia completa é feita na própria planilha (Arquivo > Fazer uma cópia).</p>' +
      (C.ehDemo() ? '<button class="btn perigo" id="sy-reset">' + ic('atualizar') + ' Reiniciar dados da demonstração</button>' : '') + '</div></div>';
    C.$('#sy-limpa').onclick = function () { var b = this; C.comBotao(b, function () { return C.api('historico.limpar', { dias: 90 }).then(function (r) { C.toast(r.fila + ' envios e ' + r.execucoes + ' execuções antigas removidos', 'ok'); }); }); };
    if (C.$('#sy-reset')) C.$('#sy-reset').onclick = function () { window.PrumoDemo.resetar(); };
  }
})();
