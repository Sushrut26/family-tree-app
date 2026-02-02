import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  addEdge,
  type NodeTypes,
  MarkerType,
  Handle,
  Position,
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
  LayoutGrid,
  Loader2,
  Search,
  Trash2,
  Edit2,
  Shield,
  Upload,
  Plus,
  Minus,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../stores/authStore';
import { useTreeStore } from '../stores/treeStore';
import { useUIStore } from '../stores/uiStore';
import type { Person, Relationship, RelationshipType, BulkImportEntry, BulkRelationshipType } from '../types';

// Schemas
const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
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
      <Handle type="target" position={Position.Top} id="top" className="opacity-0 pointer-events-none" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="opacity-0 pointer-events-none" />
      <Handle type="target" position={Position.Left} id="left" className="opacity-0 pointer-events-none" />
      <Handle type="source" position={Position.Right} id="right" className="opacity-0 pointer-events-none" />
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

// Edge styles by relationship type
const edgeStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string }> = {
  PARENT: { stroke: '#059669', strokeWidth: 3 }, // Solid emerald line with arrow
  SPOUSE: { stroke: '#dc2626', strokeWidth: 2, strokeDasharray: '5,5' }, // Dashed red line (hearts/love)
  SIBLING: { stroke: '#2563eb', strokeWidth: 2, strokeDasharray: '2,4' }, // Dotted blue line
};

const NODE_X_SPACING = 200;
const NODE_Y_SPACING = 150;
const GROUP_GAP = 0.3;

const computeHierarchyPositions = (
  persons: Person[],
  relationships: Relationship[]
): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;

  const personMap = new Map(persons.map((person) => [person.id, person]));
  const parentIdsByChild = new Map<string, string[]>();
  const spouseLinks = new Map<string, Set<string>>();

  for (const person of persons) {
    parentIdsByChild.set(person.id, []);
    spouseLinks.set(person.id, new Set());
  }

  for (const rel of relationships) {
    if (rel.relationshipType === 'PARENT') {
      parentIdsByChild.get(rel.person2Id)?.push(rel.person1Id);
    } else if (rel.relationshipType === 'SPOUSE') {
      spouseLinks.get(rel.person1Id)?.add(rel.person2Id);
      spouseLinks.get(rel.person2Id)?.add(rel.person1Id);
    }
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();

  const getDepth = (id: string): number => {
    if (depth.has(id)) return depth.get(id) ?? 0;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = parentIdsByChild.get(id) || [];
    let value = 0;
    if (parents.length > 0) {
      value = Math.max(...parents.map((parentId) => getDepth(parentId))) + 1;
    }
    depth.set(id, value);
    visiting.delete(id);
    return value;
  };

  for (const person of persons) {
    getDepth(person.id);
  }

  const ufParent = new Map<string, string>();
  const ufFind = (id: string): string => {
    const parent = ufParent.get(id) ?? id;
    if (parent === id) {
      ufParent.set(id, id);
      return id;
    }
    const root = ufFind(parent);
    ufParent.set(id, root);
    return root;
  };
  const ufUnion = (a: string, b: string) => {
    const rootA = ufFind(a);
    const rootB = ufFind(b);
    if (rootA !== rootB) {
      ufParent.set(rootB, rootA);
    }
  };

  for (const [id, spouses] of spouseLinks.entries()) {
    for (const spouseId of spouses) {
      ufUnion(id, spouseId);
    }
  }

  const spouseGroups = new Map<string, string[]>();
  for (const person of persons) {
    const root = ufFind(person.id);
    const group = spouseGroups.get(root) || [];
    group.push(person.id);
    spouseGroups.set(root, group);
  }

  let changed = true;
  let guard = 0;
  while (changed && guard < persons.length * 4) {
    guard += 1;
    changed = false;

    for (const group of spouseGroups.values()) {
      let maxDepth = 0;
      for (const id of group) {
        maxDepth = Math.max(maxDepth, depth.get(id) ?? 0);
      }
      for (const id of group) {
        if ((depth.get(id) ?? 0) !== maxDepth) {
          depth.set(id, maxDepth);
          changed = true;
        }
      }
    }

    for (const [childId, parentIds] of parentIdsByChild.entries()) {
      if (parentIds.length === 0) continue;
      let maxParentDepth = 0;
      for (const parentId of parentIds) {
        maxParentDepth = Math.max(maxParentDepth, depth.get(parentId) ?? 0);
      }
      const requiredDepth = maxParentDepth + 1;
      if ((depth.get(childId) ?? 0) < requiredDepth) {
        depth.set(childId, requiredDepth);
        changed = true;
      }
    }
  }

  const groupsByDepth = new Map<number, string[][]>();
  for (const group of spouseGroups.values()) {
    let groupDepth = 0;
    for (const id of group) {
      groupDepth = Math.max(groupDepth, depth.get(id) ?? 0);
    }
    const list = groupsByDepth.get(groupDepth) || [];
    list.push(group);
    groupsByDepth.set(groupDepth, list);
  }

  const getLabel = (id: string) => {
    const person = personMap.get(id);
    if (!person) return id;
    return `${person.firstName} ${person.lastName}`.toLowerCase();
  };

  const sortedDepths = [...groupsByDepth.keys()].sort((a, b) => a - b);
  for (const level of sortedDepths) {
    const groups = groupsByDepth.get(level) || [];
    const baseOrder = [...groups].sort((a, b) => {
      const aLabel = a.map(getLabel).sort()[0] || '';
      const bLabel = b.map(getLabel).sort()[0] || '';
      return aLabel.localeCompare(bLabel);
    });

    type GroupLayout = {
      members: string[];
      desiredCenter: number;
      center: number;
      width: number;
      minCenter: number;
      left: number;
      right: number;
      labelKey: string;
    };

    const layouts: GroupLayout[] = baseOrder.map((group, index) => {
      const members = [...group].sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
      const parentXs: number[] = [];
      const seenParents = new Set<string>();

      for (const member of members) {
        for (const parentId of parentIdsByChild.get(member) || []) {
          if (seenParents.has(parentId)) continue;
          const parentPos = positions.get(parentId);
          if (parentPos) {
            parentXs.push(parentPos.x);
            seenParents.add(parentId);
          }
        }
      }

      const fallbackCenter = (index + 0.5) * NODE_X_SPACING;
      const desiredCenter = parentXs.length > 0
        ? parentXs.reduce((sum, value) => sum + value, 0) / parentXs.length
        : fallbackCenter;
      const width = members.length * NODE_X_SPACING;
      const labelKey = members.map(getLabel).sort()[0] || '';

      return {
        members,
        desiredCenter,
        center: desiredCenter,
        width,
        minCenter: desiredCenter,
        left: desiredCenter - width / 2,
        right: desiredCenter + width / 2,
        labelKey,
      };
    });

    layouts.sort((a, b) => {
      if (a.desiredCenter !== b.desiredCenter) {
        return a.desiredCenter - b.desiredCenter;
      }
      return a.labelKey.localeCompare(b.labelKey);
    });

    const gap = NODE_X_SPACING * GROUP_GAP;
    let previousRight = -Infinity;
    for (const layout of layouts) {
      const half = layout.width / 2;
      const minCenter = previousRight === -Infinity
        ? layout.desiredCenter
        : previousRight + gap + half;
      const center = Math.max(layout.desiredCenter, minCenter);
      layout.minCenter = minCenter;
      layout.center = center;
      layout.left = center - half;
      layout.right = center + half;
      previousRight = layout.right;
    }

    for (let i = layouts.length - 1; i >= 0; i -= 1) {
      const layout = layouts[i];
      const half = layout.width / 2;
      const nextLeft = i === layouts.length - 1 ? Infinity : layouts[i + 1].left;
      const maxCenter = nextLeft === Infinity ? layout.center : nextLeft - gap - half;
      let center = Math.min(layout.center, maxCenter);
      if (center < layout.minCenter) {
        center = layout.minCenter;
      }
      layout.center = center;
      layout.left = center - half;
      layout.right = center + half;
    }

    for (const layout of layouts) {
      const startX = layout.center - layout.width / 2 + NODE_X_SPACING / 2;
      for (let i = 0; i < layout.members.length; i += 1) {
        positions.set(layout.members[i], {
          x: startX + i * NODE_X_SPACING,
          y: level * NODE_Y_SPACING,
        });
      }
    }
  }

  return positions;
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
    bulkImport,
    isLoading,
    error,
    clearError,
  } = useTreeStore();
  const {
    showAddPersonDialog,
    showEditPersonDialog,
    showAddRelationshipDialog,
    showDeleteConfirmDialog,
    showBulkImportDialog,
    setShowAddPersonDialog,
    setShowEditPersonDialog,
    setShowAddRelationshipDialog,
    setShowDeleteConfirmDialog,
    setShowBulkImportDialog,
    showToast,
    isSidebarOpen,
    toggleSidebar,
  } = useUIStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [deletingPerson, setDeletingPerson] = useState<Person | null>(null);

  // Bulk import state
  const emptyBulkRow: BulkImportEntry = {
    firstName: '',
    lastName: '',
    relatedFirstName: '',
    relatedLastName: '',
    relationshipType: undefined,
  };
  const [bulkRows, setBulkRows] = useState<BulkImportEntry[]>([{ ...emptyBulkRow }]);

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
    const positionMap = computeHierarchyPositions(persons, relationships);

    const newNodes: Node[] = persons.map((person) => ({
      id: person.id,
      type: 'person',
      position: positionMap.get(person.id) || { x: 0, y: 0 },
      data: {
        person,
        canEdit: person.createdById === user?.id || user?.role === 'ADMIN',
        onEdit: () => {
          setEditingPerson(person);
          personForm.reset({
            firstName: person.firstName,
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

    const newEdges: Edge[] = relationships.map((rel) => {
      const style = edgeStyles[rel.relationshipType] || { stroke: '#666', strokeWidth: 2 };
      const handlePositions = rel.relationshipType === 'PARENT'
        ? { sourceHandle: 'bottom', targetHandle: 'top' }
        : { sourceHandle: 'right', targetHandle: 'left' };
      return {
        id: rel.id,
        source: rel.person1Id,
        target: rel.person2Id,
        type: 'smoothstep',
        animated: false,
        style: style,
        ...handlePositions,
        markerEnd: rel.relationshipType === 'PARENT' ? {
          type: MarkerType.ArrowClosed,
          color: style.stroke,
          width: 20,
          height: 20,
        } : undefined,
        // No label - the line style itself indicates the relationship type
      };
    });

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
        person.lastName.toLowerCase().includes(query)
      );
    });
  }, [nodes, searchQuery]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges]
  );

  const handleFormatTree = useCallback(() => {
    const positionMap = computeHierarchyPositions(persons, relationships);
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        position: positionMap.get(node.id) || node.position,
      }))
    );
  }, [persons, relationships, setNodes]);

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
        relationshipType: data.type as RelationshipType,
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

  // Handle bulk import
  const handleBulkImport = async () => {
    // Filter out empty rows
    const validEntries = bulkRows.filter(
      (row) => row.firstName.trim() && row.lastName.trim()
    );

    if (validEntries.length === 0) {
      showToast('Please add at least one person with first and last name', 'error');
      return;
    }

    try {
      const result = await bulkImport(validEntries);
      showToast(
        `Successfully added ${result.persons.length} people and ${result.relationshipsCreated} relationships!`,
        'success'
      );
      setShowBulkImportDialog(false);
      setBulkRows([{ ...emptyBulkRow }]);
    } catch {
      showToast('Failed to import people', 'error');
    }
  };

  const addBulkRow = () => {
    setBulkRows([...bulkRows, { ...emptyBulkRow }]);
  };

  const removeBulkRow = (index: number) => {
    if (bulkRows.length > 1) {
      setBulkRows(bulkRows.filter((_, i) => i !== index));
    }
  };

  const updateBulkRow = (index: number, field: keyof BulkImportEntry, value: string) => {
    const newRows = [...bulkRows];
    if (field === 'relationshipType') {
      newRows[index][field] = value as BulkRelationshipType | undefined;
    } else {
      newRows[index][field] = value;
    }
    setBulkRows(newRows);
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
              onClick={() => {
                setBulkRows([{ ...emptyBulkRow }]);
                setShowBulkImportDialog(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border border-amber-400 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
            >
              <Upload size={20} />
              Add in Bulk
            </button>

            <button
              onClick={handleExport}
              disabled={persons.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              Export Tree
            </button>

            <button
              onClick={handleFormatTree}
              disabled={persons.length === 0}
              className="w-full flex items-center gap-3 px-4 py-3 text-left border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LayoutGrid size={20} />
              Format Tree
            </button>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Legend</h3>
            <div className="space-y-3 text-sm">
              {/* Parent -> Child: Solid green line with arrow */}
              <div className="flex items-center gap-3">
                <div className="flex items-center w-16">
                  <svg width="60" height="16" viewBox="0 0 60 16">
                    <line x1="0" y1="8" x2="45" y2="8" stroke="#059669" strokeWidth="3" />
                    <polygon points="45,4 55,8 45,12" fill="#059669" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Parent → Child</span>
              </div>
              {/* Spouse: Dashed red line */}
              <div className="flex items-center gap-3">
                <div className="flex items-center w-16">
                  <svg width="60" height="16" viewBox="0 0 60 16">
                    <line x1="0" y1="8" x2="55" y2="8" stroke="#dc2626" strokeWidth="2" strokeDasharray="5,5" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Spouse / Partner</span>
              </div>
              {/* Sibling: Dotted blue line */}
              <div className="flex items-center gap-3">
                <div className="flex items-center w-16">
                  <svg width="60" height="16" viewBox="0 0 60 16">
                    <line x1="0" y1="8" x2="55" y2="8" stroke="#2563eb" strokeWidth="2" strokeDasharray="2,4" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Sibling</span>
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

      {/* Bulk Import Dialog */}
      {showBulkImportDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Bulk Add Family Members</h2>
              <button
                onClick={() => setShowBulkImportDialog(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800">
                <strong>Smart Linking:</strong> Siblings will share the same parents automatically. Spouses will inherit
                each other’s children, and when a child is added to a parent, that child is linked to the parent’s spouse too.
              </p>
            </div>

            <div className="overflow-auto flex-1 mb-4">
              <table className="w-full border-collapse min-w-[800px]">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b">First Name *</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b">Last Name *</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b">Relation Type</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b">Related First Name</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b">Related Last Name</th>
                    <th className="text-center text-xs font-semibold text-gray-600 uppercase px-3 py-2 border-b w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.firstName}
                          onChange={(e) => updateBulkRow(index, 'firstName', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                          placeholder="John"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.lastName}
                          onChange={(e) => updateBulkRow(index, 'lastName', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                          placeholder="Doe"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.relationshipType || ''}
                          onChange={(e) => updateBulkRow(index, 'relationshipType', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                        >
                          <option value="">No relation</option>
                          <option value="PARENT">is child of</option>
                          <option value="CHILD">is parent of</option>
                          <option value="SPOUSE">is spouse of</option>
                          <option value="SIBLING">is sibling of</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.relatedFirstName || ''}
                          onChange={(e) => updateBulkRow(index, 'relatedFirstName', e.target.value)}
                          disabled={!row.relationshipType}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          placeholder="Jane"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={row.relatedLastName || ''}
                          onChange={(e) => updateBulkRow(index, 'relatedLastName', e.target.value)}
                          disabled={!row.relationshipType}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-400"
                          placeholder="Doe"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => removeBulkRow(index)}
                          disabled={bulkRows.length === 1}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        >
                          <Minus size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <button
                onClick={addBulkRow}
                className="flex items-center gap-2 px-4 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
              >
                <Plus size={18} />
                Add Row
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkImportDialog(false)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={isLoading || bulkRows.every((r) => !r.firstName.trim() || !r.lastName.trim())}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Import {bulkRows.filter((r) => r.firstName.trim() && r.lastName.trim()).length} People
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
