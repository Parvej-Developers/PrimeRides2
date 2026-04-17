// supabaseClient.js
const SUPABASE_URL = "https://tdjkytvwkwotocktimvo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkamt5dHZ3a3dvdG9ja3RpbXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTUxMzEsImV4cCI6MjA5MTczMTEzMX0.EETnby44ODoCESnQJK35lIRP0zZ1XFK-fACbJ2pmNgo";

window.supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
