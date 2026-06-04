import React, { useState } from 'react';
import { Wifi, WifiOff, Plus, Trash2, RefreshCw, Satellite } from 'lucide-react';
import { useTraccarDevices } from '../../hooks/useTraccarDevices';
import { useTraccarPositions } from '../../hooks/useTraccarPositions';
import { useTenant } from '../../contexts/TenantContext';
import { Button } from '../../components/ui/button';
import { Modal } from '../../components/ui/modal';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import type { TraccarDevice } from '@ktag/shared';

function formatLastUpdate(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

function StatusBadge({ device, isOnline }: { device: TraccarDevice; isOnline: boolean }) {
  const online = isOnline || device.status === 'online';
  return (
    <Badge tone={online ? 'emerald' : 'amber'} variant="soft" className="gap-1">
      {online
        ? <Wifi size={11} />
        : <WifiOff size={11} />
      }
      {online ? 'Online' : 'Offline'}
    </Badge>
  );
}

export function TrackersPage() {
  const { tenantId } = useTenant();
  const { devices, loading, error, reload, createDevice, deleteDevice } = useTraccarDevices();
  const { positions, status: wsStatus } = useTraccarPositions(tenantId);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [name, setName] = useState('');
  const [imei, setImei] = useState('');
  const [model, setModel] = useState('');

  const handleCreate = async () => {
    if (!name.trim() || !imei.trim()) {
      setFormError('Nome e IMEI são obrigatórios.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await createDevice(name.trim(), imei.trim(), model.trim() || undefined);
      setModalOpen(false);
      setName(''); setImei(''); setModel('');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (device: TraccarDevice) => {
    if (!confirm(`Remover rastreador "${device.name}" (${device.uniqueId})?`)) return;
    setDeleting(device.id);
    try {
      await deleteDevice(device.id);
    } catch (err: any) {
      alert(`Erro ao remover: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const wsIndicator = {
    connected: <span className="text-success text-label-sm flex items-center gap-1"><Wifi size={12} />Conectado</span>,
    connecting: <span className="text-warning text-label-sm flex items-center gap-1"><RefreshCw size={12} className="animate-spin" />Conectando...</span>,
    disconnected: <span className="text-danger text-label-sm flex items-center gap-1"><WifiOff size={12} />Desconectado</span>,
  }[wsStatus];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-content flex items-center gap-2">
            <Satellite size={22} className="text-brand-500" />
            Rastreadores GPS
          </h1>
          <p className="text-content-soft text-caption mt-1">
            Dispositivos GPS registrados no Traccar
          </p>
        </div>
        <div className="flex items-center gap-3">
          {wsIndicator}
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={15} />
            Registrar rastreador
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-danger-soft border border-danger rounded-card p-4 text-danger text-caption">
          {error}
        </div>
      )}

      {/* Device list */}
      {loading && devices.length === 0 ? (
        <div className="text-content-muted text-caption text-center py-12">Carregando...</div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-surface-raised rounded-card border border-border">
          <Satellite size={40} className="mx-auto mb-3 text-content-subtle" />
          <p className="text-content-soft font-medium">Nenhum rastreador cadastrado</p>
          <p className="text-content-muted text-caption mt-1">
            Registre o IMEI do rastreador para começar a rastrear.
          </p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => setModalOpen(true)}>
            <Plus size={14} />
            Registrar primeiro rastreador
          </Button>
        </div>
      ) : (
        <div className="bg-surface-raised rounded-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-sunken border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-label text-content-muted">Nome</th>
                <th className="text-left px-4 py-3 text-label text-content-muted">IMEI / ID único</th>
                <th className="text-left px-4 py-3 text-label text-content-muted">Status</th>
                <th className="text-left px-4 py-3 text-label text-content-muted">Última posição</th>
                <th className="text-left px-4 py-3 text-label text-content-muted">Última atualização</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {devices.map(device => {
                const livePos = positions.get(device.id);
                const isOnline = livePos != null || device.status === 'online';
                return (
                  <tr key={device.id} className="hover:bg-surface-overlay transition-colors">
                    <td className="px-4 py-3 font-medium text-content">{device.name}</td>
                    <td className="px-4 py-3 text-content-soft font-mono text-xs">{device.uniqueId}</td>
                    <td className="px-4 py-3">
                      <StatusBadge device={device} isOnline={!!livePos} />
                    </td>
                    <td className="px-4 py-3 text-content-soft text-xs font-mono">
                      {livePos
                        ? `${livePos.latitude.toFixed(5)}, ${livePos.longitude.toFixed(5)}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-content-muted text-xs">
                      {livePos
                        ? formatLastUpdate(livePos.serverTime)
                        : formatLastUpdate(device.lastUpdate)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(device)}
                        disabled={deleting === device.id}
                        className="text-content-muted hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger rounded"
                        aria-label="Remover rastreador"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Posições ao vivo (debug/info) */}
      {positions.size > 0 && (
        <p className="text-content-muted text-caption">
          {positions.size} posição(ões) ao vivo recebidas via WebSocket.
        </p>
      )}

      {/* Modal: registrar rastreador */}
      <Modal
        open={modalOpen}
        onOpenChange={open => { setModalOpen(open); if (!open) { setFormError(''); setName(''); setImei(''); setModel(''); } }}
        title="Registrar rastreador GPS"
      >
        <div className="space-y-4">
          <Field label="Nome do rastreador" htmlFor="tracker-name">
            <Input
              id="tracker-name"
              placeholder="Ex: Caminhão 001"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </Field>

          <Field label="IMEI / ID único" htmlFor="tracker-imei">
            <Input
              id="tracker-imei"
              placeholder="Ex: 860000000000001"
              value={imei}
              onChange={e => setImei(e.target.value)}
            />
          </Field>

          <Field label="Modelo (opcional)" htmlFor="tracker-model">
            <Input
              id="tracker-model"
              placeholder="Ex: Teltonika FMB920"
              value={model}
              onChange={e => setModel(e.target.value)}
            />
          </Field>

          {formError && (
            <p className="text-danger text-caption">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleCreate} disabled={saving}>
              {saving ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
