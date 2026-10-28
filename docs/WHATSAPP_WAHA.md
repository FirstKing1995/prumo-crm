# WhatsApp com o WAHA

O [WAHA](https://waha.devlike.pro) (WhatsApp HTTP API) tem uma versão gratuita, a Core, que atende uma sessão (um número). Assim como a Evolution, conecta por QR Code e precisa de um servidor ligado 24 horas.

## Subindo o WAHA

1. Num servidor com Docker:
   ```bash
   docker run -d --restart always --name waha -p 3000:3000 \
     -e WHATSAPP_API_KEY=SUA_CHAVE_SECRETA \
     -v waha_sessions:/app/.sessions \
     devlikeapro/waha
   ```
2. Coloque HTTPS na frente (exemplo com Caddy):
   ```bash
   echo "waha.suaempresa.com.br {
     reverse_proxy localhost:3000
   }" | sudo tee /etc/caddy/Caddyfile
   sudo systemctl restart caddy
   ```

## Ligando no Prumo CRM

1. **Integrações > WAHA**.
2. URL: `https://waha.suaempresa.com.br` · Chave: `SUA_CHAVE_SECRETA` · Sessão: `default`.
3. **Salvar e usar WAHA**, depois **Conectar** e leia o QR Code.

O sistema cria a sessão com o webhook apontado para a planilha (eventos `message` e `message.any`).

## Diferenças para a Evolution

- A versão Core aceita uma sessão por servidor.
- Envio de imagem e documento por link pode exigir a versão Plus em algumas configurações. Texto funciona na Core.
- Importação de grupos funciona nas duas.
