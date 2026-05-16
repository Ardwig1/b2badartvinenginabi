const fs = require('fs');
const path = 'app/admin/products/page.js';
let content = fs.readFileSync(path, 'utf8');

// Replace rates.USD.toLocaleString with Number(rates.USD).toLocaleString
content = content.replace(/rates\.USD\.toLocaleString/g, 'Number(rates.USD).toLocaleString');
content = content.replace(/rates\.EUR\.toLocaleString/g, 'Number(rates.EUR).toLocaleString');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed rates toLocaleString');
