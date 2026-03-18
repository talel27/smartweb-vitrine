export default async function handler(req, res) {
  // 🔥 Ajout des en-têtes CORS pour autoriser localhost
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // 🔥 Gérer la méthode OPTIONS (préflight) - IMPORTANT pour CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Vérification du token
  const token = req.headers.authorization?.split(' ')[1];
  
  // Correction : ajout de la parenthèse fermante manquante
  if (token !== 'smartweb-2025-secret-token-123') {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  // Vérification de la méthode
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { modification } = req.body;

  try {
    // Vérifier que modification existe
    if (!modification) {
      return res.status(400).json({ error: 'Modification manquante' });
    }

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
      console.log('✅ Meta description modifiée:', modification.content);
    } else {
      return res.status(400).json({ error: 'Type de modification inconnu' });
    }
    
    // Sauvegarder le fichier
    fs.writeFileSync(filePath, content);
    console.log('📁 Fichier index.html sauvegardé');
    
    // Vérifier que les variables d'env sont présentes
    if (!process.env.VERCEL_TOKEN) {
      console.error('❌ VERCEL_TOKEN manquant');
      return res.status(500).json({ error: 'Configuration serveur incomplète' });
    }
    
    if (!process.env.VERCEL_PROJECT_NAME) {
      console.error('❌ VERCEL_PROJECT_NAME manquant');
      return res.status(500).json({ error: 'Configuration serveur incomplète' });
    }

    // Déclencher un nouveau déploiement sur Vercel
    console.log('🚀 Déclenchement du déploiement Vercel...');
    
    const deployResponse = await fetch('https://api.vercel.com/v1/deployments', {
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

    const deployData = await deployResponse.json();
    console.log('📦 Réponse Vercel:', deployData);

    if (!deployResponse.ok) {
      throw new Error(deployData.error?.message || 'Erreur déploiement Vercel');
    }

    res.json({ 
      success: true, 
      message: '✅ Site modifié et redéployé avec succès !',
      deployment: deployData
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
}
