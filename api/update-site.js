const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Gestion OPTIONS
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

    // 🔥 VRAIE MODIFICATION DU FICHIER
    const filePath = path.join(process.cwd(), 'index.html');
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (modification.type === 'add_meta') {
      // Vérifier si la meta existe déjà
      const metaRegex = /<meta name="description" content="[^"]*"/;
      if (metaRegex.test(content)) {
        // Remplacer la meta existante
        content = content.replace(
          metaRegex,
          `<meta name="description" content="${modification.content}"`
        );
      } else {
        // Ajouter la meta dans le head
        content = content.replace(
          '</head>',
          `  <meta name="description" content="${modification.content}">\n</head>`
        );
      }
    }
    
    // Sauvegarder le fichier
    fs.writeFileSync(filePath, content);
    console.log('✅ Fichier modifié avec succès !');

    return res.status(200).json({ 
      success: true, 
      message: '✅ Site réellement modifié !',
      modification: modification
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    return res.status(500).json({ 
      error: 'Erreur interne', 
      details: error.message 
    });
  }
};
