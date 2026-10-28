# Financeiro e Mercado Pago

O menu **Financeiro** mostra o dinheiro de verdade da empresa: o que já entrou, o que vai entrar, quem está atrasado e os reembolsos. Ele aparece para o administrador, o gestor e quem tiver o acesso "Financeiro" liberado na Equipe.

## Cobranças e parcelas

Cada venda vira uma ou mais parcelas. Crie em **Financeiro > Nova cobrança** ou na ficha do contato (bloco Financeiro > Cobrança):

- valor total, número de parcelas e data do primeiro vencimento (as outras vencem todo mês no mesmo dia);
- forma de pagamento;
- **A primeira parcela já foi paga**, para entradas;
- **Gerar link do Mercado Pago**, para cada parcela ter o seu link de pagamento.

Quando o cliente paga fora do Mercado Pago, clique em **Recebi** na parcela.

## O que o painel mostra

| Indicador | O que é |
|---|---|
| Entrou no mês | Soma das parcelas pagas no mês, já descontados os reembolsos (faturamento real) |
| A receber | Tudo que está em aberto para o futuro |
| Em atraso | Parcelas vencidas e não pagas, e quantos clientes estão inadimplentes |
| Vence em 7 dias | O que está perto de vencer |
| Reembolsos | Valor devolvido no mês |
| Clientes ativos | Contatos com status cliente, comparados ao total da base |

Os gráficos mostram as entradas dos últimos 6 meses e a previsão de recebimento dos próximos 12. Vendas da Hotmart, da Kiwify e dos links do Mercado Pago entram sozinhas.

## Cobrança automática

Todo dia o sistema confere as parcelas:

- **Perto de vencer** (quantos dias antes, você define em Integrações > Mercado Pago): dispara o gatilho **Cobrança perto de vencer**.
- **Venceu e não foi paga**: coloca a tag **Inadimplente** e dispara o gatilho **Cobrança atrasada**.
- **Pagou**: tira a tag Inadimplente e dispara o gatilho **Pagamento recebido**.
- **Reembolso**: coloca a tag Reembolso e dispara o gatilho **Reembolso**.

Em Automações > Nova automação há modelos prontos: **Lembrete de vencimento**, **Recuperar inadimplente** e **Obrigado pelo pagamento**. As mensagens podem usar `{valor_parcela}`, `{vencimento}`, `{parcela}`, `{descricao_cobranca}` e `{link_pagamento}`. Esses campos também funcionam em disparos e e-mails (usam a próxima parcela em aberto do contato).

## Mercado Pago

1. Em mercadopago.com.br/developers, entre com a conta que vai receber e crie uma aplicação do tipo Checkout Pro.
2. Copie o **Access Token de produção** (começa com APP_USR-).
3. Cole em **Integrações > Mercado Pago**, clique em Testar conexão e salve.

Pronto: o endereço de aviso de pagamento vai dentro de cada link, sem configurar webhook no painel do Mercado Pago. Quando um pagamento é aprovado, o sistema confere o pagamento direto no Mercado Pago antes de dar baixa (um aviso falso não registra pagamento). Reembolsos e chargebacks também chegam sozinhos.

**Links de venda:** em Financeiro > Link de venda, crie um link para um produto e divulgue onde quiser. Cada compra cria o contato com a tag "Comprou: produto", registra a entrada e dispara o gatilho **Evento de venda > Compra aprovada**, igual à Hotmart e à Kiwify.

O Mercado Pago cobra as tarifas normais dele por venda. O sistema não cobra nada.
