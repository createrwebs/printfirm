const fs = require('fs');

function insertNav(file, marker, line) {
  let text = fs.readFileSync(file, 'utf8');
  if (!text.includes('marketing:')) {
    text = text.replace(marker, marker + '\r\n' + line);
    fs.writeFileSync(file, text, 'utf8');
    console.log('Updated', file);
  }
}

insertNav('frontend/src/i18n/locales/th/shell.ts', "    home: 'หน้าแรก',", "    marketing: 'สตูดิโอการตลาด',");
insertNav('frontend/src/i18n/locales/en/shell.ts', "    home: 'Home',", "    marketing: 'Marketing Studio',");
insertNav('frontend/src/i18n/locales/zh/shell.ts', "    home: '首页',", "    marketing: '营销工作台',");
