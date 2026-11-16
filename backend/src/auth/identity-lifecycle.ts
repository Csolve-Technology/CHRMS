// Live realm-scoped lifecycle checks. No positive account-status cache: an old JWT
// cannot bypass a deleted/disabled central account. Network failures fail closed.
import { HttpException } from '@nestjs/common';
const failure = (status: number, message: string) => new HttpException(message, status);
const isFailure = (error: unknown) => error instanceof HttpException;
export class IdentityLifecycle {
  private token = '';
  constructor(private cfg: { url: string; realm: string; issuer: string }, private transport: typeof fetch = fetch) {}
  private async request(path: string, method = 'GET', body?: unknown, missingOK = false): Promise<any> {
    try {
      if (!this.token) {
        const id = process.env.KEYCLOAK_ADMIN_CLIENT_ID, secret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET;
        if (!id || !secret) throw failure(503, 'Chiro Auth account checks require server-side provisioner credentials.');
        const r = await this.transport(this.cfg.issuer + '/protocol/openid-connect/token', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
          body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
        });
        if (!r.ok) throw failure(503, 'Chiro Auth provisioner authentication failed.');
        const data = await r.json();
        if (typeof data.access_token !== 'string') throw failure(503, 'Invalid Chiro Auth management response.');
        this.token = data.access_token;
      }
      const r = await this.transport(this.cfg.url.replace(/\/$/, '') + '/admin/realms/' + encodeURIComponent(this.cfg.realm) + path, {
        method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (r.status === 404 && missingOK) return null;
      if (!r.ok) throw failure(503, 'Chiro Auth account management failed. Check provisioner permissions.');
      return r.status === 204 ? null : await r.json();
    } catch (error) {
      if (isFailure(error)) throw error;
      throw failure(503, 'Chiro Auth account status is temporarily unavailable. Retry later.');
    }
  }
  async assertActive(subject: string) {
    const user = await this.request('/users/' + encodeURIComponent(subject), 'GET', undefined, true);
    if (!user) throw failure(401, 'This Chiro Auth account was deleted.');
    if (user.id !== subject || typeof user.enabled !== 'boolean') throw failure(503, 'Invalid Chiro Auth account response.');
    if (!user.enabled) throw failure(403, 'This Chiro Auth account is disabled.');
  }
  private checkIssuer(subject: string | null | undefined, issuer: string | null | undefined) {
    if (subject && issuer !== this.cfg.issuer) throw failure(409, 'This account belongs to another realm. Review its identity link.');
  }
  async setEnabled(subject: string | null | undefined, issuer: string | null | undefined, enabled: boolean) {
    this.checkIssuer(subject, issuer);
    if (!subject) return;
    await this.request('/users/' + encodeURIComponent(subject), 'PUT', { enabled }, !enabled);
    if (!enabled) await this.request('/users/' + encodeURIComponent(subject) + '/logout', 'POST', undefined, true);
  }
  async deleteUser(subject: string | null | undefined, issuer: string | null | undefined) {
    this.checkIssuer(subject, issuer);
    if (subject) await this.request('/users/' + encodeURIComponent(subject), 'DELETE', undefined, true);
  }
  async visibleWhere(subjectField = 'keycloakSub', issuerField = 'keycloakIssuer'): Promise<any> {
    const ids: string[] = [];
    for (let first = 0; ; first += 100) {
      const users = await this.request('/users?first=' + first + '&max=100&briefRepresentation=true');
      if (!Array.isArray(users) || users.some(u => !u || typeof u.id !== 'string')) throw failure(503, 'Invalid Chiro Auth user directory response.');
      ids.push(...users.map(u => u.id));
      if (users.length < 100) break;
    }
    // Unlinked local records remain available for explicit migration. Old-realm
    // profiles and missing central users are hidden before counting/pagination.
    return { OR: [{ [subjectField]: null }, { [issuerField]: this.cfg.issuer, [subjectField]: { in: ids } }] };
  }
}
