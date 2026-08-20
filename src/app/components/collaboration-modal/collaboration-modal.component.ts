import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-collaboration-modal',
  templateUrl: './collaboration-modal.component.html',
  styleUrls: ['./collaboration-modal.component.scss']
})
export class CollaborationModalComponent implements OnInit {
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();

  currentUser: User | null = null;
  copiedMessage: boolean = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  onDismiss(): void {
    if (this.currentUser) {
      localStorage.setItem('noteyou_last_donation_prompt_' + this.currentUser.id, Date.now().toString());
    } else {
      localStorage.setItem('noteyou_last_donation_prompt_guest', Date.now().toString());
    }
    this.close.emit();
  }

  copyAppInfo(): void {
    const text = "NoteYou - App de Notas y Finanzas Personales. ¡Gracias por apoyar este proyecto!";
    navigator.clipboard.writeText(text).then(() => {
      this.copiedMessage = true;
      setTimeout(() => this.copiedMessage = false, 2500);
    });
  }
}
