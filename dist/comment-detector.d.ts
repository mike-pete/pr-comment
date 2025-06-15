/**
 * Comment Detection Engine for PR Comment Processor
 *
 * This module handles detection and extraction of PR comments from JavaScript/TypeScript files.
 * It supports both single-line and multi-line comment formats while handling edge cases.
 */
export interface PRComment {
    content: string;
    lineNumber: number;
    columnStart: number;
    columnEnd: number;
    type: 'single' | 'multi';
    fullMatch: string;
    startIndex: number;
    endIndex: number;
}
export interface DetectionOptions {
    commentPrefix: string;
    caseSensitive: boolean;
    includeMultiline: boolean;
    includeSingleLine: boolean;
}
/**
 * Detects PR comments in JavaScript/TypeScript file content
 */
export declare function detectPRComments(fileContent: string, options?: Partial<DetectionOptions>): PRComment[];
/**
 * Removes a PR comment from file content
 */
export declare function removePRComment(fileContent: string, comment: PRComment): string;
/**
 * Removes multiple PR comments from file content
 * Comments are processed in reverse order to maintain correct indices
 */
export declare function removePRComments(fileContent: string, comments: PRComment[]): string;
