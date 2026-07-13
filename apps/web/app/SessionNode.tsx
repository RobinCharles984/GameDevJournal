import { memo } from 'react';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

interface SessionNodeProps {
  id: string;
  data: {
    title: string;
    color?: string; // Nova propriedade de cor
    onResizeEnd?: (id: string, width: number, height: number) => void;
    onEditSession?: (id: string, currentTitle: string, currentColor: string) => void; // Nova função de edição
  };
  selected: boolean;
}

function SessionNode({ id, data, selected }: SessionNodeProps) {
  const themeColor = data.color || '#3b82f6';

  return (
    <>
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
        width: '100%',
        height: '100%',
        background: `${themeColor}0D`, // 0D é transparência bem leve
        border: `2px dashed ${themeColor}`,
        borderRadius: '8px',
        position: 'relative',
        zIndex: -1,
        pointerEvents: 'none' // ISSO AQUI RESOLVE O BLOQUEIO DOS CLIQUES NAS TIPS!
      }}>
        <div style={{
          background: `${themeColor}33`,
          color: themeColor,
          padding: '8px 16px',
          borderBottom: `1px dashed ${themeColor}`,
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          fontWeight: 'bold',
          fontSize: '18px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          pointerEvents: 'all', // Permite arrastar apenas segurando pelo cabeçalho
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {data.title}
          
          {/* Botão de Editar a Sessão */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (data.onEditSession) data.onEditSession(id, data.title, themeColor);
            }}
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            ✏️ Editar
          </button>
        </div>
      </div>
    </>
  );
}

export default memo(SessionNode);