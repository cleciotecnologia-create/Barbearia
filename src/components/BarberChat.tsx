import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Scissors, CalendarIcon, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getBarberChatResponse } from '../services/geminiService';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface BarberChatProps {
  barbeariaName: string;
  agendaUrl: string;
  onOpenBooking?: () => void;
}

export const BarberChat: React.FC<BarberChatProps> = ({ barbeariaName, agendaUrl, onOpenBooking }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setMessage('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    const response = await getBarberChatResponse(userMessage, barbeariaName, agendaUrl, history);
    
    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-0 w-[350px] max-w-[calc(100vw-3rem)] h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-indigo-600 p-6 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-sm leading-none">{barbeariaName} AI</h3>
                  <p className="text-[10px] opacity-70 mt-1 font-medium">Chat de Atendimento</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {onOpenBooking && (
                  <button 
                    onClick={() => {
                      onOpenBooking();
                      setIsOpen(false);
                    }}
                    className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-[8px] font-black uppercase tracking-widest transition-colors flex items-center gap-1"
                    title="Novo Agendamento"
                  >
                    <Plus className="w-3 h-3" /> Registrar
                  </button>
                )}
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-indigo-600">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-slate-900 font-bold text-sm">Olá! Como posso te ajudar hoje?</p>
                    <p className="text-slate-500 text-xs mt-1">Tire dúvidas sobre horários, serviços ou peça o link de agendamento.</p>
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div 
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-slate-900 text-white rounded-tr-none shadow-lg' 
                        : 'bg-slate-100 text-slate-700 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                    {msg.text.includes(agendaUrl) && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <a 
                          href={agendaUrl}
                          className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-colors"
                        >
                          <CalendarIcon className="w-3 h-3" /> Agendar Agora
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 0.6 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full" 
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }} 
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      className="w-1.5 h-1.5 bg-slate-400 rounded-full" 
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Sua dúvida aqui..."
                  className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-5 pr-14 text-sm font-bold placeholder:text-slate-400 outline-none focus:border-indigo-600 transition-all shadow-sm"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={handleSend}
                  disabled={!message.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl hover:scale-105 active:scale-95 transition-all relative group"
      >
        <MessageCircle className="w-8 h-8 group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 border-4 border-[#FDFDFD] rounded-full flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        </div>
      </button>
    </div>
  );
};
