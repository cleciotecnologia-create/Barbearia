import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { handleFirestoreError, OperationType } from "../lib/error-handler";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  ChevronLeft, 
  MapPin, 
  Scissors,
  ArrowRight
} from "lucide-react";

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
  suspensa?: boolean;
  motivoSuspensao?: string;
}

interface Servico {
  id: string;
  nome: string;
  preco: number;
  duracaoMinutos: number;
}

export default function BookingPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Serviço, 2: Data/Hora, 3: Identificação, 4: Sucesso

  const [selectedServico, setSelectedServico] = useState<Servico | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsApp, setClienteWhatsApp] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!slug) return;
      try {
        const bQuery = query(collection(db, "barbearias"), where("slug", "==", slug));
        const bSnap = await getDocs(bQuery);
        
        if (bSnap.empty) {
          navigate("/");
          return;
        }

        const bDoc = bSnap.docs[0];
        const bData = bDoc.data() as Barbearia;
        bData.id = bDoc.id;
        setBarbearia(bData);

        const sQuery = query(collection(db, "servicos"), where("barbeariaId", "==", bDoc.id));
        const sSnap = await getDocs(sQuery);
        
        const sList = sSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Servico[];
        
        setServicos(sList);
      } catch (err) {
        console.error(err);
        handleFirestoreError(err, OperationType.GET, "barbearia-fetch");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [slug, navigate]);

  const handleBooking = async () => {
    if (!barbearia || !selectedServico || !selectedDate || !selectedTime || !clienteNome || !clienteWhatsApp) return;

    setCreating(true);
    try {
      const dataHora = new Date(`${selectedDate}T${selectedTime}`);
      
      await addDoc(collection(db, "agendamentos"), {
        barbeariaId: barbearia.id,
        servicoId: selectedServico.id,
        clienteNome,
        clienteWhatsApp,
        dataHora: dataHora.toISOString(),
        status: "pendente",
        createdAt: serverTimestamp()
      });

      setStep(4);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, "agendamentos");
    } finally {
      setCreating(false);
    }
  };

  const getWhatsAppLink = () => {
    if (!barbearia || !selectedServico) return "";
    const message = `Olá, gostaria de confirmar meu agendamento:
Barbearia: ${barbearia.nome}
Serviço: ${selectedServico.nome}
Data: ${new Date(selectedDate).toLocaleDateString('pt-BR')}
Hora: ${selectedTime}
Nome: ${clienteNome}`;
    
    return `https://wa.me/55${clienteWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#FDFDFD]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-[#141414] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (barbearia?.suspensa) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white border border-slate-100 p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100 space-y-8"
        >
          <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto">
             <CalendarIcon className="w-10 h-10" />
             <div className="absolute w-3 h-3 bg-red-600 rounded-full animate-ping" />
          </div>
          
          <div className="space-y-4">
            <h2 className="text-4xl font-display font-black text-slate-900 tracking-tight leading-none">
              Agenda <span className="text-red-600 italic">Suspensa</span>
            </h2>
            <p className="text-slate-500 font-medium leading-relaxed">
              Desculpe, no momento não estamos aceitando novos agendamentos online.
            </p>
          </div>

          {barbearia.motivoSuspensao && (
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Recado do Estabelecimento</p>
               <p className="text-slate-700 font-semibold">{barbearia.motivoSuspensao}</p>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100">
             <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Tente novamente mais tarde</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans selection:bg-indigo-600 selection:text-white flex flex-col">
      <header className="bg-white/70 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 font-display font-bold">
              {barbearia?.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-slate-900 leading-none">{barbearia?.nome}</h1>
              <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
                <MapPin className="w-3 h-3 text-indigo-500" />
                Agendamento Instantâneo
              </div>
            </div>
          </div>
          {step > 1 && step < 4 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 bg-slate-50 text-slate-400 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center gap-1.5"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto p-6 pt-12 pb-24">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="space-y-4">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
                  Passo 01 de 03
                </span>
                <h2 className="text-4xl lg:text-5xl font-display font-black text-slate-900 tracking-tight leading-none">
                  O que vamos <span className="text-indigo-600 italic">fazer</span> hoje?
                </h2>
                <p className="text-slate-500 font-medium">Selecione o serviço desejado para ver os horários disponíveis.</p>
              </div>

              <div className="grid gap-4">
                {servicos.length === 0 ? (
                  <p className="text-center text-slate-400 py-10">Nenhum serviço disponível no momento.</p>
                ) : (
                  servicos.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedServico(s);
                        setStep(2);
                      }}
                      className="group p-6 rounded-3xl bg-white border border-slate-100 shadow-sm hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-100/50 transition-all text-left flex justify-between items-center active:scale-[0.98]"
                    >
                      <div className="space-y-2">
                         <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Scissors className="w-5 h-5" />
                         </div>
                        <div className="font-display font-bold text-xl text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{s.nome}</div>
                        <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-indigo-500" /> {s.duracaoMinutos} min</span>
                        </div>
                      </div>
                      <div className="text-3xl font-display font-black text-slate-900">
                        <span className="text-xs font-bold text-slate-400 mr-1 italic">R$</span>
                        {s.preco.toFixed(2)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
                    Passo 02 de 03
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <h2 className="text-4xl lg:text-5xl font-display font-black text-slate-900 tracking-tight leading-none text-center">
                  Escolha seu <br /><span className="text-indigo-600 italic">melhor</span> momento.
                </h2>
                
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center justify-center gap-4 group">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">Serviço Selecionado</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">{selectedServico?.nome}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-4">Selecione o Dia</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600" />
                    <input
                      type="date"
                      className="w-full bg-white border border-slate-200 rounded-[1.8rem] p-6 pl-16 text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:border-indigo-600 focus:shadow-xl focus:shadow-indigo-100 transition-all appearance-none outline-none"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-4">Horários Disponíveis</label>
                  <div className="grid grid-cols-4 gap-3">
                    {["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={`py-4 rounded-2xl text-sm font-bold transition-all border ${
                          selectedTime === t 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-600/30 active:scale-95" 
                            : "bg-white text-slate-500 border-slate-100 hover:border-indigo-600 hover:text-indigo-600"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setStep(3)}
                    className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-bold text-lg hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 flex items-center justify-center gap-3 group active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
                  >
                    Confirmar Horário <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100">
                    Último Passo
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                <h2 className="text-4xl lg:text-5xl font-display font-black text-slate-900 tracking-tight leading-none text-center">
                  Identifique-se <br /><span className="text-indigo-600 italic">rápido</span> e fácil.
                </h2>
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4 text-center">
                   <div className="inline-flex gap-4 items-center border-b border-slate-200 pb-4 mx-auto">
                      <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                        <CalendarIcon className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo do Horário</p>
                        <p className="text-sm font-bold text-slate-900">{new Date(selectedDate).toLocaleDateString('pt-BR')} às {selectedTime}</p>
                      </div>
                   </div>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-4">Seu Nome</label>
                    <div className="relative">
                      <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600" />
                      <input
                        type="text"
                        className="w-full bg-white border border-slate-200 rounded-[1.8rem] p-6 pl-16 text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:border-indigo-600 transition-all outline-none"
                        placeholder="Como devemos te chamar?"
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-4">WhatsApp (com DDD)</label>
                    <div className="relative">
                      <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-600" />
                      <input
                        type="tel"
                        className="w-full bg-white border border-slate-200 rounded-[1.8rem] p-6 pl-16 text-lg font-bold text-slate-900 placeholder:text-slate-300 focus:border-indigo-600 transition-all outline-none"
                        placeholder="(00) 00000-0000"
                        value={clienteWhatsApp}
                        onChange={(e) => setClienteWhatsApp(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    disabled={!clienteNome || !clienteWhatsApp || creating}
                    onClick={handleBooking}
                    className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-bold text-xl hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-4 group active:scale-95 disabled:bg-slate-200 disabled:shadow-none"
                  >
                    {creating ? (
                      <span className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Reservando...
                      </span>
                    ) : (
                      <>Finalizar e Reservar <CheckCircle2 className="w-6 h-6" /></>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-12 py-16"
            >
              <div className="relative inline-block group">
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="w-32 h-32 bg-green-600 rounded-[3rem] shadow-2xl shadow-green-200 flex items-center justify-center text-white relative z-10 mx-auto">
                  <CheckCircle2 className="w-16 h-16" />
                </div>
                <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-widest z-20">
                  Aguardando Aprovação
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-5xl lg:text-6xl font-display font-black text-slate-900 tracking-tight leading-none">
                  Reserva <br /><span className="text-indigo-600 italic">Enviada!</span>
                </h2>
                <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
                  Sua solicitação na {barbearia?.nome} foi enviada. Agora o salão irá analisar e confirmar seu horário.
                </p>
              </div>

              <div className="grid gap-4">
                <a
                  href={getWhatsAppLink()}
                  target="_blank"
                  className="w-full bg-[#25D366] text-white py-6 rounded-[2rem] font-bold text-lg hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-xl shadow-green-100 active:scale-95"
                >
                  <Phone className="w-6 h-6" /> Avisar no WhatsApp
                </a>
                <button
                  onClick={() => navigate("/")}
                  className="py-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                >
                  Voltar ao Início
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center bg-slate-50/50">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
          Plataforma Navalha&Estilo © 2026
        </p>
      </footer>
    </div>
  );
}
