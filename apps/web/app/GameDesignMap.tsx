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
  
  // Estados para as Imagens e Links nas Tips
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Estados para o Editor de Linhas (Edges)
  const [isEditingEdge, setIsEditingEdge] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [edgeColor, setEdgeColor] = useState('#9ca3af');
  const [edgeThickness, setEdgeThickness] = useState(2);

  const router = useRouter();

  // ==========================================
  // FUNÇÕES DE AÇÃO DO CARD
  // ==========================================
  const onEdgeDoubleClick = (event: any, edge: Edge) => {
    event.stopPropagation();
    setEditingEdgeId(edge.id);
    setEdgeColor(edge.data?.color || '#9ca3af');
    setEdgeThickness(edge.data?.thickness || 2);
    setIsEditingEdge(true);
  };

  const onNodeResizeStop = useCallback(async (_: any, node: Node) => {
    if (node.type === 'sessionNode') {
      await supabase
        .from('tips')
        .update({ width: node.width, height: node.height })
        .eq('id', node.id);
    }
  }, [supabase]);

  const handleResizeEnd = async (nodeId: string, width: number, height: number) => {
    // A matemática mágica: Caixas maiores ficam mais no fundo (números negativos maiores)
    const newZIndex = -Math.round((width * height) / 1000);
    
    setNodes(nds => nds.map(n => n.id === nodeId ? { 
      ...n, 
      style: { width, height },
      zIndex: newZIndex // <-- Atualiza na hora!
    } : n));
    
    const { error } = await supabase.from('tips').update({ width, height }).eq('id', nodeId);
    if (error) console.error('Erro ao salvar tamanho:', error);
  };

  const handleEditSession = (nodeId: string, currentTitle: string, currentColor: string) => {
    setEditingNodeId(nodeId); // Reutilizamos o ID de edição
    setSessionTitle(currentTitle);
    setSessionColor(currentColor);
    setIsEditingSession(true);
  };

  const handleToggleExpand = (nodeId: string, isExpanded: boolean) => {
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        return { ...n, zIndex: isExpanded ? 9999 : 10 }; // Fica acima de tudo!
      }
      return n;
    }));
  };

  const handleDeleteNode = async (nodeId: string) => {
    // 1. Atualiza as Tips filhas para ficarem "órfãs" (parent_id nulo) no banco
    await supabase.from('tips').update({ parent_id: null }).eq('parent_id', nodeId);
    
    // 2. Apaga o nó solicitado
    const { error } = await supabase.from('tips').delete().eq('id', nodeId);
    
    if (!error) {
      // 3. Limpa o mapa visualmente (remove o nó apagado e liberta os filhos)
      setNodes((nds) => {
        const remaining = nds.filter((n) => n.id !== nodeId);
        return remaining.map(n => n.parentNode === nodeId ? { ...n, parentNode: undefined } : n);
      });
    } else {
      console.error('Erro ao deletar:', error);
    }
  };

  const handleEditNode = (id: string, title: string, content: string, tags: string[], imageUrl: string, linkUrl: string) => {
    setEditingNodeId(id); setNewTitle(title); setNewContent(content); 
    setNewTags(tags.join(', ')); setNewImageUrl(imageUrl); setNewLinkUrl(linkUrl); 
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
        .select(`id, title, content, position_x, position_y, tip_tags ( tags ( name ) ), node_type, width, height, parent_id, image_url, link_url`)
        .eq('project_id', projectId);

      const initialNodes: Node[] = (tipsData || []).map((tip: any) => {
        const tagList = tip.tip_tags?.map((tt: any) => tt.tags?.name).filter(Boolean) || [];
        
        // Se for uma sessão, ela precisa renderizar por trás (zIndex: -1)
        const isSession = tip.node_type === 'sessionNode';

        // === NOVO: Criamos uma lista com todos os IDs válidos que realmente existem no projeto
        const validIds = new Set((tipsData || []).map((t: any) => t.id));

        // Calcula o Z-Index na hora de carregar (Tips = 10, Sessões = Negativo pela Área)
        let zIdx = 10;
        if (isSession) {
          const w = tip.width || 500;
          const h = tip.height || 400;
          zIdx = -Math.round((w * h) / 1000);
        }

        // === NOVO: Verifica se o pai da Tip realmente existe no projeto. Se não, fica null.
        const safeParentId = tip.parent_id && validIds.has(tip.parent_id) ? tip.parent_id : undefined;

        return {
          id: tip.id,
          type: tip.node_type || 'customTip', // <-- Lê do banco
          parentNode: safeParentId, // Hierarquia da Sessions sobre as Tips, sem parentId = Tip Orfã
          zIndex: zIdx, // Z-Index para não bugar a hierarquia no workspace
          data: { 
            title: tip.title, 
            content: tip.content,
            tags: tagList,
            color: tip.color, // <-- Lê a cor do banco
            imageUrl: tip.image_url,
            linkUrl: tip.link_url,
            onDelete: handleDeleteNode,
            onEdit: handleEditNode,
            onSaveTemplate: handleSaveTemplate,
            onResizeEnd: handleResizeEnd,
            onEditSession: handleEditSession,
            onToggleExpand: handleToggleExpand
          },
          position: { 
            x: tip.position_x !== null ? tip.position_x : 250, 
            y: tip.position_y !== null ? tip.position_y : 150 
          },
          // Aplica o tamanho apenas se existir no banco
          style: tip.width && tip.height ? { width: tip.width, height: tip.height } : undefined,
        };
      });

      // 2. Busca as Conexões: 
      // Como as conexões não tem project_id direto, podemos filtrar as conexões
      // onde a "source_tip_id" pertence às tips deste projeto. 
      // Para simplificar a query via Supabase SDK, podemos puxar os IDs das tips carregadas:
      const loadedTipIds = (tipsData || []).map(t => t.id);
      const { data: connectionsData } = await supabase.from('connections').select('*').eq('project_id', projectId);
      
      let initialEdges: Edge[] = [];
      if (loadedTipIds.length > 0) {
        const { data: connectionsData } = await supabase
          .from('tip_connections')
          .select('*')
          .in('source_tip_id', loadedTipIds); // <--- Busca só as conexões dessas tips
          
      const initialEdges: Edge[] = (connectionsData || []).map((conn: any) => ({
        id: conn.id,
        source: conn.source_id,
        target: conn.target_id,
        sourceHandle: conn.source_handle,
        targetHandle: conn.target_handle,
        interactionWidth: 20, // Área de clique grossa
        data: { color: conn.color, thickness: conn.thickness },
        // INJETA O ESTILO DIRETO NA LINHA AQUI:
        style: { stroke: conn.color || '#9ca3af', strokeWidth: conn.thickness || 2 }
      }));
      setEdges(initialEdges);
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

  // Essa função é chamada automaticamente quando você aperta a tecla DELETE no teclado
  const onNodesDelete = async (deletedNodes: Node[]) => {
    // Separa quem o usuário realmente clicou vs quem o React Flow quer apagar por osmose
    const rescuedNodes = deletedNodes.filter(n => !n.selected);

    for (const node of deletedNodes) {
      if (!node.selected) {
        // RESGATE: É uma Tip que estava dentro da sessão excluída. 
        // Avisa o banco que ela agora é órfã (mas NÃO DELETA)
        await supabase.from('tips').update({ parent_id: null }).eq('id', node.id);
        continue;
      }

      // EXCLUSÃO REAL: O nó que o usuário clicou para apagar
      await supabase.from('tips').update({ parent_id: null }).eq('parent_id', node.id);
      await supabase.from('tips').delete().eq('id', node.id);
    }

    // Devolve as Tips salvas para a interface visual
    if (rescuedNodes.length > 0) {
      setNodes(nds => {
        const currentIds = nds.map(n => n.id);
        const nodesToRestore = rescuedNodes
          .filter(n => !currentIds.includes(n.id))
          .map(n => ({ ...n, parentNode: undefined })); // Liberta do pai apagado
        return [...nds, ...nodesToRestore];
      });
    }
  };

  const onEdgesDelete = async (deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
      // Impede o banco de quebrar se o ID não for um UUID válido
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(edge.id);
      if (isUUID) {
        await supabase.from('connections').delete().eq('id', edge.id);
      }
    }
  };

const onNodeDragStop = async (event: any, node: Node) => {
    // 1. Função Auxiliar: Descobrir a posição REAL na tela
    // (Se um nó está dentro de outro, o X e Y dele ficam relativos ao pai, então precisamos somar tudo)
    const getAbsPos = (n: Node) => {
      let x = n.position.x;
      let y = n.position.y;
      let parentId = n.parentNode;
      
      while (parentId) {
        const parent = nodes.find(p => p.id === parentId);
        if (parent) {
          x += parent.position.x;
          y += parent.position.y;
          parentId = parent.parentNode;
        } else break;
      }
      return { x, y };
    };

    // 2. Função Auxiliar: Evitar buracos negros (Paradoxos)
    // Impede que você coloque a "Sessão Pai" dentro da "Sessão Filha"
    const isDescendant = (draggedId: string, potentialParentId: string) => {
      let currentId = potentialParentId;
      while (currentId) {
        if (currentId === draggedId) return true;
        const p = nodes.find(n => n.id === currentId);
        currentId = p?.parentNode || '';
      }
      return false;
    };

    // 3. Pegar informações do nó que está sendo arrastado (Tip ou Sessão)
    const absPos = getAbsPos(node);
    const nodeW = node.type === 'sessionNode' ? (node.style?.width as number || 500) : 250;
    const nodeH = node.type === 'sessionNode' ? (node.style?.height as number || 400) : 150;
    
    // Calcula exatamente o ponto central do card sendo arrastado
    const centerX = absPos.x + (nodeW / 2);
    const centerY = absPos.y + (nodeH / 2);

    // 4. Procura todas as Sessões que existem debaixo desse ponto central
    const containingSessions = nodes.filter(n => {
      // Ignora Tips e ignora a si mesmo
      if (n.type !== 'sessionNode' || n.id === node.id) return false;
      // Ignora se for criar um paradoxo
      if (isDescendant(node.id, n.id)) return false; 

      const sAbs = getAbsPos(n);
      const sW = (n.style?.width as number) || 500;
      const sH = (n.style?.height as number) || 400;

      // Retorna true se o centro do nó arrastado caiu dentro dessa caixa
      return centerX >= sAbs.x && centerX <= (sAbs.x + sW) && centerY >= sAbs.y && centerY <= (sAbs.y + sH);
    });

    let newParentId = undefined;
    let finalX = absPos.x;
    let finalY = absPos.y;

    // 5. Se caiu dentro de sessões, precisamos achar a mais "profunda/menor"
    if (containingSessions.length > 0) {
      // Ordena pela área visual da caixa. A menor caixa engole o nó.
      containingSessions.sort((a, b) => {
        const areaA = ((a.style?.width as number) || 500) * ((a.style?.height as number) || 400);
        const areaB = ((b.style?.width as number) || 500) * ((b.style?.height as number) || 400);
        return areaA - areaB;
      });
      
      const targetSession = containingSessions[0];
      
      // === ADICIONE ESTE IF PARA SATISFAZER O TYPESCRIPT ===
      if (targetSession) {
        newParentId = targetSession.id;
        
        // Converte a posição absoluta de volta para relativa em relação ao novo Pai
        const targetAbs = getAbsPos(targetSession);
        finalX = absPos.x - targetAbs.x;
        finalY = absPos.y - targetAbs.y;
      }
    }

    finalX = Math.round(finalX);
    finalY = Math.round(finalY);

    // 6. Atualiza a tela (React Flow)
    setNodes(nds => nds.map(n => {
      if (n.id === node.id) {
        // Se ficou órfão (saiu de todas as sessões), removemos a propriedade parentNode
        const { parentNode, ...rest } = n; 
        return newParentId 
          ? { ...rest, parentNode: newParentId, position: { x: finalX, y: finalY } }
          : { ...rest, position: { x: finalX, y: finalY } };
      }
      return n;
    }));

    // 7. Salva a nova posição e hierarquia no Banco de Dados
    const { error } = await supabase.from('tips').update({ 
      position_x: finalX, 
      position_y: finalY, 
      parent_id: newParentId || null 
    }).eq('id', node.id);

    if (error) console.error('Erro ao salvar física no banco:', error);
  };

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
  const handleSaveTip = async () => {
    let currentTipId = editingNodeId;

    // 1. SALVA OU ATUALIZA A TIP NO BANCO
    if (editingNodeId) {
      const { error } = await supabase.from('tips')
        .update({ title: newTitle, content: newContent, image_url: newImageUrl, link_url: newLinkUrl })
        .eq('id', editingNodeId);
      if (error) return alert('Erro ao atualizar a ideia no banco.');
      
      await supabase.from('tip_tags').delete().eq('tip_id', editingNodeId);
    } else {
      const { data, error } = await supabase.from('tips')
        .insert([{ title: newTitle, content: newContent, user_id: userId, project_id: projectId, image_url: newImageUrl, link_url: newLinkUrl }])
        .select().single();
      if (error) return alert('Erro ao salvar a ideia no banco.');
      currentTipId = data.id;
    }

    // 2. PROCESSA AS TAGS NO BANCO
    const tagsArray = newTags.split(',').map((t) => t.trim()).filter((t) => t !== '');
    for (const tagName of tagsArray) {
      let tagId;
      const { data: existingTag } = await supabase.from('tags').select('id').eq('name', tagName).single();
      if (existingTag) {
        tagId = existingTag.id;
      } else {
        const { data: newTag } = await supabase.from('tags').insert([{ name: tagName }]).select().single();
        if (newTag) tagId = newTag.id;
      }
      if (tagId) await supabase.from('tip_tags').insert([{ tip_id: currentTipId, tag_id: tagId }]);
    }

    // 3. ATUALIZA A TELA (Tudo de uma vez: Texto, Mídia e Tags!)
    setNodes((nds) => {
      if (editingNodeId) {
        // Atualiza o card existente
        return nds.map((n) => n.id === currentTipId ? {
          ...n,
          data: { ...n.data, title: newTitle, content: newContent, tags: tagsArray, imageUrl: newImageUrl, linkUrl: newLinkUrl }
        } : n);
      } else {
        // Cria um card novo
        const newNode: Node = {
          id: currentTipId as string,
          type: 'customTip',
          position: { x: 250, y: 150 },
          zIndex: 10,
          data: { 
            title: newTitle, content: newContent, tags: tagsArray, imageUrl: newImageUrl, linkUrl: newLinkUrl,
            onDelete: handleDeleteNode, onEdit: handleEditNode, onSaveTemplate: handleSaveTemplate, onToggleExpand: handleToggleExpand 
          }
        };
        return [...nds, newNode];
      }
    });

    // 4. LIMPA OS ESTADOS E FECHA O MODAL
    setIsAdding(false);
    setEditingNodeId(null);
    setNewTitle(''); setNewContent(''); setNewTags(''); setNewImageUrl(''); setNewLinkUrl('');
  };

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
                  data: { 
                    title: sessionName, 
                    onResizeEnd: handleResizeEnd,
                    onEditSession: handleEditSession,
                    onToggleExpand: handleToggleExpand
                  }, // Passa a função
                  style: { width: 500, height: 400 },
                  zIndex: -200
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
          onNodeResizeStop={onNodeResizeStop}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onEdgeDoubleClick={onEdgeDoubleClick}
          fitView
          minZoom={0.05}
          maxZoom={4}
          connectionMode="loose"
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
            <input type="text" placeholder="URL da Imagem (Ex: https://...)" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} />
            <input type="text" placeholder="Link de Referência (Ex: https://...)" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} />
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
      {/* MODAL DE EDIÇÃO DE CONEXÃO (LINHA) */}
      {isEditingEdge && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e24', width: '350px', padding: '24px', borderRadius: '8px', border: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Estilo da Conexão</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af', width: '80px' }}>Cor:</label>
              <input type="color" value={edgeColor} onChange={(e) => setEdgeColor(e.target.value)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '30px', flex: 1 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af', width: '80px' }}>Espessura: {edgeThickness}px</label>
              <input type="range" min="1" max="10" value={edgeThickness} onChange={(e) => setEdgeThickness(Number(e.target.value))} style={{ flex: 1 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setIsEditingEdge(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={async () => {
                await supabase.from('connections').update({ color: edgeColor, thickness: edgeThickness }).eq('id', editingEdgeId);
                
                // MÁGICA DA COR: Atualiza o 'style' junto com o 'data'
                setEdges((eds) => eds.map((e) => e.id === editingEdgeId ? { 
                  ...e, 
                  data: { ...e.data, color: edgeColor, thickness: edgeThickness },
                  style: { ...e.style, stroke: edgeColor, strokeWidth: edgeThickness } 
                } : e));
                
                setIsEditingEdge(false);
              }} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
