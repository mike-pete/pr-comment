/**
 * File Processing System for PR Comment Processor
 *
 * This module handles GitHub API integration to process only files changed in the PR.
 * It filters for JavaScript/TypeScript files and processes them with the comment detector.
 */
import { PRComment } from './comment-detector';
export interface PRFile {
    filename: string;
    status: 'added' | 'modified' | 'removed' | 'renamed';
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    sha: string;
    originalContent?: string;
    modifiedContent?: string;
    comments: PRComment[];
}
export interface ProcessingResult {
    processedFiles: PRFile[];
    totalComments: number;
    totalFilesModified: number;
    skippedFiles: string[];
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export interface FileProcessorOptions {
    githubToken: string;
    repository: string;
    prNumber: number;
    baseSha: string;
    headSha: string;
    commentPrefix?: string;
    dryRun?: boolean;
}
/**
 * Main file processor class
 */
export declare class FileProcessor {
    private octokit;
    private options;
    constructor(options: FileProcessorOptions);
    /**
     * Process all files changed in the PR
     */
    processFiles(): Promise<ProcessingResult>;
    /**
     * Parse and validate repository string
     */
    private parseRepository;
    /**
     * Get list of files changed in the PR
     */
    private getPRFiles;
    /**
     * Process a single file
     */
    private processFile;
    /**
     * Get content of a file at a specific commit SHA
     */
    private getFileContent;
    /**
     * Check if a file should be processed based on its extension
     */
    private isSupportedFile;
    /**
     * Update file content in the repository
     */
    updateFile(file: PRFile, commitMessage: string): Promise<void>;
    /**
     * Update multiple files in batch
     */
    updateFiles(files: PRFile[], baseCommitMessage: string): Promise<void>;
}
/**
 * Helper function to create a FileProcessor instance
 */
export declare function createFileProcessor(options: FileProcessorOptions): FileProcessor;
/**
 * Quick function to process files with basic options
 */
export declare function processFiles(options: FileProcessorOptions): Promise<ProcessingResult>;
