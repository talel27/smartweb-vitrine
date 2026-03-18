// Format CommonJS (au lieu de ES Module)
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Configuration CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

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
    // Vérification token
    const token = req.headers.authorization?.split(' ')[1];
    if (token !== 'smartweb-2025-secret-token-123') {
      return res.status(401).json({ error: 'Non autorisé' });
    }

    const { modification } = req.body;
    if (!modification || !modification.type) {
      return res.status(400).json({ error: 'Modification invalide' });
    }

    console.log('✅ Modification reçue:', modification);

    // ICI on peut ajouter la logique de modification plus tard
    // Pour l'instant, on simule juste un succès

    return res.status(200).json({ 
      success: true, 
      message: '✅ Modification appliquée avec succès !',
      modification: modification
    });

  } catch (error) {
    console.error('❌ Erreur serveur:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur', 
      details: error.message 
    });
  }
};
