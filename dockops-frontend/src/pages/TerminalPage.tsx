import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { nodesApi } from '@/services/api';
import type { ServerNode } from '@/types';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

// VITE_API_URL is e.g. "https://143.198.160.235/dockops" — strip /dockops context and convert to ws
const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const WS_BASE = API_URL.replace(/^http/, 'ws').replace(/\/dockops$/, '');

export function TerminalPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    nodesApi.list().then((r) => {
      setNodes(r.data);
      if (r.data.length > 0) setNodeId(r.data[0].id);
    });
    return () => disconnect();
  }, []);

  const initTerminal = useCallback(() => {
    if (!containerRef.current) return;
    if (termRef.current) {
      termRef.current.dispose();
    }
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
      theme: {
        background: 'hsl(222 47% 8%)',
        foreground: 'hsl(210 40% 92%)',
        cursor: 'hsl(217 91% 60%)',
        selectionBackground: 'hsl(217 91% 60% / 0.3)',
        black: '#1e1e2e',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#cba6f7',
        cyan: '#89dceb',
        white: '#cdd6f4',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#cba6f7',
        brightCyan: '#89dceb',
        brightWhite: '#cdd6f4',
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    const ro = new ResizeObserver(() => {
      if (fitRef.current) fitRef.current.fit();
      sendResize();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const sendResize = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && termRef.current) {
      const { cols, rows } = termRef.current;
      wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!nodeId || connecting || connected) return;
    const token = localStorage.getItem('accessToken') || '';
    const url = `${WS_BASE}/dockops/terminal?nodeId=${nodeId}&token=${encodeURIComponent(token)}`;

    setConnecting(true);
    setError(null);
    const cleanup = initTerminal();

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      termRef.current?.clear();
      termRef.current?.writeln('\x1b[32mConnected to server.\x1b[0m');
      termRef.current?.focus();
      sendResize();
    };

    ws.onmessage = (event) => {
      termRef.current?.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
    };

    ws.onclose = (ev) => {
      setConnected(false);
      setConnecting(false);
      if (ev.reason) {
        termRef.current?.writeln(`\r\n\x1b[31mDisconnected: ${ev.reason}\x1b[0m`);
        setError(ev.reason);
      } else {
        termRef.current?.writeln('\r\n\x1b[33mConnection closed.\x1b[0m');
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setConnecting(false);
      setError('WebSocket connection failed');
    };

    termRef.current?.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    return cleanup;
  }, [nodeId, connected, connecting, initTerminal, sendResize]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Web Terminal</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Interactive SSH session in the browser</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
            value={nodeId}
            onChange={(e) => { disconnect(); setNodeId(e.target.value); }}
            disabled={connected || connecting}
          >
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.host})</option>)}
          </select>

          {connected ? (
            <Button variant="outline" size="sm" onClick={disconnect} className="text-[hsl(var(--destructive))]">
              <WifiOff className="w-4 h-4 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connect} disabled={connecting || !nodeId}>
              {connecting ? (
                <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4 mr-1" />
              )}
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs flex-shrink-0">
        <span className={`w-2 h-2 rounded-full ${connected ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground))]'}`} />
        <span className="text-[hsl(var(--muted-foreground))]">
          {connected ? `Connected to ${nodes.find((n) => n.id === nodeId)?.name || nodeId}` : 'Not connected'}
        </span>
        {error && <span className="text-[hsl(var(--destructive))]">— {error}</span>}
      </div>

      {/* Terminal */}
      <Card className="flex-1 overflow-hidden p-0 relative">
        <div
          ref={containerRef}
          className="w-full h-full rounded-lg overflow-hidden"
          style={{ minHeight: '500px', background: 'hsl(222 47% 8%)' }}
        />
        {!connected && !connecting && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer"
            onClick={connect}
            style={{ background: 'hsl(222 47% 8%)' }}
          >
            <TerminalIcon className="w-12 h-12 text-[hsl(var(--muted-foreground))]/40" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Select a node and click <strong>Connect</strong> to open a terminal session
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
