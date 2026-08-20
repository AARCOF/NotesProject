import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { User, UserRole } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';
import { JwtService } from './jwt.service';
import { VerificationKeyService } from './verification-key.service';
import { RecaptchaService } from './recaptcha.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private verificationKeyService: VerificationKeyService,
    private recaptchaService: RecaptchaService,
    private http: HttpClient
  ) {
    this.checkInitialAuth();
  }

  private checkInitialAuth(): void {
    const token = this.jwtService.getToken();
    if (token && !this.jwtService.isTokenExpired(token)) {
      const payload = this.jwtService.decodeToken(token);
      if (payload) {
        let user = this.userRepository.findById(payload.sub);
        if (!user && payload.email) {
          user = this.userRepository.findByEmail(payload.email);
        }
        if (user && user.isVerified && user.isActive !== false) {
          this.currentUserSubject.next(user);
          return;
        } else if (payload.sub && payload.name && payload.email) {
          // Reconstruir usuario desde el payload del token si no está en local
          const fallbackUser: User = {
            id: payload.sub,
            name: payload.name,
            email: payload.email,
            passwordHash: '',
            role: (payload as any).role || 'user',
            isVerified: true,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          this.userRepository.saveUser(fallbackUser);
          this.currentUserSubject.next(fallbackUser);
          return;
        }
      }
    }
    this.jwtService.removeToken();
    this.currentUserSubject.next(null);
  }

  public async register(name: string, email: string, password: string): Promise<{ success: boolean; message: string; email?: string }> {
    if (!this.recaptchaService.isVerified()) {
      return { success: false, message: 'Por favor completa la verificación reCAPTCHA No soy un robot.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Intentar registrar en MongoDB Atlas a través de la API
    try {
      const response: any = await this.http.post('/api/auth/register', {
        name: name.trim(),
        email: cleanEmail,
        password
      }).toPromise();

      if (response && response.success) {
        this.recaptchaService.reset();
        return {
          success: true,
          message: response.message,
          email: cleanEmail
        };
      }
    } catch (apiErr) {
      const serverMessage = (apiErr as any)?.error?.message;
      if (serverMessage) {
        return { success: false, message: serverMessage };
      }
    }

    // 2. Modo de respaldo local
    const existing = this.userRepository.findByEmail(cleanEmail);
    if (existing && existing.isVerified) {
      return { success: false, message: 'Este correo electrónico ya está registrado y verificado. Procede al inicio de sesión.' };
    }

    const securityKey = this.verificationKeyService.generateSecurityKey();
    const expiresAt = this.verificationKeyService.calculateExpirationTime();
    const assignedRole: UserRole = cleanEmail === 'acaf504082@gmail.com' ? 'superadmin' : 'user';

    const newUser: User = {
      id: existing ? existing.id : 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name,
      email: cleanEmail,
      passwordHash: btoa(password),
      role: assignedRole,
      isVerified: false,
      isActive: true,
      verificationKey: securityKey,
      keyExpiresAt: expiresAt,
      createdAt: new Date().toISOString(),
      hasCompletedTutorial: false
    };

    this.userRepository.saveUser(newUser);
    this.verificationKeyService.sendVerificationEmail(newUser.email, securityKey, expiresAt).subscribe();
    this.recaptchaService.reset();

    return {
      success: true,
      message: `Cuenta creada exitosamente. Se ha enviado un código de acceso a ${newUser.email} válido por 1 hora.`,
      email: newUser.email
    };
  }

  public async verifyAccountWithKey(email: string, inputKey: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = inputKey.trim();

    // 1. Intentar verificar en la nube (MongoDB Atlas)
    try {
      const response: any = await this.http.post('/api/auth/verify', {
        email: cleanEmail,
        key: cleanKey
      }).toPromise();

      if (response && response.success) {
        if (response.token) {
          this.jwtService.saveToken(response.token);
        }
        if (response.user) {
          this.userRepository.saveUser(response.user);
          this.currentUserSubject.next(response.user);
        }
        return { success: true, message: response.message || 'Cuenta verificada exitosamente.' };
      }
    } catch (apiErr) {
      const serverMessage = (apiErr as any)?.error?.message;
      if (serverMessage && !serverMessage.includes('NetworkError') && !serverMessage.includes('404')) {
        return { success: false, message: serverMessage };
      }
    }

    // 2. Verificación en repositorio local
    const user = this.userRepository.findByEmail(cleanEmail);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const result = this.verificationKeyService.validateKey(cleanKey, user.verificationKey, user.keyExpiresAt);
    if (!result.isValid) {
      return { success: false, message: result.message };
    }

    user.isVerified = true;
    user.verificationKey = undefined;
    user.keyExpiresAt = undefined;
    this.userRepository.updateUser(user);

    const token = this.jwtService.generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    } as any);
    this.jwtService.saveToken(token);
    this.currentUserSubject.next(user);

    return { success: true, message: 'Cuenta verificada exitosamente. Se ha iniciado sesión.' };
  }

  public resendVerificationKey(email: string): { success: boolean; message: string } {
    const user = this.userRepository.findByEmail(email);
    if (!user) {
      return { success: false, message: 'Usuario no encontrado.' };
    }

    const newKey = this.verificationKeyService.generateSecurityKey();
    const expiresAt = this.verificationKeyService.calculateExpirationTime();

    user.verificationKey = newKey;
    user.keyExpiresAt = expiresAt;
    this.userRepository.updateUser(user);

    this.verificationKeyService.sendVerificationEmail(user.email, newKey, expiresAt).subscribe();

    return { success: true, message: `Se ha enviado un nuevo código de acceso a ${user.email} con validez de 1 hora.` };
  }

  public async login(email: string, password: string): Promise<{ success: boolean; message: string; requiresVerification?: boolean }> {
    if (!this.recaptchaService.isVerified()) {
      return { success: false, message: 'Por favor completa la verificación reCAPTCHA No soy un robot.' };
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Intentar inicio de sesión en MongoDB Atlas
    try {
      const response: any = await this.http.post('/api/auth/login', {
        email: cleanEmail,
        password
      }).toPromise();

      if (response && response.success) {
        if (response.token) {
          this.jwtService.saveToken(response.token);
        }
        if (response.user) {
          this.userRepository.saveUser(response.user);
          this.currentUserSubject.next(response.user);
        }
        this.recaptchaService.reset();
        return { success: true, message: 'Inicio de sesión exitoso.' };
      }
    } catch (apiErr) {
      const errObj = apiErr as any;
      if (errObj?.error?.requiresVerification) {
        return {
          success: false,
          message: errObj.error.message || 'Tu cuenta requiere verificación por correo.',
          requiresVerification: true
        };
      }
      const serverMessage = errObj?.error?.message;
      if (serverMessage && !serverMessage.includes('NetworkError') && !serverMessage.includes('404')) {
        return { success: false, message: serverMessage };
      }
    }

    // 2. Modo de respaldo local
    const user = this.userRepository.findByEmail(cleanEmail);
    if (!user || user.passwordHash !== btoa(password)) {
      return { success: false, message: 'Credenciales inválidas. Por favor verifica tu correo y contraseña.' };
    }

    if (user.isActive === false) {
      return { success: false, message: 'Tu cuenta ha sido desactivada por un administrador del sistema.' };
    }

    if (!user.isVerified) {
      return {
        success: false,
        message: 'Tu cuenta requiere verificación por correo. Ingresa el código de 6 dígitos enviado.',
        requiresVerification: true
      };
    }

    const token = this.jwtService.generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    } as any);
    this.jwtService.saveToken(token);
    this.currentUserSubject.next(user);

    this.recaptchaService.reset();

    return { success: true, message: 'Inicio de sesión exitoso.' };
  }

  public logout(): void {
    this.jwtService.removeToken();
    this.currentUserSubject.next(null);
  }

  public updateProfileName(newName: string): { success: boolean; message: string } {
    const user = this.getCurrentUser();
    if (!user) {
      return { success: false, message: 'No hay sesión activa.' };
    }
    user.name = newName;
    this.userRepository.updateUser(user);
    
    // Update token to reflect new name
    const token = this.jwtService.generateToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    } as any);
    this.jwtService.saveToken(token);
    this.currentUserSubject.next(user);
    
    return { success: true, message: 'Perfil actualizado exitosamente.' };
  }

  public changePassword(currentPass: string, newPass: string): { success: boolean; message: string } {
    const user = this.getCurrentUser();
    if (!user) {
      return { success: false, message: 'No hay sesión activa.' };
    }

    if (user.passwordHash !== btoa(currentPass)) {
      return { success: false, message: 'La contraseña actual es incorrecta.' };
    }

    user.passwordHash = btoa(newPass);
    this.userRepository.updateUser(user);
    
    return { success: true, message: 'Contraseña actualizada exitosamente.' };
  }

  public isAuthenticated(): boolean {
    const token = this.jwtService.getToken();
    return !!token && !this.jwtService.isTokenExpired(token) && !!this.currentUserSubject.getValue();
  }

  public getCurrentUser(): User | null {
    return this.currentUserSubject.getValue();
  }

  public isSuperAdmin(): boolean {
    const u = this.getCurrentUser();
    return u?.role === 'superadmin';
  }

  public isAdminOrSuperAdmin(): boolean {
    const u = this.getCurrentUser();
    return u?.role === 'superadmin' || u?.role === 'admin';
  }

  public markTutorialAsCompleted(): void {
    const user = this.getCurrentUser();
    if (user) {
      user.hasCompletedTutorial = true;
      this.userRepository.updateUser(user);
      this.currentUserSubject.next(user);
    }
  }
}
