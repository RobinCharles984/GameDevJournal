'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import ReactFlow, { Background, Controls, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, Node, Edge, addEdge, Connection, ConnectionMode } from 'reactflow';
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
  const [sidebarTab, setSidebarTab] = useState<'tips' | 'sessions'>('tips');

  // Estados para Edição da Sessão
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionEditTitle, setSessionEditTitle] = useState('');
  const [sessionEditColor, setSessionEditColor] = useState('#3b82f6');

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const router = useRouter();

  // =======================================================================
  // CARREGA A BARRA LATERAL (MEUS TEMPLATES / BLUEPRINTS)
  // =======================================================================
  useEffect(() => {
    const fetchSidebarTemplates = async () => {
      // Busca apenas os nós que são marcados como template E que são "Raízes" (não têm pai)
      const { data: templates } = await supabase
        .from('tips')
        .select('*')
        .eq('is_template', true)
        .is('parent_id', null) // <--- O filtro mágico que esconde os filhos soltos!
        .eq('user_id', userId);

      if (templates) {
        setSavedTipsList(templates);
      }
    };

    // Só roda se tivermos o userId válido
    if (userId) {
      fetchSidebarTemplates();
    }
  }, [userId]);

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

  const handleEditSession = (id: string, currentTitle: string, currentColor: string) => {
    setEditingSessionId(id);
    setSessionEditTitle(currentTitle);
    setSessionEditColor(currentColor || '#3b82f6');
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

  const saveSessionEdit = async () => {
    if (!editingSessionId) return;

    // 1. Atualiza na Tela instantaneamente
    setNodes((nds) => nds.map((n) => n.id === editingSessionId ? { 
      ...n, 
      data: { ...n.data, title: sessionEditTitle, color: sessionEditColor } 
    } : n));

    // 2. Salva no Banco de Dados (Supabase)
    await supabase
      .from('tips')
      .update({ title: sessionEditTitle, color: sessionEditColor })
      .eq('id', editingSessionId);

    // 3. Fecha o modal
    setIsEditingSession(false);
    setEditingSessionId(null);
  };

  const handleDeleteNode = async (nodeId: string) => {
    // 1. Descobre quem é o pai e quais são os filhos (Antes de apagar qualquer coisa)
    let idsToDelete = [nodeId];
    let isSession = false;

    setNodes(nds => {
      const parentNode = nds.find(n => n.id === nodeId);
      if (parentNode && parentNode.type === 'sessionNode') isSession = true;

      const getChildren = (id: string): string[] => {
        const children = nds.filter(n => n.parentNode === id).map(n => n.id);
        return children.reduce((acc, child) => [...acc, child, ...getChildren(child)], children);
      };
      
      const childrenIds = getChildren(nodeId);
      idsToDelete = [...idsToDelete, ...childrenIds];
      return nds; // Apenas espiona, não muda a tela ainda!
    });

    // Se for uma Sessão, executa o plano de Aniquilação (Tudo Some!)
    if (isSession) {
        // 1. Apaga conexões locais na tela
        setEdges(eds => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));
        // 2. Apaga TODO MUNDO (Pai e Filhos) da tela instantaneamente
        setNodes(nds => nds.filter(n => !idsToDelete.includes(n.id)));
        
        // 3. Limpeza Cascata no Banco (Sem esperar terminar)
        supabase.from('tip_connections').delete().in('source_tip_id', idsToDelete).then();
        supabase.from('tip_connections').delete().in('target_tip_id', idsToDelete).then();
        supabase.from('tips').delete().in('id', idsToDelete).then();
        return; 
    }

    // Se for apenas uma Tip normal...
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    
    supabase.from('tip_connections').delete().eq('source_tip_id', nodeId).then();
    supabase.from('tip_connections').delete().eq('target_tip_id', nodeId).then();
    supabase.from('tips').delete().eq('id', nodeId).then();
  };

  const handleEditNode = (id: string, title: string, content: string, tags: string[], imageUrl: string, linkUrl: string) => {
    setEditingNodeId(id); setNewTitle(title); setNewContent(content); 
    setNewTags(tags.join(', ')); setNewImageUrl(imageUrl); setNewLinkUrl(linkUrl); 
    setIsAdding(true);
  };

  // UTILITY: Gerador de ID blindado que funciona em qualquer navegador/ambiente
  const generateSafeId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleSaveTemplate = async (nodeId: string) => {
    let currentNodes: Node[] = [];
    let currentEdges: Edge[] = [];
    setNodes(nds => { currentNodes = nds; return nds; });
    setEdges(eds => { currentEdges = eds; return eds; });

    const rootNode = currentNodes.find(n => n.id === nodeId);
    if (!rootNode) return;

    const getDescendants = (parentId: string): Node[] => {
      const children = currentNodes.filter(n => n.parentNode === parentId);
      return children.reduce((acc, child) => [...acc, child, ...getDescendants(child.id)], children);
    };

    const rawNodesToSave = [rootNode, ...getDescendants(nodeId)];
    
    // BLINDAGEM 1: Remove duplicatas caso a árvore tenha referências circulares
    const uniqueNodesToSave = Array.from(new Map(rawNodesToSave.map(n => [n.id, n])).values());
    const oldIds = uniqueNodesToSave.map(n => n.id);

    const edgesToSave = currentEdges.filter(e => oldIds.includes(e.source) && oldIds.includes(e.target));

    const idMap: Record<string, string> = {};
    // BLINDAGEM 2: O crypto.randomUUID() é nativo do Next.js e 100% seguro contra colisões
    oldIds.forEach(id => idMap[id] = generateSafeId());

    const dbNodes = uniqueNodesToSave.map(n => {
      const isSess = n.type === 'sessionNode';
      
      const rawWidth = n.style?.width || n.width || 500;
      const rawHeight = n.style?.height || n.height || 400;
      const safeWidth = isSess ? (Math.round(Number(String(rawWidth).replace('px', ''))) || 500) : null;
      const safeHeight = isSess ? (Math.round(Number(String(rawHeight).replace('px', ''))) || 400) : null;

      return {
        id: idMap[n.id],
        title: n.data?.title || 'Sem Título',
        content: n.data?.content || '',
        user_id: userId,
        project_id: projectId,
        is_template: true,
        node_type: n.type || 'customTip',
        width: safeWidth,
        height: safeHeight,
        color: n.data?.color || '#3b82f6',
        image_url: n.data?.imageUrl || '',
        link_url: n.data?.linkUrl || '',
        parent_id: n.id === rootNode.id ? null : (idMap[n.parentNode as string] || null), 
        position_x: Math.round(n.position.x || 0),
        position_y: Math.round(n.position.y || 0)
      };
    });

    const dbEdges = edgesToSave.map(e => ({
      id: generateSafeId(),
      source_tip_id: idMap[e.source],
      target_tip_id: idMap[e.target],
      source_handle: e.sourceHandle || null, 
      target_handle: e.targetHandle || null,
      color: e.data?.color || '#9ca3af',
      thickness: Math.round(Number(e.data?.thickness || 2))
    }));

    // Inserção no banco
    const { error: errNodes } = await supabase.from('tips').insert(dbNodes);
    if (dbEdges.length > 0) await supabase.from('tip_connections').insert(dbEdges);

    if (!errNodes) {
      const rootDbNode = dbNodes.find(n => n.id === idMap[rootNode.id]);
      if (rootDbNode) setSavedTipsList(prev => [...prev, rootDbNode as any]);
      alert(rootNode.type === 'sessionNode' ? 'Blueprint da Sessão salvo com sucesso!' : 'Tip salva como template!');
    } else {
      console.error('Erro ao empacotar:', errNodes.message || errNodes);
      alert('Erro ao empacotar o template. Verifique o console.');
    }
  };

  const handleRemoveTemplate = async (templateId: string) => {
    // 1. Puxa os dados para saber se é uma sessão que tem filhos
    const { data: descendants } = await supabase.from('tips').select('id').eq('parent_id', templateId);
    const idsToDelete = [templateId, ...(descendants?.map(d => d.id) || [])];

    // 2. Apaga as conexões amarradas a eles, e depois apaga eles mesmos
    await supabase.from('tip_connections').delete().in('source_tip_id', idsToDelete);
    await supabase.from('tip_connections').delete().in('target_tip_id', idsToDelete);
    await supabase.from('tips').delete().in('id', idsToDelete);

    // 3. O TRUQUE: Remove apenas o item da tela localmente. 
    // NÃO faça um novo select() no banco aqui, senão as Tips vazam!
    setSavedTipsList(prev => prev.filter(t => t.id !== templateId));
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
    const loadGraphData = async () => {
    try {
      // 1. BUSCA AS TIPS E SESSÕES DO PROJETO (Ignorando templates da barra lateral)
      const { data: tipsData } = await supabase
        .from('tips')
        .select(`id, title, content, position_x, position_y, node_type, width, height, color, parent_id, image_url, link_url, tip_tags ( tags ( name ) )`)
        .eq('project_id', projectId)
        .eq('is_template', false);

      // === LISTA DE IDs VÁLIDOS ===
      const validIds = new Set((tipsData || []).map((t: any) => t.id));

      // === MONTA OS NÓS (initialNodes) ===
      const initialNodes: Node[] = (tipsData || []).map((tip: any) => {
        const tagList = tip.tip_tags?.map((tt: any) => tt.tags?.name).filter(Boolean) || [];
        const isSession = tip.node_type === 'sessionNode';

        let zIdx = 10;
        if (isSession) {
          const w = tip.width || 500;
          const h = tip.height || 400;
          zIdx = -Math.round((w * h) / 1000);
        }

        const safeParentId = tip.parent_id && validIds.has(tip.parent_id) ? tip.parent_id : undefined;

        return {
          id: tip.id,
          type: tip.node_type || 'customTip',
          parentNode: safeParentId,
          zIndex: zIdx,
          data: { 
            title: tip.title, 
            content: tip.content,
            tags: tagList,
            color: tip.color, 
            imageUrl: tip.image_url,
            linkUrl: tip.link_url,
            onDelete: handleDeleteNode,
            onEdit: handleEditNode,
            onSaveTemplate: handleSaveTemplate,
            onResizeEnd: handleResizeEnd,
            onEditSession: handleEditSession,
            onToggleExpand: handleToggleExpand,
          },
          position: { 
            x: tip.position_x !== null ? tip.position_x : 250, 
            y: tip.position_y !== null ? tip.position_y : 150 
          },
          style: tip.width && tip.height ? { width: tip.width, height: tip.height } : undefined,
        };
      });

      // === MONTA AS CONEXÕES (initialEdges) ===
      const validTipIds = tipsData ? tipsData.map((t: any) => t.id) : [];
      let initialEdges: Edge[] = [];

      if (validTipIds.length > 0) {
        const { data: connectionsData } = await supabase
          .from('tip_connections')
          .select('*')
          .in('source_tip_id', validTipIds); 

        initialEdges = (connectionsData || []).map((conn: any) => ({
          id: conn.id,
          source: conn.source_tip_id,
          target: conn.target_tip_id,
          sourceHandle: conn.source_handle, // Lê do banco
          targetHandle: conn.target_handle, // Lê do banco
          animated: true,                   // <-- DEVOLVE A ANIMAÇÃO DAS BOLINHAS!
          interactionWidth: 20,
          data: { color: conn.color, thickness: conn.thickness },
          style: { stroke: conn.color || '#9ca3af', strokeWidth: conn.thickness || 2 }
        }));
      }

      // === ATUALIZA A TELA (Tudo dentro do mesmo bloco try!) ===
      setNodes(initialNodes);
      setEdges(initialEdges);

    } catch (error) {
      console.error("Erro ao carregar os dados:", error);
    }
  };
    loadGraphData();
  }, [supabase, projectId, loadSidebarTemplates]);

  // ==========================================
  // FUNÇÕES DO REACT FLOW (Mudanças e Ligações)
  // ==========================================
  const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback(async (params: any) => {
    // 1. Gera um ID Oficial antes de tudo!
    const edgeId = generateSafeId(); 

    // 2. Cria a linha na tela USANDO O ID OFICIAL
    const newEdge = { 
      ...params, 
      id: edgeId, // <-- O SEGREDO ESTÁ AQUI
      animated: true, 
      style: { stroke: '#9ca3af', strokeWidth: 2 } 
    };
    setEdges((eds) => addEdge(newEdge, eds));

    // 3. Salva no banco USANDO O MESMO ID OFICIAL
    const { error } = await supabase.from('tip_connections').insert([{
      id: edgeId, // <-- GARANTE A SINCRONIA
      source_tip_id: params.source,
      target_tip_id: params.target,
      source_handle: params.sourceHandle, 
      target_handle: params.targetHandle, 
      color: '#9ca3af',
      thickness: 2
    }]);

    if (error) console.error("Erro ao salvar conexão física:", error.message || error);
  }, [setEdges]);

  // Essa função é chamada automaticamente quando você aperta a tecla DELETE no teclado
  const onNodesDelete = async (deletedNodes: Node[]) => {
    // Quando o usuário dá Delete pelo teclado, o React Flow já apaga visualmente por padrão!
    // Então, nossa única função aqui é limpar a sujeira no banco de dados.
    
    const idsToDelete = deletedNodes.map(n => n.id);
    if (idsToDelete.length === 0) return;

    // Dispara a ordem de exclusão no Supabase (ON CASCADE Manual)
    // O .then() faz a execução ir pro background, evitando travamentos na tela.
    supabase.from('tip_connections').delete().in('source_tip_id', idsToDelete).then();
    supabase.from('tip_connections').delete().in('target_tip_id', idsToDelete).then();
    supabase.from('tips').delete().in('id', idsToDelete).then();
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

  const onDrop = useCallback(async (event: any) => {
    event.preventDefault();
    const tipDataString = event.dataTransfer.getData('application/reactflow');
    if (!tipDataString) return;
    
    const rootTemplate = JSON.parse(tipDataString);

    // Calcula onde o mouse soltou
    const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
    let position = { x: event.clientX, y: event.clientY };
    if (reactFlowInstance && reactFlowBounds) {
      position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });
    }

    // 1. Busca TODO O ECOSSISTEMA de templates do usuário
    const { data: allTemplates } = await supabase.from('tips').select('*').eq('is_template', true).eq('user_id', userId);
    const { data: allTemplateEdges } = await supabase.from('tip_connections').select('*');

    // 2. Extrai da árvore apenas quem pertence à Sessão
    const getTemplateDescendants = (parentId: string, list: any[]): any[] => {
      const children = list.filter(t => t.parent_id === parentId);
      return children.reduce((acc, child) => [...acc, child, ...getTemplateDescendants(child.id, list)], children);
    };

    const descendants = getTemplateDescendants(rootTemplate.id, allTemplates || []);
    const rawNodesToInstantiate = [rootTemplate, ...descendants];
    
    // BLINDAGEM ANTI-CRASH: Remove qualquer duplicata acidental da memória
    const nodesToInstantiate = Array.from(new Map(rawNodesToInstantiate.map(n => [n.id, n])).values());
    const oldIds = nodesToInstantiate.map(n => n.id);

    // 3. Pega as conexões
    const templateEdges = (allTemplateEdges || []).filter(e => oldIds.includes(e.source_tip_id) && oldIds.includes(e.target_tip_id));

    // 4. Mapeia IDs novos usando nossa ferramenta de ID seguro
    const idMap: Record<string, string> = {};
    oldIds.forEach(id => idMap[id] = generateSafeId()); // <-- AGORA USA A FERRAMENTA SEGURA

    // 5. Prepara os Nós para existir de verdade no projeto atual
    const dbNodesToInsert = nodesToInstantiate.map(t => ({
      id: idMap[t.id],
      title: t.title,
      content: t.content,
      user_id: userId,
      project_id: Number(projectId), // Vincula ao projeto ativo
      is_template: false,    // NÃO É MAIS TEMPLATE, É NÓ ATIVO!
      node_type: t.node_type,
      width: t.width,
      height: t.height,
      color: t.color,
      image_url: t.image_url,
      link_url: t.link_url,
      parent_id: t.id === rootTemplate.id ? null : idMap[t.parent_id], // Raiz é livre, filhos ficam presos nela
      // O truque da física: A raiz nasce onde o mouse tá. Os filhos usam posição relativa (local)!
      position_x: t.id === rootTemplate.id ? Math.round(position.x) : t.position_x,
      position_y: t.id === rootTemplate.id ? Math.round(position.y) : t.position_y
    }));

    // 6. Prepara as conexões reais lendo os pinos do pacote
    const dbEdgesToInsert = templateEdges.map(e => ({
      id: generateSafeId(),
      source_tip_id: idMap[e.source_tip_id],
      target_tip_id: idMap[e.target_tip_id],
      // === NOVO: Puxa os pinos do pacote do banco ===
      source_handle: e.source_handle,
      target_handle: e.target_handle,
      color: e.color,
      thickness: e.thickness
    }));

    const { error: dropError } = await supabase.from('tips').insert(dbNodesToInsert);
    
    if (dropError) {
      console.error("⛔ Erro fatal ao soltar a Sessão no mapa:", dropError.message || dropError);
      alert("Erro ao salvar no banco! Abra o Console (F12) para ver o motivo.");
      return; 
    }

    if (dbEdgesToInsert.length > 0) {
      await supabase.from('tip_connections').insert(dbEdgesToInsert);
    }

    // Renderiza os nós na tela instantaneamente
    const newReactNodes: Node[] = dbNodesToInsert.map(n => {
      const isSess = n.node_type === 'sessionNode';
      let zIdx = 10;
      if (isSess) zIdx = -Math.round(((n.width || 500) * (n.height || 400)) / 1000); 
      
      return {
        id: n.id as string,
        type: n.node_type || 'customTip',
        position: { x: n.position_x, y: n.position_y },
        parentNode: (n.parent_id as string) || undefined,
        zIndex: zIdx,
        data: {
          title: n.title, content: n.content, color: n.color, imageUrl: n.image_url, linkUrl: n.link_url,
          onDelete: handleDeleteNode, onEdit: handleEditNode, onSaveTemplate: handleSaveTemplate,
          onResizeEnd: handleResizeEnd, onEditSession: handleEditSession, onToggleExpand: handleToggleExpand
        },
        style: isSess && n.width && n.height ? { width: n.width, height: n.height } : undefined
      };
    });
    
    // Renderiza as linhas na tela, agora COM OS PINOS E ANIMAÇÃO!
    const newReactEdges: Edge[] = dbEdgesToInsert.map(e => ({
      id: e.id, 
      source: e.source_tip_id as string, 
      target: e.target_tip_id as string, 
      // === NOVO: Injeta no React Flow (O as string | null acalma o TypeScript) ===
      sourceHandle: e.source_handle as string | null,
      targetHandle: e.target_handle as string | null,
      animated: true, // DEVOLVE A ANIMAÇÃO!
      interactionWidth: 20, 
      data: { color: e.color, thickness: e.thickness },
      style: { stroke: e.color || '#9ca3af', strokeWidth: e.thickness || 2 }
    }));

    setNodes(nds => nds.concat(newReactNodes));
    setEdges(eds => eds.concat(newReactEdges));
  }, [reactFlowInstance, projectId, userId]); // Fim da função onDrop

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
                    onToggleExpand: handleToggleExpand,
                    onSaveTemplate: handleSaveTemplate
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

        {/* === NOVO: SISTEMA DE ABAS === */}
        <div style={{ display: 'flex', gap: '4px', background: '#121212', padding: '4px', borderRadius: '6px', marginBottom: '8px' }}>
          <button 
            onClick={() => setSidebarTab('tips')}
            style={{ flex: 1, padding: '8px', background: sidebarTab === 'tips' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: '0.2s' }}
          >
            Tips ⭐
          </button>
          <button 
            onClick={() => setSidebarTab('sessions')}
            style={{ flex: 1, padding: '8px', background: sidebarTab === 'sessions' ? '#eab308' : 'transparent', color: sidebarTab === 'sessions' ? '#000' : '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: '0.2s' }}
          >
            Sessões 📦
          </button>
        </div>

        {/* LISTA FILTRADA DE TEMPLATES SALVOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }} className="custom-scroll">
          {savedTipsList
            .filter(tip => sidebarTab === 'tips' ? tip.node_type !== 'sessionNode' : tip.node_type === 'sessionNode')
            .map((tip) => (
              <div key={tip.id} style={{ position: 'relative' }}>
                
                <button onClick={() => handleRemoveTemplate(tip.id)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer', zIndex: 11 }}>X</button>

                <div 
                  draggable 
                  onDragStart={(e) => onDragStart(e, tip)}
                  style={{ 
                    background: '#1e1e24', padding: '12px', borderRadius: '8px', cursor: 'grab', color: '#fff',
                    // Muda a borda para refletir visualmente se é Tip (Azul) ou Sessão (Amarelo)
                    border: tip.node_type === 'sessionNode' ? '1px dashed #eab308' : '1px solid #333' 
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '8px', color: tip.node_type === 'sessionNode' ? '#eab308' : '#3b82f6' }}>{tip.title}</strong>
                  
                  {/* Se for sessão, mostra as dimensões, senão mostra o conteúdo */}
                  {tip.node_type === 'sessionNode' ? (
                    <div style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', gap: '8px' }}>
                      <span>Tamanho: {tip.width}x{tip.height}</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {tip.content || 'Sem descrição...'}
                    </div>
                  )}
                </div>
              </div>
          ))}
        </div>
      </div>

      {/* CENTRO: React Flow Workspace */}
      <div style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          onInit={setReactFlowInstance}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          //onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
          onEdgeDoubleClick={onEdgeDoubleClick}
          fitView
          minZoom={0.05}
          maxZoom={4}
          connectionMode={ConnectionMode.Loose}
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
                // ATENÇÃO: Nome da tabela atualizado para tip_connections
                await supabase.from('tip_connections').update({ color: edgeColor, thickness: edgeThickness }).eq('id', editingEdgeId);
                
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
      {/* MODAL DE EDIÇÃO DE SESSÃO */}
      {isEditingSession && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e24', width: '350px', padding: '24px', borderRadius: '8px', border: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Editar Sessão</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af' }}>Título da Sessão:</label>
              <input 
                type="text" 
                value={sessionEditTitle} 
                onChange={(e) => setSessionEditTitle(e.target.value)} 
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} 
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af', width: '80px' }}>Cor:</label>
              <input 
                type="color" 
                value={sessionEditColor} 
                onChange={(e) => setSessionEditColor(e.target.value)} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', height: '30px', flex: 1 }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button 
                onClick={() => setIsEditingSession(false)} 
                style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={saveSessionEdit} 
                style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
