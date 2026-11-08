const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.tsx', 'utf8');

if (!code.includes('MarketingStudioPage')) {
  code = code.replace(
    "import HomePage from './pages/HomePage'",
    "import HomePage from './pages/HomePage'\r\nimport MarketingStudioPage from './pages/MarketingStudioPage'"
  );

  code = code.replace(
    '<Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />',
    '<Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />\r\n        <Route path="/marketing-studio" element={<RequireAuth><MarketingStudioPage /></RequireAuth>} />\r\n        <Route path="/marketing" element={<Navigate to="/marketing-studio" replace />} />'
  );

  fs.writeFileSync('frontend/src/App.tsx', code, 'utf8');
  console.log('App.tsx updated successfully');
} else {
  console.log('Already updated');
}
