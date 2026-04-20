export interface SkillSuggestion {
  skill_name: string;
  skill_category: string;
  description: string;
  relevance: string;
}

export interface LearningContext {
  jobFunction: string;
  problems: string;
  skillsNeeded: string;
}

export async function generateLearningSkills(
  level: string,
  context: LearningContext
): Promise<SkillSuggestion[]> {
  const response = await fetch('/api/generate-skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, context }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
