import React, { useState, useRef, useEffect } from 'react';
import {
  MessageCircle, Send, X, Bot, User, Loader2, Minimize2, Maximize2,
  Sparkles, HelpCircle, Trash2
} from 'lucide-react';
import { AnaliseCompleta } from '../services/aiAnalysisService';
import { ChatMessage, enviarMensagemChat } from '../services/fiscalChatService';

interface FiscalChatConsultantProps {
  analise: AnaliseCompleta | null;
  nomeEmpresa: string;
}

const SUGESTOES_RAPIDAS = [
  'Quais as opções de parcelamento?',
  'Como regularizar as pendências?',
  'Qual o risco de não pagar?',
  'Como calcular a SELIC?',
  'Como emitir CND?',
  'Quais multas se aplicam?',
];

export function FiscalChatConsultant({ analise, nomeEmpresa }: FiscalChatConsultantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const mensagem = (text || input).trim();
    if (!mensagem || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: mensagem,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const resposta = await enviarMensagemChat(mensagem, messages, analise, nomeEmpresa);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resposta,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua pergunta. Tente novamente.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const formatMessage = (text: string): string => {
    return text
      .replace(/### (.*)/g, '<h4 class="font-bold text-slate-800 mt-3 mb-1 text-sm">$1</h4>')
      .replace(/## (.*)/g, '<h3 class="font-bold text-slate-800 mt-4 mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-xs">$1</code>')
      .replace(/^- (.*)/gm, '<li class="ml-3 list-disc text-sm">$1</li>')
      .replace(/^\d+\. (.*)/gm, '<li class="ml-3 list-decimal text-sm">$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl shadow-indigo-600/30 transition-all hover:scale-105 group"
        title="Consultor Fiscal IA"
      >
        <MessageCircle size={24} />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white animate-pulse" />
        <span className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Consultor Fiscal IA
        </span>
      </button>
    );
  }

  const chatWidth = isExpanded ? 'w-[600px]' : 'w-[380px]';
  const chatHeight = isExpanded ? 'h-[600px]' : 'h-[480px]';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${chatWidth} ${chatHeight} bg-white rounded-2xl shadow-2xl shadow-slate-300/50 border border-slate-200 flex flex-col overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Consultor Fiscal IA</h4>
            <p className="text-[10px] text-indigo-200">
              {analise ? `Assessorando ${nomeEmpresa || 'empresa'}` : 'Pronto para ajudar'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={handleClear} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Limpar conversa">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-indigo-500" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">Consultor Fiscal Inteligente</h4>
            <p className="text-xs text-slate-400 mb-6 max-w-[280px] mx-auto">
              {analise
                ? 'Tire dúvidas sobre a situação fiscal da empresa. Tenho acesso a todos os dados da análise.'
                : 'Faça perguntas sobre tributação, compliance e obrigações fiscais brasileiras.'}
            </p>

            <div className="space-y-2">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Perguntas sugeridas</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGESTOES_RAPIDAS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors border border-indigo-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-indigo-600" />
              </div>
            )}
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-md'
                : 'bg-slate-100 text-slate-700 rounded-bl-md'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm">{msg.content}</p>
              ) : (
                <div
                  className="text-sm leading-relaxed prose-sm"
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                />
              )}
              <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <User size={14} className="text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-indigo-600" />
            </div>
            <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-indigo-500" />
                <span className="text-xs text-slate-500">Analisando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Pergunte sobre tributação..."
            className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-[9px] text-slate-400 text-center mt-1.5">
          Consultor IA - respostas baseadas em legislacao vigente
        </p>
      </div>
    </div>
  );
}
