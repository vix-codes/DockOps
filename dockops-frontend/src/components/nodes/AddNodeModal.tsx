import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { nodesApi } from '@/services/api';
import type { ServerNode } from '@/types';

interface Props {
  onClose: () => void;
  onCreated: (node: ServerNode) => void;
}

export function AddNodeModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '', host: '', sshPort: 22, sshUser: 'root',
    authMethod: 'PASSWORD' as 'PASSWORD' | 'PRIVATE_KEY',
    sshPassword: '', sshPrivateKey: '', description: '', environment: 'production',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await nodesApi.create(form);
      onCreated(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to add node');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-semibold">Add Server Node</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" required>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="prod-web-01" />
            </Field>
            <Field label="Environment">
              <select className={inputCls} value={form.environment} onChange={(e) => set('environment', e.target.value)}>
                <option>production</option>
                <option>staging</option>
                <option>development</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Host" className="col-span-2" required>
              <input className={inputCls} value={form.host} onChange={(e) => set('host', e.target.value)} required placeholder="192.168.1.1" />
            </Field>
            <Field label="SSH Port" required>
              <input className={inputCls} type="number" value={form.sshPort} onChange={(e) => set('sshPort', parseInt(e.target.value))} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SSH User" required>
              <input className={inputCls} value={form.sshUser} onChange={(e) => set('sshUser', e.target.value)} required />
            </Field>
            <Field label="Auth Method" required>
              <select className={inputCls} value={form.authMethod} onChange={(e) => set('authMethod', e.target.value)}>
                <option value="PASSWORD">Password</option>
                <option value="PRIVATE_KEY">Private Key</option>
              </select>
            </Field>
          </div>

          {form.authMethod === 'PASSWORD' ? (
            <Field label="SSH Password" required>
              <input className={inputCls} type="password" value={form.sshPassword} onChange={(e) => set('sshPassword', e.target.value)} required />
            </Field>
          ) : (
            <Field label="Private Key (PEM)" required>
              <textarea className={`${inputCls} h-24 resize-none font-mono text-xs`} value={form.sshPrivateKey} onChange={(e) => set('sshPrivateKey', e.target.value)} required placeholder="-----BEGIN RSA PRIVATE KEY-----" />
            </Field>
          )}

          <Field label="Description">
            <input className={inputCls} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Optional description" />
          </Field>

          {error && <p className="text-xs text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Connecting...' : 'Add Node'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'w-full bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] rounded-md px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]';

function Field({ label, children, className, required }: { label: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1 uppercase tracking-wide">
        {label}{required && <span className="text-[hsl(var(--destructive))] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
