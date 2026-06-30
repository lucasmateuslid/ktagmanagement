import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storage } from '../../services/storage';
import { useShipments, useShippingAddresses, useInventory } from '../../hooks/useShipments';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { User, Vehicle, Shipment, ShipmentItem, ShippingAddress, Tag, Tracker, Client, ShipmentStatus } from '../../types';
import { ArrowLeft, Save, Plus, Trash2, MapPin, Package, Truck, CheckCircle, Calculator } from 'lucide-react';
import { geocodingService } from '../../services/geocoding';
import { SearchableSelect } from '../../components/SearchableSelect';
import { LocationPicker } from '../../components/LocationPicker';
import { melhorEnvioService } from '../../services/melhorEnvio';

export const ShipmentForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const { saveShipment, shipments } = useShipments();
  const { addresses, saveAddress } = useShippingAddresses();
  const { tags, trackers, updateItemStatus } = useInventory();
  const isAdmin = user?.role === 'admin' || user?.role === 'moderator' || user?.role === 'admin_tecnico';

  const [step, setStep] = useState(1);
  const [consultants, setConsultants] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [titulo, setTitulo] = useState(`Remessa ${new Date().toLocaleDateString()}`);
  const [codigoRemessa, setCodigoRemessa] = useState(`REM-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`);
  const [consultorId, setConsultorId] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [isRural, setIsRural] = useState(false);
  const [ruralDetails, setRuralDetails] = useState('');
  const [envelopeType, setEnvelopeType] = useState('Pequeno');
  const [enderecoCompleto, setEnderecoCompleto] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [placeId, setPlaceId] = useState('');
  const [codigoRastreio, setCodigoRastreio] = useState('');
  const [transportadora, setTransportadora] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ShipmentItem[]>([]);

  // Item Form State
  const [itemType, setItemType] = useState<'tag' | 'rastreador' | 'outro'>('tag');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedTrackerId, setSelectedTrackerId] = useState('');
  const [selectedPlate, setSelectedPlate] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const [users, veiculos, clientes] = await Promise.all([
        storage.getAllUsers(),
        storage.getVehicles(),
        storage.getClients()
      ]);
      setConsultants(users.filter(u => u.role !== 'client'));
      setVehicles(veiculos);
      setClients(clientes);

      if (id && id !== 'nova') {
        const existing = shipments.find(s => s.id === id);
        if (existing) {
          setTitulo(existing.titulo);
          setCodigoRemessa(existing.codigoRemessa || '');
          setConsultorId(existing.consultorId);
          setDestinatarioNome(existing.destinatario.nome);
          setEmail(existing.destinatario.email || '');
          setTelefone(existing.destinatario.telefone || '');
          setCpf(existing.destinatario.cpf || '');
          setIsRural(existing.destinatario.isRural || false);
          setRuralDetails(existing.destinatario.ruralDetails || '');
          setEnvelopeType(existing.envelopeType || 'Pequeno');
          setEnderecoCompleto(existing.destinatario.enderecoCompleto);
          setLat(existing.destinatario.lat);
          setLng(existing.destinatario.lng);
          setPlaceId(existing.destinatario.placeId || '');
          setCodigoRastreio(existing.codigoRastreio || '');
          setTransportadora(existing.transportadora || '');
          setObservacoes(existing.observacoes || '');
          setItens(existing.itens);
        }
      }
      setLoading(false);
    };
    loadData();
  }, [id, shipments]);

  const handleAddressSearch = async (query: string) => {
    setEnderecoCompleto(query);
    if (query.length > 5) {
      try {
        const results = await geocodingService.geocode(query);
        if (results && results.length > 0) {
          setLat(results[0].lat);
          setLng(results[0].lon);
          // placeId is not always available from nominatim, but we can simulate or use it if available
        }
      } catch (e) {
        console.error('Error geocoding', e);
      }
    }
  };

  const handleAddressSelect = (addr: ShippingAddress) => {
    setEnderecoCompleto(addr.enderecoCompleto);
    setLat(addr.lat);
    setLng(addr.lng);
    setPlaceId(addr.placeId || '');
  };

  const addItem = () => {
    if (itemType === 'tag' && !selectedTagId) return addNotification('error', 'Erro', 'Selecione uma Tag');
    if (itemType === 'rastreador' && !selectedTrackerId) return addNotification('error', 'Erro', 'Selecione um Rastreador');

    const vehicle = vehicles.find(v => v.plate === selectedPlate);
    
    const newItem: ShipmentItem = {
      id: Date.now().toString(),
      shipmentId: id || 'temp',
      tipo: itemType,
      tagId: itemType === 'tag' ? selectedTagId : undefined,
      rastreadorId: itemType === 'rastreador' ? selectedTrackerId : undefined,
      placa: selectedPlate || undefined,
      veiculoInfo: vehicle ? {
        placa: vehicle.plate,
        modelo: vehicle.model,
        cor: vehicle.color || '',
        proprietario: vehicle.clientId || ''
      } : undefined,
      quantidade: itemType === 'outro' ? itemQuantity : 1,
      observacoes: itemNotes
    };

    setItens([...itens, newItem]);
    setSelectedTagId('');
    setSelectedTrackerId('');
    setSelectedPlate('');
    setItemNotes('');
    setItemQuantity(1);
  };

  const removeItem = (itemId: string) => {
    setItens(itens.filter(i => i.id !== itemId));
  };

  const handleSave = async (status: ShipmentStatus) => {
    if (user?.role === 'technician' || user?.role === 'user') {
       if (!consultorId) setConsultorId(user.id);
    } else {
       if (!consultorId) return addNotification('error', 'Erro', 'Selecione um consultor');
    }

    if (!destinatarioNome || !enderecoCompleto || !email || !cpf || !telefone) return addNotification('error', 'Erro', 'Preencha todos os dados básicos do destinatário');
    if (isAdmin && status === 'ativo' && itens.length === 0) return addNotification('error', 'Erro', 'Adicione pelo menos um item para confirmar o envio');

    const consultor = consultants.find(c => c.id === (consultorId || user?.id));
    
    // For non-admins requesting new shipments, status goes to 'em_analise' directly
    let finalStatus = status;
    if ((user?.role === 'technician' || user?.role === 'user') && status === 'ativo') {
        finalStatus = 'em_analise';
    }

    const shipment: Shipment = {
      id: id && id !== 'nova' ? id : Date.now().toString(),
      titulo: titulo || `Remessa ${new Date().toLocaleDateString()}`,
      codigoRemessa,
      status: finalStatus,
      consultorId: consultorId || user?.id || '',
      consultorNome: consultor?.name || user?.name || '',
      destinatario: {
        nome: destinatarioNome,
        email,
        telefone,
        cpf,
        enderecoCompleto,
        isRural,
        ruralDetails,
        lat,
        lng,
        placeId
      },
      envelopeType,
      codigoRastreio,
      transportadora,
      dataCriacao: Date.now(),
      observacoes,
      itens,
      createdBy: user?.id || '',
      updatedAt: Date.now()
    };

    await saveShipment(shipment);

    if (status === 'ativo') {
      // Update inventory
      for (const item of itens) {
        if (item.tipo === 'tag' && item.tagId) {
          await updateItemStatus('tag', item.tagId, 'enviada', shipment.id);
        } else if (item.tipo === 'rastreador' && item.rastreadorId) {
          await updateItemStatus('rastreador', item.rastreadorId, 'enviado', shipment.id);
        }
      }
    }

    navigate('/envios');
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div></div>;

  const availableTags = tags.filter(t => t.status === 'disponível' || !t.status);
  const availableTrackers = trackers.filter(t => t.status === 'disponível');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/envios')} className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
          <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400" />
        </button>
        <h1 className="text-2xl font-display font-black text-zinc-900 dark:text-white uppercase tracking-tight">
          {id === 'nova' ? 'Nova Remessa' : 'Editar Remessa'}
        </h1>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 dark:bg-zinc-800 -z-10"></div>
        {[1, 2, 3].map(s => (
          <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 border-white dark:border-zinc-950 ${step >= s ? 'bg-primary-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Package size={20} className="text-primary-500" />
            Informações do Envio
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Código da Remessa</label>
              <input type="text" value={codigoRemessa} onChange={e => setCodigoRemessa(e.target.value)} readOnly className="w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-zinc-500 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Título da Remessa</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Lote SP - João" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
            </div>
            
            {isAdmin && (
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Solicitante *</label>
                <SearchableSelect
                  options={consultants.map(c => ({ id: c.id, label: c.name }))}
                  value={consultorId}
                  onChange={setConsultorId}
                  placeholder="Buscar solicitante..."
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Nome do Destinatário *</label>
              <SearchableSelect
                options={clients.map(c => ({ id: c.id, label: c.name, subLabel: c.phone || c.cpf }))}
                value={clients.find(c => c.name === destinatarioNome)?.id || ''}
                onChange={(val, option) => {
                  setDestinatarioNome(option?.label || '');
                  const client = clients.find(c => c.id === val);
                  if (client) {
                    setEmail(client.email || '');
                    setTelefone(client.phone || '');
                    setCpf(client.cpf || '');
                  }
                }}
                placeholder="Buscar cliente..."
              />
              {/* Fallback input for manual entry if client not found */}
              <input 
                type="text" 
                value={destinatarioNome} 
                onChange={e => setDestinatarioNome(e.target.value)} 
                placeholder="Ou digite o nome manualmente..."
                className="w-full px-4 py-3 mt-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" 
              />
            </div>

            <div className="space-y-2 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email do destinatário" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Telefone *</label>
                <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="Telefone do destinatário" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">CPF/CNPJ *</label>
                <input type="text" value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2 relative">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Endereço Completo *</label>
              <LocationPicker 
                onLocationSelect={(addr, lat, lng) => {
                  setEnderecoCompleto(addr);
                  setLat(lat);
                  setLng(lng);
                }}
                initialLat={lat || -5.79448}
                initialLng={lng || -35.211}
                tileProvider="google"
              />
              {enderecoCompleto && (
                <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{enderecoCompleto}</p>
                </div>
              )}
            </div>

            <div className="space-y-4 md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isRural} onChange={e => setIsRural(e.target.checked)} className="w-4 h-4 text-primary-500 rounded border-zinc-300" />
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Endereço em Zona Rural? (Requer detalhes manuais)</span>
              </label>
              {isRural && (
                <textarea 
                  value={ruralDetails} 
                  onChange={e => setRuralDetails(e.target.value)} 
                  placeholder="Por favor, forneça referências locais, informações de como chegar, cor da porteira/fachada, etc." 
                  rows={3} 
                  className="w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl outline-none focus:border-amber-500 text-sm"
                />
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Tipo de Envelope *</label>
              <select value={envelopeType} onChange={e => setEnvelopeType(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500">
                <option value="Pequeno">Envelope Pequeno (padrão)</option>
                <option value="Médio">Envelope Médio</option>
                <option value="Grande">Caixa / Outro</option>
              </select>
            </div>

            {isAdmin && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Transportadora</label>
                  <input type="text" value={transportadora} onChange={e => setTransportadora(e.target.value)} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Código de Rastreio</label>
                  <input type="text" value={codigoRastreio} onChange={e => setCodigoRastreio(e.target.value)} placeholder="Opcional neste momento" className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500" />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Observações</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:border-primary-500 resize-none"></textarea>
            </div>
          </div>
          
          <div className="flex justify-end pt-4 gap-4">
            {isAdmin ? (
               <button onClick={() => setStep(2)} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                 Próximo Passo
               </button>
            ) : (
               <button onClick={() => handleSave('ativo')} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition-colors flex items-center gap-2">
                 <CheckCircle size={20} /> Solicitar Envio
               </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Truck size={20} className="text-primary-500" />
            Itens do Lote
          </h2>

          <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-4">
            <div className="flex gap-4">
              {['tag', 'rastreador', 'outro'].map(type => (
                <label key={type} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="itemType" checked={itemType === type} onChange={() => setItemType(type as any)} className="text-primary-500 focus:ring-primary-500" />
                  <span className="capitalize font-bold text-zinc-700 dark:text-zinc-300">{type}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {itemType === 'tag' && (
                <SearchableSelect
                  options={availableTags.map(t => ({ id: t.id, label: `${t.accessoryId} (${t.name})`, subLabel: t.type }))}
                  value={selectedTagId}
                  onChange={setSelectedTagId}
                  placeholder="Buscar Tag (IMEI/ID)..."
                />
              )}
              
              {itemType === 'rastreador' && (
                <SearchableSelect
                  options={availableTrackers.map(t => ({ id: t.id, label: `${t.imei} (${t.model})`, subLabel: t.model }))}
                  value={selectedTrackerId}
                  onChange={setSelectedTrackerId}
                  placeholder="Buscar Rastreador (IMEI)..."
                />
              )}

              {itemType !== 'outro' && (
                <SearchableSelect
                  options={vehicles.map(v => ({ id: v.plate, label: `${v.plate} (${v.model})`, subLabel: v.model }))}
                  value={selectedPlate}
                  onChange={setSelectedPlate}
                  placeholder="Buscar Veículo (Placa) - Opcional..."
                />
              )}

              {itemType === 'outro' && (
                <input type="number" min="1" value={itemQuantity} onChange={e => setItemQuantity(parseInt(e.target.value))} placeholder="Quantidade" className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" />
              )}

              <input type="text" value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="Observações do item (opcional)" className="w-full md:col-span-2 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none" />
            </div>

            <button onClick={addItem} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
              <Plus size={20} /> Adicionar Item
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Itens Adicionados ({itens.length})</h3>
            {itens.map((item, idx) => (
              <div key={item.id} className="flex justify-between items-center p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="uppercase text-[10px] font-black tracking-widest bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-1 rounded-md">{item.tipo}</span>
                    <span className="font-bold text-zinc-900 dark:text-white">{item.placa || `${item.quantidade}x Itens`}</span>
                  </div>
                  {item.veiculoInfo && (
                    <p className="text-xs text-zinc-500 mt-1">{item.veiculoInfo.modelo} - {item.veiculoInfo.proprietario}</p>
                  )}
                </div>
                <button onClick={() => removeItem(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {itens.length === 0 && <p className="text-sm text-zinc-500 text-center py-4">Nenhum item adicionado ainda.</p>}
          </div>

          <div className="flex justify-between pt-4">
            <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors">
              Voltar
            </button>
            <button onClick={() => setStep(3)} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition-colors">
              Revisar Remessa
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <CheckCircle size={20} className="text-primary-500" />
            Revisão e Confirmação
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Destinatário</p>
                <p className="font-bold text-zinc-900 dark:text-white">{destinatarioNome}</p>
                {cpf && <p className="text-sm text-zinc-500 mt-1">CPF/CNPJ: {cpf}</p>}
                {telefone && <p className="text-sm text-zinc-500">Tel: {telefone}</p>}
                {email && <p className="text-sm text-zinc-500">Email: {email}</p>}
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{enderecoCompleto}</p>
                {isRural && (
                  <p className="text-sm text-amber-600 mt-1 bg-amber-50 dark:bg-amber-900/10 p-2 rounded">
                    <strong>Zona Rural:</strong> {ruralDetails}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Consultor</p>
                  <p className="font-bold text-zinc-900 dark:text-white">{consultants.find(c => c.id === (consultorId || user?.id))?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Tipo Envelope</p>
                  <p className="font-bold text-zinc-900 dark:text-white">{envelopeType}</p>
                </div>
              </div>
              {transportadora && (
                <div>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Transportadora</p>
                  <p className="font-bold text-zinc-900 dark:text-white">{transportadora}</p>
                </div>
              )}
            </div>
            
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Resumo dos Itens</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Tags</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{itens.filter(i => i.tipo === 'tag').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Rastreadores</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{itens.filter(i => i.tipo === 'rastreador').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">Outros</span>
                  <span className="font-bold text-zinc-900 dark:text-white">{itens.filter(i => i.tipo === 'outro').reduce((acc, i) => acc + i.quantidade, 0)}</span>
                </div>
                <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-2 flex justify-between">
                  <span className="font-bold text-zinc-900 dark:text-white">Total</span>
                  <span className="font-black text-primary-500">{itens.length} itens</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors">
              Voltar
            </button>
            <div className="flex gap-4">
              {user?.role !== 'client' && (
                <button onClick={() => melhorEnvioService.calculateShipping({ itens, destinatarioNome, enderecoCompleto })} className="px-6 py-3 rounded-xl font-bold text-primary-600 bg-primary-50 hover:bg-primary-100 dark:text-primary-400 dark:bg-primary-900/20 dark:hover:bg-primary-900/40 transition-colors flex items-center gap-2">
                  <Calculator size={20} /> Calcular Frete (Melhor Envio)
                </button>
              )}
              <button onClick={() => handleSave('rascunho')} className="px-6 py-3 rounded-xl font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:text-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors">
                Salvar Rascunho
              </button>
              <button onClick={() => handleSave('ativo')} className="bg-primary-500 hover:bg-primary-600 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-primary-500/20 flex items-center gap-2">
                <Save size={20} /> Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
