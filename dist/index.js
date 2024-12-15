"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const serverless_http_1 = __importDefault(require("serverless-http"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Singleton pour le client Prisma
let prisma;
if (process.env.NODE_ENV === 'production') {
    prisma = new client_1.PrismaClient();
}
else {
    if (!global.prisma) {
        global.prisma = new client_1.PrismaClient();
    }
    prisma = global.prisma;
}
app.use(express_1.default.json()); // Pour pouvoir traiter les requêtes JSON
console.log("DATABASE_URL:", process.env.DATABASE_URL);
// Route pour récupérer toutes les places
app.get('/places', async (req, res) => {
    try {
        const places = await prisma.place.findMany();
        res.json(places);
    }
    catch (error) {
        res.status(500).json({ error: 'Erreur du serveur' });
    }
});
// Route pour ajouter une nouvelle place
app.post('/places', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Erreur lors de l\'ajout de la place' });
    }
});
app.get('/test-db', async (req, res) => {
    try {
        await prisma.$connect();
        res.json({ message: 'Connexion réussie à la base de données RDS.' });
    }
    catch (error) {
        res.status(500).json({ error: 'Erreur de connexion à la base de données.', details: error });
    }
    finally {
        await prisma.$disconnect();
    }
});
// Lancer le serveur sur le port 3000 en localhost
/*const port = 3000;
app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});*/
// Exporter l'application Express pour Lambda
exports.handler = (0, serverless_http_1.default)(app); // Utiliser serverless-http pour transformer Express en Lambda handler
