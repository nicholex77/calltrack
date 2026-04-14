import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  "https://bhhatribuvszqjowvpyx.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoaGF0cmlidXZzenFqb3d2cHl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzQzNTcsImV4cCI6MjA5MTc1MDM1N30.nCJG_p4mUs6TR8cE7eQMWBFlPMChuHQFBJWnzyuJqdw"
)