-- ============================================================================
-- blurB CRM — Supabase Auth Setup
-- ============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Run sections 1, 2, and 3 in order. Section 4 (manager seed) is run AFTER you
-- create your manager account in Authentication → Users.
-- ============================================================================


-- ─── Section 1: profiles table ──────────────────────────────────────────────
-- One row per auth user. Stores display name + role + team.
CREATE TABLE IF NOT EXISTS profiles (
  id        UUID REFERENCES auth.users PRIMARY KEY,
  name      TEXT NOT NULL,
  role      TEXT NOT NULL CHECK (role IN ('manager', 'agent')),
  color_idx INTEGER DEFAULT 0,
  team_id   TEXT NOT NULL DEFAULT 'main'
);


-- ─── Section 2: row level security ──────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) can see agent NAMES + color_idx — needed for the
-- "select your name" step on the LoginScreen. role and team_id are not
-- particularly sensitive. Email lives in auth.users which is NOT exposed.
DROP POLICY IF EXISTS "public read agents for login" ON profiles;
CREATE POLICY "public read agents for login" ON profiles
  FOR SELECT
  USING (role = 'agent');

-- Authenticated users can read their own profile (manager too)
DROP POLICY IF EXISTS "read own profile" ON profiles;
CREATE POLICY "read own profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Manager can read all profiles
DROP POLICY IF EXISTS "manager reads all profiles" ON profiles;
CREATE POLICY "manager reads all profiles" ON profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Manager can insert/update/delete profiles (used by the create-agent Edge Function)
DROP POLICY IF EXISTS "manager manages profiles" ON profiles;
CREATE POLICY "manager manages profiles" ON profiles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));


-- ─── Section 3: tighten existing tables (recommended) ──────────────────────
-- The existing calltrack and contacts tables currently allow the anon key to
-- read/write anything. Once Auth is in place, restrict them to authenticated
-- users only:

-- (Adjust these only after you have created your manager auth account and
--  verified you can sign in. Otherwise you'll lock yourself out.)
--
-- ALTER TABLE calltrack ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated users access calltrack" ON calltrack
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "authenticated users access contacts" ON contacts
--   FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─── Section 4: seed your manager account ──────────────────────────────────
-- Step A: Dashboard → Authentication → Users → Add User
--         Email: <your email>     Password: <strong password>
--         (turn OFF "Auto Confirm User" or confirm via email)
-- Step B: Copy the new user's UUID from the Users list
-- Step C: Run this SQL with the UUID and your DB_ROW_ID from .env.local:
--
-- INSERT INTO profiles (id, name, role, color_idx, team_id)
-- VALUES (
--   '<paste-uuid-here>',
--   'Manager',
--   'manager',
--   0,
--   'blurb-9f4e2a71c83d'
-- );
