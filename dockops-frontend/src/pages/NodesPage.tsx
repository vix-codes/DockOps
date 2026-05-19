import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { nodesApi } from '@/services/api';
import type { ServerNode } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatUptime, formatDate } from '@/lib/utils';
import { AddNodeModal } from '@/components/nodes/AddNodeModal';

function NodeStatusBadge({ status }: { status: ServerNode['status'] }) {
  const variants: Record<ServerNode['status'], 'success' | 'destructive' | 'warning' | 'secondary'> = {
    ONLINE: 'success', OFFLINE: 'destructive', ERROR: 'destructive', UNKNOWN: 'warning',
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

function MetricBar({ value, label }: { value?: number; label: string }) {
  const pct = value ?? 0;
  const color = pct > 90 ? 'bg-[hsl(var(--destructive))]' : pct > 70 ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--primary))]';
  return (
    <div>
      <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
        <span>{label}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[hsl(var(--secondary))] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function NodesPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchNodes = async () => {
    const res = await nodesApi.list();
    setNodes(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchNodes(); }, []);

  useWebSocket({
    topics: ['/topic/nodes/metrics'],
    onMessage: (_topic, data) => {
      const updated = data as ServerNode;
      setNodes((prev) => prev.map((n) => n.id === updated.id ? { ...n, ...updated } : n));
    },
  });

  const handleRefresh = async (nodeId: string) => {
    setRefreshing((r) => ({ ...r, [nodeId]: true }));
    try {
      const res = await nodesApi.refreshMetrics(nodeId);
      setNodes((prev) => prev.map((n) => n.id === nodeId ? res.data : n));
    } finally {
      setRefreshing((r) => ({ ...r, [nodeId]: false }));
    }
  };

  const handleDelete = async (nodeId: string) => {
    if (!confirm('Delete this node?')) return;
    await nodesApi.delete(nodeId);
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Server Nodes</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{nodes.length} registered nodes</p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
      </div>

      {nodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <WifiOff className="w-10 h-10 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No server nodes registered</p>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              Add your first node
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <Card key={node.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {node.status === 'ONLINE'
                      ? <Wifi className="w-4 h-4 text-[hsl(var(--success))]" />
                      : <WifiOff className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    }
                    <CardTitle className="text-sm">{node.name}</CardTitle>
                  </div>
                  <NodeStatusBadge status={node.status} />
                </div>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  {node.host}:{node.sshPort} · {node.os || node.environment || '—'}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <MetricBar value={node.cpuUsage} label="CPU" />
                <MetricBar value={node.ramUsage} label="RAM" />
                <MetricBar value={node.diskUsage} label="Disk" />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[hsl(var(--secondary))] rounded-md p-2">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Containers</p>
                    <p className="text-sm font-semibold mt-0.5">{node.runningContainers ?? '—'}</p>
                  </div>
                  <div className="bg-[hsl(var(--secondary))] rounded-md p-2">
                    <p className="text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Uptime</p>
                    <p className="text-sm font-semibold mt-0.5">
                      {node.uptimeSeconds ? formatUptime(node.uptimeSeconds) : '—'}
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  Last checked: {formatDate(node.lastCheckedAt)}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleRefresh(node.id)}
                    disabled={refreshing[node.id]}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing[node.id] ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                    onClick={() => handleDelete(node.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddNodeModal
          onClose={() => setShowAddModal(false)}
          onCreated={(node) => {
            setNodes((prev) => [...prev, node]);
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
}
