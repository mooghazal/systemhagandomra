/**
 * The cookie-to-header hop in front of Laravel.
 *
 * Both panels need exactly the same one, and it was two byte-identical copies
 * until a path-traversal hole had to be fixed in both at once. It lives in the
 * shared package now: one implementation to audit, one to fix.
 */
export { GET, POST, PUT, PATCH, DELETE } from '@hagamra/shared/lib/proxy';
