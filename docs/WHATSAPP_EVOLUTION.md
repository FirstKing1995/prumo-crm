# WhatsApp com a Evolution API

A [Evolution API](https://github.com/EvolutionAPI/evolution-api) é gratuita e de código aberto. Ela conecta o WhatsApp pelo QR Code (como o WhatsApp Web) e permite enviar, receber, usar grupos e mídia.

O único requisito é um servidor ligado 24 horas. O Prumo CRM fala com ela pela internet.

> Aviso honesto: a Evolution usa uma conexão não oficial (a mesma do WhatsApp Web). Para reduzir risco de bloqueio, use um número com histórico, aqueça números novos aos poucos, use velocidade lenta nos disparos e envie só para quem conhece a empresa. Quem precisa de garantia total deve usar a API oficial da Meta.

## Opção A. VPS com Docker (recomendado)

Qualquer VPS com 1 GB de RAM e Ubuntu serve (Hostinger, Contabo, Hetzner, Oracle Cloud Free Tier).

1. Acesse o servidor por SSH e instale o Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. Crie a pasta e o arquivo de configuração:
   ```bash
   mkdir evolution && cd evolution
   nano docker-compose.yml
   ```
3. Cole o conteúdo abaixo (troque `SUA_CHAVE_SECRETA` por uma senha longa):
   ```yaml
   services:
     evolution:
       image: evoapicloud/evolution-api:latest
       restart: always
       ports:
         - "8080:8080"
       environment:
         - SERVER_URL=https://api.suaempresa.com.br
         - AUTHENTICATION_API_KEY=SUA_CHAVE_SECRETA
         - DATABASE_ENABLED=false
         - CACHE_LOCAL_ENABLED=true
       volumes:
         - evolution_instances:/evolution/instances
   volumes:
     evolution_instances:
   ```
   Algumas versões pedem banco de dados (Postgres). Se o container não subir, siga o `docker-compose` oficial do repositório da Evolution, que já traz Postgres e Redis.
4. Suba:
   ```bash
   docker compose up -d
   ```
5. Coloque um domínio com HTTPS na frente (o Apps Script exige HTTPS). O jeito mais simples é o Caddy:
   ```bash
   sudo apt install -y caddy
   echo "api.suaempresa.com.br {
     reverse_proxy localhost:8080
   }" | sudo tee /etc/caddy/Caddyfile
   sudo systemctl restart caddy
   ```
   Aponte o domínio (registro A no DNS) para o IP do servidor antes.

## Opção B. Painéis com instalação em 1 clique

Painéis como Easypanel, Coolify ou CapRover têm modelo pronto da Evolution API. Instale o painel na VPS, escolha o modelo "Evolution API", defina a chave e o domínio.

## Ligando no Prumo CRM

1. **Integrações > Evolution API**.
2. Preencha:
   - URL: `https://api.suaempresa.com.br`
   - Chave global: o valor de `AUTHENTICATION_API_KEY`
   - Instância: um nome sem espaço, ex.: `atendimento`
3. **Salvar e usar Evolution**, depois **Conectar**.
4. No celular: WhatsApp > Aparelhos conectados > Conectar aparelho > leia o QR Code.
5. Faça o teste de envio e mande um "oi" do seu celular para o número conectado.

O sistema cria a instância e configura o webhook (eventos `MESSAGES_UPSERT` e `CONNECTION_UPDATE`) sozinho.

## Vários números

Cada instalação do Prumo usa uma instância. Para atender com dois números, faça duas instalações (duas planilhas) apontando para a mesma Evolution com nomes de instância diferentes.
