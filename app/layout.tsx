import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ComercioPro - Gestión Comercial y Facturación Electrónica",
  description: "Plataforma multi-tenant de gestión comercial, punto de venta, stock y facturación electrónica para comercios en Argentina.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}
