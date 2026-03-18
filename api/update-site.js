export default async function handler(req, res) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (token !== 'smartweb-2025-secret-token-123') {
    return res.status(401).json({ error: 'Non autorisé' });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { modification } = req.body;

  try {
  
    const fs = require('fs');
    const path = require('path');
    
    const filePath = path.join(process.cwd(), 'index.html');
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (modification.type === 'add_meta') {
      const metaRegex = /<meta name="description" content="[^"]*"/;
      if (metaRegex.test(content)) {
        content = content.replace(
          metaRegex,
          `<meta name="description" content="${modification.content}"`
        );
      } else {
        content = content.replace(
          '</head>',
          `  <meta name="description" content="${modification.content}">\n</head>`
        );
      }
    }
    
    fs.writeFileSync(filePath, content);
    
    await fetch('https://api.vercel.com/v1/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: process.env.VERCEL_PROJECT_NAME,
        files: [{ file: 'index.html', data: content }]
      })
    });

    res.json({ 
      success: true, 
      message: '✅ Site modifié et redéployé avec succès !' 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
