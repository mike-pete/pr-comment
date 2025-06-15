"use strict";
/**
 * File Processing System for PR Comment Processor
 *
 * This module handles GitHub API integration to process only files changed in the PR.
 * It filters for JavaScript/TypeScript files and processes them with the comment detector.
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
exports.FileProcessor = void 0;
exports.createFileProcessor = createFileProcessor;
exports.processFiles = processFiles;
const core = __importStar(require("@actions/core"));
const github_1 = require("@actions/github");
const comment_detector_1 = require("./comment-detector");
/**
 * Supported file extensions for JavaScript/TypeScript processing
 */
const SUPPORTED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
/**
 * Main file processor class
 */
class FileProcessor {
    octokit;
    options;
    constructor(options) {
        this.options = options;
        this.octokit = (0, github_1.getOctokit)(options.githubToken);
    }
    /**
     * Process all files changed in the PR
     */
    async processFiles() {
        const result = {
            processedFiles: [],
            totalComments: 0,
            totalFilesModified: 0,
            skippedFiles: [],
            errors: [],
        };
        try {
            core.info('🔍 Getting PR file changes...');
            // Get list of files changed in the PR
            const changedFiles = await this.getPRFiles();
            core.info(`📁 Found ${changedFiles.length} changed files in PR`);
            // Filter for supported file types
            const supportedFiles = changedFiles.filter((file) => this.isSupportedFile(file.filename) && file.status !== 'removed');
            core.info(`✅ ${supportedFiles.length} JavaScript/TypeScript files to process`);
            if (supportedFiles.length === 0) {
                core.info('📝 No JavaScript/TypeScript files to process');
                return result;
            }
            // Process each supported file
            for (const file of supportedFiles) {
                try {
                    const processedFile = await this.processFile(file);
                    result.processedFiles.push(processedFile);
                    result.totalComments += processedFile.comments.length;
                    if (processedFile.modifiedContent !== processedFile.originalContent) {
                        result.totalFilesModified++;
                    }
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    core.error(`❌ Error processing file ${file.filename}: ${errorMessage}`);
                    result.errors.push({ file: file.filename, error: errorMessage });
                    result.skippedFiles.push(file.filename);
                }
            }
            // Report results
            core.info(`📊 Processing complete:`);
            core.info(`   - Files processed: ${result.processedFiles.length}`);
            core.info(`   - Comments found: ${result.totalComments}`);
            core.info(`   - Files modified: ${result.totalFilesModified}`);
            core.info(`   - Files skipped: ${result.skippedFiles.length}`);
            core.info(`   - Errors: ${result.errors.length}`);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            core.error(`❌ Failed to process files: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Parse and validate repository string
     */
    parseRepository() {
        const parts = this.options.repository.split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error(`Invalid repository format: ${this.options.repository}. Expected format: owner/repo`);
        }
        return { owner: parts[0], repo: parts[1] };
    }
    /**
     * Get list of files changed in the PR
     */
    async getPRFiles() {
        const { owner, repo } = this.parseRepository();
        try {
            const { data: files } = await this.octokit.rest.pulls.listFiles({
                owner,
                repo,
                pull_number: this.options.prNumber,
                per_page: 100, // GitHub's max per page
            });
            return files.map((file) => ({
                filename: file.filename,
                status: file.status,
                sha: file.sha || '',
                additions: file.additions || 0,
                deletions: file.deletions || 0,
                changes: file.changes || 0,
                patch: file.patch,
            }));
        }
        catch (error) {
            core.error('Failed to get PR files from GitHub API');
            throw error;
        }
    }
    /**
     * Process a single file
     */
    async processFile(file) {
        core.info(`📄 Processing file: ${file.filename}`);
        // Get file content
        const originalContent = await this.getFileContent(file.filename, this.options.headSha);
        // Detect PR comments
        const comments = (0, comment_detector_1.detectPRComments)(originalContent, {
            commentPrefix: this.options.commentPrefix || 'PR:',
        });
        core.info(`   💬 Found ${comments.length} PR comments`);
        // Remove comments to create modified content
        let modifiedContent = originalContent;
        if (comments.length > 0 && !this.options.dryRun) {
            modifiedContent = (0, comment_detector_1.removePRComments)(originalContent, comments);
            core.info(`   🔧 Removed comments from file`);
        }
        return {
            filename: file.filename,
            status: file.status,
            additions: 0, // Will be filled from GitHub API
            deletions: 0, // Will be filled from GitHub API
            changes: 0, // Will be filled from GitHub API
            sha: file.sha,
            originalContent,
            modifiedContent,
            comments,
        };
    }
    /**
     * Get content of a file at a specific commit SHA
     */
    async getFileContent(filename, sha) {
        const { owner, repo } = this.parseRepository();
        try {
            const { data } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: filename,
                ref: sha,
            });
            // Handle file content (data can be file or directory)
            if (Array.isArray(data)) {
                throw new Error(`Path ${filename} is a directory, not a file`);
            }
            if (data.type !== 'file') {
                throw new Error(`Path ${filename} is not a file`);
            }
            // Decode base64 content
            if (!data.content) {
                throw new Error(`No content found for file ${filename}`);
            }
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }
        catch (error) {
            if (error instanceof Error && 'status' in error && error.status === 404) {
                throw new Error(`File ${filename} not found at commit ${sha}`);
            }
            throw error;
        }
    }
    /**
     * Check if a file should be processed based on its extension
     */
    isSupportedFile(filename) {
        const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        return SUPPORTED_EXTENSIONS.includes(extension);
    }
    /**
     * Update file content in the repository
     */
    async updateFile(file, commitMessage, branch) {
        if (this.options.dryRun) {
            core.info(`🔄 [DRY RUN] Would update file: ${file.filename}`);
            return;
        }
        if (!file.modifiedContent || file.modifiedContent === file.originalContent) {
            core.info(`⏭️ Skipping ${file.filename} - no changes needed`);
            return;
        }
        const { owner, repo } = this.parseRepository();
        try {
            // Get current file info to get the SHA
            const { data: currentFile } = await this.octokit.rest.repos.getContent({
                owner,
                repo,
                path: file.filename,
                ref: this.options.headSha,
            });
            if (Array.isArray(currentFile) || currentFile.type !== 'file') {
                throw new Error(`Cannot update ${file.filename} - not a file`);
            }
            // Update the file
            await this.octokit.rest.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: file.filename,
                message: commitMessage,
                content: Buffer.from(file.modifiedContent).toString('base64'),
                sha: currentFile.sha,
                branch: branch,
            });
            core.info(`✅ Updated file: ${file.filename}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            core.error(`❌ Failed to update file ${file.filename}: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Update multiple files in batch
     */
    async updateFiles(files, baseCommitMessage, branch) {
        if (!files.length) {
            core.info('📝 No files to update');
            return;
        }
        core.info(`🔄 Updating ${files.length} files...`);
        for (const file of files) {
            if (file.comments.length > 0) {
                const commitMessage = `${baseCommitMessage}

- ${file.filename}: Removed ${file.comments.length} PR comment(s)`;
                await this.updateFile(file, commitMessage, branch);
            }
        }
        core.info(`✅ File updates complete`);
    }
}
exports.FileProcessor = FileProcessor;
/**
 * Helper function to create a FileProcessor instance
 */
function createFileProcessor(options) {
    return new FileProcessor(options);
}
/**
 * Quick function to process files with basic options
 */
async function processFiles(options) {
    const processor = createFileProcessor(options);
    return await processor.processFiles();
}
//# sourceMappingURL=file-processor.js.map