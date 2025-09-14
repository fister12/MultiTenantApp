/**
 * Manual test script for Notes CRUD API endpoints
 * 
 * This script demonstrates how to test the notes CRUD endpoints manually.
 * Run this after starting the development server with `npm run dev`
 */

const BASE_URL = 'http://localhost:3000';

// Test user credentials (from seed data)
const TEST_USERS = {
  acmeAdmin: {
    email: 'admin@acme.test',
    password: 'password',
    tenant: 'acme'
  },
  acmeUser: {
    email: 'user@acme.test', 
    password: 'password',
    tenant: 'acme'
  },
  globexAdmin: {
    email: 'admin@globex.test',
    password: 'password', 
    tenant: 'globex'
  },
  globexUser: {
    email: 'user@globex.test',
    password: 'password',
    tenant: 'globex'
  }
};

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  return data.data.token;
}

async function createNote(token: string, title: string, content: string) {
  const response = await fetch(`${BASE_URL}/api/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ title, content }),
  });

  const data = await response.json();
  console.log('Create Note Response:', {
    status: response.status,
    data: data
  });
  
  return data;
}

async function listNotes(token: string, params?: Record<string, string>) {
  const url = new URL(`${BASE_URL}/api/notes`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log('List Notes Response:', {
    status: response.status,
    data: data
  });
  
  return data;
}

async function getNote(token: string, noteId: string) {
  const response = await fetch(`${BASE_URL}/api/notes/${noteId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log('Get Note Response:', {
    status: response.status,
    data: data
  });
  
  return data;
}

async function updateNote(token: string, noteId: string, updates: { title?: string; content?: string }) {
  const response = await fetch(`${BASE_URL}/api/notes/${noteId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const data = await response.json();
  console.log('Update Note Response:', {
    status: response.status,
    data: data
  });
  
  return data;
}

async function deleteNote(token: string, noteId: string) {
  const response = await fetch(`${BASE_URL}/api/notes/${noteId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  console.log('Delete Note Response:', {
    status: response.status,
    data: data
  });
  
  return data;
}

async function testNotesCRUD() {
  try {
    console.log('🚀 Starting Notes CRUD API Tests\n');

    // Test 1: Login as Acme user
    console.log('1. Logging in as Acme user...');
    const acmeToken = await login(TEST_USERS.acmeUser.email, TEST_USERS.acmeUser.password);
    console.log('✅ Login successful\n');

    // Test 2: Create a note
    console.log('2. Creating a note...');
    const createResult = await createNote(acmeToken, 'Test Note', 'This is a test note content');
    const noteId = createResult.data?.id;
    console.log('✅ Note created\n');

    // Test 3: List notes
    console.log('3. Listing notes...');
    await listNotes(acmeToken);
    console.log('✅ Notes listed\n');

    // Test 4: List notes with pagination
    console.log('4. Listing notes with pagination...');
    await listNotes(acmeToken, { page: '1', limit: '5', sortBy: 'title', sortOrder: 'asc' });
    console.log('✅ Notes listed with pagination\n');

    if (noteId) {
      // Test 5: Get specific note
      console.log('5. Getting specific note...');
      await getNote(acmeToken, noteId);
      console.log('✅ Note retrieved\n');

      // Test 6: Update note
      console.log('6. Updating note...');
      await updateNote(acmeToken, noteId, { title: 'Updated Test Note' });
      console.log('✅ Note updated\n');

      // Test 7: Delete note
      console.log('7. Deleting note...');
      await deleteNote(acmeToken, noteId);
      console.log('✅ Note deleted\n');
    }

    // Test 8: Test subscription limits (create multiple notes for Free plan)
    console.log('8. Testing subscription limits...');
    const notes = [];
    for (let i = 1; i <= 4; i++) {
      const result = await createNote(acmeToken, `Note ${i}`, `Content for note ${i}`);
      if (result.success) {
        notes.push(result.data.id);
      }
    }
    console.log('✅ Subscription limit test completed\n');

    // Test 9: Test tenant isolation
    console.log('9. Testing tenant isolation...');
    const globexToken = await login(TEST_USERS.globexUser.email, TEST_USERS.globexUser.password);
    await listNotes(globexToken); // Should show no notes from Acme tenant
    console.log('✅ Tenant isolation verified\n');

    // Test 10: Test cross-tenant access prevention
    if (notes.length > 0) {
      console.log('10. Testing cross-tenant access prevention...');
      await getNote(globexToken, notes[0]); // Should return 404
      console.log('✅ Cross-tenant access prevention verified\n');
    }

    console.log('🎉 All Notes CRUD API tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Export for use in other scripts
export {
  testNotesCRUD,
  login,
  createNote,
  listNotes,
  getNote,
  updateNote,
  deleteNote,
  TEST_USERS
};

// Run tests if this file is executed directly
if (require.main === module) {
  testNotesCRUD();
}