import { useEffect, useState } from 'react';
import { Play, Square, RotateCcw, Trash2, Terminal, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { containersApi, nodesApi } from '@/services/api';
import type { Container, ServerNode } from '@/types';

function containerStateBadge(state: string): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (state === 'running') return 'success';
  if (state === 'exited') return 'destructive';
  if (state === 'paused') return 'warning';
  return 'secondary';
}

export function ContainersPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<{ containerId: string; lines: string[] } | null>(null);

  useEffect(() => {
    nodesApi.list().then((res) => {
      setNodes(res.data);
      if (res.data.length > 0) setSelectedNode(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedNode) return;
    setLoading(true);
    containersApi.list(selectedNode)
      .then((res) => setContainers(res.data))
      .finally(() => setLoading(false));
  }, [selectedNode]);

  const doAction = async (containerId: string, action: string) => {
    setActionLoading((a) => ({ ...a, [containerId]: true }));
    try {
      await containersApi.action(selectedNode, containerId, action);
      const res = await containersApi.list(selectedNode);
      setContainers(res.data);
    } finally {
      setActionLoading((a) => ({ ...a, [containerId]: false }));
    }
  };

  const showLogs = async (containerId: string) => {
    const res = await containersApi.logs(selectedNode, containerId, 200);
    setLogs({ containerId, lines: res.data });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Containers</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{containers.length} containers on selected node</p>
        </div>
        <div className="flex gap-2">
          <select
            className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
            value={selectedNode}
            onChange={(e) => setSelectedNode(e.target.value)}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>{n.name} ({n.host})</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => {
            if (selectedNode) {
              setLoading(true);
              containersApi.list(selectedNode).then((res) => setContainers(res.data)).finally(() => setLoading(false));
            }
          }}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                {['Name', 'Image', 'Status', 'Ports', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">Loading containers...</td></tr>
              ) : containers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">No containers found</td></tr>
              ) : containers.map((c) => (
                <tr key={c.containerId} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/50">
                  <td className="px-4 py-3 font-medium">{c.name.replace(/^\//, '')}</td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-mono text-xs max-w-[180px] truncate">{c.image}</td>
                  <td className="px-4 py-3">
                    <Badge variant={containerStateBadge(c.state)}>{c.state}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[hsl(var(--muted-foreground))] text-xs max-w-[150px] truncate">{c.ports || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {c.state !== 'running' && (
                        <Button variant="ghost" size="icon" title="Start" onClick={() => doAction(c.containerId, 'start')} disabled={actionLoading[c.containerId]}>
                          <Play className="w-3.5 h-3.5 text-[hsl(var(--success))]" />
                        </Button>
                      )}
                      {c.state === 'running' && (
                        <Button variant="ghost" size="icon" title="Stop" onClick={() => doAction(c.containerId, 'stop')} disabled={actionLoading[c.containerId]}>
                          <Square className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Restart" onClick={() => doAction(c.containerId, 'restart')} disabled={actionLoading[c.containerId]}>
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Logs" onClick={() => showLogs(c.containerId)}>
                        <Terminal className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Remove" onClick={() => doAction(c.containerId, 'remove')} disabled={actionLoading[c.containerId]}>
                        <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {logs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[80vh] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
              <h2 className="text-sm font-semibold font-mono">Logs: {logs.containerId.slice(0, 12)}</h2>
              <Button variant="ghost" size="sm" onClick={() => setLogs(null)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-[hsl(var(--background))] font-mono text-xs leading-5">
              {logs.lines.map((line, i) => (
                <div key={i} className={`${line.includes('ERROR') || line.includes('error') ? 'text-[hsl(var(--destructive))]' : line.includes('WARN') || line.includes('warn') ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
