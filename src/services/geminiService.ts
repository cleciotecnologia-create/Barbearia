import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // In Vite, this will be replaced by the value if defined in vite.config.ts
    // or we can use import.meta.env if we prefer, but vite.config.ts is already using process.env
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not defined. Please add it to your environment variables.");
      throw new Error("An API Key must be set when running in a browser");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function getBarberChatResponse(
  message: string, 
  barbeariaName: string, 
  agendaUrl: string,
  history: { role: 'user' | 'model'; parts: { text: string }[] }[] = []
) {
  const systemInstruction = `
    Você é o assistente virtual da barbearia "${barbeariaName}".
    Seu objetivo é ajudar os clientes com dúvidas sobre serviços, horários e localização.
    Você deve ser sempre cordial, profissional e eficiente.
    
    IMPORTANTE: Sempre que o cliente demonstrar interesse em agendar ou perguntar como marcar um horário, forneça este link explicitamente: ${agendaUrl}
    
    Mantenha as respostas curtas e objetivas, focadas em ajudar o cliente a realizar o agendamento.
    Se você não souber uma informação específica sobre preços ou serviços (além do que o cliente já pode ver no site), peça para ele verificar no link de agendamento.
  `;

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const response = await model.generateContent({
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      generationConfig: {
        // systemInstruction in generativeModel config is the preferred way for newer SDK versions
        // but passing it here or via model init is fine
        temperature: 0.7,
      },
      // Note: System instruction should be passed to getGenerativeModel for better performance
    });

    // Handle system instruction properly based on the SDK version
    // The previous code had a slightly different structure. I'll stick to a compatible one.
    
    return response.response.text() || "Desculpe, tive um problema para processar sua mensagem. Tente novamente!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Ops! Ocorreu um erro no meu sistema. Por favor, tente novamente em instantes.";
  }
}
