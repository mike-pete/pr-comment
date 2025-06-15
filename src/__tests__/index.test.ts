import { run } from '../index';
import * as core from '@actions/core';
import * as github from '@actions/github';

// Mock the GitHub Actions core and github modules
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockCore = core as jest.Mocked<typeof core>;
const mockGithub = github as jest.Mocked<typeof github>;

describe('PR Comment Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock core.getInput to return test values
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'github-token': 'test-token',
        'pr-number': '123',
        'repository': 'owner/repo',
        'base-sha': 'abc123',
        'head-sha': 'def456',
        'comment-prefix': 'PR:',
        'dry-run': 'false',
      };
      return inputs[name] || '';
    });

    // Mock GitHub context
    Object.defineProperty(mockGithub, 'context', {
      value: {
        eventName: 'pull_request',
        repo: {
          owner: 'owner',
          repo: 'repo',
        },
      },
      writable: true,
    });

    // Mock GitHub client
    const mockOctokit = {
      rest: {
        users: {
          getAuthenticated: jest.fn().mockResolvedValue({
            data: { login: 'test-user' },
          }),
        },
        repos: {
          get: jest.fn().mockResolvedValue({
            data: { full_name: 'owner/repo' },
          }),
        },
      },
    };

    mockGithub.getOctokit.mockReturnValue(mockOctokit as any);
  });

  it('should run successfully with valid inputs', async () => {
    await run();

    // Verify core functions were called
    expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });
    expect(mockCore.getInput).toHaveBeenCalledWith('pr-number', { required: true });
    expect(mockCore.getInput).toHaveBeenCalledWith('repository', { required: true });
    
    // Verify outputs were set
    expect(mockCore.setOutput).toHaveBeenCalledWith('comments-found', '0');
    expect(mockCore.setOutput).toHaveBeenCalledWith('files-modified', '0');
    expect(mockCore.setOutput).toHaveBeenCalledWith('pr-comments-created', '0');
    
    // Verify success logging
    expect(mockCore.info).toHaveBeenCalledWith('🚀 PR Comment Processor starting...');
    expect(mockCore.info).toHaveBeenCalledWith('✅ PR Comment Processor completed successfully!');
    
    // Verify no errors
    expect(mockCore.setFailed).not.toHaveBeenCalled();
  });

  it('should handle invalid repository format', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'repository') return 'invalid-repo-format';
      return 'test-value';
    });

    await run();

    // Should set failed status
    expect(mockCore.setFailed).toHaveBeenCalled();
    expect(mockCore.error).toHaveBeenCalledWith('❌ Failed to access repository');
  });

  it('should handle missing required inputs', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') throw new Error('Input required and not supplied: github-token');
      return 'test-value';
    });

    await run();

    // Should set failed status
    expect(mockCore.setFailed).toHaveBeenCalled();
  });
});