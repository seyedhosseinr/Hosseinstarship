CREATE TABLE "chapter_progress" (
	"chapter_no" bigint PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"read_count" bigint DEFAULT 0 NOT NULL,
	"last_read_at" bigint,
	"q_attempted" bigint DEFAULT 0 NOT NULL,
	"q_correct" bigint DEFAULT 0 NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"volume_no" bigint NOT NULL,
	"part_no" bigint,
	"part_title" text NOT NULL,
	"section_title" text,
	"chapter_no" bigint NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"page_start" bigint,
	"page_end" bigint,
	"source_book" text DEFAULT 'Campbell-Walsh-Wein' NOT NULL,
	"source_edition" text DEFAULT '13' NOT NULL,
	"is_active" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunk_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"chunk_id" text NOT NULL,
	"asset_type" text NOT NULL,
	"label" text,
	"path" text,
	"url" text,
	"mime_type" text,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"metadata_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunk_study_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_id" text,
	"chunk_id" text,
	"started_at" bigint NOT NULL,
	"ended_at" bigint,
	"duration_seconds" bigint,
	"progress_percent" bigint,
	"last_anchor_id" text,
	"notes_count" bigint DEFAULT 0 NOT NULL,
	"highlights_count" bigint DEFAULT 0 NOT NULL,
	"metadata_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text,
	"chapter_id" text NOT NULL,
	"chunk_index" bigint NOT NULL,
	"title" text,
	"slug" text NOT NULL,
	"page_start" bigint,
	"page_end" bigint,
	"anchor_start" text,
	"anchor_end" text,
	"chunk_kind" text NOT NULL,
	"token_estimate" bigint,
	"word_count" bigint,
	"notes_html" text,
	"plain_text" text,
	"metadata_json" text,
	"qc_score" bigint,
	"is_published" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_mastery" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"concept_id" text NOT NULL,
	"mastery_score" bigint DEFAULT 0 NOT NULL,
	"question_accuracy" bigint DEFAULT 0 NOT NULL,
	"flashcard_retention" bigint DEFAULT 0 NOT NULL,
	"recency_score" bigint DEFAULT 0 NOT NULL,
	"exposure_count" bigint DEFAULT 0 NOT NULL,
	"last_reviewed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_chapters" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"chapter_no" bigint NOT NULL,
	"chapter_title" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_question_choices" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_question_id" text NOT NULL,
	"question_id" text,
	"letter" text NOT NULL,
	"text" text NOT NULL,
	"order_index" bigint NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_question_note_links" (
	"id" text PRIMARY KEY NOT NULL,
	"link_id" text NOT NULL,
	"contract_question_id" text NOT NULL,
	"question_id" text,
	"doc_id" text NOT NULL,
	"frame_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"link_status" text NOT NULL,
	"linked_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"chapter_no" bigint NOT NULL,
	"chunk_index" bigint NOT NULL,
	"logical_chunk_id" text NOT NULL,
	"stem" text NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text NOT NULL,
	"linked_doc_id" text,
	"primary_anchor_id" text,
	"difficulty" text,
	"tags_json" text,
	"ingest_batch_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "contract_questions_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE "exam_session_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_session_id" text NOT NULL,
	"question_id" text NOT NULL,
	"order_index" bigint NOT NULL,
	"stem_html_snapshot" text,
	"explanation_html_snapshot" text,
	"selected_option_id" text,
	"correct_option_id" text,
	"is_marked" bigint DEFAULT 0 NOT NULL,
	"is_submitted" bigint DEFAULT 0 NOT NULL,
	"outcome" text,
	"time_spent_seconds" bigint DEFAULT 0 NOT NULL,
	"answered_at" bigint,
	"highlight_json" text,
	"strikeout_json" text,
	"notes_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"question_pool_mode" text NOT NULL,
	"total_questions" bigint NOT NULL,
	"current_question_index" bigint DEFAULT 0 NOT NULL,
	"selected_subject_ids_json" text,
	"selected_system_ids_json" text,
	"selected_chapter_ids_json" text,
	"config_json" text,
	"score_percent" bigint,
	"total_correct" bigint DEFAULT 0 NOT NULL,
	"total_incorrect" bigint DEFAULT 0 NOT NULL,
	"total_omitted" bigint DEFAULT 0 NOT NULL,
	"started_at" bigint NOT NULL,
	"suspended_at" bigint,
	"completed_at" bigint,
	"elapsed_seconds" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "flashcard_decks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" text,
	"chapter_no" bigint,
	"is_auto_generated" bigint DEFAULT 0 NOT NULL,
	"card_count" bigint DEFAULT 0 NOT NULL,
	"due_count" bigint DEFAULT 0 NOT NULL,
	"new_count" bigint DEFAULT 0 NOT NULL,
	"settings" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_review_history" (
	"id" text PRIMARY KEY NOT NULL,
	"flashcard_id" text NOT NULL,
	"session_id" text,
	"rating" bigint NOT NULL,
	"previous_state" text NOT NULL,
	"new_state" text NOT NULL,
	"time_spent_ms" bigint,
	"reviewed_at" bigint NOT NULL,
	"undone" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flashcard_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"flashcard_id" text NOT NULL,
	"rating" bigint NOT NULL,
	"state" text,
	"due_at" bigint,
	"reviewed_at" bigint NOT NULL,
	"elapsed_days" bigint,
	"scheduled_days" bigint,
	"stability" bigint,
	"difficulty" bigint,
	"retrievability" bigint,
	"fsrs_snapshot_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text,
	"chapter_id" text,
	"chapter_no" bigint,
	"chunk_id" text,
	"source_question_id" text,
	"source_doc_id" text,
	"source_frame_id" text,
	"anchor_id" text,
	"highlight_text" text,
	"card_type" text DEFAULT 'basic' NOT NULL,
	"created_from" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"deck" text,
	"deck_id" text,
	"front_html" text NOT NULL,
	"back_html" text NOT NULL,
	"extra_html" text,
	"cloze_text" text,
	"educational_objective" text,
	"tags_json" text,
	"source_json" text,
	"fsrs_stability" real DEFAULT 0 NOT NULL,
	"fsrs_difficulty" real DEFAULT 0 NOT NULL,
	"fsrs_elapsed_days" bigint DEFAULT 0 NOT NULL,
	"fsrs_scheduled_days" bigint DEFAULT 0 NOT NULL,
	"fsrs_reps" bigint DEFAULT 0 NOT NULL,
	"fsrs_lapses" bigint DEFAULT 0 NOT NULL,
	"fsrs_state" text DEFAULT 'new' NOT NULL,
	"fsrs_last_review" bigint,
	"fsrs_due" bigint,
	"learning_step" bigint DEFAULT 0 NOT NULL,
	"ease_factor" real DEFAULT 2.5 NOT NULL,
	"interval_days" bigint DEFAULT 0 NOT NULL,
	"is_leech" bigint DEFAULT 0 NOT NULL,
	"leech_count" bigint DEFAULT 0 NOT NULL,
	"is_buried" bigint DEFAULT 0 NOT NULL,
	"buried_until" bigint,
	"suspend_reason" text,
	"suspended_at" bigint,
	"sibling_group" text,
	"importance" bigint DEFAULT 5 NOT NULL,
	"yield_score" bigint,
	"yield_factors" text,
	"is_suspended" bigint DEFAULT 0 NOT NULL,
	"is_archived" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" text PRIMARY KEY NOT NULL,
	"source_name" text NOT NULL,
	"source_type" text NOT NULL,
	"source_version" text,
	"schema_version" text DEFAULT 'dna-v3.1' NOT NULL,
	"status" text NOT NULL,
	"input_path" text,
	"manifest_json" text,
	"qc_report_json" text,
	"error_message" text,
	"file_name" text,
	"file_type" text,
	"content_type" text,
	"item_count" bigint,
	"started_at" bigint,
	"completed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"contract_version" text NOT NULL,
	"source_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"documents_count" bigint DEFAULT 0 NOT NULL,
	"questions_count" bigint DEFAULT 0 NOT NULL,
	"links_count" bigint DEFAULT 0 NOT NULL,
	"validation_status" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "note_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"doc_id" text NOT NULL,
	"logical_chunk_id" text NOT NULL,
	"version" bigint NOT NULL,
	"chapter_id" text NOT NULL,
	"chapter_no" bigint NOT NULL,
	"chapter_title" text NOT NULL,
	"chunk_index" bigint NOT NULL,
	"page_range" text,
	"generated_at" bigint NOT NULL,
	"ingest_status" text DEFAULT 'active' NOT NULL,
	"ingest_batch_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "note_documents_doc_id_unique" UNIQUE("doc_id")
);
--> statement-breakpoint
CREATE TABLE "note_frames" (
	"id" text PRIMARY KEY NOT NULL,
	"frame_id" text NOT NULL,
	"doc_id" text NOT NULL,
	"section_id" text NOT NULL,
	"order_index" bigint NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text NOT NULL,
	"margin_note" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "note_frames_frame_id_unique" UNIQUE("frame_id")
);
--> statement-breakpoint
CREATE TABLE "note_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"doc_id" text NOT NULL,
	"order_index" bigint NOT NULL,
	"title" text NOT NULL,
	"hook" text,
	"closing_keypoint" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "note_sections_section_id_unique" UNIQUE("section_id")
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"exam_session_id" text,
	"selected_option_id" text,
	"correct_option_id" text,
	"outcome" text NOT NULL,
	"is_marked" bigint DEFAULT 0 NOT NULL,
	"confidence" bigint,
	"time_spent_seconds" bigint DEFAULT 0 NOT NULL,
	"attempted_at" bigint NOT NULL,
	"metadata_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "question_bookmarks" (
	"question_id" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "question_bookmarks_question_id_pk" PRIMARY KEY("question_id")
);
--> statement-breakpoint
CREATE TABLE "question_notebook_links" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"chapter_id" text,
	"chunk_id" text,
	"link_type" text NOT NULL,
	"notebook_anchor_id" text,
	"label" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text,
	"exam_session_id" text,
	"exam_session_question_id" text,
	"title" text,
	"body" text NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"option_key" text NOT NULL,
	"content_html" text NOT NULL,
	"content_text" text,
	"is_correct" bigint DEFAULT 0 NOT NULL,
	"sort_order" bigint NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text,
	"chapter_id" text NOT NULL,
	"chunk_id" text,
	"external_key" text,
	"stem_html" text NOT NULL,
	"stem_text" text,
	"lead_in" text,
	"explanation_html" text,
	"educational_objective" text,
	"why_correct" text,
	"why_others_wrong_json" text,
	"question_type" text DEFAULT 'single_best_answer' NOT NULL,
	"difficulty" text,
	"subject" text,
	"system" text,
	"category" text,
	"topic" text,
	"tags_json" text,
	"notebook_anchor_id" text,
	"correct_option_id" text,
	"source_json" text,
	"is_active" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "segment_progress" (
	"plan_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"chapter_id" text,
	"chapter_no" bigint,
	"doc_id" text,
	"segment_title" text,
	"page_start" bigint,
	"page_end" bigint,
	"frame_count" bigint DEFAULT 0 NOT NULL,
	"high_yield_count" bigint DEFAULT 0 NOT NULL,
	"read_status" text DEFAULT 'unread' NOT NULL,
	"read_at" bigint,
	"frames_total" bigint DEFAULT 0 NOT NULL,
	"frames_mastered" bigint DEFAULT 0 NOT NULL,
	"mcqs_total" bigint DEFAULT 0 NOT NULL,
	"mcqs_attempted" bigint DEFAULT 0 NOT NULL,
	"mcqs_correct" bigint DEFAULT 0 NOT NULL,
	"cards_total" bigint DEFAULT 0 NOT NULL,
	"cards_due" bigint DEFAULT 0 NOT NULL,
	"cards_mastered" bigint DEFAULT 0 NOT NULL,
	"mastery_score" bigint DEFAULT 0 NOT NULL,
	"needs_review" bigint DEFAULT 0 NOT NULL,
	"last_computed_at" bigint,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "segment_progress_pk" PRIMARY KEY("plan_id","segment_id")
);
--> statement-breakpoint
CREATE TABLE "study_plan_days" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"date" text NOT NULL,
	"day_of_week" text NOT NULL,
	"label" text,
	"is_rest_day" bigint DEFAULT 0 NOT NULL,
	"total_tasks" bigint DEFAULT 0 NOT NULL,
	"completed_tasks" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes" bigint DEFAULT 0 NOT NULL,
	"actual_minutes" bigint DEFAULT 0 NOT NULL,
	"notes_text" text,
	"target_minutes" bigint DEFAULT 0 NOT NULL,
	"assigned_minutes" bigint DEFAULT 0 NOT NULL,
	"completed_minutes" bigint DEFAULT 0 NOT NULL,
	"load_score" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_planner_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"default_plan_id" text,
	"daily_goal_minutes" bigint DEFAULT 120 NOT NULL,
	"preferred_start_time" text,
	"rest_days_json" text,
	"notifications_enabled" bigint DEFAULT 1 NOT NULL,
	"auto_reschedule" bigint DEFAULT 0 NOT NULL,
	"default_task_duration_minutes" bigint DEFAULT 30 NOT NULL,
	"streak_current" bigint DEFAULT 0 NOT NULL,
	"streak_longest" bigint DEFAULT 0 NOT NULL,
	"last_study_date" text,
	"preferences_json" text,
	"user_id" text,
	"planner_mode" text DEFAULT 'manual',
	"auto_schedule_fsrs" bigint DEFAULT 1 NOT NULL,
	"auto_schedule_weak_areas" bigint DEFAULT 0 NOT NULL,
	"auto_schedule_questions" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text,
	"selected_chapter_ids_json" text,
	"goal_json" text,
	"repeat_pattern" text,
	"total_tasks" bigint DEFAULT 0 NOT NULL,
	"completed_tasks" bigint DEFAULT 0 NOT NULL,
	"progress_percent" bigint DEFAULT 0 NOT NULL,
	"lesson_id" text,
	"exam_date" text,
	"target_mode" text,
	"daily_time_budget_min" bigint DEFAULT 120 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_task_events" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"event_kind" text NOT NULL,
	"payload" text,
	"occurred_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_task_links" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"chapter_id" text,
	"chunk_id" text,
	"question_id" text,
	"flashcard_id" text,
	"exam_session_id" text,
	"segment_id" text,
	"doc_id" text,
	"frame_id" text,
	"concept_id" text,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"metadata_json" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"plan_id" text NOT NULL,
	"day_id" text,
	"task_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" bigint DEFAULT 0 NOT NULL,
	"estimated_minutes" bigint DEFAULT 0 NOT NULL,
	"actual_minutes" bigint DEFAULT 0 NOT NULL,
	"progress_percent" bigint DEFAULT 0 NOT NULL,
	"target_count" bigint,
	"completed_count" bigint DEFAULT 0 NOT NULL,
	"priority" bigint DEFAULT 0 NOT NULL,
	"due_at" bigint,
	"started_at" bigint,
	"completed_at" bigint,
	"rescheduled_to" text,
	"result_json" text,
	"notes_text" text,
	"source_type" text DEFAULT 'manual',
	"difficulty_weight" bigint DEFAULT 1 NOT NULL,
	"scheduled_for" text,
	"origin_ref_type" text,
	"origin_ref_id" text,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"is_deleted" bigint DEFAULT 0 NOT NULL,
	"logical_clock" bigint DEFAULT 0 NOT NULL,
	"origin_id" text
);
--> statement-breakpoint
CREATE TABLE "weak_area_events" (
	"id" text PRIMARY KEY NOT NULL,
	"weak_area_id" text NOT NULL,
	"event_type" text NOT NULL,
	"source_ref_type" text,
	"source_ref_id" text,
	"weight" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weak_areas" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"concept_id" text,
	"chapter_id" text,
	"strength_score" bigint DEFAULT 50 NOT NULL,
	"weakness_score" bigint DEFAULT 50 NOT NULL,
	"last_seen_at" bigint,
	"last_remediated_at" bigint,
	"active" bigint DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yield_annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"chapter_no" bigint NOT NULL,
	"segment_no" bigint,
	"source_doc_id" text,
	"summary_label" text NOT NULL,
	"source_section_titles" text DEFAULT '[]' NOT NULL,
	"source_anchor_hints" text DEFAULT '[]' NOT NULL,
	"concept_labels" text DEFAULT '[]' NOT NULL,
	"reasons" text DEFAULT '[]' NOT NULL,
	"yield_tier" bigint DEFAULT 1 NOT NULL,
	"key_exam_info" bigint DEFAULT 0 NOT NULL,
	"high_yield_visible" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunk_assets" ADD CONSTRAINT "chunk_assets_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_study_sessions" ADD CONSTRAINT "chunk_study_sessions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_study_sessions" ADD CONSTRAINT "chunk_study_sessions_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_question_choices" ADD CONSTRAINT "contract_question_choices_contract_question_id_contract_questions_id_fk" FOREIGN KEY ("contract_question_id") REFERENCES "public"."contract_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_question_note_links" ADD CONSTRAINT "contract_question_note_links_contract_question_id_contract_questions_id_fk" FOREIGN KEY ("contract_question_id") REFERENCES "public"."contract_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_question_note_links" ADD CONSTRAINT "contract_question_note_links_doc_id_note_documents_doc_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."note_documents"("doc_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_question_note_links" ADD CONSTRAINT "contract_question_note_links_frame_id_note_frames_frame_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."note_frames"("frame_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_questions" ADD CONSTRAINT "contract_questions_linked_doc_id_note_documents_doc_id_fk" FOREIGN KEY ("linked_doc_id") REFERENCES "public"."note_documents"("doc_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_questions" ADD CONSTRAINT "contract_questions_ingest_batch_id_ingest_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_session_questions" ADD CONSTRAINT "exam_session_questions_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_session_questions" ADD CONSTRAINT "exam_session_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_review_history" ADD CONSTRAINT "flashcard_review_history_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcard_reviews" ADD CONSTRAINT "flashcard_reviews_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_source_question_id_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_documents" ADD CONSTRAINT "note_documents_chapter_id_contract_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."contract_chapters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_documents" ADD CONSTRAINT "note_documents_ingest_batch_id_ingest_batches_id_fk" FOREIGN KEY ("ingest_batch_id") REFERENCES "public"."ingest_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_frames" ADD CONSTRAINT "note_frames_doc_id_note_documents_doc_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."note_documents"("doc_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_frames" ADD CONSTRAINT "note_frames_section_id_note_sections_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."note_sections"("section_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_sections" ADD CONSTRAINT "note_sections_doc_id_note_documents_doc_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."note_documents"("doc_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bookmarks" ADD CONSTRAINT "question_bookmarks_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notebook_links" ADD CONSTRAINT "question_notebook_links_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notebook_links" ADD CONSTRAINT "question_notebook_links_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notebook_links" ADD CONSTRAINT "question_notebook_links_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notes" ADD CONSTRAINT "question_notes_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notes" ADD CONSTRAINT "question_notes_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_notes" ADD CONSTRAINT "question_notes_exam_session_question_id_exam_session_questions_id_fk" FOREIGN KEY ("exam_session_question_id") REFERENCES "public"."exam_session_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_progress" ADD CONSTRAINT "segment_progress_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_progress" ADD CONSTRAINT "segment_progress_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan_days" ADD CONSTRAINT "study_plan_days_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_planner_settings" ADD CONSTRAINT "study_planner_settings_default_plan_id_study_plans_id_fk" FOREIGN KEY ("default_plan_id") REFERENCES "public"."study_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_events" ADD CONSTRAINT "study_task_events_task_id_study_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."study_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_task_id_study_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."study_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_task_links" ADD CONSTRAINT "study_task_links_exam_session_id_exam_sessions_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_plan_id_study_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."study_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_day_id_study_plan_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."study_plan_days"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_area_events" ADD CONSTRAINT "weak_area_events_weak_area_id_weak_areas_id_fk" FOREIGN KEY ("weak_area_id") REFERENCES "public"."weak_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weak_areas" ADD CONSTRAINT "weak_areas_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_annotations" ADD CONSTRAINT "yield_annotations_source_doc_id_note_documents_doc_id_fk" FOREIGN KEY ("source_doc_id") REFERENCES "public"."note_documents"("doc_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapter_progress_status_idx" ON "chapter_progress" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chapter_progress_last_read_idx" ON "chapter_progress" USING btree ("last_read_at");--> statement-breakpoint
CREATE INDEX "cp_clock_idx" ON "chapter_progress" USING btree ("logical_clock");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_chapter_no_unique" ON "chapters" USING btree ("chapter_no");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_slug_unique" ON "chapters" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "chapters_volume_idx" ON "chapters" USING btree ("volume_no");--> statement-breakpoint
CREATE INDEX "chapters_part_idx" ON "chapters" USING btree ("part_no");--> statement-breakpoint
CREATE INDEX "chunk_assets_chunk_idx" ON "chunk_assets" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "chunk_assets_type_idx" ON "chunk_assets" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "chunk_study_sessions_chapter_idx" ON "chunk_study_sessions" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chunk_study_sessions_chunk_idx" ON "chunk_study_sessions" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "chunk_study_sessions_started_at_idx" ON "chunk_study_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_chapter_chunk_unique" ON "chunks" USING btree ("chapter_id","chunk_index");--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_slug_unique" ON "chunks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "chunks_chapter_idx" ON "chunks" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "chunks_import_idx" ON "chunks" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "chunks_kind_idx" ON "chunks" USING btree ("chunk_kind");--> statement-breakpoint
CREATE UNIQUE INDEX "concept_mastery_user_concept_unique" ON "concept_mastery" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE INDEX "concept_mastery_user_idx" ON "concept_mastery" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "concept_mastery_concept_idx" ON "concept_mastery" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "concept_mastery_mastery_idx" ON "concept_mastery" USING btree ("user_id","mastery_score");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_chapters_source_chapter_unique" ON "contract_chapters" USING btree ("source_id","chapter_no");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_choices_question_letter_unique" ON "contract_question_choices" USING btree ("contract_question_id","letter");--> statement-breakpoint
CREATE INDEX "contract_choices_question_idx" ON "contract_question_choices" USING btree ("contract_question_id");--> statement-breakpoint
CREATE INDEX "contract_choices_external_question_idx" ON "contract_question_choices" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_qnl_link_id_unique" ON "contract_question_note_links" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "contract_qnl_question_idx" ON "contract_question_note_links" USING btree ("contract_question_id");--> statement-breakpoint
CREATE INDEX "contract_qnl_external_question_idx" ON "contract_question_note_links" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "contract_qnl_doc_idx" ON "contract_question_note_links" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "contract_qnl_frame_idx" ON "contract_question_note_links" USING btree ("frame_id");--> statement-breakpoint
CREATE INDEX "contract_questions_doc_idx" ON "contract_questions" USING btree ("linked_doc_id");--> statement-breakpoint
CREATE INDEX "contract_questions_batch_idx" ON "contract_questions" USING btree ("ingest_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_session_questions_session_order_unique" ON "exam_session_questions" USING btree ("exam_session_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_session_questions_session_question_unique" ON "exam_session_questions" USING btree ("exam_session_id","question_id");--> statement-breakpoint
CREATE INDEX "exam_session_questions_session_idx" ON "exam_session_questions" USING btree ("exam_session_id");--> statement-breakpoint
CREATE INDEX "exam_session_questions_question_idx" ON "exam_session_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "exam_session_questions_outcome_idx" ON "exam_session_questions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "exam_sessions_status_idx" ON "exam_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exam_sessions_mode_idx" ON "exam_sessions" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "exam_sessions_started_at_idx" ON "exam_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "exam_sessions_completed_at_idx" ON "exam_sessions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "es_clock_idx" ON "exam_sessions" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "flashcard_decks_parent_idx" ON "flashcard_decks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "flashcard_decks_chapter_no_idx" ON "flashcard_decks" USING btree ("chapter_no");--> statement-breakpoint
CREATE INDEX "flashcard_decks_auto_idx" ON "flashcard_decks" USING btree ("is_auto_generated");--> statement-breakpoint
CREATE INDEX "flashcard_review_history_flashcard_idx" ON "flashcard_review_history" USING btree ("flashcard_id");--> statement-breakpoint
CREATE INDEX "flashcard_review_history_session_idx" ON "flashcard_review_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "flashcard_review_history_reviewed_idx" ON "flashcard_review_history" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "flashcard_review_history_undone_idx" ON "flashcard_review_history" USING btree ("undone");--> statement-breakpoint
CREATE INDEX "flashcard_reviews_flashcard_idx" ON "flashcard_reviews" USING btree ("flashcard_id");--> statement-breakpoint
CREATE INDEX "flashcard_reviews_reviewed_at_idx" ON "flashcard_reviews" USING btree ("reviewed_at");--> statement-breakpoint
CREATE INDEX "flashcard_reviews_due_at_idx" ON "flashcard_reviews" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "fr_clock_idx" ON "flashcard_reviews" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "flashcards_source_question_idx" ON "flashcards" USING btree ("source_question_id");--> statement-breakpoint
CREATE INDEX "flashcards_chapter_idx" ON "flashcards" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "flashcards_chapter_no_idx" ON "flashcards" USING btree ("chapter_no");--> statement-breakpoint
CREATE INDEX "flashcards_chunk_idx" ON "flashcards" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "flashcards_deck_idx" ON "flashcards" USING btree ("deck");--> statement-breakpoint
CREATE INDEX "flashcards_deck_id_idx" ON "flashcards" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "flashcards_due_idx" ON "flashcards" USING btree ("fsrs_due");--> statement-breakpoint
CREATE INDEX "flashcards_due_status_suspended_idx" ON "flashcards" USING btree ("fsrs_due","status","is_suspended");--> statement-breakpoint
CREATE INDEX "flashcards_state_idx" ON "flashcards" USING btree ("fsrs_state");--> statement-breakpoint
CREATE INDEX "flashcards_status_idx" ON "flashcards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "flashcards_last_reviewed_idx" ON "flashcards" USING btree ("fsrs_last_review");--> statement-breakpoint
CREATE INDEX "flashcards_sibling_idx" ON "flashcards" USING btree ("sibling_group");--> statement-breakpoint
CREATE INDEX "flashcards_clock_idx" ON "flashcards" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "flashcards_deleted_idx" ON "flashcards" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "imports_source_name_idx" ON "imports" USING btree ("source_name");--> statement-breakpoint
CREATE INDEX "imports_status_idx" ON "imports" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_batches_batch_id_unique" ON "ingest_batches" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "ingest_batches_clock_idx" ON "ingest_batches" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "ingest_batches_deleted_idx" ON "ingest_batches" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "note_documents_chapter_idx" ON "note_documents" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "note_documents_chapter_no_idx" ON "note_documents" USING btree ("chapter_no");--> statement-breakpoint
CREATE INDEX "note_documents_created_at_idx" ON "note_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "note_documents_batch_idx" ON "note_documents" USING btree ("ingest_batch_id");--> statement-breakpoint
CREATE INDEX "note_frames_doc_idx" ON "note_frames" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "note_frames_section_idx" ON "note_frames" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "note_sections_doc_idx" ON "note_sections" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "question_attempts_question_idx" ON "question_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_attempts_exam_session_idx" ON "question_attempts" USING btree ("exam_session_id");--> statement-breakpoint
CREATE INDEX "question_attempts_outcome_idx" ON "question_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "question_attempts_attempted_at_idx" ON "question_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "question_attempts_outcome_attempted_at_idx" ON "question_attempts" USING btree ("outcome","attempted_at");--> statement-breakpoint
CREATE INDEX "qa_clock_idx" ON "question_attempts" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "question_notebook_links_question_idx" ON "question_notebook_links" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_notebook_links_chapter_idx" ON "question_notebook_links" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "question_notebook_links_chunk_idx" ON "question_notebook_links" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "question_notebook_links_anchor_idx" ON "question_notebook_links" USING btree ("notebook_anchor_id");--> statement-breakpoint
CREATE INDEX "question_notes_question_idx" ON "question_notes" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "question_notes_session_idx" ON "question_notes" USING btree ("exam_session_id");--> statement-breakpoint
CREATE INDEX "question_notes_session_question_idx" ON "question_notes" USING btree ("exam_session_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "question_options_q_option_unique" ON "question_options" USING btree ("question_id","option_key");--> statement-breakpoint
CREATE INDEX "question_options_question_idx" ON "question_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_external_key_unique" ON "questions" USING btree ("external_key");--> statement-breakpoint
CREATE INDEX "questions_chapter_idx" ON "questions" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "questions_chunk_idx" ON "questions" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "questions_import_idx" ON "questions" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "questions_subject_idx" ON "questions" USING btree ("subject");--> statement-breakpoint
CREATE INDEX "questions_topic_idx" ON "questions" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "questions_active_idx" ON "questions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "questions_clock_idx" ON "questions" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "questions_deleted_idx" ON "questions" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "segment_progress_plan_idx" ON "segment_progress" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "segment_progress_segment_idx" ON "segment_progress" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "segment_progress_chapter_idx" ON "segment_progress" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "segment_progress_chapter_no_idx" ON "segment_progress" USING btree ("chapter_no");--> statement-breakpoint
CREATE INDEX "segment_progress_read_status_idx" ON "segment_progress" USING btree ("read_status");--> statement-breakpoint
CREATE INDEX "segment_progress_needs_review_idx" ON "segment_progress" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "segment_progress_mastery_idx" ON "segment_progress" USING btree ("mastery_score");--> statement-breakpoint
CREATE INDEX "segment_progress_doc_idx" ON "segment_progress" USING btree ("doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_plan_days_plan_date_unique" ON "study_plan_days" USING btree ("plan_id","date");--> statement-breakpoint
CREATE INDEX "study_plan_days_plan_idx" ON "study_plan_days" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "study_plan_days_date_idx" ON "study_plan_days" USING btree ("date");--> statement-breakpoint
CREATE INDEX "study_plan_days_dow_idx" ON "study_plan_days" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "study_plan_days_status_idx" ON "study_plan_days" USING btree ("status");--> statement-breakpoint
CREATE INDEX "study_planner_settings_user_idx" ON "study_planner_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_plans_status_idx" ON "study_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "study_plans_start_date_idx" ON "study_plans" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "study_plans_exam_date_idx" ON "study_plans" USING btree ("exam_date");--> statement-breakpoint
CREATE INDEX "study_plans_target_mode_idx" ON "study_plans" USING btree ("target_mode");--> statement-breakpoint
CREATE INDEX "study_task_events_task_idx" ON "study_task_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "study_task_events_kind_idx" ON "study_task_events" USING btree ("event_kind");--> statement-breakpoint
CREATE INDEX "study_task_events_occurred_at_idx" ON "study_task_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "study_task_links_task_idx" ON "study_task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "study_task_links_chapter_idx" ON "study_task_links" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "study_task_links_chunk_idx" ON "study_task_links" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "study_task_links_question_idx" ON "study_task_links" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "study_task_links_flashcard_idx" ON "study_task_links" USING btree ("flashcard_id");--> statement-breakpoint
CREATE INDEX "study_task_links_exam_session_idx" ON "study_task_links" USING btree ("exam_session_id");--> statement-breakpoint
CREATE INDEX "study_task_links_segment_idx" ON "study_task_links" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "study_task_links_doc_idx" ON "study_task_links" USING btree ("doc_id");--> statement-breakpoint
CREATE INDEX "study_task_links_frame_idx" ON "study_task_links" USING btree ("frame_id");--> statement-breakpoint
CREATE INDEX "study_task_links_concept_idx" ON "study_task_links" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "study_tasks_plan_idx" ON "study_tasks" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "study_tasks_day_idx" ON "study_tasks" USING btree ("day_id");--> statement-breakpoint
CREATE INDEX "study_tasks_type_idx" ON "study_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "study_tasks_status_idx" ON "study_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "study_tasks_sort_order_idx" ON "study_tasks" USING btree ("day_id","sort_order");--> statement-breakpoint
CREATE INDEX "study_tasks_due_at_idx" ON "study_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "study_tasks_priority_idx" ON "study_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "study_tasks_source_type_idx" ON "study_tasks" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "study_tasks_origin_idx" ON "study_tasks" USING btree ("origin_ref_type","origin_ref_id");--> statement-breakpoint
CREATE INDEX "study_tasks_scheduled_for_idx" ON "study_tasks" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "study_tasks_status_scheduled_for_idx" ON "study_tasks" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "st_clock_idx" ON "study_tasks" USING btree ("logical_clock");--> statement-breakpoint
CREATE INDEX "weak_area_events_weak_area_idx" ON "weak_area_events" USING btree ("weak_area_id");--> statement-breakpoint
CREATE INDEX "weak_area_events_type_idx" ON "weak_area_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "weak_area_events_source_idx" ON "weak_area_events" USING btree ("source_ref_type","source_ref_id");--> statement-breakpoint
CREATE INDEX "weak_areas_user_idx" ON "weak_areas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "weak_areas_concept_idx" ON "weak_areas" USING btree ("user_id","concept_id");--> statement-breakpoint
CREATE INDEX "weak_areas_chapter_idx" ON "weak_areas" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "weak_areas_active_idx" ON "weak_areas" USING btree ("user_id","active");--> statement-breakpoint
CREATE INDEX "yield_annotations_chapter_no_idx" ON "yield_annotations" USING btree ("chapter_no");--> statement-breakpoint
CREATE INDEX "yield_annotations_source_doc_idx" ON "yield_annotations" USING btree ("source_doc_id");--> statement-breakpoint
CREATE INDEX "yield_annotations_tier_idx" ON "yield_annotations" USING btree ("yield_tier");--> statement-breakpoint
CREATE INDEX "yield_annotations_key_exam_idx" ON "yield_annotations" USING btree ("key_exam_info");