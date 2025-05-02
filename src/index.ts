// src/index.ts
import { events, MessageEvent, MessageRequest, MessageResponse, Extension } from '@janhq/core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SalvaFiles - Estensione per Jan
 * 
 * Questa estensione permette di:
 * 1. Specificare una cartella di destinazione per i file
 * 2. Salvare automaticamente i file generati durante la chat
 * 3. Elencare i file presenti nella cartella condivisa
 */
export default class SalvaFiles implements Extension {
  private saveDirectory: string = '';
  private initialized: boolean = false;

  /**
   * Funzione richiamata all'avvio dell'estensione
   */
  async onStart(): Promise<any> {
    // Intercetta i messaggi inviati per elaborare i comandi
    events.on(MessageEvent.OnMessageSent, (data: MessageRequest) => 
      this.processCommand(data)
    );
    
    // Intercetta le risposte per salvare eventuali file
    events.on(MessageEvent.OnMessageReceived, (data: MessageResponse) => 
      this.saveFilesFromResponse(data)
    );
    
    console.log('SalvaFiles estensione avviata');
    return Promise.resolve();
  }

  /**
   * Funzione richiamata alla chiusura dell'estensione
   */
  async onStop(): Promise<any> {
    console.log('SalvaFiles estensione fermata');
    return Promise.resolve();
  }

  /**
   * Elabora i comandi ricevuti dall'utente
   */
  private async processCommand(data: MessageRequest): Promise<void> {
    const message = data.message.toLowerCase();
    
    // Comando per impostare la directory
    if (message.startsWith('/salva-imposta')) {
      const directoryPath = message.replace('/salva-imposta', '').trim();
      await this.setDirectory(directoryPath);
      return;
    }
    
    // Comando per elencare i file salvati
    if (message === '/salva-lista') {
      await this.listSavedFiles();
      return;
    }
    
    // Comando per informazioni sull'estensione
    if (message === '/salva-aiuto') {
      await this.showHelp();
      return;
    }
  }

  /**
   * Imposta la directory di salvataggio
   */
  private async setDirectory(directoryPath: string): Promise<void> {
    try {
      // Verifica se la directory esiste
      if (!fs.existsSync(directoryPath)) {
        // Se non esiste, prova a crearla
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      
      // Verifica i permessi di scrittura
      fs.accessSync(directoryPath, fs.constants.W_OK);
      
      this.saveDirectory = directoryPath;
      this.initialized = true;
      
      await this.sendSystemMessage(`✅ Directory impostata: ${this.saveDirectory}`);
    } catch (error) {
      await this.sendSystemMessage(`❌ Errore nell'impostare la directory: ${error.message}`);
    }
  }

  /**
   * Analizza la risposta per identificare e salvare eventuali file
   */
  private async saveFilesFromResponse(data: MessageResponse): Promise<void> {
    if (!this.initialized || !data.content) {
      return;
    }

    // Cerca contenuti che sembrano file (es. blocchi di codice, ecc.)
    const fileContents = this.extractFileContents(data.content);
    
    for (const file of fileContents) {
      await this.saveFile(file.filename, file.content, file.type);
    }
  }

  /**
   * Estrae potenziali file dal contenuto di un messaggio
   */
  private extractFileContents(content: string): Array<{filename: string, content: string, type: string}> {
    const files = [];
    
    // Regex per trovare blocchi di codice markdown
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'txt';
      const code = match[2];
      
      // Genera un nome di file basato sul linguaggio
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
      const filename = `file_${timestamp}.${this.getFileExtension(language)}`;
      
      files.push({
        filename,
        content: code,
        type: 'text'
      });
    }
    
    return files;
  }

  /**
   * Mappa il linguaggio all'estensione del file appropriata
   */
  private getFileExtension(language: string): string {
    const extensionMap: {[key: string]: string} = {
      'javascript': 'js',
      'typescript': 'ts',
      'python': 'py',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'csharp': 'cs',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'markdown': 'md',
      'bash': 'sh',
      'shell': 'sh',
      'sql': 'sql',
      'xml': 'xml',
      'yaml': 'yml',
      'php': 'php',
      'ruby': 'rb',
      'go': 'go',
      'rust': 'rs',
      'swift': 'swift',
      'kotlin': 'kt',
      'dart': 'dart',
      // Default
      'txt': 'txt'
    };
    
    return extensionMap[language.toLowerCase()] || 'txt';
  }

  /**
   * Salva un file nella directory specificata
   */
  private async saveFile(filename: string, content: string, type: string): Promise<void> {
    if (!this.initialized) {
      return;
    }
    
    try {
      const filePath = path.join(this.saveDirectory, filename);
      
      if (type === 'text') {
        fs.writeFileSync(filePath, content, 'utf8');
      } else {
        // Per file binari
        fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
      }
      
      await this.sendSystemMessage(`📁 File salvato: ${filename}`);
    } catch (error) {
      await this.sendSystemMessage(`❌ Errore nel salvare il file ${filename}: ${error.message}`);
    }
  }

  /**
   * Elenca i file nella directory di salvataggio
   */
  private async listSavedFiles(): Promise<void> {
    if (!this.initialized) {
      await this.sendSystemMessage('❌ Devi prima impostare una directory con /salva-imposta [percorso]');
      return;
    }
    
    try {
      const files = fs.readdirSync(this.saveDirectory);
      
      if (files.length === 0) {
        await this.sendSystemMessage('📁 Nessun file salvato nella directory.');
        return;
      }
      
      let message = '📁 File salvati:\n';
      files.forEach((file, index) => {
        const stats = fs.statSync(path.join(this.saveDirectory, file));
        const sizeInKB = Math.round(stats.size / 1024);
        message += `${index + 1}. ${file} (${sizeInKB} KB)\n`;
      });
      
      await this.sendSystemMessage(message);
    } catch (error) {
      await this.sendSystemMessage(`❌ Errore nell'elencare i file: ${error.message}`);
    }
  }

  /**
   * Mostra l'aiuto sull'utilizzo dell'estensione
   */
  private async showHelp(): Promise<void> {
    const helpMessage = `
📚 **SalvaFiles - Guida comandi**

- **/salva-imposta [percorso]**: Imposta la directory in cui salvare i file
- **/salva-lista**: Elenca tutti i file salvati nella directory
- **/salva-aiuto**: Mostra questa guida

L'estensione salverà automaticamente i blocchi di codice e altri file generati durante la conversazione.
`;
    
    await this.sendSystemMessage(helpMessage);
  }

  /**
   * Invia un messaggio di sistema all'utente
   */
  private async sendSystemMessage(message: string): Promise<void> {
    events.emit(MessageEvent.OnMessageReceived, {
      id: `salva-files-${Date.now()}`,
      content: message,
      role: 'system'
    });
  }
}