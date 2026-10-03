// Junta os módulos de lib/ num único arquivo para o navegador: public/app/nucleo.js
// Uso: node scripts/montar.js
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const modulos = {
  './store': 'lib/store-web.js',
  './operacoes': 'lib/operacoes.js',
  './ia': 'lib/ia.js',
  './rotas': 'lib/rotas.js',
};
let saida = `/* Gerado por scripts/montar.js — não edite à mão (edite lib/ e rode o script). */
(function () {
  const definicoes = {};
  const prontos = {};
  function requerer(nome) {
    if (nome === '../public/shared.js') return window.Escala;
    if (prontos[nome]) return prontos[nome].exports;
    const m = (prontos[nome] = { exports: {} });
    definicoes[nome](m, m.exports, requerer);
    return m.exports;
  }
`;
for (const [nome, arq] of Object.entries(modulos)) {
  saida += `  definicoes[${JSON.stringify(nome)}] = function (module, exports, require) {\n${fs.readFileSync(path.join(raiz, arq), 'utf8')}\n  };\n`;
}
saida += `  window.Nucleo = requerer('./rotas');\n})();\n`;
fs.writeFileSync(path.join(raiz, 'public/app/nucleo.js'), saida);
console.log('public/app/nucleo.js gerado (' + Math.round(saida.length / 1024) + ' KB)');
