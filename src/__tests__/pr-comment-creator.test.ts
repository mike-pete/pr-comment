// @ts-nocheck
import { 
  PRCommentCreator, 
  createPRCommentCreator, 
  createPRComments, 
  createPRCommentRequests,
  PRCommentRequest
} from '../pr-comment-creator';
import * as core from '@actions/core';
import { getOctokit } from '@actions/github';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockCore = core as jest.Mocked<typeof core>;
const mockGetOctokit = getOctokit as jest.MockedFunction<typeof getOctokit>;

describe('PR Comment Creator', () => {
  let mockOctokit: any;
  
  const defaultOptions = {
    githubToken: 'test-token',
    repository: 'owner/repo',
    prNumber: 123,
    commitSha: 'abc123def456',
    dryRun: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Octokit instance
    mockOctokit = {
      rest: {
        pulls: {
          createReviewComment: jest.fn()
        },
        rateLimit: {
          get: jest.fn()
        }
      }
    };
    
    mockGetOctokit.mockReturnValue(mockOctokit);
    
    // Mock core functions to avoid console output during tests
    mockCore.info.mockImplementation(() => {});
    mockCore.error.mockImplementation(() => {});
    mockCore.warning.mockImplementation(() => {});
  });

  describe('PRCommentCreator', () => {
    describe('constructor and basic setup', () => {
      it('should create PRCommentCreator instance with valid options', () => {
        const creator = new PRCommentCreator(defaultOptions);
        expect(creator).toBeInstanceOf(PRCommentCreator);
        expect(mockGetOctokit).toHaveBeenCalledWith('test-token');
      });

      it('should validate repository format', async () => {
        const invalidOptions = { ...defaultOptions, repository: 'invalid-repo' };
        const creator = new PRCommentCreator(invalidOptions);
        
        const request: PRCommentRequest = {
          filename: 'test.js',
          line: 1,
          body: 'Test comment',
          originalComment: {
            content: 'Test comment',
            lineNumber: 1,
            columnStart: 0,
            columnEnd: 20,
            type: 'single',
            fullMatch: '// PR: Test comment',
            startIndex: 0,
            endIndex: 20
          }
        };

        await expect(creator.createComment(request)).rejects.toThrow('Invalid repository format');
      });
    });

    describe('single comment creation', () => {
      it('should create a PR comment successfully', async () => {
        const expectedComment = {
          id: 123,
          html_url: 'https://github.com/owner/repo/pull/123#comment-123'
        };

        mockOctokit.rest.pulls.createReviewComment.mockResolvedValue({
          data: expectedComment
        });

        const request: PRCommentRequest = {
          filename: 'src/test.js',
          line: 5,
          body: 'This needs optimization',
          originalComment: {
            content: 'This needs optimization',
            lineNumber: 5,
            columnStart: 2,
            columnEnd: 30,
            type: 'single',
            fullMatch: '// PR: This needs optimization',
            startIndex: 100,
            endIndex: 130
          }
        };

        const creator = new PRCommentCreator(defaultOptions);
        const result = await creator.createComment(request);

        expect(result.success).toBe(true);
        expect(result.commentId).toBe(123);
        expect(result.url).toBe('https://github.com/owner/repo/pull/123#comment-123');

        expect(mockOctokit.rest.pulls.createReviewComment).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          pull_number: 123,
          commit_id: 'abc123def456',
          path: 'src/test.js',
          line: 5,
          body: expect.stringContaining('This needs optimization')
        });
      });

      it('should format comment body with metadata', async () => {
        mockOctokit.rest.pulls.createReviewComment.mockResolvedValue({
          data: { id: 123, html_url: 'https://test.url' }
        });

        const request: PRCommentRequest = {
          filename: 'test.js',
          line: 1,
          body: 'Original comment content',
          originalComment: {
            content: 'Original comment content',
            lineNumber: 1,
            columnStart: 0,
            columnEnd: 20,
            type: 'multi',
            fullMatch: '/* PR: Original comment content */',
            startIndex: 0,
            endIndex: 35
          }
        };

        const creator = new PRCommentCreator(defaultOptions);
        await creator.createComment(request);

        const callArgs = mockOctokit.rest.pulls.createReviewComment.mock.calls[0][0];
        const body = callArgs.body;

        expect(body).toContain('💬 **PR Comment**');
        expect(body).toContain('Original comment content');
        expect(body).toContain('multi-line');
        expect(body).toContain('/* PR: Original comment content */');
        expect(body).toContain('PR Comment Processor');
      });

      it('should handle dry-run mode', async () => {
        const dryRunOptions = { ...defaultOptions, dryRun: true };
        const creator = new PRCommentCreator(dryRunOptions);

        const request: PRCommentRequest = {
          filename: 'test.js',
          line: 1,
          body: 'Test comment',
          originalComment: {
            content: 'Test comment',
            lineNumber: 1,
            columnStart: 0,
            columnEnd: 20,
            type: 'single',
            fullMatch: '// PR: Test comment',
            startIndex: 0,
            endIndex: 20
          }
        };

        const result = await creator.createComment(request);

        expect(result.success).toBe(true);
        expect(result.commentId).toBe(-1);
        expect(result.url).toContain('dry-run-comment');
        expect(mockOctokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
        expect(mockCore.info).toHaveBeenCalledWith('🔄 [DRY RUN] Would create PR comment on test.js:1');
      });

      it('should handle GitHub API errors', async () => {
        const apiError = new Error('API Error');
        apiError.status = 422;
        mockOctokit.rest.pulls.createReviewComment.mockRejectedValue(apiError);

        const request: PRCommentRequest = {
          filename: 'test.js',
          line: 1,
          body: 'Test comment',
          originalComment: {
            content: 'Test comment',
            lineNumber: 1,
            columnStart: 0,
            columnEnd: 20,
            type: 'single',
            fullMatch: '// PR: Test comment',
            startIndex: 0,
            endIndex: 20
          }
        };

        const creator = new PRCommentCreator(defaultOptions);
        const result = await creator.createComment(request);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Validation failed');
      });
    });

    describe('batch comment creation', () => {
      it('should create multiple comments successfully', async () => {
        mockOctokit.rest.pulls.createReviewComment.mockImplementation(({ path, line }) => {
          return Promise.resolve({
            data: {
              id: parseInt(`${line}00`),
              html_url: `https://github.com/owner/repo/pull/123#comment-${line}00`
            }
          });
        });

        const requests: PRCommentRequest[] = [
          {
            filename: 'file1.js',
            line: 1,
            body: 'Comment 1',
            originalComment: {
              content: 'Comment 1',
              lineNumber: 1,
              columnStart: 0,
              columnEnd: 15,
              type: 'single',
              fullMatch: '// PR: Comment 1',
              startIndex: 0,
              endIndex: 15
            }
          },
          {
            filename: 'file2.js',
            line: 5,
            body: 'Comment 2',
            originalComment: {
              content: 'Comment 2',
              lineNumber: 5,
              columnStart: 0,
              columnEnd: 15,
              type: 'single',
              fullMatch: '// PR: Comment 2',
              startIndex: 50,
              endIndex: 65
            }
          }
        ];

        const creator = new PRCommentCreator(defaultOptions);
        const result = await creator.createComments(requests);

        expect(result.totalRequests).toBe(2);
        expect(result.successfulComments).toBe(2);
        expect(result.failedComments).toBe(0);
        expect(result.createdComments).toHaveLength(2);
        expect(result.errors).toHaveLength(0);

        expect(result.createdComments[0].filename).toBe('file1.js');
        expect(result.createdComments[0].line).toBe(1);
        expect(result.createdComments[1].filename).toBe('file2.js');
        expect(result.createdComments[1].line).toBe(5);
      });

      it('should handle partial failures gracefully', async () => {
        mockOctokit.rest.pulls.createReviewComment.mockImplementation(({ path }) => {
          if (path === 'file2.js') {
            const error = new Error('File not found');
            error.status = 404;
            return Promise.reject(error);
          }
          return Promise.resolve({
            data: { id: 100, html_url: 'https://test.url' }
          });
        });

        const requests: PRCommentRequest[] = [
          {
            filename: 'file1.js',
            line: 1,
            body: 'Comment 1',
            originalComment: {
              content: 'Comment 1',
              lineNumber: 1,
              columnStart: 0,
              columnEnd: 15,
              type: 'single',
              fullMatch: '// PR: Comment 1',
              startIndex: 0,
              endIndex: 15
            }
          },
          {
            filename: 'file2.js',
            line: 5,
            body: 'Comment 2',
            originalComment: {
              content: 'Comment 2',
              lineNumber: 5,
              columnStart: 0,
              columnEnd: 15,
              type: 'single',
              fullMatch: '// PR: Comment 2',
              startIndex: 50,
              endIndex: 65
            }
          }
        ];

        const creator = new PRCommentCreator(defaultOptions);
        const result = await creator.createComments(requests);

        expect(result.totalRequests).toBe(2);
        expect(result.successfulComments).toBe(1);
        expect(result.failedComments).toBe(1);
        expect(result.createdComments).toHaveLength(1);
        expect(result.errors).toHaveLength(1);

        expect(result.errors[0].filename).toBe('file2.js');
        expect(result.errors[0].error).toContain('Not found');
      });

      it('should handle empty request list', async () => {
        const creator = new PRCommentCreator(defaultOptions);
        const result = await creator.createComments([]);

        expect(result.totalRequests).toBe(0);
        expect(result.successfulComments).toBe(0);
        expect(result.failedComments).toBe(0);
        expect(mockOctokit.rest.pulls.createReviewComment).not.toHaveBeenCalled();
      });

      it('should sort requests by filename and line number', async () => {
        const callOrder: string[] = [];
        
        mockOctokit.rest.pulls.createReviewComment.mockImplementation(({ path, line }) => {
          callOrder.push(`${path}:${line}`);
          return Promise.resolve({
            data: { id: 100, html_url: 'https://test.url' }
          });
        });

        const requests: PRCommentRequest[] = [
          {
            filename: 'zzz.js',
            line: 10,
            body: 'Comment Z',
            originalComment: { content: 'Comment Z', lineNumber: 10, columnStart: 0, columnEnd: 15, type: 'single', fullMatch: '// PR: Comment Z', startIndex: 0, endIndex: 15 }
          },
          {
            filename: 'aaa.js',
            line: 5,
            body: 'Comment A',
            originalComment: { content: 'Comment A', lineNumber: 5, columnStart: 0, columnEnd: 15, type: 'single', fullMatch: '// PR: Comment A', startIndex: 0, endIndex: 15 }
          },
          {
            filename: 'aaa.js',
            line: 1,
            body: 'Comment A1',
            originalComment: { content: 'Comment A1', lineNumber: 1, columnStart: 0, columnEnd: 15, type: 'single', fullMatch: '// PR: Comment A1', startIndex: 0, endIndex: 15 }
          }
        ];

        const creator = new PRCommentCreator(defaultOptions);
        await creator.createComments(requests);

        expect(callOrder).toEqual(['aaa.js:1', 'aaa.js:5', 'zzz.js:10']);
      });
    });

    describe('error handling and formatting', () => {
      it('should format different GitHub API error codes', async () => {
        const errorCases = [
          { status: 401, expectedMessage: 'Authentication failed' },
          { status: 403, expectedMessage: 'Forbidden' },
          { status: 404, expectedMessage: 'Not found' },
          { status: 422, expectedMessage: 'Validation failed' },
          { status: 500, expectedMessage: 'GitHub API error (500)' }
        ];

        for (const { status, expectedMessage } of errorCases) {
          const apiError = new Error('Test error');
          apiError.status = status;
          mockOctokit.rest.pulls.createReviewComment.mockRejectedValue(apiError);

          const request: PRCommentRequest = {
            filename: 'test.js',
            line: 1,
            body: 'Test',
            originalComment: { content: 'Test', lineNumber: 1, columnStart: 0, columnEnd: 10, type: 'single', fullMatch: '// PR: Test', startIndex: 0, endIndex: 10 }
          };

          const creator = new PRCommentCreator(defaultOptions);
          const result = await creator.createComment(request);

          expect(result.success).toBe(false);
          expect(result.error).toContain(expectedMessage);
        }
      });
    });

    describe('rate limiting', () => {
      it('should get rate limit information', async () => {
        const mockRateLimit = {
          rate: {
            remaining: 4000,
            reset: Math.floor(Date.now() / 1000) + 3600
          }
        };

        mockOctokit.rest.rateLimit.get.mockResolvedValue({
          data: mockRateLimit
        });

        const creator = new PRCommentCreator(defaultOptions);
        const rateLimitInfo = await creator.getRateLimitInfo();

        expect(rateLimitInfo.remaining).toBe(4000);
        expect(rateLimitInfo.resetTime).toBeInstanceOf(Date);
      });

      it('should handle rate limit check failure', async () => {
        mockOctokit.rest.rateLimit.get.mockRejectedValue(new Error('Rate limit API error'));

        const creator = new PRCommentCreator(defaultOptions);
        const rateLimitInfo = await creator.getRateLimitInfo();

        expect(rateLimitInfo.remaining).toBe(0);
        expect(mockCore.warning).toHaveBeenCalledWith('⚠️ Failed to get rate limit info');
      });
    });
  });

  describe('helper functions', () => {
    it('should create PR comment requests from processed files', () => {
      const processedFiles = [
        {
          filename: 'file1.js',
          comments: [
            {
              content: 'Comment 1',
              lineNumber: 1,
              columnStart: 0,
              columnEnd: 15,
              type: 'single' as const,
              fullMatch: '// PR: Comment 1',
              startIndex: 0,
              endIndex: 15
            },
            {
              content: 'Comment 2',
              lineNumber: 5,
              columnStart: 0,
              columnEnd: 15,
              type: 'multi' as const,
              fullMatch: '/* PR: Comment 2 */',
              startIndex: 50,
              endIndex: 70
            }
          ]
        },
        {
          filename: 'file2.js',
          comments: [
            {
              content: 'Comment 3',
              lineNumber: 10,
              columnStart: 0,
              columnEnd: 15,
              type: 'single' as const,
              fullMatch: '// PR: Comment 3',
              startIndex: 100,
              endIndex: 115
            }
          ]
        }
      ];

      const requests = createPRCommentRequests(processedFiles);

      expect(requests).toHaveLength(3);
      
      expect(requests[0].filename).toBe('file1.js');
      expect(requests[0].line).toBe(1);
      expect(requests[0].body).toBe('Comment 1');

      expect(requests[1].filename).toBe('file1.js');
      expect(requests[1].line).toBe(5);
      expect(requests[1].body).toBe('Comment 2');

      expect(requests[2].filename).toBe('file2.js');
      expect(requests[2].line).toBe(10);
      expect(requests[2].body).toBe('Comment 3');
    });

    it('should create PRCommentCreator via helper function', () => {
      const creator = createPRCommentCreator(defaultOptions);
      expect(creator).toBeInstanceOf(PRCommentCreator);
    });

    it('should create PR comments via helper function', async () => {
      mockOctokit.rest.pulls.createReviewComment.mockResolvedValue({
        data: { id: 123, html_url: 'https://test.url' }
      });

      const requests: PRCommentRequest[] = [
        {
          filename: 'test.js',
          line: 1,
          body: 'Test comment',
          originalComment: { content: 'Test comment', lineNumber: 1, columnStart: 0, columnEnd: 15, type: 'single', fullMatch: '// PR: Test comment', startIndex: 0, endIndex: 15 }
        }
      ];

      const result = await createPRComments(defaultOptions, requests);

      expect(result.totalRequests).toBe(1);
      expect(result.successfulComments).toBe(1);
    });
  });
});