-- Allow anonymous/public reads of projects that have an active publish page.
-- This powers the /p/:slug public status page without requiring auth.
CREATE POLICY "Public can read published projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.publish_pages pp
      WHERE pp.project_id = id AND pp.is_active = true
    )
  );
