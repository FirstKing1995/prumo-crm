# Como gastar menos na API oficial da Meta

A API oficial (WhatsApp Cloud API) cobra por mensagem entregue. O preço depende do tipo de mensagem. Regras da Meta em vigor em outubro de 2026 (confira sempre a página de preços da Meta, porque elas mudam a cada trimestre):

| Tipo | Quando acontece | Custo |
|---|---|---|
| Atendimento | Resposta dentro da janela de 24h aberta pela mensagem do cliente | 1.000 por mês grátis por número; depois, barato |
| Utilidade | Modelo de confirmação, lembrete, aviso de pedido | Barato |
| Marketing | Modelo de oferta, novidade, disparo | O mais caro |
| Período grátis de anúncio | Pessoa que chegou clicando num anúncio que leva ao WhatsApp | Grátis por um período (o sistema conta 72 horas) |

## O que o sistema faz por você

1. **Mostra a janela de 24h em cada conversa.** Verde: pode responder à vontade. Vermelho: só com modelo aprovado, e o botão **Enviar modelo** já está ali.
2. **Disparos econômicos.** Quem está com a janela aberta (ou no período grátis do anúncio) recebe o texto comum; só quem está com a janela fechada recebe o modelo pago. Antes de enviar, a tela mostra quantos de cada tipo e o custo estimado.
3. **Menus viram botões.** Nos robôs, o passo Menu aparece como botões (até 3 opções) ou lista (até 10). A pessoa toca em vez de digitar, erra menos e a conversa gasta menos mensagens.
4. **Formulário numa mensagem só (WhatsApp Flows).** O passo Formulário, com o ID de um Flow publicado, coleta nome, e-mail e outros dados numa tela dentro do WhatsApp. Sem Flow, ele pergunta um campo por vez.
5. **Período grátis do anúncio.** Quem chega por anúncio de clique para o WhatsApp fica marcado, com a origem e o nome do anúncio. As mensagens nesse período aparecem como grátis no relatório.
6. **Modelo de reserva nos robôs.** Em passos de mensagem depois de esperas longas, preencha o modelo a usar se a janela estiver fechada. Sem ele, a mensagem não sai, para não gerar erro nem custo.
7. **Relatório de custo.** Em Relatórios, o quadro "Custo estimado da API oficial" conta as mensagens por tipo, estima o valor e mostra a economia em relação a mandar tudo como marketing.

## Criar um WhatsApp Flow

1. No Gerenciador do WhatsApp: **Ferramentas da conta > Flows > Criar Flow**.
2. Monte a tela com os campos. Dê a cada campo o nome do campo do contato no CRM: `nome`, `email`, `empresa`, `cidade` ou a chave de um campo personalizado (Ajustes > Campos e listas).
3. Publique o Flow e copie o ID.
4. Na automação, adicione o passo **Formulário**, abra "API oficial: tudo numa mensagem só" e cole o ID.

## Ajustar os preços da estimativa

Em **Integrações > API oficial da Meta > Preços para a estimativa de custo**. Os valores vêm aproximados; troque pelos da tabela da Meta para o Brasil.
