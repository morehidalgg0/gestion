-- Descuentos en ventas: monto total descontado por ticket, y % informativo por línea
ALTER TABLE "Venta" ADD COLUMN "descuentoTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "VentaItem" ADD COLUMN "descuentoPorcentaje" DECIMAL(5,2);
