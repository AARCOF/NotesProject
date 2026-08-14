import { BrowserModule } from "@angular/platform-browser";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { AppRoutingModule } from "./app-routing.module";

import { NgbModule } from "@ng-bootstrap/ng-bootstrap";

// Components
import { AppComponent } from "./app.component";
import { FooterComponent } from "./partials/footer/footer.component";
import { NavbarComponent } from "./partials/navbar/navbar.component";
import { SidebarComponent } from "./partials/sidebar/sidebar.component";

import { NotesDashboardComponent } from "./screens/notes-dashboard/notes-dashboard.component";
import { CategoryManagerComponent } from "./screens/category-manager/category-manager.component";
import { NoteModalComponent } from "./components/note-modal/note-modal.component";
import { RecaptchaComponent } from "./components/recaptcha/recaptcha.component";

import { LoginComponent } from "./sample-pages/login/login.component";
import { RegisterComponent } from "./sample-pages/register/register.component";
import { VerifyEmailComponent } from "./sample-pages/verify-email/verify-email.component";

// Interceptors & Guards
import { JwtInterceptor } from "./core/interceptors/jwt.interceptor";
import { AuthGuard } from "./core/guards/auth.guard";

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    NotesDashboardComponent,
    CategoryManagerComponent,
    NoteModalComponent,
    RecaptchaComponent,
    LoginComponent,
    RegisterComponent,
    VerifyEmailComponent
  ],
  imports: [
    BrowserModule,
    RouterModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    NgbModule
  ],
  providers: [
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
