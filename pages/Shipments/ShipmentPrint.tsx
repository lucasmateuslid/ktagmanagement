import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useShipments, useInventory } from "../../hooks/useShipments";
import { Package, MapPin, Truck, Calendar } from "lucide-react";

export const ShipmentPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { shipments, loading } = useShipments();
  const { tags, loading: tagsLoading } = useInventory();
  const [shipment, setShipment] = useState<any>(null);

  useEffect(() => {
    if (!loading && !tagsLoading && id) {
      const found = shipments.find((s) => s.id === id);
      if (found) {
        setShipment(found);
        setTimeout(() => {
          window.print();
        }, 500);
      }
    }
  }, [id, shipments, loading, tagsLoading]);

  if (loading || tagsLoading || !shipment) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  const getTagDisplay = (tagId: string) => {
    const tag = tags.find((t: any) => t.id === tagId);
    return tag ? tag.accessoryId || tag.imei || tagId : tagId;
  };

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto min-h-screen font-sans print:p-0 print:m-0">
      {/* Print Styles */}
      <style>
        {`
          @media print {
            body { background-color: white !important; }
            .no-print { display: none !important; }
            * { color: black !important; border-color: #e5e7eb !important; }
          }
        `}
      </style>

      <div className="no-print mb-8 flex justify-between items-center">
        <button
          onClick={() => navigate(`/envios/${id}`)}
          className="px-4 py-2 bg-gray-100 rounded-xl font-bold hover:bg-gray-200 transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
        >
          Imprimir Novamente
        </button>
      </div>

      <div className="border-2 border-black rounded-2xl p-8 mb-8">
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
              Relatório de Remessa
            </h1>
            <p className="text-lg font-bold text-gray-600">{shipment.titulo}</p>
          </div>
          <div className="text-right">
            {shipment.codigoRemessa && (
              <>
                <p className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Código da Remessa
                </p>
                <p className="font-mono font-bold text-lg">
                  {shipment.codigoRemessa}
                </p>
              </>
            )}
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mt-2">
              ID da Remessa
            </p>
            <p className="font-mono font-bold text-sm text-gray-400">
              {shipment.id}
            </p>
            <p className="text-sm font-bold uppercase tracking-wider text-gray-500 mt-2">
              Data de Criação
            </p>
            <p className="font-bold">
              {new Date(shipment.dataCriacao).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
              <MapPin size={16} /> Destinatário
            </h2>
            <p className="font-bold text-xl mb-1">
              {shipment.destinatario.nome}
            </p>
            {shipment.destinatario.cpf && (
              <p className="text-gray-600">
                CPF/CNPJ: {shipment.destinatario.cpf}
              </p>
            )}
            {shipment.destinatario.telefone && (
              <p className="text-gray-600">
                Tel: {shipment.destinatario.telefone}
              </p>
            )}
            {shipment.destinatario.email && (
              <p className="text-gray-600">
                Email: {shipment.destinatario.email}
              </p>
            )}
            <p className="text-gray-700 mt-2">
              {shipment.destinatario.enderecoCompleto}
            </p>
            {shipment.destinatario.isRural && (
              <div className="mt-2 text-sm">
                <p className="font-bold text-gray-800">
                  Zona Rural (Instruções Adicionais):
                </p>
                <p className="text-gray-700 italic">
                  {shipment.destinatario.ruralDetails}
                </p>
              </div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
              <Truck size={16} /> Logística
            </h2>
            <p className="font-bold mb-1">
              Consultor:{" "}
              <span className="font-normal">{shipment.consultorNome}</span>
            </p>
            <p className="font-bold mb-1">
              Tipo de Envelope:{" "}
              <span className="font-normal">
                {shipment.envelopeType || "N/A"}
              </span>
            </p>
            <p className="font-bold mb-1">
              Transportadora:{" "}
              <span className="font-normal">
                {shipment.transportadora || "N/A"}
              </span>
            </p>
            <p className="font-bold">
              Rastreio:{" "}
              <span className="font-mono font-normal">
                {shipment.codigoRastreio || "Pendente"}
              </span>
            </p>
          </div>
        </div>

        {shipment.observacoes && (
          <div className="mb-8">
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-2">
              Observações da Remessa
            </h2>
            <p className="text-gray-700 italic p-4 bg-gray-50 rounded-lg border border-gray-200">
              {shipment.observacoes}
            </p>
          </div>
        )}

        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Package size={16} /> Itens da Remessa ({shipment.itens.length})
          </h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                  Tipo
                </th>
                <th className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                  Placa / Qtd
                </th>
                <th className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                  Veículo / Proprietário
                </th>
                <th className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                  Código (Tag/Rastreador)
                </th>
                <th className="py-3 px-4 font-black uppercase text-xs tracking-wider">
                  Observações
                </th>
              </tr>
            </thead>
            <tbody>
              {shipment.itens.map((item: any, index: number) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-200 ${index % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
                >
                  <td className="py-3 px-4 font-bold uppercase text-xs">
                    {item.tipo}
                  </td>
                  <td className="py-3 px-4 font-bold">
                    {item.placa || `${item.quantidade}x`}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {item.veiculoInfo ? (
                      <>
                        <span className="font-bold block">
                          {item.veiculoInfo.modelo}
                        </span>
                        <span className="text-gray-600 text-xs">
                          {item.veiculoInfo.proprietario}
                        </span>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs">
                    {item.tagId && (
                      <span className="block font-bold">
                        Tag: {getTagDisplay(item.tagId)}
                      </span>
                    )}
                    {item.rastreadorId && (
                      <span className="block font-bold">
                        Rast: {item.rastreadorId}
                      </span>
                    )}
                    {!item.tagId && !item.rastreadorId && "-"}
                  </td>
                  <td className="py-3 px-4 text-sm italic text-gray-600">
                    {item.observacoes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-12 pt-8 border-t-2 border-black flex justify-between items-center text-sm font-bold text-gray-500">
          <p>Impresso em {new Date().toLocaleString("pt-BR")}</p>
          <p>Total de Itens: {shipment.itens.length}</p>
        </div>
      </div>
    </div>
  );
};
