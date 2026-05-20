import { useEffect, useState } from 'react';
import { Trash2, Download, RefreshCw, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dockerApi, nodesApi } from '@/services/api';
import type { DockerImage, ServerNode } from '@/types';

export function ImagesPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [nodeId, setNodeId] = useState('');
  const [images, setImages] = useState<DockerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [pullImage, setPullImage] = useState('');
  const [showPull, setShowPull] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<DockerImage | null>(null);

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
    dockerApi.images(nodeId)
      .then((r) => setImages(r.data))
      .finally(() => setLoading(false));
  };

  const doRemove = async (img: DockerImage) => {
    setActionLoading((a) => ({ ...a, [img.id]: true }));
    try {
      await dockerApi.removeImage(nodeId, img.id);
      setConfirmRemove(null);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Remove failed');
    } finally {
      setActionLoading((a) => ({ ...a, [img.id]: false }));
    }
  };

  const doPull = async () => {
    if (!pullImage.trim()) return;
    setLoading(true);
    try {
      await dockerApi.pullImage(nodeId, pullImage.trim());
      setPullImage('');
      setShowPull(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Pull failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Docker Images</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{images.length} images on selected node</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
          >
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={() => setShowPull(true)}>
            <Plus className="w-4 h-4 mr-1" /> Pull
          </Button>
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
                {['ID', 'Repository', 'Tag', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">Loading…</td></tr>
              ) : images.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-[hsl(var(--muted-foreground))] text-sm">No images found</td></tr>
              ) : images.map((img) => (
                <tr key={img.id} className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/50">
                  <td className="px-4 py-3 font-mono text-xs text-[hsl(var(--muted-foreground))]">{img.shortId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{img.repository}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{img.tag || 'latest'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">{img.created}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remove"
                      onClick={() => setConfirmRemove(img)}
                      disabled={actionLoading[img.id]}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showPull && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold">Pull Image</h2>
            <input
              autoFocus
              className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
              placeholder="nginx:latest"
              value={pullImage}
              onChange={(e) => setPullImage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doPull()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowPull(false)}>Cancel</Button>
              <Button size="sm" onClick={doPull} disabled={!pullImage.trim()}>Pull</Button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--destructive))]">Remove Image</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Remove <span className="font-mono text-[hsl(var(--foreground))]">{confirmRemove.repository}:{confirmRemove.tag}</span>?
              Running containers using this image will not be affected.
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
