import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

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

function SessionNode({ id, data, selected }: SessionNodeProps) {
  const themeColor = data.color || '#3b82f6';
  
  // Bolinhas quadradas para combinar com a estética da Sessão
  const handleStyle = { width: '12px', height: '12px', background: themeColor, border: '2px solid #1e1e24', borderRadius: '2px' };

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
        borderRadius: '8px', position: 'relative', zIndex: -1, pointerEvents: 'none'
      }}>
        <div style={{
          background: `${themeColor}33`, color: themeColor, padding: '8px 16px', borderBottom: `1px dashed ${themeColor}`,
          borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontWeight: 'bold', fontSize: '18px',
          textTransform: 'uppercase', letterSpacing: '1px', pointerEvents: 'all', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center'
        }}>
          {data.title}
          
          {/* 2. Novo grupo de botões no cabeçalho */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onSaveTemplate) data.onSaveTemplate(id); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}
              title="Salvar Sessão"
            >
              ⭐
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onEditSession) data.onEditSession(id, data.title, themeColor); }}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
            >
              ✏️ Editar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default memo(SessionNode);