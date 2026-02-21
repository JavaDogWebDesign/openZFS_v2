import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface UseSocketOptions {
  /** Socket.IO namespace (e.g., '/monitoring') */
  namespace?: string;
  /** Whether to auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for Socket.IO connections with auto-reconnect.
 * Creates a socket connection on mount and cleans up on unmount.
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { namespace = '', autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl = namespace ? `/${namespace.replace(/^\//, '')}` : '/';

    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (_err) => {
      setIsConnected(false);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [namespace, autoConnect]);

  const connect = () => {
    socketRef.current?.connect();
  };

  const disconnect = () => {
    socketRef.current?.disconnect();
  };

  return {
    socket: socketRef.current,
    isConnected,
    connect,
    disconnect,
  };
}
