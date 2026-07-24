-- Deduplicate publish_pages: keep the most recent row per project_id
DELETE FROM public.publish_pages
WHERE id NOT IN (
  SELECT DISTINCT ON (project_id) id
  FROM public.publish_pages
  ORDER BY project_id, created_at DESC
);

-- Add unique constraint on project_id so upserts work cleanly going forward
ALTER TABLE public.publish_pages
ADD CONSTRAINT publish_pages_project_id_key UNIQUE (project_id);
