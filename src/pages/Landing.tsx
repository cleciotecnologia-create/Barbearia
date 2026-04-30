import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/error-handler";
import { Scissors, Zap, Shield, Clock, ChevronRight, ExternalLink, User as UserIcon, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

interface BarbeariaListItem {
  id: string;
  nome: string;
  slug: string;
}

export default function LandingPage() {
  const [nomeBarbearia, setNomeBarbearia] = useState("");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState<{ slug: string, id: string } | null>(null);
  const [minhasBarbearias, setMinhasBarbearias] = useState<BarbeariaListItem[]>([]);
  const navigate = useNavigate();
  const { user, signIn, logout, isSuperAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    async function loadMinhasBarbearias() {
      if (user) {
        const q = query(collection(db, "barbearias"), where("ownerId", "==", user.uid));
        const snap = await getDocs(q);
        setMinhasBarbearias(snap.docs.map(d => ({ id: d.id, ...d.data() } as BarbeariaListItem)));
      } else {
        setMinhasBarbearias([]);
      }
    }
    loadMinhasBarbearias();
  }, [user]);

  const handleAcessarPainel = () => {
    if (sucesso) {
      navigate(`/admin/${sucesso.slug}`);
    }
  };

  async function criarBarbearia() {
    if (!nomeBarbearia) return;

    if (!user) {
      try {
        await signIn();
        return;
      } catch (err) {
        console.error(err);
        return;
      }
    }

    setLoading(true);
    setSucesso(null);

    const slug = nomeBarbearia
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    try {
      const barbeariaRef = await addDoc(collection(db, "barbearias"), {
        nome: nomeBarbearia,
        slug,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        status: "ativa"
      });

      const barbeariaId = barbeariaRef.id;

      if (barbeariaId) {
        const servicosPadrao = [
          { nome: "Corte Masculino", preco: 35.00, duracaoMinutos: 45, barbeariaId },
          { nome: "Corte & Barba", preco: 55.00, duracaoMinutos: 75, barbeariaId },
          { nome: "Sobrancelha", preco: 15.00, duracaoMinutos: 15, barbeariaId },
        ];

        for (const servico of servicosPadrao) {
          await addDoc(collection(db, "servicos"), servico);
        }

        setSucesso({ slug, id: barbeariaId });
      }

    } catch (error) {
      console.error(error);
      handleFirestoreError(error, OperationType.WRITE, "barbearias/servicos");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-600 selection:text-white overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-lg border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-2 font-display font-bold text-2xl tracking-tighter text-slate-900 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Scissors className="w-5 h-5" />
            </div>
            <span>Navalha<span className="text-indigo-600">Estilo</span></span>
          </div>
          
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex gap-8 text-sm font-semibold text-slate-500">
              <a href="#features" className="hover:text-indigo-600 transition-colors">Recursos</a>
            </nav>

            <div className="h-6 w-px bg-slate-200 hidden md:block" />
          
            {user ? (
              <div className="flex items-center gap-4">
                {isSuperAdmin && (
                  <button 
                    onClick={() => navigate('/super-admin')}
                    className="hidden lg:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    <Shield className="w-3 h-3" /> Painel SaaS
                  </button>
                )}
                <div className="hidden md:block text-right">
                  <p className="text-xs font-bold text-slate-900 leading-none">{user.displayName}</p>
                  <button onClick={logout} className="text-[10px] font-semibold text-slate-400 hover:text-rose-500 flex items-center gap-1 mt-1 transition-colors">
                    Sair <LogOut className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="relative">
                  <img src={user.photoURL || ""} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                </div>
              </div>
            ) : (
               <button 
                onClick={signIn}
                disabled={authLoading}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Entrar Agora
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-40 pb-32">
        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {sucesso ? (
               <div className="bg-white rounded-3xl p-10 shadow-2xl shadow-indigo-100 border border-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-600" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-slate-900">Configuração Concluída!</h2>
                    <p className="text-sm text-slate-500">Unidade: <span className="font-bold text-indigo-600">{nomeBarbearia}</span></p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "Página de Agendamento", desc: "Link para enviar aos seus clientes", path: `/agenda/${sucesso.slug}`, icon: ExternalLink },
                    { label: "Painel de Controle", desc: "Gerencie serviços e equipe", path: `/admin/${sucesso.slug}`, icon: Shield }
                  ].map((item, idx) => (
                    <a 
                      key={idx}
                      href={item.path}
                      target="_blank"
                      className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 group/item"
                    >
                      <div>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-sm text-slate-600 font-medium">/{item.path.split('/').pop()}</p>
                      </div>
                      <item.icon className="w-4 h-4 text-slate-400 group-hover/item:text-indigo-600 transition-colors" />
                    </a>
                  ))}
                </div>

                <button 
                  onClick={handleAcessarPainel}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold mt-8 hover:bg-indigo-600 transition-all flex items-center justify-center gap-2"
                >
                  Acessar Painel Agora <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="px-4 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest border border-indigo-100">
                      Gestão de Unidades v2.4
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <h1 className="text-7xl lg:text-8xl font-display font-black text-slate-900 leading-[0.9] tracking-tight">
                    Gestão <br />
                    <span className="text-indigo-600 italic">Simples</span> Para <br />
                    Barbeiros.
                  </h1>
                  <p className="text-lg text-slate-500 leading-relaxed max-w-xl">
                    A infraestrutura definitiva para barbeiros profissionais. Gerencie agendamentos, serviços e clientes com uma plataforma unificada e potente.
                  </p>
                </div>

                {user && minhasBarbearias.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suas Unidades Ativas</h3>
                    <div className="flex flex-wrap gap-3">
                      {minhasBarbearias.map(b => (
                        <button 
                          key={b.id} 
                          onClick={() => navigate(`/admin/${b.slug}`)}
                          className="pl-4 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-3 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-50 transition-all group"
                        >
                          {b.nome}
                          <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-2 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 max-w-lg flex flex-col md:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Nome da sua barbearia..."
                    className="flex-1 bg-transparent px-6 py-4 font-semibold text-slate-900 placeholder:text-slate-300 focus:outline-none"
                    value={nomeBarbearia}
                    onChange={(e) => setNomeBarbearia(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && criarBarbearia()}
                  />
                  <button
                    onClick={criarBarbearia}
                    disabled={loading || !nomeBarbearia || authLoading}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-[1.8rem] font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 disabled:bg-slate-200"
                  >
                    {loading ? "Processando..." : (
                      <>
                        {user ? 'Criar Unidade' : 'Entrar & Começar'} <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-10 gap-y-4 pt-4">
                  {[
                    { icon: Shield, label: "Login Seguro" },
                    { icon: Zap, label: "Setup Instantâneo" },
                    { icon: Clock, label: "24/7 Automação" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-slate-400">
                      <item.icon className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>

          <div className="relative hidden lg:block">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.2 }}
               className="relative z-10"
            >
              <div className="aspect-[4/5] rounded-[3rem] overflow-hidden shadow-2xl shadow-slate-200 border-8 border-white p-4 bg-slate-50">
                <img 
                  src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=2074&auto=format&fit=crop" 
                  alt="Painel Mobile" 
                  className="w-full h-full object-cover rounded-[2rem] shadow-inner"
                />
                <div className="absolute inset-x-8 bottom-12 space-y-4">
                   <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-xl">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Núcleo da Plataforma</span>
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                            <Zap className="w-6 h-6" />
                         </div>
                         <div>
                            <p className="text-2xl font-display font-black text-slate-900 leading-none">+12.8k</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Conexões Ativas</p>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </motion.div>
            
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-100 rounded-full blur-[80px] -z-10" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-200/50 rounded-full blur-[80px] -z-10" />
          </div>
        </div>

        <div className="mt-40 grid md:grid-cols-3 gap-8">
          {[
            { icon: Clock, title: "Tempo Real", desc: "Seus clientes agendam e sua agenda atualiza instantaneamente sem atrasos." },
            { icon: Shield, title: "Segurança Total", desc: "Dados protegidos com criptografia e infraestrutura cloud de ponta." },
            { icon: Zap, title: "Alta Performance", desc: "Site extremamente rápido para garantir a melhor experiência do seu cliente." }
          ].map((feature, i) => (
            <div key={i} className="p-10 rounded-[2.5rem] bg-white border border-slate-100 hover:border-indigo-600 transition-colors group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all mb-8">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 mb-4">{feature.title}</h3>
              <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-100 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 font-display font-bold text-lg text-slate-900">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
              <Scissors className="w-4 h-4" />
            </div>
            <span>Navalha<span className="text-indigo-600">Estilo</span></span>
          </div>
          
          <div className="flex gap-12 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
            <a href="/super-admin" className="hover:text-indigo-600 transition-colors">Super Admin</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Privacidade</a>
            <a href="#" className="hover:text-indigo-600 transition-colors">Termos</a>
          </div>

          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">© 2026 INFRAESTRUTURA NAVALHA&ESTILO</p>
        </div>
      </footer>
    </div>
  );
}
