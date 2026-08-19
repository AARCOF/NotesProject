import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { HttpClientModule, HTTP_INTERCEPTORS } from "@angular/common/http";
import { AppRoutingModule } from "./app-routing.module";

import { NgbModule } from "@ng-bootstrap/ng-bootstrap";
import { ChartsModule } from "ng2-charts";

// Components
import { AppComponent } from "./app.component";
import { FooterComponent } from "./partials/footer/footer.component";
import { NavbarComponent } from "./partials/navbar/navbar.component";
import { SidebarComponent } from "./partials/sidebar/sidebar.component";

import { LandingPageComponent } from "./screens/landing-page/landing-page.component";
import { NotesDashboardComponent } from "./screens/notes-dashboard/notes-dashboard.component";
import { CategoryManagerComponent } from "./screens/category-manager/category-manager.component";
import { AdminPanelComponent } from "./screens/admin-panel/admin-panel.component";
import { NoteModalComponent } from "./components/note-modal/note-modal.component";
import { RecaptchaComponent } from "./components/recaptcha/recaptcha.component";
import { SkeletonLoaderComponent } from "./components/skeleton-loader/skeleton-loader.component";
import { OnboardingWizardComponent } from "./components/onboarding-wizard/onboarding-wizard.component";
import { QuickNotesPanelComponent } from "./components/quick-notes-panel/quick-notes-panel.component";
import { TaskCalendarComponent } from "./components/task-calendar/task-calendar.component";
import { DayDetailsModalComponent } from "./components/day-details-modal/day-details-modal.component";

import { LoginComponent } from "./sample-pages/login/login.component";
import { RegisterComponent } from "./sample-pages/register/register.component";
import { VerifyEmailComponent } from "./sample-pages/verify-email/verify-email.component";

import { CalendarScreenComponent } from "./screens/calendar-screen/calendar-screen.component";
import { ProductivityDashboardComponent } from "./screens/productivity-dashboard/productivity-dashboard.component";
import { ProfileSettingsComponent } from "./screens/profile-settings/profile-settings.component";
import { CanvasBoardComponent } from "./screens/canvas-board/canvas-board.component";
import { ExpensesDashboardComponent } from "./screens/expenses-dashboard/expenses-dashboard.component";

// Interceptors & Guards
import { JwtInterceptor } from "./core/interceptors/jwt.interceptor";
import { AuthGuard } from "./core/guards/auth.guard";

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    SidebarComponent,
    FooterComponent,
    LandingPageComponent,
    NotesDashboardComponent,
    CategoryManagerComponent,
    AdminPanelComponent,
    NoteModalComponent,
    RecaptchaComponent,
    SkeletonLoaderComponent,
    OnboardingWizardComponent,
    QuickNotesPanelComponent,
    TaskCalendarComponent,
    DayDetailsModalComponent,
    CalendarScreenComponent,
    ProductivityDashboardComponent,
    ProfileSettingsComponent,
    CanvasBoardComponent,
    ExpensesDashboardComponent,
    LoginComponent,
    RegisterComponent,
    VerifyEmailComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    ChartsModule,
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
