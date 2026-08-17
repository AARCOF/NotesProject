import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { LandingPageComponent } from "./screens/landing-page/landing-page.component";
import { NotesDashboardComponent } from "./screens/notes-dashboard/notes-dashboard.component";
import { CategoryManagerComponent } from "./screens/category-manager/category-manager.component";
import { AdminPanelComponent } from "./screens/admin-panel/admin-panel.component";
import { LoginComponent } from "./sample-pages/login/login.component";
import { RegisterComponent } from "./sample-pages/register/register.component";
import { VerifyEmailComponent } from "./sample-pages/verify-email/verify-email.component";
import { CalendarScreenComponent } from "./screens/calendar-screen/calendar-screen.component";
import { ProductivityDashboardComponent } from "./screens/productivity-dashboard/productivity-dashboard.component";
import { ProfileSettingsComponent } from "./screens/profile-settings/profile-settings.component";
import { CanvasBoardComponent } from "./screens/canvas-board/canvas-board.component";

import { AuthGuard } from "./core/guards/auth.guard";

const routes: Routes = [
  { path: "", redirectTo: "/landing", pathMatch: "full" },
  { path: "landing", component: LandingPageComponent },
  { path: "dashboard", component: NotesDashboardComponent, canActivate: [AuthGuard] },
  { path: "calendar", component: CalendarScreenComponent, canActivate: [AuthGuard] },
  { path: "productivity", component: ProductivityDashboardComponent, canActivate: [AuthGuard] },
  { path: "categories", component: CategoryManagerComponent, canActivate: [AuthGuard] },
  { path: "canvas", component: CanvasBoardComponent, canActivate: [AuthGuard] },
  { path: "profile", component: ProfileSettingsComponent, canActivate: [AuthGuard] },
  { path: "admin-panel", component: AdminPanelComponent, canActivate: [AuthGuard] },
  { path: "login", component: LoginComponent },
  { path: "register", component: RegisterComponent },
  { path: "verify-email", component: VerifyEmailComponent },
  { path: "**", redirectTo: "/landing" }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: false })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
