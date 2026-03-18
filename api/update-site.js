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

    console.log('🚀 Modification reçue:', modification);

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('❌ GITHUB_TOKEN manquant');
      return res.status(500).json({ error: 'Configuration serveur incomplète' });
    }

    const repo = 'talel27/smartweb-vitrine';
    const branch = 'main';
    const filePath = 'index.html';

    // ===== RÉCUPÉRER LE FICHIER =====
    console.log('🔍 Récupération du fichier depuis GitHub...');
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (!getFileResponse.ok) {
      const errorData = await getFileResponse.json();
      throw new Error(`GitHub API error: ${errorData.message}`);
    }

    const fileData = await getFileResponse.json();
    let currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    let newContent = currentContent;

    // ===== APPLIQUER LES DIFFÉRENTS TYPES DE MODIFICATIONS =====
    switch(modification.type) {
      
      case 'add_meta':
        // ✅ Ajouter/Modifier la meta description
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
        console.log('✅ Meta description modifiée');
        break;

      case 'update_title':
        // 🔤 Modifier le titre de la page
        const titleRegex = /<title>.*?<\/title>/;
        if (titleRegex.test(newContent)) {
          newContent = newContent.replace(
            titleRegex,
            `<title>${modification.content}</title>`
          );
          console.log('✅ Titre modifié');
        } else {
          throw new Error('Balise title non trouvée');
        }
        break;

      case 'add_h1':
        // 📑 Ajouter ou modifier H1
        const h1Regex = /<h1>.*?<\/h1>/;
        if (h1Regex.test(newContent)) {
          newContent = newContent.replace(
            h1Regex,
            `<h1>${modification.content}</h1>`
          );
        } else {
          // Ajouter un H1 après le body
          newContent = newContent.replace(
            '<body>',
            `<body>\n    <h1>${modification.content}</h1>`
          );
        }
        console.log('✅ H1 modifié/ajouté');
        break;

      case 'add_alt':
        // 🖼️ Ajouter ALT à une image spécifique
        const imgSelector = modification.selector || 'img';
        const altRegex = new RegExp(`<${imgSelector}[^>]*>`, 'g');
        let matchCount = 0;
        
        newContent = newContent.replace(altRegex, (match) => {
          if (!match.includes('alt=')) {
            matchCount++;
            return match.replace('<img', `<img alt="${modification.content}"`);
          }
          return match;
        });

        if (matchCount === 0) {
          throw new Error('Aucune image sans alt trouvée');
        }
        console.log(`✅ ALT ajouté à ${matchCount} image(s)`);
        break;

      case 'add_schema':
        // 🔍 Ajouter des données structurées
        const schemaTag = '<script type="application/ld+json">';
        const schemaContent = modification.content;
        
        if (newContent.includes(schemaTag)) {
          // Remplacer le schema existant
          const schemaRegex = /<script type="application\/ld\+json">.*?<\/script>/s;
          newContent = newContent.replace(
            schemaRegex,
            `<script type="application/ld+json">${schemaContent}</script>`
          );
        } else {
          // Ajouter avant la fermeture de </body>
          newContent = newContent.replace(
            '</body>',
            `  <script type="application/ld+json">${schemaContent}</script>\n</body>`
          );
        }
        console.log('✅ Données structurées ajoutées');
        break;

      case 'add_lang':
        // 🌐 Ajouter l'attribut lang
        if (!newContent.includes('<html lang="')) {
          newContent = newContent.replace(
            '<html',
            `<html lang="${modification.content || 'fr'}"`
          );
          console.log('✅ Attribut lang ajouté');
        }
        break;

      case 'add_viewport':
        // 📱 Ajouter la balise viewport
        if (!newContent.includes('name="viewport"')) {
          newContent = newContent.replace(
            '</head>',
            `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>`
          );
          console.log('✅ Viewport ajouté');
        }
        break;

      default:
        throw new Error(`Type de modification non supporté: ${modification.type}`);
    }

    // ===== ENCODER ET POUSSER =====
    const newContentBase64 = Buffer.from(newContent).toString('base64');

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
          message: `🤖 ${modification.type} - ${new Date().toISOString()}`,
          content: newContentBase64,
          sha: fileData.sha,
          branch: branch
        })
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(errorData.message || 'Erreur GitHub');
    }

    const updateResult = await updateResponse.json();

    res.json({
      success: true,
      message: `✅ ${modification.type} appliqué avec succès ! Déploiement en cours...`,
      modification: modification,
      commit_url: updateResult.commit?.html_url
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur interne', 
      details: error.message 
    });
  }
};
