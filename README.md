# Plataforma SaaS de Gestión Comercial y Facturación AFIP

Este proyecto es una plataforma SaaS multi-tenant diseñada para comercios de distintos rubros en Argentina. Permite gestionar punto de venta (POS), controlar stock, registrar cuentas corrientes de clientes (fiados), emitir facturas electrónicas válidas ante AFIP (ARCA) y realizar cierres de caja. El sistema incluye una integración de suscripción mensual a través de Mercado Pago.

## Características Clave
- **Multi-tenancy estricto:** Aislamiento de datos comerciales por `empresaId`.
- **Facturación Electrónica AFIP (WSFEv1):** Generación automática de comprobantes A, B y C. Modo demo interno que no requiere certificados para pruebas iniciales, y conexión real con certificados encriptados en la base de datos (AES-256-GCM).
- **Límites de Suscripción:** Bloqueos automáticos si una empresa supera el límite de ventas mensuales o de usuarios del plan asignado.
- **Mercado Pago Integrado:** Pagos recurrentes de membresías, con un simulador de checkout local activable vía `DEMO_MODE=true`.
- **Estructura Serverless:** Un solo repositorio con Next.js (App Router), TypeScript y Prisma ORM. Listo para desplegar en Vercel con un solo click.

---

## 🛠️ Instalación y Configuración Local

### 1. Requisitos Previos
- Node.js (v18 o superior)
- Una base de datos PostgreSQL activa (puede ser local o en la nube mediante Neon/Supabase)

### 2. Clonar e Instalar Dependencias
Instalar los paquetes del proyecto:
```bash
npm install
```

### 3. Variables de Entorno
Copiar el archivo `.env.example` como `.env` en la raíz del proyecto:
```bash
cp .env.example .env
```
Abrir el archivo `.env` y configurar:
- `DATABASE_URL`: La cadena de conexión de tu Postgres.
- `JWT_SECRET`: Una clave de firma larga.
- `ENCRYPTION_KEY`: Una cadena hexadecimal de 64 caracteres (32 bytes) para el cifrado AES-256-GCM. Podés generar una rápida ejecutando:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Mantener `DEMO_MODE="true"` para probar el cobro de suscripción y facturación AFIP sin claves reales.

### 4. Inicializar Base de Datos y Semillado (Seed)
Ejecutar las migraciones de Prisma para crear las tablas en tu base de datos:
```bash
npx prisma migrate dev --name init
```
Una vez terminadas las migraciones, ejecutar el script de semillado para poblar los planes comerciales básicos, el usuario superadmin y los productos/empresa demo:
```bash
npx prisma db seed
```

### 5. Iniciar Servidor de Desarrollo
Correr la aplicación de manera local:
```bash
npm run dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 🔑 Cuentas de Acceso Rápidas (Creadas por el Seed)
- **Portal de Comercio Demo:**
  - **Usuario:** `demo@comerciopro.com`
  - **Contraseña:** `demo123`
  - *Acceso directo a la caja registradora, productos de prueba con bajo stock, cuentas corrientes e historial.*
- **Portal de Superadministrador (Dueño de la plataforma):**
  - **Usuario:** `superadmin@comerciopro.com`
  - **Contraseña:** `admin123`
  - *Permite ver métricas de uso global, suspender cuentas de comercios o cambiar planes de suscripción.*

---

## 🚀 Despliegue en Vercel (Producción)

Este proyecto está diseñado para funcionar de manera óptima en la infraestructura serverless de Vercel.

### Paso 1: Crear la Base de Datos en Neon o Vercel Postgres
1. Creá una cuenta en [Neon.tech](https://neon.tech) o iniciá sesión en Vercel.
2. Crea un nuevo proyecto PostgreSQL.
3. Copia la cadena de conexión de conexión provista (`postgres://...`).

### Paso 2: Conectar el repositorio y configurar variables en Vercel
1. Crea un repositorio en GitHub con tu código y sube tu proyecto.
2. Ve al panel de control de Vercel y haz clic en **"Add New"** -> **"Project"**.
3. Importa tu repositorio de GitHub.
4. Despliega la pestaña **Environment Variables** y añade las siguientes claves:
   - `DATABASE_URL`: La URL copiada en el Paso 1.
   - `JWT_SECRET`: Tu clave secreta aleatoria.
   - `ENCRYPTION_KEY`: La clave de cifrado hexadecimal de 64 caracteres.
   - `MP_ACCESS_TOKEN`: Tu token de producción/prueba real de Mercado Pago.
   - `MP_WEBHOOK_SECRET`: Firma para validar notificaciones de Mercado Pago.
   - `DEMO_MODE`: Cambiar a `false`.
   - `NEXT_PUBLIC_SITE_URL`: La dirección final de tu despliegue (ej. `https://mi-comercio-saas.vercel.app`).
5. En la configuración de build y desarrollo, Vercel ejecutará automáticamente `prisma generate` durante el empaquetado.

### Paso 3: Correr migraciones en producción
Una vez que el despliegue en Vercel sea exitoso, debes correr las migraciones contra tu base de datos de producción desde tu equipo local apuntando temporalmente tu archivo `.env` a la URL de producción, o ejecutando:
```bash
npx prisma db push
npx prisma db seed
```
¡Tu plataforma SaaS estará lista y operativa en producción!
