'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, { Background, Controls, Handle, Position, addEdge, Edge, Node, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, ConnectionMode } from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '../supabase';

// ============================================================================
// NÓS CUSTOMIZADOS (Devem ficar de fora da função principal)
// ============================================================================

// 1. Nó de Entrada (E-mail e Senha)
const InputNode = memo(({ data }: any) => (
  <div style={{ background: '#1e1e24', border: '2px solid #3b82f6', borderRadius: '8px', padding: '16px', width: '220px', color: '#fff', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.2)' }}>
    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px' }}>{data.label}</label>
    <input 
      type={data.type} 
      onChange={(e) => data.onChange(e.target.value)}
      placeholder={data.placeholder}
      className="nodrag" // Permite clicar e selecionar o texto sem arrastar o card
      style={{ width: '100%', marginTop: '8px', padding: '10px', borderRadius: '4px', border: '1px solid #2a2a35', background: '#121212', color: '#fff', boxSizing: 'border-box' }}
    />
    {/* Conector de Saída */}
    <Handle type="source" position={Position.Right} style={{ width: '14px', height: '14px', background: '#3b82f6', border: '2px solid #1e1e24' }} />
  </div>
));

// 2. Nó "Portal" (Login e Sign Up)
const GateNode = memo(({ data }: any) => (
  <div style={{ background: '#121212', border: `2px dashed ${data.color}`, borderRadius: '50%', width: '140px', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: data.color, boxShadow: `0 0 30px ${data.color}33`, animation: 'float 3s ease-in-out infinite' }}>
    {/* Conector de Entrada (Aceita múltiplos cabos) */}
    <Handle type="target" position={Position.Left} style={{ width: '18px', height: '18px', background: data.color, border: '2px solid #1e1e24', left: '-10px' }} />
    <span style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', fontSize: '14px', textAlign: 'center' }}>{data.label}</span>
    
    <style>{`
      @keyframes float {
        0% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
        100% { transform: translateY(0px); }
      }
    `}</style>
  </div>
));

// 3. Nó de OAuth (Google, GitHub, etc)
const OAuthNode = memo(({ data }: any) => (
  <div style={{ background: '#2a2a35', border: '2px solid #a855f7', borderRadius: '8px', padding: '12px 20px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(168, 85, 247, 0.2)', cursor: 'grab' }}>
    <span style={{ fontSize: '20px' }}>{data.icon}</span>
    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{data.label}</span>
    <Handle type="source" position={Position.Right} style={{ width: '14px', height: '14px', background: '#a855f7', border: '2px solid #1e1e24' }} />
  </div>
));

const nodeTypes = { inputNode: InputNode, gateNode: GateNode, oauthNode: OAuthNode };

// ============================================================================
// PÁGINA PRINCIPAL
// ============================================================================

export default function LoginWorkspacePage() {
  const router = useRouter();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [systemMsg, setSystemMsg] = useState({ text: 'Conecte as credenciais no portal para acessar o sistema.', type: 'info' });
  const [isLoading, setIsLoading] = useState(false);

  // Usamos useRef para guardar os valores digitados sem precisar re-renderizar o React Flow a cada tecla
  const creds = useRef({ email: '', password: '' });

  // Posições iniciais dos cartões espalhados pela tela
  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'node-email', type: 'inputNode', position: { x: 100, y: 150 },
      data: { label: 'E-mail', type: 'email', placeholder: 'gamedev@studio.com', onChange: (val: string) => creds.current.email = val }
    },
    {
      id: 'node-password', type: 'inputNode', position: { x: 80, y: 350 },
      data: { label: 'Senha', type: 'password', placeholder: '••••••••', onChange: (val: string) => creds.current.password = val }
    },
    {
      id: 'node-github', type: 'oauthNode', position: { x: 150, y: 550 },
      data: { label: 'GitHub Auth', icon: '🐙' }
    },
    {
      id: 'gate-login', type: 'gateNode', position: { x: 600, y: 200 },
      data: { label: 'Entrar', color: '#10b981' } // Verde
    },
    {
      id: 'gate-signup', type: 'gateNode', position: { x: 600, y: 450 },
      data: { label: 'Criar Conta', color: '#eab308' } // Amarelo
    }
  ]);

  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  // Lógica do Motor do Jogo: O que acontece quando os cabos são plugados?
  const onConnect = useCallback(async (params: any) => {
    // 1. Cria a linha visualmente e pinta ela de branco brilhante
    const newEdge = { ...params, animated: true, style: { stroke: '#fff', strokeWidth: 3 } };
    
    // CORREÇÃO: Calcula o novo mapa de cabos PRIMEIRO, de forma síncrona
    const nextEdges = addEdge(newEdge, edges);
    setEdges(nextEdges); // Salva na tela depois

    const targetId = params.target; // Descobre em qual Gate o cabo foi plugado

    // ====================================================================
    // REGRA 1: LOGIN COM GITHUB
    // ====================================================================
    if (params.source === 'node-github' && targetId === 'gate-login') {
      setSystemMsg({ text: 'Iniciando Handshake com GitHub...', type: 'info' });
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'github' });
      
      if (error) {
        console.error("ERRO GITHUB:", error); // <-- Adicionado para você ver no F12
        setSystemMsg({ text: error.message || 'Falha ao conectar no GitHub.', type: 'error' });
      }
      return;
    }

    // ====================================================================
    // REGRA 2: LOGIN OU SIGNUP COM EMAIL E SENHA
    // ====================================================================
    // CORREÇÃO: Lê a variável nextEdges que acabamos de calcular com certeza!
    const hasEmailConnected = nextEdges.some(e => e.source === 'node-email' && e.target === targetId);
    const hasPassConnected = nextEdges.some(e => e.source === 'node-password' && e.target === targetId);

    if (hasEmailConnected && hasPassConnected) {
      const email = creds.current.email;
      const password = creds.current.password;

      // Debug: Mostra no console o que o cabo está puxando
      console.log("Tentando autenticar com:", { email, password });

      if (!email || !password) {
        setSystemMsg({ text: 'Erro: Os nós estão vazios. Preencha e-mail e senha.', type: 'error' });
        setTimeout(() => setEdges([]), 1500); 
        return;
      }

      setIsLoading(true);
      setSystemMsg({ text: 'Compilando credenciais...', type: 'info' });

      if (targetId === 'gate-login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("ERRO LOGIN SUPABASE:", error); // <-- O VERDADEIRO MOTIVO VAI APARECER AQUI
          
          // Se o Supabase mandar "{}", nós forçamos uma mensagem amigável
          const errorMessage = error.message === "{}" ? "Credenciais inválidas ou e-mail não confirmado." : error.message;
          setSystemMsg({ text: errorMessage, type: 'error' });
          
          setIsLoading(false);
          setEdges([]);
        } else {
          setSystemMsg({ text: 'Acesso Liberado! Entrando no Workspace...', type: 'success' });
          router.push('/dashboard'); // <-- Ajuste para a URL correta do seu workspace se precisar
        }
      } 
      
      else if (targetId === 'gate-signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          console.error("ERRO SIGNUP SUPABASE:", error); // <-- O VERDADEIRO MOTIVO VAI APARECER AQUI
          
          const errorMessage = error.message === "{}" ? "Erro no servidor. Tente usar uma senha mais forte." : error.message;
          setSystemMsg({ text: errorMessage, type: 'error' });
        } else {
          setSystemMsg({ text: 'Conta criada! Mova os cabos para o portal ENTRAR.', type: 'success' });
          setEdges([]); 
        }
        setIsLoading(false);
      }
    }
  }, [edges, router]); // <-- edges adicionado nas dependências do useCallback

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0c', position: 'relative' }}>
      
      {/* HUD Superior de Sistema (Mensagens) */}
      <div style={{ position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
        <h1 style={{ color: '#fff', margin: '0 0 8px 0', fontSize: '24px', letterSpacing: '4px', textTransform: 'uppercase' }}>System Auth</h1>
        <div style={{
          background: systemMsg.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : systemMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
          border: `1px solid ${systemMsg.type === 'error' ? '#ef4444' : systemMsg.type === 'success' ? '#10b981' : '#3b82f6'}`,
          color: systemMsg.type === 'error' ? '#f87171' : systemMsg.type === 'success' ? '#34d399' : '#60a5fa',
          padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', backdropFilter: 'blur(4px)',
          transition: 'all 0.3s'
        }}>
          {isLoading ? 'PROCESSANDO...' : systemMsg.text}
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        connectionMode={ConnectionMode.Loose} // Permite conectar de qualquer jeito criativo
      >
        <Background color="#333" gap={24} size={2} />
      </ReactFlow>

      {/* Instruções Fixas no Canto */}
      <div style={{ position: 'absolute', bottom: 32, left: 32, zIndex: 10, color: '#6b7280', fontSize: '13px', pointerEvents: 'none' }}>
        <p style={{ margin: 0 }}>&gt; Arraste as bolinhas azuis para conectar os nós.</p>
        <p style={{ margin: '4px 0 0 0' }}>&gt; A autenticação é disparada automaticamente na conexão dupla.</p>
      </div>

    </div>
  );
}