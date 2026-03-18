const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Gestion OPTIONS (préflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Vérification méthode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    // Vérification token dashboard
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== 'smartweb-2025-secret-token-123') {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { modification } = req.body;
    if (!modification || !modification.type) {
      return res.status(400).json({ error: 'Modification invalide' });
    }

    console.log('🚀 Modification reçue:', modification);

    // Récupération du token GitHub
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('❌ GITHUB_TOKEN manquant dans les variables Vercel');
      return res.status(500).json({ error: 'Configuration serveur incomplète' });
    }

    const repo = 'talel27/smartweb-vitrine';
    const branch = 'main';
    const filePath = 'index.html';

    // ===== 1. RÉCUPÉRER LE FICHIER =====
    console.log('🔍 Récupération du fichier depuis GitHub...');
    console.log(`📁 URL: https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`);
    
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    console.log('📨 Statut GitHub:', getFileResponse.status);

    if (!getFileResponse.ok) {
      const errorData = await getFileResponse.json();
      console.error('❌ Réponse GitHub erreur:', errorData);
      throw new Error(`GitHub API error: ${errorData.message || getFileResponse.status}`);
    }

    const fileData = await getFileResponse.json();
    console.log('✅ Fichier récupéré, SHA:', fileData.sha);
    console.log('📄 Type de contenu:', fileData.encoding);

    if (!fileData.content) {
      console.error('❌ Pas de contenu dans la réponse:', fileData);
      throw new Error('Le fichier récupéré ne contient pas de données');
    }

    // ===== 2. DÉCODER LE CONTENU =====
    console.log('🔓 Décodage du contenu base64...');
    const currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
    console.log('✅ Contenu décodé avec succès, longueur:', currentContent.length);
    console.log('📝 Premiers 100 caractères:', currentContent.substring(0, 100));

    // ===== 3. MODIFIER LE CONTENU =====
    console.log('✏️ Application de la modification...');
    let newContent = currentContent;
    
    if (modification.type === 'add_meta') {
      const metaRegex = /<meta name="description" content="[^"]*"/;
      if (metaRegex.test(newContent)) {
        console.log('🔄 Meta existante trouvée, remplacement...');
        newContent = newContent.replace(
          metaRegex,
          `<meta name="description" content="${modification.content}"`
        );
      } else {
        console.log('➕ Ajout d\'une nouvelle meta...');
        newContent = newContent.replace(
          '</head>',
          `  <meta name="description" content="${modification.content}">\n</head>`
        );
      }
    } else {
      return res.status(400).json({ error: 'Type de modification non supporté' });
    }

    // ===== 4. ENCODER EN BASE64 =====
    console.log('🔐 Encodage du nouveau contenu...');
    const newContentBase64 = Buffer.from(newContent).toString('base64');

    // ===== 5. POUSSER SUR GITHUB =====
    console.log('📤 Push des modifications sur GitHub...');
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
          message: `🤖 Modification auto: ${modification.type} - ${new Date().toISOString()}`,
          content: newContentBase64,
          sha: fileData.sha,
          branch: branch
        })
      }
    );

    console.log('📨 Statut GitHub push:', updateResponse.status);
    const updateResult = await updateResponse.json();

    if (!updateResponse.ok) {
      console.error('❌ Erreur GitHub push:', updateResult);
      throw new Error(updateResult.message || 'Erreur GitHub');
    }

    console.log('✅ Modification poussée avec succès sur GitHub');
    console.log('🔗 URL du commit:', updateResult.commit?.html_url);

    // ===== 6. SUCCÈS =====
    res.json({
      success: true,
      message: '✅ Site modifié via GitHub ! Le déploiement est en cours...',
      modification: modification,
      commit_url: updateResult.commit?.html_url
    });

  } catch (error) {
    console.error('❌ Erreur générale:', error);
    res.status(500).json({ 
      error: 'Erreur interne', 
      details: error.message,
      stack: error.stack
    });
  }
};
