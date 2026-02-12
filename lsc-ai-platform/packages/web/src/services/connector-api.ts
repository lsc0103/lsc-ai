import api from './api';

export interface Connector {
  id: string;
  name: string;
  type: string; // db_mysql | db_postgresql
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  createdAt: string;
}

export interface ConnectorCreateData {
  name: string;
  type: 'db_mysql' | 'db_postgresql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const connectorApi = {
  list: () => api.get('/connectors'),
  create: (data: ConnectorCreateData) => api.post('/connectors', data),
  test: (id: string) => api.post(`/connectors/${id}/test`),
  query: (id: string, sql: string, params?: any[]) =>
    api.post(`/connectors/${id}/query`, { sql, params }),
  getTables: (id: string) => api.get(`/connectors/${id}/tables`),
  getTableSchema: (id: string, tableName: string) =>
    api.get(`/connectors/${id}/tables/${tableName}`),
  delete: (id: string) => api.delete(`/connectors/${id}`),
};
