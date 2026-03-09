const fs = require('fs');
const files = ['personal-pages.js', 'student-auth.js', 'student-pages.js', 'personal-features.js'];

files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');

    // Replace all occurrences of database methods containing 'students'
    const operations = ['getById', 'update', 'delete', 'create', 'query'];

    operations.forEach(op => {
        const regex = new RegExp(`db\\.${op}\\('students'`, 'g');
        code = code.replace(regex, `db.${op}('profiles'`);
    });

    fs.writeFileSync(file, code);
    console.log(`Updated ${file}`);
});
