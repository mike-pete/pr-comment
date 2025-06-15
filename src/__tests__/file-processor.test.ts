// @ts-nocheck
import { FileProcessor, createFileProcessor, processFiles } from '../file-processor';
import * as core from '@actions/core';
import { getOctokit } from '@actions/github';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockCore = core as jest.Mocked<typeof core>;
const mockGetOctokit = getOctokit as jest.MockedFunction<typeof getOctokit>;

describe('File Processing System', () => {
  let mockOctokit: any;
  
  const defaultOptions = {
    githubToken: 'test-token',
    repository: 'owner/repo',
    prNumber: 123,
    baseSha: 'base-sha',
    headSha: 'head-sha',
    commentPrefix: 'PR:'
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Octokit instance
    mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn()
        },
        repos: {
          getContent: jest.fn(),
          createOrUpdateFileContents: jest.fn()
        }
      }
    };
    
    mockGetOctokit.mockReturnValue(mockOctokit);
    
    // Mock core.info to avoid console output during tests
    mockCore.info.mockImplementation(() => {});
    mockCore.error.mockImplementation(() => {});
  });

  describe('FileProcessor', () => {
    describe('constructor and basic setup', () => {
      it('should create FileProcessor instance with valid options', () => {
        const processor = new FileProcessor(defaultOptions);
        expect(processor).toBeInstanceOf(FileProcessor);
        expect(mockGetOctokit).toHaveBeenCalledWith('test-token');
      });

      it('should validate repository format', async () => {
        const invalidOptions = { ...defaultOptions, repository: 'invalid-repo' };
        const processor = new FileProcessor(invalidOptions);
        
        await expect(processor.processFiles()).rejects.toThrow('Invalid repository format');
      });
    });

    describe('file filtering and processing', () => {
      it('should process only JavaScript/TypeScript files', async () => {
        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [
            { filename: 'src/component.tsx', status: 'modified', sha: 'file1-sha' },
            { filename: 'src/utils.js', status: 'modified', sha: 'file2-sha' },
            { filename: 'README.md', status: 'modified', sha: 'file3-sha' },
            { filename: 'package.json', status: 'modified', sha: 'file4-sha' },
            { filename: 'src/types.ts', status: 'modified', sha: 'file5-sha' }
          ]
        });

        mockOctokit.rest.repos.getContent.mockImplementation(({ path }) => {
          const content = `// Test file: ${path}\n// PR: Test comment in ${path}`;
          return Promise.resolve({
            data: {
              type: 'file',
              content: Buffer.from(content).toString('base64')
            }
          });
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        // Should only process JS/TS files (3 out of 5)
        expect(result.processedFiles).toHaveLength(3);
        expect(result.processedFiles.map(f => f.filename)).toEqual([
          'src/component.tsx',
          'src/utils.js', 
          'src/types.ts'
        ]);
      });

      it('should skip removed files', async () => {
        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [
            { filename: 'src/component.js', status: 'modified', sha: 'file1-sha' },
            { filename: 'src/removed.js', status: 'removed', sha: 'file2-sha' }
          ]
        });

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from('// Test content').toString('base64')
          }
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        expect(result.processedFiles).toHaveLength(1);
        expect(result.processedFiles[0].filename).toBe('src/component.js');
      });

      it('should detect and count PR comments correctly', async () => {
        const fileContent = `
function test() {
  // PR: This needs optimization
  console.log('hello');
  /* PR: Add error handling */
  return true;
}`;

        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [{ filename: 'test.js', status: 'modified', sha: 'test-sha' }]
        });

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from(fileContent).toString('base64')
          }
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        expect(result.totalComments).toBe(2);
        expect(result.processedFiles[0].comments).toHaveLength(2);
        expect(result.processedFiles[0].comments[0].content).toBe('This needs optimization');
        expect(result.processedFiles[0].comments[1].content).toBe('Add error handling');
      });

      it('should remove comments and create modified content', async () => {
        const fileContent = `function test() {
  // PR: Remove this comment
  console.log('hello');
}`;

        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [{ filename: 'test.js', status: 'modified', sha: 'test-sha' }]
        });

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from(fileContent).toString('base64')
          }
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        const processedFile = result.processedFiles[0];
        expect(processedFile.originalContent).toContain('PR: Remove this comment');
        expect(processedFile.modifiedContent).not.toContain('PR: Remove this comment');
        expect(processedFile.modifiedContent).toContain("console.log('hello')");
        expect(result.totalFilesModified).toBe(1);
      });

      it('should respect dry-run mode', async () => {
        const fileContent = `// PR: Test comment\nconsole.log('test');`;

        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [{ filename: 'test.js', status: 'modified', sha: 'test-sha' }]
        });

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from(fileContent).toString('base64')
          }
        });

        const dryRunOptions = { ...defaultOptions, dryRun: true };
        const processor = new FileProcessor(dryRunOptions);
        const result = await processor.processFiles();

        const processedFile = result.processedFiles[0];
        // In dry-run mode, content should not be modified
        expect(processedFile.modifiedContent).toBe(processedFile.originalContent);
        expect(processedFile.comments).toHaveLength(1);
      });
    });

    describe('error handling', () => {
      it('should handle GitHub API errors gracefully', async () => {
        mockOctokit.rest.pulls.listFiles.mockRejectedValue(new Error('API Error'));

        const processor = new FileProcessor(defaultOptions);
        await expect(processor.processFiles()).rejects.toThrow('API Error');
      });

      it('should handle file not found errors', async () => {
        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [{ filename: 'missing.js', status: 'modified', sha: 'missing-sha' }]
        });

        const error = new Error('Not Found');
        error.status = 404;
        mockOctokit.rest.repos.getContent.mockRejectedValue(error);

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].file).toBe('missing.js');
        expect(result.skippedFiles).toContain('missing.js');
      });

      it('should handle individual file processing errors', async () => {
        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [
            { filename: 'good.js', status: 'modified', sha: 'good-sha' },
            { filename: 'bad.js', status: 'modified', sha: 'bad-sha' }
          ]
        });

        mockOctokit.rest.repos.getContent.mockImplementation(({ path }) => {
          if (path === 'bad.js') {
            return Promise.reject(new Error('File processing error'));
          }
          return Promise.resolve({
            data: {
              type: 'file',
              content: Buffer.from('// Good file').toString('base64')
            }
          });
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        expect(result.processedFiles).toHaveLength(1);
        expect(result.processedFiles[0].filename).toBe('good.js');
        expect(result.errors).toHaveLength(1);
        expect(result.skippedFiles).toContain('bad.js');
      });
    });

    describe('file updating', () => {
      it('should update files with changes', async () => {
        const file = {
          filename: 'test.js',
          status: 'modified' as const,
          additions: 0,
          deletions: 0,
          changes: 0,
          sha: 'test-sha',
          originalContent: '// PR: Remove me\nconsole.log("test");',
          modifiedContent: 'console.log("test");',
          comments: [{ content: 'Remove me', lineNumber: 1 }]
        };

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            sha: 'current-sha'
          }
        });

        mockOctokit.rest.repos.createOrUpdateFileContents.mockResolvedValue({});

        const processor = new FileProcessor(defaultOptions);
        await processor.updateFile(file, 'Remove PR comments');

        expect(mockOctokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalledWith({
          owner: 'owner',
          repo: 'repo',
          path: 'test.js',
          message: 'Remove PR comments',
          content: Buffer.from('console.log("test");').toString('base64'),
          sha: 'current-sha',
          branch: 'head-sha'
        });
      });

      it('should skip files with no changes', async () => {
        const file = {
          filename: 'test.js',
          status: 'modified' as const,
          additions: 0,
          deletions: 0,
          changes: 0,
          sha: 'test-sha',
          originalContent: 'console.log("test");',
          modifiedContent: 'console.log("test");', // Same content
          comments: []
        };

        const processor = new FileProcessor(defaultOptions);
        await processor.updateFile(file, 'Remove PR comments');

        expect(mockOctokit.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
      });

      it('should handle dry-run mode for file updates', async () => {
        const file = {
          filename: 'test.js',
          status: 'modified' as const,
          additions: 0,
          deletions: 0,
          changes: 0,
          sha: 'test-sha',
          originalContent: '// PR: Remove me',
          modifiedContent: '',
          comments: [{ content: 'Remove me' }]
        };

        const dryRunOptions = { ...defaultOptions, dryRun: true };
        const processor = new FileProcessor(dryRunOptions);
        await processor.updateFile(file, 'Remove PR comments');

        expect(mockOctokit.rest.repos.createOrUpdateFileContents).not.toHaveBeenCalled();
        expect(mockCore.info).toHaveBeenCalledWith('🔄 [DRY RUN] Would update file: test.js');
      });
    });

    describe('batch file processing', () => {
      it('should process multiple files with different comment counts', async () => {
        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [
            { filename: 'file1.js', status: 'modified', sha: 'sha1' },
            { filename: 'file2.ts', status: 'modified', sha: 'sha2' },
            { filename: 'file3.jsx', status: 'modified', sha: 'sha3' }
          ]
        });

        mockOctokit.rest.repos.getContent.mockImplementation(({ path }) => {
          const contents = {
            'file1.js': '// PR: Comment 1\nconsole.log(1);',
            'file2.ts': '// PR: Comment 2a\n// PR: Comment 2b\nfunction test() {}',
            'file3.jsx': 'return <div>No comments</div>;'
          };
          return Promise.resolve({
            data: {
              type: 'file',
              content: Buffer.from(contents[path] || '').toString('base64')
            }
          });
        });

        const processor = new FileProcessor(defaultOptions);
        const result = await processor.processFiles();

        expect(result.processedFiles).toHaveLength(3);
        expect(result.totalComments).toBe(3); // 1 + 2 + 0
        expect(result.totalFilesModified).toBe(2); // Only files with comments
        
        expect(result.processedFiles[0].comments).toHaveLength(1);
        expect(result.processedFiles[1].comments).toHaveLength(2);
        expect(result.processedFiles[2].comments).toHaveLength(0);
      });
    });

    describe('custom comment prefix', () => {
      it('should respect custom comment prefix', async () => {
        const fileContent = `
// TODO: This should be found
// PR: This should not be found  
// REVIEW: This should be found
`;

        mockOctokit.rest.pulls.listFiles.mockResolvedValue({
          data: [{ filename: 'test.js', status: 'modified', sha: 'test-sha' }]
        });

        mockOctokit.rest.repos.getContent.mockResolvedValue({
          data: {
            type: 'file',
            content: Buffer.from(fileContent).toString('base64')
          }
        });

        const customOptions = { ...defaultOptions, commentPrefix: 'TODO:' };
        const processor = new FileProcessor(customOptions);
        const result = await processor.processFiles();

        expect(result.totalComments).toBe(1);
        expect(result.processedFiles[0].comments[0].content).toBe('This should be found');
      });
    });
  });

  describe('helper functions', () => {
    it('should create FileProcessor via createFileProcessor', () => {
      const processor = createFileProcessor(defaultOptions);
      expect(processor).toBeInstanceOf(FileProcessor);
    });

    it('should process files via processFiles helper', async () => {
      mockOctokit.rest.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'test.js', status: 'modified', sha: 'test-sha' }]
      });

      mockOctokit.rest.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          content: Buffer.from('// PR: Test\nconsole.log("test");').toString('base64')
        }
      });

      const result = await processFiles(defaultOptions);
      
      expect(result.processedFiles).toHaveLength(1);
      expect(result.totalComments).toBe(1);
    });
  });
});