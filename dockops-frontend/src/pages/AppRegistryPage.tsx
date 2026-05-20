import { useEffect, useState } from 'react';
import {
  Plus, RefreshCw, Trash2, Pencil, ChevronDown, ChevronRight,
  CheckCircle, AlertTriangle, XCircle, HelpCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { appsApi, nodesApi } from '@/services/api';
import type { ManagedApp, ServerNode } from '@/types';

function HealthBadge({ status }: { status: string }) {
  switch (status) {
    case 'healthy':
      return <span className="flex items-center gap-1 text-[hsl(var(--success))] text-xs font-medium"><CheckCircle className="w-3.5 h-3.5" />Healthy</span>;
    case 'degraded':
      return <span className="flex items-center gap-1 text-[hsl(var(--warning))] text-xs font-medium"><AlertTriangle className="w-3.5 h-3.5" />Degraded</span>;
    case 'down':
      return <span className="flex items-center gap-1 text-[hsl(var(--destructive))] text-xs font-medium"><XCircle className="w-3.5 h-3.5" />Down</span>;
    default:
      return <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))] text-xs font-medium"><HelpCircle className="w-3.5 h-3.5" />Unknown</span>;
  }
}

function deploymentBadge(status?: string): 'success' | 'destructive' | 'warning' | 'secondary' {
  if (!status) return 'secondary';
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'destructive';
  if (status === 'RUNNING') return 'warning';
  return 'secondary';
}

const EMPTY_FORM = {
  name: '', displayName: '', description: '',
  serverNodeId: '', containerNames: '', gitRepoUrl: '',
  gitBranch: 'main', composeFilePath: '', composeWorkDir: '',
  tags: '', enabled: true,
};

export function AppRegistryPage() {
  const [apps, setApps] = useState<ManagedApp[]>([]);
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [appDetails, setAppDetails] = useState<Record<string, ManagedApp>>({});

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<ManagedApp | null>(null);

  useEffect(() => {
    nodesApi.list().then((r) => setNodes(r.data));
    load();
  }, []);

  const load = () => {
    setLoading(true);
    appsApi.list()
      .then((r) => setApps(r.data))
      .finally(() => setLoading(false));
  };

  const toggleExpand = async (app: ManagedApp) => {
    const next = !expanded[app.id];
    setExpanded((e) => ({ ...e, [app.id]: next }));
    if (next && !appDetails[app.id]) {
      const res = await appsApi.get(app.id);
      setAppDetails((d) => ({ ...d, [app.id]: res.data }));
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (app: ManagedApp) => {
    setForm({
      name: app.name,
      displayName: app.displayName,
      description: app.description || '',
      serverNodeId: app.serverNodeId || '',
      containerNames: app.containerNames.join(', '),
      gitRepoUrl: app.gitRepoUrl || '',
      gitBranch: app.gitBranch || 'main',
      composeFilePath: app.composeFilePath || '',
      composeWorkDir: app.composeWorkDir || '',
      tags: app.tags.join(', '),
      enabled: app.enabled,
    });
    setEditingId(app.id);
    setShowForm(true);
  };

  const submitForm = async () => {
    const payload = {
      name: form.name,
      displayName: form.displayName,
      description: form.description || null,
      serverNodeId: form.serverNodeId || null,
      containerNames: form.containerNames.split(',').map((s) => s.trim()).filter(Boolean),
      gitRepoUrl: form.gitRepoUrl || null,
      gitBranch: form.gitBranch || null,
      composeFilePath: form.composeFilePath || null,
      composeWorkDir: form.composeWorkDir || null,
      tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
      enabled: form.enabled,
    };
    try {
      if (editingId) await appsApi.update(editingId, payload);
      else await appsApi.create(payload);
      setShowForm(false);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Save failed');
    }
  };

  const doDelete = async (app: ManagedApp) => {
    try {
      await appsApi.delete(app.id);
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">App Registry</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Managed applications and their runtime state</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> Register App
          </Button>
        </div>
      </div>

      {loading && apps.length === 0 ? (
        <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">Loading…</div>
      ) : apps.length === 0 ? (
        <Card>
          <div className="text-center py-16 text-sm text-[hsl(var(--muted-foreground))]">
            No apps registered. Click <strong>Register App</strong> to add one.
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const detail = appDetails[app.id] ?? app;
            const isOpen = expanded[app.id];
            return (
              <Card key={app.id}>
                {/* App header row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[hsl(var(--secondary))]/30 transition-colors"
                  onClick={() => toggleExpand(app)}
                >
                  <div className="flex-shrink-0 text-[hsl(var(--muted-foreground))]">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{app.displayName}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))] font-mono">{app.name}</span>
                      {!app.enabled && <Badge variant="secondary">Disabled</Badge>}
                    </div>
                    {app.description && (
                      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">{app.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <HealthBadge status={app.healthStatus} />
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">
                      {app.runningContainers}/{app.totalContainers} containers
                    </span>
                    {app.serverNodeName && (
                      <span className="text-xs text-[hsl(var(--muted-foreground))] hidden md:block">{app.serverNodeName}</span>
                    )}
                    {app.lastDeploymentStatus && (
                      <Badge variant={deploymentBadge(app.lastDeploymentStatus)} className="hidden md:inline-flex">
                        {app.lastDeploymentStatus}
                      </Badge>
                    )}
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(app)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(app)}>
                        <Trash2 className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isOpen && (
                  <div className="border-t border-[hsl(var(--border))] px-5 py-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Git Repo</p>
                        <p className="font-mono text-xs truncate">{detail.gitRepoUrl || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Branch</p>
                        <p className="font-mono text-xs">{detail.gitBranch || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Compose File</p>
                        <p className="font-mono text-xs truncate">{detail.composeFilePath || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-1">Last Commit</p>
                        <p className="font-mono text-xs">{detail.lastDeployedCommit?.slice(0, 8) || '—'}</p>
                      </div>
                    </div>

                    {detail.containers && detail.containers.length > 0 && (
                      <div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2 font-medium uppercase tracking-wide">Containers</p>
                        <div className="space-y-1">
                          {detail.containers.map((c) => (
                            <div key={c.containerId} className="flex items-center gap-3 text-xs font-mono bg-[hsl(var(--secondary))]/40 rounded px-3 py-1.5">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.state === 'running' ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--destructive))]'}`} />
                              <span className="flex-1">{c.name}</span>
                              <span className="text-[hsl(var(--muted-foreground))]">{c.state}</span>
                              <span className="text-[hsl(var(--muted-foreground))]">{c.image}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.tags.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {detail.tags.map((t) => (
                          <Badge key={t} variant="secondary">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto p-4">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-6 w-full max-w-lg space-y-4">
            <h2 className="text-sm font-semibold">{editingId ? 'Edit App' : 'Register App'}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Name (slug)', key: 'name', placeholder: 'resolvehub', disabled: !!editingId },
                { label: 'Display Name', key: 'displayName', placeholder: 'ResolveHub' },
              ].map(({ label, key, placeholder, disabled }) => (
                <div key={key}>
                  <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">{label}</label>
                  <input
                    disabled={disabled}
                    className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none disabled:opacity-50 font-mono"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Description</label>
              <input
                className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none"
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Server Node</label>
              <select
                className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none"
                value={form.serverNodeId}
                onChange={(e) => setForm((f) => ({ ...f, serverNodeId: e.target.value }))}
              >
                <option value="">— None —</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>{n.name} ({n.host})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Container Names (comma-separated)</label>
              <input
                className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
                placeholder="resolvehub-backend, resolvehub-frontend"
                value={form.containerNames}
                onChange={(e) => setForm((f) => ({ ...f, containerNames: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Git Repo URL</label>
                <input
                  className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
                  placeholder="https://github.com/..."
                  value={form.gitRepoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, gitRepoUrl: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Branch</label>
                <input
                  className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
                  placeholder="main"
                  value={form.gitBranch}
                  onChange={(e) => setForm((f) => ({ ...f, gitBranch: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Compose File</label>
                <input
                  className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
                  placeholder="docker-compose.yml"
                  value={form.composeFilePath}
                  onChange={(e) => setForm((f) => ({ ...f, composeFilePath: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Work Directory</label>
                <input
                  className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none font-mono"
                  placeholder="/opt/myapp"
                  value={form.composeWorkDir}
                  onChange={(e) => setForm((f) => ({ ...f, composeWorkDir: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-[hsl(var(--muted-foreground))] mb-1 block">Tags (comma-separated)</label>
              <input
                className="w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-2 text-sm focus:outline-none"
                placeholder="production, nodejs"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                className="rounded"
              />
              Enabled
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={submitForm} disabled={!form.name.trim() || !form.displayName.trim()}>
                {editingId ? 'Save Changes' : 'Register'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-5 w-80 space-y-3">
            <h2 className="text-sm font-semibold text-[hsl(var(--destructive))]">Remove App</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Remove <span className="font-semibold text-[hsl(var(--foreground))]">{confirmDelete.displayName}</span> from the registry?
              This does not stop or remove any containers.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={() => doDelete(confirmDelete)}>Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
