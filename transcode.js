const fs = require('fs');

try {
    const file = 'admin-pages.js';
    let buf = fs.readFileSync(file);
    // Convert buffer to string assuming latin1 if it contains invalid utf8
    let content = buf.toString('latin1');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Transcoded to utf8');
} catch (e) {
    console.error(e);
}
