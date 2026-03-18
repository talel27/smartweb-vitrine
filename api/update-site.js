const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== 'smartweb-2025-secret-token-123') {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { modification } = req.body;
    if (!modification || !modification.type) {
      return res.status(400).json({ error: 'Modification invalide' });
    }

    const githubToken = process.env.GITHUB_TOKEN; // À ajouter dans les variables Vercel
    const repo = 'ton-compte/smartweb-vitrine';
    const branch = 'main';
    const filePath = 'index.html';

    // 1. Récupérer le fichier actuel et son SHA
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    const fileData = await getFileResponse.json();
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    const sha = fileData.sha;

    // 2. Modifier le contenu
    let newContent = currentContent;
    
    if (modification.type === 'add_meta') {
      const metaRegex = /<meta name="description" content="[^"]*"/;
      if (metaRegex.test(newContent)) {
        newContent = newContent.replace(
          metaRegex,
          `<meta name="description" content="${modification.content}"`
        );
      } else {
        newContent = newContent.replace(
          '</head>',
          `  <meta name="description" content="${modification.content}">\n</head>`
        );
      }
    }

    // 3. Encoder en base64
    const newContentBase64 = Buffer.from(newContent).toString('base64');

    // 4. Pousser la modification sur GitHub
    const updateResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          message: `🤖 Modification auto: ${modification.type}`,
          content: newContentBase64,
          sha: sha,
          branch: branch
        })
      }
    );

    const updateResult = await updateResponse.json();

    if (!updateResponse.ok) {
      throw new Error(updateResult.message || 'Erreur GitHub');
    }

    // 5. Déclencher un déploiement Vercel (optionnel car GitHub push déclenche auto)
    console.log('✅ Modification poussée sur GitHub');

    res.json({
      success: true,
      message: '✅ Site modifié via GitHub ! Le déploiement est en cours...',
      modification: modification
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur interne', 
      details: error.message 
    });
  }
};
