// @ts-nocheck
import { 
  PRWorkflowCoordinator, 
  createWorkflowCoordinator, 
  executeWorkflow 
} from '../pr-workflow-coordinator';
import { FileProcessor } from '../file-processor';
import { PRCommentCreator } from '../pr-comment-creator';
import * as core from '@actions/core';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('../file-processor');
jest.mock('../pr-comment-creator');

const mockCore = core as jest.Mocked<typeof core>;
const MockFileProcessor = FileProcessor as jest.MockedClass<typeof FileProcessor>;
const MockPRCommentCreator = PRCommentCreator as jest.MockedClass<typeof PRCommentCreator>;

describe('PR Workflow Coordinator', () => {
  const defaultOptions = {
    githubToken: 'test-token',
    repository: 'owner/repo',
    prNumber: 123,
    baseSha: 'base-sha',
    headSha: 'head-sha',
    commentPrefix: 'PR:',
    dryRun: false
  };

  // Create mock instances
  const mockFileProcessor = {
    processFiles: jest.fn(),
    updateFiles: jest.fn()
  };

  const mockCommentCreator = {
    createComments: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks
    MockFileProcessor.mockImplementation(() => mockFileProcessor as any);
    MockPRCommentCreator.mockImplementation(() => mockCommentCreator as any);
    
    // Mock core functions
    mockCore.info.mockImplementation(() => {});
    mockCore.error.mockImplementation(() => {});
    mockCore.warning.mockImplementation(() => {});
    mockCore.setOutput.mockImplementation(() => {});
  });

  describe('PRWorkflowCoordinator', () => {
    describe('constructor and initialization', () => {
      it('should create coordinator with valid options', () => {
        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        expect(coordinator).toBeInstanceOf(PRWorkflowCoordinator);
      });

      it('should initialize file processor and comment creator', () => {
        new PRWorkflowCoordinator(defaultOptions);
        
        expect(MockFileProcessor).toHaveBeenCalledWith({
          githubToken: 'test-token',
          repository: 'owner/repo',
          prNumber: 123,
          baseSha: 'base-sha',
          headSha: 'head-sha',
          commentPrefix: 'PR:',
          dryRun: false
        });

        expect(MockPRCommentCreator).toHaveBeenCalledWith({
          githubToken: 'test-token',
          repository: 'owner/repo',
          prNumber: 123,
          commitSha: 'head-sha',
          dryRun: false
        });
      });

      it('should apply default options correctly', () => {
        const minimalOptions = {
          githubToken: 'test-token',
          repository: 'owner/repo',
          prNumber: 123,
          baseSha: 'base-sha',
          headSha: 'head-sha'
        };

        new PRWorkflowCoordinator(minimalOptions);
        
        expect(MockFileProcessor).toHaveBeenCalledWith({
          githubToken: 'test-token',
          repository: 'owner/repo',
          prNumber: 123,
          baseSha: 'base-sha',
          headSha: 'head-sha',
          commentPrefix: 'PR:',
          dryRun: false
        });
      });
    });

    describe('complete workflow execution', () => {
      it('should execute full workflow successfully', async () => {
        // Mock file processing result
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'test.js',
              comments: [
                { content: 'Test comment', lineNumber: 1 }
              ],
              originalContent: '// PR: Test comment\nconsole.log("hello");',
              modifiedContent: 'console.log("hello");'
            }
          ],
          totalComments: 1,
          totalFilesModified: 1,
          errors: []
        };

        // Mock comment creation result
        const commentCreationResult = {
          totalRequests: 1,
          successfulComments: 1,
          failedComments: 0,
          createdComments: [
            { filename: 'test.js', line: 1, commentId: 123, url: 'https://test.url', body: 'Test comment' }
          ],
          errors: []
        };

        // Setup mocks
        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
        mockFileProcessor.updateFiles.mockResolvedValue(undefined);
        mockCommentCreator.createComments.mockResolvedValue(commentCreationResult);

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(true);
        expect(result.summary.filesProcessed).toBe(1);
        expect(result.summary.commentsFound).toBe(1);
        expect(result.summary.prCommentsCreated).toBe(1);
        expect(result.summary.filesCommitted).toBe(1);
        expect(result.errors).toHaveLength(0);

        // Verify all phases were called
        expect(mockFileProcessor.processFiles).toHaveBeenCalled();
        expect(mockCommentCreator.createComments).toHaveBeenCalled();
        expect(mockFileProcessor.updateFiles).toHaveBeenCalled();
      });

      it('should handle workflow with no comments found', async () => {
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'test.js',
              comments: [],
              originalContent: 'console.log("hello");',
              modifiedContent: 'console.log("hello");'
            }
          ],
          totalComments: 0,
          totalFilesModified: 0,
          errors: []
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(true);
        expect(result.summary.filesProcessed).toBe(1);
        expect(result.summary.commentsFound).toBe(0);
        expect(result.summary.prCommentsCreated).toBe(0);
        expect(result.summary.filesCommitted).toBe(0);

        // Comment creation and file commits should be skipped
        expect(mockCommentCreator.createComments).not.toHaveBeenCalled();
        expect(mockFileProcessor.updateFiles).not.toHaveBeenCalled();
      });

      it('should handle skipPRComments option', async () => {
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'test.js',
              comments: [{ content: 'Test comment', lineNumber: 1 }],
              originalContent: '// PR: Test comment\nconsole.log("hello");',
              modifiedContent: 'console.log("hello");'
            }
          ],
          totalComments: 1,
          totalFilesModified: 1,
          errors: []
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
        mockFileProcessor.updateFiles.mockResolvedValue(undefined);

        const optionsWithSkip = { ...defaultOptions, skipPRComments: true };
        const coordinator = new PRWorkflowCoordinator(optionsWithSkip);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(true);
        expect(result.summary.prCommentsCreated).toBe(0);
        expect(result.summary.filesCommitted).toBe(1);

        // Comment creation should be skipped
        expect(mockCommentCreator.createComments).not.toHaveBeenCalled();
        expect(mockFileProcessor.updateFiles).toHaveBeenCalled();
      });

      it('should handle skipFileCommits option', async () => {
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'test.js',
              comments: [{ content: 'Test comment', lineNumber: 1 }],
              originalContent: '// PR: Test comment\nconsole.log("hello");',
              modifiedContent: 'console.log("hello");'
            }
          ],
          totalComments: 1,
          totalFilesModified: 1,
          errors: []
        };

        const commentCreationResult = {
          totalRequests: 1,
          successfulComments: 1,
          failedComments: 0,
          createdComments: [],
          errors: []
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
        mockCommentCreator.createComments.mockResolvedValue(commentCreationResult);

        const optionsWithSkip = { ...defaultOptions, skipFileCommits: true };
        const coordinator = new PRWorkflowCoordinator(optionsWithSkip);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(true);
        expect(result.summary.prCommentsCreated).toBe(1);
        expect(result.summary.filesCommitted).toBe(0);

        // File commits should be skipped
        expect(mockCommentCreator.createComments).toHaveBeenCalled();
        expect(mockFileProcessor.updateFiles).not.toHaveBeenCalled();
      });

      it('should handle partial failures gracefully', async () => {
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'test.js',
              comments: [{ content: 'Test comment', lineNumber: 1 }],
              originalContent: '// PR: Test comment',
              modifiedContent: ''
            }
          ],
          totalComments: 1,
          totalFilesModified: 1,
          errors: [
            { file: 'error.js', error: 'File processing failed' }
          ]
        };

        const commentCreationResult = {
          totalRequests: 1,
          successfulComments: 0,
          failedComments: 1,
          createdComments: [],
          errors: [
            { filename: 'test.js', line: 1, body: 'Test comment', error: 'Comment creation failed' }
          ]
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
        mockCommentCreator.createComments.mockResolvedValue(commentCreationResult);
        mockFileProcessor.updateFiles.mockResolvedValue(undefined);

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0].phase).toBe('file-processing');
        expect(result.errors[1].phase).toBe('comment-creation');
      });

      it('should handle unexpected errors', async () => {
        mockFileProcessor.processFiles.mockRejectedValue(new Error('Unexpected error'));

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        const result = await coordinator.executeWorkflow();

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toBe('Unexpected error');
      });
    });

    describe('workflow phases', () => {
      it('should generate proper commit messages', async () => {
        const fileProcessingResult = {
          processedFiles: [
            {
              filename: 'file1.js',
              comments: [{ content: 'Comment 1' }, { content: 'Comment 2' }],
              originalContent: 'original',
              modifiedContent: 'modified'
            },
            {
              filename: 'file2.js',
              comments: [{ content: 'Comment 3' }],
              originalContent: 'original2',
              modifiedContent: 'modified2'
            }
          ],
          totalComments: 3,
          totalFilesModified: 2,
          errors: []
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
        mockFileProcessor.updateFiles.mockResolvedValue(undefined);

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        await coordinator.executeWorkflow();

        // Check that updateFiles was called with a proper commit message
        expect(mockFileProcessor.updateFiles).toHaveBeenCalledWith(
          expect.any(Array),
          expect.stringContaining('🤖 Process PR comments')
        );

        const commitMessage = mockFileProcessor.updateFiles.mock.calls[0][1];
        expect(commitMessage).toContain('3 PR comments');
        expect(commitMessage).toContain('2 files');
        expect(commitMessage).toContain('PR Comment Processor');
      });

      it('should set correct action outputs', async () => {
        const fileProcessingResult = {
          processedFiles: [{ filename: 'test.js', comments: [], originalContent: 'test', modifiedContent: 'test' }],
          totalComments: 0,
          totalFilesModified: 0,
          errors: []
        };

        mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);

        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        await coordinator.executeWorkflow();

        expect(mockCore.setOutput).toHaveBeenCalledWith('files-processed', '1');
        expect(mockCore.setOutput).toHaveBeenCalledWith('comments-found', '0');
        expect(mockCore.setOutput).toHaveBeenCalledWith('pr-comments-created', '0');
        expect(mockCore.setOutput).toHaveBeenCalledWith('files-committed', '0');
        expect(mockCore.setOutput).toHaveBeenCalledWith('success', 'true');
        expect(mockCore.setOutput).toHaveBeenCalledWith('error-count', '0');
      });
    });

    describe('workflow status', () => {
      it('should return workflow status', () => {
        const coordinator = new PRWorkflowCoordinator(defaultOptions);
        const status = coordinator.getWorkflowStatus();

        expect(status).toEqual({
          isRunning: false,
          phase: 'idle',
          filesProcessed: 0,
          commentsFound: 0
        });
      });
    });
  });

  describe('helper functions', () => {
    it('should create coordinator via createWorkflowCoordinator', () => {
      const coordinator = createWorkflowCoordinator(defaultOptions);
      expect(coordinator).toBeInstanceOf(PRWorkflowCoordinator);
    });

    it('should execute workflow via executeWorkflow helper', async () => {
      const fileProcessingResult = {
        processedFiles: [],
        totalComments: 0,
        totalFilesModified: 0,
        errors: []
      };

      mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);

      const result = await executeWorkflow(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.summary.filesProcessed).toBe(0);
    });
  });

  describe('dry run mode', () => {
    it('should handle dry run mode throughout workflow', async () => {
      const fileProcessingResult = {
        processedFiles: [
          {
            filename: 'test.js',
            comments: [{ content: 'Test comment', lineNumber: 1 }],
            originalContent: '// PR: Test comment\nconsole.log("hello");',
            modifiedContent: '// PR: Test comment\nconsole.log("hello");' // No change in dry run
          }
        ],
        totalComments: 1,
        totalFilesModified: 0, // No modifications in dry run
        errors: []
      };

      const commentCreationResult = {
        totalRequests: 1,
        successfulComments: 1,
        failedComments: 0,
        createdComments: [
          { filename: 'test.js', line: 1, commentId: -1, url: 'dry-run-url', body: 'Test comment' }
        ],
        errors: []
      };

      mockFileProcessor.processFiles.mockResolvedValue(fileProcessingResult);
      mockCommentCreator.createComments.mockResolvedValue(commentCreationResult);

      const dryRunOptions = { ...defaultOptions, dryRun: true };
      const coordinator = new PRWorkflowCoordinator(dryRunOptions);
      const result = await coordinator.executeWorkflow();

      expect(result.success).toBe(true);
      expect(result.summary.prCommentsCreated).toBe(1);
      expect(result.summary.filesCommitted).toBe(0);

      // In dry run, no actual file commits should happen
      expect(mockFileProcessor.updateFiles).not.toHaveBeenCalled();
    });
  });
});