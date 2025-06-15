"use strict";
/**
 * Comment Detection Engine for PR Comment Processor
 *
 * This module handles detection and extraction of PR comments from JavaScript/TypeScript files.
 * It supports both single-line and multi-line comment formats while handling edge cases.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPRComments = detectPRComments;
exports.removePRComment = removePRComment;
exports.removePRComments = removePRComments;
/**
 * Default options for comment detection
 */
const DEFAULT_OPTIONS = {
    commentPrefix: 'PR:',
    caseSensitive: false,
    includeMultiline: true,
    includeSingleLine: true,
};
/**
 * Detects PR comments in JavaScript/TypeScript file content
 */
function detectPRComments(fileContent, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const comments = [];
    // Split content into lines for line number tracking
    const lines = fileContent.split('\n');
    // Track current position in the file
    let currentIndex = 0;
    // Process each line
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) {
            currentIndex += 1; // Just the newline character
            continue;
        }
        const lineNumber = lineIndex + 1; // 1-based line numbers
        // Find comments in this line
        const lineComments = findCommentsInLine(line, lineNumber, currentIndex, opts);
        comments.push(...lineComments);
        // Update current index (add line length + newline character)
        currentIndex += line.length + 1;
    }
    // Handle multi-line comments that span multiple lines
    if (opts.includeMultiline) {
        const multilineComments = findMultilineComments(fileContent, opts);
        // Filter out duplicates (comments already found in single-line processing)
        const uniqueMultilineComments = multilineComments.filter(multiComment => !comments.some(singleComment => singleComment.startIndex === multiComment.startIndex));
        comments.push(...uniqueMultilineComments);
    }
    // Sort comments by their position in the file
    return comments.sort((a, b) => a.startIndex - b.startIndex);
}
/**
 * Finds PR comments in a single line
 */
function findCommentsInLine(line, lineNumber, lineStartIndex, options) {
    const comments = [];
    // Handle single-line comments (// PR: ...)
    if (options.includeSingleLine) {
        const singleLineComments = findSingleLineComments(line, lineNumber, lineStartIndex, options);
        comments.push(...singleLineComments);
    }
    // Handle multi-line comments on single line (/* PR: ... */)
    if (options.includeMultiline) {
        const inlineMultiComments = findInlineMultiComments(line, lineNumber, lineStartIndex, options);
        comments.push(...inlineMultiComments);
    }
    return comments;
}
/**
 * Finds single-line PR comments (// PR: ...)
 */
function findSingleLineComments(line, lineNumber, lineStartIndex, options) {
    const comments = [];
    // Create regex pattern for single-line comments
    const prefix = escapeRegExp(options.commentPrefix);
    const flags = options.caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(`//\\s*${prefix}\\s*(.*)`, flags);
    let match;
    while ((match = pattern.exec(line)) !== null) {
        // Check if this comment is inside a string literal
        if (isInsideStringLiteral(line, match.index)) {
            continue;
        }
        const content = (match[1] || '').trim();
        const columnStart = match.index;
        const columnEnd = match.index + match[0].length;
        comments.push({
            content,
            lineNumber,
            columnStart,
            columnEnd,
            type: 'single',
            fullMatch: match[0],
            startIndex: lineStartIndex + columnStart,
            endIndex: lineStartIndex + columnEnd,
        });
    }
    return comments;
}
/**
 * Finds inline multi-line PR comments (/&#42; PR: ... &#42;/)
 */
function findInlineMultiComments(line, lineNumber, lineStartIndex, options) {
    const comments = [];
    // Create regex pattern for inline multi-line comments
    const prefix = escapeRegExp(options.commentPrefix);
    const flags = options.caseSensitive ? 'g' : 'gi';
    const pattern = new RegExp(`/\\*\\s*${prefix}\\s*(.*?)\\*/`, flags);
    let match;
    while ((match = pattern.exec(line)) !== null) {
        // Check if this comment is inside a string literal
        if (isInsideStringLiteral(line, match.index)) {
            continue;
        }
        const content = (match[1] || '').trim();
        const columnStart = match.index;
        const columnEnd = match.index + match[0].length;
        comments.push({
            content,
            lineNumber,
            columnStart,
            columnEnd,
            type: 'multi',
            fullMatch: match[0],
            startIndex: lineStartIndex + columnStart,
            endIndex: lineStartIndex + columnEnd,
        });
    }
    return comments;
}
/**
 * Finds multi-line PR comments that span multiple lines
 */
function findMultilineComments(fileContent, options) {
    const comments = [];
    // Create regex pattern for multi-line comments
    const prefix = escapeRegExp(options.commentPrefix);
    const flags = options.caseSensitive ? 'gs' : 'gis';
    const pattern = new RegExp(`/\\*\\s*${prefix}\\s*(.*?)\\*/`, flags);
    let match;
    while ((match = pattern.exec(fileContent)) !== null) {
        // Calculate line number and column information
        const beforeMatch = fileContent.substring(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
        const lastNewlineIndex = beforeMatch.lastIndexOf('\n');
        const columnStart = lastNewlineIndex === -1 ? match.index : match.index - lastNewlineIndex - 1;
        // Check if this comment is inside a string literal by examining the line
        const lines = fileContent.split('\n');
        const currentLine = lines[lineNumber - 1];
        if (currentLine && isInsideStringLiteral(currentLine, columnStart)) {
            continue;
        }
        // Extract content and clean up whitespace
        const content = (match[1] || '').replace(/\n\s*/g, ' ').trim();
        // Calculate end position
        const endBeforeMatch = fileContent.substring(0, match.index + match[0].length);
        const endLineNumber = (endBeforeMatch.match(/\n/g) || []).length + 1;
        const endLastNewlineIndex = endBeforeMatch.lastIndexOf('\n');
        const columnEnd = endLastNewlineIndex === -1
            ? match.index + match[0].length
            : match.index + match[0].length - endLastNewlineIndex - 1;
        comments.push({
            content,
            lineNumber,
            columnStart,
            columnEnd: endLineNumber === lineNumber ? columnEnd : columnStart + match[0].length,
            type: 'multi',
            fullMatch: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
        });
    }
    return comments;
}
/**
 * Checks if a position in a line is inside a string literal
 * This helps avoid false positives from comments inside strings
 */
function isInsideStringLiteral(line, position) {
    // Enhanced implementation to properly handle quotes
    const beforePosition = line.substring(0, position);
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inBacktick = false;
    for (let i = 0; i < beforePosition.length; i++) {
        const char = beforePosition[i];
        const prevChar = i > 0 ? beforePosition[i - 1] : '';
        // Skip escaped characters
        if (prevChar === '\\') {
            continue;
        }
        // Toggle quote states
        if (char === "'" && !inDoubleQuote && !inBacktick) {
            inSingleQuote = !inSingleQuote;
        }
        else if (char === '"' && !inSingleQuote && !inBacktick) {
            inDoubleQuote = !inDoubleQuote;
        }
        else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
            inBacktick = !inBacktick;
        }
    }
    // If we're inside any type of string, return true
    return inSingleQuote || inDoubleQuote || inBacktick;
}
/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Removes a PR comment from file content
 */
function removePRComment(fileContent, comment) {
    const before = fileContent.substring(0, comment.startIndex);
    const after = fileContent.substring(comment.endIndex);
    // For single-line comments, we might want to remove the entire line if it only contains the comment
    if (comment.type === 'single') {
        const lines = fileContent.split('\n');
        const line = lines[comment.lineNumber - 1];
        if (!line) {
            // Line doesn't exist, just remove the comment part
            return before + after;
        }
        const beforeComment = line.substring(0, comment.columnStart).trim();
        const afterComment = line.substring(comment.columnEnd).trim();
        // If the line only contains the comment (and whitespace), remove the entire line
        if (beforeComment === '' && afterComment === '') {
            lines.splice(comment.lineNumber - 1, 1);
            return lines.join('\n');
        }
    }
    // Otherwise, just remove the comment part
    return before + after;
}
/**
 * Removes multiple PR comments from file content
 * Comments are processed in reverse order to maintain correct indices
 */
function removePRComments(fileContent, comments) {
    // Sort comments by end index in descending order to maintain correct indices
    const sortedComments = [...comments].sort((a, b) => b.endIndex - a.endIndex);
    let result = fileContent;
    for (const comment of sortedComments) {
        result = removePRComment(result, comment);
    }
    return result;
}
//# sourceMappingURL=comment-detector.js.map