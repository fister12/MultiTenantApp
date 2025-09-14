'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SubscriptionStatus } from '@/components/SubscriptionStatus';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: {
    email: string;
  };
}

interface NotesResponse {
  success: boolean;
  data: {
    notes: Note[];
    pagination: {
      page: number;
      limit: number;
      totalCount: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    sorting: {
      sortBy: string;
      sortOrder: string;
    };
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export default function NotesPage() {
  const { token, user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchNotes = async (page = 1) => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/notes?page=${page}&limit=10&sortBy=createdAt&sortOrder=desc`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data: NotesResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to fetch notes');
      }

      if (data.success) {
        setNotes(data.data.notes);
        setPagination(data.data.pagination);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch notes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!token || !confirm('Are you sure you want to delete this note?')) return;
    
    setDeleting(noteId);
    
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to delete note');
      }

      if (data.success) {
        // Refresh the notes list
        await fetchNotes(pagination.page);
      } else {
        throw new Error(data.error?.message || 'Failed to delete note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, [token]);

  const handlePageChange = (newPage: number) => {
    fetchNotes(newPage);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                  ← Dashboard
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">
                  My Notes
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user?.email} ({user?.role}) - {user?.tenantSlug}
                </span>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Header with Create Button */}
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">Notes</h2>
                <p className="text-gray-600">
                  {pagination.totalCount} {pagination.totalCount === 1 ? 'note' : 'notes'} total
                </p>
              </div>
              <div className="flex items-start space-x-4">
                {/* Subscription Status */}
                <div className="bg-white rounded-lg shadow p-4 min-w-[280px]">
                  <SubscriptionStatus 
                    onUpgradeSuccess={() => {
                      // Refresh notes after upgrade in case limits changed
                      fetchNotes(pagination.page);
                    }}
                  />
                </div>
                {/* Create Note Button */}
                <Link
                  href="/notes/new"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center whitespace-nowrap"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Note
                </Link>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading notes...</p>
              </div>
            )}

            {/* Notes List */}
            {!loading && notes.length === 0 && !error && (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No notes</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating your first note.</p>
                <div className="mt-6">
                  <Link
                    href="/notes/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Note
                  </Link>
                </div>
              </div>
            )}

            {/* Notes Grid */}
            {!loading && notes.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {note.title}
                        </h3>
                        <div className="flex space-x-2">
                          <Link
                            href={`/notes/${note.id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            View
                          </Link>
                          <Link
                            href={`/notes/${note.id}/edit`}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => deleteNote(note.id)}
                            disabled={deleting === note.id}
                            className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                          >
                            {deleting === note.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {note.content}
                      </p>
                      <div className="text-xs text-gray-500">
                        <p>Created: {formatDate(note.createdAt)}</p>
                        {note.updatedAt !== note.createdAt && (
                          <p>Updated: {formatDate(note.updatedAt)}</p>
                        )}
                        <p>By: {note.user.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && notes.length > 0 && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPreviousPage}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}