-- AU-Convertisseur — Schéma Supabase
-- À exécuter dans l'éditeur SQL du projet Supabase

-- Table teachers
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  school_name text,
  language text DEFAULT 'fr' CHECK (language IN ('fr', 'nl', 'en')),
  created_at timestamptz DEFAULT now()
);

-- RLS : chaque enseignant ne voit que ses propres données
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_own" ON teachers
  FOR ALL USING (auth.jwt()->>'email' = email);

-- Table au_profiles
CREATE TABLE IF NOT EXISTS au_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_school_wide boolean DEFAULT false,
  au_selections jsonb NOT NULL DEFAULT '[]',
  picto_options jsonb NOT NULL DEFAULT '{}',
  text_adaptation text DEFAULT 'none' CHECK (text_adaptation IN ('none','DYS','TDAH','HP','FLE','FALC')),
  language text DEFAULT 'fr' CHECK (language IN ('fr', 'nl', 'en')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE au_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON au_profiles
  FOR ALL USING (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt()->>'email')
    OR is_school_wide = true
  );

-- Table conversions
CREATE TABLE IF NOT EXISTS conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
  au_profile_id uuid REFERENCES au_profiles(id),
  original_filename text,
  original_storage_path text,
  converted_storage_path text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','done','error')),
  report jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversions_own" ON conversions
  FOR ALL USING (
    teacher_id IN (SELECT id FROM teachers WHERE email = auth.jwt()->>'email')
  );

-- Trigger updated_at sur au_profiles
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER au_profiles_updated_at
  BEFORE UPDATE ON au_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
