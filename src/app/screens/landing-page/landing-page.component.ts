import { Component, OnInit, HostListener } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  isAuthenticated: boolean = false;
  activeSection: string = 'inicio';

  isLegalModalOpen: boolean = false;
  legalModalTitle: string = '';
  legalModalContent: string = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.isAuthenticated = !!user;
    });
  }

  scrollTo(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      this.activeSection = sectionId;
    }
  }

  openLegalModal(type: 'privacy' | 'terms' | 'about' | 'security'): void {
    if (type === 'privacy') {
      this.legalModalTitle = 'Política de Privacidad';
      this.legalModalContent = 'En NoteYou nos tomamos muy en serio la privacidad de tus notas e información personal. Todos tus apuntes, categorías y preferencias se almacenan de forma segura y sincronizada, sin compartir tus datos con terceros.';
    } else if (type === 'terms') {
      this.legalModalTitle = 'Términos del Servicio';
      this.legalModalContent = 'Al utilizar NoteYou, accedes a un servicio de gestión de notas, calendario y productividad diseñado para facilitarte la captura y organización de tareas de manera fluida y moderna.';
    } else if (type === 'security') {
      this.legalModalTitle = 'Seguridad y Protección';
      this.legalModalContent = 'NoteYou utiliza estándares modernos de autenticación JWT y almacenamiento seguro para garantizar que únicamente tú tengas acceso a tus proyectos, notas rápidas y tableros Kanban.';
    } else {
      this.legalModalTitle = 'Acerca de NoteYou';
      this.legalModalContent = 'NoteYou es una plataforma moderna de productividad y organización de notas creada para estudiantes, profesionales y creadores que buscan maximizar su enfoque diario.';
    }
    this.isLegalModalOpen = true;
  }

  closeLegalModal(): void {
    this.isLegalModalOpen = false;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    const sections = ['inicio', 'herramientas', 'como-funciona'];
    const scrollPosition = window.pageYOffset + 100; // offset

    for (const section of sections) {
      const element = document.getElementById(section);
      if (element) {
        const top = element.offsetTop;
        const height = element.offsetHeight;
        if (scrollPosition >= top && scrollPosition < top + height) {
          this.activeSection = section;
        }
      }
    }
    
    // Scroll reveal logic
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-up');
    for (let i = 0; i < reveals.length; i++) {
      const windowHeight = window.innerHeight;
      const elementTop = reveals[i].getBoundingClientRect().top;
      const elementVisible = 100;
      if (elementTop < windowHeight - elementVisible) {
        reveals[i].classList.add('active');
      }
    }
  }
}
