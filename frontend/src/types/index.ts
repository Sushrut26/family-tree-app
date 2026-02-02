// User & Auth Types
export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

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
  token?: string;
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
  lastName: string;
}

export interface UpdatePersonDto {
  firstName?: string;
  lastName?: string;
}

// Relationship Types
export const RelationshipType = {
  PARENT: 'PARENT', // person1 is parent of person2
  SPOUSE: 'SPOUSE', // person1 and person2 are spouses
  SIBLING: 'SIBLING', // person1 and person2 are siblings
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];

export interface Relationship {
  id: string;
  person1Id: string;
  person2Id: string;
  relationshipType: RelationshipType;
  createdAt: string;
  person1?: Person;
  person2?: Person;
}

export interface CreateRelationshipDto {
  person1Id: string;
  person2Id: string;
  relationshipType: RelationshipType;
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
export const AuditActionType = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  SECURITY_ALERT: 'SECURITY_ALERT',
} as const;

export type AuditActionType = (typeof AuditActionType)[keyof typeof AuditActionType];

export const AuditEntityType = {
  USER: 'USER',
  PERSON: 'PERSON',
  RELATIONSHIP: 'RELATIONSHIP',
  FAMILY_CONFIG: 'FAMILY_CONFIG',
} as const;

export type AuditEntityType = (typeof AuditEntityType)[keyof typeof AuditEntityType];

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

// Bulk Import Types
export const BulkRelationshipType = {
  PARENT: 'PARENT',   // The person in this row is the CHILD of the related person
  CHILD: 'CHILD',     // The person in this row is the PARENT of the related person
  SPOUSE: 'SPOUSE',
  SIBLING: 'SIBLING',
} as const;

export type BulkRelationshipType = (typeof BulkRelationshipType)[keyof typeof BulkRelationshipType];

export interface BulkImportEntry {
  firstName: string;
  lastName: string;
  relatedFirstName?: string;
  relatedLastName?: string;
  relationshipType?: BulkRelationshipType;
}

export interface BulkImportResponse {
  message: string;
  persons: Person[];
  relationshipsCreated: number;
}
