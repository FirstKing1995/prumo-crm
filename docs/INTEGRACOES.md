# Integrações de captação de leads

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

## Hotmart, Kiwify, Eduzz, Monetizze

Em **Webhooks / Postback**, cadastre a URL com, por exemplo, `&origem=Hotmart&tags=Comprador`. O comprador entra como contato com as tags. Para mover para "Ganho", acrescente `&etapa=ID_DA_ETAPA_GANHO`.

## RD Station Marketing, ActiveCampaign, Mailchimp

Use a ação de **webhook** dentro das automações dessas ferramentas apontando para a URL.

## Facebook e Instagram Lead Ads

Use Make ou Zapier (planos gratuitos atendem volumes pequenos):
1. Gatilho: **Facebook Lead Ads > New Lead**.
2. Ação: **Webhooks / HTTP > POST** para a URL, com os campos `nome`, `email`, `telefone`.

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
