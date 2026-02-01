import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  NodeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Users,
  UserPlus,
  Link as LinkIcon,
  Download,
  LogOut,
  Menu,
  X,
  Loader2,
  Search,
  Trash2,
  Edit2,
  Shield,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { useTreeStore } from '../stores/treeStore';
import { useUIStore } from '../stores/uiStore';
import type { Person, RelationshipType } from '../types';

// Schemas
const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
});

const relationshipSchema = z.object({
  person1Id: z.string().min(1, 'Select the first person'),
  person2Id: z.string().min(1, 'Select the second person'),
  type: z.enum(['PARENT', 'SPOUSE', 'SIBLING']),
});

type PersonFormData = z.infer<typeof personSchema>;
type RelationshipFormData = z.infer<typeof relationshipSchema>;

// Custom node component for persons
function PersonNode({ data }: { data: { person: Person; onEdit: () => void; onDelete: () => void; canEdit: boolean } }) {
  const { person, onEdit, onDelete, canEdit } = data;

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-emerald-200 p-4 min-w-[180px] hover:shadow-xl transition-shadow">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
          <span className="text-emerald-700 font-semibold">
            {person.firstName[0]}{person.lastName[0]}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">
            {person.firstName} {person.lastName}
          </p>
          {person.middleName && (
            <p className="text-xs text-gray-500 truncate">{person.middleName}</p>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-emerald-600 py-1"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-600 hover:text-red-600 py-1"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  person: PersonNode,
};

// Edge colors by relationship type
const edgeColors: Record<string, string> = {
  PARENT: '#059669', // emerald
  SPOUSE: '#d97706', // amber
  SIBLING: '#7c3aed', // violet
};

export function TreeDashboard() {
  const { user, logout } = useAuthStore();
  const {
    persons,
    relationships,
    fetchTree,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    deleteRelationship,
    isLoading,
    error,
    clearError,
  } = useTreeStore();
  const {
    showAddPersonDialog,
    showEditPersonDialog,
    showAddRelationshipDialog,
    showDeleteConfirmDialog,
    setShowAddPersonDialog,
    setShowEditPersonDialog,
    setShowAddRelationshipDialog,
    setShowDeleteConfirmDialog,
    showToast,
    isSidebarOpen,
    toggleSidebar,
  } = useUIStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);

  // Person form
  const personForm = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
  });

  // Relationship form
  const relationshipForm = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipSchema),
  });

  // Fetch tree on mount
  useEffect(() => {
    fetchTree().catch(() => {
      // Error handled by store
    });
  }, [fetchTree]);

  // Convert persons and relationships to nodes and edges
  useEffect(() => {
    const nodeMap = new Map<string, { x: number; y: number }>();

    // Simple grid layout
    const cols = Math.ceil(Math.sqrt(persons.length));
    persons.forEach((person, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      nodeMap.set(person.id, { x: col * 250, y: row * 180 });
    });

    const newNodes: Node[] = persons.map((person) => ({
      id: person.id,
      type: 'person',
      position: nodeMap.get(person.id) || { x: 0, y: 0 },
      data: {
        person,
        canEdit: person.createdById === user?.id || user?.role === 'ADMIN',
        onEdit: () => {
          setEditingPerson(person);
          personForm.reset({
            firstName: person.firstName,
            middleName: person.middleName || '',
            lastName: person.lastName,
          });
          setShowEditPersonDialog(true);
        },
        onDelete: () => {
          setDeletingPerson(person);
          setShowDeleteConfirmDialog(true);
        },
      },
    }));

    const newEdges: Edge[] = relationships.map((rel) => ({
      id: rel.id,
      source: rel.person1Id,
      target: rel.person2Id,
      type: 'smoothstep',
      animated: rel.type === 'SPOUSE',
      style: { stroke: edgeColors[rel.type] || '#666', strokeWidth: 2 },
      markerEnd: rel.type === 'PARENT' ? { type: MarkerType.ArrowClosed, color: edgeColors.PARENT } : undefined,
      label: rel.type,
      labelStyle: { fontSize: 10, fill: '#666' },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  }, [persons, relationships, user, setNodes, setEdges, personForm, setShowEditPersonDialog, setShowDeleteConfirmDialog]);

  // Filter nodes by search
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const query = searchQuery.toLowerCase();
    return nodes.filter((node) => {
      const person = node.data.person as Person;
      return (
        person.firstName.toLowerCase().includes(query) ||
        person.lastName.toLowerCase().includes(query) ||
        (person.middleName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [nodes, searchQuery]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  // Handle add person
  const handleAddPerson = async (data: PersonFormData) => {
    try {
      await addPerson(data);
      showToast('Person added successfully!', 'success');
      setShowAddPersonDialog(false);
      personForm.reset();
    } catch {
      showToast('Failed to add person', 'error');
    }
  };

  // Handle edit person
  const handleEditPerson = async (data: PersonFormData) => {
    if (!editingPerson) return;
    try {
      await updatePerson(editingPerson.id, data);
      showToast('Person updated successfully!', 'success');
      setShowEditPersonDialog(false);
      setEditingPerson(null);
      personForm.reset();
    } catch {
      showToast('Failed to update person', 'error');
    }
  };

  // Handle delete person
  const handleDeletePerson = async () => {
    if (!deletingPerson) return;
    try {
      await deletePerson(deletingPerson.id);
      showToast('Person deleted successfully!', 'success');
      setShowDeleteConfirmDialog(false);
      setDeletingPerson(null);
    } catch {
      showToast('Failed to delete person', 'error');
    }
  };

  // Handle add relationship
  const handleAddRelationship = async (data: RelationshipFormData) => {
    try {
      await addRelationship({
        person1Id: data.person1Id,
        person2Id: data.person2Id,
        type: data.type as RelationshipType,
      });
      showToast('Relationship added successfully!', 'success');
      setShowAddRelationshipDialog(false);
      relationshipForm.reset();
    } catch {
      showToast('Failed to add relationship', 'error');
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const { exportTree } = useTreeStore.getState();
      const data = await exportTree();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tree-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Tree exported successfully!', 'success');
    } catch {
      showToast('Failed to export tree', 'error');
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <h1 className="text-xl font-bold text-gray-900">Family Tree</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search family members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent w-64"
            />
          </div>

          <div className="flex items-center gap-3">
            {user?.role === 'ADMIN' && (
              <a
                href="/admin"
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-emerald-600"
              >
                <Shield size={16} />
                <span className="hidden sm:inline">Admin</span>
              </a>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-700 text-sm font-semibold">
                  {user?.firstName[0]}{user?.lastName[0]}
                </span>
              </div>
              <span className="hidden sm:inline text-sm text-gray-700">
                {user?.firstName}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 fixed lg:relative inset-y-0 left-0 z-40
            w-64 bg-white border-r border-gray-200 p-4
            transition-transform duration-200 ease-in-out
            lg:mt-0 mt-[57px]
          `}
        >
          <div className="space-y-2">
            <button
              onClick={() => {
                personForm.reset();
                setShowAddPersonDialog(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <UserPlus size={20} />
              Add Person
            </button>

            <button
              onClick={() => {
                relationshipForm.reset();
                setShowAddRelationshipDialog(true);
              }}
              disabled={persons.length < 2}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LinkIcon size={20} />
              Add Relationship
            </button>

            <button
              onClick={handleExport}
              disabled={persons.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              Export Tree
            </button>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Legend</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-emerald-600 rounded" />
                <span className="text-gray-600">Parent → Child</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-amber-600 rounded" style={{ background: 'repeating-linear-gradient(90deg, #d97706, #d97706 4px, transparent 4px, transparent 8px)' }} />
                <span className="text-gray-600">Spouse</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-violet-600 rounded" />
                <span className="text-gray-600">Sibling</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Members</span>
                <span className="font-semibold text-gray-900">{persons.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Relationships</span>
                <span className="font-semibold text-gray-900">{relationships.length}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={toggleSidebar}
          />
        )}

        {/* Main content - React Flow */}
        <main className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-red-50 text-red-700 px-4 py-2 rounded-lg shadow-lg">
              {error}
              <button onClick={clearError} className="ml-2 text-red-500 hover:text-red-700">
                <X size={16} />
              </button>
            </div>
          )}

          {persons.length === 0 && !isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-700 mb-2">No family members yet</h2>
                <p className="text-gray-500 mb-6">Start building your family tree by adding the first person.</p>
                <button
                  onClick={() => {
                    personForm.reset();
                    setShowAddPersonDialog(true);
                  }}
                  className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <UserPlus size={20} />
                  Add First Person
                </button>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              className="bg-gray-50"
            >
              <Background color="#e5e7eb" gap={20} />
              <Controls />
              <MiniMap
                nodeColor={() => '#059669'}
                maskColor="rgba(0, 0, 0, 0.1)"
              />
            </ReactFlow>
          )}
        </main>
      </div>

      {/* Add Person Dialog */}
      {showAddPersonDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Family Member</h2>
            <form onSubmit={personForm.handleSubmit(handleAddPerson)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  {...personForm.register('firstName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="John"
                />
                {personForm.formState.errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{personForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name (optional)</label>
                <input
                  {...personForm.register('middleName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Michael"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  {...personForm.register('lastName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Doe"
                />
                {personForm.formState.errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{personForm.formState.errors.lastName.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPersonDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Person'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Person Dialog */}
      {showEditPersonDialog && editingPerson && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Family Member</h2>
            <form onSubmit={personForm.handleSubmit(handleEditPerson)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  {...personForm.register('firstName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {personForm.formState.errors.firstName && (
                  <p className="mt-1 text-sm text-red-600">{personForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name (optional)</label>
                <input
                  {...personForm.register('middleName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  {...personForm.register('lastName')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                {personForm.formState.errors.lastName && (
                  <p className="mt-1 text-sm text-red-600">{personForm.formState.errors.lastName.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPersonDialog(false);
                    setEditingPerson(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmDialog && deletingPerson && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete Family Member</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {deletingPerson.firstName} {deletingPerson.lastName}?
              This will also remove all their relationships. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmDialog(false);
                  setDeletingPerson(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePerson}
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Relationship Dialog */}
      {showAddRelationshipDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add Relationship</h2>
            <form onSubmit={relationshipForm.handleSubmit(handleAddRelationship)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Person</label>
                <select
                  {...relationshipForm.register('person1Id')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select a person</option>
                  {persons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
                {relationshipForm.formState.errors.person1Id && (
                  <p className="mt-1 text-sm text-red-600">{relationshipForm.formState.errors.person1Id.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Type</label>
                <select
                  {...relationshipForm.register('type')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="PARENT">is parent of</option>
                  <option value="SPOUSE">is spouse of</option>
                  <option value="SIBLING">is sibling of</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Second Person</label>
                <select
                  {...relationshipForm.register('person2Id')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">Select a person</option>
                  {persons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
                {relationshipForm.formState.errors.person2Id && (
                  <p className="mt-1 text-sm text-red-600">{relationshipForm.formState.errors.person2Id.message}</p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddRelationshipDialog(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add Relationship'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
