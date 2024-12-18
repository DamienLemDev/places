import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import serverless from 'serverless-http';
import dotenv from 'dotenv';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();

// Singleton pour le client Prisma
let prisma: PrismaClient;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

app.use(express.json());  // Pour pouvoir traiter les requêtes JSON

// Middleware qui valide la signature et le timestamp
function secureMiddleware(req: Request, res: Response, next: Function): void {
  const clientSignature = req.headers['x-signature'] as string;
  const clientTimestamp = req.headers['x-timestamp'] as string;
  const maxTimeDiff = 300; // 5 minutes

  if (!clientSignature || !clientTimestamp) {
    res.status(400).json({ error: 'Requête non signée.' });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const requestTime = Math.floor(new Date(clientTimestamp).getTime() / 1000);

  if (Math.abs(now - requestTime) > maxTimeDiff) {
    res.status(403).json({ error: 'Requête expirée.' });
    return;
  }

  // Recalcule la signature côté serveur
  const method = req.method;
  const path = req.path;
  const body = JSON.stringify(req.body || {});
  const payload = `${method}${path}${body}${clientTimestamp}`;

  // Récupérer et valider le secret
  const SERVER_SECRET = process.env.SERVER_SECRET;
  if (!SERVER_SECRET) {
    throw new Error("SERVER_SECRET est manquant dans le fichier .env");
  }
  
  const serverSignature = crypto.createHmac('sha256', SERVER_SECRET).update(payload).digest('hex');

  if (clientSignature !== serverSignature) {
    res.status(403).json({ error: 'Signature invalide.' });
    return;
  }

  next();
}

// Middleware qui valide la clé API
function apiKeyMiddleware(req: Request, res: Response, next: Function): void {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'API Key requise.' });
    return;
  }

  // Vérifie si la clé existe dans la base de données
  prisma.apiKey.findUnique({
    where: { key: apiKey },
  })
  .then(apiKeyRecord => {
    if (!apiKeyRecord) {
      return res.status(401).json({ error: 'API Key invalide.' });
    }

    const now = new Date();
    if (now > apiKeyRecord.expiresAt) {
      return res.status(403).json({ error: 'API Key expirée.' });
    }
    
    next(); // Si la clé est valide, passe à l'étape suivante
  })
  .catch(error => {
    res.status(500).json({ error: 'Erreur de validation de la clé API.', details: error });
  });
}

// Rate limiter : Limiter le nombre de requêtes par clé API
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes maximum par clé API
  keyGenerator: (req) => {
    // Assurer que la clé est une chaîne, même si le header est un tableau
    const apiKey = req.headers['x-api-key'];
    return Array.isArray(apiKey) ? apiKey[0] : apiKey || ''; // Prendre la première valeur si c'est un tableau
  }, // Utiliser l'API Key comme identifiant
  message: { error: 'Trop de requêtes. Essayez de nouveau plus tard.' },
});

app.post('/generate-api-key', secureMiddleware, async (req: Request, res: Response) => {
  const { name } = req.body; // Nom de l'application ou de la plateforme

  if (!name) {
    res.status(400).json({ error: 'Le champ "name" est requis.' });
    return;
  }

  const apiKey = crypto.randomBytes(32).toString('hex'); // Génération de la clé API
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // Expiration dans 1 heure

  try {
    const newKey = await prisma.apiKey.create({
      data: {
        name,
        key: apiKey,
        expiresAt,
      },
    });

    res.status(201).json({ 
      apiKey: newKey.key, 
      expiresAt: newKey.expiresAt,
      message: `Clé API générée avec succès pour ${name}.` 
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la génération de la clé API.', details: error });
  }
});

// Route pour récupérer toutes les places
app.get('/places', apiKeyMiddleware, rateLimiter, async (req: Request, res: Response) => {
  try {
    const places = await prisma.place.findMany();
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: 'Erreur du serveur', details: error });
  }
});

// Route pour ajouter une nouvelle place
app.post('/places', apiKeyMiddleware, rateLimiter, async (req: Request, res: Response) => {
  const { latitude, longitude } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Latitude et longitude doivent être des nombres' });
    return;
  }

  try {
    const newPlace = await prisma.place.create({
      data: {
        latitude,
        longitude,
      },
    });
    res.status(201).json(newPlace);
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la place', details: error  });
  }
});

app.get('/test-db', async (req: Request, res: Response) => {
    try {
      await prisma.$connect();
      res.json({ message: 'Connexion réussie à la base de données RDS.' });
    } catch (error) {
      res.status(500).json({ error: 'Erreur de connexion à la base de données.', details: error });
    } finally {
      await prisma.$disconnect();
    }
  });

// Exporter l'application Express pour Lambda
exports.handler = serverless(app);  // Utiliser serverless-http pour transformer Express en Lambda handler

