import { supabaseAdmin } from '../../config/supabase.js'
import { callGroq } from './groqService.js'
import { callClaude } from './claudeService.js'

// ── Build AI prompt ───────────────────────────────────────────
function buildPrompt({ taskTitle, taskDescription, taskType, projectContext }) {
  return `You are Pinloop AI — a senior QA engineer assistant for developers.
A developer wants test cases generated for this:
Title: "${taskTitle}"
Description: "${taskDescription || 'No description provided'}"
Type: "${taskType || 'task'}"
Project context: "${projectContext || 'No additional context'}"

Generate comprehensive test cases and return ONLY valid JSON, no explanation:
{
  "test_cases": [
    {
      "title": "short test case title",
      "category": "happy_path|edge_case|negative|ui_ux|performance",
      "steps": ["step 1", "step 2", "step 3"],
      "expected_result": "what should happen",
      "priority": "high|medium|low"
    }
  ],
  "summary": "one line summary of what is being tested"
}

Generate at least:
- 3 happy path tests
- 2 edge case tests
- 2 negative tests
- 1 UI/UX test`
}

// ── Fallback: rule-based test cases ──────────────────────────
function buildFallbackTestCases(taskTitle) {
  return {
    test_cases: [
      {
        title: `Verify ${taskTitle} works under normal conditions`,
        category: 'happy_path',
        steps: ['Open the application', `Navigate to ${taskTitle}`, 'Perform the primary action', 'Verify the result'],
        expected_result: 'The feature works as expected with valid inputs',
        priority: 'high',
      },
      {
        title: `Verify ${taskTitle} with standard valid input`,
        category: 'happy_path',
        steps: ['Prepare valid test data', 'Submit the form or trigger the action', 'Observe result'],
        expected_result: 'System accepts valid input and responds correctly',
        priority: 'high',
      },
      {
        title: `Verify ${taskTitle} completes successfully end-to-end`,
        category: 'happy_path',
        steps: ['Set up prerequisites', 'Execute the full workflow', 'Confirm final state'],
        expected_result: 'Workflow completes without errors',
        priority: 'medium',
      },
      {
        title: `Verify ${taskTitle} with empty or null inputs`,
        category: 'edge_case',
        steps: ['Leave required fields blank', 'Attempt to submit', 'Check error handling'],
        expected_result: 'System gracefully handles empty input with clear error message',
        priority: 'medium',
      },
      {
        title: `Verify ${taskTitle} at boundary values`,
        category: 'edge_case',
        steps: ['Enter maximum allowed value', 'Enter minimum allowed value', 'Verify both are accepted or rejected appropriately'],
        expected_result: 'Boundary values are handled correctly',
        priority: 'medium',
      },
      {
        title: `Verify ${taskTitle} rejects invalid input`,
        category: 'negative',
        steps: ['Enter invalid data', 'Submit the action', 'Observe system response'],
        expected_result: 'System rejects invalid input and shows a descriptive error',
        priority: 'high',
      },
      {
        title: `Verify ${taskTitle} handles unauthorized access`,
        category: 'negative',
        steps: ['Log out or use an account without permissions', 'Attempt to access the feature', 'Verify access is denied'],
        expected_result: 'System blocks access and shows an appropriate message',
        priority: 'high',
      },
      {
        title: `Verify ${taskTitle} is usable and accessible`,
        category: 'ui_ux',
        steps: ['Open the UI', 'Check labels, buttons, and layout', 'Test keyboard navigation', 'Test on mobile viewport'],
        expected_result: 'UI is clear, accessible, and responsive across screen sizes',
        priority: 'low',
      },
    ],
    summary: `Test suite for "${taskTitle}" covering happy path, edge cases, negative scenarios, and UI/UX`,
  }
}

// ── Main export ───────────────────────────────────────────────
export async function generateTestCases(userId, { taskTitle, taskDescription, taskType, projectContext }) {
  // 1. Get user's plan → AI config
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()

  const plan = userData?.plan || 'personal_free'

  const { data: aiConfig } = await supabaseAdmin
    .from('ai_config')
    .select('provider, model_name')
    .eq('plan_type', plan)
    .single()

  const provider = aiConfig?.provider || 'groq'
  const model = aiConfig?.model_name

  // 2. Build prompt
  const prompt = buildPrompt({ taskTitle, taskDescription, taskType, projectContext })

  // 3. Call AI with fallback
  let result
  try {
    if (provider === 'claude') {
      result = await callClaude(prompt, model)
    } else {
      result = await callGroq(prompt, model)
    }
    // Validate structure
    if (!Array.isArray(result?.test_cases) || result.test_cases.length === 0) {
      throw new Error('Invalid AI response structure')
    }
  } catch {
    result = buildFallbackTestCases(taskTitle)
  }

  return {
    provider,
    test_cases: result.test_cases || [],
    summary: result.summary || `Test cases for "${taskTitle}"`,
    meta: { generatedAt: new Date().toISOString(), taskTitle },
  }
}
