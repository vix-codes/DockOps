import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { nodesApi } from '@/services/api';
import type { ServerNode } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatUptime } from '@/lib/utils';

interface MetricPoint {
  time: string;
  cpu: number;
  ram: number;
  disk: number;
}

export function MetricsPage() {
  const [nodes, setNodes] = useState<ServerNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');
  const [history, setHistory] = useState<MetricPoint[]>([]);

  useEffect(() => {
    nodesApi.list().then((res) => {
      setNodes(res.data);
      if (res.data.length > 0) setSelectedNode(res.data[0].id);
    });
  }, []);

  useWebSocket({
    topics: ['/topic/nodes/metrics'],
    onMessage: (_topic, data) => {
      const node = data as ServerNode;
      if (node.id === selectedNode) {
        setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, ...node } : n));
        const point: MetricPoint = {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          cpu: node.cpuUsage ?? 0,
          ram: node.ramUsage ?? 0,
          disk: node.diskUsage ?? 0,
        };
        setHistory((prev) => [...prev.slice(-59), point]);
      }
    },
  });

  const currentNode = nodes.find((n) => n.id === selectedNode);

  const chartConfig = [
    { key: 'cpu' as const, color: 'hsl(199 89% 48%)', label: 'CPU %' },
    { key: 'ram' as const, color: 'hsl(142 71% 45%)', label: 'RAM %' },
    { key: 'disk' as const, color: 'hsl(38 92% 50%)', label: 'Disk %' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Metrics</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Real-time node performance</p>
        </div>
        <select
          className="bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none"
          value={selectedNode}
          onChange={(e) => { setSelectedNode(e.target.value); setHistory([]); }}
        >
          {nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>

      {currentNode && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'CPU Usage', value: `${currentNode.cpuUsage?.toFixed(1) ?? '—'}%`, color: 'text-[hsl(var(--primary))]' },
              { label: 'RAM Usage', value: `${currentNode.ramUsage?.toFixed(1) ?? '—'}%`, color: 'text-[hsl(var(--success))]' },
              { label: 'Disk Usage', value: `${currentNode.diskUsage?.toFixed(1) ?? '—'}%`, color: 'text-[hsl(var(--warning))]' },
              { label: 'Uptime', value: currentNode.uptimeSeconds ? formatUptime(currentNode.uptimeSeconds) : '—', color: 'text-[hsl(var(--foreground))]' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">{label}</p>
                  <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {chartConfig.map(({ key, color, label }) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{label} Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 33% 17%)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(215 20% 65%)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(215 20% 65%)' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(222 47% 8%)', border: '1px solid hsl(217 33% 17%)', borderRadius: 6, fontSize: 12 }}
                        formatter={(v) => [`${(v as number).toFixed(1)}%`, label]}
                      />
                      <Area type="monotone" dataKey={key} stroke={color} fill={`url(#gradient-${key})`} strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Host</p>
                  <p className="mt-1 font-mono">{currentNode.host}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">OS</p>
                  <p className="mt-1">{currentNode.os || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Kernel</p>
                  <p className="mt-1 font-mono">{currentNode.kernelVersion || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide font-medium">Docker</p>
                  <p className="mt-1">{currentNode.dockerAvailable ? `${currentNode.runningContainers} containers` : 'Not available'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
