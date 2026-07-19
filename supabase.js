/* ============================================================
   ANUBIS APP LIBRARY
   SUPABASE CONFIG
============================================================ */

const SUPABASE_URL =
  'https://ypszdzznqaizopfulioa.supabase.co';

const SUPABASE_ANON =
  'sb_publishable_EKEuf19RbGaaQ_xjN9VmhA_mkOY9t2q';

async function getApps() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/apps?select=*`,
    {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Supabase Error: ${response.status}`);
  }

  return await response.json();
}