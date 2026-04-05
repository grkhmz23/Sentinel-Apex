CREATE TABLE "vault_submission_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "submission_id" text NOT NULL REFERENCES "vault_submission_profiles"("id"),
  "evidence_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'recorded',
  "source" text NOT NULL DEFAULT 'manual',
  "label" text NOT NULL,
  "summary" text,
  "reference" text,
  "url" text,
  "captured_at" timestamptz,
  "within_build_window" boolean NOT NULL DEFAULT false,
  "notes" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "vault_submission_evidence_submission_id_idx"
  ON "vault_submission_evidence" ("submission_id");
CREATE INDEX "vault_submission_evidence_type_idx"
  ON "vault_submission_evidence" ("evidence_type");
CREATE INDEX "vault_submission_evidence_status_idx"
  ON "vault_submission_evidence" ("status");
CREATE INDEX "vault_submission_evidence_captured_at_idx"
  ON "vault_submission_evidence" ("captured_at");
CREATE INDEX "vault_submission_evidence_updated_at_idx"
  ON "vault_submission_evidence" ("updated_at");
