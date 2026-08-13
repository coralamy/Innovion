/**
 * Innovion Integration Framework — Adapter Registry
 *
 * Import this module in any server-side entry point to register
 * all available provider adapters with the Integration Framework.
 *
 * Adapters are registered once at module load time.
 * The registerAdapter() call is idempotent — safe to import multiple times.
 *
 * Usage:
 *   import '@/lib/integrations/adapters';
 *   // All adapters are now registered in the framework
 */

import { registerAdapter } from '@/lib/services/integrationFrameworkService';
import { xeroAdapter } from './xeroAdapter';

// Register Xero adapter
registerAdapter(xeroAdapter);

// Future adapters will be registered here:
// registerAdapter(microsoftAdapter);
// registerAdapter(googleAdapter);

export { xeroAdapter };
