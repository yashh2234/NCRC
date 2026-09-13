const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/components/TestResultTables');
const files = fs.readdirSync(dir);

for (const file of files) {
  if (file.endsWith('.tsx')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Some files actually use React.Fragment, so we shouldn't completely remove React if it's used.
    if (!content.includes('React.Fragment')) {
      content = content.replace("import React from 'react'\n", '');
    }
    
    content = content.replace("import { TableProps }", "import type { TableProps }");
    
    if (file === 'GenericTable.tsx') {
      content = content.replace("updateDetail: any", "updateDetail?: any");
    }
    
    fs.writeFileSync(filePath, content);
  }
}

// Fix ReportEditPage.tsx
const reportPagePath = path.join(__dirname, 'src/pages/ReportEditPage.tsx');
let reportContent = fs.readFileSync(reportPagePath, 'utf-8');
reportContent = reportContent.replace("import React, { useEffect, useState } from 'react'", "import { useEffect, useState } from 'react'");
fs.writeFileSync(reportPagePath, reportContent);
