import { useEffect, useState } from 'react';
import { RefreshCw, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dockerApi, nodesApi } from '@/services/api';
import type { DockerNetwork, ServerNode } from '@/types';

export function NetworksPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DockerNetwork | null>(null);

  useEffect(() => {
    nodesApi.list().then((r) => {
      setNodes(r.data);
      if (r.data.length > 0) setNodeId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (nodeId) load();
  }, [nodeId]);

  const load = () => {
    setLoading(true);
    dockerApi.networks(nodeId)
      .then((r) => setNetworks(r.data))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Docker Networks</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{networks.length} networks on selected node</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
          >
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))]">
                {['ID', 'Name', 'Driver', 'Scope', 'Subnet', 'Containers', ''].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">Loading…</td></tr>
              ) : networks.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">No networks found</td></tr>
              ) : networks.map((net) => (
                <tr key={net.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/50">
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{net.shortId}</td>
                  <td className="px-4 py-3 font-medium">{net.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{net.driver}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{net.scope}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{net.subnet || '—'}</td>
                  <td className="px-4 py-3 text-center text-xs">{net.containers}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {net.internal && (
                        <span title="Internal" className="text-[hsl(var(--warning))]">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => setDetail(net)}>
                        Details
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-96 space-y-3">
            <h2 className="text-sm font-semibold">Network: {detail.name}</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['Full ID', detail.id],
                ['Driver', detail.driver],
                ['Scope', detail.scope],
                ['Subnet', detail.subnet || '—'],
                ['Gateway', detail.gateway || '—'],
                ['Internal', detail.internal ? 'Yes' : 'No'],
                ['Containers', String(detail.containers)],
              ].map(([label, value]) => (
                <>
                  <dt key={`l-${label}`} className="text-[hsl(var(--muted-foreground))]">{label}</dt>
                  <dd key={`v-${label}`} className="font-mono break-all">{value}</dd>
                </>
              ))}
            </dl>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
