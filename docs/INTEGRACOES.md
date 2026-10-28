# Integrações

Toda integração usa a **URL de webhook** que aparece em **Integrações > Formulários e sites**. Ela tem este formato:

```
https://script.google.com/macros/s/SEU_ID/exec?src=entrada&k=SUA_CHAVE
```

Parâmetros opcionais no fim da URL:

| Parâmetro | Exemplo | O que faz |
|---|---|---|
| `origem` | `&origem=Site` | Registra de onde veio (aparece nos relatórios e filtra automações) |
| `tags` | `&tags=Lead%20site,Promo` | Adiciona tags (separe por vírgula; espaço vira `%20`) |
| `automacao` | `&automacao=A1` | Inicia uma automação específica |
| `etapa` | `&etapa=ET1` | Cria o negócio já nesta etapa do funil |

Os IDs de automações e etapas aparecem na mesma tela do sistema.

O sistema procura sozinho os campos de nome, e-mail, telefone, empresa, cidade e cargo, com vários nomes possíveis (`name`, `phone`, `whatsapp`, `celular`, `buyer.email`, `customer.mobile`...). Campos com o mesmo nome de um campo personalizado e parâmetros `utm_*` também são guardados.

## Elementor (WordPress)

1. Edite o formulário > **Ações após o envio** > adicione **Webhook**.
2. Na aba Webhook, cole a URL. Ative **Dados avançados**.
3. Dê aos campos os IDs `nome`, `email` e `telefone`.

## Typebot

No fim do fluxo, adicione o bloco **HTTP request**:
- Método: POST · URL: a URL de webhook
- Corpo (JSON): `{"nome": "{{Nome}}", "telefone": "{{Telefone}}", "email": "{{Email}}"}`

## Hotmart e Kiwify (vendas)

Use a URL de **Integrações > Hotmart** (ou Kiwify). Ela tem uma chave própria, `src=vendas`, diferente da URL de formulários: como a URL de formulários fica visível no código do seu site, eventos de compra que chegam por ela são ignorados. Assim ninguém consegue registrar uma venda falsa.

- **Hotmart:** Ferramentas > Webhook (API e notificações) > Cadastrar webhook. Versão 2.0. Marque compra aprovada, compra completa, abandono de carrinho, boleto impresso, reembolso, chargeback e cancelamento.
- **Kiwify:** Apps > Webhooks > Criar webhook. Marque compra aprovada, carrinho abandonado, boleto gerado, Pix gerado, compra recusada, reembolso, chargeback e assinatura cancelada.

O que acontece em cada evento:

| Evento | No sistema |
|---|---|
| Compra aprovada | Tag "Plataforma: Comprou", contato vira cliente, negócio ganho com o valor da venda, sai das automações de recuperação |
| Carrinho abandonado | Tag "Plataforma: Carrinho abandonado" |
| Boleto ou Pix gerado | Tag correspondente |
| Reembolso, chargeback, cancelamento, recusa | Tag correspondente |

Todos os eventos podem iniciar automações pelo gatilho **Evento de venda**. Em Automações > Nova, use os modelos **Recuperar carrinho abandonado**, **Lembrete de boleto e Pix** e **Boas-vindas ao comprador**.

Eduzz, Monetizze e outras: use a URL de formulários com `&origem=NomeDaPlataforma&tags=Comprador`. O comprador entra como contato com as tags.

## ActiveCampaign

**De lá para cá:** na automação do ActiveCampaign, adicione a ação **Webhook** com a URL de formulários e `&fonte=activecampaign&origem=ActiveCampaign`. O ActiveCampaign manda os dados como formulário (`contact[email]`, `contact[first_name]`...) e o sistema entende esse formato.

**Daqui para lá:** em Integrações > ActiveCampaign, cole a URL da API e a chave (Configurações > Desenvolvedor no ActiveCampaign), teste e escolha a lista padrão. Nas automações, o passo **Enviar ao ActiveCampaign** cria ou atualiza o contato (precisa de e-mail), coloca na lista e aplica as tags que você escolher.

## RD Station Marketing e Mailchimp

Use a ação de **webhook** dentro das automações dessas ferramentas apontando para a URL de formulários.

## Anúncios de cadastro: Facebook, Instagram e TikTok

O sistema entende o formato de "pares" desses anúncios (`field_data: [{name, values}]` da Meta e `answers: [{question, answer}]` do TikTok).

- **Facebook e Instagram (Lead Ads):** Make ou Zapier, gatilho **Facebook Lead Ads > New Lead**, ação **HTTP > POST** para a URL de formulários com `&fonte=facebook&origem=Anúncio%20Facebook`.
- **TikTok (formulário instantâneo):** no TikTok Ads Manager, na área de Leads, use a integração com CRM por webhook se a sua conta tiver essa opção; senão, Make ou Zapier com o gatilho de novo lead do TikTok. URL de formulários com `&fonte=tiktok&origem=Anúncio%20TikTok`.

Dica: crie uma automação com o gatilho **Formulário / webhook** e a origem do anúncio para mandar a primeira mensagem no WhatsApp na hora.

## Instagram Direct e comentários

Configuração em **Integrações > Instagram Direct e comentários** (o tutorial está na própria tela). Depois de ligado:

- O Direct aparece na caixa de Conversas, com o ícone do Instagram. Dá para responder até 24 horas depois da última mensagem da pessoa (regra do Instagram).
- O gatilho **Comentou no Instagram** inicia uma automação quando alguém comenta uma palavra num post. O passo **Responder comentário** responde em público, e a primeira mensagem do fluxo vai como resposta privada no Direct.
- Menus dos robôs viram botões de resposta rápida.

## E-mail marketing e rastreio do site

Envio pelo Gmail e pelo Brevo, campanhas, automações por e-mail e o código de rastreio do site estão em `docs/EMAIL_MARKETING.md`.

## API do sistema

Para programadores, n8n, Make ou Zapier mandarem comandos para o CRM. Ligue em **Integrações > API do sistema** (gera uma chave secreta). Não publique essa URL: com ela é possível mandar mensagens pelo seu WhatsApp.

Toda chamada é um POST com JSON:

| `acao` | Campos |
|---|---|
| `contato.salvar` | nome, telefone, email, empresa, cidade, origem, tags, campos |
| `contato.buscar` | contato_id, telefone ou email |
| `tag.adicionar` / `tag.remover` | telefone ou email + tags |
| `mensagem.enviar` | telefone ou email + texto |
| `automacao.iniciar` | telefone ou email + automacao (nome) ou automacao_id |
| `negocio.etapa` | telefone ou email + etapa_id |

Exemplo:

```json
{ "acao": "mensagem.enviar", "telefone": "11999998888", "texto": "Oi {primeiro_nome}, seu pedido saiu!" }
```

## Google Forms

1. No formulário: menu de três pontos > **Editor de script**.
2. Cole o código abaixo, troque a URL e salve.
3. Em **Acionadores** (relógio), crie: função `enviarParaCRM`, evento **Do formulário > Ao enviar**.

```js
var URL_CRM = 'COLE_AQUI_A_URL_DE_WEBHOOK&origem=Google%20Forms';

function enviarParaCRM(e) {
  var dados = {};
  e.response.getItemResponses().forEach(function (r) {
    dados[r.getItem().getTitle()] = r.getResponse();
  });
  var email = e.response.getRespondentEmail();
  if (email) dados.email = email;
  UrlFetchApp.fetch(URL_CRM, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(dados),
    muteHttpExceptions: true
  });
}
```

Nomeie as perguntas como "Nome", "WhatsApp" e "E-mail" para o sistema reconhecer.

## Saída: n8n, Make e Zapier

Em **Integrações > n8n, Make e Zapier**, cadastre URLs que recebem eventos:

- `contato.criado`
- `mensagem.recebida`
- `negocio.ganho`
- `negocio.perdido`
- `lead.passado` (SDR passou para o closer)
- `reuniao.agendada`
- `compra.compra_aprovada`, `compra.carrinho_abandonado` e os outros eventos de venda

Cada evento chega como POST JSON:

```json
{
  "evento": "negocio.ganho",
  "sistema": "Nome do seu CRM",
  "data": "2026-10-27T14:30:00",
  "dados": { "negocio": { "titulo": "...", "valor": "1500" }, "contato": { "nome": "...", "telefone": "..." } }
}
```

Também existe o passo **Enviar webhook** dentro das automações, para avisar outro sistema num ponto exato do fluxo.
