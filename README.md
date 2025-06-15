# PR Comment Processor 🤖

A GitHub Action that automatically converts special code comments into PR review comments.

## ✨ Features

- **🔍 Smart Detection**: Finds `// PR:` and `/* PR: */` comments in JavaScript/TypeScript files
- **📝 PR Integration**: Creates GitHub PR review comments at the exact file and line locations
- **🔧 Code Cleanup**: Removes the original comments from your code after processing
- **⚡ Selective Processing**: Only processes files that are part of the current PR
- **🛡️ Safe Operations**: Dry-run mode and comprehensive error handling
- **📊 Detailed Reporting**: Comprehensive logging and GitHub Action outputs

## 🚀 Quick Start

Add this to your `.github/workflows/pr-comment-processor.yml`:

```yaml
name: Process PR Comments

on:
  pull_request:
    types: [opened, synchronize, edited]
    paths:
      - '**.js'
      - '**.jsx'
      - '**.ts'
      - '**.tsx'
      - '**.mjs'
      - '**.cjs'

permissions:
  contents: write
  pull-requests: write

jobs:
  process-comments:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Process PR Comments
        uses: your-username/pr-comment-processor@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          pr-number: ${{ github.event.pull_request.number }}
          repository: ${{ github.repository }}
          base-sha: ${{ github.event.pull_request.base.sha }}
          head-sha: ${{ github.event.pull_request.head.sha }}
```

## 💬 Usage Example

Write comments in your code that you want to appear as PR review comments:

```javascript
function calculateTotal(items) {
  // PR: Consider adding input validation here
  let total = 0;
  
  for (const item of items) {
    /* PR: We should also handle the case where price might be undefined */
    total += item.price;
  }
  
  // PR: Add proper error handling for edge cases
  return total;
}
```

**What happens:**
1. The action detects these special comments
2. Creates PR review comments at the exact lines
3. Removes the comments from your code
4. Commits the cleaned code back to the PR

## ⚙️ Configuration

### Required Inputs

| Input | Description |
|-------|-------------|
| `github-token` | GitHub token for API access (use `${{ secrets.GITHUB_TOKEN }}`) |
| `pr-number` | Pull request number (use `${{ github.event.pull_request.number }}`) |
| `repository` | Repository in format `owner/repo` (use `${{ github.repository }}`) |
| `base-sha` | Base commit SHA (use `${{ github.event.pull_request.base.sha }}`) |
| `head-sha` | Head commit SHA (use `${{ github.event.pull_request.head.sha }}`) |

### Optional Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `comment-prefix` | Comment prefix to look for | `"PR:"` |
| `dry-run` | Run without making changes | `false` |

### Outputs

| Output | Description |
|--------|-------------|
| `files-processed` | Number of files processed |
| `comments-found` | Number of PR comments found |
| `pr-comments-created` | Number of PR review comments created |
| `files-committed` | Number of files committed back to PR |
| `success` | Whether the workflow completed successfully |
| `processing-time-ms` | Processing time in milliseconds |

## 🎛️ Advanced Configuration

### Custom Comment Prefix

```yaml
- name: Process PR Comments
  uses: your-username/pr-comment-processor@v1
  with:
    comment-prefix: "REVIEW:"
    # other inputs...
```

### Dry Run Mode

```yaml
- name: Process PR Comments (Dry Run)
  uses: your-username/pr-comment-processor@v1
  with:
    dry-run: true
    # other inputs...
```

## 📝 Supported File Types

- JavaScript (`.js`, `.mjs`, `.cjs`)
- TypeScript (`.ts`)
- JSX (`.jsx`)
- TSX (`.tsx`)

## 🔒 Permissions

The action requires these permissions:

```yaml
permissions:
  contents: write      # To read files and commit changes
  pull-requests: write # To create PR comments
```

## 🐛 Troubleshooting

### Common Issues

**Action fails with "Authentication failed"**
- Ensure `github-token` is set to `${{ secrets.GITHUB_TOKEN }}`
- Check that the workflow has proper permissions

**No comments are processed**
- Verify your comments start with the correct prefix (default: `PR:`)
- Make sure you're processing the right file types
- Check that files are part of the current PR

**Files not being committed**
- Ensure the action has `contents: write` permission
- Verify the repository allows GitHub Actions to create commits

### Debug Mode

Enable debug logging by setting the `ACTIONS_STEP_DEBUG` secret to `true` in your repository.

## 📊 Example Output

```
🚀 PR Comment Processor starting...
📁 Phase 1: Processing files and detecting PR comments...
   📄 Processing file: src/utils.js
   💬 Found 2 PR comments
💬 Phase 2: Creating PR review comments...
   💬 Creating PR comment on src/utils.js:15
   ✅ Created comment #123 at https://github.com/owner/repo/pull/456#discussion_r789
📤 Phase 3: Committing modified files...
   📤 Committing 1 modified files...
   ✅ Successfully committed 1 files

📊 PR Comment Processor Summary:
   ⏱️ Processing time: 3248ms
   📁 Files processed: 1
   💬 Comments found: 2
   📝 PR comments created: 2
   📤 Files committed: 1
   ❌ Errors: 0
✅ Workflow completed successfully! 🎉
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [GitHub Actions Toolkit](https://github.com/actions/toolkit)
- [Octokit](https://github.com/octokit/octokit.js)
- TypeScript and Jest for robust development