import { useEffect, useState } from 'react';
import { Plus, Rocket, GitBranch, Server, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { projectsApi, nodesApi, deploymentsApi } from '@/services/api';
import type { Project, ServerNode } from '@/types';
import { formatDate } from '@/lib/utils';

interface ProjectFormData {
  name: string; description: string; repoUrl: string; branch: string;
  composeFilePath: string; workingDirectory: string; serverNodeId: string;
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectFormData>({
    name: '', description: '', repoUrl: '', branch: 'main',
    composeFilePath: 'docker-compose.yml', workingDirectory: '', serverNodeId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deploying, setDeploying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([projectsApi.list(), nodesApi.list()]).then(([p, n]) => {
      setProjects(p.data);
      setNodes(n.data);
      if (n.data.length > 0) setForm((f) => ({ ...f, serverNodeId: n.data[0].id }));
    }).finally(() => setLoading(false));
  }, []);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await projectsApi.create(form);
      setProjects((prev) => [...prev, res.data]);
      setShowForm(false);
      setForm((f) => ({ ...f, name: '', description: '', repoUrl: '' }));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeploy = async (projectId: string) => {
    setDeploying((d) => ({ ...d, [projectId]: true }));
    try {
      await deploymentsApi.trigger(projectId);
    } finally {
      setDeploying((d) => ({ ...d, [projectId]: false }));
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Delete this project?')) return;
    await projectsApi.delete(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const inputCls = 'w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{projects.length} projects</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Create Project</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Name *</label>
                  <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="my-app" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Node *</label>
                  <select className={inputCls} value={form.serverNodeId} onChange={(e) => set('serverNodeId', e.target.value)} required>
                    {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Repo URL *</label>
                <input className={inputCls} value={form.repoUrl} onChange={(e) => set('repoUrl', e.target.value)} required placeholder="https://github.com/org/repo.git" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Branch</label>
                  <input className={inputCls} value={form.branch} onChange={(e) => set('branch', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Compose File</label>
                  <input className={inputCls} value={form.composeFilePath} onChange={(e) => set('composeFilePath', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">Working Dir</label>
                  <input className={inputCls} value={form.workingDirectory} onChange={(e) => set('workingDirectory', e.target.value)} placeholder="/opt/app" />
                </div>
              </div>
              {error && <p className="text-xs text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded px-3 py-2">{error}</p>}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Project'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{project.name}</CardTitle>
                <Badge variant={project.status === 'ACTIVE' ? 'success' : 'secondary'}>
                  {project.status}
                </Badge>
              </div>
              {project.description && (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{project.description}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="font-mono">{project.repoUrl.replace('https://github.com/', '')}</span>
                  <Badge variant="outline" className="text-[10px]">{project.branch}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Server className="w-3.5 h-3.5" />
                  {project.serverNodeName}
                </div>
              </div>
              {project.lastDeployedCommit && (
                <div className="text-xs text-[hsl(var(--muted-foreground))]">
                  Last deploy: <span className="font-mono">{project.lastDeployedCommit.slice(0, 7)}</span>
                  {' · '}{formatDate(project.lastDeployedAt)}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDeploy(project.id)}
                  disabled={deploying[project.id]}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  {deploying[project.id] ? 'Deploying...' : 'Deploy'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(project.id)}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
