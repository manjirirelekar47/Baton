# Supabase authentication

Baton's `/login` and `/signup` screens use Supabase Auth for email/password sign-in, account creation, OAuth, and password recovery. New accounts must follow the project's email confirmation setting. The demo workspace remains a separate, explicit action on the page.

After Supabase confirms an account, the current backend integration opens the seeded Approver workspace through the existing demo-login endpoint. Baton does not yet map Supabase identities to individual backend users or workspace permissions, so this flow provides sign-in to the shared prototype workspace rather than per-user data isolation.

## Configuration

The Vite frontend needs `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY`. Configure them locally in `frontend/.env.local`; set the same variables in Vercel's Production and Preview environments, then redeploy.

In Supabase Authentication URL Configuration, allow `http://localhost:5173/**` and `https://baton-pearl.vercel.app/**`, and set the Site URL to `https://baton-pearl.vercel.app`. Google and GitHub sign-in also require their provider credentials in Supabase. Register Supabase's `/auth/v1/callback` URL with each OAuth provider.

The frontend only uses the public publishable key. Never put a Supabase secret or `service_role` key in Vite variables or browser code.
