'use strict';
const fs = require('fs');
const path = require('path');

const TITLE = 'Reporte cobertura microservicio: ms-auth';
const coverageDir = path.join(__dirname, '..', 'coverage');

const targets = [
  path.join(coverageDir, 'index.html'),
  path.join(coverageDir, 'lcov-report', 'index.html'),
];

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;

  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`);
  html = html.replace(/<h1>[^<]*<\/h1>/, `<h1>${TITLE}</h1>`);
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`Título actualizado: ${filePath}`);
}
