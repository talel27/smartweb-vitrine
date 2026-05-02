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
    const mainBranch = 'main';
    const featureBranch = modification.branch || 'feature/chatbot-modifications';
    const filePath = modification.page || 'index.html';

    console.log(`📁 Branche cible: ${featureBranch}`);
    console.log(`📁 Fichier: ${filePath}`);

    // ===== 1. VÉRIFIER SI LA BRANCHE FEATURE EXISTE =====
    console.log(`🔍 Vérification de l'existence de la branche ${featureBranch}...`);
    
    let branchExists = false;
    let branchSha = null;
    
    try {
      const branchesResponse = await fetch(
        `https://api.github.com/repos/${repo}/branches/${featureBranch}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      branchExists = branchesResponse.ok;
      
      if (branchExists) {
        const branchData = await branchesResponse.json();
        branchSha = branchData.commit.sha;
        console.log(`✅ Branche ${featureBranch} existe déjà (SHA: ${branchSha.substring(0, 7)})`);
      }
    } catch (error) {
      console.log('Erreur vérification branche:', error.message);
    }

    // ===== 2. CRÉER LA BRANCHE SI ELLE N'EXISTE PAS =====
    if (!branchExists) {
      console.log(`📁 Création de la branche ${featureBranch} à partir de ${mainBranch}...`);
      
      const mainRefResponse = await fetch(
        `https://api.github.com/repos/${repo}/git/refs/heads/${mainBranch}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (!mainRefResponse.ok) {
        throw new Error(`Impossible de récupérer la branche ${mainBranch}`);
      }
      
      const mainRef = await mainRefResponse.json();
      const mainSha = mainRef.object.sha;
      console.log(`📌 Dernier commit de main: ${mainSha.substring(0, 7)}`);
      
      const createBranchResponse = await fetch(
        `https://api.github.com/repos/${repo}/git/refs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            ref: `refs/heads/${featureBranch}`,
            sha: mainSha
          })
        }
      );
      
      if (!createBranchResponse.ok) {
        const errorData = await createBranchResponse.json();
        throw new Error(`Erreur création branche: ${errorData.message}`);
      }
      
      console.log(`✅ Branche ${featureBranch} créée avec succès`);
      branchSha = mainSha;
    }

    // ===== 3. RÉCUPÉRER LE FICHIER DEPUIS LA BRANCHE FEATURE =====
    console.log(`🔍 Récupération de ${filePath} depuis la branche ${featureBranch}...`);
    
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${featureBranch}`,
      {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    let currentContent, sha;
    
    if (getFileResponse.status === 404) {
      console.log(`📄 ${filePath} n'existe pas sur ${featureBranch}, récupération depuis ${mainBranch}...`);
      
      const mainFileResponse = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${mainBranch}`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (!mainFileResponse.ok) {
        throw new Error(`Fichier ${filePath} introuvable sur ${mainBranch}`);
      }
      
      const fileData = await mainFileResponse.json();
      currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      sha = fileData.sha;
      console.log(`✅ Fichier récupéré depuis ${mainBranch}`);
    } else if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      currentContent = Buffer.from(fileData.content, 'base64').toString('utf8');
      sha = fileData.sha;
      console.log(`✅ Fichier récupéré depuis ${featureBranch}`);
    } else {
      throw new Error(`Erreur récupération fichier: ${getFileResponse.status}`);
    }

    // ===== 4. APPLIQUER LA MODIFICATION =====
    console.log('✏️ Application de la modification...');
    let newContent = currentContent;
    
    switch(modification.type) {
      
      case 'add_meta':
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
        const h1Regex = /<h1>.*?<\/h1>/;
        if (h1Regex.test(newContent)) {
          newContent = newContent.replace(
            h1Regex,
            `<h1>${modification.content}</h1>`
          );
        } else {
          newContent = newContent.replace(
            '<body>',
            `<body>\n    <h1>${modification.content}</h1>`
          );
        }
        console.log('✅ H1 modifié/ajouté');
        break;

      case 'add_h2':
        const h2Regex = /<h2>.*?<\/h2>/;
        if (h2Regex.test(newContent)) {
          newContent = newContent.replace(
            h2Regex,
            `<h2>${modification.content}</h2>`
          );
        } else {
          newContent = newContent.replace(
            '</body>',
            `    <h2>${modification.content}</h2>\n</body>`
          );
        }
        console.log('✅ H2 ajouté/modifié');
        break;

      case 'add_alt':
        const imgRegex = /<img (?!.*alt=)[^>]*>/g;
        let matchCount = 0;
        newContent = newContent.replace(imgRegex, (match) => {
          matchCount++;
          return match.replace('<img', `<img alt="${modification.content}"`);
        });
        console.log(`✅ ALT ajouté à ${matchCount} image(s)`);
        break;

      case 'add_internal_links':
        let linksHtml = modification.content;
        // Format simplifié: /services,Nos services;/blog,Blog
        if (linksHtml.includes(',') && !linksHtml.includes('<a')) {
          const pairs = linksHtml.split(';');
          const links = [];
          for (const pair of pairs) {
            const [path, title] = pair.split(',');
            if (path && title) {
              links.push(`<a href="${path.trim()}">${title.trim()}</a>`);
            }
          }
          linksHtml = links.join(' | ');
        }
        newContent = newContent.replace(
          '</body>',
          `    <div class="internal-links">${linksHtml}</div>\n</body>`
        );
        console.log('✅ Liens internes ajoutés');
        break;

      case 'add_lang':
        if (!newContent.includes('<html lang="')) {
          newContent = newContent.replace(
            '<html',
            `<html lang="${modification.content || 'fr'}"`
          );
          console.log('✅ Attribut lang ajouté');
        }
        break;

      case 'add_viewport':
        if (!newContent.includes('name="viewport"')) {
          newContent = newContent.replace(
            '</head>',
            `  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>`
          );
          console.log('✅ Viewport ajouté');
        }
        break;

      case 'add_schema':
        const schemaContent = modification.content;
        if (newContent.includes('<script type="application/ld+json">')) {
          const schemaRegex = /<script type="application\/ld\+json">.*?<\/script>/s;
          newContent = newContent.replace(
            schemaRegex,
            `<script type="application/ld+json">${schemaContent}</script>`
          );
        } else {
          newContent = newContent.replace(
            '</body>',
            `  <script type="application/ld+json">${schemaContent}</script>\n</body>`
          );
        }
        console.log('✅ Données structurées ajoutées');
        break;

      case 'add_lazy_loading':
        newContent = newContent.replace(/<img /g, '<img loading="lazy" ');
        console.log('✅ Lazy loading ajouté');
        break;

      default:
        throw new Error(`Type de modification non supporté: ${modification.type}`);
    }

    // ===== 5. ENCODER ET POUSSER SUR LA BRANCHE FEATURE =====
    console.log(`📤 Push des modifications sur la branche ${featureBranch}...`);
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
          message: `🤖 ${modification.type} - ${filePath} - ${new Date().toISOString()}`,
          content: newContentBase64,
          sha: sha,
          branch: featureBranch
        })
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(errorData.message || 'Erreur GitHub');
    }

    const updateResult = await updateResponse.json();
    console.log(`✅ Modification poussée sur ${featureBranch}`);

    // ===== 6. URL DE LA PULL REQUEST =====
    const prUrl = `https://github.com/${repo}/compare/${mainBranch}...${featureBranch}?expand=1`;
    
    res.json({
      success: true,
      message: `✅ ${modification.type} appliqué sur **${featureBranch}** !\n\n🔗 Pull Request: ${prUrl}`,
      modification: modification,
      file: filePath,
      branch: featureBranch,
      commit_url: updateResult.commit?.html_url,
      pr_url: prUrl
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ 
      error: 'Erreur interne', 
      details: error.message 
    });
  }
};
