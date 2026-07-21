import { memo } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

// O "Espião" da Câmera
const zoomSelector = (s: any) => s.transform[2];

interface SessionNodeProps {
  id: string;
  selected: boolean;
  data: {
    title: string;
    color?: string;
    onResizeEnd?: (id: string, width: number, height: number) => void;
    onEditSession?: (id: string, currentTitle: string, currentColor: string) => void;
    onSaveTemplate?: (id: string) => void;
  };
}

export function SessionNode({ id, data, selected }: SessionNodeProps) {
  const zoom = useStore(zoomSelector);
  const themeColor = data.color || '#3b82f6';
  
  const handleStyle = { width: '12px', height: '12px', background: themeColor, border: '2px solid #1e1e24', borderRadius: '2px' };

  // A Matemática Mágica do LOD
  const isZoomedOut = zoom < 0.5;
  const baseFontSize = 18; 
  const dynamicFontSize = isZoomedOut ? Math.min(baseFontSize * (0.5 / zoom), 120) : baseFontSize;

  return (
    <>
      {/* 4 Conectores Livres */}
      <Handle type="source" position={Position.Top} id="top" style={{ ...handleStyle, top: '-6px' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, right: '-6px' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...handleStyle, bottom: '-6px' }} />
      <Handle type="source" position={Position.Left} id="left" style={{ ...handleStyle, left: '-6px' }} />

      <NodeResizer 
        color={themeColor} 
        isVisible={selected} 
        minWidth={300} 
        minHeight={200} 
        onResizeEnd={(_, params) => {
          if (data.onResizeEnd) data.onResizeEnd(id, params.width, params.height);
        }}
      />
      
      <div style={{
        width: '100%', height: '100%', background: `${themeColor}0D`, 
        border: selected ? '2px solid #eab308' : `2px dashed ${themeColor}`,
        boxShadow: selected ? '0 0 15px rgba(234, 179, 8, 0.2)' : 'none',
        borderRadius: '8px', position: 'relative', zIndex: -1, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column'
      }}>
        
        {/* BARRA DE TÍTULO ÚNICA E UNIFICADA */}
        <div 
          className="custom-drag-handle"
          style={{
            background: themeColor,
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '6px 6px 0 0',
            fontWeight: 'bold',
            textTransform: 'uppercase', // Trazido do seu design original
            letterSpacing: '1px',       // Trazido do seu design original
            fontSize: `${dynamicFontSize}px`,
            transition: 'font-size 0.05s linear', 
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'grab',
            pointerEvents: 'all' // Essencial para permitir o clique nos botões
          }}
        >
          {data.title || 'Nova Sessão'}
          
          {/* Grupo de botões (⭐ e ✏️) */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onSaveTemplate) data.onSaveTemplate(id); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px' }}
              title="Salvar Sessão"
            >
              ⭐
            </button>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (data.onEditSession) data.onEditSession(id, data.title, themeColor); 
              }}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
              title="Editar"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Corpo vazio necessário para as Tips poderem flutuar livremente */}
        <div style={{ flex: 1 }} />
      </div>
    </>
  );
}

export default memo(SessionNode);