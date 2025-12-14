#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing Expo cache...');

// Clear .expo folder if it exists
const expoFolder = path.join(__dirname, '.expo');
if (fs.existsSync(expoFolder)) {
  console.log('🗂️ Removing .expo folder...');
  fs.rmSync(expoFolder, { recursive: true, force: true });
  console.log('✅ .expo folder removed!');
} else {
  console.log('ℹ️ .expo folder not found');
}

console.log('');
console.log('🚀 Next steps:');
console.log('   1. Run: npx expo start --clear');
console.log('   2. Or run: npm start');
console.log('');
console.log('✅ Cache clearing preparation complete!');