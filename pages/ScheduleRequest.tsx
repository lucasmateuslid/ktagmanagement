import React, { useState, useEffect, useMemo } from "react";
import { storage } from "../services/storage";
import { hinovaService } from "../services/hinova";
import {
  Schedule,
  DeviceType,
  ServiceType,
  Vehicle,
  User,
  Company,
  Technician,
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useNotification } from "../contexts/NotificationContext";
import { LocationPicker } from "../components/LocationPicker";
import {
  Calendar,
  Clock,
  Car,
  User as UserIcon,
  CreditCard,
  Search,
  Loader2,
  Phone,
  Lock,
  ChevronDown,
  Check,
  Building2,
  ClipboardCheck,
  Wallet,
  Send,
  X,
  Tag,
  MapPin,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { TechnicianAvailabilityAlert } from "../components/TechnicianAvailabilityAlert";

export const ScheduleRequest = () => {
  const { user } = useAuth();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const editSchedule = location.state?.editSchedule as Schedule | undefined;

  const [loading, setLoading] = useState(false);
  const [vehicleDb, setVehicleDb] = useState<Vehicle[]>([]);
  const [usersDb, setUsersDb] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchingPlate, setSearchingPlate] = useState(false);
  const [hinovaStatus, setHinovaStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  // Estados para o Dropdown Customizado de Operador
  const [isUserSelectOpen, setIsUserSelectOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const [isPontoFixo, setIsPontoFixo] = useState<boolean | null>(
    editSchedule ? (editSchedule.technicianId ? true : false) : null,
  );
  const [availableTechnicians, setAvailableTechnicians] = useState<
    Technician[]
  >([]);
  const [selectedTechnicianId, setSelectedTechnicianId] = useState<string>(
    editSchedule?.technicianId || "",
  );

  useEffect(() => {
    if (isPontoFixo) {
      const fetchTechs = async () => {
        const techs = await storage.getTechnicians();
        const available = techs.filter(
          (t) => t.serviceLocationType === "Ponto Fixo" && t.active,
        );
        setAvailableTechnicians(available);
        if (available.length > 0 && !selectedTechnicianId) {
          setSelectedTechnicianId(available[0].id);
        }
      };
      fetchTechs();
    } else {
      setAvailableTechnicians([]);
      setSelectedTechnicianId("");
    }
  }, [isPontoFixo]);

  const [formData, setFormData] = useState<Partial<Schedule>>(
    editSchedule
      ? {
          ...editSchedule,
        }
      : {
          deviceType: undefined,
          serviceType: "Instalação",
          fipeValue: "",
          notes: "",
          locationAddress: "",
          locationLat: 0,
          locationLng: 0,
        },
  );

  useEffect(() => {
    const initData = async () => {
      if (user) {
        setFormData((prev) => ({
          ...prev,
          requesterId: user.id,
          requesterName: user.name,
        }));
        setUserSearch(user.name);

        if (user.role === "admin" || user.role === "admin_tecnico") {
          const users = await storage.getAllUsers();
          const staff = users
            .filter((u) => u.role !== "client")
            .sort((a, b) => a.name.localeCompare(b.name));
          setUsersDb(staff);
        }
      }
      const [vecs, comps] = await Promise.all([
        storage.getVehicles(),
        storage.getCompanies(),
      ]);
      setVehicleDb(vecs);
      setCompanies(comps);
    };
    initData();
  }, [user]);

  useEffect(() => {
    if (formData.requesterName && !isUserSelectOpen) {
      setUserSearch(formData.requesterName);
    }
  }, [formData.requesterName, isUserSelectOpen]);

  const selectedCompany = useMemo(() => {
    return companies.find((c) => c.id === formData.companyId);
  }, [companies, formData.companyId]);

  const requiresManualClientEntry = useMemo(() => {
    if (!selectedCompany) return false;
    return selectedCompany.hasSgaIntegration === false;
  }, [selectedCompany]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return usersDb;
    if (userSearch === formData.requesterName) return usersDb;
    const term = userSearch.toLowerCase();
    return usersDb.filter((u) => u.name.toLowerCase().includes(term));
  }, [usersDb, userSearch, formData.requesterName]);

  const handlePlateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (value.length > 7) value = value.substring(0, 7);
    setFormData((prev) => ({ ...prev, vehiclePlate: value }));
  };

  const handlePlateBlur = async () => {
    const plate = formData.vehiclePlate;
    if (!plate || !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) return;

    setSearchingPlate(true);
    setTimeout(() => {
      const found = vehicleDb.find(
        (v) => v.plate.replace(/[^A-Z0-9]/g, "") === plate,
      );
      if (found) {
        setFormData((prev) => ({
          ...prev,
          vehicleModel: found.model,
          fipeValue: found.fipeCode
            ? `FIPE: ${found.fipeCode} (Consulte valor)`
            : prev.fipeValue,
          companyId: found.companyId || prev.companyId,
        }));
        addNotification(
          "success",
          "Veículo Encontrado",
          "Dados do veículo carregados do sistema.",
        );
      }
      setSearchingPlate(false);
      
      // Auto-trigger SGA lookup
      if (!requiresManualClientEntry) {
          handleHinovaLookup(plate);
      }
    }, 500);
  };

  const handleHinovaLookup = async (plateOverride?: string) => {
    if (hinovaStatus === "loading") return;

    const plateToSearch = plateOverride || formData.vehiclePlate;

    if (
      !plateToSearch ||
      !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plateToSearch)
    ) {
      addNotification(
        "info",
        "Validação",
        "A placa deve estar no formato AAA0000 ou AAA0A00 com 7 caracteres.",
      );
      return;
    }

    setHinovaStatus("loading");
    try {
      const result = await hinovaService.searchVehicle(plateToSearch);
      if (result && result.vehicle) {
        setFormData((prev) => ({
          ...prev,
          vehicleModel: result.vehicle.model || prev.vehicleModel,
          vehicleChassis: result.vehicle.chassis || prev.vehicleChassis,
          vehicleColor: result.vehicle.color || prev.vehicleColor,
          vehicleStatus: result.vehicle.vehicleStatus || prev.vehicleStatus,
          clientStatus: result.client.clientStatus || prev.clientStatus,
          fipeValue:
            result.price ||
            (result.vehicle.fipeCode
              ? `Código FIPE: ${result.vehicle.fipeCode}`
              : prev.fipeValue),
          clientName: result.client.name,
          clientPhone: result.client.phone || undefined,
          clientCpf: result.client.cpf,
          clientAddress:
            result.client.address ||
            `${result.client.city} - ${result.client.state}`,
          clientEmail: result.client.email,
        }));
        setHinovaStatus("success");
        addNotification(
          "success",
          "Hinova",
          "Dados do veículo e cliente importados do SGA.",
        );
      } else {
        setHinovaStatus("error");
        addNotification(
          "error",
          "Hinova",
          "Veículo não encontrado na base externa.",
        );
      }
    } catch (e: any) {
      setHinovaStatus("error");
      addNotification("error", "API SGA", e.message);
    } finally {
      setTimeout(() => setHinovaStatus("idle"), 3000);
    }
  };

  const selectUser = (selectedUser: User) => {
    setFormData((prev) => ({
      ...prev,
      requesterId: selectedUser.id,
      requesterName: selectedUser.name,
    }));
    setUserSearch(selectedUser.name);
    setIsUserSelectOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validação estrita do deviceType conforme solicitado
    if (!formData.deviceType) {
      addNotification(
        "error",
        "Dispositivo Obrigatório",
        "Selecione o tipo de dispositivo para prosseguir.",
      );
      return;
    }

    if (isPontoFixo === null) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Selecione o local de atendimento (Volante ou Ponto Fixo).",
      );
      return;
    }

    if (isPontoFixo && !selectedTechnicianId) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Selecione um técnico para o Ponto Fixo.",
      );
      return;
    }

    if (!isPontoFixo && !formData.locationAddress) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Informe o endereço para o atendimento Volante.",
      );
      return;
    }

    if (
      !formData.vehiclePlate ||
      !formData.vehicleModel ||
      !formData.preferredDate ||
      !formData.preferredTime
    ) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Preencha todos os dados obrigatórios (*).",
      );
      return;
    }

    if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(formData.vehiclePlate)) {
      addNotification(
        "error",
        "Placa Inválida",
        "A placa deve estar no formato AAA0000 ou AAA0A00 com 7 caracteres.",
      );
      return;
    }

    if (!formData.clientName || !formData.clientCpf || !formData.clientPhone) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "O nome do cliente, CPF e telefone são obrigatórios.",
      );
      return;
    }

    if (formData.needsInspection === undefined) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Informe se o veículo necessita de vistoria.",
      );
      return;
    }

    if (formData.paymentOnSite === undefined) {
      addNotification(
        "error",
        "Campos Obrigatórios",
        "Informe se o pagamento será realizado no local.",
      );
      return;
    }

    setLoading(true);
    try {
      const finalRequesterId = formData.requesterId || user.id;
      const finalRequesterName = formData.requesterName || user.name;

      if (editSchedule) {
        const schedule: Schedule = {
          ...editSchedule,
          requesterId: finalRequesterId,
          requesterName: finalRequesterName,
          clientName: formData.clientName,
          clientPhone: formData.clientPhone,
          clientCpf: formData.clientCpf,
          clientEmail: formData.clientEmail,
          clientAddress: formData.clientAddress,
          clientStatus: formData.clientStatus,
          vehiclePlate: formData.vehiclePlate?.toUpperCase() || "",
          vehicleModel: formData.vehicleModel || "",
          vehicleChassis: formData.vehicleChassis || "",
          vehicleColor: formData.vehicleColor || "",
          vehicleStatus: formData.vehicleStatus || "",
          fipeValue: formData.fipeValue || "Não informado",
          deviceType: formData.deviceType as DeviceType,
          serviceType: formData.serviceType as ServiceType,
          companyId: formData.companyId,
          preferredDate: formData.preferredDate || "",
          preferredTime: formData.preferredTime || "",
          notes: formData.notes,
          needsInspection: formData.needsInspection,
          paymentOnSite: formData.paymentOnSite,
          locationAddress: isPontoFixo
            ? "Ponto Fixo"
            : formData.locationAddress || "",
          locationLat: isPontoFixo ? 0 : formData.locationLat || 0,
          locationLng: isPontoFixo ? 0 : formData.locationLng || 0,
          isRemoteLocation: !isPontoFixo,
          technicianId: isPontoFixo
            ? selectedTechnicianId
            : editSchedule.technicianId,
        };

        schedule.history.push({
          action: "Editou",
          actionBy: user.name,
          timestamp: Date.now(),
          details: "Agendamento editado pelo administrador/consultor.",
        });

        await storage.saveSchedule(schedule);
        addNotification(
          "success",
          "Agendamento Editado",
          `Edição salva com sucesso.`,
        );
        navigate("/schedules");
        return;
      }

      // Generate OS Number
      const company = companies.find((c) => c.id === formData.companyId);
      const prefix = company?.prefix || "GEN";
      const dateObj = new Date();
      const dd = String(dateObj.getDate()).padStart(2, "0");
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const yy = String(dateObj.getFullYear()).slice(-2);

      // Get all schedules to find the next number for today
      const allSchedules = await storage.getSchedules(
        user?.role || "",
        user?.id || "",
      );
      const todayPrefix = `OS:${prefix}/${dd}/${mm}/${yy}-`;
      const todaySchedules = allSchedules.filter((s) =>
        s.osNumber?.startsWith(todayPrefix),
      );
      const nextNum = String(todaySchedules.length + 1).padStart(4, "0");
      const osNumber = `${todayPrefix}${nextNum}`;

      const schedule: Schedule = {
        id: crypto.randomUUID(),
        requesterId: finalRequesterId,
        requesterName: finalRequesterName,
        clientName: formData.clientName,
        clientPhone: formData.clientPhone,
        clientCpf: formData.clientCpf,
        clientEmail: formData.clientEmail,
        clientAddress: formData.clientAddress,
        clientStatus: formData.clientStatus,
        vehiclePlate: formData.vehiclePlate.toUpperCase(),
        vehicleModel: formData.vehicleModel,
        vehicleChassis: formData.vehicleChassis,
        vehicleColor: formData.vehicleColor,
        vehicleStatus: formData.vehicleStatus,
        fipeValue: formData.fipeValue || "Não informado",
        deviceType: formData.deviceType as DeviceType,
        serviceType: formData.serviceType as ServiceType,
        companyId: formData.companyId,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        notes: formData.notes,
        needsInspection: formData.needsInspection,
        paymentOnSite: formData.paymentOnSite,
        locationAddress: isPontoFixo
          ? "Ponto Fixo"
          : formData.locationAddress || "",
        locationLat: isPontoFixo ? 0 : formData.locationLat || 0,
        locationLng: isPontoFixo ? 0 : formData.locationLng || 0,
        isRemoteLocation: !isPontoFixo,
        status: isPontoFixo ? "Confirmada" : "Solicitada",
        technicianId: isPontoFixo ? selectedTechnicianId : undefined,
        osNumber: osNumber,
        createdAt: Date.now(),
        history: [
          {
            action: "Solicitou",
            actionBy: user.name,
            timestamp: Date.now(),
            details:
              user.id !== finalRequesterId
                ? `Solicitado por Admin em nome de ${finalRequesterName}`
                : "Solicitação criada via portal",
          },
        ],
      };

      if (isPontoFixo) {
        schedule.history.push({
          action: "Confirmou",
          actionBy: "Sistema",
          timestamp: Date.now() + 1000,
          details: "Agendamento automático para Ponto Fixo",
        });
      }

      await storage.saveSchedule(schedule);
      addNotification(
        "success",
        "Solicitação Enviada",
        `Agendamento criado com sucesso.`,
      );
      navigate("/schedules");
    } catch (err) {
      addNotification("error", "Erro", "Falha ao enviar solicitação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 pb-24">
      <div className="bg-zinc-900 text-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] shadow-2xl relative overflow-hidden border border-zinc-800">
        <div className="relative z-10">
          <div className="flex flex-col gap-1 mb-2">
            <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-primary-500 rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-widest text-primary-500">MÓDULO DE SERVIÇOS</p>
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-black uppercase tracking-tight">
            {editSchedule ? "Editar Solicitação" : "Nova Solicitação"}
          </h1>
          <p className="text-zinc-400 mt-2 font-medium text-xs md:text-sm pr-10">
            {editSchedule
              ? "Altere os dados do agendamento técnico."
              : "Preencha os dados abaixo para agendar um serviço técnico."}
          </p>
        </div>
        <div className="absolute top-0 right-0 p-6 md:p-10 opacity-10 pointer-events-none">
          <Calendar size={100} />
        </div>
      </div>

      <TechnicianAvailabilityAlert />

      <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
        {/* DADOS DO SOLICITANTE */}
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-zinc-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <UserIcon size={20} />
            <h3 className="font-black uppercase tracking-widest text-xs">
              Dados do Solicitante (Operador)
            </h3>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
              Nome do Operador <span className="text-red-500">*</span>
            </label>
            <div className="relative mt-1">
              {user?.role === "admin" || user?.role === "admin_tecnico" ? (
                <div className="relative">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setIsUserSelectOpen(true);
                    }}
                    onFocus={() => {
                      setIsUserSelectOpen(true);
                      if (userSearch === formData.requesterName)
                        setUserSearch("");
                    }}
                    className="w-full pl-4 pr-10 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none text-zinc-900 dark:text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all placeholder:text-zinc-400"
                    placeholder="Buscar operador..."
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    {isUserSelectOpen ? (
                      <Search size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </div>
                  {isUserSelectOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setIsUserSelectOpen(false);
                          if (!usersDb.some((u) => u.name === userSearch))
                            setUserSearch(formData.requesterName || "");
                        }}
                      ></div>
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar p-1 animate-in fade-in slide-in-from-top-2">
                        {filteredUsers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-zinc-400 font-medium">
                            Nenhum operador encontrado
                          </div>
                        ) : (
                          filteredUsers.map((u) => (
                            <div
                              key={u.id}
                              onClick={() => selectUser(u)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-colors ${u.id === formData.requesterId ? "bg-primary-500/10 text-primary-600 dark:text-primary-400" : "hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"}`}
                            >
                              <span className="text-sm font-bold truncate">
                                {u.name}
                              </span>
                              {u.id === formData.requesterId && (
                                <Check size={14} className="shrink-0" />
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={formData.requesterName || ""}
                    className="w-full px-4 py-3.5 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-bold text-sm outline-none text-zinc-500 cursor-not-allowed"
                  />
                  <Lock
                    size={14}
                    className="absolute right-4 top-1/2 mt-0.5 -translate-y-1/2 text-zinc-400"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DADOS DO VEÍCULO */}
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-primary-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <Car size={20} />
            <h3 className="font-black uppercase tracking-widest text-xs">
              Dados do Veículo & Cliente
            </h3>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
              Empresa Responsável (Regional)
            </label>
            <div className="relative mt-1">
              <Building2
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                size={16}
              />
              <select
                value={formData.companyId || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    companyId: e.target.value,
                  }))
                }
                className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none"
              >
                <option value="">-- Selecione a Regional --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Placa <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    maxLength={7}
                    required
                    value={formData.vehiclePlate || ""}
                    onChange={handlePlateChange}
                    onBlur={handlePlateBlur}
                    className="w-full pl-4 pr-10 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-black text-sm outline-none uppercase placeholder:text-zinc-300"
                    placeholder="AAA0000"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                    {searchingPlate ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-primary-500"
                      />
                    ) : (
                      <Search size={16} />
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleHinovaLookup()}
                  disabled={
                    hinovaStatus === "loading" || requiresManualClientEntry
                  }
                  title={
                    requiresManualClientEntry
                      ? "Integração SGA não disponível para esta empresa"
                      : "Consultar SGA"
                  }
                  className={`px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md flex items-center justify-center min-w-[70px] text-white ${
                    requiresManualClientEntry
                      ? "bg-zinc-300 dark:bg-zinc-700 cursor-not-allowed opacity-50"
                      : hinovaStatus === "success"
                        ? "bg-emerald-500 hover:bg-emerald-600"
                        : hinovaStatus === "error"
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-[#006e82] hover:bg-[#008ba3]"
                  }`}
                >
                  {hinovaStatus === "loading" ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : hinovaStatus === "success" ? (
                    <Check size={16} strokeWidth={4} />
                  ) : hinovaStatus === "error" ? (
                    <X size={16} strokeWidth={4} />
                  ) : (
                    "SGA"
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Modelo do Veículo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.vehicleModel || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    vehicleModel: e.target.value,
                  }))
                }
                className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none placeholder:text-zinc-300"
                placeholder="Ex: Fiat Uno Way"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                  Chassi
                </label>
                <input
                  type="text"
                  value={formData.vehicleChassis || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vehicleChassis: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                  Cor
                </label>
                <input
                  type="text"
                  value={formData.vehicleColor || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vehicleColor: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                  Situação SGA (Veículo)
                </label>
                <input
                  type="text"
                  value={formData.vehicleStatus || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vehicleStatus: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Valor FIPE (R$)
              </label>
              <div className="relative mt-1">
                <CreditCard
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  size={16}
                />
                <input
                  type="text"
                  value={formData.fipeValue || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fipeValue: e.target.value,
                    }))
                  }
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none"
                  placeholder="R$ 0,00 (Opcional)"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Tipo de Dispositivo <span className="text-red-500">*</span>
              </label>
              <div className="relative mt-1">
                <Tag
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  size={16}
                />
                <select
                  value={formData.deviceType || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      deviceType: e.target.value as DeviceType,
                    }))
                  }
                  className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none"
                >
                  <option value="" disabled>
                    -- Selecione o Dispositivo --
                  </option>
                  <option value="Rastreador">Rastreador</option>
                  <option value="Tag">Tag</option>
                  <option value="Rastreador + Tag">Rastreador + Tag</option>
                  <option value="Não precisa">Não precisa</option>
                </select>
              </div>
            </div>
          </div>

          <div
            className={`p-5 rounded-2xl border ${!requiresManualClientEntry && formData.clientName ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/20" : "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800"} animate-in fade-in slide-in-from-top-2`}
          >
            <div className="flex items-center gap-2 mb-4">
              <UserIcon
                size={16}
                className={
                  !requiresManualClientEntry && formData.clientName
                    ? "text-emerald-500"
                    : "text-zinc-500"
                }
              />
              <span
                className={`text-[10px] font-black uppercase tracking-widest ${!requiresManualClientEntry && formData.clientName ? "text-emerald-600 dark:text-emerald-500" : "text-zinc-500"}`}
              >
                {!requiresManualClientEntry && formData.clientName
                  ? "Pré-Cadastro Cliente (SGA)"
                  : "Dados do Cliente"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientName || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientName: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                  CPF/CNPJ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientCpf || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientCpf: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                  Telefone <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.clientPhone || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientPhone: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                  Situação SGA (Cliente)
                </label>
                <input
                  type="text"
                  value={formData.clientStatus || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientStatus: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                  placeholder="Situação do cliente"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                  Endereço de Faturamento / Casa
                </label>
                <input
                  type="text"
                  value={formData.clientAddress || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      clientAddress: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm outline-none mt-1"
                  placeholder="Bairro, Rua, Cidade..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* AGENDAMENTO E LOCAL */}
        <div className="bg-white dark:bg-zinc-900 p-5 md:p-8 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-emerald-500 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <Clock size={20} />
            <h3 className="font-black uppercase tracking-widest text-xs">
              Agendamento & Local
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Tipo de Serviço <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    serviceType: e.target.value as ServiceType,
                  }))
                }
                className="w-full px-4 py-3.5 mt-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none"
              >
                <option value="Instalação">Instalação</option>
                <option value="Manutenção">Manutenção</option>
                <option value="Retirada">Retirada</option>
                <option value="Vistoria">Vistoria</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">
                  Data <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none"
                  />
                  <input
                    type="date"
                    required
                    value={formData.preferredDate || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        preferredDate: e.target.value,
                      }))
                    }
                    className="w-full pl-9 pr-2 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white"
                  />
                </div>
              </div>
              <div className="relative">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mb-1 block">
                  Hora <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Clock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 pointer-events-none"
                  />
                  <input
                    type="time"
                    required
                    value={formData.preferredTime || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        preferredTime: e.target.value,
                      }))
                    }
                    className="w-full pl-9 pr-2 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                <ClipboardCheck size={14} /> Vistoria Necessária?{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, needsInspection: true }))
                  }
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.needsInspection === true ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg" : "text-zinc-500"}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, needsInspection: false }))
                  }
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.needsInspection === false ? "bg-zinc-900 dark:bg-zinc-700 text-white shadow-lg" : "text-zinc-500"}`}
                >
                  Não
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                <Wallet size={14} /> Pagamento no Local?{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, paymentOnSite: true }))
                  }
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.paymentOnSite === true ? "bg-emerald-500 text-white shadow-lg" : "text-zinc-500"}`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, paymentOnSite: false }))
                  }
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.paymentOnSite === false ? "bg-zinc-900 dark:bg-zinc-700 text-white shadow-lg" : "text-zinc-500"}`}
                >
                  Não
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-2">
                <MapPin size={14} /> Local de Atendimento{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex gap-1 border border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPontoFixo(false)}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isPontoFixo === false ? "bg-primary-500 text-white shadow-lg" : "text-zinc-500"}`}
                >
                  Volante
                </button>
                <button
                  type="button"
                  onClick={() => setIsPontoFixo(true)}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isPontoFixo === true ? "bg-primary-500 text-white shadow-lg" : "text-zinc-500"}`}
                >
                  Ponto Fixo
                </button>
              </div>
            </div>
          </div>

          {isPontoFixo === true && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
                Técnico (Ponto Fixo) <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTechnicianId}
                onChange={(e) => setSelectedTechnicianId(e.target.value)}
                className="w-full px-4 py-3.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-xs outline-none"
              >
                <option value="" disabled>
                  -- Selecione um Técnico --
                </option>
                {availableTechnicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {availableTechnicians.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  Nenhum técnico com ponto fixo disponível.
                </p>
              )}
            </div>
          )}

          {isPontoFixo === false && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <LocationPicker
                onLocationSelect={(addr, lat, lng) =>
                  setFormData((prev) => ({
                    ...prev,
                    locationAddress: addr,
                    locationLat: lat,
                    locationLng: lng,
                  }))
                }
                initialLat={-5.79448}
                initialLng={-35.211}
                tileProvider="google"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">
              Observações Adicionais
            </label>
            <textarea
              rows={3}
              value={formData.notes || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-medium text-xs outline-none focus:border-emerald-500 transition-all resize-none"
              placeholder="Detalhes para o técnico..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-6 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[28px] font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-emerald-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70 disabled:grayscale"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={24} />
          ) : (
            <Send size={24} />
          )}
          {loading
            ? "Processando..."
            : editSchedule
              ? "SALVAR EDIÇÃO"
              : "ENVIAR SOLICITAÇÃO"}
        </button>
      </form>
    </div>
  );
};
