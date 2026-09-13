-- Mensaje de aviso manual (ROOT) que se muestra en el dashboard del comercio,
-- reemplazando al aviso automático de vencimiento próximo.
ALTER TABLE "Empresa" ADD COLUMN "mensajeAviso" TEXT;
