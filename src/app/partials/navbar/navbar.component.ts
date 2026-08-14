import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { NgbDropdownConfig } from "@ng-bootstrap/ng-bootstrap";
import { AuthService } from "../../core/services/auth.service";
import { User } from "../../core/models/user.model";

@Component({
  selector: "app-navbar",
  templateUrl: "./navbar.component.html",
  styleUrls: ["./navbar.component.scss"],
  providers: [NgbDropdownConfig]
})
export class NavbarComponent implements OnInit {
  public iconOnlyToggled = false;
  public sidebarToggled = false;
  public currentUser: User | null = null;

  constructor(
    config: NgbDropdownConfig,
    public authService: AuthService,
    private router: Router
  ) {
    config.placement = "bottom-right";
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleRightSidebar(): void {
    const el = document.querySelector('.sidebar-offcanvas');
    if (el) el.classList.toggle('active');
  }

  toggleIconOnlySidebar(): void {
    this.iconOnlyToggled = !this.iconOnlyToggled;
    if (this.iconOnlyToggled) {
      document.querySelector("body")?.classList.add("sidebar-icon-only");
    } else {
      document.querySelector("body")?.classList.remove("sidebar-icon-only");
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
