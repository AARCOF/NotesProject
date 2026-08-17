import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

type DrawingTool = 'brush' | 'highlighter' | 'eraser';

@Component({
  selector: 'app-canvas-board',
  templateUrl: './canvas-board.component.html',
  styleUrls: ['./canvas-board.component.scss']
})
export class CanvasBoardComponent implements OnInit, AfterViewInit {
  @ViewChild('drawingCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
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

  statusMessage: string = '';
  private currentUserId: string = 'guest';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUserId = user.id;
    }
  }

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!context) return;
    this.ctx = context;

    this.resizeCanvas();
    this.loadSavedCanvas();
  }

  @HostListener('window:resize')
  onResize(): void {
    // When resizing, preserve image content
    if (!this.ctx) return;
    const savedData = this.ctx.getImageData(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.resizeCanvas();
    this.ctx.putImageData(savedData, 0, 0);
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Create a square/responsive canvas area
    const width = parent.clientWidth;
    const height = Math.max(600, window.innerHeight - 280);

    canvas.width = width;
    canvas.height = height;

    // Fill white background initially
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

  // --- Undo / Redo / Clear / Export ---

  private saveState(): void {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    const imgData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Discard any redos after current step
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
    const canvas = this.canvasRef.nativeElement;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.saveState();
    this.autoSaveToStorage();
    this.showToast('Lienzo limpiado');
  }

  downloadImage(): void {
    const canvas = this.canvasRef.nativeElement;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `NoteYou-Canva-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    this.showToast('¡Imagen PNG descargada con éxito!');
  }

  // --- LocalStorage Persistence ---

  private getStorageKey(): string {
    return `noteyou_canvas_${this.currentUserId}`;
  }

  private autoSaveToStorage(): void {
    try {
      const canvas = this.canvasRef.nativeElement;
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem(this.getStorageKey(), dataUrl);
    } catch (e) {
      // Storage quota or error safe guard
    }
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

  private showToast(msg: string): void {
    this.statusMessage = msg;
    setTimeout(() => {
      this.statusMessage = '';
    }, 3000);
  }
}
