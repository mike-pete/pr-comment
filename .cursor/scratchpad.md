# PR Comment Processing GitHub Action

## Background and Motivation

The user wants to create a GitHub Action that automatically processes special PR comments embedded in JavaScript and TypeScript files. The workflow is:

1. Developer commits code with special comments like `// PR: some comment` or `/* PR: some comment */`
2. GitHub Action detects these comments and records their content and location
3. GitHub Action removes these comments from the code files
4. GitHub Action creates actual PR comments on GitHub at the same file/line locations with the original comment content

This allows developers to embed contextual PR comments directly in their code during development, which then get automatically converted to proper GitHub PR comments.

## Key Challenges and Analysis

After analyzing the requirements, I've identified several key technical challenges:

### 1. Comment Detection & Parsing
- **Challenge**: Accurately identify PR comments in various formats while avoiding false positives
- **Formats to handle**: 
  - Single-line: `// PR: comment text`
  - Multi-line: `/* PR: comment text */`
  - Edge cases: nested comments, comments in strings, comments in template literals
- **Solution approach**: Use AST parsing or robust regex patterns to ensure accurate detection

### 2. File Processing & Git Integration
- **Challenge**: Only process files that are part of the PR changes, not entire repository
- **Considerations**: 
  - Get PR diff to identify changed files
  - Handle new files, modified files, and deleted files appropriately
  - Maintain proper git history and commit attribution
- **Solution approach**: Use GitHub API to get PR file changes, then process only relevant files

### 3. Line Number Mapping
- **Challenge**: After removing comments, line numbers change, affecting PR comment placement
- **Considerations**:
  - Comments removal shifts subsequent line numbers up
  - Multiple comments in same file compound the issue
  - Need to map original line numbers to final line numbers
- **Solution approach**: Process comments from bottom to top, or calculate line number adjustments

### 4. GitHub API Integration
- **Challenge**: Create PR comments programmatically with proper authentication
- **Requirements**:
  - GitHub token with appropriate permissions
  - Handle API rate limits and errors
  - Create comments on specific file lines
- **Solution approach**: Use GitHub REST API with proper error handling and retries

### 5. Atomic Operations & Error Handling
- **Challenge**: Ensure consistency - either all comments are processed or none
- **Considerations**:
  - What if comment removal succeeds but PR comment creation fails?
  - How to handle partial failures across multiple files?
  - Rollback strategy for failed operations
- **Solution approach**: Implement transaction-like behavior with proper error recovery

### 6. Performance & Scale
- **Challenge**: Handle large PRs with many files and comments efficiently
- **Considerations**:
  - Large file processing
  - Many API calls for multiple comments
  - GitHub Action timeout limits
- **Solution approach**: Batch operations, implement progress tracking, set reasonable limits

## High-level Task Breakdown

### Phase 1: Foundation Setup
**Task 1.1: Create GitHub Action Workflow**
- **Objective**: Set up the basic GitHub Action structure
- **Deliverables**: `.github/workflows/pr-comment-processor.yml`
- **Success Criteria**: 
  - Action triggers on PR events (opened, synchronize, edited)
  - Has proper permissions for repository access and PR comments
  - Includes environment setup (Node.js, dependencies)
- **Estimated effort**: 30 minutes

**Task 1.2: Project Structure & Dependencies**
- **Objective**: Set up the action's code structure and dependencies
- **Deliverables**: 
  - `action.yml` (action metadata)
  - `package.json` with required dependencies
  - Basic TypeScript/JavaScript setup
- **Success Criteria**: 
  - Action can be invoked and runs basic hello world
  - Dependencies include GitHub API client, file processing utilities
  - Proper TypeScript configuration if using TS
- **Estimated effort**: 45 minutes

### Phase 2: Core Logic Implementation
**Task 2.1: Comment Detection Engine**
- **Objective**: Build robust comment detection for JS/TS files
- **Deliverables**: 
  - Function to parse file and extract PR comments with line numbers
  - Support for both `// PR:` and `/* PR: */` formats
  - Unit tests for various comment scenarios
- **Success Criteria**: 
  - Correctly identifies PR comments and extracts content
  - Handles edge cases (nested comments, comments in strings)
  - Returns comment text, line number, and position information
  - 100% test coverage for comment parsing logic
- **Estimated effort**: 2 hours

**Task 2.2: File Processing System**
- **Objective**: Process only PR-changed files and remove comments
- **Deliverables**: 
  - Function to get PR file changes via GitHub API
  - Function to remove identified comments from files
  - Logic to handle line number adjustments
- **Success Criteria**: 
  - Only processes JS/TS files that are part of the PR
  - Successfully removes PR comments while preserving other code
  - Maintains proper file formatting and doesn't break syntax
  - Handles multiple comments per file correctly
- **Estimated effort**: 2.5 hours

### Phase 3: GitHub Integration
**Task 3.1: PR Comment Creation**
- **Objective**: Create PR comments via GitHub API
- **Deliverables**: 
  - Function to create PR comments at specific file lines
  - Proper error handling and retry logic
  - Rate limiting considerations
- **Success Criteria**: 
  - Successfully creates PR comments with original comment content
  - Comments appear on correct file and line numbers
  - Handles API errors gracefully with appropriate logging
  - Respects GitHub API rate limits
- **Estimated effort**: 1.5 hours

**Task 3.2: File Modification & Commit**
- **Objective**: Commit the modified files back to the PR
- **Deliverables**: 
  - Logic to commit modified files to the PR branch
  - Proper commit message and attribution
  - Handle git authentication and permissions
- **Success Criteria**: 
  - Modified files are committed to the PR branch
  - Commit message clearly indicates what changes were made
  - Maintains git history integrity
  - Works with protected branches (if applicable)
- **Estimated effort**: 1.5 hours

### Phase 4: Integration & Testing
**Task 4.1: End-to-End Integration**
- **Objective**: Integrate all components into working GitHub Action
- **Deliverables**: 
  - Complete action implementation
  - Comprehensive error handling
  - Detailed logging for debugging
- **Success Criteria**: 
  - Action runs successfully on PR events
  - Processes comments and creates PR comments correctly
  - Handles errors gracefully with useful error messages
  - Provides clear logging for troubleshooting
- **Estimated effort**: 2 hours

**Task 4.2: Testing & Validation**
- **Objective**: Comprehensive testing of the complete system
- **Deliverables**: 
  - Unit tests for all major functions
  - Integration tests with mock GitHub API
  - Test cases for various scenarios and edge cases
  - Documentation for testing the action
- **Success Criteria**: 
  - All tests pass consistently
  - Edge cases are handled properly
  - Action works with different PR sizes and comment patterns
  - Clear documentation for manual testing
- **Estimated effort**: 2 hours

### Phase 5: Documentation & Polish
**Task 5.1: Documentation**
- **Objective**: Create comprehensive documentation
- **Deliverables**: 
  - README with setup instructions
  - Usage examples and configuration options
  - Troubleshooting guide
- **Success Criteria**: 
  - Clear setup instructions for other repositories
  - Examples of different comment formats
  - Common issues and solutions documented
- **Estimated effort**: 1 hour

**Task 5.2: Configuration & Customization**
- **Objective**: Add configuration options for flexibility
- **Deliverables**: 
  - Configurable comment prefixes (not just "PR:")
  - Option to customize commit messages
  - File type filters
- **Success Criteria**: 
  - Users can customize behavior via action inputs
  - Backward compatibility maintained
  - Configuration is well-documented
- **Estimated effort**: 1 hour

## Project Status Board

### Phase 1: Foundation Setup
- [ ] **Task 1.1**: Create GitHub Action Workflow (30 min)
- [ ] **Task 1.2**: Project Structure & Dependencies (45 min)

### Phase 2: Core Logic Implementation  
- [ ] **Task 2.1**: Comment Detection Engine (2 hours)
- [ ] **Task 2.2**: File Processing System (2.5 hours)

### Phase 3: GitHub Integration
- [ ] **Task 3.1**: PR Comment Creation (1.5 hours)
- [ ] **Task 3.2**: File Modification & Commit (1.5 hours)

### Phase 4: Integration & Testing
- [ ] **Task 4.1**: End-to-End Integration (2 hours)
- [ ] **Task 4.2**: Testing & Validation (2 hours)

### Phase 5: Documentation & Polish
- [ ] **Task 5.1**: Documentation (1 hour)
- [ ] **Task 5.2**: Configuration & Customization (1 hour)

**Total Estimated Effort**: ~14 hours over 10 distinct tasks

## Current Status / Progress Tracking

**Status**: Planning Complete ✅
**Next Phase**: Ready for implementation - awaiting user approval to proceed with execution

The plan above represents a comprehensive approach to building this GitHub Action. Each task has clear success criteria and estimated effort. The approach prioritizes:
1. **Reliability**: Robust comment detection and error handling
2. **Maintainability**: Clean code structure with comprehensive tests  
3. **Usability**: Good documentation and configuration options
4. **Performance**: Efficient processing for large PRs

Ready to proceed with execution when approved.

## Executor's Feedback or Assistance Requests

None yet.

## Lessons

- Include info useful for debugging in the program output.
- Read the file before you try to edit it.
- If there are vulnerabilities that appear in the terminal, run npm audit before proceeding
- Always ask before using the -force git command