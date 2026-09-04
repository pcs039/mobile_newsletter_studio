-- Mobile Newsletter Studio / Supabase migration v0.6
-- Purpose: add OCR-assisted authoring as a production mode.
-- Run this once in the Supabase SQL editor before saving projects with OCR 보조형.

alter type production_mode add value if not exists 'ocr_assist';

