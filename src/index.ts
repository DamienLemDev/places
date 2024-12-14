import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());  // Pour pouvoir traiter les requêtes JSON

// Route pour récupérer toutes les places
app.get('/places', async (req: Request, res: Response) => {
  try {
    const places = await prisma.place.findMany();
    res.json(places);
  } catch (error) {
    res.status(500).json({ error: 'Erreur du serveur' });
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
    res.status(500).json({ error: 'Erreur lors de l\'ajout de la place' });
  }
});

// Lancer le serveur sur le port 3000
const port = 3000;
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
