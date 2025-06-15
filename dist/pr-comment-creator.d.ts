/**
 * PR Comment Creator for PR Comment Processor
 *
 * This module handles creating GitHub PR review comments from extracted comment data.
 * It manages API rate limits, error handling, and ensures comments appear on correct lines.
 */
import { PRComment } from './comment-detector';
export interface PRCommentRequest {
    filename: string;
    line: number;
    body: string;
    originalComment: PRComment;
}
export interface CommentCreationResult {
    success: boolean;
    commentId?: number;
    url?: string;
    error?: string;
}
export interface BatchCommentResult {
    totalRequests: number;
    successfulComments: number;
    failedComments: number;
    createdComments: Array<{
        filename: string;
        line: number;
        commentId: number;
        url: string;
        body: string;
    }>;
    errors: Array<{
        filename: string;
        line: number;
        body: string;
        error: string;
    }>;
    rateLimitInfo?: {
        remaining: number;
        resetTime: Date;
    };
}
export interface PRCommentCreatorOptions {
    githubToken: string;
    repository: string;
    prNumber: number;
    commitSha: string;
    dryRun?: boolean;
    retryAttempts?: number;
    retryDelayMs?: number;
}
/**
 * PR Comment Creator class
 */
export declare class PRCommentCreator {
    private octokit;
    private options;
    constructor(options: PRCommentCreatorOptions);
    /**
     * Parse and validate repository string
     */
    private parseRepository;
    /**
     * Create a single PR review comment
     */
    createComment(request: PRCommentRequest): Promise<CommentCreationResult>;
    /**
     * Create multiple PR comments with rate limiting and error handling
     */
    createComments(requests: PRCommentRequest[]): Promise<BatchCommentResult>;
    /**
     * Create a comment with retry logic
     */
    private createCommentWithRetry;
    /**
     * Format the comment body with context and metadata
     */
    private formatCommentBody;
    /**
     * Format error messages for consistent logging
     */
    private formatError;
    /**
     * Utility function to add delay between requests
     */
    private delay;
    /**
     * Get rate limit information from GitHub API
     */
    getRateLimitInfo(): Promise<{
        remaining: number;
        resetTime: Date;
    }>;
    /**
     * Check if we're approaching rate limits
     */
    checkRateLimit(): Promise<boolean>;
}
/**
 * Helper function to create PR comments from extracted comment data
 */
export declare function createPRCommentRequests(processedFiles: Array<{
    filename: string;
    comments: PRComment[];
}>): PRCommentRequest[];
/**
 * Helper function to create a PRCommentCreator instance
 */
export declare function createPRCommentCreator(options: PRCommentCreatorOptions): PRCommentCreator;
/**
 * Quick function to create comments with basic options
 */
export declare function createPRComments(options: PRCommentCreatorOptions, requests: PRCommentRequest[]): Promise<BatchCommentResult>;
