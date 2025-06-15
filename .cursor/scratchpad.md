# PR Comment Processing GitHub Action

## Background and Motivation

The user wants to create a GitHub Action that automatically processes special PR comments embedded in JavaScript and TypeScript files. The workflow is:

1. Developer commits code with special comments like `// PR: some comment` or `/* PR: some comment */`
2. GitHub Action detects these comments and records their content and location
3. GitHub Action removes these comments from the code files
4. GitHub Action creates actual PR comments on GitHub at the same file/line locations with the original comment content

This allows developers to embed contextual PR comments directly in their code during development, which then get automatically converted to proper GitHub PR comments.

## Key Challenges and Analysis

TBD - Will be filled by the Planner

## High-level Task Breakdown

TBD - Will be filled by the Planner

## Project Status Board

- [ ] TBD - Tasks will be defined by the Planner

## Current Status / Progress Tracking

Project initialized. Awaiting mode selection from user.

## Executor's Feedback or Assistance Requests

None yet.

## Lessons

- Include info useful for debugging in the program output.
- Read the file before you try to edit it.
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command