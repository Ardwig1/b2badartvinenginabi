const fs = require('fs');
const path = require('fs');

// Simple script to find table.column patterns in the code
// and list tables mentioned in supabase.from('...')

const dir = '.';
const tables = {};

function scan(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = directory + '/' + file;
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
                scan(fullPath);
            }
        } else if (file.endsWith('.js') || file.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Match supabase.from('table')
            const fromMatches = content.matchAll(/from\(['"](\w+)['"]\)/g);
            for (const match of fromMatches) {
                const table = match[1];
                if (!tables[table]) tables[table] = new Set();
            }

            // Match select('col1, col2, ...')
            const selectMatches = content.matchAll(/\.select\(['"]([^'"]+)['"]\)/g);
            for (const match of selectMatches) {
                const cols = match[1].split(',').map(c => c.trim().split(':')[0].split('(')[0]);
                // This is very rough but helps
            }
            
            // Match update({ col: val }) or insert({ col: val })
            const actionMatches = content.matchAll(/\.(update|insert|upsert)\(\{([^}]+)\}\)/g);
            for (const match of actionMatches) {
                const props = match[2].matchAll(/(\w+):/g);
                // Can't easily tell which table without context
            }
        }
    }
}

scan('.');
console.log('Tables found in code:', Object.keys(tables));
