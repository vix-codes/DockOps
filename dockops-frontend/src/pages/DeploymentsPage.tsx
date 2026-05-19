import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, RotateCcw, Bot } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deploymentsApi, projectsApi } from '@/services/api';
import type { Deployment, Project } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDate, formatDuration, truncateHash } from '@/lib/utils';

function StatusIcon({ status }: { status: Deployment['status'] }) {
  if (status === 'SUCCESS') return <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />;
  if (status === 'FAILED') return <XCircle className="w-4 h-4 text-[hsl(var(--destructive))]" />;
  if (status === 'RUNNING') return <div className="w-4 h-4 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />;
  return <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />;
}

function statusVariant(status: Deployment['status']): 'success' | 'destructive' | 'default' | 'warning' | 'secondary' {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'destructive';
    case 'RUNNING': return 'default';
    case 'PENDING': return 'warning';
    default: return 'secondary';
  }
}

function DeploymentRow({ deployment, onRollback }: {
  deployment: Deployment;
  onRollback: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-[hsl(var(--border))] last:border-0">
      <div
        className="flex items-center gap-4 px-4 py-3 hover:bg-[hsl(var(--secondary))]/30 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon status={deployment.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{deployment.projectName}</span>
            <Badge variant={statusVariant(deployment.status)} className="text-[10px]">
              {deployment.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{deployment.triggerType}</Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {deployment.commitHash && (
              <span className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                {truncateHash(deployment.commitHash)}
              </span>
            )}
            {deployment.commitMessage && (
              <span className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-[250px]">
                {deployment.commitMessage}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {deployment.durationMs ? formatDuration(deployment.durationMs) : '—'}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {formatDate(deployment.createdAt)}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[hsl(var(--muted-foreground))] shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {deployment.commitAuthor && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Author: {deployment.commitAuthor} · Branch: {deployment.branch}
            </p>
          )}
          {deployment.failureReason && (
            <div className="bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/20 rounded-md p-3">
              <p className="text-xs font-medium text-[hsl(var(--destructive))] mb-1">Failure Reason</p>
              <p className="text-xs font-mono text-[hsl(var(--muted-foreground))]">{deployment.failureReason}</p>
            </div>
          )}
          {deployment.aiAnalysis && (
            <div className="bg-[hsl(var(--primary))]/5 border border-[hsl(var(--primary))]/20 rounded-md p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Bot className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
                <p className="text-xs font-medium text-[hsl(var(--primary))]">AI Analysis</p>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{deployment.aiAnalysis}</p>
            </div>
          )}
          {deployment.status === 'SUCCESS' && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onRollback(deployment.id); }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rollback to this commit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function DeploymentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    projectsApi.list().then((res) => {
      setProjects(res.data);
      if (res.data.length > 0) setSelectedProject(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setLoading(true);
    deploymentsApi.list(selectedProject).then((res) => {
      setDeployments(res.data.content);
    }).finally(() => setLoading(false));
  }, [selectedProject]);

  useWebSocket({
    topics: ['/topic/deployments/all'],
    onMessage: (_topic, data) => {
      const dep = data as Deployment;
      if (dep.projectId === selectedProject) {
        setDeployments((prev) => {
          const existing = prev.find((d) => d.id === dep.id);
          if (existing) return prev.map((d) => d.id === dep.id ? dep : d);
          return [dep, ...prev];
        });
      }
    },
  });

  const handleRollback = async (deploymentId: string) => {
    if (!confirm('Roll back to this deployment?')) return;
    const res = await deploymentsApi.rollback(deploymentId);
    setDeployments((prev) => [res.data, ...prev]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Deployments</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{deployments.length} deployments</p>
        </div>
        <select
          className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deployments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Clock className="w-10 h-10 text-[hsl(var(--muted-foreground))]" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">No deployments yet</p>
          </div>
        ) : (
          <div>
            {deployments.map((d) => (
              <DeploymentRow key={d.id} deployment={d} onRollback={handleRollback} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
