/**
 * PR Comment Creator for PR Comment Processor
 * 
 * This module handles creating GitHub PR review comments from extracted comment data.
 * It manages API rate limits, error handling, and ensures comments appear on correct lines.
 */

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
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
  repository: string; // format: "owner/repo"
  prNumber: number;
  commitSha: string; // The commit SHA to comment on
  dryRun?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Rate limiting configuration for GitHub API
 */
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 60, // Conservative limit
  delayBetweenRequests: 1000, // 1 second delay between requests
  maxRetries: 3,
  retryDelayMs: 2000,
};

/**
 * PR Comment Creator class
 */
export class PRCommentCreator {
  private octokit: ReturnType<typeof getOctokit>;
  private options: PRCommentCreatorOptions;

  constructor(options: PRCommentCreatorOptions) {
    this.options = {
      retryAttempts: RATE_LIMIT_CONFIG.maxRetries,
      retryDelayMs: RATE_LIMIT_CONFIG.retryDelayMs,
      ...options
    };
    this.octokit = getOctokit(options.githubToken);
  }

  /**
   * Parse and validate repository string
   */
  private parseRepository(): { owner: string; repo: string } {
    const parts = this.options.repository.split('/');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repository format: ${this.options.repository}. Expected format: owner/repo`);
    }
    return { owner: parts[0], repo: parts[1] };
  }

  /**
   * Create a single PR review comment
   */
  async createComment(request: PRCommentRequest): Promise<CommentCreationResult> {
    if (this.options.dryRun) {
      core.info(`🔄 [DRY RUN] Would create PR comment on ${request.filename}:${request.line}`);
      core.info(`   Content: ${request.body}`);
      return {
        success: true,
        commentId: -1,
        url: `dry-run-comment-${request.filename}-${request.line}`
      };
    }

    const { owner, repo } = this.parseRepository();

    try {
      core.info(`💬 Creating PR comment on ${request.filename}:${request.line}`);
      
      const { data: comment } = await this.octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: this.options.prNumber,
        commit_id: this.options.commitSha,
        path: request.filename,
        line: request.line,
        body: this.formatCommentBody(request.body, request.originalComment)
      });

      core.info(`✅ Created comment #${comment.id} at ${comment.html_url}`);

      return {
        success: true,
        commentId: comment.id,
        url: comment.html_url
      };

    } catch (error) {
      const errorMessage = this.formatError(error);
      core.error(`❌ Failed to create comment on ${request.filename}:${request.line}: ${errorMessage}`);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Create multiple PR comments with rate limiting and error handling
   */
  async createComments(requests: PRCommentRequest[]): Promise<BatchCommentResult> {
    const result: BatchCommentResult = {
      totalRequests: requests.length,
      successfulComments: 0,
      failedComments: 0,
      createdComments: [],
      errors: []
    };

    if (requests.length === 0) {
      core.info('📝 No PR comments to create');
      return result;
    }

    core.info(`🚀 Creating ${requests.length} PR review comments...`);

    // Sort requests by filename and line for better organization
    const sortedRequests = [...requests].sort((a, b) => {
      if (a.filename !== b.filename) {
        return a.filename.localeCompare(b.filename);
      }
      return a.line - b.line;
    });

    // Process comments with rate limiting
    for (let i = 0; i < sortedRequests.length; i++) {
      const request = sortedRequests[i];
      
      // TypeScript safety check (though this should never be undefined in a standard for loop)
      if (!request) {
        core.warning(`⚠️ Skipping undefined request at index ${i}`);
        continue;
      }
      
      try {
        // Add delay between requests to respect rate limits
        if (i > 0) {
          await this.delay(RATE_LIMIT_CONFIG.delayBetweenRequests);
        }

        const commentResult = await this.createCommentWithRetry(request);
        
        if (commentResult.success) {
          result.successfulComments++;
          result.createdComments.push({
            filename: request.filename,
            line: request.line,
            commentId: commentResult.commentId!,
            url: commentResult.url!,
            body: request.body
          });
        } else {
          result.failedComments++;
          result.errors.push({
            filename: request.filename,
            line: request.line,
            body: request.body,
            error: commentResult.error || 'Unknown error'
          });
        }

      } catch (error) {
        result.failedComments++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          filename: request.filename,
          line: request.line,
          body: request.body,
          error: errorMessage
        });
      }
    }

    // Log summary
    core.info(`📊 PR comment creation summary:`);
    core.info(`   - Total requests: ${result.totalRequests}`);
    core.info(`   - Successful: ${result.successfulComments}`);
    core.info(`   - Failed: ${result.failedComments}`);
    core.info(`   - Success rate: ${((result.successfulComments / result.totalRequests) * 100).toFixed(1)}%`);

    return result;
  }

  /**
   * Create a comment with retry logic
   */
  private async createCommentWithRetry(request: PRCommentRequest): Promise<CommentCreationResult> {
    let lastError: string = '';
    
    for (let attempt = 1; attempt <= (this.options.retryAttempts || 3); attempt++) {
      try {
        return await this.createComment(request);
      } catch (error) {
        lastError = this.formatError(error);
        
        if (attempt < (this.options.retryAttempts || 3)) {
          core.warning(`⚠️ Attempt ${attempt} failed for ${request.filename}:${request.line}, retrying in ${this.options.retryDelayMs}ms...`);
          await this.delay(this.options.retryDelayMs || RATE_LIMIT_CONFIG.retryDelayMs);
        } else {
          core.error(`❌ All ${this.options.retryAttempts} attempts failed for ${request.filename}:${request.line}`);
        }
      }
    }

    return {
      success: false,
      error: lastError
    };
  }

  /**
   * Format the comment body with context and metadata
   */
  private formatCommentBody(originalContent: string, originalComment: PRComment): string {
    const timestamp = new Date().toISOString();
    const commentType = originalComment.type === 'single' ? 'single-line' : 'multi-line';
    
    return `💬 **PR Comment** (converted from ${commentType} code comment)

${originalContent}

---
*This comment was automatically extracted from a \`${originalComment.fullMatch}\` comment in the code and posted by the PR Comment Processor at ${timestamp}.*`;
  }

  /**
   * Format error messages for consistent logging
   */
  private formatError(error: any): string {
    if (error instanceof Error) {
      // Handle specific GitHub API errors
      if ('status' in error) {
        switch (error.status) {
          case 401:
            return 'Authentication failed - check GitHub token permissions';
          case 403:
            return 'Forbidden - insufficient permissions or rate limit exceeded';
          case 404:
            return 'Not found - check repository, PR number, or file path';
          case 422:
            return 'Validation failed - check commit SHA, file path, or line number';
          default:
            return `GitHub API error (${error.status}): ${error.message}`;
        }
      }
      return error.message;
    }
    return 'Unknown error occurred';
  }

  /**
   * Utility function to add delay between requests
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get rate limit information from GitHub API
   */
  async getRateLimitInfo(): Promise<{ remaining: number; resetTime: Date }> {
    try {
      const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
      
      return {
        remaining: rateLimit.rate.remaining,
        resetTime: new Date(rateLimit.rate.reset * 1000)
      };
    } catch (error) {
      core.warning('⚠️ Failed to get rate limit info');
      return {
        remaining: 0,
        resetTime: new Date()
      };
    }
  }

  /**
   * Check if we're approaching rate limits
   */
  async checkRateLimit(): Promise<boolean> {
    const rateLimitInfo = await this.getRateLimitInfo();
    
    if (rateLimitInfo.remaining < 10) {
      const waitTime = rateLimitInfo.resetTime.getTime() - Date.now();
      core.warning(`⚠️ Approaching rate limit. ${rateLimitInfo.remaining} requests remaining.`);
      
      if (waitTime > 0 && waitTime < 300000) { // Less than 5 minutes
        core.info(`⏳ Waiting ${Math.ceil(waitTime / 1000)} seconds for rate limit reset...`);
        await this.delay(waitTime + 1000); // Add 1 second buffer
      }
      
      return false;
    }
    
    return true;
  }
}

/**
 * Helper function to create PR comments from extracted comment data
 */
export function createPRCommentRequests(
  processedFiles: Array<{ filename: string; comments: PRComment[] }>
): PRCommentRequest[] {
  const requests: PRCommentRequest[] = [];

  for (const file of processedFiles) {
    for (const comment of file.comments) {
      requests.push({
        filename: file.filename,
        line: comment.lineNumber,
        body: comment.content,
        originalComment: comment
      });
    }
  }

  return requests;
}

/**
 * Helper function to create a PRCommentCreator instance
 */
export function createPRCommentCreator(options: PRCommentCreatorOptions): PRCommentCreator {
  return new PRCommentCreator(options);
}

/**
 * Quick function to create comments with basic options
 */
export async function createPRComments(
  options: PRCommentCreatorOptions,
  requests: PRCommentRequest[]
): Promise<BatchCommentResult> {
  const creator = createPRCommentCreator(options);
  return await creator.createComments(requests);
}