"use strict";
/**
 * PR Workflow Coordinator for PR Comment Processor
 *
 * This module coordinates the complete workflow:
 * 1. Process files and detect PR comments
 * 2. Create PR review comments
 * 3. Commit modified files back to the PR branch
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRWorkflowCoordinator = void 0;
exports.createWorkflowCoordinator = createWorkflowCoordinator;
exports.executeWorkflow = executeWorkflow;
const core = __importStar(require("@actions/core"));
const file_processor_1 = require("./file-processor");
const pr_comment_creator_1 = require("./pr-comment-creator");
/**
 * PR Workflow Coordinator class
 */
class PRWorkflowCoordinator {
    options;
    fileProcessor;
    commentCreator;
    constructor(options) {
        this.options = {
            commentPrefix: 'PR:',
            dryRun: false,
            skipFileCommits: false,
            skipPRComments: false,
            ...options
        };
        // Initialize file processor
        const fileProcessorOptions = {
            githubToken: this.options.githubToken,
            repository: this.options.repository,
            prNumber: this.options.prNumber,
            baseSha: this.options.baseSha,
            headSha: this.options.headSha,
            commentPrefix: this.options.commentPrefix || 'PR:',
            dryRun: this.options.dryRun || false
        };
        this.fileProcessor = new file_processor_1.FileProcessor(fileProcessorOptions);
        // Initialize comment creator
        const commentCreatorOptions = {
            githubToken: this.options.githubToken,
            repository: this.options.repository,
            prNumber: this.options.prNumber,
            commitSha: this.options.headSha,
            dryRun: this.options.dryRun || false
        };
        this.commentCreator = new pr_comment_creator_1.PRCommentCreator(commentCreatorOptions);
    }
    /**
     * Execute the complete PR comment processing workflow
     */
    async executeWorkflow() {
        const startTime = Date.now();
        const result = {
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
            }
            else if (this.options.skipPRComments) {
                core.info('⏭️ Phase 2: Skipping PR comment creation (skipPRComments = true)');
            }
            else {
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
            }
            else if (this.options.skipFileCommits) {
                core.info('⏭️ Phase 3: Skipping file commits (skipFileCommits = true)');
            }
            else {
                core.info('📝 Phase 3: No modified files to commit');
            }
            // Calculate processing time
            result.summary.processingTimeMs = Date.now() - startTime;
            // Determine overall success
            result.success = result.errors.length === 0;
            // Log final summary
            this.logWorkflowSummary(result);
            return result;
        }
        catch (error) {
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
    async processFiles() {
        try {
            return await this.fileProcessor.processFiles();
        }
        catch (error) {
            core.error('❌ File processing phase failed');
            throw error;
        }
    }
    /**
     * Create PR review comments from detected comments
     */
    async createPRComments(processedFiles) {
        try {
            // Convert processed files to comment requests
            const commentRequests = (0, pr_comment_creator_1.createPRCommentRequests)(processedFiles);
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
        }
        catch (error) {
            core.error('❌ Comment creation phase failed');
            throw error;
        }
    }
    /**
     * Commit modified files back to the PR branch
     */
    async commitModifiedFiles(processedFiles) {
        const result = {
            filesCommitted: 0,
            errors: []
        };
        try {
            // Filter files that have been modified
            const modifiedFiles = processedFiles.filter(file => file.modifiedContent && file.modifiedContent !== file.originalContent);
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            core.error(`❌ File commit phase failed: ${errorMessage}`);
            result.errors.push(errorMessage);
            return result;
        }
    }
    /**
     * Generate a descriptive commit message
     */
    generateCommitMessage(filesModified, commentsProcessed) {
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
    logWorkflowSummary(result) {
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
        }
        else {
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
    getWorkflowStatus() {
        // This could be enhanced with state tracking for long-running workflows
        return {
            isRunning: false,
            phase: 'idle',
            filesProcessed: 0,
            commentsFound: 0
        };
    }
}
exports.PRWorkflowCoordinator = PRWorkflowCoordinator;
/**
 * Helper function to create a workflow coordinator
 */
function createWorkflowCoordinator(options) {
    return new PRWorkflowCoordinator(options);
}
/**
 * Quick function to execute the complete workflow
 */
async function executeWorkflow(options) {
    const coordinator = createWorkflowCoordinator(options);
    return await coordinator.executeWorkflow();
}
//# sourceMappingURL=pr-workflow-coordinator.js.map