import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, updateDoc, doc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../lib/auth-context";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, 
  BarChart3, 
  Store, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Search,
  ArrowUpRight,
  ChevronRight,
  Plus,
  X,
  Edit,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface GlobalBarbearia {
  id: string;
  nome: string;
  slug: string;
  status: string;
  ownerId: string;
  createdAt: any;
}

export default function SuperAdmin() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const [barbearias, setBarbearias] = useState<GlobalBarbearia[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) {
      navigate("/");
      return;
    }

    async function loadAll() {
      try {
        const q = query(collection(db, "barbearias"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setBarbearias(snap.docs.map(d => ({ id: d.id, ...d.data() } as GlobalBarbearia)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [isSuperAdmin, authLoading, navigate]);

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'ativa' ? 'inativa' : 'ativa';
    try {
      await updateDoc(doc(db, "barbearias", id), { status: newStatus });
      setBarbearias(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreate() {
    if (!newNome.trim() || creating) return;
    setCreating(true);
    const slug = newNome.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    try {
      const docRef = await addDoc(collection(db, "barbearias"), {
        nome: newNome,
        slug,
        status: 'ativa',
        ownerId: user?.uid, // Provisionado pelo admin logado
        createdAt: serverTimestamp()
      });

      const barbeariaId = docRef.id;

      // ✂️ Criar serviços padrão para a nova unidade
      const servicosPadrao = [
        { nome: "Corte Masculino", preco: 35.00, duracaoMinutos: 45, barbeariaId },
        { nome: "Corte & Barba", preco: 55.00, duracaoMinutos: 75, barbeariaId },
        { nome: "Sobrancelha", preco: 15.00, duracaoMinutos: 15, barbeariaId },
      ];

      for (const servico of servicosPadrao) {
        await addDoc(collection(db, "servicos"), servico);
      }

      const newUnit = {
        id: barbeariaId,
        nome: newNome,
        slug,
        status: 'ativa',
        ownerId: user?.uid || '',
        createdAt: { toDate: () => new Date() } // Local mock para UI imediata
      };

      setBarbearias(prev => [newUnit as GlobalBarbearia, ...prev]);
      setShowCreateModal(false);
      setNewNome("");
    } catch (err) {
      console.error("Erro ao provisionar unidade:", err);
      alert("Erro ao provisionar unidade. Verifique o console.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate() {
    if (!editingId || !editNome.trim() || updating) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, "barbearias", editingId), { nome: editNome });
      setBarbearias(prev => prev.map(b => b.id === editingId ? { ...b, nome: editNome } : b));
      setEditingId(null);
      setEditNome("");
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar unidade.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja DELETAR esta instância? Esta ação é irreversível e removerá apenas o registro da barbearia (serviços/agendamentos permanecerão órfãos).")) return;
    
    try {
      await deleteDoc(doc(db, "barbearias", id));
      setBarbearias(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erro ao deletar unidade.");
    }
  }

  const filtered = barbearias.filter(b => 
    b.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) return <div className="h-screen grid place-items-center bg-[#0A0A0A] text-white font-mono uppercase tracking-widest text-xs">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-0.5 bg-white/20 relative overflow-hidden">
        <motion.div 
          animate={{ x: [-48, 48] }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="absolute inset-0 w-12 bg-white"
        />
      </div>
      <span>Authenticating Platform Admin...</span>
    </div>
  </div>;

  return (
    <div className="min-h-screen bg-[#070707] text-white font-sans selection:bg-indigo-600 selection:text-white">
      {/* Platform Header */}
      <nav className="border-b border-white/5 px-8 h-24 flex justify-between items-center bg-[#0D0D0D]/80 backdrop-blur-xl sticky top-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl tracking-tighter leading-none text-white">Platform <span className="text-indigo-500">Center</span></h1>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1 block">Global Infrastructure Controller</span>
          </div>
        </div>
        
        <div className="flex items-center gap-10">
           <div className="hidden lg:flex gap-10">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Health</div>
                <div className="text-sm font-bold text-green-500 flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.4)]" /> Operational
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active nodes</div>
                <div className="text-sm font-bold text-white uppercase">{barbearias.length} Instances</div>
              </div>
           </div>
           <div className="h-10 w-px bg-white/5" />
           <button 
             onClick={() => setShowCreateModal(true)}
             className="px-6 py-2.5 bg-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
           >
             <Plus className="w-3.5 h-3.5" /> Provision New Unit
           </button>
           <button 
            onClick={() => navigate("/")} 
            className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all active:scale-95"
           >
             Exit Control
           </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-12 space-y-16 relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[150px] pointer-events-none" />

        {/* Stats Grid */}
        <section className="grid md:grid-cols-4 gap-6">
           {[
             { label: "Gross Revenue", value: "R$ 42.8k", icon: BarChart3, trend: "+12.4%" },
             { label: "New Instances", value: "+14", icon: Store, trend: "+5.1%" },
             { label: "Core Availability", value: "99.98%", icon: ShieldCheck, trend: "Optimal" },
             { label: "Global Users", value: "1,248", icon: AlertTriangle, trend: "+22.8%" },
           ].map((stat, i) => (
             <div key={i} className="bg-[#0D0D0D]/80 backdrop-blur-md border border-white/5 p-8 rounded-[2.5rem] space-y-6 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <stat.icon className="w-16 h-16" />
                </div>
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest bg-green-400/10 px-2.5 py-1 rounded-lg border border-green-400/20">{stat.trend}</span>
                </div>
                <div className="relative z-10">
                   <div className="text-3xl font-display font-bold text-white">{stat.value}</div>
                   <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mt-2">{stat.label}</div>
                </div>
             </div>
           ))}
        </section>

        {/* Management List */}
        <section className="space-y-10">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <h2 className="text-5xl font-display font-black text-white tracking-tighter">Instance Management</h2>
                <p className="text-sm text-slate-500 font-medium max-w-xl">Supervisor de instâncias provisionadas. Gerencie o ciclo de vida de cada nó da rede Navalha&Estilo.</p>
              </div>

              <div className="relative group max-w-sm w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Localizar instância..."
                  className="w-full bg-[#0D0D0D] border border-white/5 p-6 pl-14 rounded-[1.8rem] text-sm font-bold text-white placeholder:text-slate-700 outline-none focus:border-indigo-600 transition-all shadow-xl shadow-black/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
           </div>

           <div className="bg-[#0D0D0D]/80 backdrop-blur-md rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl relative z-10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5">
                      <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Unit Name & ID</th>
                      <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Network Address</th>
                      <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Provision Status</th>
                      <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Deployed At</th>
                      <th className="p-8 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Operational Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((b) => (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="p-8">
                          <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center font-display font-black text-xl text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg border border-white/5">
                              {b.nome.charAt(0)}
                            </div>
                            <div>
                                <span className="font-display font-bold text-lg text-white block leading-tight">{b.nome}</span>
                                <span className="text-[10px] font-mono font-medium text-slate-600 uppercase tracking-widest mt-1 block">ID: {b.id.substring(0, 12)}...</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-8">
                           <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
                              <span className="opacity-40">navalhaestilo.com/</span>
                              <span className="text-indigo-400 group-hover:underline cursor-pointer">{b.slug}</span>
                           </div>
                        </td>
                        <td className="p-8">
                           <div className={`inline-flex items-center gap-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                             b.status === 'ativa' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                           }`}>
                             <div className={`w-1.5 h-1.5 rounded-full ${b.status === 'ativa' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                             {b.status}
                           </div>
                        </td>
                        <td className="p-8">
                          <p className="text-xs text-slate-500 font-medium">{b.createdAt?.toDate().toLocaleDateString('pt-BR')}</p>
                          <p className="text-[10px] text-slate-700 font-bold uppercase mt-1">{b.createdAt?.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} UTC</p>
                        </td>
                        <td className="p-8">
                          <div className="flex items-center justify-end gap-3 translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                            <button 
                              onClick={() => {
                                setEditingId(b.id);
                                setEditNome(b.nome);
                              }}
                              className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-amber-600 transition-all"
                              title="Edit Details"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => toggleStatus(b.id, b.status)}
                              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                b.status === 'ativa' 
                                  ? 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white' 
                                  : 'bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white'
                              }`}
                            >
                              {b.status === 'ativa' ? 'Terminate' : 'Re-Deploy'}
                            </button>
                            <button 
                              onClick={() => handleDelete(b.id)}
                              className="w-10 h-10 bg-rose-600/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-600 transition-all"
                              title="Delete Path"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <a 
                              href={`/agenda/${b.slug}`} 
                              target="_blank"
                              className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-indigo-600 transition-all"
                            >
                              <ArrowUpRight className="w-5 h-5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 && (
                <div className="p-32 text-center space-y-6">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-slate-700 mx-auto">
                    <Search className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black text-slate-700 uppercase tracking-tighter">Null Result Set</h3>
                    <p className="text-sm font-medium text-slate-600 mt-2">Nenhuma instância corresponde ao filtro de busca atual.</p>
                  </div>
                </div>
              )}
           </div>
        </section>

        {/* Global Event Stream */}
        <section className="bg-[#0D0D0D]/80 backdrop-blur-md border border-white/5 p-10 rounded-[3rem] space-y-8 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 p-10 h-full bg-indigo-600/10" />
           <div className="flex justify-between items-end border-b border-white/5 pb-8 relative z-10">
              <div>
                <h3 className="text-2xl font-display font-black text-white italic">Global Activity Feed</h3>
                <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Real-time log stream from application cores</p>
              </div>
              <div className="px-4 py-2 bg-indigo-600/10 text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em] rounded-full border border-indigo-600/20 animate-pulse">
                Monitoring Live
              </div>
           </div>
           <div className="space-y-4 font-mono text-[11px] relative z-10">
             {[
               { code: "INIT", msg: "CORE_SYSTEM_READY (Boot time: 1.48s)" },
               { code: "AUTH", msg: "PLATFORM_ADMIN_SESSION_VERIFIED (id: " + user?.uid.substring(0,8) + "...)" },
               { code: "FETCH", msg: "SYNCING_RESOURCE_CLUSTER @Firestore/Barbearias" },
               { code: "PIPE", msg: "STREAMING_TELEMETRY_DATA_STABLE" },
               { code: "OK", msg: "SYSTEM_STATUS: NOMINAL (Memory: 124MB, CPU: 4%)" }
             ].map((log, i) => (
               <div key={i} className="flex gap-10 items-start group">
                 <span className="text-indigo-500 font-bold w-12 text-right">[{log.code}]</span>
                 <span className="text-slate-600 w-24">[{new Date().toLocaleTimeString()}]</span>
                 <span className="text-slate-400 group-hover:text-white transition-colors">{log.msg}</span>
               </div>
             ))}
           </div>
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 text-center mt-20 bg-[#0D0D0D]/50 relative overflow-hidden">
         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-indigo-600/5 rounded-full blur-[100px] -z-10" />
         <p className="text-[10px] font-bold uppercase tracking-[0.5em] text-slate-700">
           Navalha&Estilo Systems Distributed Infrastructure OS v4.0.2
         </p>
         <p className="text-[9px] font-medium text-slate-800 uppercase tracking-widest mt-4">
           Secure Handshake Verified • Encrypted Session • Node Cluster 0xFA4
         </p>
      </footer>

      {/* Provisioning Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#0D0D0D] border border-white/10 rounded-[3rem] p-10 relative z-10 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-display font-black text-white">Provision Unit</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Deploying new instance to edge</p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome da Barbearia / Salão</label>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Ex: Navalha & Ouro"
                    className="w-full bg-white/5 border border-white/10 p-6 rounded-[1.8rem] text-sm font-bold text-white placeholder:text-slate-700 outline-none focus:border-indigo-600 transition-all"
                    value={newNome}
                    onChange={(e) => setNewNome(e.target.value)}
                  />
                  <div className="flex items-center gap-2 text-[10px] font-mono text-indigo-500 px-4">
                    <span className="opacity-40">AUTO_GENERATED_SLUG:</span>
                    <span>/{newNome.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || "null"}</span>
                  </div>
                </div>

                <button 
                  disabled={!newNome.trim() || creating}
                  onClick={handleCreate}
                  className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? "Deploying..." : "Finalize Provisioning"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-[#0D0D0D] border border-white/10 rounded-[3rem] p-10 relative z-10 shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-display font-black text-white">Update Instance</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Refining deployed metadata</p>
                </div>
                <button 
                  onClick={() => setEditingId(null)}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-4">Nome da Barbearia / Salão</label>
                  <input 
                    type="text" 
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 p-6 rounded-[1.8rem] text-sm font-bold text-white outline-none focus:border-indigo-600 transition-all"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                  />
                </div>

                <button 
                  disabled={!editNome.trim() || updating}
                  onClick={handleUpdate}
                  className="w-full bg-amber-600 text-white py-6 rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? "Updating..." : "Commit Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
