'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Node, Edge, addEdge, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { SupabaseClient } from '@supabase/supabase-js';
import TipNode from './TipNode';
import SessionNode from './SessionNode';
import { useRouter } from 'next/navigation';

const nodeTypes = {
  customTip: TipNode,
  sessionNode: SessionNode,
};

interface MapProps {
  userId: string;
  projectId: string,
  supabase: SupabaseClient;
}

export default function GameDesignMap({ userId, projectId, supabase }: MapProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [savedTipsList, setSavedTipsList] = useState<any[]>([]);

  // Estados do Modal
  const [isAdding, setIsAdding] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionColor, setSessionColor] = useState('#3b82f6');

  const router = useRouter();

  // ==========================================
  // FUNÇÕES DE AÇÃO DO CARD
  // ==========================================
  const onNodeResizeStop = useCallback(async (_: any, node: Node) => {
    if (node.type === 'sessionNode') {
      await supabase
        .from('tips')
        .update({ width: node.width, height: node.height })
        .eq('id', node.id);
    }
  }, [supabase]);

  const handleResizeEnd = async (nodeId: string, width: number, height: number) => {
    const { error } = await supabase
      .from('tips')
      .update({ width, height })
      .eq('id', nodeId);
      
    if (error) console.error('Erro ao salvar tamanho:', error);
  };

  const handleEditSession = (nodeId: string, currentTitle: string, currentColor: string) => {
    setEditingNodeId(nodeId); // Reutilizamos o ID de edição
    setSessionTitle(currentTitle);
    setSessionColor(currentColor);
    setIsEditingSession(true);
  };

  const handleDeleteNode = async (nodeId: string) => {
    const { error } = await supabase.from('tips').delete().eq('id', nodeId);
    if (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir a ideia.');
      return;
    }
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
  };

  const handleEditNode = (nodeId: string, currentTitle: string, currentContent: string, currentTags: string[]) => {
    setEditingNodeId(nodeId);
    setNewTitle(currentTitle);
    setNewContent(currentContent || '');
    setNewTags(currentTags ? currentTags.join(', ') : '');
    setIsAdding(true);
  };

  const handleSaveTemplate = async (nodeId: string) => {
    const { error } = await supabase
      .from('tips')
      .update({ is_template: true })
      .eq('id', nodeId);

    if (error) {
      console.error('Erro ao salvar template:', error);
      alert('Erro ao favoritar o template.');
      return;
    }

    alert('Tip salva na sua biblioteca de Templates!');
    loadSidebarTemplates(); 
  };

  const handleRemoveTemplate = async (templateId: string) => {
    if (!confirm('Remover este item dos Templates? Ele não será apagado do projeto original.')) return;
    
    const { error } = await supabase
      .from('tips')
      .update({ is_template: false })
      .eq('id', templateId);

    if (error) {
      alert('Erro ao remover template.');
    } else {
      loadSidebarTemplates(); // Atualiza a barra lateral na hora
    }
  };

  const onDragStart = (event: any, tip: any) => {
    // Transforma os dados do card em texto e salva na memória temporária do navegador
    event.dataTransfer.setData('application/reactflow', JSON.stringify(tip));
    // Diz ao navegador que o efeito visual permitido é o de "mover"
    event.dataTransfer.effectAllowed = 'move';
  };

  const loadSidebarTemplates = useCallback(async () => {
    const { data: savedData } = await supabase
      .from('tips')
      .select(`id, title, content, tip_tags ( tags ( name ) )`)
      .eq('user_id', userId) // Puxa do usuário logado (de qualquer projeto)
      .eq('is_template', true) // <--- Filtra apenas os templates!
      .order('created_at', { ascending: false });

    if (savedData) setSavedTipsList(savedData);
  }, [supabase, userId]);

  // ==========================================
  // CARREGAMENTO INICIAL
  // ==========================================
  useEffect(() => {
    async function loadGraphData() {
      // 1. Busca os Nós APENAS do projeto atual
      const { data: tipsData } = await supabase
        .from('tips')
        .select(`id, title, content, position_x, position_y, tip_tags ( tags ( name ) ), node_type, width, height`)
        .eq('project_id', projectId);

      const initialNodes: Node[] = (tipsData || []).map((tip: any) => {
        const tagList = tip.tip_tags?.map((tt: any) => tt.tags?.name).filter(Boolean) || [];
        
        // Se for uma sessão, ela precisa renderizar por trás (zIndex: -1)
        const isSession = tip.node_type === 'sessionNode';

        return {
          id: tip.id,
          type: tip.node_type || 'customTip', // <-- Lê do banco
          data: { 
            title: tip.title, 
            content: tip.content,
            tags: tagList,
            color: tip.color, // <-- Lê a cor do banco
            onDelete: handleDeleteNode,
            onEdit: handleEditNode,
            onSaveTemplate: handleSaveTemplate,
            onResizeEnd: handleResizeEnd,
            onEditSession: handleEditSession // <-- Passa a função
          },
          position: { 
            x: tip.position_x !== null ? tip.position_x : 250, 
            y: tip.position_y !== null ? tip.position_y : 150 
          },
          // Aplica o tamanho apenas se existir no banco
          style: tip.width && tip.height ? { width: tip.width, height: tip.height } : undefined,
          zIndex: isSession ? -1 : 0 // <-- Joga a sessão para trás
        };
      });

      // 2. Busca as Conexões: 
      // Como as conexões não tem project_id direto, podemos filtrar as conexões
      // onde a "source_tip_id" pertence às tips deste projeto. 
      // Para simplificar a query via Supabase SDK, podemos puxar os IDs das tips carregadas:
      const loadedTipIds = (tipsData || []).map(t => t.id);
      
      let initialEdges: Edge[] = [];
      if (loadedTipIds.length > 0) {
        const { data: connectionsData } = await supabase
          .from('tip_connections')
          .select('*')
          .in('source_tip_id', loadedTipIds); // <--- Busca só as conexões dessas tips
          
        initialEdges = (connectionsData || []).map((conn) => ({
          id: conn.id,
          source: conn.source_tip_id,
          target: conn.target_tip_id,
          animated: true,
          style: { stroke: '#175e7a', strokeWidth: 2 }
        }));
      }

      // 3. Busca a lista da barra lateral (Tips Salvas)
      const { data: savedData } = await supabase
        .from('tips')
        .select(`id, title, content, tip_tags ( tags ( name ) )`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (savedData) setSavedTipsList(savedData);

      loadSidebarTemplates();
      setNodes(initialNodes);
      setEdges(initialEdges);
    }
    loadGraphData();
  }, [supabase, projectId, loadSidebarTemplates]);

  // ==========================================
  // FUNÇÕES DO REACT FLOW (Mudanças e Ligações)
  // ==========================================
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback(async (params: Connection | Edge) => {
    setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#175e7a', strokeWidth: 2 } }, eds));
    if (params.source && params.target) {
      const { error } = await supabase.from('tip_connections').insert([{ source_tip_id: params.source, target_tip_id: params.target }]);
      if (error) console.error("Erro ao salvar conexão:", error);
    }
  }, [supabase]);

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    const idsToDelete = deletedNodes.map((node) => node.id);
    const { error } = await supabase.from('tips').delete().in('id', idsToDelete);
    if (error) console.error('Erro ao deletar Tip:', error);
  }, [supabase]);

  const onEdgesDelete = useCallback(async (deletedEdges: Edge[]) => {
    const idsToDelete = deletedEdges.map((edge) => edge.id);
    const { error } = await supabase.from('tip_connections').delete().in('id', idsToDelete);
    if (error) console.error('Erro ao deletar conexão:', error);
  }, [supabase]);

  const onNodeDragStop = useCallback(async (event: React.MouseEvent, node: Node) => {
    const { x, y } = node.position;
    const { error } = await supabase.from('tips').update({ position_x: x, position_y: y }).eq('id', node.id);
    if (error) console.error('Erro ao salvar nova posição:', error);
  }, [supabase]);

  // ==========================================
  // FUNÇÕES DE DRAG AND DROP (Barra Lateral -> Mapa)
  // ==========================================
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    const savedTipData = event.dataTransfer.getData('application/reactflow');
    if (!savedTipData) return;

    const parsedTip = JSON.parse(savedTipData);
    const position = { x: event.clientX - 260, y: event.clientY - 50 }; // Compensando barra lateral e header

    const { data: newTip, error } = await supabase
      .from('tips')
      .insert([{ 
        title: parsedTip.title, content: parsedTip.content, 
        position_x: position.x, position_y: position.y, user_id: userId,
        project_id: projectId
      }])
      .select().single();

    if (error) return alert('Erro ao instanciar na cena.');

    // Clona tags para a nova instância
    if (parsedTip.tags && parsedTip.tags.length > 0) {
      for (const tagName of parsedTip.tags) {
        let { data: tagData } = await supabase.from('tags').select('id').eq('name', tagName).single();
        if (!tagData) {
          const { data: newTagData } = await supabase.from('tags').insert([{ name: tagName }]).select().single();
          tagData = newTagData;
        }
        if (tagData) {
          await supabase.from('tip_tags').insert([{ tip_id: newTip.id, tag_id: tagData.id }]);
        }
      }
    }

    const newNode: Node = {
      id: newTip.id,
      type: 'customTip',
      position,
      data: {
        title: parsedTip.title, 
        content: parsedTip.content, 
        tags: parsedTip.tags,
        onDelete: handleDeleteNode, 
        onEdit: handleEditNode,
        onSaveTemplate: handleSaveTemplate // <-- MAKE SURE THIS IS HERE
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, userId, supabase]);

  // ==========================================
  // SALVAR / EDITAR MODAL
  // ==========================================
  async function handleSaveTip() {
    if (!newTitle.trim()) return alert('O título é obrigatório!');
    let currentTipId = editingNodeId;
    const tagArray = newTags.split(',').map(t => t.trim()).filter(t => t !== '');

    if (editingNodeId) {
      const { error } = await supabase.from('tips').update({ title: newTitle, content: newContent }).eq('id', editingNodeId);
      if (error) return alert('Erro ao atualizar a ideia no banco.');
      await supabase.from('tip_tags').delete().eq('tip_id', editingNodeId);
    } else {
      const { data, error } = await supabase.from('tips').insert([{ title: newTitle, content: newContent, user_id: userId, project_id: projectId }]).select().single();
      if (error) return alert('Erro ao salvar a ideia no banco.');
      currentTipId = data.id;
    }

    if (currentTipId && tagArray.length > 0) {
      for (const tagName of tagArray) {
        let { data: tagData } = await supabase.from('tags').select('id').eq('name', tagName).single();
        if (!tagData) {
          const { data: newTagData } = await supabase.from('tags').insert([{ name: tagName }]).select().single();
          tagData = newTagData;
        }
        if (tagData) await supabase.from('tip_tags').insert([{ tip_id: currentTipId, tag_id: tagData.id }]);
      }
    }

    if (editingNodeId) {
      setNodes((nds) => nds.map((n) => 
        n.id === editingNodeId ? { ...n, data: { ...n.data, title: newTitle, content: newContent, tags: tagArray } } : n
      ));
      } else {
        const newNode: Node = {
          id: currentTipId as string,
          type: 'customTip',
          data: { 
            title: newTitle, 
            content: newContent, 
            tags: tagArray, 
            onDelete: handleDeleteNode, 
            onEdit: handleEditNode,
            onSaveTemplate: handleSaveTemplate // <-- MAKE SURE THIS IS HERE
          },
          position: { x: 300, y: 100 },
        };
        setNodes((nds) => [...nds, newNode]);
      }

    setIsAdding(false);
    setEditingNodeId(null);
    setNewTitle('');
    setNewContent('');
    setNewTags('');
  }

return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#121212', color: '#fff' }}>
      
      
      {/* PAINEL ESQUERDO: Ações e Tips Salvos */}
      <div style={{ width: '260px', background: '#1e1e24', borderRight: '1px solid #2a2a35', padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
          onClick={() => router.push('/dashboard')}
          style={{ padding: '8px 16px', background: '#3f3f46', color: '#fff', border: '1px solid #52525b', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ← Voltar
        </button>
          <button 
            onClick={() => { setEditingNodeId(null); setNewTitle(''); setNewContent(''); setNewTags(''); setIsAdding(true); }}
            style={{ padding: '8px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}
          >
            + Adicionar Tip
          </button>
          <button 
            onClick={async () => {
              const sessionName = "Nova Sessão"; // Substitui o prompt bloqueado

              const { data, error } = await supabase
                .from('tips')
                .insert([{ 
                  title: sessionName, 
                  user_id: userId, 
                  project_id: projectId,
                  node_type: 'sessionNode',
                  width: 500,
                  height: 400 
                }])
                .select()
                .single();

              if (!error && data) {
                const newSession: Node = {
                  id: data.id,
                  type: 'sessionNode',
                  position: { x: 100, y: 100 },
                  data: { title: sessionName, onResizeEnd: handleResizeEnd }, // Passa a função
                  style: { width: 500, height: 400 },
                  zIndex: -1
                };
                setNodes((nds) => [...nds, newSession]);
              }
            }}
            style={{ padding: '8px', background: 'transparent', border: '2px dashed #10b981', color: '#10b981', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '16px' }}
          >
            [  ] Criar Sessão
          </button>
          <button style={{ padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Compartilhar Tip</button>
          <button style={{ padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Compartilhar Projeto</button>
          <button style={{ padding: '8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar Projeto</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ fontSize: '14px', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px', color: '#9ca3af' }}>Tips Salvos</h3>
            {savedTipsList.map((tip) => (
              <div key={tip.id} style={{ position: 'relative' }}>
                
                {/* O botão de excluir (FORA da área arrastável) */}
                <button
                  onClick={() => handleRemoveTemplate(tip.id)}
                  style={{
                    position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', 
                    color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', 
                    fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', zIndex: 11
                  }}
                >
                  X
                </button>

                {/* ÁREA ARRASTÁVEL: O evento onDragStart fica APENAS aqui */}
                <div 
                  draggable 
                  onDragStart={(e) => onDragStart(e, tip)}
                  style={{ 
                    background: '#1e1e24', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    border: '1px solid #333', 
                    cursor: 'grab', // Muda o cursor para a mãozinha
                    color: '#fff' 
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '8px', color: '#3b82f6' }}>{tip.title}</strong>
                  <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tip.content}
                  </div>
                  {/* Se quiser renderizar as tags aqui na barra lateral também, coloque-as aqui */}
                </div>
                
              </div>
            ))}
          </div>
        </div>

      {/* CENTRO: React Flow Workspace */}
      <div style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          {/* Adicionando de volta o fundo pontilhado escuro */}
          <Background color="#555" gap={16} /> 
          <Controls />
        </ReactFlow>
      </div>

      {/* PAINEL DIREITO: AI Companion (Charles) */}
      <div style={{ width: '300px', background: '#1e1e24', borderLeft: '1px solid #2a2a35', padding: '16px', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        <h3 style={{ fontSize: '16px', borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '16px', color: '#eab308' }}>✨ AI Companion</h3>
        <button style={{ padding: '10px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '24px' }}>Analisar Projeto</button>
        <div style={{ background: '#2a2a35', padding: '12px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6', color: '#d1d5db' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>The gameplay sucks</p>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            <li style={{ marginBottom: '8px' }}>Card A and Card B have the same features.</li>
            <li style={{ marginBottom: '8px' }}>Your story have a plot hole in Chapter 5 when blablabum but in Chapter 3 is bleblebam.</li>
            <li>Want to generate a .tex document as a pitch?</li>
          </ul>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE TIP */}
      {isAdding && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1e1e24', width: '400px', padding: '24px',
            borderRadius: '8px', border: '1px solid #3f3f46',
            display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{editingNodeId ? 'Editar Tip' : 'Nova Tip'}</h3>
            <input type="text" placeholder="Título da Ideia" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} />
            <textarea placeholder="Descreva a mecânica, história, etc..." value={newContent} onChange={(e) => setNewContent(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff', minHeight: '100px', resize: 'vertical' }} />
            <input type="text" placeholder="Tags (separadas por vírgula)" value={newTags} onChange={(e) => setNewTags(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => { setIsAdding(false); setEditingNodeId(null); }} style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveTip} style={{ padding: '8px 16px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {isEditingSession && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e24', width: '400px', padding: '24px', borderRadius: '8px', border: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Editar Sessão</h3>
            
            <input type="text" placeholder="Nome da Sessão" value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af' }}>Cor da borda:</label>
              <input type="color" value={sessionColor} onChange={(e) => setSessionColor(e.target.value)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '30px', width: '30px' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => { setIsEditingSession(false); setEditingNodeId(null); }} style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button 
                onClick={async () => {
                  if (editingNodeId) {
                    await supabase.from('tips').update({ title: sessionTitle, color: sessionColor }).eq('id', editingNodeId);
                    setNodes((nds) => nds.map((n) => n.id === editingNodeId ? { ...n, data: { ...n.data, title: sessionTitle, color: sessionColor } } : n));
                  }
                  setIsEditingSession(false);
                  setEditingNodeId(null);
                }} 
                style={{ padding: '8px 16px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
