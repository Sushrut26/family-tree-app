// User & Auth Types
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Family Password Types
export interface FamilyPasswordRequest {
  password: string;
}

export interface FamilyPasswordResponse {
  success: boolean;
  sessionId: string;
  message: string;
}

export interface UpdateFamilyPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Person Types
export interface Person {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreatePersonDto {
  firstName: string;
  middleName?: string;
  lastName: string;
}

export interface UpdatePersonDto {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}

// Relationship Types
export enum RelationshipType {
  PARENT = 'PARENT', // person1 is parent of person2
  SPOUSE = 'SPOUSE', // person1 and person2 are spouses
  SIBLING = 'SIBLING', // person1 and person2 are siblings
}

export interface Relationship {
  id: string;
  person1Id: string;
  person2Id: string;
  type: RelationshipType;
  createdAt: string;
  person1?: Person;
  person2?: Person;
}

export interface CreateRelationshipDto {
  person1Id: string;
  person2Id: string;
  type: RelationshipType;
}

// Export Types
export interface ExportData {
  version: string;
  exportedAt: string;
  exportedBy: string;
  persons: Person[];
  relationships: Relationship[];
}

// Audit Log Types
export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

export enum AuditEntityType {
  USER = 'USER',
  PERSON = 'PERSON',
  RELATIONSHIP = 'RELATIONSHIP',
  FAMILY_CONFIG = 'FAMILY_CONFIG',
}

export interface AuditLog {
  id: string;
  userId: string;
  actionType: AuditActionType;
  entityType: AuditEntityType;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

// Branch Ownership Types
export interface BranchOwnership {
  id: string;
  userId: string;
  personId: string;
  createdAt: string;
}

export interface CanEditResponse {
  canEdit: boolean;
}

// API Error Response
export interface ApiError {
  error: string;
  details?: unknown;
}

// Tree Node for visualization
export interface TreeNode {
  id: string;
  person: Person;
  position: { x: number; y: number };
  parents: TreeNode[];
  children: TreeNode[];
  spouses: TreeNode[];
  siblings: TreeNode[];
}
