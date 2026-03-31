const fs = require('fs');
try {
    const file = 'admin-pages.js';
    let content = fs.readFileSync(file, 'utf8');
    let reversed = Buffer.from(content, 'latin1').toString('utf8');
    fs.writeFileSync(file, reversed, 'utf8');
    console.log('Reversed transcode successfully!');
} catch (e) {
    console.error(e);
}
