import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { ModalDialogService } from '../../services/modal-dialog.service';

type DrawingTool = 'brush' | 'highlighter' | 'eraser';

@Component({
  selector: 'app-canvas-board',
  templateUrl: './canvas-board.component.html',
  styleUrls: ['./canvas-board.component.scss']
})
export class CanvasBoardComponent implements OnInit, AfterViewInit {
  @ViewChild('drawingCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('notepadTextarea', { static: false }) notepadRef!: ElementRef<HTMLTextAreaElement>;

  // Mode: Canva (Drawing) or Notepad (Plain text)
  activeMode: 'canvas' | 'notepad' = 'canvas';

  // --- Drawing State ---
  private ctx!: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private lastX: number = 0;
  private lastY: number = 0;

  // Active Tool & Styles
  selectedTool: DrawingTool = 'brush';
  selectedColor: string = '#0ea5e9';
  strokeWidth: number = 4;
  
  // Quick Palette
  presetColors: string[] = [
    '#0f172a', // Slate Dark
    '#0ea5e9', // Blue
    '#0d9488', // Teal
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f97316', // Orange
    '#f43f5e', // Rose
    '#8b5cf6'  // Purple
  ];

  // Width Options
  widthOptions: { label: string; value: number }[] = [
    { label: 'Fino', value: 2 },
    { label: 'Medio', value: 6 },
    { label: 'Grueso', value: 14 },
    { label: 'Marcador', value: 26 }
  ];

  // Undo / Redo Stack
  private history: ImageData[] = [];
  private historyStep: number = -1;
  private maxHistory: number = 25;

  // --- Notepad / Plain Text State ---
  notepadText: string = '';
  notepadFontSize: number = 15;
  notepadFontFamily: 'sans' | 'mono' | 'serif' = 'sans';
  notepadWordWrap: boolean = true;

  statusMessage: string = '';
  private currentUserId: string = 'guest';

  constructor(
    private authService: AuthService,
    private dialogService: ModalDialogService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.id;
    }
    this.loadSavedNotepad();
  }

  ngAfterViewInit(): void {
    if (this.activeMode === 'canvas') {
      this.initCanvas();
    }
  }

  private initCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!context) return;
    this.ctx = context;

    this.resizeCanvas();
    this.loadSavedCanvas();
  }

  setMode(mode: 'canvas' | 'notepad'): void {
    this.activeMode = mode;
    if (mode === 'canvas') {
      setTimeout(() => {
        this.initCanvas();
      }, 60);
    } else {
      setTimeout(() => {
        if (this.notepadRef && this.notepadRef.nativeElement) {
          this.notepadRef.nativeElement.focus();
        }
      }, 60);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.activeMode === 'canvas' && this.ctx && this.canvasRef) {
      const savedData = this.ctx.getImageData(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
      this.resizeCanvas();
      this.ctx.putImageData(savedData, 0, 0);
    }
  }

  private resizeCanvas(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = Math.max(550, window.innerHeight - 290);

    canvas.width = width;
    canvas.height = height;

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, width, height);

    this.saveState();
  }

  // --- Mouse / Touch Drawing Handlers ---

  startDrawing(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.isDrawing = true;
    const { x, y } = this.getCoordinates(e);
    this.lastX = x;
    this.lastY = y;
  }

  draw(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    e.preventDefault();

    const { x, y } = this.getCoordinates(e);

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (this.selectedTool === 'eraser') {
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = this.strokeWidth * 2.5;
      this.ctx.globalAlpha = 1.0;
    } else if (this.selectedTool === 'highlighter') {
      this.ctx.strokeStyle = this.selectedColor;
      this.ctx.lineWidth = this.strokeWidth * 3;
      this.ctx.globalAlpha = 0.3;
    } else {
      this.ctx.strokeStyle = this.selectedColor;
      this.ctx.lineWidth = this.strokeWidth;
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.stroke();

    this.lastX = x;
    this.lastY = y;
  }

  stopDrawing(): void {
    if (this.isDrawing) {
      this.isDrawing = false;
      this.ctx.globalAlpha = 1.0;
      this.saveState();
      this.autoSaveToStorage();
    }
  }

  private getCoordinates(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    
    if (e instanceof MouseEvent) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    } else if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return { x: 0, y: 0 };
  }

  // --- Tool & Settings Selectors ---

  selectTool(tool: DrawingTool): void {
    this.selectedTool = tool;
  }

  selectColor(color: string): void {
    this.selectedColor = color;
    if (this.selectedTool === 'eraser') {
      this.selectedTool = 'brush';
    }
  }

  selectWidth(width: number): void {
    this.strokeWidth = width;
  }

  // --- Undo / Redo / Clear / Export (Drawing) ---

  private saveState(): void {
    if (!this.ctx || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const imgData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    this.history = this.history.slice(0, this.historyStep + 1);
    this.history.push(imgData);

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyStep++;
    }
  }

  undo(): void {
    if (this.canUndo()) {
      this.historyStep--;
      const imgData = this.history[this.historyStep];
      this.ctx.putImageData(imgData, 0, 0);
      this.autoSaveToStorage();
    }
  }

  redo(): void {
    if (this.canRedo()) {
      this.historyStep++;
      const imgData = this.history[this.historyStep];
      this.ctx.putImageData(imgData, 0, 0);
      this.autoSaveToStorage();
    }
  }

  canUndo(): boolean {
    return this.historyStep > 0;
  }

  canRedo(): boolean {
    return this.historyStep < this.history.length - 1;
  }

  clearCanvas(): void {
    if (!this.canvasRef || !this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
    this.autoSaveToStorage();
    this.showToast('Lienzo limpiado');
  }

  downloadImage(): void {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `NoteYou-Canva-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    this.showToast('¡Imagen PNG descargada con éxito!');
  }

  // --- Notepad / Plain Text Logic ---

  onTextChange(): void {
    this.autoSaveNotepad();
  }

  getCharCount(): number {
    return this.notepadText ? this.notepadText.length : 0;
  }

  getWordCount(): number {
    if (!this.notepadText || !this.notepadText.trim()) return 0;
    return this.notepadText.trim().split(/\s+/).length;
  }

  getLineCount(): number {
    if (!this.notepadText) return 1;
    return this.notepadText.split('\n').length;
  }

  insertDateTime(): void {
    const now = new Date();
    const formatted = `\n--- [${now.toLocaleDateString()} ${now.toLocaleTimeString()}] ---\n`;
    this.notepadText = (this.notepadText ? this.notepadText : '') + formatted;
    this.onTextChange();
    this.showToast('Marca de fecha y hora insertada');
  }

  copyToClipboard(): void {
    if (!this.notepadText) {
      this.showToast('No hay texto para copiar.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.notepadText).then(() => {
        this.showToast('¡Texto copiado al portapapeles!');
      }).catch(() => {
        this.fallbackCopyText();
      });
    } else {
      this.fallbackCopyText();
    }
  }

  private fallbackCopyText(): void {
    const textarea = document.createElement('textarea');
    textarea.value = this.notepadText;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.showToast('¡Texto copiado al portapapeles!');
  }

  downloadTxt(): void {
    if (!this.notepadText.trim()) {
      this.showToast('El bloc de notas está vacío.');
      return;
    }
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `NoteYou-Texto-${dateStr}_${timeStr}.txt`;
    const blob = new Blob([this.notepadText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    this.showToast('¡Archivo .txt descargado con éxito!');
  }

  clearNotepad(): void {
    if (!this.notepadText.trim()) return;
    this.dialogService.confirm({
      title: '¿Vaciar bloc de notas?',
      message: '¿Estás seguro de que deseas vaciar todo el texto del bloc de notas?',
      confirmText: 'Sí, vaciar',
      variant: 'warning',
      icon: 'typcn-trash',
      onConfirm: () => {
        this.notepadText = '';
        this.onTextChange();
        this.showToast('Bloc de notas vaciado');
      }
    });
  }

  // --- LocalStorage Persistence ---

  private getStorageKey(): string {
    return `noteyou_canvas_${this.currentUserId}`;
  }

  private getNotepadStorageKey(): string {
    return `noteyou_notepad_${this.currentUserId}`;
  }

  private autoSaveToStorage(): void {
    try {
      if (!this.canvasRef) return;
      const canvas = this.canvasRef.nativeElement;
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem(this.getStorageKey(), dataUrl);
    } catch (e) {}
  }

  private loadSavedCanvas(): void {
    try {
      const savedData = localStorage.getItem(this.getStorageKey());
      if (savedData) {
        const img = new Image();
        img.onload = () => {
          this.ctx.drawImage(img, 0, 0);
          this.saveState();
        };
        img.src = savedData;
      }
    } catch (e) {}
  }

  private autoSaveNotepad(): void {
    try {
      localStorage.setItem(this.getNotepadStorageKey(), this.notepadText);
    } catch (e) {}
  }

  private loadSavedNotepad(): void {
    try {
      const savedText = localStorage.getItem(this.getNotepadStorageKey());
      if (savedText !== null) {
        this.notepadText = savedText;
      }
    } catch (e) {}
  }

  public showToast(msg: string): void {
    this.statusMessage = msg;
    setTimeout(() => {
      this.statusMessage = '';
    }, 3000);
  }
}
