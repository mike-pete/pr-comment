/**
 * PR Workflow Coordinator for PR Comment Processor
 * 
 * This module coordinates the complete workflow:
 * 1. Process files and detect PR comments
 * 2. Create PR review comments
 * 3. Commit modified files back to the PR branch
 */

import * as core from '@actions/core';
import { FileProcessor, FileProcessorOptions } from './file-processor';
import { PRCommentCreator, PRCommentCreatorOptions, createPRCommentRequests } from './pr-comment-creator';

export interface WorkflowOptions {
  githubToken: string;
  repository: string; // format: "owner/repo"
  prNumber: number;
  baseSha: string;
  headSha: string;
  branchName: string;
  commentPrefix?: string;
  dryRun?: boolean;
  skipFileCommits?: boolean;
  skipPRComments?: boolean;
}

export interface WorkflowResult {
  success: boolean;
  summary: {
    filesProcessed: number;
    commentsFound: number;
    prCommentsCreated: number;
    filesCommitted: number;
    processingTimeMs: number;
  };
  fileProcessingResult?: any;
  commentCreationResult?: any;
  commitResult?: any;
  errors: Array<{
    phase: 'file-processing' | 'comment-creation' | 'file-commit';
    error: string;
  }>;
}

/**
 * PR Workflow Coordinator class
 */
export class PRWorkflowCoordinator {
  private options: WorkflowOptions;
  private fileProcessor: FileProcessor;
  private commentCreator: PRCommentCreator;

  constructor(options: WorkflowOptions) {
    this.options = {
      commentPrefix: 'PR:',
      dryRun: false,
      skipFileCommits: false,
      skipPRComments: false,
      ...options
    };

    // Initialize file processor
    const fileProcessorOptions: FileProcessorOptions = {
      githubToken: this.options.githubToken,
      repository: this.options.repository,
      prNumber: this.options.prNumber,
      baseSha: this.options.baseSha,
      headSha: this.options.headSha,
      commentPrefix: this.options.commentPrefix || 'PR:',
      dryRun: this.options.dryRun || false
    };

    this.fileProcessor = new FileProcessor(fileProcessorOptions);

    // Initialize comment creator
    const commentCreatorOptions: PRCommentCreatorOptions = {
      githubToken: this.options.githubToken,
      repository: this.options.repository,
      prNumber: this.options.prNumber,
      commitSha: this.options.headSha,
      dryRun: this.options.dryRun || false
    };

    this.commentCreator = new PRCommentCreator(commentCreatorOptions);
  }

  /**
   * Execute the complete PR comment processing workflow
   */
  async executeWorkflow(): Promise<WorkflowResult> {
    const startTime = Date.now();
    const result: WorkflowResult = {
      success: false,
      summary: {
        filesProcessed: 0,
        commentsFound: 0,
        prCommentsCreated: 0,
        filesCommitted: 0,
        processingTimeMs: 0
      },
      errors: []
    };

    try {
      core.info('🚀 Starting PR Comment Processor workflow...');
      
      // Phase 1: Process files and detect comments
      core.info('📁 Phase 1: Processing files and detecting PR comments...');
      const fileProcessingResult = await this.processFiles();
      result.fileProcessingResult = fileProcessingResult;
      result.summary.filesProcessed = fileProcessingResult.processedFiles.length;
      result.summary.commentsFound = fileProcessingResult.totalComments;

      if (fileProcessingResult.errors.length > 0) {
        for (const error of fileProcessingResult.errors) {
          result.errors.push({
            phase: 'file-processing',
            error: `${error.file}: ${error.error}`
          });
        }
      }

      // Phase 2: Create PR comments (if not skipped and comments found)
      if (!this.options.skipPRComments && fileProcessingResult.totalComments > 0) {
        core.info('💬 Phase 2: Creating PR review comments...');
        const commentCreationResult = await this.createPRComments(fileProcessingResult.processedFiles);
        result.commentCreationResult = commentCreationResult;
        result.summary.prCommentsCreated = commentCreationResult.successfulComments;

        if (commentCreationResult.errors.length > 0) {
          for (const error of commentCreationResult.errors) {
            result.errors.push({
              phase: 'comment-creation',
              error: `${error.filename}:${error.line}: ${error.error}`
            });
          }
        }
      } else if (this.options.skipPRComments) {
        core.info('⏭️ Phase 2: Skipping PR comment creation (skipPRComments = true)');
      } else {
        core.info('📝 Phase 2: No PR comments to create');
      }

      // Phase 3: Commit modified files (if not skipped and files were modified)
      if (!this.options.skipFileCommits && fileProcessingResult.totalFilesModified > 0) {
        core.info('📤 Phase 3: Committing modified files...');
        const commitResult = await this.commitModifiedFiles(fileProcessingResult.processedFiles);
        result.commitResult = commitResult;
        result.summary.filesCommitted = commitResult.filesCommitted;

        if (commitResult.errors.length > 0) {
          for (const error of commitResult.errors) {
            result.errors.push({
              phase: 'file-commit',
              error: error
            });
          }
        }
      } else if (this.options.skipFileCommits) {
        core.info('⏭️ Phase 3: Skipping file commits (skipFileCommits = true)');
      } else {
        core.info('📝 Phase 3: No modified files to commit');
      }

      // Calculate processing time
      result.summary.processingTimeMs = Date.now() - startTime;

      // Determine overall success
      result.success = result.errors.length === 0;

      // Log final summary
      this.logWorkflowSummary(result);

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      core.error(`❌ Workflow failed: ${errorMessage}`);
      
      result.errors.push({
        phase: 'file-processing', // Default phase for unexpected errors
        error: errorMessage
      });

      result.summary.processingTimeMs = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Process files and detect PR comments
   */
  private async processFiles() {
    try {
      return await this.fileProcessor.processFiles();
    } catch (error) {
      core.error('❌ File processing phase failed');
      throw error;
    }
  }

  /**
   * Create PR review comments from detected comments
   */
  private async createPRComments(processedFiles: any[]) {
    try {
      // Convert processed files to comment requests
      const commentRequests = createPRCommentRequests(processedFiles);
      
      if (commentRequests.length === 0) {
        return {
          totalRequests: 0,
          successfulComments: 0,
          failedComments: 0,
          createdComments: [],
          errors: []
        };
      }

      // Create the comments
      return await this.commentCreator.createComments(commentRequests);
    } catch (error) {
      core.error('❌ Comment creation phase failed');
      throw error;
    }
  }

  /**
   * Commit modified files back to the PR branch
   */
  private async commitModifiedFiles(processedFiles: any[]) {
    const result = {
      filesCommitted: 0,
      errors: [] as string[]
    };

    try {
      // Filter files that have been modified
      const modifiedFiles = processedFiles.filter(file => 
        file.modifiedContent && file.modifiedContent !== file.originalContent
      );

      if (modifiedFiles.length === 0) {
        core.info('📝 No files require committing');
        return result;
      }

      core.info(`📤 Committing ${modifiedFiles.length} modified files...`);

      // Create commit message
      const totalComments = modifiedFiles.reduce((sum, file) => sum + file.comments.length, 0);
      const commitMessage = this.generateCommitMessage(modifiedFiles.length, totalComments);

      // Use the file processor's updateFiles method, pass branch name
      await this.fileProcessor.updateFiles(modifiedFiles, commitMessage, this.options.branchName);

      result.filesCommitted = modifiedFiles.length;
      core.info(`✅ Successfully committed ${modifiedFiles.length} files`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      core.error(`❌ File commit phase failed: ${errorMessage}`);
      result.errors.push(errorMessage);
      return result;
    }
  }

  /**
   * Generate a descriptive commit message
   */
  private generateCommitMessage(filesModified: number, commentsProcessed: number): string {
    const timestamp = new Date().toISOString();
    
    return `🤖 Process PR comments

Automatically processed ${commentsProcessed} PR comment${commentsProcessed !== 1 ? 's' : ''} from ${filesModified} file${filesModified !== 1 ? 's' : ''}:
- Removed ${this.options.commentPrefix} comments from code
- Created corresponding PR review comments

This commit was made by the PR Comment Processor GitHub Action at ${timestamp}.`;
  }

  /**
   * Log workflow summary
   */
  private logWorkflowSummary(result: WorkflowResult): void {
    const { summary, success, errors } = result;
    
    core.info('📊 PR Comment Processor Summary:');
    core.info(`   ⏱️ Processing time: ${summary.processingTimeMs}ms`);
    core.info(`   📁 Files processed: ${summary.filesProcessed}`);
    core.info(`   💬 Comments found: ${summary.commentsFound}`);
    core.info(`   📝 PR comments created: ${summary.prCommentsCreated}`);
    core.info(`   📤 Files committed: ${summary.filesCommitted}`);
    core.info(`   ❌ Errors: ${errors.length}`);
    
    if (success) {
      core.info('✅ Workflow completed successfully! 🎉');
    } else {
      core.warning(`⚠️ Workflow completed with ${errors.length} error(s)`);
      for (const error of errors) {
        core.error(`   ${error.phase}: ${error.error}`);
      }
    }

    // Set action outputs
    core.setOutput('files-processed', summary.filesProcessed.toString());
    core.setOutput('comments-found', summary.commentsFound.toString());
    core.setOutput('pr-comments-created', summary.prCommentsCreated.toString());
    core.setOutput('files-committed', summary.filesCommitted.toString());
    core.setOutput('processing-time-ms', summary.processingTimeMs.toString());
    core.setOutput('success', success.toString());
    core.setOutput('error-count', errors.length.toString());
  }

  /**
   * Get workflow status for external monitoring
   */
  getWorkflowStatus(): {
    isRunning: boolean;
    phase: string;
    filesProcessed: number;
    commentsFound: number;
  } {
    // This could be enhanced with state tracking for long-running workflows
    return {
      isRunning: false,
      phase: 'idle',
      filesProcessed: 0,
      commentsFound: 0
    };
  }
}

/**
 * Helper function to create a workflow coordinator
 */
export function createWorkflowCoordinator(options: WorkflowOptions): PRWorkflowCoordinator {
  return new PRWorkflowCoordinator(options);
}

/**
 * Quick function to execute the complete workflow
 */
export async function executeWorkflow(options: WorkflowOptions): Promise<WorkflowResult> {
  const coordinator = createWorkflowCoordinator(options);
  return await coordinator.executeWorkflow();
}