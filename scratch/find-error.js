
const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(path.join(process.cwd(), 'src', 'app'));

files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('e.json')) {
        console.log(`FOUND in ${file}:`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            if (line.includes('e.json')) {
                console.log(`${i + 1}: ${line}`);
            }
        });
    }
});
