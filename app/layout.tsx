import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestión Dietética SaaS - Sistema de Facturación Electrónica AFIP",
  description: "Plataforma multi-tenant de gestión comercial y facturación electrónica para dietéticas, almacenes y kioscos en Argentina.",
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
