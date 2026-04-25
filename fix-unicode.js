const fs = require('fs');
const path = require('path');

// مسیر فایل‌هایی که می‌خواهید اصلاح شوند را اینجا بدهید
const filesToFix = [
  './src/components/import/ImportFileManager.tsx',
  './src/components/import/ImportHistoryTable.tsx',
  './src/components/import/ImportUploadPanel.tsx'
];

filesToFix.forEach(filePath => {
  const absolutePath = path.resolve(__dirname, filePath);
  
  if (fs.existsSync(absolutePath)) {
    let content = fs.readFileSync(absolutePath, 'utf8');
    
    // تبدیل \uXXXX به کاراکتر اصلی
    const fixedContent = content.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });

    fs.writeFileSync(absolutePath, fixedContent, 'utf8');
    console.log(`✅ فایل اصلاح شد: ${filePath}`);
  } else {
    console.log(`❌ فایل پیدا نشد: ${filePath}`);
  }
});