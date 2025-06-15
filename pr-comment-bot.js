import { Octokit } from '@octokit/rest'
import fs from 'fs'
import path from 'path'

const SINGLE_LINE_REGEX = /\/\/\s*PR:(.*)/g
const MULTI_LINE_REGEX = /\/\*\s*PR:([\s\S]*?)\*\//g

function getAllFiles(dir, exts, fileList = []) {
	const files = fs.readdirSync(dir)
	files.forEach((file) => {
		const filePath = path.join(dir, file)
		const stat = fs.statSync(filePath)
		if (stat.isDirectory()) {
			getAllFiles(filePath, exts, fileList)
		} else if (exts.includes(path.extname(file))) {
			fileList.push(filePath)
		}
	})
	return fileList
}

function scanFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8')
	const lines = content.split(/\r?\n/)
	const results = []

	// Single-line comments
	lines.forEach((line, idx) => {
		let match
		SINGLE_LINE_REGEX.lastIndex = 0
		while ((match = SINGLE_LINE_REGEX.exec(line)) !== null) {
			results.push({
				file: filePath,
				line: idx + 1,
				type: 'single',
				content: match[1].trim(),
				context: lines[idx + 1] || '', // line after the comment
			})
		}
	})

	// Multi-line comments
	let match
	MULTI_LINE_REGEX.lastIndex = 0
	while ((match = MULTI_LINE_REGEX.exec(content)) !== null) {
		// Find the line number of the start of the match
		const before = content.slice(0, match.index)
		const line = before.split(/\r?\n/).length
		const linesArr = content.split(/\r?\n/)
		const afterLine = linesArr[line] || ''
		results.push({
			file: filePath,
			line,
			type: 'multi',
			content: match[1].trim(),
			context: afterLine,
		})
	}

	return results
}

function removePRComments(filePath) {
	let content = fs.readFileSync(filePath, 'utf8')
	// Remove multi-line PR comments first
	content = content.replace(MULTI_LINE_REGEX, '')
	// Remove single-line PR comments
	content = content
		.split(/\r?\n/)
		.map((line) => line.replace(SINGLE_LINE_REGEX, '').replace(/^\s+$/, ''))
		.join('\n')
	fs.writeFileSync(filePath, content, 'utf8')
}

function findNewLineNumber(cleanedLines, context, startLine) {
	// Try to find the first occurrence of the context line after the original line
	for (let i = startLine - 1; i < cleanedLines.length; i++) {
		if (cleanedLines[i] && cleanedLines[i].trim() === context.trim()) {
			return i + 1
		}
	}
	// Fallback: return the original line if context not found
	return Math.min(startLine, cleanedLines.length)
}

async function postPRComments(comments) {
	const token = process.env.GITHUB_TOKEN
	const prNumber = process.env.PR_NUMBER
	const commitSha = process.env.COMMIT_SHA
	const repo = process.env.GITHUB_REPOSITORY

	if (!token || !prNumber || !commitSha || !repo) {
		console.error('Missing required environment variables for posting PR comments.')
		return
	}

	const [owner, repoName] = repo.split('/')
	const octokit = new Octokit({ auth: token })

	for (const comment of comments) {
		try {
			await octokit.pulls.createReviewComment({
				owner,
				repo: repoName,
				pull_number: Number(prNumber),
				commit_id: commitSha,
				path: comment.file,
				line: comment.newLine,
				side: 'RIGHT',
				body: comment.content,
			})
			console.log(`Posted comment to PR #${prNumber} on ${comment.file}:${comment.newLine}`)
		} catch (err) {
			console.error(`Failed to post comment on ${comment.file}:${comment.newLine}:`, err.message)
		}
	}
}

async function main() {
	const exts = ['.ts', '.tsx']
	const files = getAllFiles('.', exts)
	let allResults = []
	files.forEach((file) => {
		allResults = allResults.concat(scanFile(file))
	})
	console.log('PR comments found:', JSON.stringify(allResults, null, 2))

	// Remove PR comments from files
	files.forEach((file) => {
		removePRComments(file)
	})
	console.log('PR comments removed from code.')

	// Re-scan cleaned files to map new line numbers
	let cleanedResults = []
	let cleanedLinesMap = {}
	files.forEach((file) => {
		const cleanedContent = fs.readFileSync(file, 'utf8')
		cleanedLinesMap[file] = cleanedContent.split(/\r?\n/)
	})
	const commentsWithNewLines = allResults.map((comment) => {
		const cleanedLines = cleanedLinesMap[comment.file]
		const newLine = findNewLineNumber(cleanedLines, comment.context, comment.line)
		return { ...comment, newLine }
	})

	// Post PR comments to GitHub (real)
	await postPRComments(commentsWithNewLines)
}

main()
