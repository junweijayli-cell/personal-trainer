// Type aliases for testing the Deno modules with the app's TypeScript compiler.
declare module 'npm:stripe@19.0.0' {
  import Stripe from 'stripe';
  export default Stripe;
}
declare module 'npm:@supabase/supabase-js@2' {
  export type { SupabaseClient } from '@supabase/supabase-js';
}
