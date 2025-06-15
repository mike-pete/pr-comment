import * as core from '@actions/core'
import { executeWorkflow } from './pr-workflow-coordinator'

/**
 * Main entry point for the PR Comment Processor GitHub Action
 */
async function run(): Promise<void> {
	try {
		// Get inputs from the action
		const githubToken = core.getInput('github-token', { required: true })
		const prNumber = parseInt(core.getInput('pr-number', { required: true }), 10)
		const repository = core.getInput('repository', { required: true })
		const baseSha = core.getInput('base-sha', { required: true })
		const headSha = core.getInput('head-sha', { required: true })
		const branchName =
			core.getInput('branch-name', { required: false }) || process.env['GITHUB_HEAD_REF']
		const commentPrefix = core.getInput('comment-prefix', { required: false }) || 'PR:'
		const dryRun = core.getInput('dry-run', { required: false }) === 'true'
		const skipFileCommits = core.getInput('skip-file-commits', { required: false }) === 'true'
		const skipPRComments = core.getInput('skip-pr-comments', { required: false }) === 'true'

		// Log the inputs for debugging (excluding sensitive data)
		core.info('🚀 PR Comment Processor starting...')
		core.info(`   Repository: ${repository}`)
		core.info(`   PR Number: ${prNumber}`)
		core.info(`   Base SHA: ${baseSha}`)
		core.info(`   Head SHA: ${headSha}`)
		core.info(`   Branch Name: ${branchName}`)
		core.info(`   Comment Prefix: ${commentPrefix}`)
		core.info(`   Dry Run: ${dryRun}`)
		core.info(`   Skip File Commits: ${skipFileCommits}`)
		core.info(`   Skip PR Comments: ${skipPRComments}`)

		// Validate inputs
		if (isNaN(prNumber) || prNumber <= 0) {
			throw new Error(
				`Invalid PR number: ${core.getInput('pr-number')}. Must be a positive integer.`
			)
		}

		if (!branchName) {
			throw new Error('branchName (PR branch) is required but was not provided.')
		}

		// Execute the complete workflow
		const options = {
			githubToken,
			repository,
			prNumber,
			baseSha,
			headSha,
			branchName,
			commentPrefix,
			dryRun,
			skipFileCommits,
			skipPRComments,
		}

		const result = await executeWorkflow(options)

		// Set final action result
		if (result.success) {
			core.info('✅ PR Comment Processor completed successfully! 🎉')
		} else {
			core.setFailed('PR Comment Processor failed with errors.')

			// Log errors for debugging
			for (const error of result.errors) {
				core.error(`${error.phase}: ${error.error}`)
			}
		}

		// Set additional outputs for downstream actions
		core.setOutput(
			'workflow-result',
			JSON.stringify({
				success: result.success,
				summary: result.summary,
				errorCount: result.errors.length,
			})
		)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
		core.error(`❌ Action failed: ${errorMessage}`)
		core.setFailed(errorMessage)

		// Set failure outputs
		core.setOutput('files-processed', '0')
		core.setOutput('comments-found', '0')
		core.setOutput('pr-comments-created', '0')
		core.setOutput('files-committed', '0')
		core.setOutput('success', 'false')
		core.setOutput('error-count', '1')
	}
}

// Export for testing
export { run }

// Run the action if this file is executed directly
if (require.main === module) {
	run()
}
