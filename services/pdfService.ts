import * as pdfjsLib from 'pdfjs-dist';

// Handle ESM default export structure if present
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Configurar o worker para a mesma versão do pdfjs-dist
if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

export class PdfService {
  
  /**
   * Valida se o arquivo é um PDF válido baseada em MIME type e extensão.
   */
  private static validateFile(file: File): void {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          throw new Error(`O arquivo "${file.name}" não é um PDF válido.`);
      }
      if (file.size === 0) {
          throw new Error(`O arquivo "${file.name}" está vazio.`);
      }
  }

  /**
   * Extrai todo o texto de um arquivo PDF.
   * @param file Arquivo PDF
   * @returns Promise com o texto concatenado de todas as páginas.
   */
  static async extractText(file: File): Promise<string> {
    try {
      this.validateFile(file);
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      
      const pdf = await loadingTask.promise.catch((err: any) => {
          if (err.name === 'PasswordException') {
              throw new Error(`O arquivo "${file.name}" está protegido por senha.`);
          }
          throw new Error(`Arquivo "${file.name}" corrompido ou formato inválido.`);
      });
      
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Concatena os itens de texto da página
        const pageText = textContent.items
            // @ts-ignore
          .map((item: any) => item.str)
          .join(' ');
          
        fullText += ` --- PÁGINA ${i} --- \n${pageText}\n`;
      }
      
      return fullText;
    } catch (error: any) {
      console.error("Erro ao ler PDF:", error);
      // Repassa a mensagem tratada ou uma genérica
      throw new Error(error.message || "Falha crítica ao processar o arquivo PDF.");
    }
  }

  /**
   * Processa múltiplos arquivos e retorna um único bloco de texto combinado.
   */
  static async processMultipleFiles(files: File[]): Promise<string> {
      const results = await Promise.allSettled(files.map(file => this.extractText(file)));
      
      let fullText = '';
      const errors: string[] = [];

      results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
              fullText += `\n=== INÍCIO ARQUIVO: ${files[index].name} ===\n${result.value}\n=== FIM ARQUIVO ===\n`;
          } else {
              errors.push(result.reason.message);
          }
      });

      if (errors.length > 0) {
          // Se todos falharem, lança erro. Se parcial, apenas loga (ou poderia lançar warning)
          if (errors.length === files.length) {
              throw new Error(`Falha ao ler todos os arquivos: ${errors.join(' | ')}`);
          }
          console.warn("Alguns arquivos falharam ao processar:", errors);
      }

      return fullText;
  }
}