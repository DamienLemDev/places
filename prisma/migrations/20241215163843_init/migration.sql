-- CreateTable
CREATE TABLE "Place" (
    "id" SERIAL NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);
