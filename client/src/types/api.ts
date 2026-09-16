export interface TestResponse {
  status: 'ok';
  message: string;
  timestamp: string;
}

export interface DatabaseResponse {
  status: 'ok';
  database: 'connected';
  timestamp: string;
}

export type ConnectionState =
  | { status: 'loading' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };
