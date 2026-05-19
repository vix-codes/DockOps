import { useEffect, useState } from 'react';
import { Server, Container, Rocket, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { nodesApi, projectsApi, deploymentsApi } from '@/services/api';
import type { ServerNode, Deployment } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDate, formatDuration } from '@/lib/utils';

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {sub && <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-[hsl(var(--primary))]" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function deploymentStatusVariant(status: Deployment['status']) {
  switch (status) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'destructive';
    case 'RUNNING': return 'default';
    case 'PENDING': return 'warning';
    default: return 'secondary';
  }
}

export function OverviewPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [recentDeployments, setRecentDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      nodesApi.list(),
      projectsApi.list(),
    ]).then(([nodesRes, projectsRes]) => {
      setNodes(nodesRes.data);
      setProjectCount(projectsRes.data.length);
      if (projectsRes.data.length > 0) {
        return deploymentsApi.list(projectsRes.data[0].id, 0, 10);
      }
      return null;
    }).then((depRes) => {
      if (depRes) setRecentDeployments(depRes.data.content);
    }).finally(() => setLoading(false));
  }, []);

  useWebSocket({
    topics: ['/topic/nodes/metrics'],
    onMessage: (_topic, data) => {
      const updated = data as ServerNode;
      setNodes((prev) => prev.map((n) => n.id === updated.id ? { ...n, ...updated } : n));
    },
  });

  const onlineNodes = nodes.filter((n) => n.status === 'ONLINE').length;
  const totalContainers = nodes.reduce((sum, n) => sum + (n.runningContainers || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Overview</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Infrastructure health at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Nodes" value={nodes.length} sub={`${onlineNodes} online`} />
        <StatCard icon={Container} label="Containers" value={totalContainers} sub="running" />
        <StatCard icon={Activity} label="Projects" value={projectCount} sub="active" />
        <StatCard icon={Rocket} label="Deployments" value={recentDeployments.length} sub="recent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Server Nodes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {nodes.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No nodes registered</p>
            ) : nodes.map((node) => (
              <div key={node.id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    node.status === 'ONLINE' ? 'bg-[hsl(var(--success))]' :
                    node.status === 'OFFLINE' ? 'bg-[hsl(var(--destructive))]' :
                    'bg-[hsl(var(--warning))]'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{node.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{node.host}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    CPU {node.cpuUsage?.toFixed(1) ?? '—'}%
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    RAM {node.ramUsage?.toFixed(1) ?? '—'}%
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Recent Deployments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDeployments.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No recent deployments</p>
            ) : recentDeployments.slice(0, 6).map((dep) => (
              <div key={dep.id} className="flex items-center justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
                <div className="flex items-center gap-3">
                  {dep.status === 'SUCCESS' ? <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" /> :
                   dep.status === 'FAILED' ? <XCircle className="w-4 h-4 text-[hsl(var(--destructive))]" /> :
                   <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />}
                  <div>
                    <p className="text-sm font-medium">{dep.projectName}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{dep.commitHash?.slice(0, 7) || '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={deploymentStatusVariant(dep.status) as never} className="text-[10px]">
                    {dep.status}
                  </Badge>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    {dep.durationMs ? formatDuration(dep.durationMs) : formatDate(dep.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
