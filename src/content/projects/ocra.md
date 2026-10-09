---
title: ocra
description: Open-CR-Agent, an open-source code review engine. Deterministic code decides what to review and where each comment lands; LLM agents only make the calls that need judgment.
date: 2026-09
status: live
order: 1
stack: [TypeScript, Node.js, OpenCode, LLM APIs]
repo: https://github.com/jma49/Open-CR-Agent
demo: https://ocracloud.com/
cover: ./covers/ocra.jpg
capture: https://ocracloud.com/
---

ocra (Open-CR-Agent) reviews code changes with specialised LLM reviewers inside a deterministic pipeline. Choosing files, splitting them up, matching rules and anchoring comments to lines are ordinary, tested code. The models are only asked for judgment, and what they find is fact-checked, de-duplicated and anchored before anyone reads it.

It's released on npm as `@open-cr-agent/cli`, still early 0.x: the CLI flags, configuration, exit codes and JSON report are stable, while prompts and review quality are still moving. It was inspired by [Cloudflare's AI code review](https://blog.cloudflare.com/ai-code-review/) and [Alibaba OpenCodeReview](https://github.com/alibaba/open-code-review).

## How a review runs

`ocra review` takes local changes, a GitHub pull request or a GitLab merge request. Code selects the files worth reviewing, assigns each a risk tier, groups related ones and matches the rules that apply. Specialist reviewer agents then read the change with your own model keys, through OpenCode or a built-in runtime for any OpenAI-compatible API.

After them, a verifier drops findings the diff disproves, and a judge de-duplicates the rest and calibrates severity; code, not a model, computes the verdict. Reviewers quote the code they mean, and ocra resolves the quote to exact lines instead of trusting a model's line numbers.

Results go to pull request comments, a versioned JSON report, SARIF and a session log. Re-reviews are incremental: a finding counts as fixed only when the code it pointed at is gone. A non-zero exit code on critical findings lets it gate CI, and there's a GitHub Action that reviews pull requests from forks without running anything from the reviewed tree.

## Design choices

- **Precision first.** Reviewers are told what not to flag: style nits, speculation and unrelated code stay out of the review.
- **Any model, with failback.** Models are configured per tier as a chain. When one is overloaded or out of quota, the task waits or moves to the next, and a circuit breaker skips a model that keeps failing.
- **Visible cost.** Every model call reports its tokens and dollars, and a spend limit stops new tasks. The report names any files that weren't reviewed.
- **Works with other analyzers.** SARIF goes out to code scanning, and SARIF from Semgrep, CodeQL and others comes in.
- **Plugins throughout.** Runtimes, reviewers and rule packs share one plugin contract, so team rules like "handlers must check tenant ownership" can be added per path.

## Measuring it

`ocra-eval` replays the AACR-Bench benchmark (200 real pull requests with 1,505 expert-verified comments) and ocra's own golden cases. It repeats runs to give confidence intervals, says whether two configurations differ by more than the noise, and shows where each missed issue was lost.

On the golden set (8 changes with 16 known issues, one run), ocra found 7 of the 16. All 7 were correct, it flagged nothing on the change with no issue, and a review cost about $1.57. That's a small sample, and recall is the weak point; prompts stay frozen until the sample is big enough to tell a real improvement from noise.

The project is Apache-2.0 licensed, with a manual in English and Chinese at [ocracloud.com](https://ocracloud.com/).
