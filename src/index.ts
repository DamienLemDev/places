import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import serverless from 'serverless-http';
import dotenv from 'dotenv';

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

console.log("DATABASE_URL:", process.env.DATABASE_URL);

// Route pour récupérer toutes les places
app.get('/places', async (req: Request, res: Response) => {
  try {
    const places = await prisma.place.findMany();
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: 'Erreur du serveur', details: error });
  }
});

// Route pour ajouter une nouvelle place
app.post('/places', async (req: Request, res: Response) => {
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

// Lancer le serveur sur le port 3000 en localhost
/*const port = 3000;
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});*/

// Exporter l'application Express pour Lambda
exports.handler = serverless(app);  // Utiliser serverless-http pour transformer Express en Lambda handler

