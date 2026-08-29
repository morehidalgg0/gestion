-- Códigos de barra alternativos por producto (mismo artículo, varios proveedores)
CREATE TABLE "ProductoCodigo" (
    "id" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoCodigo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductoCodigo_productoId_codigo_key" ON "ProductoCodigo"("productoId", "codigo");
CREATE INDEX "ProductoCodigo_codigo_idx" ON "ProductoCodigo"("codigo");

-- AddForeignKey
ALTER TABLE "ProductoCodigo" ADD CONSTRAINT "ProductoCodigo_productoId_fkey"
FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
