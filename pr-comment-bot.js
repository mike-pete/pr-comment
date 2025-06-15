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
		results.push({
			file: filePath,
			line,
			type: 'multi',
			content: match[1].trim(),
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

function main() {
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
}

main()
