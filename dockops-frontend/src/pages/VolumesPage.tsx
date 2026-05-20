import { useEffect, useState } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { dockerApi, nodesApi } from '@/services/api';
import type { DockerVolume, ServerNode } from '@/types';

export function VolumesPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<DockerVolume | null>(null);

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
    dockerApi.volumes(nodeId)
      .then((r) => setVolumes(r.data))
      .finally(() => setLoading(false));
  };

  const doRemove = async (vol: DockerVolume) => {
    try {
      await dockerApi.removeVolume(nodeId, vol.name);
      setConfirmRemove(null);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Remove failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Docker Volumes</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{volumes.length} volumes on selected node</p>
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
                {['Name', 'Driver', 'Scope', 'Mountpoint', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">Loading…</td></tr>
              ) : volumes.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">No volumes found</td></tr>
              ) : volumes.map((v) => (
                <tr key={v.name} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/50">
                  <td className="px-4 py-3 font-mono text-xs">{v.name}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{v.driver}</td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{v.scope}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))] max-w-[200px] truncate">{v.mountpoint || '—'}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" title="Remove" onClick={() => setConfirmRemove(v)}>
                      <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--destructive))]">Remove Volume</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Remove volume <span className="font-mono text-[hsl(var(--foreground))]">{confirmRemove.name}</span>?
              All data stored in this volume will be lost.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmRemove(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => doRemove(confirmRemove)}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
