import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  // Inicializa o cliente da OpenAI puxando a chave do seu .env.local
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  try {
    const body = await req.json();
    const { projectData } = body;

    // Se o mapa vier vazio, barramos aqui mesmo
    if (!projectData) {
      return NextResponse.json({ error: "Nenhum dado recebido." }, { status: 400 });
    }

    const response: any = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [
        {
          role: "system",
          content: `Você é um compilador de LaTeX especializado em Game Design.
          Sua única função é ler os dados do mapa mental fornecido e transformá-los em um Game Design Document (GDD) profissional formatado em LaTeX.
          
          REGRAS ABSOLUTAS:
          1. Retorne APENAS o código LaTeX puro. NÃO USE marcações de bloco de código do markdown (como \`\`\`latex).
          2. Não diga "Aqui está o código", não faça introduções e nem dê explicações.
          3. O texto deve começar EXATAMENTE em \\documentclass{article} e terminar em \\end{document}.
          4. Use os pacotes básicos no preâmbulo: \\usepackage[utf8]{inputenc}, \\usepackage{graphicx}, \\usepackage{hyperref}, \\usepackage{geometry}.
          5. Organize as sessões e dicas usando \\section{}, \\subsection{} e \\begin{itemize}.`
        },
        {
          role: "user",
          content: projectData
        }
      ],
      temperature: 0.2, // Temperatura bem baixa para ele não inventar moda e focar no código
      max_tokens: 2500, // Maior porque a formatação de código gasta mais tokens
    });

    // MÁGICA: Aqui nós devolvemos com a chave "latex", que é exatamente o que o front-end está esperando para fazer o download
    return NextResponse.json({ latex: response.choices[0].message.content });
    
  } catch (error) {
    console.error("Erro na API de LaTeX:", error);
    return NextResponse.json({ error: "Falha ao processar a geração do documento." }, { status: 500 });
  }
}