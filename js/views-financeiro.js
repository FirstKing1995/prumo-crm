/* ==========================================================================
   PRUMO CRM — Financeiro: entradas reais, a receber, inadimplência, reembolsos
   e links de pagamento do Mercado Pago
   ========================================================================== */
(function () {
  'use strict';
  var S = C.S, esc = C.esc, ic = C.ic;
  var mes = C.hoje().slice(0, 7), aba = 'atraso';
  var NOME_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  var nomeMes = function (m) { return NOME_MES[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4); };
  var mesCurto = function (m) { return NOME_MES[Number(m.slice(5, 7)) - 1].slice(0, 3) + '/' + m.slice(2, 4); };
  var somaMes = function (m, n) { var a = Number(m.slice(0, 4)), x = Number(m.slice(5, 7)) - 1 + n; a += Math.floor(x / 12); x = ((x % 12) + 12) % 12; return a + '-' + ('0' + (x + 1)).slice(-2); };
  var dataBr = function (d) { d = String(d || ''); return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '—'; };

  C.views.financeiro = {
    titulo: 'Financeiro',
    acoes: function () { return '<button class="btn" data-a="link">' + ic('link') + '<span class="txt"> Link de venda</span></button><button class="btn pri" data-a="nova">' + ic('plus') + '<span class="txt"> Nova cobrança</span></button>'; },
    ligarAcoes: function (el) {
      el.querySelector('[data-a=nova]').onclick = function () { C.formCobranca(null, null, function () { C.render(); }); };
      el.querySelector('[data-a=link]').onclick = novoLink;
    },
    render: function (el) {
      el.innerHTML = '<div class="barra-ferr"><div class="seg"><button id="f-ant" aria-label="Mês anterior">' + ic('esq') + '</button><button class="on" style="min-width:150px">' + nomeMes(mes) + '</button><button id="f-prox" aria-label="Próximo mês">' + ic('dir') + '</button></div>' +
        (!S.config.mercadopago && C.pode('integracoes') ? '<a href="#" class="small" id="f-mp" style="margin-left:auto">' + ic('link') + ' Ligar o Mercado Pago para cobrar com link</a>' : '') + '</div>' +
        '<div id="f-resumo"><div style="text-align:center;padding:40px"><span class="spin" style="color:var(--pri)"></span></div></div>' +
        '<div class="abas" style="margin-top:18px">' + [['atraso', 'Inadimplentes'], ['vencendo', 'Vencem em 7 dias'], ['pendente', 'A receber'], ['paga', 'Recebidas no mês'], ['reembolsada', 'Reembolsos'], ['links', 'Links de venda']].map(function (a) { return '<button data-fa="' + a[0] + '" class="' + (aba === a[0] ? 'on' : '') + '">' + a[1] + '</button>'; }).join('') + '</div>' +
        '<div class="card" id="f-lista"><div style="text-align:center;padding:30px"><span class="spin" style="color:var(--pri)"></span></div></div>';
      C.$('#f-ant').onclick = function () { mes = somaMes(mes, -1); C.render(); };
      C.$('#f-prox').onclick = function () { mes = somaMes(mes, 1); C.render(); };
      var fm = C.$('#f-mp'); if (fm) fm.onclick = function (e) { e.preventDefault(); C.ir('integracoes'); setTimeout(function () { var b = document.querySelector('[data-in=mercadopago]'); if (b) b.click(); }, 400); };
      C.$$('[data-fa]', el).forEach(function (b) { b.onclick = function () { aba = b.dataset.fa; C.render(); }; });
      C.api('financeiro.resumo', { mes: mes }).then(pintarResumo).catch(function (e) { C.toast(e.message, 'erro'); });
      C.api('cobranca.listar', { filtro: aba, mes: mes }).then(pintarLista).catch(function (e) { C.toast(e.message, 'erro'); });
    }
  };

  function kpi(i, rot, val, sub, cor) { return '<div class="card kpi"><div class="rot">' + ic(i) + rot + '</div><div class="val"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + val + '</div><div class="sub">' + sub + '</div></div>'; }
  function barras(obj, cor, rotulo) {
    var ks = Object.keys(obj).sort(), max = Math.max.apply(null, ks.map(function (k) { return obj[k]; }).concat([1]));
    return '<div class="barras fin-barras">' + ks.map(function (k) { return '<div class="b" style="height:' + Math.max(2, obj[k] / max * 100) + '%;background:' + cor + '" data-t="' + mesCurto(k) + ': ' + C.brl(obj[k]) + '"></div>'; }).join('') + '</div>' +
      '<div class="eixo"><span>' + mesCurto(ks[0]) + '</span><span>' + rotulo + '</span><span>' + mesCurto(ks[ks.length - 1]) + '</span></div>';
  }
  function pintarResumo(r) {
    var box = C.$('#f-resumo');
    if (!box) return;
    box.innerHTML = '<div class="kpis">' +
      kpi('dinheiro', 'Entrou no mês', C.brl(r.liquido), r.recebido_qtd + ' pagamentos' + (r.reembolsos ? ' (já sem ' + C.brl(r.reembolsos) + ' de reembolso)' : '')) +
      kpi('calendario', 'A receber (futuro)', C.brl(r.a_receber), C.brl(r.a_receber_mes) + ' vencem neste mês') +
      kpi('alerta', 'Em atraso', C.brl(r.atraso), r.inadimplentes + ' cliente' + (r.inadimplentes === 1 ? '' : 's') + ' inadimplente' + (r.inadimplentes === 1 ? '' : 's'), r.atraso ? 'var(--vermelho)' : '') +
      kpi('relogio', 'Vence em 7 dias', C.brl(r.vencendo7), r.vencendo7_qtd + ' parcela' + (r.vencendo7_qtd === 1 ? '' : 's')) +
      kpi('atualizar', 'Reembolsos no mês', C.brl(r.reembolsos), r.reembolsos_qtd + ' reembolso' + (r.reembolsos_qtd === 1 ? '' : 's')) +
      kpi('contatos', 'Clientes ativos', C.inteiro(r.clientes), 'de ' + C.inteiro(r.base) + ' contatos na base') + '</div>' +
      '<div class="grid-2"><div class="card"><div class="card-cab"><h3>Entradas dos últimos 6 meses</h3></div><div class="card-pad">' + barras(r.historico, 'var(--verde)', 'recebido') + '</div></div>' +
      '<div class="card"><div class="card-cab"><h3>Previsão de recebimento</h3><span class="acoes small muted">próximos 12 meses</span></div><div class="card-pad">' + barras(r.previsao, 'var(--pri)', 'parcelas em aberto') + '</div></div></div>' +
      (r.atraso || r.vencendo7 ? '<div class="aviso info" style="margin-top:14px">' + ic('robo') + '<div>Deixe o sistema cobrar sozinho: em Automações > Nova automação, use os modelos <b>Lembrete de vencimento</b> e <b>Recuperar inadimplente</b>. As mensagens já trazem o valor, o vencimento e o link de pagamento.</div></div>' : '');
  }

  function pintarLista(l) {
    var box = C.$('#f-lista');
    if (!box) return;
    if (aba === 'links') {
      box.innerHTML = l.length ? '<div class="tabela-wrap"><table class="tab"><thead><tr><th>Produto</th><th>Valor</th><th>Vendas</th><th>Link</th><th></th></tr></thead><tbody>' + l.map(function (x) {
        return '<tr style="cursor:default"><td>' + esc(x.descricao) + '</td><td class="num">' + C.brl(x.valor) + '</td><td class="num">' + C.inteiro(x.parcela) + '</td><td>' + (x.link ? C.copiavel(x.link) : '—') + '</td><td>' + (x.status === 'ativo' ? '<button class="btn peq perigo" data-c="cancelar" data-id="' + x.id + '">Desativar</button>' : '<span class="status st-off">Desativado</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="vazio">' + ic('link') + '<h3>Nenhum link de venda</h3><p>Crie um link do Mercado Pago para um produto e divulgue onde quiser. Cada compra vira contato, entrada no financeiro, tag e gatilho de automação.</p></div>';
    } else {
      box.innerHTML = l.length ? '<div class="tabela-wrap"><table class="tab"><thead><tr><th>Cliente</th><th>Descrição</th><th>Valor</th><th>' + (aba === 'paga' ? 'Pago em' : aba === 'reembolsada' ? 'Reembolso' : 'Vencimento') + '</th><th>Situação</th><th></th></tr></thead><tbody>' + l.map(linha).join('') + '</tbody></table></div>' :
        '<div class="vazio">' + ic('check') + '<h3>' + ({ atraso: 'Ninguém em atraso', vencendo: 'Nada vence nos próximos 7 dias', pendente: 'Nada a receber', paga: 'Nenhum pagamento neste mês', reembolsada: 'Nenhum reembolso' }[aba]) + '</h3></div>';
    }
    C.$$('[data-c]', box).forEach(function (b) { b.onclick = function () { acao(b.dataset.c, b.dataset.id, l.filter(function (x) { return x.id === b.dataset.id; })[0], b); }; });
    C.$$('[data-ct]', box).forEach(function (b) { b.onclick = function () { C.abrirContato(b.dataset.ct); }; });
  }
  function situacao(x) {
    if (x.status === 'paga') return '<span class="status st-on">Paga</span>';
    if (x.status === 'reembolsada') return '<span class="status st-erro">Reembolsada</span>';
    if (x.status === 'cancelada') return '<span class="status st-off">Cancelada</span>';
    if (x.atrasada) { var d = Math.round((Date.now() - new Date(x.vencimento + 'T12:00:00')) / 86400000); return '<span class="status st-erro">' + d + ' dia' + (d === 1 ? '' : 's') + ' de atraso</span>'; }
    return '<span class="status st-aviso">Em aberto</span>';
  }
  function linha(x) {
    var bt = '';
    if (x.status === 'pendente') {
      bt += '<button class="btn peq verde" data-c="pagar" data-id="' + x.id + '">' + ic('check') + ' Recebi</button>';
      bt += x.link ? '<button class="btn peq" data-c="copiar" data-id="' + x.id + '" title="Copiar link de pagamento">' + ic('copiar') + '</button>' : (S.config.mercadopago ? '<button class="btn peq" data-c="link" data-id="' + x.id + '" title="Gerar link do Mercado Pago">' + ic('link') + '</button>' : '');
      bt += '<button class="btn fantasma ic peq" data-c="mais" data-id="' + x.id + '" aria-label="Mais opções">' + ic('mais') + '</button>';
    } else if (x.status === 'paga' && C.pode('financeiro')) bt = '<button class="btn peq" data-c="reembolsar" data-id="' + x.id + '">' + ic('atualizar') + ' Reembolsar</button>';
    var quando = x.status === 'paga' ? dataBr(String(x.pago_em).slice(0, 10)) : x.status === 'reembolsada' ? C.brl(x.reembolso_valor) + ' em ' + dataBr(String(x.reembolsado_em).slice(0, 10)) : dataBr(x.vencimento);
    return '<tr style="cursor:default"><td>' + (x.contato_id ? '<a href="#" data-ct="' + x.contato_id + '" onclick="return false">' + esc(x.contato_nome || 'Contato') + '</a>' : '—') + '</td><td>' + esc(x.descricao) + (Number(x.parcelas) > 1 ? ' <span class="small muted">' + x.parcela + '/' + x.parcelas + '</span>' : '') + (x.forma ? '<div class="small muted">' + esc(x.forma) + '</div>' : '') + '</td>' +
      '<td class="num">' + C.brl(x.valor) + '</td><td class="small">' + quando + '</td><td>' + situacao(x) + '</td><td><div style="display:flex;gap:4px;justify-content:flex-end">' + bt + '</div></td></tr>';
  }

  function acao(a, id, x, btn) {
    var depois = function () { C.render(); };
    if (a === 'copiar') { C.copiar(x.link); return; }
    if (a === 'link') return C.comBotao(btn, function () { return C.api('cobranca.link', { id: id }).then(function (r) { C.copiar(r.link); C.toast('Link gerado e copiado', 'ok'); depois(); }); });
    if (a === 'pagar') {
      var el = C.modal({
        titulo: 'Registrar pagamento', corpo: '<p style="margin-top:0">' + esc(x.contato_nome) + ' · ' + esc(x.descricao) + ' · <b>' + C.brl(x.valor) + '</b></p><div class="grade2"><div class="campo"><label>Data do pagamento</label><input class="inp" type="date" id="pg-d" value="' + C.hoje() + '"></div><div class="campo"><label>Forma</label><input class="inp" id="pg-f" list="pg-fl" value="' + esc(x.forma || 'Pix') + '"><datalist id="pg-fl"><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></datalist></div></div>',
        pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn verde" id="pg-ok" data-carregando=" Salvando...">' + ic('check') + ' Confirmar</button>'
      });
      el.querySelector('#pg-ok').onclick = function () { C.comBotao(this, function () { return C.api('cobranca.pagar', { id: id, pago_em: el.querySelector('#pg-d').value, forma: el.querySelector('#pg-f').value }).then(function () { el.fechar(); C.toast('Pagamento registrado', 'ok'); depois(); }); }); };
      return;
    }
    if (a === 'reembolsar') {
      var er = C.modal({
        titulo: 'Reembolso', corpo: '<p style="margin-top:0">' + esc(x.contato_nome) + ' · ' + esc(x.descricao) + '</p><div class="grade2"><div class="campo"><label>Valor devolvido</label><input class="inp" id="rb-v" inputmode="decimal" value="' + esc(String(x.valor).replace('.', ',')) + '"></div><div class="campo"><label>Motivo</label><input class="inp" id="rb-m" placeholder="Ex.: desistiu na garantia"></div></div><p class="small muted">O contato recebe a tag Reembolso e o gatilho "Reembolso" das automações é disparado. O dinheiro em si é devolvido na plataforma de pagamento.</p>',
        pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn perigo cheio" id="rb-ok" data-carregando=" Salvando...">Registrar reembolso</button>'
      });
      er.querySelector('#rb-ok').onclick = function () { C.comBotao(this, function () { return C.api('cobranca.reembolsar', { id: id, valor: C.num(er.querySelector('#rb-v').value), motivo: er.querySelector('#rb-m').value }).then(function () { er.fechar(); C.toast('Reembolso registrado', 'ok'); depois(); }); }); };
      return;
    }
    if (a === 'cancelar') return C.confirmar('Desativar este link? Quem tentar pagar por ele não vai conseguir confirmar no sistema.', { perigo: true, botao: 'Desativar' }).then(function (ok) { if (ok) return C.api('cobranca.cancelar', { id: id }).then(depois); }).catch(function (e) { C.toast(e.message, 'erro'); });
    if (a === 'mais') {
      var em = C.modal({
        titulo: 'Cobrança', corpo: '<p style="margin-top:0">' + esc(x.contato_nome) + ' · ' + esc(x.descricao) + ' · ' + C.brl(x.valor) + '</p>' +
          '<div class="campo"><label>Mudar o vencimento</label><div class="linha"><input class="inp" type="date" id="mv-d" value="' + esc(x.vencimento) + '"><button class="btn" id="mv-ok" style="flex:0 0 auto" data-carregando=" Salvando...">Salvar</button></div></div>' +
          (x.contato_id ? '<button class="btn bloco" id="mv-conv" style="margin-bottom:8px">' + ic('conversas') + ' Abrir conversa para cobrar</button>' : '') +
          (C.pode('financeiro') ? '<button class="btn bloco perigo" id="mv-canc">' + ic('x') + ' Cancelar esta cobrança</button>' : ''),
        pe: '<button class="btn" data-fechar>Fechar</button>'
      });
      em.querySelector('#mv-ok').onclick = function () { C.comBotao(this, function () { return C.api('cobranca.vencimento', { id: id, vencimento: em.querySelector('#mv-d').value }).then(function () { em.fechar(); C.toast('Vencimento alterado', 'ok'); depois(); }); }); };
      var cv = em.querySelector('#mv-conv'); if (cv) cv.onclick = function () { em.fechar(); C.abrirConversa(x.contato_id); };
      var cc = em.querySelector('#mv-canc'); if (cc) cc.onclick = function () { C.api('cobranca.cancelar', { id: id }).then(function () { em.fechar(); C.toast('Cobrança cancelada', 'ok'); depois(); }).catch(function (e) { C.toast(e.message, 'erro'); }); };
    }
  }

  function novoLink() {
    if (!S.config.mercadopago) { C.toast(C.pode('integracoes') ? 'Primeiro ligue o Mercado Pago em Integrações.' : 'O Mercado Pago ainda não foi configurado.', 'erro'); return; }
    var el = C.modal({
      titulo: 'Novo link de venda', corpo: '<p class="small muted" style="margin-top:0">Um link do Mercado Pago para um produto ou serviço. Divulgue no WhatsApp, Instagram ou no site. Cada compra cria o contato (com a tag "Comprou: produto"), registra a entrada no financeiro e dispara o gatilho Evento de venda.</p>' +
        '<div class="grade2"><div class="campo"><label>Produto ou serviço</label><input class="inp" id="lk-d" placeholder="Ex.: Consultoria de 1 hora"></div><div class="campo"><label>Valor (R$)</label><input class="inp" id="lk-v" inputmode="decimal"></div></div><p class="small muted">O parcelamento no cartão é oferecido pelo próprio Mercado Pago, conforme a sua conta.</p>',
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="lk-ok" data-carregando=" Gerando...">' + ic('link') + ' Gerar link</button>'
    });
    el.querySelector('#lk-ok').onclick = function () {
      C.comBotao(this, function () { return C.api('venda.link', { descricao: el.querySelector('#lk-d').value, valor: C.num(el.querySelector('#lk-v').value) }).then(function (r) { C.copiar(r.link); el.fechar(); C.toast('Link criado e copiado', 'ok'); aba = 'links'; C.render(); }); });
    };
  }

  /** Nova cobrança (parcelada ou à vista) para um contato. Usada aqui, na ficha e ao ganhar um negócio. */
  C.formCobranca = function (contato, negocio, depois) {
    var hoje = C.hoje();
    var el = C.modal({
      titulo: 'Nova cobrança', tamanho: 'largo',
      corpo: (contato ? '<p style="margin-top:0"><b>' + esc(contato.nome) + '</b></p>' : '<div class="campo"><label>Cliente</label><input class="inp" id="cb-busca" list="cb-cl" placeholder="Digite o nome"><datalist id="cb-cl">' + S.contatos.slice(0, 2000).map(function (c) { return '<option value="' + esc(c.nome + ' · ' + (c.email || C.tel(c.telefone) || '')) + '">'; }).join('') + '</datalist></div>') +
        '<div class="grade2"><div class="campo"><label>Descrição</label><input class="inp" id="cb-d" value="' + esc(negocio ? negocio.titulo : '') + '" placeholder="Ex.: Plano anual"></div><div class="campo"><label>Valor total (R$)</label><input class="inp" id="cb-v" inputmode="decimal" value="' + esc(negocio && C.num(negocio.valor) ? String(negocio.valor).replace('.', ',') : '') + '"></div></div>' +
        '<div class="grade3"><div class="campo"><label>Parcelas</label><input class="inp" type="number" min="1" max="60" id="cb-n" value="1"></div><div class="campo"><label>1º vencimento</label><input class="inp" type="date" id="cb-venc" value="' + hoje + '"></div><div class="campo"><label>Forma</label><input class="inp" id="cb-f" list="cb-fl" value="Pix"><datalist id="cb-fl"><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Dinheiro</option><option>Transferência</option></datalist></div></div>' +
        '<div class="aviso info" id="cb-prev" style="margin:0 0 10px">' + ic('calendario') + '<div></div></div>' +
        '<label class="check"><input type="checkbox" id="cb-pg"> A primeira parcela já foi paga (entrada)</label>' +
        (S.config.mercadopago ? '<label class="check"><input type="checkbox" id="cb-mp" checked> Gerar link de pagamento do Mercado Pago para cada parcela</label>' : ''),
      pe: '<button class="btn" data-fechar>Cancelar</button><button class="btn pri" id="cb-ok" data-carregando=" Criando...">Criar cobrança</button>'
    });
    var prev = function () {
      var v = C.num(el.querySelector('#cb-v').value), n = Math.max(1, Number(el.querySelector('#cb-n').value) || 1);
      el.querySelector('#cb-prev div').textContent = v ? n + (n > 1 ? ' parcelas' : ' parcela') + ' de ' + C.brl(v / n) + ', todo mês a partir de ' + dataBr(el.querySelector('#cb-venc').value) + '.' : 'Informe o valor total.';
    };
    ['#cb-v', '#cb-n', '#cb-venc'].forEach(function (s) { el.querySelector(s).addEventListener('input', prev); });
    prev();
    el.querySelector('#cb-ok').onclick = function () {
      var c = contato;
      if (!c) {
        var t = el.querySelector('#cb-busca').value;
        c = S.contatos.filter(function (x) { return t === x.nome + ' · ' + (x.email || C.tel(x.telefone) || ''); })[0] || S.contatos.filter(function (x) { return x.nome === t; })[0];
      }
      C.comBotao(this, function () {
        if (!c) throw new Error('Escolha o cliente na lista.');
        return C.api('cobranca.criar', { contato_id: c.id, negocio_id: negocio ? negocio.id : '', descricao: el.querySelector('#cb-d').value, valor_total: C.num(el.querySelector('#cb-v').value), parcelas: Number(el.querySelector('#cb-n').value), primeiro_vencimento: el.querySelector('#cb-venc').value, forma: el.querySelector('#cb-f').value, entrada_paga: el.querySelector('#cb-pg').checked, gerar_link: !!(el.querySelector('#cb-mp') && el.querySelector('#cb-mp').checked) })
          .then(function (r) { el.fechar(); C.toast(r.length + (r.length > 1 ? ' parcelas criadas' : ' cobrança criada'), 'ok'); if (depois) depois(r); });
      });
    };
  };

  /** Bloco da ficha do contato: cobranças dele. */
  C.financeiroDoContato = function (box, c, recarregar) {
    C.api('cobranca.listar', { contato_id: c.id }).then(function (l) {
      if (!box.isConnected) return;
      var aberto = l.filter(function (x) { return x.status === 'pendente'; }).reduce(function (s, x) { return s + C.num(x.valor); }, 0);
      var pago = l.filter(function (x) { return x.status === 'paga'; }).reduce(function (s, x) { return s + C.num(x.valor); }, 0);
      box.innerHTML = '<div style="display:flex;align-items:center;gap:8px;margin:20px 0 8px"><h4 class="rot" style="margin:0">Financeiro</h4><span class="small muted">' + C.brl(pago) + ' pago · ' + C.brl(aberto) + ' em aberto</span><button class="btn peq" style="margin-left:auto" id="fc-nova">' + ic('plus') + ' Cobrança</button></div>' +
        (l.length ? '<div class="card">' + l.slice(-12).map(function (x) { return '<div style="display:flex;gap:10px;align-items:center;padding:9px 12px;border-bottom:1px solid var(--borda)"><div style="flex:1;min-width:0"><b class="small">' + esc(x.descricao) + (Number(x.parcelas) > 1 ? ' ' + x.parcela + '/' + x.parcelas : '') + '</b><div class="small muted">' + (x.status === 'paga' ? 'Pago em ' + dataBr(String(x.pago_em).slice(0, 10)) : 'Vence ' + dataBr(x.vencimento)) + '</div></div><b class="small num">' + C.brl(x.valor) + '</b>' + situacao(x) + '</div>'; }).join('') + '</div>' : '<p class="small muted" style="margin:0">Nenhuma cobrança.</p>');
      box.querySelector('#fc-nova').onclick = function () { C.formCobranca(c, null, recarregar); };
    }).catch(function () { box.innerHTML = ''; });
  };
})();
