// Gera o pacote limpo para entregar ao cliente: dist/prumo-crm-vX.Y.Z.zip
//   site/               telas (sobem no GitHub Pages do cliente)
//   planilha/Codigo.gs  servidor (vai no Apps Script da planilha)
//   docs/               guias
//   LEIA-ME.txt
// Uso: node ferramentas/empacotar.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const node = process.execPath;

// 1) servidor atualizado e testes passando
execFileSync(node, [path.join(__dirname, 'montar.js')], { stdio: 'inherit' });
execFileSync(node, [path.join(__dirname, 'testar.js')], { stdio: 'inherit' });

const versao = (fs.readFileSync(path.join(raiz, 'app/js/logica.js'), 'utf8').match(/PRUMO_VERSAO = '([\d.]+)'/) || [])[1] || '0.0.0';
const nome = 'prumo-crm-v' + versao;
const dist = path.join(raiz, 'dist');
const pasta = path.join(dist, nome);
fs.rmSync(pasta, { recursive: true, force: true });
fs.mkdirSync(path.join(pasta, 'planilha'), { recursive: true });

// 2) copia só o que o cliente precisa
fs.cpSync(path.join(raiz, 'app'), path.join(pasta, 'site'), { recursive: true });
fs.writeFileSync(path.join(pasta, 'site', '.nojekyll'), '');
fs.writeFileSync(path.join(pasta, 'site', 'config.js'),
  "/*\n * CONFIGURAÇÃO (opcional)\n * Cole aqui a URL do seu Apps Script (termina em /exec) para a equipe não precisar\n * colar o endereço na primeira tela. Deixe vazio para mostrar a tela de conexão.\n */\nwindow.PRUMO = {\n  API_URL: ''\n};\n");
fs.copyFileSync(path.join(raiz, 'backend/Codigo.gs'), path.join(pasta, 'planilha/Codigo.gs'));
fs.cpSync(path.join(raiz, 'docs'), path.join(pasta, 'docs'), { recursive: true });
fs.writeFileSync(path.join(pasta, 'LEIA-ME.txt'), [
  'PRUMO CRM ' + versao,
  '',
  'Conteúdo:',
  '  site/               arquivos do site. Sobem no seu GitHub (GitHub Pages).',
  '  planilha/Codigo.gs  código do servidor. Vai no Apps Script da sua planilha Google.',
  '  docs/               guias de instalação, WhatsApp e integrações.',
  '',
  'Comece por docs/INSTALACAO.md.',
  '',
  'Para ver uma demonstração com dados de exemplo, abra o site com ?demo=1 no fim do endereço.',
  ''
].join('\r\n'));

// 3) confere que nada pessoal ou de desenvolvimento foi junto
const proibidos = /dhione|cambraia|gmail\.com|4blue|LINK_PAGAMENTO|mercado ?pago/i;
const varrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return varrer(p);
  if (/\.(js|html|css|md|gs|txt|json|webmanifest)$/.test(e.name) && proibidos.test(fs.readFileSync(p, 'utf8'))) {
    throw new Error('Informação que não deveria ir no pacote em: ' + path.relative(pasta, p));
  }
});
varrer(pasta);

// 4) compacta
const zip = path.join(dist, nome + '.zip');
fs.writeFileSync(zip, criarZip(pasta));
console.log('Pacote pronto: ' + path.relative(raiz, zip));

/** Zip simples (deflate) em Node puro, sem depender de PowerShell nem do comando zip. */
function criarZip(base) {
  const zlib = require('zlib');
  const tabela = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = tabela[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const arquivos = [];
  const listar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) listar(p); else arquivos.push(p); });
  listar(base);
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const dia = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const partes = [], centrais = [];
  let pos = 0;
  arquivos.forEach((p) => {
    const nomeZip = Buffer.from(path.relative(base, p).split(path.sep).join('/'), 'utf8');
    const dados = fs.readFileSync(p), comp = zlib.deflateRawSync(dados), crc = crc32(dados);
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(20, 4); loc.writeUInt16LE(0x0800, 6); loc.writeUInt16LE(8, 8); loc.writeUInt16LE(hora, 10); loc.writeUInt16LE(dia, 12);
    loc.writeUInt32LE(crc, 14); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(dados.length, 22); loc.writeUInt16LE(nomeZip.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(hora, 12); cen.writeUInt16LE(dia, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(dados.length, 24); cen.writeUInt16LE(nomeZip.length, 28); cen.writeUInt32LE(pos, 42);
    partes.push(loc, nomeZip, comp);
    centrais.push(cen, nomeZip);
    pos += loc.length + nomeZip.length + comp.length;
  });
  const central = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(central.length, 12); fim.writeUInt32LE(pos, 16);
  return Buffer.concat(partes.concat([central, fim]));
}
