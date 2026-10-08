import { changePasswordRoute } from '@hagamra/shared/lib/change-password-route';

/**
 * Its own route rather than the Laravel proxy, because the response carries a
 * replacement token that must reach the cookie and not the browser.
 */
export const POST = changePasswordRoute('company-dashboard');
