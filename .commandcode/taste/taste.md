# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# research-workflow
- Use sub-agents to split research/spread tasks across different models (opus for architecture/reasoning, sonnet for code/analysis, haiku for boilerplate/lookups). Confidence: 0.75
- For social/community sentiment research, use twitter-cli, rdt-cli, and opencli tools. Confidence: 0.75
- For GitHub-specific research (issues, discussions, repos), use the `gh` CLI tool. Confidence: 0.75

# docs-organization
- Place research output in dedicated contained subfolders under kg-product-research/ (e.g., kg-product-research/scraping-legality/). Confidence: 0.80

# communication
- When asked to explain something, use simple language, assume the user knows nothing, avoid jargon (or define it), use short sentences, and include examples. Confidence: 0.85

# git
- Never inject AI co-author/attribution trailers into commit messages (e.g., "Co-Authored-By: Claude") — the user rejects any AI attribution in git history. Confidence: 0.90

# workflow
- During long-running operations (downloads, builds, benchmarks), provide progress updates every 60 seconds showing done count, remaining count, and percentage complete in a table format. Confidence: 0.80
- In progress updates for multi-step pipelines, include the active provider/service name, percentage complete, count remaining, and estimated time to completion. Confidence: 0.80

# graphify
- Use kimi-k2 as the default grader for kg-pipeline, toggleable off to fall back to inline self-grading. Confidence: 0.70
- Read API keys and tokens from /Users/mrp/dotfilesOSX/zsh/.zshrc.secrets, not from aliases or environment variable names that differ from the file's variable names. Confidence: 0.80

