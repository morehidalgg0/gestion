'use client';

import { AlertTriangle } from 'lucide-react';

const DIAS_ANTES_DE_AVISAR = 7;

function mensajeAutomatico(vencimiento?: string | null): string | null {
  if (!vencimiento) return null;
  const dias = Math.ceil((new Date(vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias > DIAS_ANTES_DE_AVISAR) return null;

  const fecha = new Date(vencimiento).toLocaleDateString('es-AR');
  if (dias < 0) {
    return `Tu suscripción venció el ${fecha}. Comunicate con tu asesor para abonar y evitar la suspensión del servicio.`;
  }
  if (dias === 0) {
    return `Tu suscripción vence hoy (${fecha}). Comunicate con tu asesor para abonar y evitar la suspensión del servicio.`;
  }
  return `Tu suscripción vence el ${fecha} (en ${dias} día${dias === 1 ? '' : 's'}). Comunicate con tu asesor para abonar y evitar la suspensión del servicio.`;
}

export default function AvisoSuscripcion({ empresa }: { empresa: any }) {
  if (!empresa) return null;

  const mensaje = (empresa.mensajeAviso && empresa.mensajeAviso.trim())
    ? empresa.mensajeAviso.trim()
    : mensajeAutomatico(empresa.suscripcion?.vencimiento);

  if (!mensaje) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.85rem 1rem',
        backgroundColor: '#fef3c7',
        color: '#92400e',
        borderLeft: '4px solid #f59e0b',
        borderRadius: 'var(--radius-sm)',
        marginBottom: '1.5rem',
        fontSize: '0.9rem',
      }}
    >
      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
      <span>{mensaje}</span>
    </div>
  );
}
