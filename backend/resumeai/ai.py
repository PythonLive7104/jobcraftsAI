import json
import os
import re
from typing import Any

from openai import OpenAI


def _extract_json(raw: str) -> dict:
    """Parse JSON from raw string, stripping markdown code blocks if present."""
    raw = (raw or "").strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    if match:
        raw = match.group(1).strip()
    return json.loads(raw)


def _openai_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "").strip() or os.getenv("OPEN_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not configured.")
    return OpenAI(api_key=api_key)


def _chat_completion(client: OpenAI, model: str, prompt: str) -> str:
    """Use Chat Completions API (widely supported). Fallback if Responses API fails."""
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    msg = completion.choices[0].message if completion.choices else None
    raw = (msg.content or "").strip() if msg else ""
    return raw


def analyze_job_description_with_gpt5(resume_text: str, job_description: str, job_title: str = "") -> dict[str, Any]:
    model = os.getenv("OPENAI_JOB_ANALYSIS_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are an expert ATS and recruiter assistant.\n"
        "Analyze the job description against the resume text.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "keywords": {"all": [string, ...]},\n'
        '  "match": {"present": [string, ...], "missing": [string, ...], "coverage_percent": number}\n'
        "}\n"
        "Rules:\n"
        "- Include 15-40 practical ATS keywords from the job description (skills, tools, responsibilities).\n"
        "- present and missing must be subsets of keywords.all.\n"
        "- coverage_percent must be integer 0-100.\n"
        "- Do not include markdown, comments, or extra keys.\n\n"
        f"Job Title: {job_title or 'N/A'}\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Resume Text:\n{resume_text[:12000]}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    result = _extract_json(raw)
    keywords = result.get("keywords", {})
    match = result.get("match", {})

    all_keywords = keywords.get("all", [])
    present = match.get("present", [])
    missing = match.get("missing", [])
    coverage_percent = int(match.get("coverage_percent", 0))

    if not isinstance(all_keywords, list) or not isinstance(present, list) or not isinstance(missing, list):
        raise ValueError("Invalid JSON structure from GPT model.")

    keyword_set = {str(item).strip() for item in all_keywords if str(item).strip()}
    present_clean = [str(item).strip() for item in present if str(item).strip() in keyword_set]
    missing_clean = [str(item).strip() for item in missing if str(item).strip() in keyword_set]

    if keyword_set:
        coverage_percent = int((len(set(present_clean)) / len(keyword_set)) * 100)

    return {
        "keywords": {"all": list(keyword_set)},
        "match": {
            "present": present_clean[:40],
            "missing": missing_clean[:40],
            "coverage_percent": max(0, min(100, coverage_percent)),
        },
    }


def ats_optimize(
    resume_text: str,
    job_description: str,
    target_role: str = "",
    job_title: str = "",
) -> dict[str, Any]:
    model = os.getenv("OPENAI_ATS_OPTIMIZE_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are an expert ATS resume optimizer.\n"
        "Improve the resume to better match the target job while staying truthful.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "score": number,\n'
        '  "breakdown": {\n'
        '    "keyword_match": number,\n'
        '    "experience_alignment": number,\n'
        '    "formatting": number,\n'
        '    "clarity": number\n'
        "  },\n"
        '  "missing_keywords": [string, ...],\n'
        '  "suggestions": [\n'
        '    {"type":"bullet_rewrite","section":string,"before":string,"after":string}\n'
        '    or {"type":"add_keyword","keyword":string,"where":string}\n'
        "  ],\n"
        '  "optimized_resume_text": string\n'
        "}\n"
        "Rules:\n"
        "- Keep results practical and ATS-focused.\n"
        "- score and all breakdown values must be integers 0-100.\n"
        "- missing_keywords should contain 0-25 concise keywords.\n"
        "- suggestions should contain 2-12 actionable items.\n"
        "- optimized_resume_text must be a full rewritten resume text, no markdown fences.\n"
        "- Do not add extra keys.\n\n"
        f"Target Role: {target_role or 'N/A'}\n"
        f"Job Title: {job_title or 'N/A'}\n\n"
        f"Job Description:\n{job_description}\n\n"
        f"Resume Text:\n{resume_text[:14000]}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    result = _extract_json(raw)
    if not isinstance(result, dict):
        raise ValueError("Invalid JSON structure from GPT model.")

    score = int(result.get("score", 0))
    breakdown_raw = result.get("breakdown", {}) if isinstance(result.get("breakdown"), dict) else {}
    missing_keywords_raw = result.get("missing_keywords", [])
    suggestions_raw = result.get("suggestions", [])
    optimized_text = str(result.get("optimized_resume_text", "")).strip()

    required_breakdown_keys = ["keyword_match", "experience_alignment", "formatting", "clarity"]
    breakdown: dict[str, int] = {}
    for key in required_breakdown_keys:
        breakdown[key] = max(0, min(100, int(breakdown_raw.get(key, 0))))

    if not isinstance(missing_keywords_raw, list):
        raise ValueError("Invalid missing_keywords from GPT model.")
    missing_keywords = [str(item).strip() for item in missing_keywords_raw if str(item).strip()][:25]

    if not isinstance(suggestions_raw, list):
        raise ValueError("Invalid suggestions from GPT model.")
    suggestions: list[dict[str, str]] = []
    for item in suggestions_raw[:12]:
        if not isinstance(item, dict):
            continue
        suggestion_type = str(item.get("type", "")).strip()
        cleaned: dict[str, str] = {"type": suggestion_type or "suggestion"}
        for field in ("section", "before", "after", "keyword", "where"):
            value = item.get(field)
            if isinstance(value, str) and value.strip():
                cleaned[field] = value.strip()
        suggestions.append(cleaned)

    if not optimized_text:
        raise ValueError("Missing optimized_resume_text from GPT model.")

    return {
        "score": max(0, min(100, score)),
        "breakdown": breakdown,
        "missing_keywords": missing_keywords,
        "suggestions": suggestions,
        "optimized_resume_text": optimized_text,
    }


def linkedin_optimize(target_role: str, headline: str, about: str, experience: str) -> dict[str, Any]:
    model = os.getenv("OPENAI_LINKEDIN_OPTIMIZE_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are a LinkedIn profile optimization expert.\n"
        "Improve the profile for recruiter visibility while staying truthful and professional.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "headlines": [string, ...],\n'
        '  "about_versions": [string, ...],\n'
        '  "experience_rewrites": [{"before": string, "after": string}, ...],\n'
        '  "recommended_skills": [string, ...]\n'
        "}\n"
        "Rules:\n"
        "- headlines: 2-5 options, each <= 220 chars.\n"
        "- about_versions: 1-3 concise versions.\n"
        "- experience_rewrites: 2-6 bullets with measurable impact where possible.\n"
        "- recommended_skills: 8-20 relevant keywords.\n"
        "- No markdown, no extra keys.\n\n"
        f"Target Role: {target_role}\n\n"
        f"Current Headline:\n{headline or 'N/A'}\n\n"
        f"Current About:\n{about or 'N/A'}\n\n"
        f"Current Experience:\n{experience or 'N/A'}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    parsed = _extract_json(raw)
    if not isinstance(parsed, dict):
        raise ValueError("Invalid JSON structure from GPT model.")

    headlines_raw = parsed.get("headlines", [])
    about_raw = parsed.get("about_versions", [])
    rewrites_raw = parsed.get("experience_rewrites", [])
    skills_raw = parsed.get("recommended_skills", [])

    if not isinstance(headlines_raw, list) or not isinstance(about_raw, list):
        raise ValueError("Invalid LinkedIn headline/about structure from GPT model.")
    if not isinstance(rewrites_raw, list) or not isinstance(skills_raw, list):
        raise ValueError("Invalid LinkedIn rewrite/skills structure from GPT model.")

    headlines = [str(item).strip() for item in headlines_raw if str(item).strip()][:5]
    about_versions = [str(item).strip() for item in about_raw if str(item).strip()][:3]
    recommended_skills = [str(item).strip() for item in skills_raw if str(item).strip()][:20]

    rewrites: list[dict[str, str]] = []
    for item in rewrites_raw[:6]:
        if not isinstance(item, dict):
            continue
        before = str(item.get("before", "")).strip()
        after = str(item.get("after", "")).strip()
        if before and after:
            rewrites.append({"before": before, "after": after})

    if not headlines:
        raise ValueError("No LinkedIn headline suggestions returned by GPT model.")
    if not about_versions:
        raise ValueError("No LinkedIn summary suggestions returned by GPT model.")
    if not rewrites:
        raise ValueError("No LinkedIn experience rewrites returned by GPT model.")

    return {
        "headlines": headlines,
        "about_versions": about_versions,
        "experience_rewrites": rewrites,
        "recommended_skills": recommended_skills,
    }


def career_gap_analyze(target_role: str, gap_reason: str, gap_start: str, gap_end: str, what_you_did: str) -> dict[str, Any]:
    model = os.getenv("OPENAI_CAREER_GAP_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are an expert career coach helping candidates explain career gaps and create a practical comeback plan.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "gap_assessment": {\n'
        '    "risk_level": "low" | "medium" | "high",\n'
        '    "summary": string,\n'
        '    "key_concerns": [string, ...]\n'
        "  },\n"
        '  "resume_entry": {"title": string, "dates": string, "bullets": [string, ...]},\n'
        '  "linkedin_entry": string,\n'
        '  "interview_answers": {"short": string, "medium": string, "long": string},\n'
        '  "skill_gaps": [\n'
        '    {"skill": string, "current_level": number, "target_level": number, "priority": "critical" | "important" | "good", "recommendation": string}\n'
        "  ],\n"
        '  "certifications": [\n'
        '    {"name": string, "provider": string, "relevance": "critical" | "high" | "medium", "estimated_time": string}\n'
        "  ],\n"
        '  "learning_roadmap": [\n'
        '    {"phase": string, "duration": string, "focus_areas": [string, ...], "resources": [string, ...]}\n'
        "  ],\n"
        '  "action_plan": [string, ...]\n'
        "}\n"
        "Rules:\n"
        "- current_level and target_level must be integers 0-100.\n"
        "- Provide 4-8 skill gaps.\n"
        "- Provide 2-6 certifications.\n"
        "- Provide 2-4 roadmap phases.\n"
        "- Keep all advice realistic and practical.\n"
        "- No markdown, no extra keys.\n\n"
        f"Target Role: {target_role}\n"
        f"Gap Reason: {gap_reason}\n"
        f"Gap Start: {gap_start}\n"
        f"Gap End: {gap_end}\n"
        f"What User Did During Gap:\n{what_you_did or 'N/A'}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    parsed = _extract_json(raw)
    if not isinstance(parsed, dict):
        raise ValueError("Invalid JSON structure from GPT model.")

    gap_assessment_raw = parsed.get("gap_assessment", {})
    resume_entry_raw = parsed.get("resume_entry", {})
    interview_answers_raw = parsed.get("interview_answers", {})
    skill_gaps_raw = parsed.get("skill_gaps", [])
    certs_raw = parsed.get("certifications", [])
    roadmap_raw = parsed.get("learning_roadmap", [])
    action_plan_raw = parsed.get("action_plan", [])

    if not isinstance(gap_assessment_raw, dict):
        raise ValueError("Invalid gap_assessment structure from GPT model.")
    if not isinstance(resume_entry_raw, dict):
        raise ValueError("Invalid resume_entry structure from GPT model.")
    if not isinstance(interview_answers_raw, dict):
        raise ValueError("Invalid interview_answers structure from GPT model.")
    if not isinstance(skill_gaps_raw, list):
        raise ValueError("Invalid skill_gaps structure from GPT model.")

    risk_level = str(gap_assessment_raw.get("risk_level", "medium")).strip().lower()
    if risk_level not in {"low", "medium", "high"}:
        risk_level = "medium"
    key_concerns_raw = gap_assessment_raw.get("key_concerns", [])
    key_concerns = [str(item).strip() for item in key_concerns_raw if str(item).strip()] if isinstance(key_concerns_raw, list) else []

    resume_bullets_raw = resume_entry_raw.get("bullets", [])
    resume_bullets = [str(item).strip() for item in resume_bullets_raw if str(item).strip()] if isinstance(resume_bullets_raw, list) else []
    resume_entry = {
        "title": str(resume_entry_raw.get("title", "Career Break")).strip() or "Career Break",
        "dates": str(resume_entry_raw.get("dates", f"{gap_start} - {gap_end}")).strip() or f"{gap_start} - {gap_end}",
        "bullets": resume_bullets[:6],
    }

    interview_answers = {
        "short": str(interview_answers_raw.get("short", "")).strip(),
        "medium": str(interview_answers_raw.get("medium", "")).strip(),
        "long": str(interview_answers_raw.get("long", "")).strip(),
    }
    if not interview_answers["short"] or not interview_answers["medium"] or not interview_answers["long"]:
        raise ValueError("Incomplete interview_answers returned by GPT model.")

    skill_gaps: list[dict[str, Any]] = []
    for item in skill_gaps_raw[:8]:
        if not isinstance(item, dict):
            continue
        skill = str(item.get("skill", "")).strip()
        recommendation = str(item.get("recommendation", "")).strip()
        if not skill or not recommendation:
            continue
        priority = str(item.get("priority", "important")).strip().lower()
        if priority not in {"critical", "important", "good"}:
            priority = "important"
        current_level = max(0, min(100, int(item.get("current_level", 0))))
        target_level = max(current_level, min(100, int(item.get("target_level", current_level))))
        skill_gaps.append(
            {
                "skill": skill,
                "current_level": current_level,
                "target_level": target_level,
                "priority": priority,
                "recommendation": recommendation,
            }
        )

    certifications: list[dict[str, str]] = []
    if isinstance(certs_raw, list):
        for item in certs_raw[:6]:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            provider = str(item.get("provider", "")).strip()
            estimated_time = str(item.get("estimated_time", "")).strip()
            if not name or not provider:
                continue
            relevance = str(item.get("relevance", "medium")).strip().lower()
            if relevance not in {"critical", "high", "medium"}:
                relevance = "medium"
            certifications.append(
                {
                    "name": name,
                    "provider": provider,
                    "relevance": relevance,
                    "estimated_time": estimated_time or "TBD",
                }
            )

    learning_roadmap: list[dict[str, Any]] = []
    if isinstance(roadmap_raw, list):
        for item in roadmap_raw[:4]:
            if not isinstance(item, dict):
                continue
            phase = str(item.get("phase", "")).strip()
            duration = str(item.get("duration", "")).strip()
            focus_areas_raw = item.get("focus_areas", [])
            resources_raw = item.get("resources", [])
            if not phase:
                continue
            focus_areas = [str(x).strip() for x in focus_areas_raw if str(x).strip()] if isinstance(focus_areas_raw, list) else []
            resources = [str(x).strip() for x in resources_raw if str(x).strip()] if isinstance(resources_raw, list) else []
            learning_roadmap.append(
                {
                    "phase": phase,
                    "duration": duration or "TBD",
                    "focus_areas": focus_areas[:8],
                    "resources": resources[:8],
                }
            )

    action_plan = [str(item).strip() for item in action_plan_raw if str(item).strip()] if isinstance(action_plan_raw, list) else []

    if not skill_gaps:
        raise ValueError("No usable skill_gaps returned by GPT model.")
    if not learning_roadmap:
        raise ValueError("No usable learning_roadmap returned by GPT model.")

    return {
        "gap_assessment": {
            "risk_level": risk_level,
            "summary": str(gap_assessment_raw.get("summary", "")).strip(),
            "key_concerns": key_concerns[:8],
        },
        "resume_entry": resume_entry,
        "linkedin_entry": str(parsed.get("linkedin_entry", "")).strip(),
        "interview_answers": interview_answers,
        "skill_gaps": skill_gaps,
        "certifications": certifications,
        "learning_roadmap": learning_roadmap,
        "action_plan": action_plan[:12],
    }


def generate_cover_letter_with_gpt5(
    resume_text: str,
    company_name: str,
    job_title: str,
    tone: str = "professional",
    job_description: str = "",
) -> str:
    model = os.getenv("OPENAI_COVER_LETTER_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are an expert career coach and technical recruiter.\n"
        "Write a strong, concise, truthful cover letter tailored to the role.\n"
        "Output plain text only (no markdown, no code fences, no heading labels).\n"
        "Length: 220-380 words.\n"
        "Use this structure:\n"
        "1) Opening motivation for role/company\n"
        "2) 1-2 evidence-rich achievement paragraphs grounded in resume\n"
        "3) Closing with confidence and call to action\n"
        "Rules:\n"
        "- Do not invent experience not supported by resume text.\n"
        "- Keep tone consistent with selected tone.\n"
        "- Avoid generic fluff.\n\n"
        f"Tone: {tone}\n"
        f"Company: {company_name or 'Hiring Team'}\n"
        f"Job Title: {job_title or 'Role'}\n\n"
        f"Job Description:\n{job_description[:8000] or 'N/A'}\n\n"
        f"Resume Text:\n{resume_text[:12000]}\n"
    )

    text = _chat_completion(client, model, prompt)
    if not text:
        raise ValueError("Empty response from GPT model.")
    return text


def generate_interview_prep_with_gpt5(
    resume_text: str,
    job_title: str,
    job_requirements: str = "",
) -> dict[str, Any]:
    model = os.getenv("OPENAI_INTERVIEW_PREP_MODEL", "gpt-4o")
    client = _openai_client()

    prompt = (
        "You are an expert interview coach for software and product roles.\n"
        "Generate tailored interview preparation content from the provided resume and target role.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "categories": [\n'
        "    {\n"
        '      "category": string,\n'
        '      "questions": [\n'
        "        {\n"
        '          "question": string,\n'
        '          "suggested_answer": string,\n'
        '          "tips": [string, ...],\n'
        '          "star_framework": {\n'
        '             "situation": string,\n'
        '             "task": string,\n'
        '             "action": string,\n'
        '             "result": string\n'
        "          } | null\n"
        "        }\n"
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- Provide 2-4 categories.\n"
        "- Each category should have 2-5 questions.\n"
        "- Keep answers practical and interview-ready.\n"
        "- Include STAR framework for behavioral/leadership style questions, otherwise null.\n"
        "- tips should have 2-4 concise bullets.\n"
        "- Do not include extra keys.\n\n"
        f"Job Title: {job_title}\n\n"
        f"Job Requirements:\n{job_requirements[:8000] or 'N/A'}\n\n"
        f"Resume Text:\n{resume_text[:12000]}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    parsed = _extract_json(raw)
    categories_raw = parsed.get("categories", [])
    if not isinstance(categories_raw, list):
        raise ValueError("Invalid categories structure from GPT model.")

    categories: list[dict[str, Any]] = []
    for category_item in categories_raw[:4]:
        if not isinstance(category_item, dict):
            continue
        category_name = str(category_item.get("category", "")).strip()
        questions_raw = category_item.get("questions", [])
        if not category_name or not isinstance(questions_raw, list):
            continue

        questions: list[dict[str, Any]] = []
        for question_item in questions_raw[:5]:
            if not isinstance(question_item, dict):
                continue
            question = str(question_item.get("question", "")).strip()
            suggested_answer = str(question_item.get("suggested_answer", "")).strip()
            tips_raw = question_item.get("tips", [])
            if not question or not suggested_answer or not isinstance(tips_raw, list):
                continue

            tips = [str(t).strip() for t in tips_raw if str(t).strip()][:4]
            star_raw = question_item.get("star_framework")
            star: dict[str, str] | None = None
            if isinstance(star_raw, dict):
                s = str(star_raw.get("situation", "")).strip()
                t = str(star_raw.get("task", "")).strip()
                a = str(star_raw.get("action", "")).strip()
                r = str(star_raw.get("result", "")).strip()
                if s and t and a and r:
                    star = {"situation": s, "task": t, "action": a, "result": r}

            questions.append(
                {
                    "question": question,
                    "suggested_answer": suggested_answer,
                    "tips": tips,
                    "star_framework": star,
                }
            )

        if questions:
            categories.append({"category": category_name, "questions": questions})

    if not categories:
        raise ValueError("No usable interview prep content returned by GPT model.")

    return {"categories": categories}


def answer_custom_interview_questions(
    questions: list[str],
    resume_text: str,
    job_title: str,
    job_requirements: str = "",
) -> list[dict[str, Any]]:
    """Generate suggested answers for custom interview questions. Returns list of question/answer dicts."""
    if not questions:
        return []

    model = os.getenv("OPENAI_INTERVIEW_PREP_MODEL", "gpt-4o")
    client = _openai_client()

    questions_text = "\n".join(f"- {q.strip()}" for q in questions if q.strip())[:2000]
    prompt = (
        "You are an expert interview coach. Answer each interview question based on the resume and job context.\n"
        "Return ONLY valid JSON with this exact schema:\n"
        "{\n"
        '  "answers": [\n'
        "    {\n"
        '      "question": string,\n'
        '      "suggested_answer": string,\n'
        '      "tips": [string, ...],\n'
        '      "star_framework": {\n'
        '        "situation": string,\n'
        '        "task": string,\n'
        '        "action": string,\n'
        '        "result": string\n'
        "      } | null\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Rules:\n"
        "- answers array must have one entry per question, in the same order.\n"
        "- suggested_answer: 2-4 paragraphs, interview-ready.\n"
        "- tips: 2-4 concise bullets.\n"
        "- Use STAR framework for behavioral questions, otherwise null.\n"
        "- Do not include extra keys.\n\n"
        f"Questions:\n{questions_text}\n\n"
        f"Job Title: {job_title}\n\n"
        f"Job Requirements:\n{job_requirements[:4000] or 'N/A'}\n\n"
        f"Resume Text:\n{resume_text[:8000]}\n"
    )

    raw = _chat_completion(client, model, prompt)
    if not raw:
        raise ValueError("Empty response from GPT model.")

    parsed = _extract_json(raw)
    answers_raw = parsed.get("answers", []) if isinstance(parsed, dict) else []
    if not isinstance(answers_raw, list):
        return []

    result: list[dict[str, Any]] = []
    for i, ans in enumerate(answers_raw[:10]):  # cap at 10
        if not isinstance(ans, dict):
            continue
        question = questions[i] if i < len(questions) else str(ans.get("question", "")).strip()
        suggested_answer = str(ans.get("suggested_answer", "")).strip()
        tips_raw = ans.get("tips", [])
        tips = [str(t).strip() for t in (tips_raw if isinstance(tips_raw, list) else []) if str(t).strip()][:4]
        star_raw = ans.get("star_framework")
        star: dict[str, str] | None = None
        if isinstance(star_raw, dict):
            s = str(star_raw.get("situation", "")).strip()
            t = str(star_raw.get("task", "")).strip()
            a = str(star_raw.get("action", "")).strip()
            r = str(star_raw.get("result", "")).strip()
            if s and t and a and r:
                star = {"situation": s, "task": t, "action": a, "result": r}
        if question and suggested_answer:
            result.append({
                "question": question,
                "suggested_answer": suggested_answer,
                "tips": tips,
                "star_framework": star,
            })
    return result