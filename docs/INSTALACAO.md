# Instalação do Prumo CRM

Tempo: cerca de 10 minutos. Custo: zero. Você só precisa de uma conta Google (pode ser Gmail comum).

O sistema tem duas partes:

| Parte | Onde fica | Para que serve |
|---|---|---|
| Servidor e dados | Uma planilha Google com um script (Apps Script) na **sua** conta | Guarda contatos, conversas e negócios. Recebe as mensagens do WhatsApp. Envia disparos e roda os robôs. |
| Telas do sistema | Um site (GitHub Pages) | O que a equipe abre no computador ou celular. |

Os dados nunca saem da sua conta Google.

---

## Passo 1. Criar a planilha com o servidor

**Se você recebeu um link "Fazer uma cópia"**, abra o link, clique em **Fazer uma cópia** e pule para o Passo 2. O script já vem junto.

Se não recebeu:

1. Acesse [sheets.new](https://sheets.new) para criar uma planilha em branco. Dê o nome que quiser (ex.: "CRM da minha empresa").
2. No menu: **Extensões > Apps Script**.
3. Apague todo o código que aparece e cole o conteúdo do arquivo `backend/Codigo.gs`.
4. Clique no ícone de disquete (Salvar).

## Passo 2. Definir o primeiro acesso

No topo do código, troque o e-mail e a senha do administrador:

```js
var ADMIN_INICIAL = {
  nome: 'Seu nome',
  email: 'voce@suaempresa.com.br',
  senha: 'uma-senha-forte-aqui'
};
```

Salve.

## Passo 3. Instalar

1. No menu de cima do editor, escolha a função **instalar** e clique em **Executar**.
2. O Google pede autorização: **Revisar permissões > escolha sua conta > Avançado > Acessar (não seguro) > Permitir**.
   Esse aviso aparece em todo script pessoal. O script só acessa esta planilha, envia mensagens para as URLs que você configurar e cria o gatilho de 1 minuto.
3. Espere aparecer "Pronto!" no registro de execução. As abas da planilha serão criadas.

## Passo 4. Publicar o servidor

1. Clique em **Implantar > Nova implantação**.
2. Na engrenagem, escolha **App da Web**.
3. Preencha:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
4. Clique em **Implantar** e copie a **URL do app da Web** (termina em `/exec`).

> "Qualquer pessoa" é necessário para o site e o WhatsApp conseguirem falar com o servidor. Ninguém vê seus dados sem login e senha: toda chamada passa pela autenticação do sistema, e os webhooks exigem uma chave secreta.

## Passo 5. Abrir o sistema

1. Abra o endereço do sistema (o site em GitHub Pages que você recebeu).
2. Cole a URL `/exec` na tela **Vamos ligar o seu sistema** e clique em **Conectar**.
3. Entre com o e-mail e a senha do Passo 2.
4. O assistente pede nome, logo, cores e o tipo de negócio. Pronto.

Para abrir em outro computador sem colar a URL de novo, use o link que aparece em **Ajustes > Sistema**.

## Passo 6. Conectar o WhatsApp

Vá em **Integrações** e escolha uma das opções. Cada uma tem tutorial dentro do sistema:

- **Evolution API** (recomendado, gratuito): veja `docs/WHATSAPP_EVOLUTION.md`.
- **WAHA** (gratuito): veja `docs/WHATSAPP_WAHA.md`.
- **API oficial da Meta**: tutorial dentro do sistema.
- **Modo link**: funciona sem instalar nada, mas sem robôs nem recebimento de mensagens.

---

## Quando atualizar o código

Se receber uma versão nova do `Codigo.gs`:

1. Apps Script > cole o código novo por cima (mantenha seu `ADMIN_INICIAL`).
2. **Implantar > Gerenciar implantações > lápis (editar) > Versão: Nova versão > Implantar.**
   Assim a URL `/exec` continua a mesma.
3. Rode **instalar** de novo se a versão nova pedir (ele só cria o que falta, não apaga dados).

## Problemas comuns

| Sintoma | Solução |
|---|---|
| "O servidor respondeu algo inesperado" | A implantação não está como "Qualquer pessoa", ou a URL não termina em `/exec`. |
| Esqueci a senha do administrador | No Apps Script, troque a senha em `ADMIN_INICIAL` e execute **redefinirSenhaAdmin**. |
| Integrações mostra "o servidor ainda não sabe o próprio endereço" | Em `definirUrlDoApp`, cole a URL `/exec` e execute a função. |
| Disparos não saem | Confira o horário em Ajustes > Regras de envio, e em Apps Script > Acionadores se existe o gatilho `trabalhar` (rode **instalarGatilho** se não existir). |
| Erros de webhook | A planilha ganha uma aba **Erros** com o que chegou e o motivo. |

## Limites do plano gratuito do Google

Contas Gmail comuns têm cotas diárias no Apps Script (por exemplo, 20 mil chamadas externas por dia e 90 minutos por dia de gatilhos). Para uma pequena empresa isso cobre com folga milhares de mensagens por dia. O gatilho de 1 minuto só trabalha quando há algo na fila. Contas Google Workspace têm cotas maiores.
