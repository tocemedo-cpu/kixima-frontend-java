// src/realtime/RealtimeContext.jsx
// Uma única ligação STOMP por sessão — o Chat de Suporte, o Chat Comercial
// e as notificações partilham-na, cada um só ouvindo os destinos que lhe
// dizem respeito. Ligado ao ciclo de vida da sessão: liga quando há
// utilizador autenticado, desliga quando deixa de haver (logout, sessão
// expirada).
//
// O servidor é quem decide se uma subscrição é permitida — ver
// RealtimeAuthInterceptor.java no backend: subscrever `/topic/support/{id}`
// ou `/topic/conversation/{id}` sem autorização não dá acesso nenhum, o
// SUBSCRIBE é recusado com um frame ERROR (ver `onStompError` abaixo) — é
// isso (não a UI) que decide se a sala se junta. Backend fala STOMP nativo
// (Spring WebSocket), não Socket.IO — ver WebSocketConfig.java para o mapa
// completo evento↔destino.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import { useAuth } from '../auth/AuthContext';
import { apiBaseUrl, bearerNativoAtual } from '../api/client';

const RealtimeContext = createContext(null);

// O STOMP liga-se por `ws(s)://`, não por `http(s)://` — apiBaseUrl() dá a
// mesma origem que a API REST usa (ver api/client.js), só a troca de
// protocolo é preciso aqui. '' (origem actual, caso Web normal) resolve-se
// contra window.location.
function wsUrl(path) {
  const base = apiBaseUrl() || window.location.origin;
  return base.replace(/^http/, 'ws').replace(/\/$/, '') + path;
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);

  useEffect(() => {
    if (!user) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      setClient(null);
      setConnected(false);
      return undefined;
    }

    // O cookie httpOnly de sessão vai automaticamente no upgrade HTTP->WS
    // (mesma origem/mesmo site — ver RealtimeHandshakeInterceptor.java, que
    // o lê de aí). Dentro do Capacitor isso pode não chegar a ser guardado
    // (ver api/client.js) — por isso o MESMO Bearer em memória, aqui no
    // cabeçalho STOMP Authorization do CONNECT, que é onde o backend também
    // o procura como alternativa (ver RealtimeAuthInterceptor.tokenDoConnect).
    const c = new Client({
      brokerURL: wsUrl('/ws'),
      connectHeaders: bearerNativoAtual() ? { Authorization: `Bearer ${bearerNativoAtual()}` } : {},
      reconnectDelay: 4000,
      onConnect: () => setConnected(true),
      onDisconnect: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });
    c.activate();
    clientRef.current = c;
    setClient(c);

    return () => {
      c.deactivate();
      clientRef.current = null;
    };
    // Religa quando o ID muda (troca de conta) — não em cada atualização de
    // campos do user (avatar, nome), que não afetam a sessão da ligação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Subscrever É o pedido de acesso (ver RealtimeAuthInterceptor —
  // SUBSCRIBE é autorizado contra a BD, tal como um GET autenticado seria).
  // `handler` recebe o payload já desembrulhado do envelope { event,
  // payload }, filtrado pelo nome de evento pedido — uma única subscrição
  // STOMP por destino cobre vários eventos lógicos (ex.: support:message e
  // support:updated chegam ambos a /topic/support/{id}).
  function subscreverEventos(destino, mapaDeEventos) {
    if (!client || !connected) return () => {};
    const sub = client.subscribe(destino, (msg) => {
      let envelope;
      try { envelope = JSON.parse(msg.body); } catch { return; }
      const handler = mapaDeEventos[envelope.event];
      if (handler) handler(envelope.payload);
    });
    return () => sub.unsubscribe();
  }

  const value = useMemo(() => ({
    client, connected,
    subscribeNotifications: (onNotification) => subscreverEventos('/user/queue/notifications', { 'notification:new': onNotification }),
    subscribeTicket: (id, mapaDeEventos) => subscreverEventos(`/topic/support/${id}`, mapaDeEventos),
    subscribeConversation: (id, mapaDeEventos) => subscreverEventos(`/topic/conversation/${id}`, mapaDeEventos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [client, connected]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime deve ser usado dentro de <RealtimeProvider>.');
  return ctx;
}
