import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authConfig } from './auth.config';
class AuthError extends HttpException {
  constructor(status: number, message: string) {
    super(message, status);
  }
}

export interface ClientRole {
  id: string;
  name: string;
  description?: string;
  composite?: boolean;
}

// Never expose service credentials or upstream response bodies to the browser/logs.
export class KeycloakAdmin {
  private token = '';
  private client = '';
  constructor(
    private config: ConfigService,
    private transport: typeof fetch = fetch,
  ) {}

  private async login() {
    const s = authConfig(this.config);
    const clientId = this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID');
    const secret = this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET');
    if (!clientId || !secret)
      throw new AuthError(
        503,
        'Chiro Auth user management is not configured on this server.',
      );
    const response = await this.transport(
      `${s.issuer}/protocol/openid-connect/token`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: secret,
        }),
      },
    );
    if (!response.ok)
      throw new AuthError(
        503,
        'Chiro Auth service account authentication failed.',
      );
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token)
      throw new AuthError(
        503,
        'Chiro Auth service account authentication failed.',
      );
    this.token = data.access_token;
  }

  async request(path: string, method = 'GET', body?: unknown): Promise<any> {
    try {
      if (!this.token) await this.login();
      const s = authConfig(this.config);
      const response = await this.transport(
        `${s.url}/admin/realms/${encodeURIComponent(s.realm)}${path}`,
        {
          method,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      if (!response.ok) {
        if (response.status === 409)
          throw new AuthError(
            409,
            'This Chiro Auth user or role already exists. Link the existing identity explicitly.',
          );
        if (response.status === 404)
          throw new AuthError(
            409,
            'The Chiro Auth user or role no longer exists. Refresh roles and try again.',
          );
        if (response.status === 400)
          throw new AuthError(
            400,
            'Chiro Auth rejected the account details or password policy.',
          );
        throw new AuthError(
          503,
          'Chiro Auth management request failed. Check service account permissions.',
        );
      }
      if (response.status === 201) return response.headers.get('location');
      if (response.status === 204) return undefined;
      return await response.json();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(
        503,
        'Chiro Auth management is temporarily unavailable.',
      );
    }
  }

  async clientPath() {
    if (!this.client) {
      const clients = await this.request(
        `/clients?clientId=${encodeURIComponent(authConfig(this.config).audience)}`,
      );
      const exact = clients.filter(
        (c: any) => c.clientId === authConfig(this.config).audience,
      );
      if (exact.length !== 1 || !exact[0].id)
        throw new AuthError(
          503,
          'CHRMS API client was not found in Chiro Auth.',
        );
      this.client = `/clients/${encodeURIComponent(exact[0].id)}`;
    }
    return this.client;
  }

  async roles(): Promise<ClientRole[]> {
    const path = await this.clientPath();
    const roles: ClientRole[] = [];
    for (let first = 0; ; first += 100) {
      const batch = await this.request(`${path}/roles?first=${first}&max=100`);
      roles.push(...batch);
      if (batch.length < 100) return roles;
    }
  }

  async ensureRole(name: string, description?: string) {
    const roles = await this.roles();
    if (roles.some((r) => r.name === name)) return;
    try {
      await this.request(`${await this.clientPath()}/roles`, 'POST', {
        name,
        description,
      });
    } catch (error) {
      // Another administrator may have created the same role concurrently.
      if (
        !(error instanceof AuthError) ||
        error.getStatus() !== 409 ||
        !(await this.roles()).some((r) => r.name === name)
      )
        throw error;
    }
  }

  async replaceRoles(userId: string, names: string[]) {
    const roles = await this.roles();
    const desired = roles.filter((r) => names.includes(r.name));
    if (desired.length !== new Set(names).size)
      throw new AuthError(
        409,
        'Some roles are missing in Chiro Auth. Synchronize roles first.',
      );
    if (desired.some((r) => r.composite))
      throw new AuthError(
        409,
        'Assign composite roles through Chiro Auth; their inherited roles cannot be edited individually here.',
      );
    const path = `/users/${encodeURIComponent(userId)}/role-mappings/clients/${(await this.clientPath()).split('/').pop()}`;
    const direct: ClientRole[] = await this.request(path);
    const effective: ClientRole[] = await this.request(`${path}/composite`);
    const inherited = effective.filter(
      (r) => !direct.some((d) => d.id === r.id),
    );
    if (inherited.some((r) => !names.includes(r.name)))
      throw new AuthError(
        409,
        'A role is inherited from a group or composite. Remove it in Chiro Auth first.',
      );
    const remove = direct.filter((r) => !names.includes(r.name));
    const add = desired.filter((r) => !effective.some((e) => e.id === r.id));
    if (remove.length) await this.request(path, 'DELETE', remove);
    if (add.length) await this.request(path, 'POST', add);
    const actual: ClientRole[] = await this.request(`${path}/composite`);
    if (
      actual.length !== desired.length ||
      actual.some((r) => !names.includes(r.name))
    ) {
      throw new AuthError(
        409,
        'Effective Chiro Auth roles differ from the selected roles. Review group and composite assignments.',
      );
    }
  }

  async createIdentity(input: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
  }) {
    const location = await this.request('/users', 'POST', {
      username: input.email.toLowerCase(),
      email: input.email.toLowerCase(),
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: false,
      emailVerified: true,
      credentials: [
        { type: 'password', value: input.password, temporary: true },
      ],
      requiredActions: ['UPDATE_PASSWORD'],
    });
    const id = typeof location === 'string' ? location.split('/').pop() : null;
    if (!id)
      throw new AuthError(
        503,
        'Chiro Auth did not return the created user ID.',
      );
    return id;
  }
}
