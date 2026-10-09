// src/realtime/RealtimeContext.test.jsx
// A ligação STOMP usa a MESMA base e o MESMO Bearer que a API REST (ver
// api/client.js) — dentro do Capacitor, '/' e o cookie sozinho não chegam,
// exatamente como já não chegavam para o fetch antes dessa correção.
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const activate = vi.fn();
const deactivate = vi.fn();
const ClientMock = vi.fn(function Client() {
  return { activate, deactivate, subscribe: vi.fn() };
});
vi.mock('@stomp/stompjs', () => ({ Client: ClientMock }));

async function carregarComo({ nativo, user }) {
  vi.resetModules();
  ClientMock.mockClear();
  activate.mockClear();
  if (nativo) window.Capacitor = { isNativePlatform: () => true };
  else delete window.Capacitor;

  vi.doMock('../auth/AuthContext', () => ({ useAuth: () => ({ user }) }));
  const clientModule = await import('../api/client');
  const { RealtimeProvider } = await import('./RealtimeContext');
  return { clientModule, RealtimeProvider };
}

beforeEach(() => { delete window.Capacitor; });
afterEach(() => { delete window.Capacitor; vi.doUnmock('../auth/AuthContext'); });

test('Web: liga a /ws na origem actual, sem cabeçalho Authorization', async () => {
  const { RealtimeProvider } = await carregarComo({ nativo: false, user: { id: 'u1' } });
  render(<RealtimeProvider>{null}</RealtimeProvider>);

  await waitFor(() => expect(ClientMock).toHaveBeenCalled());
  const [opts] = ClientMock.mock.calls[0];
  expect(opts.brokerURL).toBe(`${window.location.origin.replace(/^http/, 'ws')}/ws`);
  expect(opts.connectHeaders).toEqual({});
  expect(activate).toHaveBeenCalled();
});

test('Capacitor nativo: liga a wss://kixima.net/ws, com o Bearer em memória no cabeçalho', async () => {
  const { clientModule, RealtimeProvider } = await carregarComo({ nativo: true, user: { id: 'u1' } });
  clientModule.definirBearerNativo('jwt-de-teste');

  render(<RealtimeProvider>{null}</RealtimeProvider>);

  await waitFor(() => expect(ClientMock).toHaveBeenCalled());
  const [opts] = ClientMock.mock.calls[0];
  expect(opts.brokerURL).toBe('wss://kixima.net/ws');
  expect(opts.connectHeaders).toEqual({ Authorization: 'Bearer jwt-de-teste' });
});

test('sem utilizador, não cria ligação nenhuma', async () => {
  const { RealtimeProvider } = await carregarComo({ nativo: false, user: null });
  render(<RealtimeProvider>{null}</RealtimeProvider>);
  expect(ClientMock).not.toHaveBeenCalled();
});
