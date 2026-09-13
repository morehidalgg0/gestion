'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

const SALUDO: Msg = {
  role: 'assistant',
  content: 'Hola 👋 Soy el asistente de ComercioPro. Preguntame cómo usar cualquier parte del sistema (cargar un producto, hacer una venta, cerrar la caja, etc.).',
};

export default function AsistenteChat({ rol }: { rol?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([SALUDO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/tenant/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, rol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar al asistente.');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }}>
      {open && (
        <div
          style={{
            width: '340px',
            maxWidth: 'calc(100vw - 2rem)',
            height: '460px',
            maxHeight: 'calc(100vh - 8rem)',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color, #e5e7eb)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '0.75rem',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--primary, #4f46e5)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <Bot size={16} />
              Asistente ComercioPro
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  backgroundColor: m.role === 'user' ? 'var(--primary, #4f46e5)' : 'var(--bg-secondary)',
                  color: m.role === 'user' ? '#fff' : 'inherit',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.85rem',
                  maxWidth: '85%',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Escribiendo...
              </div>
            )}
            {error && (
              <div style={{ color: '#b91c1c', fontSize: '0.8rem' }}>⚠️ {error}</div>
            )}
          </div>

          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.4rem', padding: '0.6rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Escribí tu pregunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              style={{ flex: 1, fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()} style={{ padding: '0.4rem 0.6rem' }}>
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir asistente"
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary, #4f46e5)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
          marginLeft: 'auto',
        }}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
