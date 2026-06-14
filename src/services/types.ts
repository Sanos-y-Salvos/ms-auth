// Tipos de eventos que ms-users emite hacia ms-auth vía Bull/Redis.
// Deben mantenerse sincronizados con ms-users/src/events/event-emitter.service.ts

// Evento disparado al crearse un nuevo usuario en ms-users
export interface UserRegisteredPayload {
  event: 'user.registered';
  userId: string;
  email: string;
  passwordHash: string;
  role: string;
  permissions: string[];
  name: string;
  avatarUrl?: string;
  // Discriminador del tipo de cuenta: persona natural vs. institución
  tipo: 'ciudadano' | 'institucion';
  telefono: string;
  region: string;
  comuna: string;
  // Campos específicos para usuarios de tipo "ciudadano"
  primer_nombre?: string;
  segundo_nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  run?: string;
  direccion?: string;
  // Campos específicos para usuarios de tipo "institucion"
  razon_social?: string;
  rut?: string;
  tipo_institucion?: string;
  timestamp: Date;
}

// Evento disparado en cualquier actualización del usuario.
// Todos los campos son opcionales: solo viajan los que cambiaron.
export interface UserUpdatedPayload {
  event: 'user.updated';
  userId: string;
  email?: string;
  role?: string;
  permissions?: string[];
  name?: string;
  avatarUrl?: string;
  status?: 'active' | 'inactive';
  telefono?: string;
  region?: string;
  comuna?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  direccion?: string;
  razon_social?: string;
  timestamp: Date;
}

// Evento disparado al eliminar/desactivar un usuario
export interface UserDeletedPayload {
  event: 'user.deleted';
  userId: string;
  timestamp: Date;
}

// Evento disparado al cambiar la contraseña (solo viaja el nuevo hash)
export interface UserPasswordChangedPayload {
  event: 'user.password.changed';
  userId: string;
  passwordHash: string;
  timestamp: Date;
}
