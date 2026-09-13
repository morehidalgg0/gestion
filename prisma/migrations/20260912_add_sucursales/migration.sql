-- Límite de sucursales por plan (0 = sin límite)
ALTER TABLE "Plan" ADD COLUMN "limiteSucursales" INTEGER NOT NULL DEFAULT 1;

-- Sucursales/depósitos de cada empresa, administradas desde el panel ROOT
CREATE TABLE "Sucursal" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sucursal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Sucursal_empresaId_nombre_key" ON "Sucursal"("empresaId", "nombre");

ALTER TABLE "Sucursal" ADD CONSTRAINT "Sucursal_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
