import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy
} from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/error-handler";
import { BarberChat } from "../components/BarberChat";
import { motion, AnimatePresence } from "motion/react";
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Scissors, 
  Settings, 
  Plus, 
  ExternalLink,
  Users,
  TrendingUp,
  Phone,
  Clock,
  X,
  Pencil
} from "lucide-react";

import { useAuth } from "../lib/auth-context";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  ownerId: string;
  suspensa?: boolean;
  motivoSuspensao?: string;
}

interface Agendamento {
  id: string;
  clienteNome: string;
  clienteWhatsApp: string;
  dataHora: string;
  servicoId: string;
  colaboradorId?: string;
  status: string;
}

interface Colaborador {
  id: string;
  nome: string;
  especialidade: string;
  status: string;
  comissaoTipo: 'porcentagem' | 'valor';
  comissaoValor: number;
}

interface Movimentacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  data: string;
  categoria: string;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracaoMinutos: number;
}

export default function Dashboard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [activeTab, setActiveTab] = useState('agenda');
  const [selectedBarberFilter, setSelectedBarberFilter] = useState("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [isSuspending, setIsSuspending] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");

  useEffect(() => {
    if (barbearia) {
      setSuspensionReason(barbearia.motivoSuspensao || "");
    }
  }, [barbearia]);

  async function handleToggleSuspension() {
    if (!barbearia) return;
    setIsSuspending(true);
    try {
      const isSuspended = !barbearia.suspensa;
      await updateDoc(doc(db, "barbearias", barbearia.id), {
        suspensa: isSuspended,
        motivoSuspensao: isSuspended ? suspensionReason : ""
      });
      setBarbearia({ ...barbearia, suspensa: isSuspended, motivoSuspensao: isSuspended ? suspensionReason : "" });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `barbearias/${barbearia.id}`);
    } finally {
      setIsSuspending(false);
    }
  }

  // Derive unique clients from appointments
  const clientsMap = new Map<string, { nome: string; whats: string; totalVisitas: number; ultimaVisita: string }>();
  
  agendamentos.forEach(ag => {
    const whats = ag.clienteWhatsApp;
    const existing = clientsMap.get(whats);
    
    if (!existing || new Date(ag.dataHora) > new Date(existing.ultimaVisita)) {
      clientsMap.set(whats, {
        nome: ag.clienteNome,
        whats,
        totalVisitas: agendamentos.filter(a => a.clienteWhatsApp === whats && a.status === 'concluido').length,
        ultimaVisita: ag.dataHora
      });
    }
  });

  const clientes = Array.from(clientsMap.values()).filter(c => 
    c.nome.toLowerCase().includes(clientSearchQuery.toLowerCase()) || 
    c.whats.includes(clientSearchQuery)
  );

  const todayStr = new Date().toLocaleDateString('en-CA');

  const stats = [
    { 
      label: 'Saldo Geral Hoje', 
      value: `R$ ${(movimentacoes.filter(m => 
        new Date(m.data).toLocaleDateString('en-CA') === todayStr
      ).reduce((acc, curr) => curr.tipo === 'entrada' ? acc + curr.valor : acc - curr.valor, 0)).toFixed(2)}`, 
      icon: LayoutDashboard, 
      color: 'text-indigo-400' 
    },
    { 
      label: selectedBarberFilter === "all" ? 'Produção Total' : 'Produção Barber', 
      value: `R$ ${(movimentacoes.filter(m => 
        (selectedBarberFilter === "all" || m.colaboradorId === selectedBarberFilter) &&
        new Date(m.data).toLocaleDateString('en-CA') === todayStr
      ).reduce((acc, curr) => curr.tipo === 'entrada' ? acc + curr.valor : acc - curr.valor, 0)).toFixed(2)}`, 
      icon: TrendingUp, 
      color: 'text-green-400' 
    },
    { 
      label: 'Comissão Estimada', 
      value: (() => {
        if (selectedBarberFilter === "all") return "Selecione Barber";
        const c = colaboradores.find(col => col.id === selectedBarberFilter);
        if (!c) return "R$ 0.00";
        
        const totalProd = movimentacoes.filter(m => 
          m.colaboradorId === selectedBarberFilter &&
          new Date(m.data).toLocaleDateString('en-CA') === todayStr &&
          m.tipo === 'entrada'
        ).reduce((acc, curr) => acc + curr.valor, 0);

        const com = c.comissaoTipo === 'porcentagem' 
          ? (totalProd * c.comissaoValor / 100) 
          : (movimentacoes.filter(m => m.colaboradorId === selectedBarberFilter && new Date(m.data).toLocaleDateString('en-CA') === todayStr && m.tipo === 'entrada').length * c.comissaoValor);
        
        return `R$ ${com.toFixed(2)}`;
      })(), 
      icon: Scissors, 
      color: 'text-amber-400' 
    },
  ];

  // State for services
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAddAppointmentModal, setShowAddAppointmentModal] = useState(false);
  const [newApClientName, setNewApClientName] = useState("");
  const [newApClientWhats, setNewApClientWhats] = useState("");
  const [newApServiceId, setNewApServiceId] = useState("");
  const [newApColaboradorId, setNewApColaboradorId] = useState("");
  const [newApDate, setNewApDate] = useState("");
  const [newApTime, setNewApTime] = useState("");
  const [isCreatingAp, setIsCreatingAp] = useState(false);

  const handleAddWalkIn = async () => {
    if (!newApClientName || !newApClientWhats || !newApServiceId || !newApDate || !newApTime) return;
    setIsCreatingAp(true);
    try {
      await addDoc(collection(db, "agendamentos"), {
        barbeariaId: barbearia?.id,
        clienteNome: newApClientName,
        clienteWhatsApp: newApClientWhats,
        servicoId: newApServiceId,
        colaboradorId: newApColaboradorId || null,
        dataHora: new Date(`${newApDate}T${newApTime}`).toISOString(),
        status: 'aprovado',
        createdAt: new Date().toISOString()
      });
      setShowAddAppointmentModal(false);
      setNewApClientName("");
      setNewApClientWhats("");
      setNewApServiceId("");
      setNewApColaboradorId("");
      setNewApDate("");
      setNewApTime("");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "agendamentos");
    } finally {
      setIsCreatingAp(false);
    }
  };
  const availableSlots = (() => {
    if (!newApDate) return [];
    
    const slots = [];
    for (let h = 8; h < 20; h++) {
      for (let m = 0; m < 60; m += 30) {
        slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }

    const dayAppointments = agendamentos.filter(ag => 
      ag.status !== 'cancelado' && 
      new Date(ag.dataHora).toLocaleDateString('en-CA') === newApDate
    );

    const colabsAtivos = colaboradores.filter(c => c.status === 'ativo');
    const totalCadeiras = colabsAtivos.length || 1;

    return slots.map(slot => {
      const appsAtTime = dayAppointments.filter(ag => {
        const d = new Date(ag.dataHora);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` === slot;
      });

      let isAvailable = true;
      if (newApColaboradorId) {
        // Se profissional específico selecionado, ver se ELE está livre
        isAvailable = !appsAtTime.some(ag => ag.colaboradorId === newApColaboradorId);
      } else {
        // Se nenhum selecionado, livre se houver pelo menos uma cadeira livre
        isAvailable = appsAtTime.length < totalCadeiras;
      }

      return {
        time: slot,
        isAvailable
      };
    });
  })();

  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("45");
  const [serviceToDeleteId, setServiceToDeleteId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);
  const [deletingService, setDeletingService] = useState(false);

  // Cash Flow States
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [mDesc, setMDesc] = useState("");
  const [mValue, setMValue] = useState("");
  const [mType, setMType] = useState<'entrada' | 'saida'>('entrada');
  const [mCategory, setMCategory] = useState("Venda");
  const [isSavingM, setIsSavingM] = useState(false);

  // Collaborator States
  const [showColabModal, setShowColabModal] = useState(false);
  const [colabName, setColabName] = useState("");
  const [colabSpecialty, setColabSpecialty] = useState("");
  const [colabStatus, setColabStatus] = useState("ativo");
  const [colabComType, setColabComType] = useState<'porcentagem' | 'valor'>('porcentagem');
  const [colabComValue, setColabComValue] = useState("");
  const [editingColab, setEditingColab] = useState<Colaborador | null>(null);
  const [isSavingColab, setIsSavingColab] = useState(false);

  const handleSaveMovimentacao = async () => {
    if (!barbearia || !mDesc || !mValue) return;
    setIsSavingM(true);
    try {
      const data = {
        barbeariaId: barbearia.id,
        descricao: mDesc,
        valor: Number(mValue),
        tipo: mType,
        categoria: mCategory,
        data: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, "movimentacoes"), data);
      setMovimentacoes(prev => [{ id: docRef.id, ...data }, ...prev]);
      setShowCashFlowModal(false);
      setMDesc("");
      setMValue("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "movimentacoes");
    } finally {
      setIsSavingM(false);
    }
  };

  const handleSaveColab = async () => {
    if (!barbearia || !colabName) return;
    setIsSavingColab(true);
    try {
      const data = {
        barbeariaId: barbearia.id,
        nome: colabName,
        especialidade: colabSpecialty,
        status: colabStatus,
        comissaoTipo: colabComType,
        comissaoValor: Number(colabComValue) || 0,
      };
      if (editingColab) {
        await updateDoc(doc(db, "colaboradores", editingColab.id), data);
        setColaboradores(prev => prev.map(c => c.id === editingColab.id ? { ...c, ...data } : c));
      } else {
        const docRef = await addDoc(collection(db, "colaboradores"), data);
        setColaboradores(prev => [...prev, { id: docRef.id, ...data }]);
      }
      setShowColabModal(false);
      setColabName("");
      setColabSpecialty("");
      setEditingColab(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "colaboradores");
    } finally {
      setIsSavingColab(false);
    }
  };

  const deleteColab = async (id: string) => {
    if (!confirm("Excluir colaborador?")) return;
    try {
      await deleteDoc(doc(db, "colaboradores", id));
      setColaboradores(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "colaboradores");
    }
  };

  useEffect(() => {
    async function loadData() {
      if (!slug || !user) return;
      try {
        const bQuery = query(collection(db, "barbearias"), where("slug", "==", slug));
        const bSnap = await getDocs(bQuery);
        
        if (bSnap.empty) {
          navigate("/");
          return;
        }

        const bDoc = bSnap.docs[0];
        const bData = { id: bDoc.id, ...bDoc.data() } as Barbearia;
        
        if (bData.ownerId !== user.uid && !isAdmin && !isSuperAdmin) {
          navigate("/");
          return;
        }

        setBarbearia(bData);

        const agQuery = query(
          collection(db, "agendamentos"), 
          where("barbeariaId", "==", bDoc.id),
          orderBy("dataHora", "asc")
        );
        const agSnap = await getDocs(agQuery).catch(err => {
            console.warn("Retornando agendamentos sem ordenação (índice pendente)", err);
            return getDocs(query(collection(db, "agendamentos"), where("barbeariaId", "==", bDoc.id)));
        });
        
        const agData = agSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agendamento));
        const sortedAg = agData.sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
        setAgendamentos(sortedAg);

        const sQuery = query(collection(db, "servicos"), where("barbeariaId", "==", bDoc.id));
        const sSnap = await getDocs(sQuery);
        setServicos(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Servico)));

        const cQuery = query(collection(db, "colaboradores"), where("barbeariaId", "==", bDoc.id));
        const cSnap = await getDocs(cQuery);
        setColaboradores(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Colaborador)));

        const mQuery = query(
          collection(db, "movimentacoes"), 
          where("barbeariaId", "==", bDoc.id),
          orderBy("data", "desc")
        );
        const mSnap = await getDocs(mQuery).catch(() => getDocs(query(collection(db, "movimentacoes"), where("barbeariaId", "==", bDoc.id))));
        setMovimentacoes(mSnap.docs.map(d => ({ id: d.id, ...d.data() } as Movimentacao)));

      } catch (err) {
        console.error(err);
        handleFirestoreError(err, OperationType.LIST, "dashboard-fetch");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, navigate, user, isAdmin, isSuperAdmin]);

  async function handleSaveService() {
    if (!barbearia || !serviceName || !servicePrice || savingService) return;

    setSavingService(true);
    try {
      if (editingServico) {
        await updateDoc(doc(db, "servicos", editingServico.id), {
          nome: serviceName,
          preco: Number(servicePrice),
          duracaoMinutos: Number(serviceDuration)
        });
      } else {
        await addDoc(collection(db, "servicos"), {
          nome: serviceName,
          preco: Number(servicePrice),
          duracaoMinutos: Number(serviceDuration),
          barbeariaId: barbearia.id,
          createdAt: serverTimestamp()
        });
      }

      const sQuery = query(collection(db, "servicos"), where("barbeariaId", "==", barbearia.id));
      const sSnap = await getDocs(sQuery);
      setServicos(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Servico)));
      
      setShowServiceModal(false);
    } catch (err) {
      handleFirestoreError(err, editingServico ? OperationType.UPDATE : OperationType.CREATE, "servicos");
    } finally {
      setSavingService(false);
    }
  }

  async function handleUpdateStatus(id: string, newStatus: string) {
    setUpdatingStatus(id);
    try {
      await updateDoc(doc(db, "agendamentos", id), { status: newStatus });
      
      // If completed, add to cash flow
      if (newStatus === 'concluido') {
        const ag = agendamentos.find(a => a.id === id);
        if (ag && barbearia) {
          const service = servicos.find(s => s.id === ag.servicoId);
          if (service) {
            const data = {
              barbeariaId: barbearia.id,
              colaboradorId: ag.colaboradorId || null,
              descricao: `Atendimento: ${ag.clienteNome} (${service.nome})`,
              valor: service.preco,
              tipo: 'entrada' as const,
              categoria: 'Serviço',
              data: new Date().toISOString(),
            };
            const mRef = await addDoc(collection(db, "movimentacoes"), data);
            setMovimentacoes(prev => [{ id: mRef.id, ...data }, ...prev]);
          }
        }
      }

      setAgendamentos(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agendamentos/${id}`);
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleDeleteService() {
    if (!serviceToDeleteId || !barbearia || deletingService) return;

    setDeletingService(true);
    try {
      await deleteDoc(doc(db, "servicos", serviceToDeleteId));
      setServicos(prev => prev.filter(s => s.id !== serviceToDeleteId));
      setServiceToDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "servicos");
    } finally {
      setDeletingService(false);
    }
  }

  const openServiceModal = (s?: Servico) => {
    if (s) {
      setEditingServico(s);
      setServiceName(s.nome);
      setServicePrice(s.preco.toString());
      setServiceDuration(s.duracaoMinutos.toString());
    } else {
      setEditingServico(null);
      setServiceName("");
      setServicePrice("");
      setServiceDuration("45");
    }
    setShowServiceModal(true);
  };

  if (loading) return <div className="h-screen grid place-items-center bg-[#070707] text-white font-mono uppercase tracking-widest text-xs">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-0.5 bg-white/20 relative overflow-hidden">
        <motion.div 
          animate={{ x: [-48, 48] }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="absolute inset-0 w-12 bg-white"
        />
      </div>
      <span>Sincronizando Sistema...</span>
    </div>
  </div>;

  const agendaUrl = `${window.location.origin}/agenda/${slug}`;

  return (
    <div className="min-h-screen bg-[#070707] flex flex-col md:flex-row font-sans text-white overflow-x-hidden">
      <aside className="w-full md:w-72 bg-[#0D0D0D] border-b md:border-b-0 md:border-r border-white/5 p-6 md:p-8 flex flex-col gap-6 md:gap-10 relative z-20 shadow-2xl">
        <div className="flex items-center justify-between md:justify-start gap-3 group cursor-pointer" onClick={() => navigate("/")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-lg tracking-tight block leading-none">Navalha<span className="text-indigo-500">Estilo</span></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Painel Unidade</span>
            </div>
          </div>
        </div>

        <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible gap-2 pb-2 md:pb-0 scrollbar-hide">
          {[
            { id: 'agenda', label: 'Agenda', icon: CalendarIcon },
            { id: 'servicos', label: 'Serviços', icon: Scissors },
            { id: 'equipe', label: 'Equipe', icon: Users },
            { id: 'caixa', label: 'Caixa', icon: TrendingUp },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'ajustes', label: 'Ajustes', icon: Settings }
          ].map((item) => (
             <button 
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all relative group whitespace-nowrap ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-4 h-4 md:w-5 md:h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:block mt-auto">
          <div className="p-6 rounded-3xl bg-indigo-600/10 border border-indigo-500/10 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Página de Clientes</p>
            <p className="text-xs font-medium text-slate-400 leading-relaxed">Compartilhe o link para receber agendamentos via WhatsApp.</p>
            <a href={agendaUrl} target="_blank" className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-[10px] font-bold hover:bg-white/10 transition-colors group truncate">
              /{slug} <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform shrink-0 ml-2" />
            </a>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative bg-[#070707] min-h-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto p-6 md:p-12 relative z-10">
          <header className="mb-8 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-10">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Operacional Online</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter text-white break-words">{barbearia?.nome}</h1>
              <p className="text-sm md:text-slate-400 font-medium max-w-lg">Painel de gerenciamento oficial.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
               {stats.map((stat, i) => (
                 <div key={i} className="p-4 md:p-6 bg-[#0D0D0D] border border-white/5 rounded-2xl md:rounded-3xl space-y-2">
                    <div className="flex items-center justify-between">
                      <stat.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${stat.color}`} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <div className="text-2xl md:text-3xl font-display font-bold text-white">{stat.value}</div>
                 </div>
               ))}
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'agenda' ? (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white">Próximos Atendimentos</h2>
            <p className="text-xs md:text-sm text-slate-500 mt-1">Lista atualizada de compromissos syncronizados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <select 
              value={selectedBarberFilter}
              onChange={(e) => setSelectedBarberFilter(e.target.value)}
              className="bg-[#0D0D0D] border border-white/10 rounded-2xl p-4 text-white text-[10px] font-bold uppercase tracking-widest outline-none focus:border-indigo-600 appearance-none min-w-[200px]"
            >
               <option value="all">Todos os Profissionais</option>
               {colaboradores.map(c => (
                 <option key={c.id} value={c.id}>{c.nome}</option>
               ))}
            </select>

            <button 
              onClick={() => setShowAddAppointmentModal(true)}
              className="w-full md:w-auto px-6 py-4 bg-indigo-600 text-white rounded-2xl md:rounded-[1.5rem] text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
               <CalendarIcon className="w-4 h-4" /> Novo Atendimento
            </button>
          </div>
        </div>

                  <div className="grid gap-4">
                    {agendamentos.filter(ag => selectedBarberFilter === "all" || ag.colaboradorId === selectedBarberFilter).length === 0 ? (
                      <div className="p-20 rounded-[3rem] border-2 border-dashed border-white/5 bg-[#0D0D0D]/50 flex flex-col items-center justify-center gap-6 group">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-indigo-600/10 group-hover:text-indigo-400 transition-all duration-500">
                          <CalendarIcon className="w-10 h-10" />
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-slate-400">Nenhum Agendamento</p>
                          <p className="text-sm text-slate-500 mt-1">Sua agenda está livre por enquanto.</p>
                        </div>
                      </div>
                    ) : (
                      agendamentos
                        .filter(ag => selectedBarberFilter === "all" || ag.colaboradorId === selectedBarberFilter)
                        .map((ag) => (
                        <div key={ag.id} className="group p-4 md:p-6 rounded-2xl md:rounded-3xl bg-[#0D0D0D] border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8 hover:border-indigo-500/30 transition-all">
                          <div className="flex gap-4 md:gap-8 items-center">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-indigo-600/10 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                               <span className="text-lg md:text-xl font-display font-black leading-none">{new Date(ag.dataHora).toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                               <span className="text-[10px] uppercase font-bold tracking-widest">{new Date(ag.dataHora).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                            </div>
                            <div className="min-w-0">
                               <div className="text-xl md:text-2xl font-display font-bold text-white mb-1 flex flex-wrap items-center gap-2 md:gap-3">
                                  <span className="truncate">{ag.clienteNome}</span>
                                  {(ag.status === 'pendente' || ag.status === 'aprovado') && (new Date().getTime() - new Date(ag.dataHora).getTime() > 10 * 60 * 1000) && (
                                    <span className="px-2 py-0.5 bg-red-500 text-[8px] font-black uppercase rounded-full animate-pulse shrink-0">Atrasado (+10 min)</span>
                                  )}
                                </div>
                               <div className="flex flex-wrap items-center gap-4 md:gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                  <div className="flex items-center gap-2">
                                     <Clock className="w-3.5 h-3.5 text-indigo-500" /> 
                                     {new Date(ag.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <Scissors className="w-3.5 h-3.5 text-indigo-500" />
                                     {servicos.find(s => s.id === ag.servicoId)?.nome || 'Serviço'}
                                  </div>
                                  <div className="flex items-center gap-2">
                                     <Users className="w-3.5 h-3.5 text-indigo-500" />
                                     {colaboradores.find(c => c.id === ag.colaboradorId)?.nome || 'Qualquer'}
                                  </div>
                               </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 md:gap-4">
                            <a 
                              href={`https://wa.me/55${ag.clienteWhatsApp.replace(/\D/g, '')}`} 
                              target="_blank"
                              className="px-4 md:px-6 py-2.5 md:py-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all flex items-center gap-2"
                            >
                              <Phone className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                            
                            <div className="flex items-center gap-2 flex-wrap">
                               {(ag.status === 'pendente' || ag.status === 'aprovado') ? (
                                 <>
                                   {ag.status === 'pendente' ? (
                                     <button 
                                       disabled={updatingStatus === ag.id}
                                       onClick={() => handleUpdateStatus(ag.id, 'aprovado')}
                                       className="px-4 py-2 bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase rounded-lg border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                                     >
                                       Aprovar
                                     </button>
                                   ) : (
                                     <button 
                                       disabled={updatingStatus === ag.id}
                                       onClick={() => handleUpdateStatus(ag.id, 'concluido')}
                                       className="px-4 py-2 bg-green-500/10 text-green-500 text-[10px] font-bold uppercase rounded-lg border border-green-500/20 hover:bg-green-500 hover:text-white transition-all disabled:opacity-50"
                                     >
                                       Concluir
                                     </button>
                                   )}
                                   <a 
                                     href={`https://wa.me/55${ag.clienteWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${ag.clienteNome}, gostaria de remarcar seu horário do dia ${new Date(ag.dataHora).toLocaleDateString('pt-BR')} às ${new Date(ag.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Que outro horário fica melhor para você?`)}`}
                                     target="_blank"
                                     className="px-4 py-2 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase rounded-lg border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all"
                                   >
                                     Remarcar
                                   </a>
                                   <button 
                                     disabled={updatingStatus === ag.id}
                                     onClick={() => handleUpdateStatus(ag.id, 'cancelado')}
                                     className="px-4 py-2 bg-red-500/10 text-red-500 text-[10px] font-bold uppercase rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                                   >
                                     Cancelar
                                   </button>
                                 </>
                               ) : (
                                 <div className="flex items-center gap-2">
                                   {ag.status === 'cancelado' ? (
                                     <button 
                                       disabled={updatingStatus === ag.id}
                                       onClick={() => handleUpdateStatus(ag.id, 'pendente')}
                                       className="px-4 py-2 bg-indigo-500/10 text-indigo-500 text-[10px] font-bold uppercase rounded-lg border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                                     >
                                       Reativar
                                     </button>
                                   ) : null}
                                   <div className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg border ${
                                     ag.status === 'concluido' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 
                                     ag.status === 'cancelado' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                     'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                   }`}>
                                     {ag.status}
                                   </div>
                                 </div>
                               )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : activeTab === 'equipe' ? (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-display font-bold text-white">Equipe & Cadeiras</h2>
                      <p className="text-sm text-slate-500 mt-1">Gerencie os profissionais da sua barbearia.</p>
                    </div>
                    <button 
                      onClick={() => { setEditingColab(null); setColabName(""); setColabSpecialty(""); setShowColabModal(true); }}
                      className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                       <Plus className="w-4 h-4" /> Novo Colaborador
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {colaboradores.map(c => (
                      <div key={c.id} className="p-8 rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-6 hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                            <Users className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-xl text-white">{c.nome}</h3>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                              {c.especialidade || 'Profissional'} • 
                              {c.comissaoTipo === 'porcentagem' ? ` ${c.comissaoValor}%` : ` R$ ${c.comissaoValor}`} comissão
                            </p>
                          </div>
                        </div>
                        
                        <div className="bg-white/2 rounded-2xl p-4 space-y-1">
                           <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Produção Hoje</p>
                           <p className="text-xl font-display font-bold text-indigo-400">
                             R$ {movimentacoes
                               .filter(m => m.colaboradorId === c.id && new Date(m.data).toLocaleDateString('en-CA') === todayStr)
                               .reduce((acc, m) => acc + m.valor, 0).toFixed(2)}
                           </p>
                           <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-2">Comissão Agendada</p>
                           <p className="text-sm font-display font-bold text-green-500">
                             R$ {movimentacoes
                               .filter(m => m.colaboradorId === c.id && new Date(m.data).toLocaleDateString('en-CA') === todayStr && m.tipo === 'entrada')
                               .reduce((acc, m) => {
                                 const com = c.comissaoTipo === 'porcentagem' 
                                   ? (m.valor * c.comissaoValor / 100) 
                                   : c.comissaoValor;
                                 return acc + com;
                               }, 0).toFixed(2)}
                           </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] ${
                            c.status === 'ativo' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {c.status}
                          </span>
                          <div className="flex gap-2">
                             <button onClick={() => { 
                               setEditingColab(c); 
                               setColabName(c.nome); 
                               setColabSpecialty(c.especialidade); 
                               setColabStatus(c.status); 
                               setColabComType(c.comissaoTipo || 'porcentagem');
                               setColabComValue((c.comissaoValor || 0).toString());
                               setShowColabModal(true); 
                             }} className="p-2 border border-white/5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"><Pencil className="w-4 h-4" /></button>
                             <button onClick={() => deleteColab(c.id)} className="p-2 border border-white/5 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/5"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showColabModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] grid place-items-center p-6">
                       <div className="bg-[#0D0D0D] border border-white/10 p-10 rounded-[3rem] max-w-md w-full space-y-8">
                          <h3 className="text-3xl font-display font-bold text-white">{editingColab ? 'Editar' : 'Novo'} Colaborador</h3>
                          <div className="space-y-6">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome</label>
                                <input type="text" value={colabName} onChange={e => setColabName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 transition-all" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Especialidade/Cadeira</label>
                                <input type="text" value={colabSpecialty} placeholder="Ex: Cadeira 01 / Corte Moderno" onChange={e => setColabSpecialty(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 transition-all" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Status</label>
                                <select value={colabStatus} onChange={e => setColabStatus(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 appearance-none">
                                   <option value="ativo" className="bg-black">Ativo</option>
                                   <option value="ausente" className="bg-black">Ausente</option>
                                   <option value="desligado" className="bg-black">Desligado</option>
                                </select>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Tipo Comissão</label>
                                  <select value={colabComType} onChange={e => setColabComType(e.target.value as 'porcentagem' | 'valor')} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 appearance-none">
                                     <option value="porcentagem" className="bg-black">Porcentagem (%)</option>
                                     <option value="valor" className="bg-black">Valor Fixo (R$)</option>
                                  </select>
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Valor Comissão</label>
                                  <input type="number" value={colabComValue} onChange={e => setColabComValue(e.target.value)} placeholder="0" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 transition-all" />
                               </div>
                             </div>

                             <div className="flex gap-4">
                                <button onClick={() => setShowColabModal(false)} className="flex-1 py-5 bg-white/5 rounded-2xl text-[10px] font-bold uppercase text-white">Cancelar</button>
                                <button onClick={handleSaveColab} className="flex-1 py-5 bg-indigo-600 rounded-2xl text-[10px] font-bold uppercase text-white shadow-lg shadow-indigo-600/20">{isSavingColab ? 'Salvando...' : 'Confirmar'}</button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'caixa' ? (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-display font-bold text-white">Fluxo de Caixa</h2>
                      <p className="text-sm text-slate-500 mt-1">Controle financeiro diário e histórico.</p>
                    </div>
                    <button 
                      onClick={() => setShowCashFlowModal(true)}
                      className="px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                       <Plus className="w-4 h-4" /> Nova Movimentação
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="p-8 rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Entradas (Hoje)</p>
                        <p className="text-3xl font-display font-black text-green-500">R$ {movimentacoes.filter(m => m.tipo === 'entrada' && new Date(m.data).toLocaleDateString('en-CA') === todayStr).reduce((acc, m) => acc + m.valor, 0).toFixed(2)}</p>
                     </div>
                     <div className="p-8 rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saídas (Hoje)</p>
                        <p className="text-3xl font-display font-black text-red-500">R$ {movimentacoes.filter(m => m.tipo === 'saida' && new Date(m.data).toLocaleDateString('en-CA') === todayStr).reduce((acc, m) => acc + m.valor, 0).toFixed(2)}</p>
                     </div>
                     <div className="p-8 rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Saldo Geral</p>
                        <p className="text-3xl font-display font-black text-indigo-400">R$ {movimentacoes.reduce((acc, m) => m.tipo === 'entrada' ? acc + m.valor : acc - m.valor, 0).toFixed(2)}</p>
                     </div>
                  </div>

                  <div className="bg-[#0D0D0D] border border-white/5 rounded-[3rem] overflow-hidden">
                     <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                           <tr>
                              <th className="p-6">Data</th>
                              <th className="p-6">Descrição</th>
                              <th className="p-6">Profissional</th>
                              <th className="p-6">Categoria</th>
                              <th className="p-6 text-right">Valor</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {movimentacoes
                             .filter(m => selectedBarberFilter === "all" || m.colaboradorId === selectedBarberFilter)
                             .map(m => (
                             <tr key={m.id} className="hover:bg-white/2 transition-colors">
                                <td className="p-6 text-xs text-slate-400">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                                <td className="p-6 font-bold text-white text-sm">{m.descricao}</td>
                                <td className="p-6 text-[10px] uppercase font-bold text-indigo-400">
                                   {colaboradores.find(c => c.id === m.colaboradorId)?.nome || '-'}
                                </td>
                                <td className="p-6 text-[10px] uppercase font-black text-slate-600">{m.categoria}</td>
                                <td className={`p-6 text-right font-display font-bold ${m.tipo === 'entrada' ? 'text-green-500' : 'text-red-500'}`}>
                                   {m.tipo === 'entrada' ? '+' : '-'} R$ {m.valor.toFixed(2)}
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  {showCashFlowModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[120] grid place-items-center p-6">
                       <div className="bg-[#0D0D0D] border border-white/10 p-10 rounded-[3rem] max-w-md w-full space-y-8">
                          <h3 className="text-3xl font-display font-bold text-white">Lançar Movimentação</h3>
                          <div className="space-y-6">
                             <div className="flex gap-4 p-2 bg-white/5 rounded-2xl border border-white/10">
                                <button onClick={() => setMType('entrada')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${mType === 'entrada' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-500'}`}>Entrada</button>
                                <button onClick={() => setMType('saida')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase transition-all ${mType === 'saida' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-slate-500'}`}>Saída</button>
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Descrição</label>
                                <input type="text" value={mDesc} onChange={e => setMDesc(e.target.value)} placeholder="Ex: Pagamento Cliente / Aluguel" className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 transition-all" />
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Valor (R$)</label>
                                   <input type="number" value={mValue} onChange={e => setMValue(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 transition-all" />
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Categoria</label>
                                   <select value={mCategory} onChange={e => setMCategory(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white outline-none focus:border-indigo-600 appearance-none">
                                      <option value="Serviço" className="bg-black">Serviço</option>
                                      <option value="Produto" className="bg-black">Produto</option>
                                      <option value="Aluguel" className="bg-black">Aluguel</option>
                                      <option value="Salários" className="bg-black">Salários</option>
                                      <option value="Outros" className="bg-black">Outros</option>
                                   </select>
                                </div>
                             </div>
                             <div className="flex gap-4 pt-4">
                                <button onClick={() => setShowCashFlowModal(false)} className="flex-1 py-5 bg-white/5 rounded-2xl text-[10px] font-bold uppercase text-white">Cancelar</button>
                                <button onClick={handleSaveMovimentacao} className="flex-1 py-5 bg-indigo-600 rounded-2xl text-[10px] font-bold uppercase text-white shadow-lg shadow-indigo-600/20">{isSavingM ? 'Lançando...' : 'Confirmar'}</button>
                             </div>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'servicos' ? (
                <div className="space-y-8 md:space-y-12">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                     <div>
                      <h2 className="text-2xl md:text-3xl font-display font-bold text-white">Catálogo de Serviços</h2>
                      <p className="text-xs md:text-sm text-slate-500 mt-1">Configure seus tipos de atendimento e valores.</p>
                    </div>
                     <button 
                      onClick={() => openServiceModal()}
                      className="w-full md:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                     >
                       <Plus className="w-4 h-4" /> Novo Serviço
                     </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {servicos.map((s) => (
                      <div key={s.id} className="group p-8 rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-6 hover:border-indigo-500/30 transition-all relative overflow-hidden">
                        <div className="flex justify-between items-start relative z-10">
                          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400">
                            <Scissors className="w-6 h-6" />
                          </div>
                          <div className="text-3xl font-display font-black text-white">R$ {s.preco.toFixed(2)}</div>
                        </div>
                        <div className="relative z-10">
                          <h3 className="font-display font-bold text-xl text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{s.nome}</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                             <Clock className="w-3.5 h-3.5" /> {s.duracaoMinutos} Minutos
                          </p>
                        </div>
                        <div className="pt-6 border-t border-white/5 flex gap-4 relative z-10">
                          <button 
                            onClick={() => openServiceModal(s)}
                            className="flex-1 py-3 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          >
                            <Pencil className="w-3 h-3" /> Editar
                          </button>
                          <button 
                            onClick={() => setServiceToDeleteId(s.id)}
                            className="flex-1 py-3 bg-red-500/5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {serviceToDeleteId && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[110] grid place-items-center p-6">
                       <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#0D0D0D] border border-white/10 p-12 rounded-[2.5rem] max-w-sm w-full shadow-2xl"
                      >
                        <h3 className="text-2xl font-display font-black text-white mb-4">Excluir Serviço?</h3>
                        <p className="text-sm text-slate-400 mb-8 font-medium">
                          Esta ação é permanente e o serviço desaparecerá da sua página pública.
                        </p>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setServiceToDeleteId(null)}
                            disabled={deletingService}
                            className="flex-1 py-4 bg-white/5 rounded-xl text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={handleDeleteService}
                            disabled={deletingService}
                            className="flex-1 py-4 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 disabled:bg-slate-700"
                          >
                            {deletingService ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {showServiceModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] grid place-items-center p-6">
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#0D0D0D] border border-white/10 p-12 rounded-[2.5rem] max-w-lg w-full shadow-2xl relative"
                      >
                        <h3 className="text-3xl font-display font-black text-white mb-10">
                          {editingServico ? 'Editar Serviço' : 'Novo Serviço'}
                        </h3>
                        <div className="space-y-8">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome do Serviço</label>
                            <input 
                              type="text" 
                              placeholder="Ex: Corte Degredê"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:bg-white/10 focus:border-indigo-600 transition-all font-sans"
                              value={serviceName}
                              onChange={(e) => setServiceName(e.target.value)}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Preço (R$)</label>
                              <input 
                                type="number" 
                                step="0.01"
                                placeholder="0,00"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:bg-white/10 transition-all font-sans"
                                value={servicePrice}
                                onChange={(e) => setServicePrice(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Duração</label>
                              <select 
                                className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:bg-white/10 cursor-pointer appearance-none"
                                value={serviceDuration}
                                onChange={(e) => setServiceDuration(e.target.value)}
                              >
                                 <option value="15" className="bg-[#0D0D0D]">15 Min</option>
                                 <option value="30" className="bg-[#0D0D0D]">30 Min</option>
                                 <option value="45" className="bg-[#0D0D0D]">45 Min</option>
                                 <option value="60" className="bg-[#0D0D0D]">60 Min</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-4 pt-6">
                            <button 
                              onClick={() => setShowServiceModal(false)}
                              disabled={savingService}
                              className="flex-1 py-5 bg-white/5 rounded-2xl text-white font-bold text-[10px] uppercase tracking-widest disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button 
                              onClick={handleSaveService}
                              disabled={!serviceName || !servicePrice || savingService}
                              className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 disabled:bg-slate-700 disabled:shadow-none"
                            >
                              {savingService ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'clientes' ? (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-3xl font-display font-bold text-white">Base de Clientes</h2>
                      <p className="text-sm text-slate-500 mt-1">Gerencie sua lista de contatos e fidelidade.</p>
                    </div>
                    <div className="relative w-full md:w-80">
                      <input 
                        type="text" 
                        placeholder="Buscar por nome ou whats..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pl-12 font-bold text-white outline-none focus:border-indigo-600 transition-all text-sm"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                      />
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {clientes.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-slate-500 rounded-[3rem] border-2 border-dashed border-white/5">
                        Nenhum cliente cadastrado ainda.
                      </div>
                    ) : (
                      clientes.map((c, i) => (
                        <div key={i} className="p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] bg-[#0D0D0D] border border-white/5 space-y-6 hover:border-indigo-500/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-display font-bold shrink-0">
                               {c.nome.charAt(0)}
                            </div>
                            <div className="min-w-0">
                               <h3 className="font-display font-bold text-lg text-white truncate">{c.nome}</h3>
                               <p className="text-xs text-slate-500 truncate">{c.whats}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                             <div>
                               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">Visitas</p>
                               <p className="text-xl font-display font-bold text-indigo-400 mt-1">{c.totalVisitas}</p>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none text-right">Última</p>
                               <p className="text-[10px] font-bold text-white mt-1">{new Date(c.ultimaVisita).toLocaleDateString()}</p>
                             </div>
                          </div>

                          <a 
                            href={`https://wa.me/55${c.whats.replace(/\D/g, '')}`} 
                            target="_blank"
                            className="w-full py-3 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 hover:text-white transition-colors"
                          >
                            <Phone className="w-3 h-3" /> WhatsApp
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-8 max-w-2xl">
                   <div>
                    <h2 className="text-3xl font-display font-bold text-white">Configurações da Unidade</h2>
                    <p className="text-sm text-slate-500 mt-1">Ajustes finos para sua barbearia.</p>
                  </div>
                  
                  <div className="bg-[#0D0D0D] border border-white/5 p-8 rounded-[2.5rem] space-y-8">
                     <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome da Unidade</label>
                        <input 
                          type="text" 
                          disabled
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-slate-400 outline-none cursor-not-allowed"
                          value={barbearia?.nome}
                        />
                        <p className="text-[10px] text-slate-600 italic px-4">Para alterar o nome da unidade, contate o administrador da plataforma.</p>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Endereço Personalizado</label>
                        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-slate-400">
                           <span className="opacity-40">navalhaestilo.com/agenda/</span>
                           <span className="text-white">{slug}</span>
                        </div>
                     </div>

                     <div className="pt-8 border-t border-white/5 space-y-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="font-display font-bold text-lg text-white">Suspender Agenda</h3>
                              <p className="text-xs text-slate-500">Bloqueia novos agendamentos temporariamente.</p>
                           </div>
                           <button 
                             onClick={handleToggleSuspension}
                             disabled={isSuspending}
                             className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                               barbearia?.suspensa 
                                 ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' 
                                 : 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                             }`}
                           >
                             {isSuspending ? 'Processando...' : (barbearia?.suspensa ? 'Reativar Agenda' : 'Suspender Agora')}
                           </button>
                        </div>

                        {(!barbearia?.suspensa || barbearia?.suspensa) && (
                          <div className="space-y-4">
                             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Motivo da Supensão (Aparecerá para o cliente)</label>
                             <textarea 
                               placeholder="Ex: Estamos em reforma, voltamos em breve!"
                               className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-red-600 transition-all min-h-[100px]"
                               value={suspensionReason}
                               onChange={(e) => setSuspensionReason(e.target.value)}
                             />
                          </div>
                        )}
                     </div>

                     <div className="pt-6 border-t border-white/5">
                        <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 cursor-not-allowed">
                          Salvar Alterações
                        </button>
                     </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          
          <AnimatePresence>
            {showAddAppointmentModal && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  className="w-full max-w-xl bg-[#0D0D0D] border border-white/10 rounded-[3rem] p-10 space-y-8 max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-display font-bold text-white">Novo Atendimento</h3>
                      <p className="text-sm text-slate-500 mt-1">Registre um cliente que chegou agora ou por telefone.</p>
                    </div>
                    <button onClick={() => setShowAddAppointmentModal(false)} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome do Cliente</label>
                        <input 
                          type="text" 
                          placeholder="Ex: João Silva"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-indigo-600 transition-all"
                          value={newApClientName}
                          onChange={(e) => setNewApClientName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">WhatsApp</label>
                        <input 
                          type="text" 
                          placeholder="Ex: 11999999999"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-indigo-600 transition-all"
                          value={newApClientWhats}
                          onChange={(e) => setNewApClientWhats(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Serviço</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-indigo-600 transition-all appearance-none"
                        value={newApServiceId}
                        onChange={(e) => setNewApServiceId(e.target.value)}
                      >
                        <option value="">Selecione um serviço</option>
                        {servicos.map(s => (
                          <option key={s.id} value={s.id} className="bg-[#0D0D0D]">{s.nome} - R$ {s.preco}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Profissional / Cadeira</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-indigo-600 transition-all appearance-none"
                        value={newApColaboradorId}
                        onChange={(e) => setNewApColaboradorId(e.target.value)}
                      >
                        <option value="">Qualquer Disponível</option>
                        {colaboradores.filter(c => c.status === 'ativo').map(c => (
                          <option key={c.id} value={c.id} className="bg-[#0D0D0D]">{c.nome} ({c.especialidade})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data do Atendimento</label>
                        {newApDate && (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                            <CalendarIcon className="w-3 h-3" /> Horários Disponíveis
                          </div>
                        )}
                      </div>
                      <input 
                        type="date" 
                        min={new Date().toLocaleDateString('en-CA')}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white outline-none focus:border-indigo-600 transition-all"
                        value={newApDate}
                        onChange={(e) => {
                          setNewApDate(e.target.value);
                          setNewApTime(""); // Reset time when date changes
                        }}
                      />
                    </div>

                    {newApDate && (
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Escolha um Horário Livre</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 bg-white/5 p-4 rounded-[2rem] border border-white/10">
                          {availableSlots.map(({ time, isAvailable }) => (
                            <button
                              key={time}
                              disabled={!isAvailable}
                              onClick={() => setNewApTime(time)}
                              className={`py-3 rounded-xl text-[10px] font-black transition-all ${
                                !isAvailable 
                                  ? 'bg-red-500/5 text-red-500/20 cursor-not-allowed opacity-30 strike-through' 
                                  : newApTime === time
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                        {newApTime && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-[10px] font-bold uppercase tracking-widest">
                            <Clock className="w-3 h-3" /> Selecionado: {newApTime}
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={handleAddWalkIn}
                      disabled={isCreatingAp || !newApClientName || !newApClientWhats || !newApServiceId || !newApDate || !newApTime}
                      className="w-full py-6 bg-indigo-600 text-white rounded-[2rem] font-display font-black text-lg shadow-2xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      {isCreatingAp ? 'Agendando...' : 'Confirmar Agendamento'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      {barbearia && (
        <BarberChat 
          barbeariaName={barbearia.nome} 
          agendaUrl={agendaUrl} 
          onOpenBooking={() => setShowAddAppointmentModal(true)}
        />
      )}
    </div>
  );
}
