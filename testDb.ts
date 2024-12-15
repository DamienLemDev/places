import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("Connexion réussie à la base de données avec Node.js !");
  } catch (error) {
    console.error("Erreur de connexion à la base de données :", error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();