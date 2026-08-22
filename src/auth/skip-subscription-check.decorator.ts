import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skipSubscriptionCheck';

// Marks a route as accessible even when the org's subscription has expired —
// for routes that need to stay reachable so the org can see it's expired and
// pay to renew (e.g. viewing the org, or the renew-checkout endpoint itself).
export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);
