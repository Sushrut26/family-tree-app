import { create } from 'zustand';
import api, { getErrorMessage } from '../lib/api';
import type {
  Person,
  Relationship,
  CreatePersonDto,
  UpdatePersonDto,
  CreateRelationshipDto,
  ExportData,
  BulkImportEntry,
  BulkImportResponse,
} from '../types';

interface TreeState {
  // State
  persons: Person[];
  relationships: Relationship[];
  selectedPerson: Person | null;
  isLoading: boolean;
  error: string | null;

  // Actions - Persons
  fetchTree: () => Promise<void>;
  fetchPersons: () => Promise<void>;
  addPerson: (person: CreatePersonDto) => Promise<Person>;
  updatePerson: (id: string, person: UpdatePersonDto) => Promise<Person>;
  deletePerson: (id: string) => Promise<void>;
  selectPerson: (person: Person | null) => void;
  checkEditPermission: (personId: string) => Promise<boolean>;

  // Actions - Relationships
  fetchRelationships: () => Promise<void>;
  addRelationship: (relationship: CreateRelationshipDto) => Promise<Relationship>;
  deleteRelationship: (id: string) => Promise<void>;
  normalizeRelationships: () => Promise<void>;

  // Actions - Export
  exportTree: () => Promise<ExportData>;
  exportRelationshipsPdf: (scope?: 'full' | 'user-only') => Promise<Blob>;

  // Actions - Bulk Import
  bulkImport: (entries: BulkImportEntry[]) => Promise<BulkImportResponse>;

  // Utilities
  clearError: () => void;
  reset: () => void;
}

export const useTreeStore = create<TreeState>((set, _get) => ({
  // Initial state
  persons: [],
  relationships: [],
  selectedPerson: null,
  isLoading: false,
  error: null,

  // Fetch entire tree (persons + relationships)
  fetchTree: async () => {
    set({ isLoading: true, error: null });

    try {
      const [personsResponse, relationshipsResponse] = await Promise.all([
        api.get<Person[]>('/persons'),
        api.get<Relationship[]>('/relationships'),
      ]);

      set({
        persons: personsResponse.data,
        relationships: relationshipsResponse.data,
        isLoading: false,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Fetch all persons
  fetchPersons: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<Person[]>('/persons');
      set({ persons: response.data, isLoading: false });
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Add a new person
  addPerson: async (personDto: CreatePersonDto) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<Person>('/persons', personDto);
      const newPerson = response.data;

      set((state) => ({
        persons: [...state.persons, newPerson],
        isLoading: false,
      }));

      return newPerson;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Update an existing person
  updatePerson: async (id: string, personDto: UpdatePersonDto) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.put<Person>(`/persons/${id}`, personDto);
      const updatedPerson = response.data;

      set((state) => ({
        persons: state.persons.map((p) => (p.id === id ? updatedPerson : p)),
        selectedPerson:
          state.selectedPerson?.id === id ? updatedPerson : state.selectedPerson,
        isLoading: false,
      }));

      return updatedPerson;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Delete a person
  deletePerson: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      await api.delete(`/persons/${id}`);

      set((state) => ({
        persons: state.persons.filter((p) => p.id !== id),
        relationships: state.relationships.filter(
          (r) => r.person1Id !== id && r.person2Id !== id
        ),
        selectedPerson: state.selectedPerson?.id === id ? null : state.selectedPerson,
        isLoading: false,
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Select a person
  selectPerson: (person: Person | null) => {
    set({ selectedPerson: person });
  },

  // Check if user can edit a person
  checkEditPermission: async (personId: string) => {
    try {
      const response = await api.get<{ canEdit: boolean }>(
        `/persons/${personId}/can-edit`
      );
      return response.data.canEdit;
    } catch (error) {
      console.error('Failed to check edit permission:', error);
      return false;
    }
  },

  // Fetch all relationships
  fetchRelationships: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<Relationship[]>('/relationships');
      set({ relationships: response.data, isLoading: false });
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Add a new relationship
  addRelationship: async (relationshipDto: CreateRelationshipDto) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<Relationship>('/relationships', relationshipDto);

      // Refetch to capture any auto-linked relationships
      const [personsResponse, relationshipsResponse] = await Promise.all([
        api.get<Person[]>('/persons'),
        api.get<Relationship[]>('/relationships'),
      ]);

      set({
        persons: personsResponse.data,
        relationships: relationshipsResponse.data,
        isLoading: false,
      });

      return response.data;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Delete a relationship
  deleteRelationship: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      await api.delete(`/relationships/${id}`);

      set((state) => ({
        relationships: state.relationships.filter((r) => r.id !== id),
        isLoading: false,
      }));
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Normalize relationships (auto-link parents/spouses/siblings)
  normalizeRelationships: async () => {
    set({ isLoading: true, error: null });

    try {
      await api.post('/relationships/normalize');

      const [personsResponse, relationshipsResponse] = await Promise.all([
        api.get<Person[]>('/persons'),
        api.get<Relationship[]>('/relationships'),
      ]);

      set({
        persons: personsResponse.data,
        relationships: relationshipsResponse.data,
        isLoading: false,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Export tree as JSON
  exportTree: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get<ExportData>('/export', {
        params: { format: 'json' },
      });

      set({ isLoading: false });
      return response.data;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Export relationships as PDF
  exportRelationshipsPdf: async (scope: 'full' | 'user-only' = 'user-only') => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.get('/export', {
        params: { format: 'pdf', scope },
        responseType: 'blob',
      });

      set({ isLoading: false });
      return response.data as Blob;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Bulk import persons with relationships
  bulkImport: async (entries: BulkImportEntry[]) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<BulkImportResponse>('/persons/bulk-import', { entries });

      // Refetch the entire tree to get updated data
      const [personsResponse, relationshipsResponse] = await Promise.all([
        api.get<Person[]>('/persons'),
        api.get<Relationship[]>('/relationships'),
      ]);

      set({
        persons: personsResponse.data,
        relationships: relationshipsResponse.data,
        isLoading: false,
      });

      return response.data;
    } catch (error) {
      const message = getErrorMessage(error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Reset store
  reset: () => {
    set({
      persons: [],
      relationships: [],
      selectedPerson: null,
      isLoading: false,
      error: null,
    });
  },
}));
