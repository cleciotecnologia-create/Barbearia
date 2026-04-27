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
import { motion } from "motion/react";
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
  Clock
} from "lucide-react";

import { useAuth } from "../lib/auth-context";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  ownerId: string;
}

interface Agendamento {
  id: string;
  clienteNome: string;
  clienteWhatsApp: string;
  dataHora: string;
  servicoId: string;
  status: string;
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
  const { user, isAdmin: isSuperAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [activeTab, setActiveTab] = useState('agenda');

  // State for services
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("45");
  const [serviceToDeleteId, setServiceToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug || !user) return;
      try {
        // 1. Find Barbearia
        const bQuery = query(collection(db, "barbearias"), where("slug", "==", slug));
        const bSnap = await getDocs(bQuery);
        
        if (bSnap.empty) {
          navigate("/");
          return;
        }

        const bDoc = bSnap.docs[0];
        const bData = { id: bDoc.id, ...bDoc.data() } as Barbearia;
        
        // Security check: must be owner or super admin
        if (bData.ownerId !== user.uid && !isSuperAdmin) {
          navigate("/");
          return;
        }

        setBarbearia(bData);

        // 2. Load Appointments
        const agQuery = query(
          collection(db, "agendamentos"), 
          where("barbeariaId", "==", bDoc.id),
          orderBy("dataHora", "asc")
        );
        const agSnap = await getDocs(agQuery).catch(err => {
            // Note: This might fail if index is not ready yet, fallback to non-ordered
            console.warn("Falling back to unordered appointments", err);
            return getDocs(query(collection(db, "agendamentos"), where("barbeariaId", "==", bDoc.id)));
        });
        
        setAgendamentos(agSnap.docs.map(d => ({ id: d.id, ...d.data() } as Agendamento)));

        // 3. Load Services
        const sQuery = query(collection(db, "servicos"), where("barbeariaId", "==", bDoc.id));
        const sSnap = await getDocs(sQuery);
        setServicos(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Servico)));

      } catch (err) {
        console.error(err);
        handleFirestoreError(err, OperationType.LIST, "dashboard-fetch");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, navigate]);

  async function handleSaveService() {
    if (!barbearia || !serviceName || !servicePrice) return;

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

      // Refresh
      const sQuery = query(collection(db, "servicos"), where("barbeariaId", "==", barbearia.id));
      const sSnap = await getDocs(sQuery);
      setServicos(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Servico)));
      
      setShowServiceModal(false);
    } catch (err) {
      handleFirestoreError(err, editingServico ? OperationType.UPDATE : OperationType.CREATE, "servicos");
    }
  }

  async function handleDeleteService() {
    if (!serviceToDeleteId || !barbearia) return;

    try {
      await deleteDoc(doc(db, "servicos", serviceToDeleteId));
      setServicos(prev => prev.filter(s => s.id !== serviceToDeleteId));
      setServiceToDeleteId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "servicos");
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

  if (loading) return <div className="h-screen grid place-items-center bg-[#FDFDFD]">
    <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
  </div>;

  const agendaUrl = `${window.location.origin}/agenda/${slug}`;

  return (
    <div className="min-h-screen bg-[#070707] flex flex-col md:flex-row font-sans text-white overflow-hidden">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-[#0D0D0D] border-b md:border-b-0 md:border-r border-white/5 p-8 flex flex-col gap-10 relative z-20 shadow-2xl">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display font-bold text-lg tracking-tight block leading-none">Navalha<span className="text-indigo-500">Estilo</span></span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">Platform Admin</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          {[
            { id: 'agenda', label: 'Agenda', icon: CalendarIcon },
            { id: 'servicos', label: 'Serviços', icon: Scissors },
            { id: 'clientes', label: 'Clientes', icon: Users, disabled: true },
            { id: 'ajustes', label: 'Ajustes', icon: Settings, disabled: true }
          ].map((item) => (
             <button 
              key={item.id}
              onClick={() => !item.disabled && setActiveTab(item.id)}
              disabled={item.disabled}
              className={`flex items-center gap-4 p-4 rounded-2xl text-sm font-bold transition-all relative group ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : item.disabled 
                    ? 'opacity-20 cursor-not-allowed' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400'} transition-colors`} />
              {item.label}
              {activeTab === item.id && (
                <motion.div layoutId="tab-indicator" className="absolute left-0 w-1 h-6 bg-white rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-transparent border border-indigo-500/10 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-400">Public Page</p>
            <p className="text-sm font-medium text-slate-400 leading-relaxed">Compartilhe o link com seus clientes para receber agendamentos.</p>
            <a href={agendaUrl} target="_blank" className="flex items-center justify-between p-3 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-colors group">
              /agenda/{slug} <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gradient-to-br from-[#0D0D0D] to-[#070707]">
        {/* Background Gradients */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-6xl mx-auto p-8 md:p-12 relative z-10">
          <header className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Systems Online</span>
              </div>
              <h1 className="text-6xl font-display font-black tracking-tighter text-white">{barbearia?.nome}</h1>
              <p className="text-slate-400 font-medium max-w-lg">Bem-vindo ao centro de comando da sua barbearia. Gerencie seus horários e serviços com precisão.</p>
            </div>

            <div className="flex gap-4">
               {[
                 { label: "Today", value: agendamentos.length, icon: CalendarIcon },
                 { label: "Growth", value: "+24%", icon: TrendingUp, color: "text-green-400" }
               ].map((stat, i) => (
                 <div key={i} className="min-w-[160px] p-6 rounded-3xl bg-[#0D0D0D]/80 backdrop-blur-md border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <stat.icon className={`w-4 h-4 ${stat.color || 'text-slate-500'}`} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <div className="text-3xl font-display font-bold text-white">{stat.value}</div>
                 </div>
               ))}
            </div>
          </header>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {activeTab === 'agenda' ? (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-white">Próximos Agendamentos</h2>
                    <p className="text-sm text-slate-500 mt-1">Lista cronológica dos atendimentos marcados.</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-full border border-white/5">
                    <Clock className="w-3.5 h-3.5" /> Live Sync
                  </div>
                </div>

                <div className="grid gap-4">
                  {agendamentos.length === 0 ? (
                    <div className="p-20 rounded-[3rem] border-2 border-dashed border-white/5 bg-[#0D0D0D]/50 flex flex-col items-center justify-center gap-6 group">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-600 group-hover:scale-110 group-hover:bg-indigo-600/10 group-hover:text-indigo-400 transition-all duration-500">
                        <CalendarIcon className="w-10 h-10" />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-slate-400">Silêncio na Barbearia</p>
                        <p className="text-sm text-slate-500 mt-1">Ninguém agendou nada para os próximos dias ainda.</p>
                      </div>
                    </div>
                  ) : (
                    agendamentos.map((ag) => (
                      <div key={ag.id} className="group p-6 rounded-[2.5rem] bg-[#0D0D0D]/80 backdrop-blur-md border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-8 hover:border-indigo-500/30 transition-all hover:translate-x-1">
                        <div className="flex gap-8 items-center">
                          <div className="w-20 h-20 bg-indigo-600/10 rounded-[1.8rem] flex flex-col items-center justify-center border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                            <span className="text-2xl font-display font-black leading-none">{new Date(ag.dataHora).toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                            <span className="text-[10px] uppercase font-bold tracking-widest">{new Date(ag.dataHora).toLocaleDateString('pt-BR', { month: 'short' })}</span>
                          </div>
                          <div>
                            <div className="text-2xl font-display font-bold text-white group-hover:text-indigo-400 transition-colors">{ag.clienteNome}</div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-2 text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">
                               <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-indigo-500" /> 
                                  {new Date(ag.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                               </div>
                               <div className="flex items-center gap-2">
                                  <Scissors className="w-4 h-4 text-indigo-500" />
                                  {servicos.find(s => s.id === ag.servicoId)?.nome || 'Serviço'}
                               </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <a 
                            href={`https://wa.me/55${ag.clienteWhatsApp.replace(/\D/g, '')}`} 
                            target="_blank"
                            className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-xs font-bold uppercase tracking-widest hover:bg-green-600 hover:text-white transition-all group/btn"
                          >
                            <Phone className="w-4 h-4 text-green-500 group-hover/btn:text-white transition-colors" /> WhatsApp
                          </a>
                          <div className="px-5 py-2.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-indigo-500/20">
                            {ag.status}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                <div className="flex items-center justify-between">
                   <div>
                    <h2 className="text-3xl font-display font-bold text-white">Catálogo de Serviços</h2>
                    <p className="text-sm text-slate-500 mt-1">Configure os tipos de atendimento e seus valores.</p>
                  </div>
                   <button 
                    onClick={() => openServiceModal()}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                   >
                     <Plus className="w-5 h-5" /> Novo Atendimento
                   </button>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {servicos.map((s) => (
                    <div key={s.id} className="group p-8 rounded-[2.5rem] bg-[#0D0D0D]/80 backdrop-blur-md border border-white/5 space-y-6 hover:border-indigo-500/30 transition-all relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                         <Scissors className="w-20 h-20" />
                      </div>
                      <div className="flex justify-between items-start relative z-10">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400">
                          <Scissors className="w-6 h-6" />
                        </div>
                        <div className="text-3xl font-display font-black text-white">R$ {s.preco.toFixed(2)}</div>
                      </div>
                      <div className="relative z-10">
                        <h3 className="font-display font-bold text-xl text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{s.nome}</h3>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                           <Clock className="w-3.5 h-3.5" /> {s.duracaoMinutos} Minutos Estimados
                        </p>
                      </div>
                      <div className="pt-6 border-t border-white/5 flex gap-6 relative z-10">
                        <button 
                          onClick={() => openServiceModal(s)}
                          className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >
                          Editar Dados
                        </button>
                        <button 
                          onClick={() => setServiceToDeleteId(s.id)}
                          className="text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delete Confirmation Modal */}
                {serviceToDeleteId && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[110] grid place-items-center p-6 bg-gradient-to-t from-indigo-900/20 to-transparent">
                     <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className="bg-[#0D0D0D] border border-white/10 p-12 rounded-[3.5rem] max-w-sm w-full shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600" />
                      <h3 className="text-3xl font-display font-black text-white mb-4">Confirmar Exclusão</h3>
                      <p className="text-sm text-slate-400 mb-10 leading-relaxed font-medium">
                        Tem certeza que deseja remover este serviço? Esta ação removerá o catálogo da sua página pública permanentemente.
                      </p>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setServiceToDeleteId(null)}
                          className="flex-1 py-4 bg-white/5 rounded-2xl text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors border border-white/5"
                        >
                          Manter
                        </button>
                        <button 
                          onClick={handleDeleteService}
                          className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-red-500 transition-all shadow-xl shadow-red-600/20 active:scale-95"
                        >
                          Excluir
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}

                {/* Service Modal Overlay */}
                {showServiceModal && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] grid place-items-center p-6 bg-gradient-to-t from-indigo-900/20 to-transparent">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      className="bg-[#0D0D0D] border border-white/10 p-12 rounded-[3.5rem] max-w-lg w-full shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
                      <h3 className="text-4xl font-display font-black text-white mb-10">
                        {editingServico ? 'Ajustar Serviço' : 'Novo Serviço'}
                      </h3>
                      <div className="space-y-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome Oficial do Serviço</label>
                          <input 
                            type="text" 
                            placeholder="Ex: Corte Degradê Premium"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white placeholder:text-slate-700 focus:bg-white/10 focus:border-indigo-600 outline-none transition-all"
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
                              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white focus:bg-white/10 focus:border-indigo-600 outline-none transition-all"
                              value={servicePrice}
                              onChange={(e) => setServicePrice(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 relative">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Time Entry</label>
                            <select 
                              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 font-bold text-white focus:bg-white/10 focus:border-indigo-600 outline-none transition-all appearance-none cursor-pointer"
                              value={serviceDuration}
                              onChange={(e) => setServiceDuration(e.target.value)}
                            >
                               <option value="15" className="bg-[#0D0D0D]">15 Min</option>
                               <option value="30" className="bg-[#0D0D0D]">30 Min</option>
                               <option value="45" className="bg-[#0D0D0D]">45 Min</option>
                               <option value="60" className="bg-[#0D0D0D]">60 Min</option>
                               <option value="90" className="bg-[#0D0D0D]">90 Min</option>
                            </select>
                            <div className="absolute right-5 bottom-6 pointer-events-none text-slate-500">
                               <Plus className="w-4 h-4 rotate-45" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-4 pt-6">
                          <button 
                            onClick={() => setShowServiceModal(false)}
                            className="flex-1 py-5 bg-white/5 border border-white/5 rounded-2xl text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-colors"
                          >
                            Voltar
                          </button>
                          <button 
                            onClick={handleSaveService}
                            className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
                          >
                            Salvar Alterações
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
