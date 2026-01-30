import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000/api';

test.describe('API Health Check', () => {
  let token: string;
  let createdSessionId: string;

  // 所有 API 测试共享 token，需要在 beforeAll 中获取
  test.beforeAll(async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { username: 'admin', password: 'Admin@123' },
    });
    const body = await res.json();
    token = body.accessToken;
  });

  test('POST /auth/login with correct credentials → 200', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { username: 'admin', password: 'Admin@123' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toBeTruthy();
    expect(body.user).toBeTruthy();
    expect(body.user.username).toBe('admin');
  });

  test('POST /auth/login with wrong password → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/auth/login`, {
      data: { username: 'admin', password: 'wrongpassword123' },
    });
    expect(res.status()).toBe(401);
  });

  test('GET /sessions → 200 + array', async ({ request }) => {
    const res = await request.get(`${BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body) || Array.isArray(body.data)).toBeTruthy();
  });

  test('POST /sessions create → returns id', async ({ request }) => {
    const res = await request.post(`${BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'test-api-health' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    createdSessionId = body.id;
  });

  test('GET /sessions/:id → has messages', async ({ request }) => {
    // 先创建一个 session 确保 id 存在
    if (!createdSessionId) {
      const createRes = await request.post(`${BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: 'test-api-health-get' },
      });
      const createBody = await createRes.json();
      createdSessionId = createBody.id;
    }
    const res = await request.get(`${BASE}/sessions/${createdSessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('messages');
  });

  test('PATCH /sessions/:id update title', async ({ request }) => {
    if (!createdSessionId) {
      const createRes = await request.post(`${BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { title: 'test-api-health-patch' },
      });
      createdSessionId = (await createRes.json()).id;
    }
    const res = await request.patch(`${BASE}/sessions/${createdSessionId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'test-api-health-updated' },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('DELETE /sessions/:id', async ({ request }) => {
    // 创建一个专门用于删除的 session
    const createRes = await request.post(`${BASE}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'test-api-health-delete' },
    });
    const createBody = await createRes.json();
    const deleteId = createBody.id;

    const res = await request.delete(`${BASE}/sessions/${deleteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
  });

  test('GET /agents → 200', async ({ request }) => {
    const res = await request.get(`${BASE}/agents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  // 清理：删除测试创建的 session
  test.afterAll(async ({ request }) => {
    if (createdSessionId) {
      await request.delete(`${BASE}/sessions/${createdSessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  });
});
