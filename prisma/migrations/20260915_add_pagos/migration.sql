-- Historial de pagos cargado manualmente desde el panel ROOT
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "medioPago" TEXT NOT NULL,
    "concepto" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Pago_empresaId_fecha_idx" ON "Pago"("empresaId", "fecha");

ALTER TABLE "Pago" ADD CONSTRAINT "Pago_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
