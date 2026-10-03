const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

for (const file of ['index.html', 'style.css', 'app.js', 'ai-service.js']) {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log('Static build prepared in dist/');
