const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8080;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

http.createServer(function (request, response) {
    // Tratar URL com espaços e query params
    let cleanUrl = request.url.split('?')[0].split('#')[0];
    let filePath = '.' + decodeURI(cleanUrl);

    if (filePath == './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, function (error, content) {
        if (error) {
            if (error.code == 'ENOENT') {
                console.log(`[404] ${filePath}`);
                response.writeHead(404, { 'Content-Type': 'text/plain' });
                response.end('Arquivo nao encontrado: ' + filePath);
            } else {
                console.log(`[500] ${filePath} - ${error.code}`);
                response.writeHead(500);
                response.end('Erro interno: ' + error.code);
            }
        } else {
            console.log(`[200] ${filePath}`);
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });

}).listen(port);

console.log('=========================================');
console.log(`Servidor rodando em: http://127.0.0.1:${port}/`);
console.log('Para usar o Google Auth, acesse por este link!');
console.log('CTRL+C para parar');
console.log('=========================================');
