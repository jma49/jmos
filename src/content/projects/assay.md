---
title: Assay
description: Open-source SQL data checks for PostgreSQL. Write read-only queries whose rows are problems, run them on a schedule, and get alerted when results change.
date: 2025-04
status: live
order: 2
stack: [Next.js, TypeScript, PostgreSQL, MongoDB, Upstash, Better Auth, MCP]
repo: https://github.com/jma49/Assay
demo: https://assay.majincheng.com/
cover: ./covers/assay.jpg
capture: https://assay.majincheng.com/
---

Assay runs SQL checks against PostgreSQL databases on a schedule and tells your team when something changes, so bad data gets caught before it reaches reports or customers. A check is a read-only query whose returned rows are the problems.

## What it does

- **Checks.** Each run ends Clean (no rows), Issues (rows, each marked new, still open or fixed since the last run) or Broken (the query failed). Every check keeps its state, run history and sample rows.
- **Alerts.** Slack, Discord, Telegram, Feishu, WeCom or a signed webhook, when a check breaks, finds rows, gets new ones or recovers. Alerts can be acknowledged or muted and have owners, a daily summary and reminders.
- **An MCP server.** Agents such as Claude Code and Cursor connect with OAuth or a personal API key and can list checks, read runs, run a check, acknowledge or mute it.
- **Several data sources.** Each check picks its PostgreSQL source. Connection strings are encrypted, and private hosts are refused unless allowed.
- **Review.** When review is on, changes from non-admins wait for approval, and every edit is recorded.
- **AI helpers** that write SQL, explain it and triage results.
- The interface and its user guide are in English and Chinese.

## Running checks safely

A scheduler (Upstash QStash) runs every check whose slot is due every 30 minutes, with GitHub Actions only as a late fallback. Slot claims stop a slot from running twice, and every run goes through one path with a lease and a fencing token.

Read-only is enforced in layers: a validator only allows `SELECT`, `WITH`, `EXPLAIN` and `DO` and refuses writes, DDL and side-effecting functions; each statement runs alone inside a read-only transaction with a timeout; and the database role should only be able to `SELECT`.

## Demo

The [live demo](https://assay.majincheng.com/) opens as a guest, without an account. It has a `demo` schema of an online store with data problems planted in it and 11 checks: 10 that find them, such as duplicate orders, negative inventory and refunds larger than the payment, and one that is deliberately broken.

## How it's built

Next.js and React with TypeScript, MongoDB for checks, runs and users, PostgreSQL as the databases being checked, Upstash Redis and QStash for caching, rate limits and scheduling, Better Auth for Google and GitHub sign-in, and the Vercel AI SDK and MCP SDK. It's Apache-2.0 licensed and deployed on Vercel.
