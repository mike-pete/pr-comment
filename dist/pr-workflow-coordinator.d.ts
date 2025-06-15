/**
 * PR Workflow Coordinator for PR Comment Processor
 *
 * This module coordinates the complete workflow:
 * 1. Process files and detect PR comments
 * 2. Create PR review comments
 * 3. Commit modified files back to the PR branch
 */
export interface WorkflowOptions {
    githubToken: string;
    repository: string;
    prNumber: number;
    baseSha: string;
    headSha: string;
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
export declare class PRWorkflowCoordinator {
    private options;
    private fileProcessor;
    private commentCreator;
    constructor(options: WorkflowOptions);
    /**
     * Execute the complete PR comment processing workflow
     */
    executeWorkflow(): Promise<WorkflowResult>;
    /**
     * Process files and detect PR comments
     */
    private processFiles;
    /**
     * Create PR review comments from detected comments
     */
    private createPRComments;
    /**
     * Commit modified files back to the PR branch
     */
    private commitModifiedFiles;
    /**
     * Generate a descriptive commit message
     */
    private generateCommitMessage;
    /**
     * Log workflow summary
     */
    private logWorkflowSummary;
    /**
     * Get workflow status for external monitoring
     */
    getWorkflowStatus(): {
        isRunning: boolean;
        phase: string;
        filesProcessed: number;
        commentsFound: number;
    };
}
/**
 * Helper function to create a workflow coordinator
 */
export declare function createWorkflowCoordinator(options: WorkflowOptions): PRWorkflowCoordinator;
/**
 * Quick function to execute the complete workflow
 */
export declare function executeWorkflow(options: WorkflowOptions): Promise<WorkflowResult>;
