import { APIRequestContext } from '@playwright/test';

const BASE_URL = 'http://localhost:3000/api';

export class ApiHelper {
  private token: string = '';

  constructor(private request: APIRequestContext) {}

  async login(username = 'admin', password = 'Admin@123'): Promise<string> {
    const res = await this.request.post(`${BASE_URL}/auth/login`, {
      data: { username, password },
    });
    const data = await res.json();
    this.token = data.accessToken;
    return this.token;
  }

  private headers() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async createSession(title?: string) {
    const res = await this.request.post(`${BASE_URL}/sessions`, {
      headers: this.headers(),
      data: { title: title || `test-${Date.now()}` },
    });
    return res.json();
  }

  async deleteSession(id: string) {
    return this.request.delete(`${BASE_URL}/sessions/${id}`, {
      headers: this.headers(),
    });
  }

  async getSessions() {
    const res = await this.request.get(`${BASE_URL}/sessions`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async getSession(id: string) {
    const res = await this.request.get(`${BASE_URL}/sessions/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok()) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  }

  async updateSession(id: string, data: { title: string }) {
    return this.request.patch(`${BASE_URL}/sessions/${id}`, {
      headers: this.headers(),
      data,
    });
  }

  async getAgents() {
    const res = await this.request.get(`${BASE_URL}/agents`, {
      headers: this.headers(),
    });
    return res;
  }

  getToken() {
    return this.token;
  }
}
