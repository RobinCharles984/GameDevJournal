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

  // Estados para a Playlist de Templates
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [nodeIdToSave, setNodeIdToSave] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState('');

  // Estados do "CTRL+F" no Mapa
  const [mapSearch, setMapSearch] = useState('');
  const [searchMatches, setSearchMatches] = useState<Node[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Estados do Agent Charles
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string>('');

  const router = useRouter();

  // Estado para controlar quais playlists estão recolhidas (fechadas)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  // Função para alternar entre abrir e fechar a pasta
  const toggleFolder = (folderName: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName] // Se era true vira false, se era false vira true
    }));
  };

  // =======================================================================
  // CARREGA A BARRA LATERAL (MEUS TEMPLATES / BLUEPRINTS)
  // =======================================================================
  useEffect(() => {
    const fetchSidebarTemplates = async () => {
      const { data: templates } = await supabase
        .from('tips')
        // MÁGICA: Agora puxamos TUDO, idêntico à função de carregamento principal!
        .select(`id, title, content, position_x, position_y, node_type, width, height, color, parent_id, image_url, link_url, playlist, tip_tags ( tags ( name ) ), is_template`)
        .eq('is_template', true)
        .is('parent_id', null)
        .eq('user_id', userId);

      if (templates) setSavedTipsList(templates);
    };

    // Só roda se tivermos o userId válido
    if (userId) {
      fetchSidebarTemplates();
    }
  }, [userId]);

  // ==========================================
  // FUNÇÕES Do AGENT
  // ==========================================
  // Essa função varre a tela e monta o pacote para enviar para a IA  
  const compileProjectDataForAI = () => {
    // 1. Pega as Sessões (As caixas maiores)
    const sessions = nodes.filter(n => n.type === 'sessionNode').map(s => ({
      id: s.id,
      title: s.data.title || 'Sessão Sem Nome'
    }));

    // 2. Pega as Tips (Os cartões menores de conteúdo)
    const tips = nodes.filter(n => n.type !== 'sessionNode').map(t => {
      // Descobre se a Tip está dentro de alguma sessão
      const parentSession = sessions.find(s => s.id === t.parentNode);
      
      return {
        titulo: t.data.title,
        conteudo: t.data.content,
        tags: t.data.tags || [],
        pertence_a_sessao: parentSession ? parentSession.title : 'Ideia Solta no Mapa'
      };
    });

    // 3. Mapeia as conexões (Quem liga em quem)
    const relationships = edges.map(e => {
      const sourceNode = nodes.find(n => n.id === e.source);
      const targetNode = nodes.find(n => n.id === e.target);
      return `${sourceNode?.data.title || 'Desconhecido'} ---> conecta com ---> ${targetNode?.data.title || 'Desconhecido'}`;
    });

    // Retorna tudo como um JSON formatado em texto para a IA ler
    return JSON.stringify({
      resumo_do_projeto: "Mapa Estrutural do Jogo",
      mecanicas_e_narrativas: tips,
      fluxo_de_logica: relationships
    }, null, 2);
  };

  const handleAnalyzeProject = async () => {
    setIsAnalyzing(true);
    setAiFeedback(''); // Limpa o log anterior

    const payload = compileProjectDataForAI(); // Sua função que varre os nós

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectData: payload })
      });

      const data = await response.json();
      
      // Salva o texto Markdown devolvido pela IA
      if (data.feedback) {
        setAiFeedback(data.feedback);
      } else {
        setAiFeedback('Erro: O Agent retornou um formato inesperado.');
      }
      
    } catch (error) {
      console.error("Falha na API:", error);
      setAiFeedback('Erro ao estabelecer conexão com o núcleo de análise.');
    } finally {
      setIsAnalyzing(false);
    }
  };

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
    let idsToDelete: string[] = [];

    // 1. Mapeia TODOS os IDs (Pai e Filhos) e remove da tela instantaneamente
    setNodes(nds => {
      const getDescendants = (id: string): string[] => {
        const children = nds.filter(n => n.parentNode === id).map(n => n.id);
        return children.reduce((acc, child) => [...acc, child, ...getDescendants(child)], children);
      };
      
      idsToDelete = [nodeId, ...getDescendants(nodeId)];
      
      // O Segredo: Retorna a lista já filtrada, aniquilando todos ao mesmo tempo
      return nds.filter(n => !idsToDelete.includes(n.id));
    });

    // 2. Remove as linhas da tela
    setEdges(eds => eds.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target)));

    // 3. Limpa o banco de dados silenciosamente
    if (idsToDelete.length > 0) {
      supabase.from('tip_connections').delete().in('source_tip_id', idsToDelete).then();
      supabase.from('tip_connections').delete().in('target_tip_id', idsToDelete).then();
      supabase.from('tips').delete().in('id', idsToDelete).then();
    }
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

  const handleSaveTemplate = (nodeId: string) => {
    setNodeIdToSave(nodeId);
    setPlaylistName(''); // Zera para o próximo
    setIsSavingTemplate(true);
  };

  const executeSaveTemplate = async () => {
    if (!nodeIdToSave) return;
    
    let currentNodes: Node[] = [];
    let currentEdges: Edge[] = [];
    setNodes(nds => { currentNodes = nds; return nds; });
    setEdges(eds => { currentEdges = eds; return eds; });

    const rootNode = currentNodes.find(n => n.id === nodeIdToSave);
    if (!rootNode) return;

    const getDescendants = (parentId: string): Node[] => {
      const children = currentNodes.filter(n => n.parentNode === parentId);
      return children.reduce((acc, child) => [...acc, child, ...getDescendants(child.id)], children);
    };

    const rawNodesToSave = [rootNode, ...getDescendants(nodeIdToSave)];
    const uniqueNodesToSave = Array.from(new Map(rawNodesToSave.map(n => [n.id, n])).values());
    const oldIds = uniqueNodesToSave.map(n => n.id);
    const edgesToSave = currentEdges.filter(e => oldIds.includes(e.source) && oldIds.includes(e.target));

    const idMap: Record<string, string> = {};
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
        position_y: Math.round(n.position.y || 0),
        // === NOVO: Grava a playlist no nó principal do pacote ===
        playlist: n.id === rootNode.id ? (playlistName.trim() || null) : null
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

    // Fecha o modal
    setIsSavingTemplate(false);
    setPlaylistName('');
    setNodeIdToSave(null);
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
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    const idsToDelete = deletedNodes.map(n => n.id);
    if (idsToDelete.length === 0) return;

    supabase.from('tip_connections').delete().in('source_tip_id', idsToDelete).then();
    supabase.from('tip_connections').delete().in('target_tip_id', idsToDelete).then();
    supabase.from('tips').delete().in('id', idsToDelete).then();
  }, []);

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
    if (!reactFlowInstance) return;

    const data = event.dataTransfer.getData('application/reactflow');
    if (!data) return;
    const rootTemplate = JSON.parse(data);

    // === MÁGICA 1: PEGA A COORDENADA EXATA DO MOUSE ===
    const dropPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    // Calcula a diferença entre onde o pacote estava salvo e onde o mouse está agora
    const deltaX = dropPosition.x - rootTemplate.position_x;
    const deltaY = dropPosition.y - rootTemplate.position_y;

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

    // 5. Prepara os Nós (MÁGICA: Só movemos o nó raiz principal, os filhos viajam de carona!)
    const dbNodesToInsert = nodesToInstantiate.map(t => {
      const isRoot = t.id === rootTemplate.id; // Descobre se é o "Pai" do pacote

      return {
        id: idMap[t.id],
        title: t.title,
        content: t.content,
        user_id: userId,
        project_id: Number(projectId),
        is_template: false,
        node_type: t.node_type || 'customTip',
        width: t.width,
        height: t.height,
        color: t.color,
        image_url: t.image_url,
        link_url: t.link_url,
        parent_id: isRoot ? null : (idMap[t.parent_id] || null),
        
        // Aplica o Delta (mouse) SÓ no Pai. Filhos usam a coordenada interna pura.
        position_x: isRoot ? Math.round(t.position_x + deltaX) : t.position_x,
        position_y: isRoot ? Math.round(t.position_y + deltaY) : t.position_y
      };
    });

    // 6. Prepara as conexões reais lendo os pinos do pacote
    const dbEdgesToInsert = templateEdges.map(e => ({
      id: generateSafeId(),
      source_tip_id: idMap[e.source_tip_id],
      target_tip_id: idMap[e.target_tip_id],
      source_handle: e.source_handle,
      target_handle: e.target_handle,
      color: e.color,
      thickness: e.thickness
    }));

    // 7. INSERE NO BANCO E RASTREIA ERROS
    const { error: dropError } = await supabase.from('tips').insert(dbNodesToInsert);
    
    if (dropError) {
      console.error("⛔ Erro fatal ao soltar a Sessão no mapa:", dropError.message || dropError);
      alert("Erro ao salvar no banco! Abra o Console (F12) para ver o motivo.");
      return; 
    }

    if (dbEdgesToInsert.length > 0) {
      await supabase.from('tip_connections').insert(dbEdgesToInsert);
    }

    // 8. Renderiza os nós na tela instantaneamente
    const newReactNodes: Node[] = nodesToInstantiate.map(t => {
      const isSess = t.node_type === 'sessionNode';
      const isRoot = t.id === rootTemplate.id; // Descobre se é o "Pai" do pacote
      
      let zIdx = 10;
      if (isSess) zIdx = -Math.round(((t.width || 500) * (t.height || 400)) / 1000); 
      
      const tagList = t.tip_tags?.map((tt: any) => tt.tags?.name).filter(Boolean) || [];

      return {
        id: idMap[t.id] as string, 
        type: t.node_type || 'customTip',
        
        // A MESMA MÁGICA VISUAL: Delta só no pai!
        position: { 
          x: isRoot ? Math.round(t.position_x + deltaX) : t.position_x, 
          y: isRoot ? Math.round(t.position_y + deltaY) : t.position_y 
        },
        
        parentNode: isRoot ? undefined : (idMap[t.parent_id] as string), 
        zIndex: zIdx,
        data: {
          title: t.title, 
          content: t.content, 
          color: t.color, 
          imageUrl: t.image_url, 
          linkUrl: t.link_url,
          tags: tagList, 
          onDelete: handleDeleteNode, 
          onEdit: handleEditNode, 
          onSaveTemplate: handleSaveTemplate,
          onResizeEnd: handleResizeEnd, 
          onEditSession: handleEditSession, 
          onToggleExpand: handleToggleExpand
        },
        style: isSess && t.width && t.height ? { width: t.width, height: t.height } : undefined
      };
    });
    
    // Renderiza as linhas na tela com os pinos e animação
    const newReactEdges: Edge[] = dbEdgesToInsert.map(e => ({
      id: e.id, 
      source: e.source_tip_id as string, 
      target: e.target_tip_id as string, 
      sourceHandle: e.source_handle as string | null,
      targetHandle: e.target_handle as string | null,
      animated: true,
      interactionWidth: 20, 
      data: { color: e.color, thickness: e.thickness },
      style: { stroke: e.color || '#9ca3af', strokeWidth: e.thickness || 2 }
    }));

    setNodes(nds => nds.concat(newReactNodes));
    setEdges(eds => eds.concat(newReactEdges));
  }, [reactFlowInstance, projectId, userId]); // Fim da função onDrop

  // RADAR DA CÂMERA: Acha o centro exato da tela atual do usuário
  const getCenterSpawnPosition = () => {
    if (!reactFlowInstance) return { x: 250, y: 150 }; // Fallback seguro
    
    // Pega o meio da tela do navegador
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Converte os pixels da tela para as coordenadas infinitas do mapa
    return reactFlowInstance.screenToFlowPosition({ x: centerX, y: centerY });
  };

  // ==========================================
  // SALVAR / EDITAR MODAL
  // ==========================================
  const handleSaveTip = async () => {
    let currentTipId = editingNodeId;
    const spawnPos = getCenterSpawnPosition();

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
          position: { x: spawnPos.x - 125, y: spawnPos.y - 50},
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

  // ==========================================
  // Barra de Pesquisa no Workspace
  // ==========================================
  // Procura os nós no mapa e foca no primeiro
  const handleMapSearch = (query: string) => {
    setMapSearch(query);
    if (!query.trim()) {
      setSearchMatches([]);
      return;
    }
    
    const matches = nodes.filter(n => 
      n.data?.title?.toLowerCase().includes(query.toLowerCase()) ||
      n.data?.content?.toLowerCase().includes(query.toLowerCase())
    );
    
    setSearchMatches(matches);
    setCurrentMatchIndex(0);

    // MÁGICA AQUI: "as Node" acalma o TypeScript
    if (matches.length > 0) focusOnNode(matches[0] as Node); 
  };

  // Anima a câmera do React Flow até o nó
  const focusOnNode = (node: Node) => {
    if (!reactFlowInstance) return;
    
    // Foca a câmera no nó com animação de 800ms
    reactFlowInstance.fitView({ 
      nodes: [{ id: node.id }], 
      duration: 800, 
      maxZoom: 1.2 
    });

    // Destaca o nó selecionando ele (fica com a bordinha branca nativa)
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === node.id })));
  };

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIndex);
    focusOnNode(searchMatches[nextIndex] as Node); // <-- AQUI
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIndex);
    focusOnNode(searchMatches[prevIndex] as Node); // <-- E AQUI
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
        
        <h3 style={{ color: '#fff', margin: 0 }}>Biblioteca</h3>

        {/* BARRA DE PESQUISA DA BIBLIOTECA */}
        <input 
          type="text" 
          placeholder="Pesquisar salvos..." 
          value={sidebarSearch}
          onChange={(e) => setSidebarSearch(e.target.value)}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff', width: '100%' }} 
        />

        {/* LISTA FILTRADA DE TEMPLATES SALVOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }} className="custom-scroll">
          {/* LÓGICA DE AGRUPAMENTO COM PASTAS RETRÁTEIS */}
        {Object.entries(
          savedTipsList
            .filter(template => {
              if (sidebarTab === 'sessions') return template.node_type === 'sessionNode';
              return template.node_type !== 'sessionNode';
            })
            .filter(template => template.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
            .reduce((acc, template) => {
              const folder = template.playlist || 'Itens Soltos';
              if (!acc[folder]) acc[folder] = [];
              acc[folder].push(template);
              return acc;
            }, {} as Record<string, any[]>)
        ).map(([folderName, items]: any) => {
          
          // Verifica se esta pasta específica está na lista de "fechadas"
          const isCollapsed = collapsedFolders[folderName];

          return (
            <div key={folderName} style={{ marginBottom: '16px' }}>
              
              {/* TÍTULO DA PLAYLIST (Agora é um botão clicável) */}
              <h4 
                onClick={() => toggleFolder(folderName)}
                style={{ 
                  color: '#fbbf24', 
                  margin: '0 0 8px 0', 
                  fontSize: '14px', 
                  borderBottom: '1px solid #3f3f46', 
                  paddingBottom: '4px',
                  cursor: 'pointer', // Muda o mouse para a mãozinha
                  display: 'flex', 
                  justifyContent: 'space-between', // Joga a setinha pro canto direito
                  alignItems: 'center',
                  userSelect: 'none' // Evita que o texto fique azul de seleção ao clicar rápido
                }}
              >
                <span>{isCollapsed ? '📁' : '📂'} {folderName} ({items.length})</span>
                <span style={{ fontSize: '10px', color: '#9ca3af' }}>{isCollapsed ? '▼' : '▲'}</span>
              </h4>
              
              {/* ITENS DENTRO DA PLAYLIST (Só renderiza se a pasta NÃO estiver fechada) */}
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.map((tip: any) => (
                    <div
                      key={tip.id}
                      draggable
                      onDragStart={(e) => { 
                        e.dataTransfer.setData('application/reactflow', JSON.stringify(tip)); 
                        e.dataTransfer.effectAllowed = 'move'; 
                      }}
                      style={{ 
                        padding: '12px', 
                        background: '#27272a', 
                        borderRadius: '6px', 
                        cursor: 'grab', 
                        borderLeft: tip.node_type === 'sessionNode' ? '4px solid #ef4444' : '4px solid #3b82f6' 
                      }}
                    >
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px' }}>{tip.title}</div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {tip.node_type === 'sessionNode' ? '📦 Pacote de Sessão' : '💡 Tip Avulsa'}
                      </div>
                      <button 
                        onClick={() => handleRemoveTemplate(tip.id)} 
                        style={{ marginTop: '8px', padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', width: '100%' }}
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* CENTRO: React Flow Workspace */}
      <div style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
        {/* BARRA DE PESQUISA FLUTUANTE (CTRL+F) */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px', background: '#1e1e24', padding: '8px', borderRadius: '8px', border: '1px solid #3f3f46', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <input 
            type="text" 
            placeholder="Pesquisar no mapa..." 
            value={mapSearch}
            onChange={(e) => handleMapSearch(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff', outline: 'none' }} 
          />
          
          {searchMatches.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '14px' }}>
              <span>{currentMatchIndex + 1} / {searchMatches.length}</span>
              <button onClick={prevMatch} style={{ background: '#3f3f46', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>▲</button>
              <button onClick={nextMatch} style={{ background: '#3f3f46', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>▼</button>
            </div>
          )}
        </div>
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
          elementsSelectable={true}
          selectionOnDrag={false} // Mantém o clique esquerdo para arrastar a câmera
          selectionKeyCode="Shift" // Segure SHIFT + Clique e Arraste para desenhar a caixa de seleção!
          multiSelectionKeyCode={['Control', 'Meta', 'Shift']} // CTRL ou SHIFT + Clique para selecionar um por um
        >
          {/* Adicionando de volta o fundo pontilhado escuro */}
          <Background color="#555" gap={16} /> 
          <Controls />
        </ReactFlow>
      </div>

      {/* BARRA LATERAL DIREITA: AGENT CONSOLE */}
      <div style={{ width: '350px', background: '#18181b', borderLeft: '1px solid #27272a', display: 'flex', flexDirection: 'column', zIndex: 10 }}>
        
        {/* Header do Agente */}
        <div style={{ padding: '16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e1e24' }}>
          <h3 style={{ color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <span style={{ color: '#a855f7' }}>✧</span> Agent Charles
          </h3>
          <button
            onClick={handleAnalyzeProject}
            disabled={isAnalyzing}
            style={{
              background: isAnalyzing ? '#3f3f46' : '#a855f7',
              color: isAnalyzing ? '#9ca3af' : '#fff',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '12px',
              transition: 'all 0.2s',
              boxShadow: isAnalyzing ? 'none' : '0 4px 15px rgba(168, 85, 247, 0.3)'
            }}
          >
            {isAnalyzing ? 'COMPILANDO...' : 'ANALISAR PROJETO'}
          </button>
        </div>

        {/* Área de Log / Feedback (Scrollável) */}
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto', color: '#d1d5db', fontSize: '14px', lineHeight: '1.6' }}>
          
          {isAnalyzing ? (
            // Tela de Carregamento Estilizada
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#a855f7', gap: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', animation: 'spin 2s linear infinite' }}>⚙️</div>
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>Analisando Game Design...</strong>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>Verificando dependências lógicas e mecânicas</span>
              </div>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
          ) : aiFeedback ? (
            // Resultado da Análise
            <div style={{ 
              whiteSpace: 'pre-wrap', // <-- ISSO É MÁGICA: Mantém as quebras de linha do GPT nativamente!
              wordBreak: 'break-word' 
            }}>
              {aiFeedback}
            </div>
          ) : (
            // Placeholder Inicial (Idle)
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: '#52525b' }}>
              <span style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.5 }}>📊</span>
              <p style={{ margin: 0 }}>O Agent está ocioso.</p>
              <p style={{ fontSize: '12px', marginTop: '8px' }}>Clique em analisar para inspecionar os cartões da workspace e receber um Code Review de Game Design.</p>
            </div>
          )}
          
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
      {/* MODAL DE PLAYLIST */}
      {isSavingTemplate && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e1e24', width: '350px', padding: '24px', borderRadius: '8px', border: '1px solid #3f3f46', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>Salvar nos Favoritos ⭐</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', color: '#9ca3af' }}>Nome da Playlist (Opcional):</label>
              <input 
                type="text" 
                placeholder="Ex: Histórias, Personagens..."
                value={playlistName} 
                onChange={(e) => setPlaylistName(e.target.value)} 
                style={{ padding: '10px', borderRadius: '4px', border: '1px solid #3f3f46', background: '#121212', color: '#fff' }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setIsSavingTemplate(false)} style={{ padding: '8px 16px', background: 'transparent', color: '#9ca3af', border: '1px solid #3f3f46', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={executeSaveTemplate} style={{ padding: '8px 16px', background: '#fbbf24', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE EDIÇÃO DE SESSÃO */}
      {isEditingSession && (
        <div 
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}
          // === ESCUDO ANTI-SEQUESTRO DE FOCO ===
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
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
