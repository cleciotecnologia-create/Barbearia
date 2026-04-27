import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Send, Scissors, Calendar, MapPin, Sparkles } from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useLocation, useNavigate } from "react-router-dom";

interface Message {
  role: "user" | "bot";
  text: string;
}

interface Barbearia {
  id: string;
  nome: string;
  slug: string;
}

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: "Olá! Como posso te ajudar hoje?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [barbearias, setBarbearias] = useState<Barbearia[]>([]);

  useEffect(() => {
    async function fetchBarbearias() {
      try {
        const snap = await getDocs(collection(db, "barbearias"));
        const list = snap.docs.map(doc => ({
          id: doc.id,
          nome: doc.data().nome,
          slug: doc.data().slug
        }));
        setBarbearias(list);
      } catch (err) {
        console.error("Erro ao carregar barbearias para o chat:", err);
      }
    }
    fetchBarbearias();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const newMessages = [...messages, { role: "user", text: messageText } as Message];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `Você é o assistente virtual da plataforma "Navalha & Estilo".
A plataforma permite agendar horários em diversas barbearias.
Barbearias cadastradas: ${JSON.stringify(barbearias.map(b => ({ nome: b.nome, link: `/agenda/${b.slug}` })))}
Se o usuário quiser agendar, ofereça as barbearias disponíveis e forneça o link exato no formato [Nome da Barbearia](link).
Seja amigável e profissional. Responda em Português do Brasil.
A URL base é https://ais-dev-3eychcd2kxneaerha6vuyl-354611303368.us-west2.run.app (apenas para referência, use caminhos relativos como /agenda/slug).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: newMessages.map(m => ({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text }] })),
        config: { systemInstruction }
      });

      const botText = response.text || "Desculpe, tive um problema ao processar sua pergunta.";
      setMessages([...newMessages, { role: "bot", text: botText }]);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: "bot", text: "Ops! Tive um erro técnico. Pode tentar novamente?" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50 group"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              className="relative"
            >
              <MessageSquare className="w-6 h-6" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-indigo-600 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Janela de Chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-[400px] max-w-[90vw] h-[600px] max-h-[80vh] bg-[#FDFDFD] rounded-[2.5rem] shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-100"
          >
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
                 <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-display font-bold text-slate-900 leading-none">Assistente Virtual</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Online Agora</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
            >
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.role === "bot" ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === "bot" ? "justify-start" : "justify-end"}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                    msg.role === "bot" 
                      ? "bg-slate-100 text-slate-700 rounded-tl-none font-medium" 
                      : "bg-indigo-600 text-white rounded-tr-none font-bold shadow-lg shadow-indigo-100"
                  }`}>
                    {msg.text.split("\n").map((line, idx) => (
                      <p key={idx} className={idx > 0 ? "mt-2" : ""}>
                        {line.split(/\[(.*?)\]\((.*?)\)/g).map((part, pIdx) => {
                          if (pIdx % 3 === 1) {
                            const link = line.split(/\[(.*?)\]\((.*?)\)/g)[pIdx + 1];
                            return (
                              <button 
                                key={pIdx}
                                onClick={() => navigate(link)}
                                className="text-indigo-600 underline font-bold"
                              >
                                {part}
                              </button>
                            );
                          }
                          if (pIdx % 3 === 2) return null;
                          return part;
                        })}
                      </p>
                    ))}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-50 p-4 rounded-3xl rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions */}
            <div className="p-4 bg-slate-50/50 border-t border-slate-100">
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button 
                    onClick={() => handleSend("Quero agendar um horário")}
                    className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    <Calendar className="w-3 h-3" /> Agendar Horário
                  </button>
                  <button 
                    onClick={() => handleSend("Quais barbearias estão disponíveis?")}
                    className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    <MapPin className="w-3 h-3" /> Ver Unidades
                  </button>
                  <button 
                    onClick={() => handleSend("Como funciona a plataforma?")}
                    className="whitespace-nowrap px-4 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all flex items-center gap-2"
                  >
                    <Scissors className="w-3 h-3" /> Sobre Nós
                  </button>
               </div>
            </div>

            {/* Input */}
            <div className="p-6 bg-white border-t border-slate-100 flex gap-4">
              <input
                type="text"
                placeholder="Escreva sua dúvida..."
                className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 transition-all font-medium"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-600 transition-all disabled:opacity-30 disabled:hover:bg-slate-900"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
