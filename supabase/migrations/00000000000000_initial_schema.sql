-- ============================================================================
-- JARRE — Clean Initial Schema
-- ============================================================================
-- Single migration that defines the complete database schema.
-- No seed data — curriculum content is managed separately.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE resource_type AS ENUM (
  'paper', 'book', 'video', 'course', 'article', 'lecture'
);

CREATE TYPE study_phase AS ENUM (
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'
);

CREATE TYPE mastery_level AS ENUM ('0', '1', '2', '3', '4');

CREATE TYPE evaluation_type AS ENUM (
  'explanation', 'scenario', 'error_detection', 'connection', 'tradeoff', 'design'
);

CREATE TYPE evaluation_status AS ENUM ('in_progress', 'completed', 'abandoned');

CREATE TYPE project_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TYPE question_bank_type AS ENUM (
  'definition', 'fact', 'property', 'guarantee', 'complexity', 'comparison',
  'scenario', 'limitation', 'error_spot'
);

CREATE TYPE review_rating AS ENUM ('wrong', 'hard', 'good', 'easy');

CREATE TYPE mastery_trigger_type AS ENUM (
  'evaluation', 'project', 'manual', 'decay',
  'micro_test', 'voice_evaluation', 'teach_session'
);

-- ============================================================================
-- CONTENT TABLES (public read)
-- ============================================================================

CREATE TABLE concepts (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  slug                 TEXT NOT NULL UNIQUE,
  canonical_definition TEXT NOT NULL,
  phase                study_phase NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE concept_prerequisites (
  concept_id      TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  prerequisite_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (concept_id, prerequisite_id),
  CHECK (concept_id != prerequisite_id)
);

CREATE TABLE resources (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  type            resource_type NOT NULL,
  url             TEXT,
  author          TEXT,
  phase           study_phase NOT NULL,
  description     TEXT,
  estimated_hours DECIMAL(4,1),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  start_page      INTEGER,
  end_page        INTEGER,
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  activate_data   JSONB,
  created_by      UUID REFERENCES auth.users(id),
  language        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resource_concepts (
  resource_id     TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  concept_id      TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  is_prerequisite BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (resource_id, concept_id)
);

CREATE TABLE resource_sections (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id             TEXT NOT NULL REFERENCES resources(id),
  concept_id              TEXT NOT NULL REFERENCES concepts(id),
  section_title           TEXT NOT NULL,
  sort_order              INTEGER NOT NULL,
  content_markdown        TEXT NOT NULL,
  content_original        TEXT,
  start_page              INTEGER,
  end_page                INTEGER,
  paragraph_range         INTEGER[],
  segmentation_confidence REAL,
  manually_reviewed       BOOLEAN DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, concept_id, sort_order)
);

CREATE TABLE question_bank (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept_id          TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  type                question_bank_type NOT NULL,
  question_text       TEXT NOT NULL,
  expected_answer     TEXT,
  difficulty          SMALLINT NOT NULL CHECK (difficulty >= 1 AND difficulty <= 3),
  related_concept_id  TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  format              TEXT NOT NULL DEFAULT 'open' CHECK (format IN ('open', 'mc', 'tf')),
  options             JSONB,
  correct_answer      TEXT,
  explanation         TEXT,
  resource_section_id UUID REFERENCES resource_sections(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE concept_cards (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id         TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  card_type          TEXT NOT NULL CHECK (card_type IN (
                       'recall', 'fill_blank', 'true_false', 'connect', 'scenario_micro'
                     )),
  front_content      JSONB NOT NULL,
  back_content       JSONB NOT NULL,
  difficulty         SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  related_concept_id TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inline_quizzes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id             UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  position_after_heading TEXT NOT NULL,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  format                 TEXT NOT NULL CHECK (format IN ('mc', 'tf', 'mc2')),
  question_text          TEXT NOT NULL,
  options                JSONB,
  correct_answer         TEXT NOT NULL,
  explanation            TEXT NOT NULL,
  academic_reference     TEXT,
  justification_hint     TEXT,
  is_active              BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE video_segments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id             UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  position_after_heading TEXT NOT NULL,
  sort_order             INTEGER NOT NULL DEFAULT 0,
  youtube_video_id       TEXT NOT NULL,
  start_seconds          INTEGER NOT NULL,
  end_seconds            INTEGER NOT NULL,
  label                  TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  phase        study_phase NOT NULL,
  description  TEXT NOT NULL,
  deliverables TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_concepts (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, concept_id)
);

-- ============================================================================
-- USER TABLES (RLS enabled)
-- ============================================================================

CREATE TABLE user_profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name      TEXT,
  current_phase     study_phase NOT NULL DEFAULT '1',
  total_evaluations INTEGER NOT NULL DEFAULT 0,
  streak_days       INTEGER NOT NULL DEFAULT 0,
  last_active_at    TIMESTAMPTZ,
  language          TEXT NOT NULL DEFAULT 'es' CONSTRAINT valid_language CHECK (language IN ('es', 'en')),
  total_xp          INTEGER NOT NULL DEFAULT 0,
  xp_level          INTEGER NOT NULL DEFAULT 1,
  daily_xp_earned   INTEGER NOT NULL DEFAULT 0,
  daily_xp_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_xp_target   INTEGER NOT NULL DEFAULT 50,
  longest_streak    INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'canceled', 'past_due')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE concept_progress (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id        TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  level             mastery_level NOT NULL DEFAULT '0',
  last_evaluated_at TIMESTAMPTZ,
  level_1_score     INTEGER,
  level_2_project_id TEXT REFERENCES projects(id),
  level_3_score     INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, concept_id)
);

CREATE TABLE mastery_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id   TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  old_level    mastery_level NOT NULL,
  new_level    mastery_level NOT NULL,
  trigger_type mastery_trigger_type NOT NULL,
  trigger_id   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE review_schedule (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id      UUID REFERENCES question_bank(id) ON DELETE CASCADE,
  ease_factor      REAL NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  repetition_count INTEGER NOT NULL DEFAULT 0,
  next_review_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at TIMESTAMPTZ,
  last_rating      review_rating,
  correct_count    INTEGER NOT NULL DEFAULT 0,
  incorrect_count  INTEGER NOT NULL DEFAULT 0,
  streak           INTEGER NOT NULL DEFAULT 0,
  confidence_level SMALLINT,
  fsrs_stability   REAL,
  fsrs_difficulty  REAL,
  fsrs_state       SMALLINT DEFAULT 0,
  fsrs_reps        INTEGER DEFAULT 0,
  fsrs_lapses      INTEGER DEFAULT 0,
  fsrs_last_review TIMESTAMPTZ,
  card_id          UUID REFERENCES concept_cards(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, question_id),
  CONSTRAINT review_schedule_has_source CHECK (question_id IS NOT NULL OR card_id IS NOT NULL)
);

-- voice_sessions must be created before evaluations (FK dependency)
CREATE TABLE voice_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id       UUID REFERENCES resource_sections(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  duration_seconds INTEGER,
  turn_count       INTEGER DEFAULT 0,
  cached_summary   TEXT,
  session_type     TEXT NOT NULL DEFAULT 'teaching'
                     CHECK (session_type IN (
                       'teaching', 'evaluation', 'practice',
                       'exploration', 'freeform', 'debate'
                     )),
  resource_id      TEXT REFERENCES resources(id),
  practice_result  JSONB
  -- user_resource_id added after user_resources table is created
);

CREATE TABLE evaluations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id      TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  status           evaluation_status NOT NULL DEFAULT 'in_progress',
  overall_score    INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  prompt_version   TEXT NOT NULL,
  predicted_score  INTEGER CHECK (predicted_score >= 0 AND predicted_score <= 100),
  voice_session_id UUID REFERENCES voice_sessions(id),
  eval_method      TEXT NOT NULL DEFAULT 'text' CHECK (eval_method IN ('text', 'voice')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

CREATE TABLE evaluation_questions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  evaluation_id      UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  concept_id         TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  type               evaluation_type NOT NULL,
  question           TEXT NOT NULL,
  incorrect_statement TEXT,
  related_concept_id TEXT REFERENCES concepts(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evaluation_responses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES evaluation_questions(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  is_correct  BOOLEAN,
  score       INTEGER CHECK (score >= 0 AND score <= 100),
  feedback    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE learn_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id        TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  current_step       TEXT NOT NULL DEFAULT 'activate',
  active_section     INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER[] NOT NULL DEFAULT '{}',
  section_state      JSONB NOT NULL DEFAULT '{}',
  review_state       JSONB DEFAULT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

CREATE TABLE project_progress (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status       project_status NOT NULL DEFAULT 'not_started',
  notes        TEXT,
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

CREATE TABLE section_annotations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  prefix        TEXT NOT NULL DEFAULT '',
  suffix        TEXT NOT NULL DEFAULT '',
  segment_index INTEGER NOT NULL DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE section_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, section_id)
);

CREATE TABLE resource_notes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id    TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  sections       JSONB NOT NULL DEFAULT '[]',
  canvas_data    JSONB,
  split_position INTEGER DEFAULT 50,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, resource_id)
);

CREATE TABLE xp_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp_amount  INTEGER NOT NULL,
  source     TEXT NOT NULL,
  source_id  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE exercise_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id        TEXT NOT NULL,
  section_id         UUID REFERENCES resource_sections(id) ON DELETE SET NULL,
  concept_id         TEXT REFERENCES concepts(id) ON DELETE SET NULL,
  exercise_type      TEXT NOT NULL CHECK (exercise_type IN ('sequence', 'label', 'connect')),
  score              INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  is_correct         BOOLEAN NOT NULL,
  details            JSONB NOT NULL DEFAULT '{}',
  attempt_number     INTEGER NOT NULL DEFAULT 1,
  time_spent_seconds INTEGER,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE voice_transcripts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'model')),
  text       TEXT NOT NULL,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE token_usage (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,
  tokens     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE learner_concept_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id        TEXT NOT NULL,
  misconceptions    JSONB NOT NULL DEFAULT '[]',
  strengths         JSONB NOT NULL DEFAULT '[]',
  escalation_level  TEXT DEFAULT 'pump',
  analogies         JSONB DEFAULT '[]',
  open_questions    JSONB DEFAULT '[]',
  personal_examples JSONB DEFAULT '[]',
  connections_made  JSONB DEFAULT '[]',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, concept_id)
);

CREATE TABLE voice_tool_calls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  tool_name  TEXT NOT NULL,
  input      JSONB NOT NULL DEFAULT '{}',
  output     JSONB,
  error      TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- REACTIVE KNOWLEDGE SYSTEM
-- ============================================================================

CREATE TABLE user_resources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  url                TEXT,
  type               TEXT NOT NULL DEFAULT 'article'
                       CHECK (type IN ('youtube', 'article', 'paper', 'book', 'podcast', 'other')),
  raw_content        TEXT,
  user_notes         TEXT,
  summary            TEXT,
  extracted_concepts JSONB DEFAULT '[]',
  coverage_score     REAL,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now add the deferred FK from voice_sessions to user_resources
ALTER TABLE voice_sessions
  ADD COLUMN user_resource_id UUID REFERENCES user_resources(id);

CREATE TABLE user_resource_concepts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_resource_id       UUID NOT NULL REFERENCES user_resources(id) ON DELETE CASCADE,
  concept_id             TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relationship           TEXT NOT NULL DEFAULT 'relates'
                           CHECK (relationship IN ('extends', 'applies', 'contrasts', 'exemplifies', 'relates')),
  relevance_score        REAL DEFAULT 0.5,
  extracted_concept_name TEXT NOT NULL,
  explanation            TEXT,
  source                 TEXT NOT NULL DEFAULT 'ingestion'
                           CHECK (source IN ('ingestion', 'voice_discovery', 'manual')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_resource_id, concept_id, extracted_concept_name)
);

CREATE TABLE consumption_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id      TEXT REFERENCES resources(id) ON DELETE SET NULL,
  user_resource_id UUID REFERENCES user_resources(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL CHECK (event_type IN (
                     'started', 'completed', 'evaluated', 'discussed', 'added', 'reviewed'
                   )),
  concepts_touched TEXT[] DEFAULT '{}',
  notes            TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT consumption_log_resource_xor CHECK (
    (resource_id IS NOT NULL AND user_resource_id IS NULL) OR
    (resource_id IS NULL AND user_resource_id IS NOT NULL) OR
    (resource_id IS NULL AND user_resource_id IS NULL)
  )
);

CREATE TABLE insight_suggestions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'mastery_catalyst', 'consolidation', 'gap_detection', 'debate_topic'
              )),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
                'evaluate', 'explore', 'freeform', 'debate', 'review'
              )),
  action_data  JSONB DEFAULT '{}',
  concept_ids  TEXT[] DEFAULT '{}',
  priority     REAL DEFAULT 0.5,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ
);

-- ============================================================================
-- TRANSLATION CACHE
-- ============================================================================

CREATE TABLE section_translations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id       UUID NOT NULL REFERENCES resource_sections(id) ON DELETE CASCADE,
  language         TEXT NOT NULL,
  section_title    TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  translated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, language)
);

CREATE TABLE resource_translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id   TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  language      TEXT NOT NULL,
  activate_data JSONB NOT NULL,
  content_hash  TEXT NOT NULL,
  translated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, language)
);

CREATE TABLE quiz_translations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id            UUID NOT NULL REFERENCES inline_quizzes(id) ON DELETE CASCADE,
  language           TEXT NOT NULL,
  question_text      TEXT NOT NULL,
  options            JSONB,
  explanation        TEXT NOT NULL,
  justification_hint TEXT,
  content_hash       TEXT NOT NULL,
  translated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, language)
);

-- ============================================================================
-- PIPELINE
-- ============================================================================

CREATE TABLE pipeline_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  url              TEXT NOT NULL,
  video_id         TEXT,
  title            TEXT,
  language         TEXT DEFAULT 'es',
  status           TEXT NOT NULL DEFAULT 'queued',
  current_stage    TEXT,
  stages_completed INTEGER DEFAULT 0,
  total_stages     INTEGER DEFAULT 7,
  resource_id      TEXT,
  error            TEXT,
  failed_stage     TEXT,
  stage_outputs    JSONB DEFAULT '{}',
  tokens_used      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Content tables
CREATE INDEX idx_concepts_phase ON concepts(phase);
CREATE INDEX idx_resources_phase ON resources(phase);
CREATE INDEX idx_resources_type ON resources(type);
CREATE INDEX idx_resources_sort_order ON resources(phase, sort_order);
CREATE INDEX idx_resource_sections_resource ON resource_sections(resource_id, sort_order);
CREATE INDEX idx_resource_sections_concept ON resource_sections(concept_id);
CREATE INDEX idx_question_bank_concept ON question_bank(concept_id);
CREATE INDEX idx_question_bank_active ON question_bank(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_question_bank_section ON question_bank(resource_section_id) WHERE resource_section_id IS NOT NULL;
CREATE INDEX idx_concept_cards_concept ON concept_cards(concept_id);
CREATE INDEX idx_concept_cards_active ON concept_cards(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_concept_cards_type ON concept_cards(card_type);
CREATE INDEX idx_inline_quizzes_section ON inline_quizzes(section_id, sort_order);
CREATE INDEX idx_video_segments_section ON video_segments(section_id, sort_order);

-- User tables
CREATE INDEX idx_concept_progress_user ON concept_progress(user_id);
CREATE INDEX idx_concept_progress_level ON concept_progress(level);
CREATE INDEX idx_mastery_history_user ON mastery_history(user_id);
CREATE INDEX idx_mastery_history_concept ON mastery_history(user_id, concept_id);
CREATE INDEX idx_review_schedule_user_next ON review_schedule(user_id, next_review_at);
CREATE UNIQUE INDEX idx_review_schedule_user_card ON review_schedule(user_id, card_id) WHERE card_id IS NOT NULL;
CREATE INDEX idx_evaluations_user ON evaluations(user_id);
CREATE INDEX idx_evaluations_status ON evaluations(status);
CREATE INDEX idx_evaluations_voice ON evaluations(voice_session_id) WHERE voice_session_id IS NOT NULL;
CREATE INDEX idx_evaluation_questions_evaluation ON evaluation_questions(evaluation_id);
CREATE INDEX idx_learn_progress_user_resource ON learn_progress(user_id, resource_id);
CREATE INDEX idx_section_annotations_user_section ON section_annotations(user_id, section_id);
CREATE INDEX idx_section_notes_user_section ON section_notes(user_id, section_id);
CREATE INDEX idx_resource_notes_user ON resource_notes(user_id);
CREATE INDEX idx_resource_notes_resource ON resource_notes(resource_id);
CREATE INDEX idx_xp_events_user ON xp_events(user_id, created_at DESC);
CREATE INDEX idx_exercise_results_user ON exercise_results(user_id, created_at DESC);
CREATE INDEX idx_exercise_results_exercise ON exercise_results(exercise_id, user_id);
CREATE INDEX idx_voice_sessions_user_section ON voice_sessions(user_id, section_id, started_at DESC);
CREATE INDEX idx_voice_sessions_type ON voice_sessions(session_type) WHERE session_type = 'evaluation';
CREATE INDEX idx_voice_transcripts_session ON voice_transcripts(session_id, timestamp ASC);
CREATE INDEX idx_token_usage_user ON token_usage(user_id, created_at);
CREATE INDEX idx_learner_concept_memory_user ON learner_concept_memory(user_id);
CREATE INDEX idx_voice_tool_calls_session ON voice_tool_calls(session_id, created_at);

-- Reactive knowledge system
CREATE INDEX idx_user_resources_user_created ON user_resources(user_id, created_at DESC);
CREATE INDEX idx_user_resource_concepts_resource ON user_resource_concepts(user_resource_id);
CREATE INDEX idx_user_resource_concepts_concept ON user_resource_concepts(concept_id);
CREATE INDEX idx_consumption_log_user_created ON consumption_log(user_id, created_at DESC);
CREATE INDEX idx_consumption_log_resource ON consumption_log(resource_id);
CREATE INDEX idx_consumption_log_user_resource ON consumption_log(user_resource_id);
CREATE INDEX idx_insight_suggestions_user_status ON insight_suggestions(user_id, status, created_at DESC);
CREATE INDEX idx_insight_suggestions_user_type ON insight_suggestions(user_id, type);

-- Translation cache
CREATE INDEX idx_section_translations_lookup ON section_translations(section_id, language);

-- Pipeline
CREATE INDEX idx_pipeline_jobs_user ON pipeline_jobs(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Content tables with RLS (public read)
ALTER TABLE resource_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON resource_sections FOR SELECT USING (true);

ALTER TABLE inline_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON inline_quizzes FOR SELECT USING (true);

ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON video_segments FOR SELECT USING (true);

-- Translation tables (public read, service write)
ALTER TABLE section_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read section_translations" ON section_translations FOR SELECT USING (true);
CREATE POLICY "Service write section_translations" ON section_translations FOR ALL USING (true);

ALTER TABLE resource_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read resource_translations" ON resource_translations FOR SELECT USING (true);
CREATE POLICY "Service write resource_translations" ON resource_translations FOR ALL USING (true);

ALTER TABLE quiz_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read quiz_translations" ON quiz_translations FOR SELECT USING (true);
CREATE POLICY "Service write quiz_translations" ON quiz_translations FOR ALL USING (true);

-- user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- concept_progress
ALTER TABLE concept_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON concept_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON concept_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON concept_progress FOR UPDATE USING (auth.uid() = user_id);

-- mastery_history
ALTER TABLE mastery_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own mastery history" ON mastery_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own mastery history" ON mastery_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- review_schedule
ALTER TABLE review_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own review schedule" ON review_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own review schedule" ON review_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own review schedule" ON review_schedule FOR UPDATE USING (auth.uid() = user_id);

-- evaluations
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own evaluations" ON evaluations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own evaluations" ON evaluations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own evaluations" ON evaluations FOR UPDATE USING (auth.uid() = user_id);

-- evaluation_questions
ALTER TABLE evaluation_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view questions from own evaluations" ON evaluation_questions FOR SELECT
  USING (EXISTS (SELECT 1 FROM evaluations WHERE evaluations.id = evaluation_questions.evaluation_id AND evaluations.user_id = auth.uid()));
CREATE POLICY "Users can insert questions to own evaluations" ON evaluation_questions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM evaluations WHERE evaluations.id = evaluation_questions.evaluation_id AND evaluations.user_id = auth.uid()));

-- evaluation_responses
ALTER TABLE evaluation_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view responses from own evaluations" ON evaluation_responses FOR SELECT
  USING (EXISTS (SELECT 1 FROM evaluation_questions eq JOIN evaluations e ON e.id = eq.evaluation_id WHERE eq.id = evaluation_responses.question_id AND e.user_id = auth.uid()));
CREATE POLICY "Users can insert responses to own evaluations" ON evaluation_responses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM evaluation_questions eq JOIN evaluations e ON e.id = eq.evaluation_id WHERE eq.id = evaluation_responses.question_id AND e.user_id = auth.uid()));

-- learn_progress
ALTER TABLE learn_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own learn progress" ON learn_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own learn progress" ON learn_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own learn progress" ON learn_progress FOR UPDATE USING (auth.uid() = user_id);

-- project_progress
ALTER TABLE project_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own project progress" ON project_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own project progress" ON project_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own project progress" ON project_progress FOR UPDATE USING (auth.uid() = user_id);

-- section_annotations
ALTER TABLE section_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own annotations" ON section_annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own annotations" ON section_annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own annotations" ON section_annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own annotations" ON section_annotations FOR DELETE USING (auth.uid() = user_id);

-- section_notes
ALTER TABLE section_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON section_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON section_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON section_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON section_notes FOR DELETE USING (auth.uid() = user_id);

-- resource_notes
ALTER TABLE resource_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own resource notes" ON resource_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own resource notes" ON resource_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own resource notes" ON resource_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own resource notes" ON resource_notes FOR DELETE USING (auth.uid() = user_id);

-- xp_events
ALTER TABLE xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp_events" ON xp_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own xp_events" ON xp_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- exercise_results
ALTER TABLE exercise_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own exercise_results" ON exercise_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own exercise_results" ON exercise_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- voice_sessions
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_sessions_select" ON voice_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "voice_sessions_insert" ON voice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "voice_sessions_update" ON voice_sessions FOR UPDATE USING (auth.uid() = user_id);

-- voice_transcripts
ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_transcripts_select" ON voice_transcripts FOR SELECT
  USING (EXISTS (SELECT 1 FROM voice_sessions WHERE voice_sessions.id = voice_transcripts.session_id AND voice_sessions.user_id = auth.uid()));
CREATE POLICY "voice_transcripts_insert" ON voice_transcripts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM voice_sessions WHERE voice_sessions.id = voice_transcripts.session_id AND voice_sessions.user_id = auth.uid()));

-- token_usage
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own token usage" ON token_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own token usage" ON token_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- learner_concept_memory
ALTER TABLE learner_concept_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memory" ON learner_concept_memory FOR ALL USING (auth.uid() = user_id);

-- voice_tool_calls
ALTER TABLE voice_tool_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tool calls" ON voice_tool_calls FOR ALL
  USING (session_id IN (SELECT id FROM voice_sessions WHERE user_id = auth.uid()));

-- user_resources
ALTER TABLE user_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_resources_select" ON user_resources FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_resources_insert" ON user_resources FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_resources_update" ON user_resources FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "user_resources_delete" ON user_resources FOR DELETE USING (user_id = auth.uid());

-- user_resource_concepts
ALTER TABLE user_resource_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_resource_concepts_select" ON user_resource_concepts FOR SELECT
  USING (user_resource_id IN (SELECT id FROM user_resources WHERE user_id = auth.uid()));
CREATE POLICY "user_resource_concepts_insert" ON user_resource_concepts FOR INSERT
  WITH CHECK (user_resource_id IN (SELECT id FROM user_resources WHERE user_id = auth.uid()));
CREATE POLICY "user_resource_concepts_delete" ON user_resource_concepts FOR DELETE
  USING (user_resource_id IN (SELECT id FROM user_resources WHERE user_id = auth.uid()));

-- consumption_log
ALTER TABLE consumption_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consumption_log_select" ON consumption_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "consumption_log_insert" ON consumption_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "consumption_log_update" ON consumption_log FOR UPDATE USING (user_id = auth.uid());

-- insight_suggestions
ALTER TABLE insight_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own suggestions" ON insight_suggestions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own suggestions" ON insight_suggestions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own suggestions" ON insight_suggestions FOR UPDATE USING (user_id = auth.uid());

-- pipeline_jobs
ALTER TABLE pipeline_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own jobs" ON pipeline_jobs FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, display_name, current_phase, language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
    '1'::study_phase,
    COALESCE(NEW.raw_user_meta_data->>'language', 'es')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not create user profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic XP award with streak/level tracking
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id   UUID,
  p_xp_amount INTEGER,
  p_source    TEXT,
  p_source_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_new_total INTEGER;
  v_new_level INTEGER;
  v_new_daily INTEGER;
  v_streak INTEGER;
  v_longest INTEGER;
  v_daily_goal_hit BOOLEAN := FALSE;
  v_level_up BOOLEAN := FALSE;
  v_streak_milestone INTEGER := 0;
BEGIN
  SELECT total_xp, xp_level, daily_xp_earned, daily_xp_date,
         daily_xp_target, streak_days, longest_streak, last_active_at
  INTO v_profile
  FROM user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;

  IF v_profile.daily_xp_date < CURRENT_DATE THEN
    v_new_daily := p_xp_amount;
  ELSE
    v_new_daily := v_profile.daily_xp_earned + p_xp_amount;
  END IF;

  IF v_profile.last_active_at IS NOT NULL THEN
    IF v_profile.last_active_at::date = CURRENT_DATE THEN
      v_streak := v_profile.streak_days;
    ELSIF v_profile.last_active_at::date = CURRENT_DATE - INTERVAL '1 day' THEN
      v_streak := v_profile.streak_days + 1;
    ELSE
      v_streak := 1;
    END IF;
  ELSE
    v_streak := 1;
  END IF;

  v_longest := GREATEST(v_profile.longest_streak, v_streak);
  v_new_total := v_profile.total_xp + p_xp_amount;
  v_new_level := FLOOR(SQRT(v_new_total::NUMERIC / 100)) + 1;

  IF v_profile.daily_xp_earned < v_profile.daily_xp_target
     AND v_new_daily >= v_profile.daily_xp_target THEN
    v_daily_goal_hit := TRUE;
    v_new_total := v_new_total + 10;
    v_new_daily := v_new_daily + 10;
    v_new_level := FLOOR(SQRT(v_new_total::NUMERIC / 100)) + 1;
  END IF;

  IF v_new_level > v_profile.xp_level THEN
    v_level_up := TRUE;
  END IF;

  IF v_streak IN (3, 7, 14, 30, 50, 100) AND v_streak > v_profile.streak_days THEN
    v_streak_milestone := v_streak;
  END IF;

  UPDATE user_profiles SET
    total_xp = v_new_total,
    xp_level = v_new_level,
    daily_xp_earned = v_new_daily,
    daily_xp_date = CURRENT_DATE,
    streak_days = v_streak,
    longest_streak = v_longest,
    last_active_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO xp_events (user_id, xp_amount, source, source_id)
  VALUES (p_user_id, p_xp_amount, p_source, p_source_id);

  IF v_daily_goal_hit THEN
    INSERT INTO xp_events (user_id, xp_amount, source, source_id)
    VALUES (p_user_id, 10, 'daily_goal_bonus', NULL);
  END IF;

  RETURN jsonb_build_object(
    'totalXp', v_new_total,
    'xpLevel', v_new_level,
    'dailyXp', v_new_daily,
    'dailyTarget', v_profile.daily_xp_target,
    'dailyGoalHit', v_daily_goal_hit,
    'streakDays', v_streak,
    'longestStreak', v_longest,
    'levelUp', v_level_up,
    'streakMilestone', v_streak_milestone,
    'xpAwarded', p_xp_amount
  );
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_concepts_updated_at
  BEFORE UPDATE ON concepts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON resources FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_concept_progress_updated_at
  BEFORE UPDATE ON concept_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_project_progress_updated_at
  BEFORE UPDATE ON project_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_resource_notes_updated_at
  BEFORE UPDATE ON resource_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_question_bank_updated_at
  BEFORE UPDATE ON question_bank FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_review_schedule_updated_at
  BEFORE UPDATE ON review_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
