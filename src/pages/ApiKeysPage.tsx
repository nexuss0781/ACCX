import { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import Badge from '../components/ui/Badge';
import { Plus, Fingerprint, Trash2, Copy, Check, ShieldOff } from 'lucide-react';
import { accxApi } from '../lib/accxApi';
import type { CloudPat } from '../lib/accxApi';

function CreatePatForm({ onCreated, onDone }: { onCreated: (token: string) => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { token } = await accxApi.createPat(name.trim());
      onCreated(token.token);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to create token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-danger-theme">{error}</p>}
      <Input label="Token Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. prod-deploy-agent" required />
      <p className="text-xs text-text-muted">A personal access token grants access via <code>Authorization: Bearer accx_pat_...</code>. It can read and write environment variables in your workspace.</p>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
        <Button type="submit" loading={loading} icon={<Plus className="w-4 h-4" />}>Create Token</Button>
      </div>
    </form>
  );
}

export default function ApiKeysPage() {
  const [tokens, setTokens] = useState<CloudPat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [issuedToken, setIssuedToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<CloudPat | null>(null);

  const load = useCallback(async () => {
    try {
      const { tokens } = await accxApi.listPats();
      setTokens(tokens.filter(t => !t.revokedAt));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load tokens.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void accxApi.listPats().then(({ tokens }) => { if (active) setTokens(tokens.filter(t => !t.revokedAt)); setError(''); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Failed to load tokens.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleRevoke = async () => {
    if (!revoking) return;
    try {
      await accxApi.revokePat(revoking.id);
      setRevoking(null);
      void load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to revoke token.');
      setRevoking(null);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(issuedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Header
        title="API Keys"
        subtitle={`${tokens.length} active token${tokens.length !== 1 ? 's' : ''}`}
      >
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>New Token</Button>
      </Header>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-subtle text-danger-theme text-sm">{error}</div>}

      {loading ? (
        <div className="text-center py-20 text-text-muted">Loading...</div>
      ) : tokens.length > 0 ? (
        <div className="space-y-3">
          {tokens.map((token, i) => (
            <div
              key={token.id}
              className="flex items-center justify-between bg-bg-surface rounded-2xl border border-border-theme p-4 card-hover animate-fade-in"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{token.name}</h3>
                  <p className="text-xs text-text-muted">
                    {token.scopes.slice(0, 3).join(', ')}{token.scopes.length > 3 ? ` +${token.scopes.length - 3}` : ''} · created {new Date(token.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge>accx_pat</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 className="w-3 h-3" />}
                  onClick={() => setRevoking(token)}
                  className="text-danger-theme hover:text-danger-theme"
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ShieldOff className="w-7 h-7" />}
          title="No API keys"
          description="Create a personal access token so services and AI agents can resolve environment variables over the API."
          action={<Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>New Token</Button>}
        />
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New API Key">
        <CreatePatForm onCreated={setIssuedToken} onDone={() => setShowCreate(false)} />
      </Modal>

      <Modal isOpen={!!issuedToken} onClose={() => setIssuedToken('')} title="Token Created">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Copy this token now. It will not be shown again.</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-raised border border-border-theme">
            <code className="flex-1 text-sm font-mono text-text-primary break-all">{issuedToken}</code>
            <Button size="sm" variant="ghost" icon={copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />} onClick={() => void handleCopy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => { setIssuedToken(''); void load(); }}>Done</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={() => void handleRevoke()}
        title="Revoke Token"
        message={`Revoke "${revoking?.name}"? Token access stops immediately and cannot be undone.`}
      />
    </div>
  );
}