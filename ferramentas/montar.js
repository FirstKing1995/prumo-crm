// Gera backend/Codigo.gs (um arquivo só, para colar no Apps Script) juntando
// a lógica compartilhada (app/js/logica.js) com a plataforma do Apps Script.
// Uso: node ferramentas/montar.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const logica = fs.readFileSync(path.join(raiz, 'app/js/logica.js'), 'utf8')
  .replace(/\nif \(typeof module !== 'undefined'\)[^\n]*\n?/, '\n');
const plataforma = fs.readFileSync(path.join(raiz, 'backend/plataforma.gs'), 'utf8');
const saida = plataforma + '\n\n' + logica;
fs.writeFileSync(path.join(raiz, 'backend/Codigo.gs'), saida);
console.log('backend/Codigo.gs gerado (' + saida.split('\n').length + ' linhas)');
