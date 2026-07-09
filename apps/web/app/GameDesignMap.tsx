'use client';

import { useEffect, useState, useCallback } from 'react';
import { addEdge, Connection } from 'reactflow';
import ReactFlow, {
  Background,
  Controls,
  Panel, // Componente novo para UI sobreposta!
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { supabase } from '@repo/database';
import { SupabaseClient } from '@supabase/supabase-js'; // Importamos apenas a Tipagem

// Adicionamos o supabase na interface
interface MapProps {
  userId: string;
  supabase: SupabaseClient; 
}

// === COLE O ID DO USUÁRIO DE TESTE AQUI ===
const TEST_USER_ID = 'a93eb967-a72c-45e5-83c5-ca5409d20360';

interface MapProps {
  userId: string;
}

export default function GameDesignMap({ userId }: MapProps) {
  //const supabase = createClient();

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Estados do Formulário
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  // Mantemos sua função de carregar dados (pode voltar para a conexão real do Supabase)
  useEffect(() => {
    async function loadGraphData() {
      const { data: tipsData } = await supabase.from('tips').select('*');
      const { data: connectionsData } = await supabase.from('tip_connections').select('*');

      const initialNodes: Node[] = (tipsData || []).map((tip, index) => ({
        id: tip.id,
        data: { label: tip.title }, 
        position: { x: 250 + (index * 150), y: 150 + (index * 50) },
        style: { background: '#fff', border: '1px solid #175e7a', borderRadius: '8px', padding: '10px' }
      }));

      const initialEdges: Edge[] = (connectionsData || []).map((conn) => ({
        id: conn.id,
        source: conn.source_tip_id,
        target: conn.target_tip_id,
        animated: true,
        style: { stroke: '#175e7a', strokeWidth: 2 }
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
    loadGraphData();
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // === FUNÇÃO DE SALVAR NO BANCO ===
  async function handleSaveTip() {
    if (!newTitle.trim()) return alert('O título é obrigatório!');

    // 1. Inserindo no Supabase
    const { data, error } = await supabase
      .from('tips')
      .insert([
        {
          title: newTitle,
          content: newContent,
          user_id: TEST_USER_ID // Usando o usuário de teste temporário
        }
      ])
      .select()
      .single(); // Retorna a linha recém-criada com o ID oficial do banco

    if (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar a ideia no banco.');
      return;
    }

    // 2. Criando o novo Nó (Node) para aparecer na tela imediatamente
    const newNode: Node = {
      id: data.id,
      data: { label: data.title },
      // Coloca o novo nó um pouco para baixo no centro da tela
      position: { x: 300, y: 100 }, 
      style: { background: '#fff', border: '1px solid #175e7a', borderRadius: '8px', padding: '10px' }
    };

    // 3. Atualizando a interface
    setNodes((nds) => [...nds, newNode]);
    setIsAdding(false); // Fecha o formulário
    setNewTitle(''); // Limpa o input
    setNewContent('');
  }

  // === NOVA FUNÇÃO: FAZER LOGOUT ===
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Erro ao sair:', error.message);
      alert('Houve um erro ao tentar sair.');
    }
    // Não precisamos redirecionar manualmente! 
    // O evento onAuthStateChange do page.tsx fará a mágica de esconder esse mapa.
  }

  // FUNÇÃO PARA COONECTAR TIPS
  const onConnect = useCallback(
    async (params: Connection | Edge) => {
      // 1. Desenha a linha na tela imediatamente para o usuário ver
      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#175e7a', strokeWidth: 2 } }, eds));

      // 2. Salva essa conexão no Supabase
      if (params.source && params.target) {
        const { error } = await supabase
          .from('tip_connections')
          .insert([
            {
              source_tip_id: params.source,
              target_tip_id: params.target
            }
          ]);

        if (error) {
          console.error("Erro ao salvar conexão:", error);
          alert("Não foi possível salvar a ligação no banco.");
        }
      }
    },
    [supabase]
  );

  // Função que roda quando você aperta Delete com uma Tip selecionada
  const onNodesDelete = useCallback(
    async (deletedNodes: Node[]) => {
      // O React Flow permite deletar vários nós de uma vez (selecionando com Shift)
      // Então pegamos todos os IDs que estão sendo deletados
      const idsToDelete = deletedNodes.map((node) => node.id);

      const { error } = await supabase
        .from('tips')
        .delete()
        .in('id', idsToDelete); // O .in() deleta todos os IDs dessa lista de uma vez

      if (error) {
        console.error('Erro ao deletar Tip:', error);
        alert('Erro ao apagar a Ideia do banco.');
      }
    },
    [supabase]
  );

  // Função que roda quando você aperta Delete com uma Linha (Seta) selecionada
  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      const idsToDelete = deletedEdges.map((edge) => edge.id);

      const { error } = await supabase
        .from('tip_connections')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        console.error('Erro ao deletar a conexão:', error);
        alert('Erro ao desconectar as Ideias no banco.');
      }
    },
    [supabase]
  );

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#f4f4f5' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        fitView
      >
        <Background />
        <Controls />
        
        {/* === NOVO PAINEL DE CONTROLE DO USUÁRIO (Canto Superior Esquerdo) === */}
        <Panel position="top-left" style={{ margin: '10px' }}>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#e11d48', // Vermelho suave (Estilo Tailwind)
              color: 'white', 
              borderRadius: '6px', 
              border: 'none', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            Sair do Journal
          </button>
        </Panel>
        
        {/* === PAINEL FLUTUANTE DA UI === */}
        <Panel position="top-right" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
          
          {!isAdding ? (
            <button 
              onClick={() => setIsAdding(true)}
              style={{ padding: '10px', backgroundColor: '#175e7a', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              + Nova Ideia
            </button>
          ) : (
            <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#333' }}>Adicionar Ideia</h3>
              
              <input 
                placeholder="Título (ex: Pulo Duplo)" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              
              <textarea 
                placeholder="Descreva sua mecânica ou história..." 
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={4}
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'none' }}
              />
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={handleSaveTip}
                  style={{ flex: 1, padding: '8px', backgroundColor: '#175e7a', color: 'white', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                  Salvar
                </button>
                <button 
                  onClick={() => setIsAdding(false)}
                  style={{ padding: '8px', backgroundColor: '#e0e0e0', color: '#333', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          
        </Panel>
      </ReactFlow>
    </div>
  );
}